import { test, expect } from '../../../fixtures';
import { HospitalScreenPage, hospitalItem } from '../../../pages';
import { caseId, cases, opensFromDrawer } from './_case-packs';

/**
 * Re-Admit @regression
 *
 * Brings a discharged patient back onto the ward - used when somebody is sent home and
 * returns, or was discharged in error. The screen announces itself as "BRING DISCHARGED
 * PATIENT LIVE".
 *
 * The one screen outside the discharged-corrections family that works off a typed invoice
 * number, and the only one that pairs that with a bed lookup. Neither is exercised with a
 * real patient here: a Save puts somebody back into a bed.
 */

const ITEM = hospitalItem('Re-Admit');

test.describe('Re-Admit @regression', () => {
  const packed = cases(ITEM, opensFromDrawer());
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' it takes an invoice number and offers a bed to put the patient in', async ({
    page,
  }) => {
    const screen = new HospitalScreenPage(page, ITEM);
    await screen.open();
    await screen.expectLoaded();

    const invoice = page.locator('input[type="number"]').first();
    await expect(invoice, 'Re-Admit has no invoice box').toBeEditable({ timeout: 60_000 });

    await expect(
      page
        .locator('div.form-group')
        .filter({ has: page.locator('label', { hasText: /^\s*To Cabin\s*$/ }) })
        .locator('.rz-dropdown')
        .first(),
      'Re-Admit has no To Cabin lookup'
    ).toBeVisible();

    await expect(page.getByRole('button', { name: /^save$/i }).first()).toBeVisible();
  });
});
