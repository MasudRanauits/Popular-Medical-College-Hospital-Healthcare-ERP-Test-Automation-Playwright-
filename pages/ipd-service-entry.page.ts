import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/** A patient as the ward list down the left of the tab shows them. */
export interface IpdWardPatient {
  /** Admission number - the second line of the card. */
  admissionNo: string;
  /** Bed as the card prints it, e.g. "HCU-33". The form shows it as "P(HCU-33)". */
  bed: string;
}

/** The read-only panel the tab fills in once a patient is picked out of the ward list. */
export interface IpdPatient {
  /** "Inv.No" - the admission number, not an invoice number of its own. '0' when empty. */
  invoiceNo: string;
  name: string;
  /** "Gender" - one of the two panel boxes with no name attribute, so reached by label. */
  gender: string;
  /** "Age", as the ERP prints it: "74Y 0M 0D". Also unnamed in the markup. */
  age: string;
  /** "Assigned Doctor" - the consultant the admission is under. Often long. */
  assignedDoctor: string;
  /** "CabinNo", e.g. "P(HCU-33)". */
  cabinNo: string;
}

/** One row of the Service lookup: a catalogue entry and the rate it carries. */
export interface IpdServiceOption {
  name: string;
  rate: number;
}

/** A line as it sits in the upper grid - entered and costed, but not yet billed. */
export interface IpdCartLine {
  service: string;
  /** The Schedule column. Always '' - the tab has no Schedule control. See IS-18. */
  schedule: string;
  rate: number;
  qty: number;
  serviceChange: number;
  remarks: string;
  /** As the grid prints it: M/d/yyyy h:mm:ss AM/PM, and '' when no window was entered. */
  startDate: string;
  endDate: string;
  amount: number;
}

/** A row of the lower grid: a service already saved against the admission. */
export interface IpdBilledLine {
  service: string;
  rate: number;
  qty: number;
  amount: number;
  discount: number;
  /** "S.Date", as the grid prints it: M/d/yyyy h:mm:ss AM/PM. */
  serviceDate: string;
  startDate: string;
  /** The column the grid heads "End End". See IS-26. */
  endDate: string;
  /** "Served_By" - the username that saved it. */
  servedBy: string;
}

/** What came of trying to commit a line, for the cases where it should not be taken. */
export interface IpdLineAttempt {
  /** Whether the cart grew by one. */
  added: boolean;
  /** The snackbar the attempt raised, and '' when it raised none. */
  said: string;
}

/** What the line entry row is to be filled with. Only `qty` is required. */
export interface IpdLineInput {
  /** Search term for the Service lookup. Omitted leaves whatever is already picked. */
  service?: string;
  /** Which row of the Service lookup's results to take. Default 0. */
  serviceIndex?: number;
  /** The Code box. Nothing fills it on its own - see IS-19. */
  code?: string;
  /** The Remarks box, which is the only thing a case can mark its own line with. */
  remarks?: string;
  /** Overwrites the rate the catalogue put on the form. See IS-15. */
  rate?: number;
  /** Service Date, as YYYY-MM-DD HH:mm. See setServiceDate. */
  serviceDate?: string;
  /** Start Date Time, as YYYY-MM-DD HH:mm. */
  startDateTime?: string;
  /** End Date Time, as YYYY-MM-DD HH:mm. */
  endDateTime?: string;
  /** The Service Change box under Total Amount. See IS-16. */
  serviceChange?: number;
  qty: number;
}

/**
 * Nurse Station > IPD Service Entry, at /hospital/nurse-station - the tab where the ward
 * puts a chargeable service, a procedure or an OT item onto an admitted patient's bill.
 *
 * Its own page object, like ConsultancyServicePage and DietIndentPage: it shares the route
 * and the tab strip with Medicine Indent and nothing else.
 *
 * How the tab is laid out
 * -----------------------
 * Down the left, the ward list - every admitted patient, one card per bed, with a search
 * box over it. Top right, a patient panel of six disabled boxes that the card fills in:
 * Inv.No, Name, Gender, Age, Assigned Doctor, CabinNo. Under that, the line entry row:
 * Service, Code, Remarks, Service Date, Start Date Time, End Date Time, Rate, Qty. Then
 * two MudBlazor grids, one above the other, with Save between them:
 *
 *   - the upper grid is the cart - lines entered and costed but not yet billed, with
 *     Total Amount and Service Change under it, and a bin on each row;
 *   - the lower grid is the bill - every service already saved against this admission,
 *     with who saved it and when, and *no* control of any kind on the row.
 *
 * Ten things about this tab are not guessable from looking at it, and each cost a run to
 * find.
 *
 * Enter on Qty is what commits a line. There is no Add button - the only buttons under the
 * cart are Save and Print All - so a line that is typed and never committed is simply not
 * part of the bill. The same shape Medicine Indent and Consultancy Service use.
 *
 * Qty has a guard: zero and negative are refused with "Please input correct Qty.", which is
 * the one refusal the tab words. A commit with no service picked is refused *in silence* -
 * nothing is added and nothing is said, which is IS-07.
 *
 * Rate arrives from the catalogue but the box is editable, and whatever is in it at the
 * moment of the Enter is what the line carries. IS-15.
 *
 * Service Change - the discount box under Total Amount - is read by nothing, and the commit
 * resets it to 0. IS-16.
 *
 * Service Date is a flatpickr carrying a date *and a time*, and committing a line puts it
 * back to the moment of the commit, so a service performed yesterday cannot be entered as
 * yesterday's. IS-17. Start Date Time and End Date Time, by contrast, are *not* cleared by
 * the commit, so the next line silently inherits the window of the last one. IS-21.
 *
 * The cart grid has a Schedule column and the tab has no Schedule control, so the column is
 * empty on every row ever entered. IS-18. The Code box is editable and nothing fills it -
 * picking a service leaves it blank. IS-19.
 *
 * The cart belongs to the tab rather than to the patient: picking a different patient, or
 * leaving the tab and coming back, leaves every uncommitted line where it is. IS-13 and
 * IS-14, and they are the two worth fixing first - a Save after either bills one patient
 * for another's services.
 *
 * And the bill grid stops at fifteen rows with nothing on screen saying so (IS-23), *and it
 * carries no bin* - unlike Consultancy Service, a service saved here cannot be taken off
 * again from this tab at all (IS-24). Together those are why nothing in the suite saves.
 * See BILL_ROW_CAP and the spec's file header.
 *
 * Framework mix, as everywhere in this ERP: the form is Bootstrap (div.form-group holding a
 * label.form-label), the Service picker is a Radzen lookup, both grids are MudBlazor, the
 * three date boxes are flatpickrs, and the messages are Blazorise snackbars rather than the
 * .toast/.alert pair BasePage knows about.
 *
 * Every id on the page is a Blazor circuit id, regenerated on each connection, so nothing
 * here is located by id except the Radzen popup panel - which has to be, the panel being
 * rendered at the end of the body. It is matched with an attribute selector rather than
 * `#id`, because Radzen's ids can begin with a digit and `#8-PRB8LA10` is not a valid CSS
 * selector - a plain `#${id}` throws rather than failing to match.
 */
export class IpdServiceEntryPage extends BasePage {
  /** Also the drawer link's href, so specs opening it through the menu share this one. */
  static readonly PATH = '/hospital/nurse-station';

  protected readonly path = IpdServiceEntryPage.PATH;

  /** The outer tab this page object lives on. CSS uppercases it; the markup does not. */
  static readonly TAB = 'IPD SERVICE ENTRY';

  /**
   * The cart grid's columns, in order. A tenth, unlabelled, holds the bin.
   *
   * Spelled as the markup spells them, not as the screen shows them: the headers are
   * uppercased by CSS, so a case asserting on "SERVICE NAME" is asserting on the stylesheet
   * rather than on the page.
   */
  static readonly CART_COLUMNS = [
    'Service Name',
    'Schedule',
    'Rate',
    'Qty',
    'Service Change',
    'Remarks',
    'Start Date',
    'End Date',
    'Amount',
  ] as const;

  /**
   * The bill grid's columns, in order. There is no tenth - this grid has no bin.
   *
   * "End End" is not a transcription slip here. It is what the header says, and IS-26 is
   * the case that reports it.
   */
  static readonly BILL_COLUMNS = [
    'Service Name',
    'Rate',
    'Qty',
    'Amount',
    'Discount',
    'S.Date',
    'Start Date',
    'End End',
    'Served_By',
  ] as const;

  /**
   * The most rows the bill grid has ever been seen to hold.
   *
   * Not a page size - there is no pager, no page-size box and no total anywhere on the tab.
   * It is where the list simply stops, and it is the same number Consultancy Service stops
   * at, on what is the same admission's bill read through a different tab.
   *
   * It matters to anything that writes, not only to the case that reports it: a service
   * saved against a patient already on fifteen cannot be seen afterwards - and since this
   * grid carries no bin either (IS-24), it cannot be reached from this tab at all.
   */
  static readonly BILL_ROW_CAP = 15;

  /**
   * Everything the tab has been observed to say, in the words it says it.
   *
   * Short, because this tab mostly says nothing: a line it will not take is refused in
   * silence unless the quantity is what is wrong with it. There is deliberately no entry
   * for a successful save - nothing in the suite saves, so nothing has read one.
   */
  static readonly MESSAGES = {
    emptyCart: 'Please input items',
    badQuantity: 'Please input correct Qty.',
  } as const;

  /** Ward list down the left: its search box and the patient cards under it. */
  readonly patientSearch: Locator;
  readonly patientList: Locator;
  readonly patientCards: Locator;

  /** The patient panel - all six disabled, filled by clicking a card. */
  readonly invoiceNo: Locator;
  readonly patientName: Locator;
  readonly gender: Locator;
  readonly age: Locator;
  readonly assignedDoctor: Locator;
  readonly cabinNo: Locator;

  /** The line entry row, past the Service lookup and the three date boxes. */
  readonly code: Locator;
  readonly remarks: Locator;
  readonly rate: Locator;
  readonly quantity: Locator;

  /**
   * The Service Date, both halves of it.
   *
   * flatpickr renders two inputs: a hidden one carrying the value the form posts, and the
   * visible box the nurse types into. This one carries a date *and a time*
   * ("2026-10-06 16:23"), unlike the Consultancy Service tab's, which is a date alone.
   */
  readonly serviceDate: Locator;
  readonly serviceDateBox: Locator;

  /** Under the cart: the running total, and the discount box that nothing reads. */
  readonly totalAmount: Locator;
  readonly serviceChange: Locator;

  /** Under the cart, beside Save: the OT procedure the entry belongs to. */
  readonly otName: Locator;

  /** The two buttons under the cart. */
  readonly save: Locator;
  readonly printAll: Locator;

  /** Whatever the tab is saying right now - a refusal, or a save. */
  readonly snackbar: Locator;

  constructor(page: Page) {
    super(page);

    this.patientSearch = this.group('Search').locator('input');
    this.patientList = page.locator('ul.list-group-scrollable:visible');
    this.patientCards = this.patientList.locator('li.list-group-item');

    this.invoiceNo = page.locator('input[name="SelectedLeftGridItem.InvoiceNo"]');
    this.patientName = page.locator('input[name="SelectedLeftGridItem.FullName"]');
    // Gender and Age carry no name attribute, so their label is the only way in.
    this.gender = this.group('Gender').locator('input');
    this.age = this.group('Age').locator('input');
    this.assignedDoctor = page.locator('input[name="SelectedLeftGridItem.AssignedDoctorName"]');
    this.cabinNo = page.locator('input[name="SelectedLeftGridItem.CabinNo"]');

    this.code = page.locator('input[name="ServiceCode"]');
    this.remarks = page.locator('input[name="remarks"]');
    this.rate = page.locator('input[name="ServiceRate"]');
    this.quantity = page.locator('input[name="Quantity"]');

    this.serviceDate = page.locator('input[name="ServiceDate"]');
    this.serviceDateBox = this.group('Service Date').locator('input.input.form-control');

    this.totalAmount = page.locator('input[name="TotalAmount"]');
    // Labelled "Service Change" on screen; TotalServiceCharge in the markup.
    this.serviceChange = page.locator('input[name="TotalServiceCharge"]');
    this.otName = page.locator('select[name="OTNameId"]');

    this.save = page.locator('button[type="submit"].btn-success');
    this.printAll = page.locator('button.btn-print');
    // Only the ones showing: a faded snackbar stays in the stack carrying snackbar-hide
    // and its old text. Newest last. See whileWatchingSnackbars.
    this.snackbar = page.locator('div.snackbar.snackbar-show').last();
  }

  /**
   * The field group carrying `label` - a <div class="form-group"> holding a
   * <label class="form-label"> and its control, the shape every Blazor form in this ERP
   * uses. No <label for=...> is rendered, so getByLabel resolves none of it.
   *
   * Visible groups only: every other tab's markup stays in the DOM behind this one, and
   * three of them have a "Search" group of their own.
   */
  group(label: string): Locator {
    return this.page.locator('div.form-group:visible').filter({
      has: this.page.locator('label.form-label', { hasText: new RegExp(`^\\s*${label}\\s*$`) }),
    });
  }

  /** One of the page's tabs, e.g. tab('IPD SERVICE ENTRY'). CSS uppercases the label. */
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

  /** Lands on Nurse Station with the tab strip up. The page opens on Medicine Indent. */
  async openNurseStation(): Promise<void> {
    await this.goto();
    await this.settleAuthorization(this.tab(IpdServiceEntryPage.TAB));
    await expect(this.page).toHaveURL(new RegExp(this.path, 'i'));
    await expect(this.tab(IpdServiceEntryPage.TAB)).toBeVisible({ timeout: 30_000 });
  }

  /** Switches to IPD Service Entry and waits for the ward list to arrive. */
  async openIpdServiceEntry(): Promise<void> {
    await this.openTab(IpdServiceEntryPage.TAB);
    await this.expectLoaded();
  }

  /** Opens the page and lands on IPD Service Entry - what every case here starts with. */
  async openIpdService(): Promise<void> {
    await this.openNurseStation();
    await this.openIpdServiceEntry();
  }

  // --- the ward list -------------------------------------------------------------------

  /**
   * Narrows the ward list to `term`, and waits for the new list to arrive.
   *
   * It matches the bed and the admission number, which is all a card prints - a patient's
   * name brings back nothing, here as on every other tab of this page.
   *
   * The wait is what makes the result readable. The list filters as the term is typed, over
   * the circuit, with the previous three hundred cards still on screen while the new ones
   * are in flight and no spinner to say so - so a caller that read straight after the fill
   * reads the unfiltered ward.
   */
  async searchPatient(term: string): Promise<void> {
    await this.patientSearch.fill('');
    await this.patientSearch.fill(term);
    await this.settleWardList();
  }

  /** The ward card for `admissionNo`. Each card prints its bed over its admission number. */
  cardFor(admissionNo: string): Locator {
    return this.patientCards.filter({ hasText: admissionNo }).first();
  }

  /**
   * A card read back as bed and admission number.
   *
   * The two are on separate lines rather than comma-separated the way Consultancy Service
   * prints them, so the number is taken off the tail by pattern and whatever is left is the
   * bed. Admission numbers on this ward are eleven digits; ten is the floor, so a shorter
   * series would still be found.
   */
  async readCard(card: Locator): Promise<IpdWardPatient> {
    const text = (await card.innerText()).replace(/\s+/g, ' ').trim();
    return {
      bed: text.replace(/\s*\d{10,}\s*$/, '').trim(),
      admissionNo: text.match(/\d{10,}/)?.[0] ?? '',
    };
  }

  /**
   * The ward card at `index`, counted over the whole ward.
   *
   * By index rather than by a fixed admission number because the ward is live: today's beds
   * are not last week's. The order is not stable between loads either, so a case that wants
   * the *same* patient twice has to carry the admission number this returns and search for
   * it, not come back to the same index.
   *
   * The search box is cleared first, and that is not housekeeping: selectPatient narrows the
   * list to the one card it is opening, so a caller walking the ward would otherwise be
   * reading index 0 of a one-card list on every pass after the first.
   */
  async wardPatient(index = 0): Promise<IpdWardPatient> {
    if ((await this.patientSearch.inputValue().catch(() => '')) !== '') await this.searchPatient('');
    await expect(this.patientCards.first(), 'the ward list never loaded').toBeVisible({
      timeout: 60_000,
    });
    const count = await this.patientCards.count();
    return this.readCard(this.patientCards.nth(index % count));
  }

  /**
   * Looks `admissionNo` up in the ward list, opens that patient, and returns the panel the
   * app filled in.
   *
   * The six patient fields are disabled in the markup - there is no typing a patient into
   * this form, by a nurse or by a test. Clicking the card is the only thing that fills them.
   *
   * The click is retried because the search re-renders the list: the three hundred cards are
   * rebuilt as the term is typed, and a click that lands mid-render is swallowed - the card
   * never takes the `active` class and the panel never fills.
   *
   * Waited on Inv.No holding the number that was asked for, rather than on the Name box
   * having something in it: the panel keeps the previous patient, so "not empty" is already
   * true when a case moves from one bed to another and would hand back the patient before.
   */
  async selectPatient(admissionNo: string, attempts = 3): Promise<IpdPatient> {
    await this.searchPatient(admissionNo);

    const card = this.cardFor(admissionNo);
    await expect(card, `no patient admitted under ${admissionNo}`).toBeVisible({ timeout: 30_000 });

    for (let attempt = 1; attempt <= attempts; attempt++) {
      await card.click().catch(() => {});

      const loaded = await expect(this.invoiceNo)
        .toHaveValue(admissionNo, { timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
      if (loaded) break;

      expect(
        attempt,
        `${admissionNo} never loaded into the IPD service form, in ${attempts} clicks`
      ).toBeLessThan(attempts);
    }

    await expect(card, `${admissionNo} loaded without its card being marked`).toHaveClass(/active/);

    return this.readPatient();
  }

  /** Waits for the ward list to stop re-rendering - `stable` equal counts, a second apart. */
  private async settleWardList(stable = 2): Promise<void> {
    let previous = -1;
    let unchanged = 0;

    await expect
      .poll(
        async () => {
          const count = await this.patientCards.count();
          unchanged = count === previous ? unchanged + 1 : 0;
          previous = count;
          return unchanged;
        },
        {
          timeout: 30_000,
          intervals: new Array(30).fill(1_000),
          message: 'the ward list never stopped changing',
        }
      )
      .toBeGreaterThanOrEqual(stable);
  }

  /** The patient panel read back, whatever is in it. */
  async readPatient(): Promise<IpdPatient> {
    return {
      invoiceNo: (await this.invoiceNo.inputValue()).trim(),
      name: (await this.patientName.inputValue()).trim(),
      gender: (await this.gender.inputValue()).trim(),
      age: (await this.age.inputValue()).trim(),
      assignedDoctor: (await this.assignedDoctor.inputValue()).trim(),
      cabinNo: (await this.cabinNo.inputValue()).trim(),
    };
  }

  // --- the Service lookup --------------------------------------------------------------

  /** The Service lookup control. The only Radzen lookup on this tab. */
  get serviceLookup(): Locator {
    return this.group('Service').locator('.rz-dropdown');
  }

  /** What the Service lookup currently shows. '' when nothing is picked. */
  async picked(): Promise<string> {
    const shown = await this.group('Service').locator('.rz-dropdown-label').innerText();
    // Radzen renders a non-breaking space as the empty label, which trim() leaves behind.
    return shown.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * The popup panel belonging to the Service lookup.
   *
   * Radzen renders the panel at the end of the body rather than inside the field, so it is
   * reached from the page by its id. Matched with an attribute selector because Radzen's
   * generated ids can begin with a digit, and `#8-PRB8LA10` is not a valid CSS selector - a
   * plain `#${id}` throws rather than failing to match.
   */
  async panel(): Promise<Locator> {
    const id = await this.serviceLookup.getAttribute('id');
    return this.page.locator(`[id="popup-${id}"]`);
  }

  /**
   * Leaves the Service lookup open, whether or not it already was.
   *
   * Not a plain click: clicking an open lookup closes it, and this one stays open across a
   * refused commit. The click is retried because the other way this fails is the ordinary
   * Blazor one - a click landing before the handler is wired is swallowed.
   */
  async openLookup(attempts = 4): Promise<Locator> {
    const panel = await this.panel();

    for (let attempt = 1; attempt <= attempts; attempt++) {
      if (await panel.isVisible().catch(() => false)) return panel;
      await this.serviceLookup.click().catch(() => {});
      await panel.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
    }

    await expect(panel, 'the Service lookup never opened').toBeVisible();
    return panel;
  }

  /**
   * The rows of the open lookup panel, with the empty-state row left out.
   *
   * Radzen answers a search that matches nothing with one bordered row carrying the class
   * rz-datatable-emptymessage-row and no text in it. It is not selectable and it is not a
   * result, so counting it would make every empty search look like a hit of one.
   */
  lookupRows(panel: Locator): Locator {
    return panel.locator('tbody tr:not(.rz-datatable-emptymessage-row)');
  }

  /** Whether the open lookup is showing its empty state rather than results. */
  async lookupIsEmpty(panel: Locator): Promise<boolean> {
    return (await panel.locator('tr.rz-datatable-emptymessage-row').count()) > 0;
  }

  /**
   * Searches the Service lookup for `term` and leaves it open on the results.
   *
   * The search box keeps whatever was typed into it last - the panel is one control reused
   * for every line - so it is cleared before the new term goes in. A term of '' clears the
   * search and brings the whole catalogue back, first page first.
   *
   * A search can be lost rather than answered, which is the ordinary Blazor failure: a
   * click landing before the handler is wired is swallowed, and the panel is left showing
   * the unsearched catalogue with the term sitting in the box. IS-04 failed that way once
   * in a full run, reporting that "EEG Charge(ICU) Per Hour" had come back for "Visit" -
   * which was not the catalogue answering wrongly but the catalogue never being asked.
   *
   * So a search whose grid did not move is sent again. That is a mechanism-level retry,
   * deliberately: it asks "did anything happen at all", never "are these the rows I
   * wanted". A lookup that answers and answers *wrongly* is left alone for the caller to
   * report, which is what IS-04 is for.
   */
  async searchLookup(term: string, attempts = 3): Promise<Locator> {
    const panel = await this.openLookup();
    const body = panel.locator('tbody');
    const read = async () =>
      (await body.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const before = await read();

      await panel.locator('.rz-lookup-search input').fill('');
      await panel.locator('.rz-lookup-search input').fill(term);
      await panel.locator('.rz-lookup-search button').click();
      // The grid re-renders over the socket with no spinner to wait on, and the previous
      // search's rows stay on screen while the new ones are in flight.
      await this.settleLookup(panel);

      // An unchanged grid on the last attempt is taken as the answer: a term can honestly
      // bring back what was already on screen, and failing here would turn that into an
      // error the caller cannot act on.
      if ((await read()) !== before || attempt === attempts) return panel;
    }

    return panel;
  }

  /** Waits for the lookup's results to read the same `stable` times running. */
  private async settleLookup(panel: Locator, stable = 3): Promise<void> {
    let previous = '';
    let unchanged = -1;

    await expect
      .poll(
        async () => {
          const current = (await panel.locator('tbody').innerText().catch(() => '')).replace(
            /\s+/g,
            ' '
          );
          unchanged = current === previous ? unchanged + 1 : 0;
          previous = current;
          return unchanged;
        },
        {
          timeout: 45_000,
          intervals: new Array(45).fill(1_000),
          message: 'the Service lookup never settled on its results',
        }
      )
      .toBeGreaterThanOrEqual(stable);
  }

  /**
   * What the Service lookup offers for `term`: each catalogue entry and its rate.
   *
   * The catalogue holds entries that share a name and carry different rates, so the rate is
   * read alongside the name rather than the name alone. It is the only thing on screen that
   * tells those apart, and once a line is committed the cart keeps only the name.
   */
  async serviceOptions(term: string): Promise<IpdServiceOption[]> {
    const panel = await this.searchLookup(term);
    const rows = await this.lookupRows(panel).all();

    return Promise.all(
      rows.map(async (row) => {
        const [name, rate] = (await row.locator('td').allInnerTexts()).map((cell) =>
          cell.replace(/\s+/g, ' ').trim()
        );
        return { name, rate: Number(rate) };
      })
    );
  }

  /**
   * Clicks the row at `index` of the open lookup and returns what the form took from it.
   *
   * The pick is a round trip - the panel closes and the app writes the label - so the label
   * is waited on rather than read. Waited out as a *change* rather than as a non-empty
   * value, because the lookup reopens on whatever it last had picked and "not empty" would
   * hand that same name straight back.
   */
  async pickRow(index: number): Promise<string> {
    const panel = await this.openLookup();
    const before = await this.picked();

    await expect(
      this.lookupRows(panel).nth(index),
      `the Service lookup offered no row ${index}`
    ).toBeVisible({ timeout: 30_000 });
    await this.lookupRows(panel).nth(index).click();

    await expect
      .poll(() => this.picked(), { timeout: 15_000 })
      .not.toBe(before)
      .catch(() => {});

    return this.picked();
  }

  /** Searches the Service lookup for `term` and takes the row at `index`. */
  async pickService(term: string, index = 0): Promise<string> {
    await this.searchLookup(term);
    return this.pickRow(index);
  }

  // --- the three date boxes ------------------------------------------------------------

  /** The visible half of the flatpickr under `label` - the box a nurse types into. */
  dateBox(label: string): Locator {
    return this.group(label).locator('input.input.form-control');
  }

  /**
   * The hidden half of the flatpickr under `label` - the value the form posts.
   *
   * Only Service Date's hidden input carries a name, so the other two are reached through
   * their group. Worth knowing before asserting on them: the two windows post an ISO stamp
   * ("2026-10-06T09:00:00") while Service Date posts the same shape the visible box shows
   * ("2026-10-06 16:23"). The ERP is inconsistent about this, not the page object.
   */
  hiddenDate(label: string): Locator {
    return this.group(label).locator('input[type="hidden"]');
  }

  /**
   * Types `value` - YYYY-MM-DD HH:mm - into the flatpickr under `label` and waits for the
   * app to take it, returning what reached the hidden input.
   *
   * A date typed into a flatpickr box reaches the hidden input the form posts only when the
   * box loses focus, so the calendar it opened is escaped and the focus moved off before the
   * value is read. Remarks is the thing clicked, being an ordinary text box that opens
   * nothing of its own.
   */
  async setDateTime(label: string, value: string): Promise<string> {
    await this.dateBox(label).fill(value);
    await this.page.keyboard.press('Escape');
    await this.remarks.click();
    await expect(
      this.dateBox(label),
      `the ${label} box did not keep what was typed into it`
    ).toHaveValue(value, { timeout: 15_000 });
    return (await this.hiddenDate(label).inputValue()).trim();
  }

  /**
   * A date-time this tab printed, reduced to the "YYYY-MM-DD HH:mm" the boxes show.
   *
   * The hidden inputs are not consistent about shape, and the difference is not cosmetic to
   * a test. Service Date arrives from the app as "2026-10-06 16:23" and comes back from the
   * flatpickr, once a nurse has typed into it, as "2026-10-03T10:00:00" - so the same box
   * posts two formats depending on who last set it. Comparing those as strings reports a
   * difference that is not there, which is how IS-17 first failed: on the format, not on
   * the defect it is about.
   */
  static moment(value: string): string {
    return value.trim().replace('T', ' ').slice(0, 16);
  }

  /** Sets the Service Date, as YYYY-MM-DD HH:mm. */
  async setServiceDate(value: string): Promise<void> {
    await this.setDateTime('Service Date', value);
    // Compared as a moment rather than as a string - see IpdServiceEntryPage.moment.
    await expect
      .poll(() => this.serviceDate.inputValue().then(IpdServiceEntryPage.moment), {
        timeout: 15_000,
        message: 'the Service Date never reached the form',
      })
      .toBe(IpdServiceEntryPage.moment(value));
  }

  /**
   * The Service Date once it has stopped moving - `stable` readings a second apart.
   *
   * Committing a line puts the date back to the moment of the commit, but not with the row:
   * the cart grows first and the date is reset a render or two later. So a case that reads
   * the box the instant the row appears reads the date it typed, and passes against a tab
   * that has in fact just thrown it away.
   */
  async settledServiceDate(stable = 3): Promise<string> {
    let previous = '';
    let unchanged = -1;

    await expect
      .poll(
        async () => {
          const current = await this.serviceDate.inputValue();
          unchanged = current === previous ? unchanged + 1 : 0;
          previous = current;
          return unchanged;
        },
        {
          timeout: 30_000,
          intervals: new Array(30).fill(1_000),
          message: 'the Service Date never stopped changing',
        }
      )
      .toBeGreaterThanOrEqual(stable);

    return previous;
  }

  // --- the line entry row --------------------------------------------------------------

  /** The line entry row read back, as the form currently holds it. */
  async entryRow(): Promise<{
    service: string;
    code: string;
    remarks: string;
    rate: number;
    qty: number;
    serviceDate: string;
    startDateTime: string;
    endDateTime: string;
  }> {
    return {
      service: await this.picked(),
      code: await this.code.inputValue(),
      remarks: await this.remarks.inputValue(),
      rate: Number(await this.rate.inputValue()),
      qty: Number(await this.quantity.inputValue()),
      serviceDate: await this.serviceDate.inputValue(),
      startDateTime: await this.dateBox('Start Date Time').inputValue(),
      endDateTime: await this.dateBox('End Date Time').inputValue(),
    };
  }

  /** Fills the line entry row from `input`, without committing it. */
  async fillLine(input: IpdLineInput): Promise<void> {
    if (input.service !== undefined) await this.pickService(input.service, input.serviceIndex ?? 0);
    if (input.code !== undefined) await this.code.fill(input.code);
    if (input.remarks !== undefined) await this.remarks.fill(input.remarks);
    if (input.serviceDate !== undefined) await this.setServiceDate(input.serviceDate);
    if (input.startDateTime !== undefined)
      await this.setDateTime('Start Date Time', input.startDateTime);
    if (input.endDateTime !== undefined) await this.setDateTime('End Date Time', input.endDateTime);
    // After the service, which is what puts the catalogue rate in the box.
    if (input.rate !== undefined) await this.rate.fill(String(input.rate));
    if (input.serviceChange !== undefined)
      await this.serviceChange.fill(String(input.serviceChange));
    await this.quantity.fill(String(input.qty));
  }

  /**
   * Fills the line entry row and commits it, and reports whether the cart took it.
   *
   * Enter on Qty is the commit. The tab has no Add button - the only buttons under the cart
   * are Save and Print All - so a line that is typed but never committed is not part of the
   * bill, which is what makes the refusal cases worth testing on their own.
   *
   * Reports rather than asserts, so one method serves both the lines that should go in and
   * the ones that should not. `addLine` is the assert-it-worked wrapper.
   */
  async tryAddLine(input: IpdLineInput): Promise<IpdLineAttempt> {
    await this.fillLine(input);

    const before = await this.cartRows.count();
    const said = await this.whileWatchingSnackbars(async () => {
      await this.quantity.press('Enter');
    });

    // 12s rather than the usual 30: several of the cases here are about a line the cart
    // should refuse, and each of those pays this wait in full.
    const added = await expect(this.cartRows)
      .toHaveCount(before + 1, { timeout: 12_000 })
      .then(() => true)
      .catch(() => false);

    return { added, said };
  }

  /** Commits a line and asserts the cart took it, returning the row as the grid has it. */
  async addLine(input: IpdLineInput): Promise<IpdCartLine> {
    const before = await this.cartRows.count();
    const attempt = await this.tryAddLine(input);
    expect(
      attempt.added,
      `the line was never added to the cart${attempt.said ? ` - the tab said "${attempt.said}"` : ''}`
    ).toBe(true);

    const lines = await this.cart();
    return lines[before];
  }

  // --- the two grids -------------------------------------------------------------------

  /**
   * The cart - lines entered but not yet billed.
   *
   * Taken by its Remarks header, which is the one column the two grids do not share. Scoped
   * to what is visible so the Medicine Indent markup still in the DOM behind this tab cannot
   * be picked up by mistake.
   */
  get cartGrid(): Locator {
    return this.page
      .locator('table.mud-table-root:visible')
      .filter({ has: this.page.locator('th', { hasText: 'Remarks' }) })
      .first();
  }

  /** The bill - services already saved against this admission. Taken by its Served_By column. */
  get billGrid(): Locator {
    return this.page
      .locator('table.mud-table-root:visible')
      .filter({ has: this.page.locator('th', { hasText: 'Served_By' }) })
      .first();
  }

  /**
   * The cart's rows.
   *
   * MudBlazor keeps an empty-state row in tbody when the table holds nothing, and it is a
   * <tr> like any other - so a bare row count reads 1 for an empty cart. What marks it is
   * the <th class="mud-table-empty-row"> inside it.
   */
  get cartRows(): Locator {
    return this.cartGrid
      .locator('tbody tr')
      .filter({ hasNot: this.page.locator('th.mud-table-empty-row') });
  }

  /** The bill's rows, the empty-state row left out the same way. */
  get billRows(): Locator {
    return this.billGrid
      .locator('tbody tr')
      .filter({ hasNot: this.page.locator('th.mud-table-empty-row') });
  }

  /** The cart read back, one object per line, in the order the lines were committed. */
  async cart(): Promise<IpdCartLine[]> {
    const rows = await this.cartRows.all();

    return Promise.all(
      rows.map(async (row) => {
        const [service, schedule, rate, qty, serviceChange, remarks, startDate, endDate, amount] = (
          await row.locator('td').allInnerTexts()
        ).map((cell) => cell.replace(/\s+/g, ' ').trim());
        return {
          service,
          schedule,
          rate: Number(rate),
          qty: Number(qty),
          serviceChange: Number(serviceChange),
          remarks,
          startDate,
          endDate,
          amount: Number(amount),
        };
      })
    );
  }

  /** The bill read back, one object per saved service. */
  async bill(): Promise<IpdBilledLine[]> {
    const rows = await this.billRows.all();

    return Promise.all(
      rows.map(async (row) => {
        const [service, rate, qty, amount, discount, serviceDate, startDate, endDate, servedBy] = (
          await row.locator('td').allInnerTexts()
        ).map((cell) => cell.replace(/\s+/g, ' ').trim());
        return {
          service,
          rate: Number(rate),
          qty: Number(qty),
          amount: Number(amount),
          discount: Number(discount),
          serviceDate,
          startDate,
          endDate,
          servedBy,
        };
      })
    );
  }

  /** The running total under the cart. */
  async total(): Promise<number> {
    return Number(await this.totalAmount.inputValue());
  }

  /**
   * Waits for the cart to stop changing - `stable` readings of the same row count, a second
   * apart - and returns it.
   *
   * For the cases that read the cart after something has re-rendered the pane. Switching
   * tabs paints the IPD Service Entry pane before its cart is back in it, so for about a
   * second after the tab is clicked the grid reads empty and then fills again. A case that
   * read in that window would see an empty cart and report the tab clearing it, which it
   * does not.
   */
  async settledCart(stable = 3): Promise<IpdCartLine[]> {
    let previous = -1;
    let unchanged = 0;

    await expect
      .poll(
        async () => {
          const count = await this.cartRows.count();
          unchanged = count === previous ? unchanged + 1 : 0;
          previous = count;
          return unchanged;
        },
        {
          timeout: 30_000,
          intervals: new Array(30).fill(1_000),
          message: 'the cart never stopped changing',
        }
      )
      .toBeGreaterThanOrEqual(stable);

    return this.cart();
  }

  /**
   * Takes the cart line at `index` off with its bin.
   *
   * No confirmation and no message - the row simply goes, and Total Amount drops with it, so
   * the count is what there is to wait on.
   */
  async removeCartLine(index: number): Promise<void> {
    const before = await this.cartRows.count();
    await this.cartRows.nth(index).locator('button').first().click();
    await expect(this.cartRows, 'the cart line was never taken off').toHaveCount(before - 1, {
      timeout: 30_000,
    });
  }

  /**
   * Empties the cart through the bins, so a case leaves the tab as it found it.
   *
   * Cheap insurance rather than strictly necessary - each case gets a fresh page - but the
   * cart outlives both a patient change and a tab change (IS-13, IS-14), so a case that left
   * lines behind would hand them to whatever ran next in the same session.
   */
  async clearCart(): Promise<number> {
    let removed = 0;
    for (let guard = 0; guard < 25 && (await this.cartRows.count()) > 0; guard++) {
      const went = await this.removeCartLine(0)
        .then(() => true)
        .catch(() => false);
      if (!went) break;
      removed++;
    }
    return removed;
  }

  // --- what the tab says ---------------------------------------------------------------

  /**
   * Clicks Save and returns what the tab said back.
   *
   * Only ever called with an empty cart in this suite - see the spec's file header for why
   * nothing here saves for real.
   */
  async clickSave(): Promise<string> {
    return this.whileWatchingSnackbars(async () => {
      await this.save.click();
    }, 90_000);
  }

  /**
   * Runs `action` and returns the snackbar it raised, or '' if it raised none.
   *
   * Two things make "what the tab said" easy to get wrong, and both are handled here. A
   * snackbar from the step before is still in the stack and still carries its text, so the
   * stack is left to go quiet first and only what arrives *after* the action is counted. And
   * a snackbar fades a few seconds after it is raised, swapping snackbar-show for
   * snackbar-hide but keeping its text - the host is slow enough under a full suite that the
   * fade can beat the read - so a faded one is taken as an answer too.
   *
   * Returns '' rather than throwing when nothing is raised, and on this tab that matters more
   * than on any other: most of what it refuses, it refuses in silence, and that silence is
   * the answer those cases are reporting.
   */
  private async whileWatchingSnackbars(
    action: () => Promise<void>,
    timeout = 20_000
  ): Promise<string> {
    const showing = this.page.locator('div.snackbar.snackbar-show');
    const stack = this.page.locator('div.snackbar');

    // Non-fatal: if something is still on screen afterwards, the read below is no worse off
    // than it would have been, and the caller reports whatever it saw.
    await expect(showing).toHaveCount(0, { timeout: 10_000 }).catch(() => {});
    const before = await stack.count();

    await action();

    let said = '';
    await expect
      .poll(
        async () => {
          if (said !== '') return said;
          if ((await showing.count()) > 0 || (await stack.count()) > before) {
            const newest = ((await showing.count()) > 0 ? showing : stack).last();
            said = (await newest.innerText()).replace(/\s+/g, ' ').trim();
          }
          return said;
        },
        { timeout, intervals: new Array(Math.ceil(timeout / 1_000)).fill(1_000) }
      )
      .not.toBe('')
      .catch(() => {});

    return said;
  }

  /** How much room is left on the bill grid before it stops listing rows. */
  async billRoom(): Promise<number> {
    return IpdServiceEntryPage.BILL_ROW_CAP - (await this.billRows.count());
  }

  /** Asserts IPD Service Entry is the pane on screen, with its form and both grids. */
  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(this.path, 'i'));
    await expect(this.tab(IpdServiceEntryPage.TAB)).toHaveClass(/active/);
    await expect(this.patientCards.first(), 'the ward list never loaded').toBeVisible({
      timeout: 60_000,
    });
    await expect(this.quantity).toBeVisible({ timeout: 30_000 });
    await expect(this.save).toBeVisible({ timeout: 30_000 });
    // Two grids, always: the tab renders both even for a patient with nothing on the bill.
    await expect(this.cartGrid, 'the cart grid is missing').toBeVisible();
    await expect(this.billGrid, 'the bill grid is missing').toBeVisible();
  }
}
