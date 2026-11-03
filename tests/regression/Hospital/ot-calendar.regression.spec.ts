import { test, expect } from '../../../fixtures';
import { HospitalScreenPage, hospitalItem } from '../../../pages';
import { caseId, cases, opensFromDrawer } from './_case-packs';

/**
 * OT Calendar @regression
 *
 * The theatre booking calendar: a month at a time, per OT room.
 *
 * Read-only. Nothing here books a slot.
 */

const ITEM = hospitalItem('OT Calendar');

test.describe('OT Calendar @regression', () => {
  const packed = cases(ITEM, opensFromDrawer());
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' it moves between months and comes back to today', async ({ page }) => {
    /**
     * What makes the calendar useful is moving off today and back, so that is the case - a
     * calendar stuck on the current month cannot be used to book ahead.
     *
     * The month is plain text - "October 2026" - with no class, no heading role and no
     * container of its own, so it is matched by what it says. The obvious locators are all
     * wrong here: there is no element with "cal" in its class anywhere on the screen, and
     * `.mud-toolbar` is the application bar at the top of every page in the ERP, which
     * never changes and would make this case pass whatever the calendar did.
     */
    const screen = new HospitalScreenPage(page, ITEM);
    await screen.open();
    await screen.expectLoaded();

    const month = page
      .getByText(
        /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/
      )
      .first();
    await expect(month, 'the OT calendar never showed a month').toBeVisible({ timeout: 60_000 });
    const opening = (await month.innerText()).trim();

    await page.getByRole('button', { name: /chevron_right|next/i }).first().click();
    await expect
      .poll(async () => (await month.innerText().catch(() => opening)).trim(), {
        message: 'the calendar did not move forward a month',
        timeout: 30_000,
      })
      .not.toBe(opening);

    await page.getByRole('button', { name: /^today$/i }).first().click();
    await expect
      .poll(async () => (await month.innerText().catch(() => '')).trim(), {
        message: 'TODAY did not bring the calendar back',
        timeout: 30_000,
      })
      .toBe(opening);
  });

  test(caseId(ITEM, next++) + ' it offers the room it is showing bookings for', async ({ page }) => {
    // One calendar per theatre room: without the selector the screen can only ever show
    // whichever room it defaulted to.
    const screen = new HospitalScreenPage(page, ITEM);
    await screen.open();
    await screen.expectLoaded();

    await expect(
      page
        .locator('div.form-group')
        .filter({ has: page.locator('label', { hasText: /^\s*OT Room\s*$/ }) })
        .locator('.rz-dropdown')
        .first(),
      'the OT calendar has no room selector'
    ).toBeVisible({ timeout: 60_000 });
  });
});
