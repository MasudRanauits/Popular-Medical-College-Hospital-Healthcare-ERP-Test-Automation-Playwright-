import { Page, Locator, expect } from '@playwright/test';
import { HospitalScreenPage, HospitalMenuItem } from './hospital-menu.page';

/**
 * The discharged-bill correction screens - Edit Discharged IPD Services, Edit Discharged
 * Consultant Services, Edit Discharged OT Services, Edit Bed and Cabins (Discharged) and
 * Edit Food and Beverage (Discharged).
 *
 * Five screens for going back into a bill after the patient has gone home and taking
 * something off it. They are the most consequential read-only subject in this project: a
 * Save here changes what a discharged patient was charged.
 *
 * How a patient is loaded, and why it is not a lookup
 * --------------------------------------------------
 * There is no picker on these screens. There is a bare numeric box, and the clerk types an
 * invoice number into it. Nothing lists the discharged patients, nothing validates the
 * number as it is typed, and a number that matches nobody simply leaves the screen as it
 * was - no message, no empty state. So the only way to use the screen is to already know
 * the number, and the only way to test it is to go and find a real one first: the suite
 * reads one off Billing Dashboard (Office), which is the screen that does list discharged
 * patients.
 *
 * What comes back is not a grid. The services render as form rows - a heading per section
 * (HDU Care, ICU Care, Investigation Bill) and a line per service, each with its own
 * editable Discount box. There is no `<table>` anywhere on the loaded screen, which is why
 * `lines` counts the Discount boxes: one per service, and the only per-line handle the
 * markup offers.
 *
 * Read-only here, emphatically. Nothing in this page object types into a Discount box or
 * presses Save.
 */
export class DischargedEditPage extends HospitalScreenPage {
  readonly invoiceNo: Locator;
  readonly patientName: Locator;
  readonly save: Locator;

  constructor(page: Page, item: HospitalMenuItem) {
    super(page, item);
    this.invoiceNo = page.locator('input[name="InvoiceNo"]').first();
    this.patientName = page.locator('input[name$="SelectedPatient.FullName"]').first();
    this.save = page.getByRole('button', { name: /^save$/i }).first();
  }

  /**
   * One handle per service line on the loaded bill.
   *
   * The Discount box, because it is the only element the markup gives a line of its own.
   * The service name, date, qty and rate beside it are plain labels with nothing to tell
   * one line's from another's.
   */
  get lines(): Locator {
    return this.page.locator('input[name="item.Discount"]');
  }

  /** Opens the screen and waits for the invoice box. */
  async openScreen(): Promise<void> {
    await this.open();
    await this.expectLoaded();
    await expect(this.invoiceNo, `${this.item.label} rendered no invoice box`).toBeVisible({
      timeout: 60_000,
    });
  }

  /**
   * Types an invoice number in and waits for the screen to answer.
   *
   * Enter is what loads the bill, and nothing else does - tabbing out of the box leaves the
   * screen exactly as it was, patient blank and no lines. That is worth stating because
   * pressing Enter on a screen whose only button is a `type="submit"` Save looks alarming:
   * it is not. The invoice box is not inside a `<form>` at all, so the keypress cannot
   * reach that button; it is the screen's own lookup trigger. Checked before relying on it,
   * because the alternative would have been this suite quietly saving discharged bills.
   *
   * Returns the patient name that came back, or '' if none did - a number matching nobody
   * is answered with silence rather than a message, so the caller has to decide whether
   * that is the pass or the failure.
   */
  async loadInvoice(invoiceNo: string, timeout = 45_000): Promise<string> {
    // Named explicitly: these screens render the box before it is wired, and a bare fill
    // that times out reports only "locator.fill" without saying which of the five it was.
    await expect(
      this.invoiceNo,
      `${this.item.label}: the invoice box never became editable`
    ).toBeEditable({ timeout: 60_000 });

    await this.invoiceNo.fill(invoiceNo);
    await this.invoiceNo.press('Enter');

    const loaded = await expect
      .poll(async () => (await this.patientName.inputValue().catch(() => '')).trim(), { timeout })
      .not.toBe('')
      .then(() => true)
      .catch(() => false);

    return loaded ? (await this.patientName.inputValue()).trim() : '';
  }
}
