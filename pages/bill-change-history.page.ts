import { Page, Locator, expect } from '@playwright/test';
import { HospitalScreenPage, hospitalItem } from './hospital-menu.page';

/** One row of the patient picker: a bill, and how many of its services were touched. */
export interface BillChangeRow {
  billNo: string;
  patient: string;
  uhid: string;
  /** "Admitted" or "Discharged". */
  status: string;
  admitted: string;
  discharged: string;
  /** As printed, e.g. "1 cancelled, 1 edited". */
  changes: string;
}

/**
 * IPD Bill Change History at /hospital/ipd-bill-change-history - the audit trail for
 * services cancelled or edited off an inpatient bill.
 *
 * Its own page object because it is not the shape anything else in the module is, and the
 * shape is easy to get wrong: there is no report grid on the page. The screen is three
 * filters and a sentence - "Select a patient to see every service that was cancelled or
 * edited on the bill, with the reason, who did it and when" - and the detail appears only
 * once a patient is chosen.
 *
 * The seven-column grid that looks like the report is inside the PATIENT lookup's dropdown
 * panel, which is `display:none` until the lookup is opened. A suite that went for
 * "the first table on the page" found it, read its headers happily, and asserted that this
 * screen reports under columns it does not have. That is what this page object exists to
 * prevent - `picker` is the lookup, and nothing here pretends it is the report.
 *
 * Read-only. It is an audit trail; there is nothing on it to write, and Print is left
 * alone because it renders a document per patient.
 */
export class BillChangeHistoryPage extends HospitalScreenPage {
  /** The picker's columns, in order. These describe the bill, not the changes. */
  static readonly PICKER_COLUMNS = [
    'Bill No',
    'Patient',
    'UHID',
    'Status',
    'Admitted',
    'Discharged',
    'Changes',
  ] as const;

  /** What the PATIENT STATUS filter offers, in order. */
  static readonly STATUSES = ['Admitted & Discharged', 'Admitted', 'Discharged'] as const;

  /** The patient picker, and the panel it opens. */
  readonly picker: Locator;
  readonly pickerPanel: Locator;

  /** PATIENT STATUS - which admissions the picker lists. */
  readonly status: Locator;
  /** "Only patients with cancelled / edited services". */
  readonly changedOnly: Locator;
  readonly print: Locator;
  /** The sentence the screen shows in place of a report until a patient is picked. */
  readonly instruction: Locator;

  constructor(page: Page) {
    super(page, hospitalItem('IPD Bill Change History'));

    this.picker = page.locator('.bch-field--patient .rz-dropdown').first();
    // Portaled to the body on open, like every other Radzen lookup in this ERP.
    this.pickerPanel = page.locator('.rz-dropdown-panel:visible').first();

    this.status = page.locator('select').first();
    this.changedOnly = page.locator('input[type="checkbox"]').first();
    // Visible-only, and by text rather than by role: the screen keeps two more "Print"
    // buttons in a closed dialog, and the one on the toolbar arrives a moment after the
    // filters do.
    this.print = page
      .locator('button:visible')
      .filter({ hasText: /^\s*Print\s*$/ })
      .first();
    this.instruction = page.getByText(/select a patient to see every service/i);
  }

  /** Opens the screen and waits for its filters. */
  async openHistory(): Promise<void> {
    await this.open();
    await this.expectLoaded();
    await expect(this.picker, 'the change history rendered no patient picker').toBeVisible({
      timeout: 60_000,
    });
  }

  /** Opens the patient picker and waits for its rows. */
  async openPicker(): Promise<void> {
    if (await this.pickerPanel.isVisible().catch(() => false)) return;
    await this.picker.click();
    await expect(this.pickerPanel, 'the patient picker never opened').toBeVisible({
      timeout: 30_000,
    });
    await expect(this.pickerRows.first(), 'the patient picker listed no bills').toBeVisible({
      timeout: 60_000,
    });
  }

  get pickerHeaders(): Locator {
    return this.pickerPanel.locator('.rz-column-title');
  }

  get pickerRows(): Locator {
    return this.pickerPanel.locator('.rz-data-grid table tbody tr');
  }

  /** The picker rows that are bills, not Radzen's empty-state row. */
  get pickerResults(): Locator {
    return this.pickerRows.filter({ hasNot: this.page.locator('td.rz-datatable-emptymessage') });
  }

  /** One picker row read back. */
  async readRow(row: Locator): Promise<BillChangeRow> {
    const cells = (await row.locator('td').allInnerTexts()).map((text) =>
      text.replace(/\s+/g, ' ').trim()
    );
    const [billNo = '', patient = '', uhid = '', status = '', admitted = '', discharged = '', changes = ''] =
      cells;
    return { billNo, patient, uhid, status, admitted, discharged, changes };
  }

  /** Every bill the picker is currently listing. */
  async bills(): Promise<BillChangeRow[]> {
    await this.openPicker();
    const rows: BillChangeRow[] = [];
    for (const row of await this.pickerResults.all()) rows.push(await this.readRow(row));
    return rows;
  }

  /** Picks the bill at `index` and waits for the screen to answer with its services. */
  async selectBill(index = 0): Promise<BillChangeRow> {
    await this.openPicker();
    const row = this.pickerResults.nth(index);
    const bill = await this.readRow(row);
    await row.click();

    // The instruction is what the screen shows *instead* of the detail, so its going away
    // is the detail arriving - and it is the one signal that works whether the bill's
    // services land in a table, a list or a card.
    await expect(this.instruction, `${bill.billNo} never loaded`).toBeHidden({ timeout: 60_000 });
    return bill;
  }

  /**
   * Narrows the picker to `term`. Typed, not filled - Radzen ignores a scripted value.
   *
   * The box is matched on the start of its placeholder, not the whole of it: this picker's
   * reads "Search patient name, bill no or UHID..." where every other lookup in the module
   * just says "Search...". That placeholder is also the screen telling you what it will
   * match, which is what HOSP-BCH-005 checks it actually does.
   */
  async searchPicker(term: string): Promise<void> {
    await this.openPicker();
    const box = this.pickerPanel.locator('input[placeholder^="Search"]').first();
    await box.click();
    await box.press('ControlOrMeta+a');
    await box.press('Backspace');
    await this.settlePicker();
    if (term !== '') {
      await box.pressSequentially(term, { delay: 60 });
      await this.settlePicker();
    }
  }

  /** Waits for the picker to stop changing: two identical reads in a row. */
  async settlePicker(timeout = 20_000): Promise<void> {
    const deadline = Date.now() + timeout;
    // Not '' - that is what an empty picker reads back as, and a settle starting there
    // would return on its first look.
    let previous = '<<unread>>';
    for (;;) {
      await this.page.waitForTimeout(500);
      const current = (await this.pickerRows.allInnerTexts().catch(() => [])).join('|');
      if (current === previous) return;
      previous = current;
      if (Date.now() >= deadline) return;
    }
  }
}
