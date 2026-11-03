import { test, expect } from '../../../fixtures';
import { HospitalScreenPage, hospitalItem } from '../../../pages';
import { caseId, cases, opensFromDrawer } from './_case-packs';

/**
 * Doctor Transfer History @regression
 *
 * A patient history: which consultant a patient has been under, and when they were moved between them.
 *
 * Built the same way as its sibling history screen - two tabs, a "Patient Name" lookup on
 * each, and a Print. The split matters because a patient's history is read for different
 * reasons depending on whether they are still in a bed.
 *
 * Read-only. Print renders a document per patient and is left alone.
 */

const ITEM = hospitalItem('Doctor Transfer History');

test.describe('Doctor Transfer History @regression', () => {
  const packed = cases(ITEM, opensFromDrawer());
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' it separates admitted patients from discharged ones', async ({
    page,
  }) => {
    const screen = new HospitalScreenPage(page, ITEM);
    await screen.open();
    await screen.expectLoaded();

    const tab = (name: string) =>
      page
        .locator('a.nav-link')
        .filter({ hasText: new RegExp(`^\\s*${name}\\s*$`, 'i') })
        .first();

    for (const name of ['ADMITTED PATIENT', 'DISCHARGED PATIENT']) {
      await expect(tab(name), 'Doctor Transfer History lost its "' + name + '" tab').toBeVisible({
        timeout: 60_000,
      });
    }

    await tab('DISCHARGED PATIENT').click();
    await expect(tab('DISCHARGED PATIENT')).toHaveClass(/active/);

    // Each tab carries its own patient lookup - which is why the screen renders two.
    await expect(
      page
        .locator('div.form-group:visible')
        .filter({ has: page.locator('label', { hasText: /^\s*Patient Name\s*$/ }) })
        .locator('.rz-dropdown')
        .first(),
      'Doctor Transfer History has no patient lookup on the discharged tab'
    ).toBeVisible();

    await expect(page.getByRole('button', { name: /^print$/i }).first()).toBeVisible();
  });
});
