import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/** A patient as the ward list down the left of the tab shows them. */
export interface ConsultancyWardPatient {
  /** Admission number - the digits after the comma on the card. */
  admissionNo: string;
  /** Bed as the card prints it, e.g. "ICU-11". The form shows it as "P(ICU-11)". */
  bed: string;
}

/** The read-only panel the tab fills in once a patient is picked out of the ward list. */
export interface ConsultancyPatient {
  /** "Inv.No" - the admission number, not an invoice number of its own. */
  invoiceNo: string;
  name: string;
  /** "Assigned Doctor" - the consultant the admission is under. Often long. */
  assignedDoctor: string;
  /** "CabinNo", e.g. "P(ICU-11)". */
  cabinNo: string;
}

/** One row of the Service lookup: a catalogue entry and the rate it carries. */
export interface ServiceOption {
  name: string;
  rate: number;
}

/** A line as it sits in the upper grid - entered, costed, but not yet billed. */
export interface CartLine {
  service: string;
  doctor: string;
  /** 'On Time' or 'Off Time', and '' when the line was committed without one. */
  schedule: string;
  rate: number;
  qty: number;
  serviceChange: number;
  amount: number;
}

/** A row of the lower grid: a service already saved against the admission. */
export interface ServedLine {
  service: string;
  doctor: string;
  rate: number;
  qty: number;
  discount: number;
  amount: number;
  /** As the grid prints it: M/d/yyyy h:mm:ss AM/PM. */
  serviceDate: string;
  /** The username that saved it. */
  servedBy: string;
}

/** What came of trying to commit a line, for the cases where it should not be taken. */
export interface LineAttempt {
  /** Whether the upper grid grew by one. */
  added: boolean;
  /** The snackbar the attempt raised, and '' when it raised none. */
  said: string;
}

/** What the line entry row is to be filled with. Only `qty` is required. */
export interface LineInput {
  /** Search term for the Service lookup. Omitted leaves whatever is already picked. */
  service?: string;
  /** Which row of the Service lookup's results to take. Default 0. */
  serviceIndex?: number;
  /** Search term for the Doctor Name lookup. Omitted leaves whatever is already picked. */
  doctor?: string;
  /** Which row of the Doctor lookup's results to take. Default 0. */
  doctorIndex?: number;
  /** 'On Time' or 'Off Time'. Omitted leaves the Schedule box as it is. */
  schedule?: string;
  /** Overwrites the rate the catalogue put on the form. See the class note. */
  rate?: number;
  /** The Service Date, as YYYY-MM-DD. See setServiceDate. */
  serviceDate?: string;
  qty: number;
}

/**
 * Nurse Station > Consultancy Service, at /hospital/nurse-station - the tab where the ward
 * puts a consultant's visit, or any other chargeable service, onto an admitted patient's
 * bill.
 *
 * Its own page object, like DietIndentPage and DietDashboardPage: it shares the route and
 * the tab strip with Medicine Indent and nothing else - different form, different grids,
 * different save.
 *
 * How the tab is laid out
 * -----------------------
 * Down the left, the ward list - every admitted patient, one card per bed, with a search
 * box over it. Top right, a patient panel of four disabled boxes that the card fills in.
 * Under that, the line entry row: Service, Doctor Name, Service Date, Schedule, Rate, Qty.
 * Then two MudBlazor grids, one above the other, and a Save between them:
 *
 *   - the upper grid is the cart - lines entered and costed but not yet billed, with
 *     Total Amount and Service Change under it, and a bin on each row;
 *   - the lower grid is the bill - every consultancy already saved against this admission,
 *     with who saved it and when, and a bin that opens a cancel-with-reason dialog.
 *
 * Seven things about this tab are not guessable from looking at it, and each cost a run to
 * find.
 *
 * Enter on Qty is what commits a line. There is no Add button - the only button between
 * the two grids is Save - so a line that is typed and never committed is simply not part
 * of the bill. The same shape Medicine Indent uses, and for the same reason.
 *
 * Service and Doctor Name are required and Schedule is not: committing without a service
 * or without a doctor raises "Please select fields." and adds nothing, while committing
 * without a schedule is taken in silence. Qty has a guard of its own - zero and negative
 * are refused with "Please input correct Qty." - which is why those are separate cases.
 *
 * Rate arrives from the catalogue but the box is editable, and whatever is in it at the
 * moment of the Enter is what reaches the bill. CS-14 is the case about that.
 *
 * Service Date is a flatpickr that resets itself to today every time a line is committed,
 * so a back-dated service cannot be entered at all. CS-15.
 *
 * Service Change - the discount box under Total Amount - is read by nothing. CS-16.
 *
 * The cart belongs to the tab rather than to the patient: picking a different patient, or
 * leaving the tab and coming back, leaves every uncommitted line where it is. CS-12 and
 * CS-13 are those, and they are the two worth fixing first - a Save after either bills one
 * patient for another's services.
 *
 * And the bill grid stops at fifteen rows with nothing on screen saying so, which is both a
 * finding (CS-23) and a constraint on anything written from here. See BILL_ROW_CAP.
 *
 * Framework mix, as everywhere in this ERP: the form is Bootstrap (div.form-group holding
 * a label.form-label), the three pickers are Radzen lookups, both grids are MudBlazor, the
 * date box is a flatpickr, and the messages are Blazorise snackbars rather than the
 * .toast/.alert pair BasePage knows about.
 *
 * Every id on the page is a Blazor circuit id, regenerated on each connection, so nothing
 * here is located by id except the Radzen popup panels - which have to be, there being
 * nothing else to tell three identical lookups apart. Those are matched with an attribute
 * selector rather than `#id`, because Radzen's ids can begin with a digit and `#8-PRB8LA10`
 * is not a valid CSS selector.
 */
export class ConsultancyServicePage extends BasePage {
  /** Also the drawer link's href, so specs opening it through the menu share this one. */
  static readonly PATH = '/hospital/nurse-station';

  protected readonly path = ConsultancyServicePage.PATH;

  /** The outer tab this page object lives on. */
  static readonly TAB = 'CONSULTANCY SERVICE';

  /**
   * The cart grid's columns, in order. An eighth, unlabelled, holds the bin.
   *
   * Spelled as the markup spells them, not as the screen shows them: the headers are
   * uppercased by CSS, so a case asserting on "SERVICE NAME" is asserting on the
   * stylesheet rather than on the page.
   */
  static readonly CART_COLUMNS = [
    'Service Name',
    'Doctor Name',
    'Schedule',
    'Rate',
    'Qty',
    'Service Change',
    'Amount',
  ] as const;

  /** The bill grid's columns, in order. A ninth, unlabelled, holds the bin. */
  static readonly BILL_COLUMNS = [
    'Service Name',
    'Doctor Name',
    'Rate',
    'Qty',
    'Discount',
    'Amount',
    'ServiceDate',
    'Servedby',
  ] as const;

  /** What the Schedule lookup offers. There is no third option and no blank. */
  static readonly SCHEDULES = ['On Time', 'Off Time'] as const;

  /**
   * The most rows the bill grid has ever been seen to hold.
   *
   * Not a page size - there is no pager, no page-size box and no total anywhere on the
   * tab. It is where the list simply stops. Six of the first eighteen beds on the ward sit
   * on exactly this number and nothing goes above it, which is what establishes it as a cap
   * rather than a coincidence. CS-23 is the case about it.
   *
   * It matters to anything that writes, not only to the case that reports it: a service
   * saved against a patient already on fifteen cannot be seen afterwards, and therefore
   * cannot be cancelled off the bill from this tab either. Every writing case here goes
   * through patientBelowBillCap for that reason.
   */
  static readonly BILL_ROW_CAP = 15;

  /** The reasons the cancel dialog offers as chips, past the free-text box. */
  static readonly CANCEL_REASONS = [
    'Entered by mistake',
    'Duplicate entry',
    'Wrong patient',
    'Service not provided',
    'Wrong quantity or rate',
  ] as const;

  /** Everything the tab says back, in the words it says it. */
  static readonly MESSAGES = {
    saved: 'Successful!',
    emptyCart: 'Please input items',
    missingFields: 'Please select fields.',
    badQuantity: 'Please input correct Qty.',
    cancelled: 'Consultancy cancelled and recorded in the change log.',
  } as const;

  /** Ward list down the left: its search box and the patient cards under it. */
  readonly patientSearch: Locator;
  readonly patientList: Locator;
  readonly patientCards: Locator;

  /** The patient panel - all four disabled, filled by clicking a card. */
  readonly invoiceNo: Locator;
  readonly patientName: Locator;
  readonly assignedDoctor: Locator;
  readonly cabinNo: Locator;

  /** The line entry row. */
  readonly rate: Locator;
  readonly quantity: Locator;

  /**
   * The Service Date, both halves of it.
   *
   * flatpickr renders two inputs: a hidden one carrying the value the form posts, and the
   * visible box the nurse types into. On this tab the two agree on arrival - unlike the
   * Diet Dashboard's, where they do not - so `serviceDate` is the one to assert on and
   * `serviceDateBox` the one to type into.
   */
  readonly serviceDate: Locator;
  readonly serviceDateBox: Locator;

  /** Under the cart: the running total, and the discount box that nothing reads. */
  readonly totalAmount: Locator;
  readonly serviceChange: Locator;

  /** The only button between the two grids. */
  readonly save: Locator;

  /** Whatever the tab is saying right now - a save, a refusal, a cancellation. */
  readonly snackbar: Locator;

  constructor(page: Page) {
    super(page);

    this.patientSearch = this.group('Search').locator('input');
    this.patientList = page.locator('ul.list-group-scrollable:visible');
    this.patientCards = this.patientList.locator('li.list-group-item');

    this.invoiceNo = page.locator('input[name="SelectedLeftGridItem.InvoiceNo"]');
    this.patientName = page.locator('input[name="SelectedLeftGridItem.FullName"]');
    this.assignedDoctor = page.locator('input[name="SelectedLeftGridItem.AssignedDoctorName"]');
    this.cabinNo = page.locator('input[name="SelectedLeftGridItem.CabinNo"]');

    this.rate = page.locator('input[name="ServiceRate"]');
    this.quantity = page.locator('input[name="Quantity"]');
    this.serviceDate = page.locator('input[name="ServiceDate"]');
    this.serviceDateBox = this.group('Service Date').locator('input.input.form-control');

    this.totalAmount = page.locator('input[name="TotalAmount"]');
    this.serviceChange = page.locator('input[name="ServiceChange"]');

    this.save = page.locator('button[type="submit"].btn-success');
    // Only the ones showing: a faded snackbar stays in the stack carrying snackbar-hide
    // and its old text. Newest last. See saveBill.
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

  /** One of the page's tabs, e.g. tab('CONSULTANCY SERVICE'). CSS uppercases the label. */
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
    await this.settleAuthorization(this.tab(ConsultancyServicePage.TAB));
    await expect(this.page).toHaveURL(new RegExp(this.path, 'i'));
    await expect(this.tab(ConsultancyServicePage.TAB)).toBeVisible({ timeout: 30_000 });
  }

  /** Switches to Consultancy Service and waits for the ward list to arrive. */
  async openConsultancyService(): Promise<void> {
    await this.openTab(ConsultancyServicePage.TAB);
    await this.expectLoaded();
  }

  /** Opens the page and lands on Consultancy Service - what every case here starts with. */
  async openConsultancy(): Promise<void> {
    await this.openNurseStation();
    await this.openConsultancyService();
  }

  // --- the ward list -------------------------------------------------------------------

  /**
   * Narrows the ward list to `term`, and waits for the new list to arrive.
   *
   * It matches the bed and the admission number, which is all a card prints - a patient's
   * name brings back nothing, here and on Medicine Indent alike.
   *
   * The wait is what makes the result readable. The list filters as the term is typed, over
   * the circuit, with the previous three hundred cards still on screen while the new ones
   * are in flight and no spinner to say so - so a caller that read straight after the fill
   * read the unfiltered ward. CS-02 failed that way, reporting that a search for
   * "Free Bed Male" had brought back ICU-07.
   */
  async searchPatient(term: string): Promise<void> {
    await this.patientSearch.fill('');
    await this.patientSearch.fill(term);
    await this.settleWardList();
  }

  /** The ward card for `admissionNo`. Each card prints "BED, ADMISSIONNO". */
  cardFor(admissionNo: string): Locator {
    return this.patientCards.filter({ hasText: admissionNo }).first();
  }

  /** A card read back as bed and admission number. */
  async readCard(card: Locator): Promise<ConsultancyWardPatient> {
    const text = (await card.innerText()).replace(/\s+/g, ' ').trim();
    const [bed, admissionNo] = text.split(',').map((part) => part.trim());
    return { bed: bed ?? '', admissionNo: admissionNo ?? '' };
  }

  /**
   * The ward card at `index`, counted over the whole ward.
   *
   * By index rather than by a fixed admission number because the ward is live: today's
   * beds are not last week's. The order is not stable between loads either, so a case
   * that wants the *same* patient twice has to carry the admission number this returns
   * and search for it, not come back to the same index.
   *
   * The search box is cleared first, and that is not housekeeping. selectPatient narrows
   * the list to the one card it is opening, so a caller walking the ward - looking for a
   * patient with room on their bill, or with a bill at all - would be reading index 0 of a
   * one-card list on every pass after the first, and come back with the same patient over
   * and over. patientBelowBillCap did exactly that until this cleared the box.
   */
  async wardPatient(index = 0): Promise<ConsultancyWardPatient> {
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
   * The four patient fields are disabled in the markup - there is no typing a patient into
   * this form, by a nurse or by a test. Clicking the card is the only thing that fills
   * them, and the click is a round trip, so the Name box is waited on rather than read.
   *
   * The click is retried because the search re-renders the list: the three hundred cards
   * are rebuilt as the term is typed, and a click that lands mid-render is swallowed - the
   * card never takes the `active` class and the panel never fills. Waiting for the list to
   * stop moving first fixes most of it and the retry covers the rest.
   */
  async selectPatient(admissionNo: string, attempts = 3): Promise<ConsultancyPatient> {
    await this.searchPatient(admissionNo);

    const card = this.cardFor(admissionNo);
    await expect(card, `no patient admitted under ${admissionNo}`).toBeVisible({ timeout: 30_000 });

    for (let attempt = 1; attempt <= attempts; attempt++) {
      await card.click().catch(() => {});

      // Waited on Inv.No rather than on the Name box having something in it, because the
      // panel keeps the patient before: "not empty" is already true when a case moves from
      // one patient to another, so it passes before the click has been answered and hands
      // the caller the previous patient's details. Inv.No is the admission number, so it
      // can be waited on for the one that was asked for.
      const loaded = await expect(this.invoiceNo)
        .toHaveValue(admissionNo, { timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
      if (loaded) break;

      expect(
        attempt,
        `${admissionNo} never loaded into the consultancy form, in ${attempts} clicks`
      ).toBeLessThan(attempts);
    }

    // The card marks itself once the app has taken the click, which by here it has.
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
  async readPatient(): Promise<ConsultancyPatient> {
    return {
      invoiceNo: (await this.invoiceNo.inputValue()).trim(),
      name: (await this.patientName.inputValue()).trim(),
      assignedDoctor: (await this.assignedDoctor.inputValue()).trim(),
      cabinNo: (await this.cabinNo.inputValue()).trim(),
    };
  }

  // --- the three Radzen lookups --------------------------------------------------------

  /** The lookup control under `label` - Service, Doctor Name or Schedule. */
  lookup(label: string): Locator {
    return this.group(label).locator('.rz-dropdown');
  }

  /** What the lookup under `label` currently shows. '' when nothing is picked. */
  async picked(label: string): Promise<string> {
    const shown = await this.group(label).locator('.rz-dropdown-label').innerText();
    // Radzen renders a non-breaking space as the empty label, which trim() leaves behind.
    return shown.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * The popup panel belonging to the lookup under `label`.
   *
   * Radzen renders the panel at the end of the body rather than inside the field, so it is
   * reached from the page by its id - and three lookups on one tab means it has to be by
   * id, there being nothing else to tell them apart. Matched with an attribute selector
   * because Radzen's generated ids can begin with a digit, and `#8-PRB8LA10` is not a
   * valid CSS selector - a plain `#${id}` throws rather than failing to match.
   */
  async panelFor(label: string): Promise<Locator> {
    const id = await this.lookup(label).getAttribute('id');
    return this.page.locator(`[id="popup-${id}"]`);
  }

  /**
   * Leaves the lookup under `label` open, whether or not it already was.
   *
   * Not a plain click: clicking an open lookup closes it, and these stay open across a
   * refused commit. The click is retried because the other way this fails is the ordinary
   * Blazor one - a click landing before the handler is wired is swallowed.
   */
  async openLookup(label: string, attempts = 4): Promise<Locator> {
    const panel = await this.panelFor(label);

    for (let attempt = 1; attempt <= attempts; attempt++) {
      if (await panel.isVisible().catch(() => false)) return panel;
      await this.lookup(label).click().catch(() => {});
      await panel.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
    }

    await expect(panel, `the ${label} lookup never opened`).toBeVisible();
    return panel;
  }

  /**
   * The rows of an open lookup panel, with the empty-state row left out.
   *
   * Radzen answers a search that matches nothing with one bordered row carrying the class
   * rz-datatable-emptymessage-row and no text in it. It is not selectable and it is not a
   * result, so counting it would make every empty search look like a hit of one.
   */
  lookupRows(panel: Locator): Locator {
    return panel.locator('tbody tr:not(.rz-datatable-emptymessage-row)');
  }

  /** Whether an open lookup is showing its empty state rather than results. */
  async lookupIsEmpty(panel: Locator): Promise<boolean> {
    return (await panel.locator('tr.rz-datatable-emptymessage-row').count()) > 0;
  }

  /**
   * Searches the lookup under `label` for `term` and leaves it open on the results.
   *
   * The search box keeps whatever was typed into it last - the panel is one control reused
   * for every line - so it is cleared before the new term goes in. A term of '' clears the
   * search and brings the whole catalogue back, first page first.
   */
  async searchLookup(label: string, term: string): Promise<Locator> {
    const panel = await this.openLookup(label);
    await panel.locator('.rz-lookup-search input').fill('');
    await panel.locator('.rz-lookup-search input').fill(term);
    await panel.locator('.rz-lookup-search button').click();
    // The grid re-renders over the socket with no spinner to wait on, and the previous
    // search's rows stay on screen while the new ones are in flight.
    await this.settleLookup(panel);
    return panel;
  }

  /** Waits for a lookup's results to read the same `stable` times running. */
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
          message: 'a lookup never settled on its results',
        }
      )
      .toBeGreaterThanOrEqual(stable);
  }

  /**
   * What the Service lookup offers for `term`: each catalogue entry and its rate.
   *
   * The catalogue holds entries that share a name and carry different rates - two called
   * "ICU Visit", at 1000 and at 0 - so the rate is read alongside the name rather than
   * the name alone. It is the only thing on screen that tells those two apart, and once a
   * line is committed the grid keeps only the name.
   */
  async serviceOptions(term: string): Promise<ServiceOption[]> {
    const panel = await this.searchLookup('Service', term);
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
   * Clicks the row at `index` of the open lookup under `label` and returns what the form
   * took from it.
   *
   * The pick is a round trip - the panel closes and the app writes the label - so the
   * label is waited on rather than read. Waited out as a *change* rather than as a
   * non-empty value, because the Service lookup reopens on whatever it last had picked and
   * "not empty" would hand that same name straight back.
   *
   * The one exception is the Doctor Name lookup's first row, which is a blank record: it
   * picks successfully and leaves the label empty. See CS-17 - the wait is given a short
   * timeout and allowed to lapse so that case can report what the form did rather than
   * dying in the page object.
   */
  async pickRow(label: string, index: number): Promise<string> {
    const panel = await this.openLookup(label);
    const before = await this.picked(label);

    await expect(
      this.lookupRows(panel).nth(index),
      `the ${label} lookup offered no row ${index}`
    ).toBeVisible({ timeout: 30_000 });
    await this.lookupRows(panel).nth(index).click();

    await expect
      .poll(() => this.picked(label), { timeout: 15_000 })
      .not.toBe(before)
      .catch(() => {});

    return this.picked(label);
  }

  /** Searches the Service lookup for `term` and takes the row at `index`. */
  async pickService(term: string, index = 0): Promise<string> {
    await this.searchLookup('Service', term);
    return this.pickRow('Service', index);
  }

  /** Searches the Doctor Name lookup for `term` and takes the row at `index`. */
  async pickDoctor(term: string, index = 0): Promise<string> {
    await this.searchLookup('Doctor Name', term);
    return this.pickRow('Doctor Name', index);
  }

  /** Picks 'On Time' or 'Off Time'. The lookup holds those two and nothing else. */
  async pickSchedule(name: string): Promise<string> {
    const index = ConsultancyServicePage.SCHEDULES.indexOf(
      name as (typeof ConsultancyServicePage.SCHEDULES)[number]
    );
    expect(index, `"${name}" is not a schedule this tab offers`).toBeGreaterThanOrEqual(0);
    await this.openLookup('Schedule');
    return this.pickRow('Schedule', index);
  }

  // --- the line entry row --------------------------------------------------------------

  /**
   * Sets the Service Date, as YYYY-MM-DD, and waits for the app to take it.
   *
   * A date typed into a flatpickr box reaches the hidden input the form posts only when
   * the box loses focus, so the calendar it opened is escaped and the focus moved off
   * before the value is waited on.
   */
  async setServiceDate(date: string): Promise<void> {
    await this.serviceDateBox.fill(date);
    await this.page.keyboard.press('Escape');
    // Anything but the date box: the blur is what commits the value.
    await this.serviceChange.click();
    await expect(this.serviceDate, 'the Service Date never reached the form').toHaveValue(date, {
      timeout: 15_000,
    });
  }

  /**
   * The Service Date once it has stopped moving - `stable` readings a second apart.
   *
   * Committing a line puts the date back to today, but not with the row: the cart grows
   * first and the date is reset a second or two later, in a render of its own. So a case
   * that reads the box the instant the row appears reads the date it typed, and passes
   * against a tab that has in fact just thrown it away. CS-15 did exactly that before
   * this existed.
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

  /** The line entry row read back, as the form currently holds it. */
  async entryRow(): Promise<{
    service: string;
    doctor: string;
    schedule: string;
    rate: number;
    qty: number;
    serviceDate: string;
  }> {
    return {
      service: await this.picked('Service'),
      doctor: await this.picked('Doctor Name'),
      schedule: await this.picked('Schedule'),
      rate: Number(await this.rate.inputValue()),
      qty: Number(await this.quantity.inputValue()),
      serviceDate: await this.serviceDate.inputValue(),
    };
  }

  /** Fills the line entry row from `input`, without committing it. */
  async fillLine(input: LineInput): Promise<void> {
    if (input.service !== undefined) await this.pickService(input.service, input.serviceIndex ?? 0);
    if (input.doctor !== undefined) await this.pickDoctor(input.doctor, input.doctorIndex ?? 0);
    if (input.schedule !== undefined) await this.pickSchedule(input.schedule);
    if (input.serviceDate !== undefined) await this.setServiceDate(input.serviceDate);
    // After the service, which is what puts the catalogue rate in the box.
    if (input.rate !== undefined) await this.rate.fill(String(input.rate));
    await this.quantity.fill(String(input.qty));
  }

  /**
   * Fills the line entry row and commits it, and reports whether the cart took it.
   *
   * Enter on Qty is the commit. The tab has no Add button - the only button between the
   * two grids is Save - so a line that is typed but never committed is not part of the
   * bill, which is what makes the refusal cases worth testing on their own.
   *
   * Reports rather than asserts, so one method serves both the lines that should go in and
   * the ones that should not. `addLine` is the assert-it-worked wrapper.
   */
  async tryAddLine(input: LineInput): Promise<LineAttempt> {
    await this.fillLine(input);

    const before = await this.cartRows.count();
    const said = await this.whileWatchingSnackbars(async () => {
      await this.quantity.press('Enter');
    });

    // 12s rather than the usual 30: half the cases here are about a line the cart should
    // refuse, and each of those pays this wait in full.
    const added = await expect(this.cartRows)
      .toHaveCount(before + 1, { timeout: 12_000 })
      .then(() => true)
      .catch(() => false);

    return { added, said };
  }

  /** Commits a line and asserts the cart took it, returning the row as the grid has it. */
  async addLine(input: LineInput): Promise<CartLine> {
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
   * Taken by its Schedule header, which is the one column the two grids do not share.
   * Scoped to what is visible so the Medicine Indent markup still in the DOM behind this
   * tab cannot be picked up by mistake.
   */
  get cartGrid(): Locator {
    return this.page
      .locator('table.mud-table-root:visible')
      .filter({ has: this.page.locator('th', { hasText: 'Schedule' }) })
      .first();
  }

  /** The bill - services already saved against this admission. Taken by its Servedby column. */
  get billGrid(): Locator {
    return this.page
      .locator('table.mud-table-root:visible')
      .filter({ has: this.page.locator('th', { hasText: 'Servedby' }) })
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
  async cart(): Promise<CartLine[]> {
    const rows = await this.cartRows.all();

    return Promise.all(
      rows.map(async (row) => {
        const [service, doctor, schedule, rate, qty, serviceChange, amount] = (
          await row.locator('td').allInnerTexts()
        ).map((cell) => cell.replace(/\s+/g, ' ').trim());
        return {
          service,
          doctor,
          schedule,
          rate: Number(rate),
          qty: Number(qty),
          serviceChange: Number(serviceChange),
          amount: Number(amount),
        };
      })
    );
  }

  /** The bill read back, one object per saved service. */
  async bill(): Promise<ServedLine[]> {
    const rows = await this.billRows.all();

    return Promise.all(
      rows.map(async (row) => {
        const [service, doctor, rate, qty, discount, amount, serviceDate, servedBy] = (
          await row.locator('td').allInnerTexts()
        ).map((cell) => cell.replace(/\s+/g, ' ').trim());
        return {
          service,
          doctor,
          rate: Number(rate),
          qty: Number(qty),
          discount: Number(discount),
          amount: Number(amount),
          serviceDate,
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
   * tabs paints the Consultancy Service pane before its cart is back in it, so for about a
   * second after the tab is clicked the grid reads empty and then fills again. A case that
   * read in that window saw an empty cart and reported the tab clearing it, which it does
   * not: CS-13 passed that way once in five runs before this existed.
   */
  async settledCart(stable = 3): Promise<CartLine[]> {
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
   * No confirmation and no message - the row simply goes, and Total Amount drops with it,
   * so the count is what there is to wait on.
   */
  async removeCartLine(index: number): Promise<void> {
    const before = await this.cartRows.count();
    await this.cartRows.nth(index).locator('button').first().click();
    await expect(this.cartRows, 'the cart line was never taken off').toHaveCount(before - 1, {
      timeout: 30_000,
    });
  }

  // --- saving, and taking a saved service off again ------------------------------------

  /**
   * Clicks Save and returns what the tab said back, so the caller can assert on it.
   *
   * The snackbar answers both ways - "Successful!" and "Please input items" arrive in the
   * same element with the same classes - so the text is the only thing that separates a
   * save from a refusal. See whileWatchingSnackbars for why it is read the way it is.
   */
  async saveBill(): Promise<string> {
    // 90s rather than the usual 20: a save against a busy ward takes the host well past
    // twenty seconds to answer, and a read that gave up first returned '' and made a save
    // that worked look like one that said nothing.
    return this.whileWatchingSnackbars(async () => {
      await this.save.click();
    }, 90_000);
  }

  /**
   * Runs `action` and returns the snackbar it raised, or '' if it raised none.
   *
   * Two things make "what the tab said" easy to get wrong, and both are handled here. A
   * snackbar from the step before is still in the stack and still carries its text, so the
   * stack is left to go quiet first and only what arrives *after* the action is counted.
   * And a snackbar fades a few seconds after it is raised, swapping snackbar-show for
   * snackbar-hide but keeping its text - the host is slow enough under a full suite that
   * the fade can beat the read - so a faded one is taken as an answer too.
   *
   * Returns '' rather than throwing when nothing is raised: several of the cases here are
   * about an action going through in silence, and silence is their answer.
   */
  private async whileWatchingSnackbars(
    action: () => Promise<void>,
    timeout = 20_000
  ): Promise<string> {
    const showing = this.page.locator('div.snackbar.snackbar-show');
    const stack = this.page.locator('div.snackbar');

    // Non-fatal: if something is still on screen afterwards, the read below is no worse
    // off than it would have been, and the caller reports whatever it saw.
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

  /**
   * The cancel-with-reason dialog, when one is open.
   *
   * Scoped to what is on screen on purpose: the shell keeps empty MudBlazor and Bootstrap
   * dialog containers mounted at all times, so a bare [role="dialog"] count is never zero.
   */
  get cancelDialog(): Locator {
    return this.page
      .locator('.modal.show:visible, .mud-dialog:visible, [role="dialog"]:visible')
      .last();
  }

  /** The free-text reason box in the cancel dialog. */
  get cancelReason(): Locator {
    return this.cancelDialog.locator('textarea[name="_reason"]');
  }

  /** The reason chips, each of which fills the box with its own wording. */
  cancelChip(reason: string): Locator {
    return this.cancelDialog.locator('button.scr-chip').filter({ hasText: reason }).first();
  }

  /** The dialog's two buttons. */
  get confirmCancel(): Locator {
    return this.cancelDialog.locator('button').filter({ hasText: /^Cancel service$/ }).first();
  }

  get keepService(): Locator {
    return this.cancelDialog.locator('button').filter({ hasText: /^Keep service$/ }).first();
  }

  /** Opens the cancel dialog on the bill row at `index`. */
  async openCancel(index: number): Promise<Locator> {
    await this.billRows.nth(index).locator('button').first().click();
    await expect(this.cancelDialog, 'the cancel dialog never opened').toBeVisible({
      timeout: 30_000,
    });
    return this.cancelDialog;
  }

  /**
   * Takes the bill row at `index` off the bill, giving `reason`, and returns what the tab
   * said back.
   *
   * The reason is required: the dialog refuses a blank one with an inline message rather
   * than a snackbar, which is CS-20. Given through the chip rather than the box, because
   * the chip is what a nurse uses and it fills the box itself.
   */
  async cancelBillLine(index: number, reason = 'Entered by mistake'): Promise<string> {
    const before = await this.billRows.count();
    await this.openCancel(index);
    await this.cancelChip(reason).click();
    await expect(this.cancelReason, 'the chip never filled the reason box').not.toHaveValue('');

    const said = await this.whileWatchingSnackbars(async () => {
      await this.confirmCancel.click();
    }, 90_000);

    await expect(this.billRows, 'the cancelled service is still on the bill').toHaveCount(
      before - 1,
      { timeout: 60_000 }
    );
    return said;
  }

  /** A bill row flattened, for telling one row from another. */
  private static rowKey(row: ServedLine): string {
    return [
      row.service,
      row.doctor,
      row.rate,
      row.qty,
      row.discount,
      row.amount,
      row.serviceDate,
      row.servedBy,
    ].join('|');
  }

  /**
   * Which rows of `current` the bill did not already hold in `baseline`.
   *
   * A multiset difference rather than a positional one, so a patient charged the same
   * service twice over - which this ward does constantly - is counted right: two identical
   * rows in the baseline account for two identical rows now, and a third is new.
   */
  private static newRows(current: ServedLine[], baseline: ServedLine[]): number[] {
    const spare = new Map<string, number>();
    for (const row of baseline) {
      const key = ConsultancyServicePage.rowKey(row);
      spare.set(key, (spare.get(key) ?? 0) + 1);
    }

    const added: number[] = [];
    current.forEach((row, index) => {
      const key = ConsultancyServicePage.rowKey(row);
      const left = spare.get(key) ?? 0;
      if (left > 0) spare.set(key, left - 1);
      else added.push(index);
    });
    return added;
  }

  /**
   * Takes off the bill everything that is on it and was not on `baseline`, so a case that
   * saved leaves the admission as it found it.
   *
   * Only what this run put there. An earlier draft of this cancelled every row on the
   * bill, which on a long-stay patient is fifteen real consultancies - a cleanup one failed
   * assertion away from unpicking a month of somebody's treatment. Nothing that was already
   * on the bill can be reached from here: a row is only cancelled when the baseline cannot
   * account for it.
   *
   * Called in a finally, so it never throws: a cleanup that failed would replace the case's
   * own failure with its own and hide what actually went wrong. What it could not take off
   * is left on the bill and reported by the case's annotation.
   */
  async cancelSince(baseline: ServedLine[], reason = 'Entered by mistake'): Promise<number> {
    let cancelled = 0;

    for (let guard = 0; guard < 20; guard++) {
      const current = await this.bill().catch(() => [] as ServedLine[]);
      const added = ConsultancyServicePage.newRows(current, baseline);
      if (added.length === 0) break;

      const went = await this.cancelBillLine(added[added.length - 1], reason)
        .then(() => true)
        .catch(() => false);
      if (!went) break;
      cancelled++;
    }
    return cancelled;
  }

  /** How much room is left on the bill grid before it stops listing rows. */
  async billRoom(): Promise<number> {
    return ConsultancyServicePage.BILL_ROW_CAP - (await this.billRows.count());
  }

  /**
   * The first patient from `startIndex` whose bill has room for `room` more rows, or
   * undefined if none of the next `span` beds has.
   *
   * What every writing case picks its patient with. A service saved against a patient
   * already on fifteen is invisible on this tab afterwards - see BILL_ROW_CAP - so a case
   * that wrote to one could neither check its own work nor take it off again.
   */
  async patientBelowBillCap(
    startIndex = 0,
    room = 1,
    span = 12
  ): Promise<ConsultancyWardPatient | undefined> {
    for (let offset = 0; offset < span; offset++) {
      const ward = await this.wardPatient(startIndex + offset);
      await this.selectPatient(ward.admissionNo);
      if ((await this.billRoom()) >= room) return ward;
    }
    return undefined;
  }

  /** Asserts Consultancy Service is the pane on screen, with its form and both grids. */
  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(this.path, 'i'));
    await expect(this.tab(ConsultancyServicePage.TAB)).toHaveClass(/active/);
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
