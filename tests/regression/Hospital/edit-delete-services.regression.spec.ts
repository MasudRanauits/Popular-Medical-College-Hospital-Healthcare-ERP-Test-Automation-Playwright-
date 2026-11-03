import { test, expect } from '../../../fixtures';
import { HospitalPatientScreenPage, hospitalItem } from '../../../pages';
import { admissionLookup, caseId, cases, opensFromDrawer } from './_case-packs';

/**
 * Edit/Delete Services @regression
 *
 * Takes a service off a *live* admission's bill, or changes what it cost - the only screen
 * in the module that can cancel a charge on a patient who is still in a bed.
 *
 * Two tabs, because an investigation is cancelled down a different path from a ward
 * service. Its lookup is labelled "Adm.No", which is the admission lookup under a third
 * label; HospitalPatientScreenPage.LOOKUP_LABEL accepts all three.
 *
 * Nothing here is saved.
 */

const ITEM = hospitalItem('Edit/Delete Services');

test.describe('Edit/Delete Services @regression', () => {
  const packed = cases(ITEM, opensFromDrawer(), admissionLookup('Save', { mayBeEmpty: true }));
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' it separates IPD services from investigations', async ({ page }) => {
    const screen = new HospitalPatientScreenPage(page, ITEM);
    await screen.openScreen();

    for (const tab of ['IPD SERVICES', 'INVESTIGATIONS']) {
      await expect(
        page.getByText(tab, { exact: false }).first(),
        `Edit/Delete Services lost its "${tab}" tab`
      ).toBeVisible();
    }

    await expect(page.getByRole('button', { name: /^save$/i }).first()).toBeVisible();
  });
});
