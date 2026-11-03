import { test, expect } from '../../../fixtures';
import { HospitalScreenPage, hospitalItem } from '../../../pages';
import { caseId, cases, opensFromDrawer } from './_case-packs';

/**
 * IPD Package Service Mapping @regression
 *
 * Says which of a fixed-price package's services have actually been delivered to the
 * patient, so the package can be billed out against what was done.
 *
 * The same form as IPD Service Entry with four tabs over it, one per kind of charge.
 * Nothing here is saved.
 */

const ITEM = hospitalItem('IPD Package Service Mapping');

test.describe('IPD Package Service Mapping @regression', () => {
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
      'Package Service Mapping has no Service lookup'
    ).toBeVisible({ timeout: 60_000 });

    // By text and with room: the toolbar lands after the catalogue, and Print All is
    // invisible to the accessibility tree. See IPD Service Entry for the detail.
    const button = (name: RegExp) =>
      page.locator('button:visible').filter({ hasText: name }).first();

    await expect(button(/^\s*Save\s*$/), 'no Save').toBeVisible({ timeout: 60_000 });
    await expect(button(/^\s*Print All\s*$/), 'no Print All').toBeVisible({ timeout: 60_000 });
  });

  test(caseId(ITEM, next++) + ' it splits a package across its four tabs', async ({ page }) => {
    // One tab per kind of charge; losing one hides that part of the package from whoever
    // is reconciling it.
    const screen = new HospitalScreenPage(page, ITEM);
    await screen.open();
    await screen.expectLoaded();

    for (const tab of ['IPD SERVICE', 'CONSULTANCY SERVICE', 'CABIN CHARGE', 'INVESTIGATIONS']) {
      await expect(
        page
          .locator('a.nav-link')
          .filter({ hasText: new RegExp(`^\s*${tab}\s*$`, 'i') })
          .first(),
        `Package Service Mapping lost its "${tab}" tab`
      ).toBeVisible();
    }
  });
});
