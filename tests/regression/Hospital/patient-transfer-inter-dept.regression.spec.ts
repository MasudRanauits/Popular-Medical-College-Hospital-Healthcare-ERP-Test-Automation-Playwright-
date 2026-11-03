import { test, expect } from '../../../fixtures';
import { HospitalWardScreenPage, hospitalItem } from '../../../pages';
import { caseId, cases, opensFromDrawer, wardLookup } from './_case-packs';

/**
 * PATIENT TRANSFER( INTER-DEPT ) @regression
 *
 * Moves an inpatient from one clinical department to another - Medicine to ICU, say -
 * which also moves them to a bed in the receiving department.
 *
 * The same form as Bed/Cabin Transfer with a "To Department" in front of the bed, so the
 * lookup's own behaviour is covered once, there, rather than twice.
 *
 * Nothing here is saved.
 */

const ITEM = hospitalItem('PATIENT TRANSFER( INTER-DEPT )');

test.describe('PATIENT TRANSFER( INTER-DEPT ) @regression', () => {
  const packed = cases(ITEM, opensFromDrawer(), wardLookup('Save'));
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' it shows which bed the patient is in and what it costs', async ({
    page,
  }) => {
    // Filled from the admission rather than typed. Getting it wrong is how a patient is
    // moved out of the wrong bed.
    const screen = new HospitalWardScreenPage(page, ITEM);
    await screen.openScreen();

    const row = await screen.patientAt(0);
    await screen.selectPatient(0);

    await expect(
      page.locator('input[name$="_SelectedCabin.CabinNo"]').first(),
      "From Cabin is not the patient's bed"
    ).toHaveValue(row.cabinNo);
    await expect(
      page.locator('input[name$="_SelectedCabin.Rent"]').first(),
      'From Cabin carries no rent'
    ).toHaveValue(/^\d+\.\d{2}$/);
  });

  test(caseId(ITEM, next++) + ' it asks for the department to move the patient into', async ({
    page,
  }) => {
    // The field that makes this screen different from Bed/Cabin Transfer. Without it the
    // transfer is just a bed move.
    const screen = new HospitalWardScreenPage(page, ITEM);
    await screen.openScreen();

    await expect(
      page.getByText(/^\s*To Department\s*$/).first(),
      'the inter-department transfer has no To Department'
    ).toBeVisible();
  });
});
