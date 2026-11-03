import { test, expect } from '../../../fixtures';
import { HospitalScreenPage, hospitalItem } from '../../../pages';
import { caseId, cases, opensFromDrawer } from './_case-packs';

/**
 * CONSULTANCY SERVICE @regression
 *
 * The drawer's own consultancy entry at /hospital/ipd-consultancy-service: puts a
 * consultant's visit, or any other chargeable service, onto an inpatient's bill.
 *
 * Not the Nurse Station tab of the same name. That one lives at /hospital/nurse-station
 * and is covered, in depth, in nurse-station-consultancy-service.regression.spec.ts - it
 * is the screen a ward actually works from, and it has twenty-three cases of its own
 * including the saving ones.
 *
 * The two render the same page title, "IPD CONSULTANCY SERVICE", which is why the module's
 * shared-title register in _module.regression.spec.ts exists.
 *
 * Nothing here is saved.
 */

const ITEM = hospitalItem('CONSULTANCY SERVICE');

test.describe('CONSULTANCY SERVICE @regression', () => {
  const packed = cases(ITEM, opensFromDrawer());
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' it offers the controls a consultancy charge is built from', async ({
    page,
  }) => {
    const screen = new HospitalScreenPage(page, ITEM);
    await screen.open();
    await screen.expectLoaded();

    // The three lookups a line is made of: what was done, who did it, and when.
    for (const label of ['Service', 'Doctor Name', 'Schedule']) {
      await expect(
        page
          .locator('div.form-group:visible')
          .filter({ has: page.locator('label', { hasText: new RegExp(`^\s*${label}\s*$`) }) })
          .locator('.rz-dropdown')
          .first(),
        `CONSULTANCY SERVICE has no ${label} lookup`
      ).toBeVisible({ timeout: 60_000 });
    }

    await expect(
      page.locator('button:visible').filter({ hasText: /^\s*Save\s*$/ }).first(),
      'CONSULTANCY SERVICE has no Save'
    ).toBeVisible({ timeout: 60_000 });
  });
});
