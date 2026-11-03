import { test, expect } from '../../../fixtures';
import { HospitalPatientScreenPage, hospitalItem } from '../../../pages';
import { admissionLookup, caseId, cases, opensFromDrawer } from './_case-packs';

/**
 * IPD DUE COLLECTION @regression
 *
 * Takes money at the counter against what an inpatient still owes, with a discount and a
 * discount category, across any number of payment modes.
 *
 * Its lookup is the module's admission lookup with one column missing: InvoiceNo, FullName
 * and Mobile, no bed. The page object reads every row by header name for exactly this
 * reason - a positional read here returns the mobile number as the patient's name.
 *
 * Nothing here is saved.
 */

const ITEM = hospitalItem('IPD DUE COLLECTION');

test.describe('IPD DUE COLLECTION @regression', () => {
  const packed = cases(ITEM, opensFromDrawer(), admissionLookup('Save', { mayBeEmpty: true }));
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' picking a patient fills in what they owe', async ({ page }) => {
    /**
     * The figures are the reason the screen exists: a clerk reads the due amount off this
     * form and takes that much money. What is checked is that picking a patient fills them
     * - not that any particular number is right, which is the hospital's accounting rather
     * than this suite's business.
     */
    const screen = new HospitalPatientScreenPage(page, ITEM);
    await screen.openScreen();

    await screen.selectAdmission(0);

    for (const name of ['TotalBill', 'AdvancePaid', 'DueAmount']) {
      const box = page.locator(`input[name="${name}"]`).first();
      await expect(box, `IPD Due Collection renders no ${name}`).toBeVisible();
      // Filled from the bill, not left blank for the clerk to work out.
      await expect(box).not.toHaveValue('');
    }
  });

  test(caseId(ITEM, next++) + ' it offers a discount category and more than one payment mode', async ({
    page,
  }) => {
    // A counter payment is rarely one tender: the screen can add another POS line, and a
    // discount has to be attributed to a category rather than just typed in.
    const screen = new HospitalPatientScreenPage(page, ITEM);
    await screen.openScreen();

    await expect(
      page.locator('select[name="SelectedDiscountCategoryId"]').first(),
      'IPD Due Collection has no discount category'
    ).toBeVisible();

    await expect(
      page.getByRole('button', { name: /add another pos/i }).first(),
      'IPD Due Collection cannot take a second payment line'
    ).toBeVisible();
  });
});
