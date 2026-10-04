import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/** A patient as the ward list on the left of the page shows them. */
export interface DietWardPatient {
  /** Admission number, the second line of the card. */
  admissionNo: string;
  /** Bed as the card prints it, e.g. "HCU-27" - the form shows it as "P(HCU-27)". */
  bed: string;
}

/** The read-only panel the page fills in once a patient is picked out of the ward list. */
export interface DietPatient {
  /** "Indent for" - the patient's UHID, not the admission number searched for. */
  uhid: string;
  name: string;
  /** "Cabin", e.g. "P(Ex-HDU-02)" - the Verify Indent grid prints the bare bed instead. */
  cabin: string;
  admittedOn: string;
}

/** One line as the indent table holds it. */
export interface DietLine {
  /** Food pattern, as the lookup grid and the Item Description column both show it. */
  pattern: string;
  remarks: string;
  /** What the table recorded - not necessarily what was typed. See addItem. */
  quantity: number;
}

/** A food pattern taken from the lookup, with the list it was taken from. */
export interface PatternPick {
  /** The pattern the form took, as its own disabled box spells it. */
  pattern: string;
  /** Every pattern the search brought back, so a caller can tell when it has seen them all. */
  offered: string[];
}

/** What the app did with a line that was offered to the indent. See offerItem. */
export interface DietAttempt {
  /** True when the indent table took the line. */
  added: boolean;
  /** The food pattern the line was offered on. */
  pattern: string;
  /** The snackbar the app raised instead, or '' when the line was taken. */
  message: string;
  /** The row as the table recorded it, when the line was taken. */
  line?: DietLine;
}

/** A row of the Diet Indent Verify Indent grid. */
export interface DietIndentRow {
  indentNo: string;
  cabinType: string;
  cabinNo: string;
  priority: string;
  outlet: string;
  groupName: string;
  quantity: string;
  time: string;
  remarks: string;
  status: string;
  userName: string;
}

/**
 * Nurse Station > Diet Indent, at /hospital/nurse-station - the tab where the ward nurse
 * orders meals for an admitted patient: pick the patient off the ward list, set an outlet
 * and a priority, list the food patterns, save.
 *
 * Its own page object rather than part of NurseStationPage, which drives Medicine Indent
 * on the same route. The two tabs look alike and share the ward list, the Priority
 * dropdown and the Save button, but very little of the markup underneath survives the
 * comparison:
 *
 *   - Priority offers Routine / Emergency / Others here, against the six Medicine Indent
 *     offers, so a shared list of valid priorities would be wrong on one tab or the other.
 *   - The indent table is a plain Bootstrap <table>, not the MudBlazor grid Medicine
 *     Indent uses, and its quantity is cell text rather than a Blazorise numeric input.
 *   - The line carries a Remarks of its own, which a medicine line has no column for.
 *   - The lookup is over food patterns, and it does *not* reopen itself after a line is
 *     added the way the Product Code lookup does.
 *   - Verify Indent has eleven columns here, different ones, and no search box at all.
 *
 * What they do share is the framework mix and its consequences, so the notes on
 * NurseStationPage apply here too: Bootstrap form groups with no <label for=...>, a Radzen
 * lookup rendered at the end of the body, a Blazorise snackbar for every answer the app
 * gives, and ids that are Blazor circuit ids regenerated per connection - so nothing is
 * located by id except Qty_Piece, which the app names itself.
 *
 * Two things about this form are not guessable from looking at it. Enter on Quantity is
 * what adds a line, there being no Add button. And the quantity itself is not recorded:
 * every line lands in the table as 1 whatever is typed. See addItem.
 */
export class DietIndentPage extends BasePage {
  /** Also the drawer link's href, so specs opening it through the menu share this one. */
  static readonly PATH = '/hospital/nurse-station';

  protected readonly path = DietIndentPage.PATH;

  /** The outer tab this page object lives on. */
  static readonly TAB = 'DIET INDENT';

  /** What the Priority dropdown offers, past its "Select Item" placeholder. */
  static readonly PRIORITIES = ['Routine', 'Emergency', 'Others'] as const;

  /** What the Outlet dropdown offers, past its "Select Canteen" placeholder. */
  static readonly OUTLETS = [
    'Outdoor Sub-Outlet',
    'HFG Sub-Outlet',
    'Main Outlet',
    'Novera Sub-Outlet',
  ] as const;

  /** The indent table's columns. A fourth, unlabelled, holds the row's delete button. */
  static readonly ITEM_COLUMNS = ['Item Description', 'Remarks', 'Quantity'] as const;

  /** The Verify Indent grid's columns, in order. */
  static readonly VERIFY_COLUMNS = [
    'INDENTNO',
    'CABIN TYPE',
    'CABIN NO',
    'PRIORITY',
    'OUTLET NAME',
    'GROUP NAME',
    'QUANTITY',
    'INDENT TIME',
    'REMARKS',
    'STATUS',
    'USERNAME',
  ] as const;

  /**
   * Everything the app says back through the snackbar, which is the only place it answers.
   *
   * Pinned as exact strings because that is all there is to tell a save from a refusal:
   * every one of these arrives in the same element with the same classes. "Please fill
   * indent table" has no full stop and the other three do - that is the app's, not a typo
   * here.
   */
  static readonly MESSAGES = {
    saved: 'Save Finished.',
    noItems: 'Please fill indent table',
    noPriority: 'Please select Priority value.',
    noPatient: 'Please select correct cabin.',
    noPattern: 'Please select product.',
    /**
     * Raised when the line's food pattern is already on order for this patient - the
     * app's own guard against ordering the same meal twice, and the reason offerItem
     * walks the catalogue instead of always taking the first pattern on the list.
     */
    duplicatePattern: 'Already has indent for this food pattern',
  } as const;

  /** Ward list down the left: its search box and the patient cards under it. */
  readonly patientSearch: Locator;
  readonly patientList: Locator;
  readonly patientCards: Locator;

  /** The indent's own fields. */
  readonly outlet: Locator;
  readonly priority: Locator;

  /** The patient panel - all four disabled, filled by clicking a ward card. */
  readonly indentFor: Locator;
  readonly admittedDateTime: Locator;
  readonly patientName: Locator;
  readonly cabin: Locator;

  /** The line entry row: the Food Pattern lookup, what it fills in, remarks, quantity. */
  readonly patternLookup: Locator;
  readonly lookupPanel: Locator;
  readonly pattern: Locator;
  readonly remarks: Locator;
  readonly quantity: Locator;

  /** The indent table, and the Save under it. */
  readonly itemsTable: Locator;
  readonly itemRows: Locator;
  readonly save: Locator;

  /** Whatever the app is saying right now - a save, a refusal, a fetch note. */
  readonly snackbar: Locator;

  constructor(page: Page) {
    super(page);

    this.patientSearch = this.group('Search').locator('input');
    this.patientList = page.locator('ul.list-group-scrollable');
    this.patientCards = this.patientList.locator('li.list-group-item');

    // Both named in the markup, so neither needs its label to be found. Medicine Indent
    // names its Priority the same, but that tab's markup leaves the DOM entirely when Diet
    // Indent is the tab on screen, so there is nothing to disambiguate from.
    this.outlet = page.locator('select[name="CanteenOutLet"]');
    this.priority = page.locator('select[name="Priority"]');

    this.indentFor = page.locator('input[name="_SelectedLeftGridItem.UHID"]');
    // A flatpickr: the group also holds the component's own hidden mirror input.
    this.admittedDateTime = this.group('Admitted DateTime').locator('input:visible');
    this.patientName = page.locator('input[name="_SelectedLeftGridItem.FullName"]');
    this.cabin = page.locator('input[name="_SelectedLeftGridItem.CabinNo"]');

    // "Food Pattern Group" labels two groups, in this order: the Radzen lookup the nurse
    // picks from, and a disabled box showing what was picked. .first() is the lookup.
    this.patternLookup = this.group('Food Pattern Group').first().locator('.rz-dropdown');
    // Rendered at the end of the body rather than inside the field, so it is reached from
    // the page. Only one lookup is on this tab, so there is nothing to disambiguate from.
    this.lookupPanel = page.locator('.rz-dropdown-panel').first();
    this.pattern = page.locator('input[name="_SelectedBrandDetail.Name"]');
    this.remarks = this.group('Remarks').locator('input');
    this.quantity = page.locator('input#Qty_Piece');

    this.itemsTable = page
      .locator('table')
      .filter({ has: page.locator('th', { hasText: 'Item Description' }) })
      .first();
    this.itemRows = this.itemsTable.locator('tbody tr');

    this.save = page.locator('button[type="submit"].btn-success');
    // Only the ones showing: a faded snackbar stays in the stack carrying snackbar-hide
    // and its old text. Newest last. See saveIndent.
    this.snackbar = page.locator('div.snackbar.snackbar-show').last();
  }

  /**
   * The field group carrying `label`: a <div class="form-group"> holding a
   * <label class="form-label"> and its control, the same shape Medicine Indent and the
   * admission wizard use. No <label for=...> is rendered anywhere on the page, so
   * getByLabel resolves none of it.
   *
   * Visible groups only. The Verify Indent pane's markup stays in the DOM while Add Indent
   * is the tab on screen, and "Search" labels a box on each.
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

  /**
   * Lands on Nurse Station with the ward list up.
   *
   * The page opens on Medicine Indent - nothing here has switched tabs yet - so this is
   * only as far as the shell. Cases that want the diet form call openAddIndent.
   */
  async openNurseStation(): Promise<void> {
    await this.goto();
    await this.settleAuthorization(this.patientSearch);
    await expect(this.page).toHaveURL(new RegExp(this.path, 'i'));
    await expect(this.patientSearch).toBeVisible({ timeout: 30_000 });
    // The ward is never empty, so a list with no cards means the fetch failed.
    await expect(this.patientCards.first()).toBeVisible({ timeout: 60_000 });
  }

  /** Switches to Diet Indent > Add Indent and waits for the form. */
  async openDietIndent(): Promise<void> {
    await this.openTab(DietIndentPage.TAB);
    await this.expectLoaded();
  }

  /** Opens the page and lands on Diet Indent > Add Indent - what most cases start with. */
  async openAddIndent(): Promise<void> {
    await this.openNurseStation();
    await this.openDietIndent();
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
  async readCard(card: Locator): Promise<DietWardPatient> {
    const text = (await card.innerText()).replace(/\s+/g, ' ').trim();
    return {
      bed: text.replace(/\s*\d{10,}\s*$/, '').trim(),
      admissionNo: text.match(/\d{10,}/)?.[0] ?? '',
    };
  }

  /**
   * The first `count` patients on the ward, as seeds for cases that have to name one.
   *
   * Which beds are occupied changes by the hour, so no case here hard-codes a patient -
   * each takes whoever the ward list offers and works with them.
   */
  async wardPatients(count = 1, from = 0): Promise<DietWardPatient[]> {
    await expect(this.patientCards.first()).toBeVisible({ timeout: 60_000 });
    const cards = await this.patientCards.all();
    const patients: DietWardPatient[] = [];
    let skipped = 0;

    for (const card of cards) {
      const patient = await this.readCard(card);
      // A card whose number did not parse is no use as a seed - it cannot be searched for.
      if (patient.admissionNo === '') continue;
      if (skipped++ < from) continue;

      patients.push(patient);
      if (patients.length === count) break;
    }

    expect(
      patients.length,
      `the ward list offered fewer than ${count} patient(s) past the first ${from}`
    ).toBe(count);
    return patients;
  }

  /**
   * Looks `admissionNo` up in the ward list, opens that patient, and returns the panel the
   * app filled in.
   *
   * The four patient fields are disabled in the markup - there is no typing a patient into
   * this form, by a nurse or by a test. Clicking the card is the only thing that fills
   * them, and the click is a round trip, so the Name box is waited on rather than read.
   */
  async selectPatient(admissionNo: string): Promise<DietPatient> {
    await this.searchPatient(admissionNo);

    const card = this.cardFor(admissionNo);
    await expect(card, `no patient admitted under ${admissionNo}`).toBeVisible({ timeout: 30_000 });
    await card.click();
    await expect(card).toHaveClass(/active/);

    await expect(
      this.patientName,
      `${admissionNo} never loaded into the diet indent form`
    ).not.toHaveValue('', { timeout: 30_000 });

    return this.patientPanel();
  }

  /** The patient panel as it stands, without touching the ward list. */
  async patientPanel(): Promise<DietPatient> {
    return {
      uhid: (await this.indentFor.inputValue()).trim(),
      name: (await this.patientName.inputValue()).trim(),
      cabin: (await this.cabin.inputValue()).trim(),
      admittedOn: (await this.admittedDateTime.inputValue()).trim(),
    };
  }

  /** Picks `name` in the Priority dropdown, e.g. choosePriority('Routine'). */
  async choosePriority(name: string): Promise<void> {
    await this.priority.selectOption({ label: name });
  }

  /** Picks `name` in the Outlet dropdown, e.g. chooseOutlet('Main Outlet'). */
  async chooseOutlet(name: string): Promise<void> {
    await this.outlet.selectOption({ label: name });
  }

  /**
   * Leaves the Food Pattern Group lookup open, whether or not it already was.
   *
   * The click is retried rather than awaited because of the ordinary Blazor failure: a
   * click landing before the handler is wired is swallowed. Unlike the Product Code lookup
   * over on Medicine Indent, this one does not reopen itself after a line is added - so
   * every line starts from a closed panel - but it is still guarded both ways, because a
   * click on an already-open control closes it.
   */
  async openPatternLookup(attempts = 4): Promise<void> {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      if (await this.lookupPanel.isVisible().catch(() => false)) return;
      await this.patternLookup.click().catch(() => {});
      await this.lookupPanel.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
    }

    // Radzen builds the panel on the first open and leaves it in the body afterwards, so
    // "not found" here means no click ever reached the control - as against "hidden",
    // which would mean one did and the panel closed again.
    await expect(this.lookupPanel, 'the Food Pattern Group lookup never opened').toBeVisible();
  }

  /**
   * Searches the lookup for `term` and returns the food patterns it offers, once it is
   * offering at least `minimum` of them.
   *
   * The search box keeps whatever was typed into it last - the panel is one control reused
   * for every line - so it is cleared before the new term goes in. And the count is what
   * makes the read reliable: the grid still holds the previous search's rows for a moment
   * after a new one is sent, so waiting only for a visible row reads the leftover.
   */
  async searchPatterns(term: string, minimum = 1, attempts = 3): Promise<string[]> {
    const rows = this.lookupPanel.locator('tbody tr');

    for (let attempt = 1; attempt <= attempts; attempt++) {
      await this.openPatternLookup();

      // A search can be lost rather than answered - the panel can close underneath it,
      // which leaves its search box there but not visible, and waiting on that just burns
      // the action timeout. So a lost search is re-sent on a panel reopened from scratch.
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
        // The Name column, one entry per row. Written as a child selector rather than as
        // `rows.locator('td').nth(0)`, which is not the first cell of each row at all - it
        // is the first cell of the whole grid.
        return (await rows.locator('td:nth-child(1)').allInnerTexts()).map((name) =>
          name.replace(/\s+/g, ' ').trim()
        );
      }
    }

    throw new Error(
      `The Food Pattern Group lookup never offered ${minimum} pattern(s) matching "${term}" ` +
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
   * Clicks the lookup row at `index` and returns the pattern the form took from it.
   *
   * The pick is a round trip - the panel closes and the app writes the disabled Food
   * Pattern Group box - and what it writes is the only authority on which pattern was
   * actually picked.
   *
   * Waited out as a *change* rather than as a non-empty value. Committing a line clears
   * the box, so "not empty" would do for a form being filled in cleanly - but a line the
   * app refuses leaves its pattern sitting in the box, and the next pick would then hand
   * that same name straight back and report the refused pattern as the new one.
   */
  private async pickPattern(index: number): Promise<string> {
    const previous = await this.pattern.inputValue();
    await this.lookupPanel.locator('tbody tr').nth(index).click();

    await expect
      .poll(() => this.pattern.inputValue(), { timeout: 10_000 })
      .not.toBe(previous);

    return (await this.pattern.inputValue()).trim();
  }

  /**
   * Searches `term` and takes the pattern at `index`, returning it with the list it came
   * from - or an empty pattern if the form would not take that one.
   *
   * It reports rather than throws, because a pick that does not land is ordinary here, not
   * a fault. Committing a line clears the Food Pattern Group box but leaves the Radzen
   * lookup's own selection where it was, so clicking the row that was just committed
   * selects what is already selected: no change event, and the box stays empty. The
   * pattern becomes pickable again as soon as anything else has been picked.
   *
   * There is no telling that apart from a click lost to a panel closing underneath it, so
   * the search and the click are retried once together - the panel closes on a click
   * either way, which is why the whole thing is re-sent rather than the click alone - and
   * a pattern that still will not land is left for the caller to step over. An indent's
   * second line failed on the throwing version of this against a catalogue of ten.
   */
  async pickFrom(term: string, index: number, attempts = 2): Promise<PatternPick> {
    let offered: string[] = [];

    for (let attempt = 1; attempt <= attempts; attempt++) {
      offered = await this.searchPatterns(term, index + 1);
      const pattern = await this.pickPattern(index).catch(() => '');
      if (pattern !== '') return { pattern, offered };
    }

    return { pattern: '', offered };
  }

  /**
   * Puts a food pattern on the form - whichever the lookup will give - and returns it.
   *
   * For the cases that need a pattern selected but do not care which, because what they
   * are about is the Quantity box next to it.
   */
  async pickAnyPattern(term: string, limit = 8): Promise<string> {
    for (let index = 0; index < limit; index++) {
      const { pattern, offered } = await this.pickFrom(term, index);
      if (pattern !== '') return pattern;
      if (index + 1 >= offered.length) break;
    }

    throw new Error(`the Food Pattern Group lookup would not put any "${term}" on the form`);
  }

  /**
   * Offers a line to the indent and reports what the app did with it.
   *
   * Enter on Quantity is the add action. The page has no Add button - the only button on
   * this half of the form is Save - so a line that is typed but never committed is simply
   * not part of the indent.
   *
   * The app answers an Enter one of two ways and never both: the row appears, or a
   * snackbar says why it did not. Which arrived is what this returns, so a caller that
   * expects a refusal can say which refusal it expected rather than just counting rows.
   */
  private async offerLine(
    pattern: string,
    remarks: string,
    quantity: number
  ): Promise<DietAttempt> {
    const showing = this.page.locator('div.snackbar.snackbar-show');
    const stack = this.page.locator('div.snackbar');

    // The page raises snackbars of its own - "Succesfully Fetched!" when a patient's
    // record comes back - so the stack is left to go quiet first, or the read below would
    // report that one as this line's answer. Non-fatal: if something is still on screen
    // afterwards, the caller's assertion reports whatever it saw.
    await expect(showing).toHaveCount(0, { timeout: 20_000 }).catch(() => {});
    const before = await this.itemRows.count();
    const snackbarsBefore = await stack.count();

    await this.remarks.fill(remarks);
    await this.quantity.fill(String(quantity));
    await this.quantity.press('Enter');

    let message = '';
    let outcome = '';
    await expect
      .poll(
        async () => {
          if ((await this.itemRows.count()) > before) {
            outcome = 'added';
          } else if ((await showing.count()) > 0 || (await stack.count()) > snackbarsBefore) {
            // A snackbar fades a few seconds after it is raised, swapping snackbar-show
            // for snackbar-hide but keeping its text, so a faded one is still readable -
            // what matters is only that it is the one this Enter produced.
            const newest = ((await showing.count()) > 0 ? showing : stack).last();
            message = (await newest.innerText()).replace(/\s+/g, ' ').trim();
            outcome = 'refused';
          }
          return outcome;
        },
        {
          timeout: 30_000,
          message: `"${pattern}" was neither added to the indent table nor refused`,
        }
      )
      .not.toBe('');

    if (outcome === 'added') {
      return { added: true, pattern, message: '', line: await this.readRow(before) };
    }
    return { added: false, pattern, message };
  }

  /**
   * Offers `quantity` of the food pattern at `index` in the results for `term`.
   *
   * The targeted form, for the case that has to try one particular pattern - DI-14, which
   * orders the pattern the ward already has on order and expects to be turned away.
   */
  async offerPattern(
    term: string,
    index: number,
    remarks: string,
    quantity: number
  ): Promise<DietAttempt> {
    const { pattern } = await this.pickFrom(term, index);
    expect(pattern, `the form would not take pattern ${index + 1} of "${term}"`).not.toBe('');
    return this.offerLine(pattern, remarks, quantity);
  }

  /**
   * Offers `quantity` of the food pattern named `name`, whatever position it is in.
   *
   * The lookup's order is the catalogue's and not something a case can count on, so a case
   * that needs a particular pattern - the one it has just ordered, say - finds it by name.
   */
  async offerNamedPattern(
    term: string,
    name: string,
    remarks: string,
    quantity: number
  ): Promise<DietAttempt> {
    const offered = await this.searchPatterns(term, 1);
    const index = offered.findIndex((listed) => listed === name);
    expect(
      index,
      `"${name}" is no longer among the patterns "${term}" brings back`
    ).toBeGreaterThanOrEqual(0);

    const { pattern } = await this.pickFrom(term, index);
    expect(pattern, `the form would not put "${name}" back on the form`).not.toBe('');
    return this.offerLine(pattern, remarks, quantity);
  }

  /**
   * Offers `quantity` of each pattern `term` brings back in turn, and stops at the first
   * conclusive answer - a line added, or a refusal that is about this line rather than
   * about the ward.
   *
   * The walk is what makes these cases repeatable. A patient who already has a pending
   * diet indent for a food pattern cannot be given a second one: the app turns the line
   * away with "Already has indent for this food pattern", and that is a property of the
   * ward's day rather than of the case running. Every case here that saves therefore
   * leaves the ward one pattern less available to the next, and a suite that always
   * reached for the first pattern in the list worked once and then refused to build an
   * indent at all. So a pattern already on order is stepped over rather than failed on.
   *
   * Any other refusal is handed straight back: that is the app answering the line it was
   * given, which is what the negative cases are asking about.
   */
  async offerItem(
    term: string,
    remarks: string,
    quantity: number,
    avoid: string[] = [],
    limit = 8
  ): Promise<DietAttempt> {
    const unavailable: string[] = [];

    for (let index = 0; index < limit; index++) {
      const { pattern, offered } = await this.pickFrom(term, index);

      // The form would not take this one at all - see pickFrom. Nothing was offered, so
      // there is nothing to judge: on to the next pattern.
      if (pattern === '') {
        unavailable.push(`pattern ${index + 1} (the form would not select it)`);
        if (index + 1 >= offered.length) break;
        continue;
      }

      // Stepped over without being offered. The ward's guard is against a pattern already
      // on a *saved* indent, so the form is perfectly willing to put the same one on three
      // lines of the indent being built - which is not what a caller asking for several
      // patterns means. An indent built without this came back carrying one pattern three
      // times.
      if (avoid.includes(pattern)) {
        unavailable.push(`${pattern} (already on this indent)`);
        if (index + 1 >= offered.length) break;
        continue;
      }

      const attempt = await this.offerLine(pattern, remarks, quantity);
      if (attempt.added || attempt.message !== DietIndentPage.MESSAGES.duplicatePattern) {
        return attempt;
      }
      unavailable.push(`${pattern} (already on order)`);
      if (index + 1 >= offered.length) break;
    }

    throw new Error(
      `no food pattern matching "${term}" was available to this patient: ` +
        unavailable.join(', ')
    );
  }

  /**
   * Adds one line to the indent, on the first pattern the ward will still take.
   *
   * The returned quantity is what the *table* recorded, which is not what was typed: this
   * form writes 1 on every line whatever the box held. That is deliberate here rather than
   * a bug in this page object - see the DI-06 note in the spec - so callers assert on what
   * came back rather than on what they sent.
   */
  async addItem(
    term: string,
    remarks: string,
    quantity: number,
    avoid: string[] = []
  ): Promise<DietLine> {
    const attempt = await this.offerItem(term, remarks, quantity, avoid);
    expect(
      attempt.added,
      `"${attempt.pattern}" was refused: ${attempt.message || 'no reason given'}`
    ).toBe(true);
    return attempt.line as DietLine;
  }

  /** Adds one line per entry in `lines`, each on a different food pattern. */
  async addItems(
    term: string,
    lines: { remarks: string; quantity: number }[]
  ): Promise<DietLine[]> {
    const added: DietLine[] = [];
    for (const line of lines) {
      added.push(
        await this.addItem(
          term,
          line.remarks,
          line.quantity,
          added.map((taken) => taken.pattern)
        )
      );
    }
    return added;
  }

  /** The indent table read back, in the order the lines were added. */
  async items(): Promise<DietLine[]> {
    const count = await this.itemRows.count();
    const lines: DietLine[] = [];
    for (let index = 0; index < count; index++) lines.push(await this.readRow(index));
    return lines;
  }

  /** One row of the indent table. Quantity is cell text here, not an input. */
  private async readRow(index: number): Promise<DietLine> {
    const [pattern, remarks, quantity] = (
      await this.itemRows.nth(index).locator('td').allInnerTexts()
    ).map((cell) => cell.replace(/\s+/g, ' ').trim());
    return { pattern, remarks, quantity: Number(quantity) };
  }

  /**
   * Submits the indent and returns what the app said back, so the caller can assert on it.
   *
   * The snackbar answers both ways - "Save Finished." and "Please fill indent table"
   * arrive in the same element with the same classes - so the text is the only thing that
   * separates a save from a refusal, and reading the wrong one reads a passing save off a
   * refused one. Two things make that easy to do, and both are handled here.
   *
   * The page raises snackbars of its own, so the stack can already hold one when Save is
   * clicked. And a snackbar stays in the DOM after it fades, swapping snackbar-show for
   * snackbar-hide, so "the last one there" is not the same thing as "the one just raised".
   *
   * So: wait for the stack to go quiet, click, and read whichever snackbar is showing.
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

  /**
   * Waits for the form to empty itself, which is how a save shows on screen.
   *
   * The app clears the whole thing on a successful save - the patient panel, the indent
   * table, both dropdowns - and that is worth asserting separately from the message,
   * because it is also what stops a second click on Save from filing the indent twice.
   */
  async expectFormCleared(): Promise<void> {
    await expect(this.itemRows, 'the indent table was not cleared by the save').toHaveCount(0, {
      timeout: 30_000,
    });
    await expect(this.patientName, 'the patient was not cleared by the save').toHaveValue('', {
      timeout: 30_000,
    });
  }

  /** The Verify Indent grid - every diet indent raised and not yet served. */
  get verifyGrid(): Locator {
    return this.page
      .locator('table')
      .filter({ has: this.page.locator('th', { hasText: /INDENTNO/i }) })
      .first();
  }

  /**
   * Opens Verify Indent and reads the grid back, one object per indent.
   *
   * The grid is on screen before it holds anything - the tab fetches its list once it is
   * open - so it is left to settle first. Read without that, it comes back empty, and a
   * case that took that for "nothing pending yet" would then miss the indent it had just
   * raised.
   */
  async verifiedIndents(): Promise<DietIndentRow[]> {
    await this.openTab('VERIFY INDENT');
    await expect(this.verifyGrid).toBeVisible({ timeout: 30_000 });
    await this.settleVerifyGrid();
    return this.readVerifyGrid();
  }

  /**
   * The indents whose Remarks carry `mark`.
   *
   * Remarks is how a case finds its own indent here. Medicine Indent's Verify tab has a
   * search box that filters by indent number; this one has no search box at all, so the
   * grid is read whole and filtered in the test instead - and a mark unique to the run is
   * the only thing in a row that a case can know in advance.
   */
  async indentsMarked(mark: string): Promise<DietIndentRow[]> {
    const listed = await this.verifiedIndents();
    return listed.filter((row) => row.remarks.includes(mark));
  }

  /**
   * Waits for exactly one indent carrying `mark` to reach Verify Indent, and returns it.
   *
   * Polled because the save and the grid are not in step: Verify Indent refetches when it
   * is opened, but the list from the last visit stays on screen while that is in flight,
   * so the first read after a save can still be the list from before it.
   *
   * It keeps looking after it finds one, for the rest of the timeout, only when asked to -
   * see expectOnlyIndent. Finding the first one is what this is for.
   */
  async waitForIndentMarked(mark: string): Promise<DietIndentRow> {
    let found: DietIndentRow | undefined;

    await expect
      .poll(
        async () => {
          const marked = await this.indentsMarked(mark);
          found = marked[0];
          return marked.length;
        },
        {
          timeout: 120_000,
          intervals: new Array(20).fill(5_000),
          message: `no indent carrying "${mark}" ever reached Verify Indent`,
        }
      )
      .toBeGreaterThan(0);

    return found as DietIndentRow;
  }

  /**
   * Asserts the ward holds exactly one indent carrying `mark`.
   *
   * The duplicate cases turn on this. It is read after waitForIndentMarked has already
   * seen one, so a second copy filed by a second click has had the same journey through
   * the app and would be on the grid by now.
   */
  async expectOnlyIndent(mark: string): Promise<DietIndentRow> {
    const marked = await this.indentsMarked(mark);
    expect(
      marked.map((row) => row.indentNo),
      `"${mark}" should have been filed once, not ${marked.length} times`
    ).toHaveLength(1);
    return marked[0];
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

  /** The Verify Indent grid as it stands, without touching the tabs. */
  private async readVerifyGrid(): Promise<DietIndentRow[]> {
    const rows = await this.verifyGrid.locator('tbody tr').all();

    return Promise.all(
      rows.map(async (row) => {
        const [
          indentNo,
          cabinType,
          cabinNo,
          priority,
          outlet,
          groupName,
          quantity,
          time,
          remarks,
          status,
          userName,
        ] = (await row.locator('td').allInnerTexts()).map((cell) =>
          cell.replace(/\s+/g, ' ').trim()
        );
        return {
          indentNo,
          cabinType,
          cabinNo,
          priority,
          outlet,
          groupName,
          quantity,
          time,
          remarks,
          status,
          userName,
        };
      })
    );
  }

  /** Asserts Diet Indent > Add Indent is the pane on screen. */
  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(this.path, 'i'));
    await expect(this.tab(DietIndentPage.TAB)).toHaveClass(/active/);
    await expect(this.tab('ADD INDENT')).toHaveClass(/active/);
    await expect(this.priority).toBeVisible({ timeout: 30_000 });
    await expect(this.quantity).toBeVisible({ timeout: 30_000 });
    await expect(this.save).toBeVisible({ timeout: 30_000 });
  }
}
