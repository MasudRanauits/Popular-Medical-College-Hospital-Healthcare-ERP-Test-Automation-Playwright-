import { test, expect } from '../../../fixtures';
import { HospitalScreenPage, hospitalItem } from '../../../pages';
import { caseId, cases, opensFromDrawer } from './_case-packs';

/**
 * Medicine Indent @regression
 *
 * The drawer's route to the pharmacy's medicine indent, at /pharmacy/medicine-indent: the
 * ward asks the pharmacy for a patient's drugs.
 *
 * A Pharmacy route reached from the Hospital drawer. The Nurse Station carries its own
 * MEDICINE INDENT tab, covered in nurse-station.regression.spec.ts.
 *
 * Nothing here is saved: a Save raises a real indent against a real patient.
 */

const ITEM = hospitalItem('Medicine Indent');

test.describe('Medicine Indent @regression', () => {
  const packed = cases(ITEM, opensFromDrawer());
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' it opens on Add Indent with Verify Indent beside it', async ({
    page,
  }) => {
    const screen = new HospitalScreenPage(page, ITEM);
    await screen.open();
    await screen.expectLoaded();

    const tab = (name: string) =>
      page
        .locator('a.nav-link')
        .filter({ hasText: new RegExp(`^\s*${name}\s*$`, 'i') })
        .first();

    for (const name of ['ADD INDENT', 'VERIFY INDENT']) {
      await expect(tab(name), `Medicine Indent lost its "${name}" tab`).toBeVisible({
        timeout: 60_000,
      });
    }
  });

  test(caseId(ITEM, next++) + ' it lists the ward to indent for, and the drugs to indent', async ({
    page,
  }) => {
    /**
     * The ward list down the left is how a patient is chosen here, and it is a card per
     * bed - the control Nurse Station uses, not either of the Radzen lookups the rest of
     * the module picks patients with.
     *
     * The drug list is *not* a grid on the page, which is worth stating because it looks
     * like one: the only visible table on this screen is the empty indent being built, and
     * the product catalogue is a Radzen lookup that stays hidden until the Product Code box
     * is opened. A case that waited for "the first table row" waited for a line that will
     * not exist until a drug has been added.
     */
    const screen = new HospitalScreenPage(page, ITEM);
    await screen.open();
    await screen.expectLoaded();

    await expect(
      page.locator('ul.list-group-scrollable:visible li.list-group-item').first(),
      'Medicine Indent listed no patients to indent for'
    ).toBeVisible({ timeout: 60_000 });

    // The boxes an indent line is built from, and the two that route it.
    for (const label of ['Outlet', 'Priority', 'Product Code', 'Item Description', 'Quantity']) {
      await expect(
        page.locator('label:visible').filter({ hasText: new RegExp(`^\\s*${label}\\s*$`, 'i') }),
        `Medicine Indent lost its "${label}" field`
      ).toHaveCount(1, { timeout: 30_000 });
    }
  });
});
