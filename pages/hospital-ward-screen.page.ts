import { Page, Locator, expect } from '@playwright/test';
import { HospitalScreenPage, HospitalMenuItem } from './hospital-menu.page';

/** One row of the ward lookup, as its three columns print it. */
export interface WardLookupRow {
  /** The bed, e.g. "ICU-07". First column here, unlike the admission lookup. */
  cabinNo: string;
  fullName: string;
  /** The admission number. Headed "InvoiceNo"; it is not an invoice. */
  invoiceNo: string;
}

/** The read-only panel a ward screen fills in once a patient is picked. */
export interface WardPatientPanel {
  fullName: string;
  assignedDoctor: string;
  refDoctor: string;
  cabinNo: string;
}

/**
 * The ward-picker screens of the Hospital module - Bed/Cabin Transfer, Inter-Department
 * Transfer, Package Transfer, Package Management, IPD Medicine Return, OT Service Entry,
 * OT Service Entry (Billing Dept) and OT Info (NS).
 *
 * Eight screens built the same way: a "Search Patient" lookup over a read-only panel, with
 * whatever that screen does to the patient underneath - move their bed, change their
 * package, return their medicine, record their operation.
 *
 * The second patient picker in one module
 * ---------------------------------------
 * This is not the lookup HospitalPatientScreenPage drives, and the difference is worth
 * knowing before reading either suite. Both are Radzen lookups over the admitted-patient
 * list. Beyond that they agree on very little:
 *
 *                      admission lookup              ward lookup (here)
 *   labelled           "Admission No" / "Invoice No" "Search Patient"
 *   columns            InvoiceNo, CabinNo,           CabinNo, FullName,
 *                      FullName, Mobile              InvoiceNo
 *   rows per page      ten                           five
 *   searches           name and bed only             name, bed *and* admission number
 *   panel fields       disabled                      readonly
 *   field prefix       SelectedPatient. or           _SelectedPatient. or
 *                      _SelectedPatient.             SelectedIPDPatientInfo.
 *
 * The search difference is the one that matters to a user: the admission number a clerk
 * reads off the wristband finds the patient here and finds nothing on Admission Cancel.
 * HOSP-PAT-013 is that defect; HOSP-WARD-012 below is the same search working, and the pair
 * is what shows it is a bug rather than a design.
 *
 * Three field-name conventions across eight screens, for the same four boxes - see
 * `patientField`. Nothing in the markup says which a given screen uses.
 *
 * Read-only, all of it. These screens move beds, bill operations and change package
 * assignments on the hospital's live system. Nothing here submits.
 */
export class HospitalWardScreenPage extends HospitalScreenPage {
  /**
   * The three columns the lookup carries - as a set, because the order is not agreed.
   *
   * Seven of the eight screens print CabinNo, FullName, InvoiceNo. IPD Medicine Return
   * prints InvoiceNo, CabinNo, FullName. Same component, same data, same three columns,
   * different order - which is why `readRow` below reads by header name and never by
   * position. A first draft that assumed the common order read Medicine Return's beds as
   * patient names and waited for a patient called "S.Care-01".
   */
  static readonly LOOKUP_COLUMNS = ['CabinNo', 'FullName', 'InvoiceNo'] as const;

  /** What the lookup's own field group is labelled on every screen in this family. */
  static readonly LOOKUP_LABEL = /^\s*Search Patient\s*$/;

  /** How many patients the lookup lists per page. The pager under it reaches the rest. */
  static readonly LOOKUP_PAGE_SIZE = 5;

  /** The panel's fields, by the suffix each input's name ends with. */
  static readonly PANEL_FIELDS = {
    fullName: 'FullName',
    assignedDoctor: 'AssignedDoctorName',
    refDoctor: 'RefDoctorName',
    cabinNo: 'CabinNo',
  } as const;

  readonly lookup: Locator;
  /** Portaled to the end of the body when open - see HospitalPatientScreenPage for why. */
  readonly lookupPanel: Locator;

  constructor(page: Page, item: HospitalMenuItem) {
    super(page, item);
    this.lookup = page
      .locator('div.form-group:visible')
      .filter({ has: page.locator('label', { hasText: HospitalWardScreenPage.LOOKUP_LABEL }) })
      .locator('.rz-dropdown')
      .first();
    this.lookupPanel = page.locator('.rz-dropdown-panel:visible').first();
  }

  /**
   * One field of the read-only patient panel, e.g. patientField('FullName').
   *
   * Matched across all three naming conventions this family uses for the same box:
   * `_SelectedPatient.FullName` on the four transfer screens, `SelectedPatient.FullName` on
   * Medicine Return, `SelectedIPDPatientInfo.FullName` on the three OT screens.
   */
  patientField(name: string): Locator {
    return this.page.locator(HospitalWardScreenPage.fieldSelector(name)).first();
  }

  /**
   * Every spelling of one panel field across this family.
   *
   * `_SelectedPatient.X` on the four transfer screens, `SelectedPatient.X` on Medicine
   * Return, `SelectedIPDPatientInfo.X` on the three OT screens - and, for the bed box on
   * the two transfer screens, `_SelectedCabin.CabinNo`, because there the patient's current
   * bed is also the "From Cabin" of the transfer. Same box on screen either way.
   */
  private static fieldSelector(name: string): string {
    return [
      `input[name$="SelectedPatient.${name}"]`,
      `input[name$="SelectedIPDPatientInfo.${name}"]`,
      `input[name$="SelectedCabin.${name}"]`,
    ].join(', ');
  }

  /** Whether this screen renders `name` at all - the panel varies across the family. */
  async hasPatientField(name: string): Promise<boolean> {
    return (await this.page.locator(HospitalWardScreenPage.fieldSelector(name)).count()) > 0;
  }

  /** The screen's own action button - "Save", "Add Package", "Exchange". */
  action(name: string | RegExp): Locator {
    const pattern = typeof name === 'string' ? new RegExp(`^${name}$`, 'i') : name;
    return this.page.getByRole('button', { name: pattern }).first();
  }

  /** Opens the screen and waits for the lookup to be on the form. */
  async openScreen(): Promise<void> {
    await this.open();
    await this.expectLoaded();
    await expect(this.lookup, `${this.item.label} rendered no Search Patient lookup`).toBeVisible({
      timeout: 60_000,
    });
  }

  /** Opens the lookup and waits for its grid to be on screen and clickable. */
  async openLookup(): Promise<void> {
    if (await this.lookupPanel.isVisible().catch(() => false)) return;
    await this.lookup.click();
    await expect(this.lookupPanel, 'the Search Patient lookup never opened').toBeVisible({
      timeout: 30_000,
    });
    await expect(this.lookupRows.first(), 'the ward lookup listed nobody').toBeVisible({
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

  get lookupSearch(): Locator {
    return this.lookupPanel.locator('input[placeholder="Search..."]').first();
  }

  get lookupHeaders(): Locator {
    return this.lookupPanel.locator('.rz-data-grid thead th .rz-column-title');
  }

  /** Every row of the lookup grid, the empty-state row included. */
  get lookupRows(): Locator {
    return this.lookupPanel.locator('.rz-data-grid table tbody tr');
  }

  /** The patients the lookup is showing - the rows above, minus Radzen's empty-state row. */
  get lookupResults(): Locator {
    return this.lookupRows.filter({ hasNot: this.page.locator('td.rz-datatable-emptymessage') });
  }

  /** Whether the lookup is showing its (blank) empty state. */
  async lookupIsEmpty(): Promise<boolean> {
    return (await this.lookupPanel.locator('td.rz-datatable-emptymessage').count()) > 0;
  }

  /** The lookup's column titles, in the order this screen prints them. */
  async columns(): Promise<string[]> {
    return (await this.lookupHeaders.allInnerTexts()).map((text) => text.trim());
  }

  /**
   * One lookup row read back as its three columns.
   *
   * By header name rather than by position - see LOOKUP_COLUMNS for the screen that makes
   * that necessary.
   */
  async readRow(row: Locator): Promise<WardLookupRow> {
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
    return { cabinNo: at('CabinNo'), fullName: at('FullName'), invoiceNo: at('InvoiceNo') };
  }

  /** The patient at `index` of the open lookup, without picking them. */
  async patientAt(index = 0): Promise<WardLookupRow> {
    await this.openLookup();
    return this.readRow(this.lookupResults.nth(index));
  }

  /**
   * Narrows the lookup to `term` and waits for the grid to answer.
   *
   * Typed rather than filled, for the reason HospitalPatientScreenPage.searchLookup gives:
   * Radzen's filter runs off the key events and ignores a value set by `fill()` entirely,
   * leaving the whole ward on screen under a term that matched it.
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
   * Picks the patient at `index` and returns the panel the screen filled in.
   *
   * Waited on by name, because the name box is the only field all eight screens render -
   * three of them have no bed box and none has an admission-number box.
   */
  async selectPatient(index = 0): Promise<WardPatientPanel> {
    await this.openLookup();
    const row = this.lookupResults.nth(index);
    const patient = await this.readRow(row);
    await row.click();

    await expect(
      this.patientField(HospitalWardScreenPage.PANEL_FIELDS.fullName),
      `${patient.fullName} never loaded into the ${this.item.label} form`
    ).toHaveValue(patient.fullName, { timeout: 30_000 });

    return this.panel();
  }

  /** The patient panel read back whole. Fields this screen does not render come back ''. */
  async panel(): Promise<WardPatientPanel> {
    const entries = Object.entries(HospitalWardScreenPage.PANEL_FIELDS);
    const values = await Promise.all(
      entries.map(([, name]) => this.patientField(name).inputValue().catch(() => ''))
    );
    return Object.fromEntries(
      entries.map(([key], index) => [key, values[index].trim()])
    ) as unknown as WardPatientPanel;
  }
}
