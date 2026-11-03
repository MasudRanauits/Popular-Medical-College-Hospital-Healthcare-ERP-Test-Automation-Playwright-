import { test, expect } from '../../../fixtures';
import { HospitalScreenPage, hospitalItem } from '../../../pages';
import { caseId, cases, opensFromDrawer } from './_case-packs';

/**
 * OT Assistant Payment @regression
 *
 * Pays the theatre assistants out of an operation's surgical fee: the doctor the payment
 * is attributed to, the amount, and the line it is added as.
 *
 * An /ipd route reached from the Hospital drawer. Nothing here is saved.
 */

const ITEM = hospitalItem('OT Assistant Payment');

test.describe('OT Assistant Payment @regression', () => {
  const packed = cases(ITEM, opensFromDrawer());
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' it offers a doctor lookup and both of its steps', async ({ page }) => {
    const screen = new HospitalScreenPage(page, ITEM);
    await screen.open();
    await screen.expectLoaded();

    await expect(
      page
        .locator('div.form-group')
        .filter({ has: page.locator('label', { hasText: /^\s*Assigned Doctor\s*$/ }) })
        .locator('.rz-dropdown')
        .first(),
      'OT Assistant Payment has no Assigned Doctor lookup'
    ).toBeVisible({ timeout: 60_000 });

    // Add builds the line; Save commits the lot. Both are needed for the screen to work.
    for (const action of ['Add', 'Save']) {
      await expect(
        page.getByRole('button', { name: new RegExp(`^${action}$`, 'i') }).first(),
        `OT Assistant Payment has no ${action}`
      ).toBeVisible();
    }
  });
});
