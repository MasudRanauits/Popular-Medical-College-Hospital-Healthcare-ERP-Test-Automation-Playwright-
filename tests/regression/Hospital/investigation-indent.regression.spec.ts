import { test, expect } from '../../../fixtures';
import { HospitalScreenPage, hospitalItem } from '../../../pages';
import { caseId, cases, opensFromDrawer } from './_case-packs';

/**
 * Investigation Indent @regression
 *
 * The screen a ward orders a test from, and the screen the lab's queue is fed by.
 *
 * Two tabs, because raising an order and verifying one are different jobs done by
 * different people. Nothing here is saved: a Save orders a real investigation.
 */

const ITEM = hospitalItem('Investigation Indent');

test.describe('Investigation Indent @regression', () => {
  const packed = cases(ITEM, opensFromDrawer());
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  const tab = (page: import('@playwright/test').Page, name: string) =>
    page.locator('a.nav-link').filter({ hasText: new RegExp(`^\s*${name}\s*$`, 'i') }).first();

  test(caseId(ITEM, next++) + ' it offers a priority, a test lookup and both tabs', async ({ page }) => {
    const screen = new HospitalScreenPage(page, ITEM);
    await screen.open();
    await screen.expectLoaded();

    // Priority is what decides how fast the lab answers, so it is the field worth pinning.
    const priority = page.locator('select[name="Priority"]').first();
    await expect(priority, 'Investigation Indent has no Priority').toBeVisible({ timeout: 60_000 });
    // More than the placeholder: a priority list of one is a priority list that does not work.
    expect(await priority.locator('option').count(), 'Priority options').toBeGreaterThan(1);

    for (const label of ['Doctor', 'Test']) {
      await expect(
        page
          .locator('div.form-group')
          .filter({ has: page.locator('label', { hasText: new RegExp(`^\s*${label}\s*$`) }) })
          .locator('.rz-dropdown')
          .first(),
        `Investigation Indent has no ${label} lookup`
      ).toBeVisible();
    }

    for (const name of ['ADD INDENT', 'VERIFY INDENT']) {
      await expect(
        tab(page, name),
        `Investigation Indent lost its "${name}" tab`
      ).toBeVisible();
    }
  });

  test(caseId(ITEM, next++) + ' it switches to Verify Indent and back', async ({ page }) => {
    // The tab strip is the whole of the navigation between raising an order and checking
    // one, so it is worth proving it actually switches rather than merely rendering.
    const screen = new HospitalScreenPage(page, ITEM);
    await screen.open();
    await screen.expectLoaded();

    await tab(page, 'VERIFY INDENT').click();
    await expect(tab(page, 'VERIFY INDENT')).toHaveClass(/active/);

    await tab(page, 'ADD INDENT').click();
    await expect(tab(page, 'ADD INDENT')).toHaveClass(/active/);
  });
});
