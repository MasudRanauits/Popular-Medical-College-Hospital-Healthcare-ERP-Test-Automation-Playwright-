import { test, expect } from '../../../fixtures';
import { BillChangeHistoryPage, hospitalItem } from '../../../pages';
import { caseId, cases, opensFromDrawer } from './_case-packs';

/**
 * IPD Bill Change History @regression
 *
 * The module's audit trail: every service cancelled or edited off an inpatient bill, with
 * the reason, who did it and when.
 *
 * It is not the shape anything else in the module is, and the shape is easy to get wrong.
 * There is no report grid on the page. The screen is three filters and a sentence -
 * "Select a patient to see every service that was cancelled or edited on the bill" - and
 * the detail appears only once a patient is chosen.
 *
 * The seven-column grid that looks like the report lives inside the PATIENT lookup's
 * dropdown panel, hidden until the lookup is opened. A first pass at this suite went for
 * "the first table on the page", found it, read its headers happily and asserted that this
 * screen reports under columns it does not have.
 *
 * Read-only: there is nothing here to write, and Print is left alone because it renders a
 * document per patient.
 */

const ITEM = hospitalItem('IPD Bill Change History');

test.describe('IPD Bill Change History @regression', () => {
  const packed = cases(ITEM, opensFromDrawer());
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' it opens on its filters, with no report until a patient is picked', async ({
    page,
  }) => {
    const history = new BillChangeHistoryPage(page);
    await history.openHistory();

    await expect(history.status, 'no PATIENT STATUS filter').toBeVisible();
    await expect(history.changedOnly, 'no cancelled/edited-only filter').toBeVisible();
    await expect(history.print, 'no Print').toBeVisible({ timeout: 30_000 });

    // The sentence that stands in for the report. Its presence is what says nothing has
    // been selected yet, and selectBill waits on it going away.
    await expect(
      history.instruction,
      'the screen offers no instruction and no report'
    ).toBeVisible();
  });

  test(caseId(ITEM, next++) + ' the patient picker lists bills under its own seven columns', async ({
    page,
  }) => {
    const history = new BillChangeHistoryPage(page);
    await history.openHistory();
    await history.openPicker();

    await expect(history.pickerHeaders).toHaveText([...BillChangeHistoryPage.PICKER_COLUMNS]);

    const [first] = await history.bills();
    expect(first.billNo, 'a bill with no number').toMatch(/^\d{10,}$/);
    expect(first.patient, 'a bill with no patient').not.toBe('');
    // The column the screen is read for: what was done to this bill.
    expect(first.changes, 'a bill listed with no changes against it').toMatch(/cancelled|edited/i);
  });

  test(caseId(ITEM, next++) + ' the status filter offers admitted, discharged and both', async ({
    page,
  }) => {
    const history = new BillChangeHistoryPage(page);
    await history.openHistory();

    await expect(history.status.locator('option')).toHaveText([
      ...BillChangeHistoryPage.STATUSES,
    ]);
    // It opens on one of them rather than on nothing.
    await expect(history.status).toHaveValue(/.+/);
  });

  test(caseId(ITEM, next++) + ' picking a bill replaces the instruction with that bill', async ({
    page,
  }) => {
    const history = new BillChangeHistoryPage(page);
    await history.openHistory();

    const bill = await history.selectBill(0);

    // The instruction is gone - selectBill waits for that - and the bill that was picked is
    // the one now on screen.
    await expect(
      page.getByText(bill.billNo, { exact: false }).first(),
      `${bill.billNo} is not on screen after being picked`
    ).toBeVisible({ timeout: 30_000 });
  });

  test(caseId(ITEM, next++) + ' the picker finds a bill by its number', async ({ page }) => {
    /**
     * Worth its own case because the module's other two patient pickers disagree about
     * this exact thing: the ward lookup searches admission numbers and the admission
     * lookup does not. This is the third picker, so this is the third answer - and this
     * one says so on its own placeholder, "Search patient name, bill no or UHID...".
     */
    const history = new BillChangeHistoryPage(page);
    await history.openHistory();

    const [seed] = await history.bills();

    await history.searchPicker(seed.billNo);

    const found = await history.bills();
    expect(
      found.map((bill) => bill.billNo),
      `searching the bill number "${seed.billNo}" did not return it`
    ).toContain(seed.billNo);
  });
});
