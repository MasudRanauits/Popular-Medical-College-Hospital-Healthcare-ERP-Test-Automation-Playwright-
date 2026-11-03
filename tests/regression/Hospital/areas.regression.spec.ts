import { test, expect } from '../../../fixtures';
import { HospitalGridPage, hospitalItem } from '../../../pages';
import { caseId, cases, opensFromDrawer, setupGrid } from './_case-packs';

/**
 * Areas @regression
 *
 * The upazila/area list behind a patient's address.
 *
 * A reference-data grid like the other seventeen, and the one the family's behaviour cases
 * are worked on. Three reasons it is the right choice: it changes about never, it holds
 * enough rows to page, and its NAME column is free text - so a search case can take a name
 * out of the grid and search for it without the term meaning anything to the hospital.
 *
 * Read-only. This is data the live wards are configured from; nothing here saves or
 * deletes, and the one case that opens the create dialog closes it again.
 */

const ITEM = hospitalItem('Areas');

test.describe('Areas @regression', () => {
  const packed = cases(ITEM, opensFromDrawer(), setupGrid());
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' the grid opens on ten rows a page, not the five the box lists first', async ({
    page,
  }) => {
    const screen = new HospitalGridPage(page, ITEM);
    await screen.openGrid();

    // The size box offers 5 first and sits on 10. Asserted because the two are easy to
    // confuse from the markup, and because every row-count case below depends on it.
    await expect(screen.pageSize).toHaveValue(HospitalGridPage.DEFAULT_PAGE_SIZE);
    await expect(screen.rows).toHaveCount(Number(HospitalGridPage.DEFAULT_PAGE_SIZE));
  });

  test(caseId(ITEM, next++) + ' the page-size box offers every size and the grid honours it', async ({
    page,
  }) => {
    const screen = new HospitalGridPage(page, ITEM);
    await screen.openGrid();

    await expect(screen.pageSize.locator('option')).toHaveText([...HospitalGridPage.PAGE_SIZES]);

    // 25 then 5: up proves the grid was being capped rather than simply holding ten rows,
    // and back down proves the box is not one-way.
    //
    // Generous timeouts because changing the size is a round trip to the server, and the
    // settle inside setPageSize can legitimately return while the old page is still on
    // screen. Under a full-suite run this host takes well past the 15s default to answer.
    await screen.setPageSize('25');
    await expect(screen.rows).toHaveCount(25, { timeout: 60_000 });

    await screen.setPageSize('5');
    await expect(screen.rows).toHaveCount(5, { timeout: 60_000 });
  });

  test(caseId(ITEM, next++) + ' the filter box narrows the grid to the row searched for', async ({
    page,
  }) => {
    const screen = new HospitalGridPage(page, ITEM);
    await screen.openGrid();

    // Taken out of the grid rather than hard-coded: these are the hospital's own areas and
    // which of them is first is not this suite's business.
    const [name] = await screen.columnValues('NAME');
    expect(name, 'the Areas grid came back empty').not.toBe('');

    await screen.searchFor(name);

    const matches = await screen.columnValues('NAME');
    expect(matches.length, `nothing came back for "${name}"`).toBeGreaterThan(0);
    for (const match of matches) expect(match.toLowerCase()).toContain(name.toLowerCase());
  });

  test(caseId(ITEM, next++) + ' a term matching nothing empties the grid rather than ignoring the filter', async ({
    page,
  }) => {
    const screen = new HospitalGridPage(page, ITEM);
    await screen.openGrid();

    await screen.searchFor('ZZZ-NO-SUCH-AREA-9912');
    await expect(screen.rows).toHaveCount(0);

    // And it comes back: a filter that cannot be cleared is as broken as one that never
    // filtered, and this is the half a happy-path case never reaches.
    await screen.searchFor('');
    await expect(screen.rows).toHaveCount(Number(HospitalGridPage.DEFAULT_PAGE_SIZE));
  });

  test(caseId(ITEM, next++) + ' the filter searches the name columns and not the ID column', async ({
    page,
  }) => {
    /**
     * A finding rather than a requirement, pinned so it does not change unnoticed.
     *
     * The grid prints an ID column and the filter does not search it: typing the ID that is
     * on screen in row one returns nothing at all. A clerk reading an ID off this grid and
     * pasting it back into the box above it gets an empty grid and no explanation.
     *
     * Asserted as the app behaves, because that is what a regression suite is for. Whether
     * it *should* search IDs belongs in the bug report, not in a red suite.
     */
    const screen = new HospitalGridPage(page, ITEM);
    await screen.openGrid();

    const [id] = await screen.columnValues('ID');
    expect(id, 'the Areas grid came back empty').toMatch(/^\d+$/);

    await screen.searchFor(id);

    await expect(
      screen.rows,
      `searching the ID "${id}", printed in row one of this very grid, returns nothing`
    ).toHaveCount(0);
  });

  test(caseId(ITEM, next++) + ' Add New opens the create dialog and closes without saving', async ({
    page,
  }) => {
    // Opened and shut deliberately: this is the live hospital's area list, and the point of
    // the case is that the dialog is reachable and dismissible, not that a row can be made.
    const screen = new HospitalGridPage(page, ITEM);
    await screen.openGrid();

    const before = await screen.rows.count();

    await screen.addNew.click();
    await expect(screen.modal, 'Add New opened no dialog').toBeVisible({ timeout: 30_000 });
    await expect(screen.modalTitle).not.toBeEmpty();

    await screen.modalClose.click();
    await expect(screen.modal).toBeHidden({ timeout: 30_000 });

    // Nothing was written on the way through.
    await expect(screen.rows).toHaveCount(before);
  });

  test(caseId(ITEM, next++) + ' Reload re-fetches the grid and leaves it as it was', async ({
    page,
  }) => {
    const screen = new HospitalGridPage(page, ITEM);
    await screen.openGrid();

    const before = await screen.snapshot();

    await screen.reload.click();
    await screen.settle();

    const after = await screen.snapshot();
    expect(after.columns).toEqual(before.columns);
    // Same page of the same reference data: a Reload that came back with different rows
    // would mean it had lost the page it was on.
    expect(after.rows).toEqual(before.rows);
  });
});
