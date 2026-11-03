import { Page, Locator, expect } from '@playwright/test';
import { HospitalScreenPage, HospitalMenuItem } from './hospital-menu.page';

/** One row of the UHID lookup, as its seven columns print it. */
export interface UhidLookupRow {
  uhid: string;
  fullName: string;
  gender: string;
  bloodGroup: string;
  cabinType: string;
  cabinNo: string;
  department: string;
}

/**
 * The billing department's own service-entry screens - IPD Service Entry (Billing Dept)
 * and Consultant Service Entry (Billing Dept).
 *
 * The module's fourth patient picker, and the only one keyed on the UHID rather than the
 * admission number. Seven columns - UHID, Full Name, Gender, Blood Group, Cabin Type,
 * Cabin No, Department - against the admission lookup's four and the ward lookup's three,
 * and a fourth field-naming convention underneath: `SelectedPatientInfo.*`, where the rest
 * of the module uses `SelectedPatient.`, `_SelectedPatient.` or `SelectedIPDPatientInfo.`.
 *
 * Which is why these two screens are not driven by HospitalPatientScreenPage even though
 * they carry a control labelled "Admission No" exactly like the screens that are. The label
 * is the same and nothing behind it is - a suite that trusted the label read a gender out
 * of the column where it expected a patient's name.
 *
 * The two screens differ only in spelling: one grid heads its columns "Full Name",
 * "Cabin No", "Department" and the other "FullName", "CabinNo", "DeptName". `readRow`
 * accepts either, which is the whole reason it works by header name.
 *
 * Read-only. Save on either screen puts a charge on a patient's bill.
 */
export class HospitalUhidScreenPage extends HospitalScreenPage {
  /** What the lookup's field group is labelled - the same two labels as elsewhere. */
  static readonly LOOKUP_LABEL = /^\s*(Admission No|Adm\.No)\s*$/;

  /** The columns, by the two spellings the two screens use for each. */
  static readonly COLUMN_ALIASES: Record<keyof UhidLookupRow, string[]> = {
    uhid: ['UHID'],
    fullName: ['Full Name', 'FullName'],
    gender: ['Gender'],
    bloodGroup: ['Blood Group', 'BloodGroup'],
    cabinType: ['Cabin Type', 'CabinType'],
    cabinNo: ['Cabin No', 'CabinNo'],
    department: ['Department', 'DeptName'],
  };

  readonly lookup: Locator;
  readonly lookupPanel: Locator;

  constructor(page: Page, item: HospitalMenuItem) {
    super(page, item);
    this.lookup = page
      .locator('div.form-group:visible')
      .filter({ has: page.locator('label', { hasText: HospitalUhidScreenPage.LOOKUP_LABEL }) })
      .locator('.rz-dropdown')
      .first();
    this.lookupPanel = page.locator('.rz-dropdown-panel:visible').first();
  }

  /** One field of the read-only patient panel, e.g. field('FullName'). */
  field(name: string): Locator {
    return this.page.locator(`input[name$="SelectedPatientInfo.${name}"]`).first();
  }

  /** The screen's action button. */
  action(name: string | RegExp): Locator {
    const pattern = typeof name === 'string' ? new RegExp(`^${name}$`, 'i') : name;
    return this.page.getByRole('button', { name: pattern }).first();
  }

  async openScreen(): Promise<void> {
    await this.open();
    await this.expectLoaded();
    await expect(this.lookup, `${this.item.label} rendered no patient lookup`).toBeVisible({
      timeout: 60_000,
    });
  }

  async openLookup(): Promise<void> {
    if (await this.lookupPanel.isVisible().catch(() => false)) return;
    await this.lookup.click();
    await expect(this.lookupPanel, 'the patient lookup never opened').toBeVisible({
      timeout: 30_000,
    });
    await expect(this.lookupRows.first(), 'the patient lookup listed nobody').toBeVisible({
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

  get lookupHeaders(): Locator {
    return this.lookupPanel.locator('.rz-data-grid thead th .rz-column-title');
  }

  get lookupRows(): Locator {
    return this.lookupPanel.locator('.rz-data-grid table tbody tr');
  }

  get lookupResults(): Locator {
    return this.lookupRows.filter({ hasNot: this.page.locator('td.rz-datatable-emptymessage') });
  }

  async columns(): Promise<string[]> {
    return (await this.lookupHeaders.allInnerTexts()).map((text) => text.trim());
  }

  /** Waits for the lookup grid to stop changing: two identical reads in a row. */
  async settleLookup(timeout = 20_000): Promise<void> {
    const deadline = Date.now() + timeout;
    // Not '' - that is what an empty grid reads back as, and a settle starting there would
    // return on its first look and wait for nothing at all.
    let previous = '<<unread>>';
    for (;;) {
      await this.page.waitForTimeout(500);
      const current = (await this.lookupRows.allInnerTexts().catch(() => [])).join('|');
      if (current === previous) return;
      previous = current;
      if (Date.now() >= deadline) return;
    }
  }

  /** One lookup row read back, by header name and across both screens' spellings. */
  async readRow(row: Locator): Promise<UhidLookupRow> {
    const [columns, cells] = await Promise.all([
      this.columns(),
      row.locator('td').allInnerTexts().then((texts) =>
        texts.map((text) => text.replace(/\s+/g, ' ').trim())
      ),
    ]);
    const at = (key: keyof UhidLookupRow) => {
      const aliases = HospitalUhidScreenPage.COLUMN_ALIASES[key].map((name) => name.toLowerCase());
      const index = columns.findIndex((header) => aliases.includes(header.toLowerCase()));
      return index >= 0 ? cells[index] ?? '' : '';
    };
    return {
      uhid: at('uhid'),
      fullName: at('fullName'),
      gender: at('gender'),
      bloodGroup: at('bloodGroup'),
      cabinType: at('cabinType'),
      cabinNo: at('cabinNo'),
      department: at('department'),
    };
  }

  /** The patient at `index` of the open lookup, without picking them. */
  async patientAt(index = 0): Promise<UhidLookupRow> {
    await this.openLookup();
    return this.readRow(this.lookupResults.nth(index));
  }

  /** Picks the patient at `index` and waits for the form to fill with them. */
  async selectPatient(index = 0): Promise<UhidLookupRow> {
    await this.openLookup();
    const row = this.lookupResults.nth(index);
    const patient = await this.readRow(row);
    await row.click();

    await expect(
      this.field('FullName'),
      `${patient.fullName} never loaded into the ${this.item.label} form`
    ).toHaveValue(patient.fullName, { timeout: 30_000 });

    return patient;
  }
}
