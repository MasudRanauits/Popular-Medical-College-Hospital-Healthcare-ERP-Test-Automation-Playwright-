import { Page, Locator, expect } from '@playwright/test';
import { HospitalScreenPage, HospitalMenuItem } from './hospital-menu.page';

/** One row of the admission lookup, as its four columns print it. */
export interface AdmissionRow {
  /** The admission number. The grid heads this column "InvoiceNo"; it is not an invoice. */
  invoiceNo: string;
  /** The bed, e.g. "ICU-07". */
  cabinNo: string;
  fullName: string;
  mobile: string;
}

/** The read-only panel the screen fills in once an admission is picked. */
export interface PatientPanel {
  invoiceNo: string;
  fullName: string;
  mobile: string;
  /** As the ERP formats it, e.g. "51Y 0M 0D". */
  age: string;
  sex: string;
  assignedDoctor: string;
  refDoctor: string;
  cabinNo: string;
  department: string;
}

/**
 * The admission-driven screens of the Hospital module - Admission Cancel, Advance
 * Collection, Advance Return, Visitor Pass, Extra Cabins, Manual Cabin Day, IPD Service
 * Dashboard and the rest.
 *
 * A dozen screens share one layout, so they share one page object. Each is a single
 * admission lookup over a read-only patient panel, with whatever that screen does to the
 * admission underneath.
 *
 * How the lookup actually works, which is not what it looks like
 * -------------------------------------------------------------
 * The "Admission No" control looks like a dropdown and is a Radzen lookup: clicking it
 * opens a floating panel holding a search box and a four-column datagrid of every current
 * admission - InvoiceNo, CabinNo, FullName, Mobile - ten to a page behind a Radzen pager.
 * Picking a row closes the panel and fills the patient panel underneath.
 *
 * That grid lives in a `rz-dropdown-panel` that is `display:none` until the lookup is
 * opened, and its rows are in the DOM the whole time. A test that goes straight for
 * `.rz-data-grid tbody tr` therefore finds ten rows, reads them happily, and then times out
 * clicking one with "element is not visible" - every row has a zero-size box. Everything
 * here goes through `openLookup` first for that reason.
 *
 * The patient panel is nine disabled inputs named `SelectedPatient.*`. Disabled in the
 * markup, so there is no typing a patient into one of these screens, by a clerk or by a
 * test; picking a row out of the lookup is the only thing that fills them.
 *
 * Read-only, all of it. These screens cancel admissions, take advance payments and allot
 * beds on the hospital's live system. Nothing here submits: the cases check that the screen
 * loads what it is asked to load and that its action button is gated on an admission being
 * picked, and they stop there.
 */
export class HospitalPatientScreenPage extends HospitalScreenPage {
  /** The lookup grid's columns, in order. The same four on every screen in this family. */
  static readonly LOOKUP_COLUMNS = ['InvoiceNo', 'CabinNo', 'FullName', 'Mobile'] as const;

  /** The patient panel's fields, by the `SelectedPatient.` suffix each input is named with. */
  static readonly PANEL_FIELDS = {
    invoiceNo: 'InvoiceNo',
    fullName: 'FullName',
    mobile: 'MobileNo',
    age: 'Age',
    sex: 'Sex',
    assignedDoctor: 'AssignedDoctorName',
    refDoctor: 'RefDoctorName',
    cabinNo: 'CabinNo',
    department: 'DeptName',
  } as const;

  /** What the admission lookup's own field group is labelled, across the family. */
  static readonly LOOKUP_LABEL = /^\s*(Admission No|Invoice No|Adm\.No)\s*$/;

  /**
   * The closed admission lookup, as it sits on the form.
   *
   * Anchored on its label, and scoped to what is on screen.
   *
   * Visible-only because two screens render the control more than once - Discharged
   * Patients All Service carries one per tab - and the copies on the inactive tabs are
   * still in the DOM. Taking the first match regardless opens a lookup belonging to a tab
   * nobody is looking at, which answers with an empty list.
   *
   * Not by position: Extra Cabin Allot/Cancel carries four Radzen dropdowns and Manual
   * Cabin Charge two, so "the first one" is only right by luck. And not by what is inside
   * it either, tempting as that is - the admission lookup is the one whose panel holds a
   * datagrid, but *only until a patient is picked*. Radzen tears the grid out of the DOM on
   * selection, so `.rz-dropdown:has(.rz-data-grid)` stops matching the admission lookup the
   * moment it has been used, and on Extra Cabin it then matches the Extra Cabin1 bed
   * lookup instead. A case that picked a second patient would have been reaching into a
   * bed list and reading beds as admissions.
   */
  readonly lookup: Locator;
  /**
   * The floating panel it opens.
   *
   * Matched at page level, and it has to be: the panel sits inside its dropdown while it is
   * closed and is moved out to the end of the body when it opens, so a locator scoped to
   * the lookup resolves to nothing exactly when the panel is wanted. Only one lookup is
   * ever open at a time, so `:visible` is unambiguous.
   */
  readonly lookupPanel: Locator;

  constructor(page: Page, item: HospitalMenuItem) {
    super(page, item);
    this.lookup = page
      .locator('div.form-group:visible')
      .filter({
        has: page.locator('label', { hasText: HospitalPatientScreenPage.LOOKUP_LABEL }),
      })
      .locator('.rz-dropdown')
      .first();
    this.lookupPanel = page.locator('.rz-dropdown-panel:visible').first();
  }

  /**
   * One field of the read-only patient panel, e.g. field('FullName').
   *
   * Matched on the end of the name, not the whole of it. The family is split down the
   * middle on how it names these: Admission Cancel, Extra Cabin and Manual Cabin Day bind
   * `SelectedPatient.FullName`, while Advance Collection, Advance Return and Visitor Pass
   * bind `_SelectedPatient.FullName`, underscore and all. The two are the same field, and a
   * suffix match is what lets one page object drive both halves.
   */
  field(name: string): Locator {
    return this.page.locator(`input[name$="SelectedPatient.${name}"]`).first();
  }

  /** Whether this screen renders `field` at all - the panel varies across the family. */
  async hasField(name: string): Promise<boolean> {
    return (await this.page.locator(`input[name$="SelectedPatient.${name}"]`).count()) > 0;
  }

  /** The screen's own action button - "Cancel", "Save", "Free". Gated on a patient. */
  action(name: string | RegExp): Locator {
    const pattern = typeof name === 'string' ? new RegExp(`^${name}$`, 'i') : name;
    return this.page.getByRole('button', { name: pattern }).first();
  }

  /** Opens the screen and waits for the lookup to be on the form. */
  async openScreen(): Promise<void> {
    await this.open();
    await this.expectLoaded();
    await expect(this.lookup, `${this.item.label} rendered no admission lookup`).toBeVisible({
      timeout: 60_000,
    });
  }

  /** Opens the admission lookup and waits for its grid to be on screen and clickable. */
  async openLookup(): Promise<void> {
    if (await this.lookupPanel.isVisible().catch(() => false)) return;
    await this.lookup.click();
    await expect(this.lookupPanel, 'the admission lookup never opened').toBeVisible({
      timeout: 30_000,
    });
    await expect(this.lookupRows.first(), 'the admission lookup listed nobody').toBeVisible({
      timeout: 60_000,
    });

    // Headers can lag the rows by a beat, and every row here is read by column name -
    // so a read taken before they arrive maps every field to ''. Cost a run to find.
    await expect(
      this.lookupHeaders.first(),
      'the lookup rendered rows but no column headers'
    ).toBeAttached({ timeout: 30_000 });

    /**
     * And then wait for it to stop loading, which is not the same as waiting for it to
     * stop changing.
     *
     * Radzen paints the grid's empty-state row first and fills it a moment later. A plain
     * settle - two identical reads half a second apart - is therefore satisfied by a
     * lookup that is still fetching, and hands the caller an empty ward. That is what it
     * did: the probe that waited a fixed six seconds saw ten admissions where the suite
     * saw none, twice in a row.
     *
     * So give the rows a chance to arrive first. A lookup that is genuinely empty - the
     * four filtered ones - costs this wait once and then carries on.
     */
    await expect
      .poll(() => this.lookupResults.count(), { timeout: 15_000, intervals: [500] })
      .toBeGreaterThan(0)
      .catch(() => {});
    await this.settleLookup();
  }

  /** The lookup's own search box. Present only while the panel is open. */
  get lookupSearch(): Locator {
    return this.lookupPanel.locator('input[placeholder="Search..."]').first();
  }

  get lookupHeaders(): Locator {
    return this.lookupPanel.locator('.rz-data-grid thead th .rz-column-title');
  }

  /**
   * The rows of the lookup grid, including the one Radzen puts there when nothing matched.
   *
   * `lookupResults` is what a case about searching wants; this is here because a count of
   * "1" means something quite different depending on which of the two it is.
   */
  get lookupRows(): Locator {
    return this.lookupPanel.locator('.rz-data-grid table tbody tr');
  }

  /**
   * The admissions the lookup is showing - the rows above, minus the empty-state row.
   *
   * Radzen renders "no matches" as a row holding one `td.rz-datatable-emptymessage`, and in
   * this build that cell is *empty*: no "no records found", no message of any kind. So a
   * search that matches nothing looks, to a clerk and to a naive locator alike, like a grid
   * with one blank admission in it.
   */
  get lookupResults(): Locator {
    return this.lookupRows.filter({ hasNot: this.page.locator('td.rz-datatable-emptymessage') });
  }

  /** Whether the lookup is showing its (blank) empty state. */
  async lookupIsEmpty(): Promise<boolean> {
    return (await this.lookupPanel.locator('td.rz-datatable-emptymessage').count()) > 0;
  }

  /** The lookup's pager buttons: 1, 2, ... */
  get lookupPages(): Locator {
    return this.lookupPanel.locator('.rz-paginator-page');
  }

  /** The lookup's column titles, in the order this screen prints them. */
  async columns(): Promise<string[]> {
    return (await this.lookupHeaders.allInnerTexts()).map((text) => text.trim());
  }

  /**
   * One lookup row read back as its columns.
   *
   * By header name, never by position. The screens in this family do not agree on the
   * order or even the set: most print InvoiceNo, CabinNo, FullName, Mobile, and IPD Due
   * Collection drops CabinNo entirely. A positional read on that screen returns the mobile
   * number as the patient's name, which is precisely the sort of mistake that then gets
   * asserted and goes unnoticed.
   *
   * A column the screen does not print comes back as ''.
   */
  async readRow(row: Locator): Promise<AdmissionRow> {
    const [columns, cells] = await Promise.all([
      this.columns(),
      row.locator('td').allInnerTexts().then((texts) =>
        texts.map((text) => text.replace(/\s+/g, ' ').trim())
      ),
    ]);
    const at = (column: string) => {
      const index = columns.findIndex((header) => header.toLowerCase() === column.toLowerCase());
      return index >= 0 ? cells[index] ?? '' : '';
    };
    return {
      invoiceNo: at('InvoiceNo'),
      cabinNo: at('CabinNo'),
      fullName: at('FullName'),
      mobile: at('Mobile'),
    };
  }

  /** The admission at `index` of the open lookup, without picking it. */
  async admissionAt(index = 0): Promise<AdmissionRow> {
    await this.openLookup();
    return this.readRow(this.lookupRows.nth(index));
  }

  /**
   * Narrows the lookup to `term` and waits for the grid to answer.
   *
   * Typed a character at a time, not filled. This one cost a run: `fill()` sets the value
   * and raises one `input`, and the lookup ignores it completely - the grid sits there with
   * all ten admissions on screen and the term in the box, looking exactly like a filter that
   * matched everything. Radzen's filter is driven off the key events, so the term has to be
   * typed for the lookup to see it at all. The clear is typed out for the same reason.
   *
   * Then a settle, because the filtering is a round trip over the circuit with the previous
   * rows still on screen and no spinner over them.
   */
  async searchLookup(term: string): Promise<void> {
    await this.openLookup();
    await this.lookupSearch.click();
    await this.lookupSearch.press('ControlOrMeta+a');
    await this.lookupSearch.press('Backspace');
    await this.settleLookup();
    if (term !== '') {
      await this.lookupSearch.pressSequentially(term, { delay: 60 });
      await this.settleLookup();
    }
  }

  /** Waits for the lookup grid to stop changing: two identical reads in a row. */
  async settleLookup(timeout = 20_000): Promise<void> {
    const deadline = Date.now() + timeout;
    // Not '' - an empty string is what an empty grid reads back as, so a settle starting
    // there would return on its first look and wait for nothing at all.
    let previous = '<<unread>>';
    for (;;) {
      await this.page.waitForTimeout(500);
      const current = (await this.lookupRows.allInnerTexts().catch(() => [])).join('|');
      if (current === previous) return;
      previous = current;
      if (Date.now() >= deadline) return;
    }
  }

  /**
   * Picks the admission at `index` and returns the panel the screen filled in.
   *
   * Waited on by admission number rather than on the Name box having something in it: the
   * panel keeps the previous patient until the new one arrives, so "not empty" is already
   * true and would hand the caller the patient before.
   */
  async selectAdmission(index = 0): Promise<PatientPanel> {
    await this.openLookup();
    const row = this.lookupRows.nth(index);
    const admission = await this.readRow(row);
    await row.click();

    // Manual Cabin Charge is the exception: its panel has no admission-number box at all, so
    // there the name is the only thing that can be waited for. It is weaker - two patients
    // on a ward can share a name - but it is what that screen renders.
    const { invoiceNo, fullName } = HospitalPatientScreenPage.PANEL_FIELDS;
    const [field, value] = (await this.hasField(invoiceNo))
      ? [this.field(invoiceNo), admission.invoiceNo]
      : [this.field(fullName), admission.fullName];

    await expect(
      field,
      `${admission.invoiceNo} never loaded into the ${this.item.label} form`
    ).toHaveValue(value, { timeout: 30_000 });

    return this.panel();
  }

  /** The patient panel read back whole. */
  async panel(): Promise<PatientPanel> {
    const entries = Object.entries(HospitalPatientScreenPage.PANEL_FIELDS);
    const values = await Promise.all(
      entries.map(([, name]) => this.field(name).inputValue().catch(() => ''))
    );
    return Object.fromEntries(
      entries.map(([key], index) => [key, values[index].trim()])
    ) as unknown as PatientPanel;
  }
}
