import { test, expect } from '../../../fixtures';
import { HospitalScreenPage, hospitalItem } from '../../../pages';
import { caseId, cases, opensFromDrawer } from './_case-packs';

/**
 * DIET INDENT @regression
 *
 * The drawer's route to the canteen's food indent, at /canteen/canteen-indent. The menu
 * calls it DIET INDENT and the screen calls itself FOOD INDENT.
 *
 * Not the Nurse Station tab of the same name - that one lives at /hospital/nurse-station
 * and is covered in depth, saving cases and all, in
 * nurse-station-diet-indent.regression.spec.ts.
 *
 * A Canteen route reached from the Hospital drawer, because a nurse ordering a patient's
 * meals is working in the Hospital module whatever the URL says. Nothing here is saved.
 */

const ITEM = hospitalItem('DIET INDENT');

test.describe('DIET INDENT @regression', () => {
  const packed = cases(ITEM, opensFromDrawer());
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' it opens on Add Indent with Verify Indent beside it', async ({
    page,
  }) => {
    // Ordering meals and checking the order are different jobs on the same screen, so the
    // tab strip is the whole of the navigation between them.
    const screen = new HospitalScreenPage(page, ITEM);
    await screen.open();
    await screen.expectLoaded();

    const tab = (name: string) =>
      page
        .locator('a.nav-link')
        .filter({ hasText: new RegExp(`^\s*${name}\s*$`, 'i') })
        .first();

    for (const name of ['ADD INDENT', 'VERIFY INDENT']) {
      await expect(tab(name), `DIET INDENT lost its "${name}" tab`).toBeVisible({
        timeout: 60_000,
      });
    }

    await tab('VERIFY INDENT').click();
    await expect(tab('VERIFY INDENT')).toHaveClass(/active/);
  });
});
