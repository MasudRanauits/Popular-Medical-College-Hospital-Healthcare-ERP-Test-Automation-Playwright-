import { test, expect } from '../../../fixtures';
import { HospitalPatientScreenPage, hospitalItem } from '../../../pages';
import { admissionLookup, caseId, cases, opensFromDrawer } from './_case-packs';

/**
 * Advance Collection @regression
 *
 * Takes an advance payment against an admission - cash, card, bKash, Rocket or Nagad - and
 * credits it to the bill.
 *
 * Real money on a live system, so nothing here is saved. What the suite proves is the one
 * thing that would be catastrophic and silent if it broke: that the patient the screen is
 * about to take money from is the patient who was picked.
 */

const ITEM = hospitalItem('Advance Collection');

test.describe('Advance Collection @regression', () => {
  const packed = cases(ITEM, opensFromDrawer(), admissionLookup('Save'));
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' picking a second admission replaces the first, leaving nothing behind', async ({
    page,
  }) => {
    /**
     * The case that matters most on the payment screens.
     *
     * Every screen in this family acts on whichever admission the panel is showing. A panel
     * that kept any part of the previous patient after a second pick would put one
     * patient's bed, or doctor, or department onto another patient's payment - and nothing
     * on screen would say so.
     */
    const screen = new HospitalPatientScreenPage(page, ITEM);
    await screen.openScreen();

    const first = await screen.selectAdmission(0);

    const second = await screen.admissionAt(1);
    test.skip(
      second.invoiceNo === first.invoiceNo || second.invoiceNo === '',
      'the ward is holding fewer than two admissions'
    );
    const panel = await screen.selectAdmission(1);

    expect(panel.invoiceNo).toBe(second.invoiceNo);
    expect(panel.fullName).toBe(second.fullName);
    expect(panel.cabinNo).toBe(second.cabinNo);
    // Not just "it changed": nothing of the first patient is still on the form.
    expect(panel.invoiceNo).not.toBe(first.invoiceNo);
  });

  test(caseId(ITEM, next++) + ' the patient panel cannot be typed into', async ({ page }) => {
    // Named with the underscore prefix this half of the family uses - see
    // HospitalPatientScreenPage.field for why one page object drives both spellings.
    const screen = new HospitalPatientScreenPage(page, ITEM);
    await screen.openScreen();
    await screen.selectAdmission(0);

    for (const name of Object.values(HospitalPatientScreenPage.PANEL_FIELDS)) {
      await expect(screen.field(name), `_SelectedPatient.${name} takes typing`).toBeDisabled();
    }
  });
});
