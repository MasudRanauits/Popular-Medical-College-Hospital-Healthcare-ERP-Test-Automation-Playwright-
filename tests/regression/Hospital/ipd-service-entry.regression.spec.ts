import { test, expect } from '../../../fixtures';
import { HospitalScreenPage, hospitalItem } from '../../../pages';
import { caseId, cases, opensFromDrawer } from './_case-packs';

/**
 * IPD Service Entry @regression
 *
 * The ward's own charging screen at /hospital/ipd-service-record: puts a service on an
 * inpatient's bill, with its rate, quantity and service date.
 *
 * Not to be confused with two neighbours. The Nurse Station has a tab of the same name,
 * covered in nurse-station-ipd-service-entry.regression.spec.ts; and the billing
 * department has its own copy on its own menu, covered in
 * ipd-service-entry-billing-dept.regression.spec.ts. Three screens, one name.
 *
 * Its patient comes from a plain Search box rather than a lookup, and the Service control
 * is the Radzen lookup instead - the opposite way round from the billing copy.
 *
 * Nothing here is saved.
 */

const ITEM = hospitalItem('IPD Service Entry');

test.describe('IPD Service Entry @regression', () => {
  const packed = cases(ITEM, opensFromDrawer());
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' it offers a service lookup and the buttons that commit a charge', async ({
    page,
  }) => {
    const screen = new HospitalScreenPage(page, ITEM);
    await screen.open();
    await screen.expectLoaded();

    await expect(
      page
        .locator('div.form-group')
        .filter({ has: page.locator('label', { hasText: /^\s*Service\s*$/ }) })
        .locator('.rz-dropdown')
        .first(),
      'IPD Service Entry has no Service lookup'
    ).toBeVisible({ timeout: 60_000 });

    /**
     * Located by text rather than by role, and with generous timeouts.
     *
     * The screen paints its toolbar after the service catalogue has loaded, seconds behind
     * the page title. And Print All has no accessible name that getByRole can see - it is
     * a button in the markup and invisible to the accessibility tree, which is a finding
     * in itself: a screen reader here cannot announce the control that prints the
     * patient's charges.
     */
    const button = (name: RegExp) =>
      page.locator('button:visible').filter({ hasText: name }).first();

    await expect(button(/^\s*Save\s*$/), 'IPD Service Entry has no Save').toBeVisible({
      timeout: 60_000,
    });
    await expect(button(/^\s*Print All\s*$/), 'IPD Service Entry has no Print All').toBeVisible({
      timeout: 60_000,
    });
  });
});
