import { test, expect } from '../../../fixtures';
import { HospitalWardScreenPage, hospitalItem } from '../../../pages';
import { caseId, cases, opensFromDrawer, wardLookup } from './_case-packs';

/**
 * Hospital Patients Package Management @regression
 *
 * Puts an inpatient on a fixed-price package, swaps them onto a different one, or takes
 * the package off again.
 *
 * The only screen in the ward-lookup family with more than a Save. All three of its
 * actions rewrite what the patient will be charged, so all three are checked to be there
 * and none is pressed.
 */

const ITEM = hospitalItem('Hospital Patients Package Management');

test.describe('Hospital Patients Package Management @regression', () => {
  const packed = cases(ITEM, opensFromDrawer(), wardLookup('Add Package'));
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' it offers all three package actions', async ({ page }) => {
    const screen = new HospitalWardScreenPage(page, ITEM);
    await screen.openScreen();

    for (const action of ['Add Package', 'Exchange', 'Cancel Package']) {
      await expect(
        screen.action(action),
        `Package Management has no "${action}"`
      ).toBeVisible();
    }
  });
});
