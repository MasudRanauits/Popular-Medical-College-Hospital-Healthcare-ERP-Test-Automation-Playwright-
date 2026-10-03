import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/** A patient as the ward list on the left of the page shows them. */
export interface WardPatient {
  /** Admission number, the second line of the card. */
  admissionNo: string;
  /** Bed as the card prints it, e.g. "ICU-07" - the form shows it as "P(ICU-07)". */
  bed: string;
}

/** The read-only panel the page fills in once a patient is picked out of the ward list. */
export interface IndentPatient {
  /** "Indent for" - the patient's UHID, not the admission number searched for. */
  uhid: string;
  name: string;
  /** "Cabin", e.g. "P(ICU-07)" - the same string the Verify Indent grid prints. */
  cabin: string;
  admittedOn: string;
}

/** One line as it was added to the medicine table. */
export interface IndentLine {
  /** Brand name, as the lookup grid and the Item Description box both show it. */
  product: string;
  quantity: number;
}

/** A row of the Verify Indent grid. */
export interface VerifiedIndent {
  indentNo: string;
  time: string;
  cabinType: string;
  cabinNo: string;
  priority: string;
  status: string;
  userName: string;
}

/**
 * Nurse Station at /hospital/nurse-station - Hospital module, "Nurse Station" in the
 * drawer. Medicine Indent > Add Indent is the tab this page object drives: the ward nurse
 * picks an admitted patient, sets a priority, and lists the medicines to be sent up.
 *
 * A fourth framework mix on top of the three the other page objects deal with. The form
 * itself is Bootstrap, the way the admission wizard is - div.form-group holding a
 * label.form-label and its control - but the Product Code picker is a Radzen lookup, the
 * medicine table is a MudBlazor grid whose quantity cells are Blazorise numeric inputs,
 * and the save confirmation is a Blazorise snackbar rather than the .toast/.alert pair
 * BasePage knows about.
 *
 * Every id on the page is a Blazor circuit id - 0HNP0I4ANSCB5 - regenerated on each
 * connection, so nothing here is located by id except the two the app names itself
 * (Qty_Piece, and the grid's context.Item.QtyPiece).
 *
 * Three things about this form are not guessable from looking at it, and each cost a run
 * to find: the patient panel is disabled and fills only from the ward list; Enter on
 * Quantity is what adds a line, there being no Add button; and the Product Code lookup
 * reopens itself after that Enter. See selectPatient, addItem and openProductLookup.
 */
export class NurseStationPage extends BasePage {
  /** Also the drawer link's href, so specs opening it through the menu share this one. */
  static readonly PATH = '/hospital/nurse-station';

  protected readonly path = NurseStationPage.PATH;

  /** The outer tabs across the top, in order. */
  static readonly TABS = [
    'MEDICINE INDENT',
    'DIET INDENT',
    'DIET DASHBOARD',
    'DISCHARGED DIET HISTORY',
    'CONSULTANCY SERVICE',
    'IPD SERVICE ENTRY',
    'CLEAR FROM NURSE STATION',
  ] as const;

  /** What the Priority dropdown offers, past its "Select Item" placeholder. */
  static readonly PRIORITIES = [
    'Routine',
    'Urgent',
    'Critical Care',
    'Others',
    'New Admission',
    'Discharge',
  ] as const;

  /** The medicine table's columns. Two unlabelled ones follow, for the spinner and the bin. */
  static readonly ITEM_COLUMNS = ['Srl.No', 'Item Description', 'Quantity', 'Unit'] as const;

  /** The Verify Indent grid's columns, in order. */
  static readonly VERIFY_COLUMNS = [
    'INDENTNO',
    'INDENT TIME',
    'CABIN TYPE',
    'CABIN NO',
    'PRIORITY',
    'STATUS',
    'USERNAME',
    'ACTION',
  ] as const;

  /** Ward list down the left: its search box and the patient cards under it. */
  readonly patientSearch: Locator;
  readonly patientList: Locator;
  readonly patientCards: Locator;

  /** The indent's own fields. */
  readonly outlet: Locator;
  readonly priority: Locator;
  readonly otRoom: Locator;

  /** The patient panel - all four disabled, filled by selecting a card. */
  readonly indentFor: Locator;
  readonly admittedDateTime: Locator;
  readonly patientName: Locator;
  readonly cabin: Locator;

  /** The item entry row: the Product Code lookup, what it fills in, and the quantity. */
  readonly productLookup: Locator;
  readonly lookupPanel: Locator;
  readonly itemDescription: Locator;
  readonly quantity: Locator;

  /** The medicine table, and the Save under it. */
  readonly itemsGrid: Locator;
  readonly itemRows: Locator;
  readonly save: Locator;

  /** Whatever the app is saying right now - a save confirmation, a refusal, a fetch note. */
  readonly snackbar: Locator;

  constructor(page: Page) {
    super(page);

    this.patientSearch = this.group('Search').locator('input');
    this.patientList = page.locator('ul.list-group-scrollable');
    this.patientCards = this.patientList.locator('li.list-group-item');

    this.outlet = this.group('Outlet').locator('select');
    // Named in the markup, unlike the Outlet one, so it needs no label to find it.
    this.priority = page.locator('select[name="Priority"]');
    this.otRoom = page.locator('select[name="model.OTRoomName"]');

    this.indentFor = page.locator('input[name="_SelectedLeftGridItem.UHID"]');
    // A flatpickr: the group also holds the component's own hidden mirror input.
    this.admittedDateTime = this.group('Admitted DateTime').locator('input:visible');
    this.patientName = page.locator('input[name="_SelectedLeftGridItem.FullName"]');
    this.cabin = page.locator('input[name="_SelectedLeftGridItem.CabinNo"]');

    this.productLookup = this.group('Product Code').locator('.rz-dropdown');
    // Rendered at the end of the body rather than inside the field, so it is reached from
    // the page. Only one lookup is on this tab, so there is nothing to disambiguate from.
    this.lookupPanel = page.locator('.rz-dropdown-panel').first();
    this.itemDescription = page.locator('input[name="_SelectedBrandDetail.ProductName"]');
    this.quantity = page.locator('input#Qty_Piece');

    this.itemsGrid = page
      .locator('table.mud-table-root')
      .filter({ has: page.locator('th', { hasText: 'Item Description' }) })
      .first();
    // MudBlazor keeps an empty-state row in tbody when the table holds nothing, and it is
    // a <tr> like any other - so a bare row count reads 1 for an empty table. What marks
    // it is the <th class="mud-table-empty-row"> inside it.
    this.itemRows = this.itemsGrid
      .locator('tbody tr')
      .filter({ hasNot: page.locator('th.mud-table-empty-row') });

    this.save = page.locator('button[type="submit"].btn-success');
    // Only the ones showing: a faded snackbar stays in the stack carrying snackbar-hide
    // and its old text. Newest last. See saveIndent.
    this.snackbar = page.locator('div.snackbar.snackbar-show').last();
  }

  /**
   * The field group carrying `label`: a <div class="form-group"> holding a
   * <label class="form-label"> and its control, the same shape the admission wizard uses.
   * No <label for=...> is rendered anywhere on the page, so getByLabel resolves none of it.
   *
   * Matched on a regex rather than :text-is because the Product Code label renders as
   * "Product Code " - the trailing space is in the markup, and hasText does not trim a
   * regex the way it trims a string.
   *
   * Visible groups only: the Verify Indent tab's markup stays in the DOM while Add Indent
   * is the tab on screen.
   */
  group(label: string): Locator {
    return this.page.locator('div.form-group:visible').filter({
      has: this.page.locator('label.form-label', { hasText: new RegExp(`^\\s*${label}\\s*$`) }),
    });
  }

  /** One of the page's tabs, e.g. tab('VERIFY INDENT'). CSS uppercases the label. */
  tab(name: string): Locator {
    return this.page
      .locator('a.nav-link')
      .filter({ hasText: new RegExp(`^${name}$`, 'i') })
      .first();
  }

  /** Opens `name` and waits for its pane to take over. */
  async openTab(name: string): Promise<void> {
    await this.tab(name).click();
    await expect(this.tab(name)).toHaveClass(/active/);
  }

  /** Narrows the ward list to `term` - an admission number, a bed, or a patient name. */
  async searchPatient(term: string): Promise<void> {
    await this.patientSearch.fill('');
    await this.patientSearch.fill(term);
  }

  /** The ward card for `admissionNo`. Each card prints its bed over its admission number. */
  cardFor(admissionNo: string): Locator {
    return this.patientCards.filter({ hasText: admissionNo }).first();
  }

  /** A card read back as bed and admission number. */
  async readCard(card: Locator): Promise<WardPatient> {
    const text = (await card.innerText()).replace(/\s+/g, ' ').trim();
    return {
      bed: text.replace(/\s*\d{10,}\s*$/, '').trim(),
      admissionNo: text.match(/\d{10,}/)?.[0] ?? '',
    };
  }

  /** The first patient on the ward, as a seed for a case that has to name one. */
  async firstWardPatient(): Promise<WardPatient> {
    await expect(this.patientCards.first()).toBeVisible({ timeout: 60_000 });
    return this.readCard(this.patientCards.first());
  }

  /**
   * Looks `admissionNo` up in the ward list, opens that patient, and returns the panel the
   * app filled in.
   *
   * The four patient fields are disabled in the markup - there is no typing a patient into
   * this form, by a nurse or by a test. Clicking the card is the only thing that fills
   * them, and the click is a round trip, so the Name box is waited on rather than read.
   *
   * The search filters a list the app already holds, so one card is the normal result for
   * an admission number; two would mean the number is not unique.
   */
  async selectPatient(admissionNo: string): Promise<IndentPatient> {
    await this.searchPatient(admissionNo);

    const card = this.cardFor(admissionNo);
    await expect(card, `no patient admitted under ${admissionNo}`).toBeVisible({ timeout: 30_000 });
    await card.click();
    await expect(card).toHaveClass(/active/);

    await expect(
      this.patientName,
      `${admissionNo} never loaded into the indent form`
    ).not.toHaveValue('', { timeout: 30_000 });

    return {
      uhid: (await this.indentFor.inputValue()).trim(),
      name: (await this.patientName.inputValue()).trim(),
      cabin: (await this.cabin.inputValue()).trim(),
      admittedOn: (await this.admittedDateTime.inputValue()).trim(),
    };
  }

  /** Picks `name` in the Priority dropdown, e.g. choosePriority('Urgent'). */
  async choosePriority(name: string): Promise<void> {
    await this.priority.selectOption({ label: name });
  }

  /**
   * Leaves the Product Code lookup open, whether or not it already was.
   *
   * Not a plain click, on purpose. The app reopens this lookup by itself the moment a line
   * is added - it is putting the cursor back where the next medicine goes - so from the
   * second item on, the panel is already up and clicking the control *closes* it. A loop
   * that clicked every time therefore worked on item one and timed out on item two,
   * looking for a search box in a panel its own click had just dismissed.
   *
   * The click is retried rather than awaited because the other way this fails is the
   * ordinary Blazor one: a click landing before the handler is wired is swallowed.
   */
  async openProductLookup(attempts = 4): Promise<void> {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      if (await this.lookupPanel.isVisible().catch(() => false)) return;
      await this.productLookup.click().catch(() => {});
      await this.lookupPanel.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
    }

    // Radzen builds the panel on the first open and leaves it in the body afterwards, so
    // "not found" here means no click ever reached the control - as against "hidden",
    // which would mean one did and the panel closed again.
    await expect(this.lookupPanel, 'the Product Code lookup never opened').toBeVisible();
  }

  /**
   * Searches the Product Code lookup for `term` and returns the brand names it offers,
   * once it is offering at least `minimum` of them.
   *
   * The search box keeps whatever was typed into it last - the panel is one control reused
   * for every line - so it is cleared before the new term goes in.
   *
   * `minimum` is what makes the read reliable rather than a convenience. The lookup
   * reopens on the medicine it last had selected, so for a moment after it comes back up
   * its grid holds that one row, and a search's results land a beat later. Waiting only
   * for a visible row therefore reads the leftover: the second line of an indent failed
   * that way with `"Tablet" brought back fewer than 2 medicines` against a catalogue that
   * holds hundreds. The caller knows how many rows it needs, so it waits for them.
   */
  async searchProducts(term: string, minimum = 1, attempts = 3): Promise<string[]> {
    const rows = this.lookupPanel.locator('tbody tr');

    for (let attempt = 1; attempt <= attempts; attempt++) {
      await this.openProductLookup();

      // A search can be lost rather than answered. The app's own reopen is still settling
      // when the panel first reads as visible, and it can close again underneath the
      // search - which leaves the search box and its button there but not visible, and
      // waiting on them just burns the action timeout. So a lost search is re-sent, on a
      // panel reopened from scratch, rather than waited out.
      const searched = await this.sendLookupSearch(term)
        .then(() => true)
        .catch(() => false);

      if (
        searched &&
        (await expect
          .poll(() => rows.count(), { timeout: 15_000 })
          .toBeGreaterThanOrEqual(minimum)
          .then(() => true)
          .catch(() => false))
      ) {
        // The Brand Name column, one entry per row. Written as a child selector rather
        // than as `rows.locator('td').nth(0)`, which is not the first cell of each row at
        // all - it is the first cell of the whole grid, and reading it returned a
        // one-name list that made every medicine after the first look like a repeat.
        return rows.locator('td:nth-child(1)').allInnerTexts();
      }
    }

    throw new Error(
      `The Product Code lookup never offered ${minimum} medicine(s) matching "${term}" ` +
        `after ${attempts} searches.`
    );
  }

  /** Types `term` into the open lookup and runs it. Throws if the panel went away. */
  private async sendLookupSearch(term: string): Promise<void> {
    const box = this.lookupPanel.locator('.rz-lookup-search input');
    // Short waits on purpose: the caller retries, and the point of these is to find out
    // quickly that the panel is gone rather than to sit out the 30s action timeout.
    await box.fill('', { timeout: 10_000 });
    await box.fill(term, { timeout: 10_000 });
    await this.lookupPanel.locator('.rz-lookup-search button').click({ timeout: 10_000 });
  }

  /**
   * Adds one medicine to the table: searches `term`, takes the result at `index`, types
   * `quantity` and commits it.
   *
   * Enter on the Quantity box is the add action. The page has no Add button - the only
   * button on this half of the form is Save - so a line that is typed but never committed
   * is simply not part of the indent, which is what makes the quantity-of-zero case worth
   * a test of its own.
   *
   * `index` is how a caller builds an indent of distinct medicines: one search term brings
   * back a page of ten brands, and walking the index picks a different one each time
   * without needing ten search terms that all have to match something in a live catalogue.
   */
  async addItem(term: string, index: number, quantity: number): Promise<IndentLine> {
    await this.searchProducts(term, index + 1);
    const product = await this.pickRow(index);
    return this.commitLine(product, quantity);
  }

  /**
   * Adds one line per entry in `quantities`, all drawn from `term`, and returns them - a
   * different medicine on every line.
   */
  async addItems(term: string, quantities: number[]): Promise<IndentLine[]> {
    const lines: IndentLine[] = [];
    const taken = new Set<string>();

    for (const quantity of quantities) {
      const product = await this.pickUnusedProduct(term, taken);
      lines.push(await this.commitLine(product, quantity));
      taken.add(product);
    }
    return lines;
  }

  /**
   * Takes the first medicine `term` offers that the indent does not already carry, and
   * returns what the form says it picked.
   *
   * Chosen by name and then checked against Item Description, rather than by walking the
   * row numbers. Neither the list nor its order can be trusted at the instant of the
   * click: the lookup reopens showing only the medicine it last had selected, and the
   * search that replaces that lands a beat later - so the row that was read at index n is
   * not always the row that is there when it is clicked. An indent built by counting rows
   * came back with the same drug on two of its ten lines.
   */
  private async pickUnusedProduct(term: string, taken: Set<string>, attempts = 4): Promise<string> {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      // Enough rows that at least one of them has to be a medicine not yet on the indent.
      const offered = await this.searchProducts(term, taken.size + 1);
      const index = offered.findIndex(
        (name) => !taken.has(name.replace(/\s+/g, ' ').trim())
      );
      if (index === -1) continue;

      const product = await this.pickRow(index).catch(() => '');
      if (product !== '' && !taken.has(product)) return product;
    }

    throw new Error(
      `The Product Code lookup never offered a medicine matching "${term}" that the ` +
        `indent was not already carrying, in ${attempts} searches.`
    );
  }

  /**
   * Clicks the lookup row at `index` and returns the medicine the form took from it.
   *
   * The pick is a round trip - the panel closes and the app writes Item Description - and
   * what it writes is the only authority on which medicine was actually picked. Waited out
   * as a *change* rather than as a non-empty value, because a pick retried after a
   * duplicate starts with the previous medicine still in the box, and "not empty" would
   * hand that same name straight back.
   */
  private async pickRow(index: number): Promise<string> {
    const previous = await this.itemDescription.inputValue();
    await this.lookupPanel.locator('tbody tr').nth(index).click();

    await expect
      .poll(() => this.itemDescription.inputValue(), {
        timeout: 15_000,
        message: 'the Product Code lookup never put a medicine on the form',
      })
      .not.toBe(previous);

    return (await this.itemDescription.inputValue()).trim();
  }

  /** Types `quantity` against the picked medicine and commits the line. */
  private async commitLine(product: string, quantity: number): Promise<IndentLine> {
    const before = await this.itemRows.count();

    await this.quantity.fill(String(quantity));
    await this.quantity.press('Enter');
    await expect(
      this.itemRows,
      `"${product}" was never added to the medicine table`
    ).toHaveCount(before + 1, { timeout: 30_000 });

    // The row appears before its quantity does - the cell is a Blazorise numeric input
    // bound a render later - so a caller reading the table straight afterwards would see
    // the line with a quantity of 0 and call the form wrong.
    await expect(
      this.itemRows.nth(before).locator('input[name="context.Item.QtyPiece"]'),
      `"${product}" was added without its quantity`
    ).toHaveValue(String(quantity), { timeout: 30_000 });

    return { product, quantity };
  }

  /**
   * Tries to add a line and reports whether the table took it - for the cases where it
   * should not, such as a quantity of zero.
   */
  async tryAddItem(term: string, index: number, quantity: number): Promise<boolean> {
    await this.searchProducts(term, index + 1);
    await this.pickRow(index);

    const before = await this.itemRows.count();
    await this.quantity.fill(String(quantity));
    await this.quantity.press('Enter');
    return expect(this.itemRows)
      .toHaveCount(before + 1, { timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
  }

  /**
   * Commits the medicine already sitting on the form, with `quantity`.
   *
   * For the line whose drug was picked but whose quantity the form would not take: a
   * refused line leaves the medicine where it was, so the nurse corrects the number rather
   * than picking the drug again.
   */
  async commitSelected(quantity: number): Promise<IndentLine> {
    const product = (await this.itemDescription.inputValue()).trim();
    expect(product, 'no medicine is on the form to commit').not.toBe('');
    return this.commitLine(product, quantity);
  }

  /** The medicine table read back, in the order the lines were added. */
  async items(): Promise<IndentLine[]> {
    const rows = await this.itemRows.all();
    return Promise.all(
      rows.map(async (row) => ({
        product: (await row.locator('td').nth(1).innerText()).replace(/\s+/g, ' ').trim(),
        // Blazorise renders the quantity cell as a numeric input, not as text, so the
        // number is on the control rather than in the cell.
        quantity: Number(await row.locator('input[name="context.Item.QtyPiece"]').inputValue()),
      }))
    );
  }

  /**
   * Submits the indent and returns what the app said back, so the caller can assert on it.
   *
   * The snackbar answers both ways - "Successful Save!" and "Please fill medicine table"
   * arrive in the same element with the same classes - so the text is the only thing that
   * separates a save from a refusal, and reading the wrong one reads a passing save off a
   * refused one. Two things make that easy to do, and both are handled here.
   *
   * The page raises snackbars of its own ("Succesfully Fetched!", when a patient's record
   * comes back), so the stack can already hold one when Save is clicked - the refusal case
   * read that instead and failed on a message about fetching. And a snackbar stays in the
   * DOM after it fades, swapping snackbar-show for snackbar-hide, so "the last one there"
   * is not the same thing as "the one just raised".
   *
   * So: wait for the stack to go quiet, click, and read whichever snackbar is *showing*.
   */
  async saveIndent(): Promise<string> {
    const showing = this.page.locator('div.snackbar.snackbar-show');
    const stack = this.page.locator('div.snackbar');

    // Non-fatal: if something is still on screen after this, the read below is no worse
    // off than it would have been, and the caller's assertion reports whatever it saw.
    await expect(showing).toHaveCount(0, { timeout: 20_000 }).catch(() => {});
    const before = await stack.count();

    await this.save.click();

    // Taken as showing if it is, and as one more snackbar in the stack if it is not: a
    // message fades after a few seconds and the host is slow enough under a full suite
    // that the fade can beat the read. A faded snackbar keeps its text, so either way the
    // answer is readable - what matters is only that it is the one this click produced.
    let answer = '';
    await expect
      .poll(
        async () => {
          const raised = (await showing.count()) > 0 || (await stack.count()) > before;
          if (raised) {
            const newest = ((await showing.count()) > 0 ? showing : stack).last();
            answer = (await newest.innerText()).replace(/\s+/g, ' ').trim();
          }
          return answer;
        },
        { timeout: 90_000, message: 'Save produced no message at all' }
      )
      .not.toBe('');

    return answer;
  }

  /** The Verify Indent grid - every indent raised and not yet served. */
  get verifyGrid(): Locator {
    return this.page
      .locator('table.mud-table-root')
      .filter({ has: this.page.locator('th', { hasText: /INDENTNO/i }) })
      .first();
  }

  /**
   * Opens Verify Indent and reads the grid back, one object per indent.
   *
   * The grid is on screen before it holds anything - the tab fetches its list once it is
   * open - so it is left to settle first. Read without that, it comes back empty, and a
   * case that took that for "nothing pending yet" would then count every indent on the
   * ward as one it had just raised.
   */
  async verifiedIndents(): Promise<VerifiedIndent[]> {
    await this.openTab('VERIFY INDENT');
    await expect(this.verifyGrid).toBeVisible({ timeout: 30_000 });
    await this.settleVerifyGrid();
    return this.readVerifyGrid();
  }

  /**
   * Waits for the Verify Indent grid to stop changing - `stable` readings of the same row
   * count, a second apart.
   *
   * Settling is all there is to watch: the grid has no spinner, and no HTTP request to
   * wait on either, since its list arrives over the Blazor circuit's socket.
   */
  private async settleVerifyGrid(stable = 3): Promise<void> {
    const rows = this.verifyGrid.locator('tbody tr');
    let previous = -1;
    let unchanged = 0;

    await expect
      .poll(
        async () => {
          const count = await rows.count();
          unchanged = count === previous ? unchanged + 1 : 0;
          previous = count;
          return unchanged;
        },
        {
          timeout: 30_000,
          intervals: new Array(30).fill(1_000),
          message: 'the Verify Indent grid never stopped changing',
        }
      )
      .toBeGreaterThanOrEqual(stable);
  }

  /**
   * The Verify Indent search box. Filters the grid by indent number and nothing else -
   * a cabin or a priority typed into it returns an empty grid.
   *
   * The same markup as the ward list's search box over on Add Indent: one
   * div.form-group labelled "Search" per tab, and only the open tab's is visible, which is
   * what tells the two apart.
   */
  get indentSearch(): Locator {
    return this.group('Search').locator('input');
  }

  /**
   * The last indent the ward raised, or undefined if it has raised none today.
   *
   * Found by searching numbers rather than by reading the grid, because the grid cannot be
   * relied on to hold it. Verify Indent lists sixteen indents and stops - ordered by
   * priority, not by time, so the sixteen are not the newest sixteen - and on a ward with
   * more pending than that, an indent raised a moment ago is simply not on it. A case that
   * went looking for its own indent in those rows passed while the ward was quiet and
   * failed once it was not.
   *
   * What does work is the search box: it reaches every indent, and it matches on a leading
   * fragment, so "261003020003" brings back the whole 030-039 band. Indent numbers are
   * issued in sequence, so walking the bands upward from one that is known to exist ends
   * on the last number issued. Two empty bands in a row end the walk rather than one, so a
   * gap left by a deleted indent does not stop it short.
   */
  async latestIndent(): Promise<VerifiedIndent | undefined> {
    await this.openTab('VERIFY INDENT');
    await expect(this.verifyGrid).toBeVisible({ timeout: 30_000 });

    // Cleared first: the box keeps the last band searched, and an unfiltered reading is
    // what the walk below needs to start from.
    await this.indentSearch.fill('');
    await this.settleVerifyGrid(3);

    const listed = await this.readVerifyGrid();
    if (listed.length === 0) return undefined;

    const highest = listed.map((row) => row.indentNo).sort().slice(-1)[0];
    let band = Math.floor(Number(highest) / 10);
    let latest: VerifiedIndent | undefined;
    let empty = 0;

    // A band holds ten numbers, so it is always well inside the grid's sixteen-row cut.
    while (empty < 2) {
      const found = await this.searchIndents(String(band));
      if (found.length === 0) {
        empty += 1;
      } else {
        empty = 0;
        latest = found.sort((a, b) => a.indentNo.localeCompare(b.indentNo)).slice(-1)[0];
      }
      band += 1;
    }

    return latest;
  }

  /** The indents whose number starts with `fragment`, through the Verify Indent search. */
  async searchIndents(fragment: string): Promise<VerifiedIndent[]> {
    await this.indentSearch.fill('');
    await this.indentSearch.fill(fragment);
    // A filter settles faster than a tab's first fetch, and the walk runs several of them.
    await this.settleVerifyGrid(2);
    return this.readVerifyGrid();
  }

  /**
   * Waits for an indent newer than `previous` - the one just saved - and returns it.
   *
   * Polled because the save and the grid are not in step: Verify Indent refetches when it
   * is opened, but the list from the last visit stays on screen while that is in flight,
   * so the first read after a save can still be the list from before it.
   */
  async waitForIndentAfter(previous?: string): Promise<VerifiedIndent> {
    let raised: VerifiedIndent | undefined;

    await expect
      .poll(
        async () => {
          const latest = await this.latestIndent();
          raised = latest && latest.indentNo !== previous ? latest : undefined;
          return raised !== undefined;
        },
        {
          timeout: 120_000,
          intervals: new Array(20).fill(5_000),
          message: `no indent newer than ${previous ?? 'the ward had'} ever reached Verify Indent`,
        }
      )
      .toBe(true);

    return raised as VerifiedIndent;
  }

  /** The Verify Indent grid as it stands, without touching the tabs. */
  private async readVerifyGrid(): Promise<VerifiedIndent[]> {
    const rows = await this.verifyGrid
      .locator('tbody tr')
      .filter({ hasNot: this.page.locator('th.mud-table-empty-row') })
      .all();

    return Promise.all(
      rows.map(async (row) => {
        const [indentNo, time, cabinType, cabinNo, priority, status, userName] = (
          await row.locator('td').allInnerTexts()
        ).map((cell) => cell.replace(/\s+/g, ' ').trim());
        return { indentNo, time, cabinType, cabinNo, priority, status, userName };
      })
    );
  }

  async expectLoaded(): Promise<void> {
    await this.settleAuthorization(this.patientSearch);
    await expect(this.page).toHaveURL(new RegExp(this.path, 'i'));
    await expect(this.patientSearch).toBeVisible({ timeout: 30_000 });
    await expect(this.priority).toBeVisible({ timeout: 30_000 });
    // The ward is never empty, so a list with no cards means the fetch failed.
    await expect(this.patientCards.first()).toBeVisible({ timeout: 60_000 });
  }
}
