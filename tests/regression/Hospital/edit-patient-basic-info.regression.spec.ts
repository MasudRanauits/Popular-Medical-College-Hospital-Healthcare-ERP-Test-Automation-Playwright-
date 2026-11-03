import { test, expect } from '../../../fixtures';
import { HospitalScreenPage, hospitalItem } from '../../../pages';
import { caseId, cases, opensFromDrawer } from './_case-packs';

/**
 * Edit Patient Basic Info @regression
 *
 * Corrects a patient's own details - name, parents, date of birth, religion, occupation,
 * blood group, address - against any of their four invoice numbers.
 *
 * Two things about this screen are worth knowing before reading a failure here.
 *
 * It renders no page title, unlike almost every other screen in the module; its name is in
 * a card header instead, which is why its menu entry carries an `anchor` rather than a
 * `title` in HOSPITAL_MENU.
 *
 * And it is the one route in the module that has been seen to answer Access Denied for
 * real - twice in a row, to an administrator who has it in their menu, and then to load
 * cleanly on every attempt since. One intermittent denial is not a permission that was
 * never granted, so it is treated as a normal screen; but if the route case here ever
 * fails on a denial, that is the history behind it.
 *
 * Read-only: nothing here presses Update Info.
 */

const ITEM = hospitalItem('Edit Patient Basic Info');

test.describe('Edit Patient Basic Info @regression', () => {
  const packed = cases(ITEM, opensFromDrawer());
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' it offers four ways to find a patient and the fields to correct', async ({
    page,
  }) => {
    const screen = new HospitalScreenPage(page, ITEM);
    await screen.open();
    await screen.expectLoaded();

    /**
     * Four invoice numbers, because a patient can be reached from any of the four places
     * the hospital bills them from.
     *
     * Matched on the label elements rather than with `getByText`. These four captions sit
     * next to each other and three of them end in the same word, so a text match over the
     * whole document is matching a run of prose; the labels are what the boxes are actually
     * captioned with, and there is exactly one of each.
     */
    for (const label of [
      'Hospital InvoiceNo',
      'Investigation InvoiceNo',
      'OPD Service InvoiceNo',
      'OPD Consultancy InvoiceNo',
    ]) {
      await expect(
        page.locator('label:visible').filter({ hasText: new RegExp(`^\\s*${label}\\s*$`, 'i') }),
        `Edit Patient Basic Info lost its "${label}" box`
      ).toHaveCount(1, { timeout: 60_000 });
    }

    // The record itself, under its own card header - this screen renders no page title.
    await expect(
      page.getByText(/^\s*BASIC INFO\s*$/).first(),
      'the basic-info card is not on screen'
    ).toBeVisible();

    await expect(
      page.getByRole('button', { name: /update info/i }).first(),
      'Edit Patient Basic Info has no Update Info'
    ).toBeVisible();
  });
});
