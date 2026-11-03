import { test, expect } from '../../../fixtures';
import { HospitalGridPage, hospitalItem } from '../../../pages';
import { caseId, cases, listScreen, opensFromDrawer } from './_case-packs';

/**
 * Cabin Release @regression
 *
 * The screen that exists because the other screens go wrong.
 *
 * A bed is "orphaned" when the ERP has it marked occupied and no admitted patient is in it
 * - the wreckage of a cancelled admission, or a transfer that half-finished. Until someone
 * releases it by hand, the ward cannot admit into it, and the bed board shows it red.
 *
 * Nothing here is released. Release is the whole point of the screen and pressing it would
 * free a real bed on a live system; what the suite proves is that the board finds the
 * broken beds and says enough about each one to act on.
 */

const ITEM = hospitalItem('Cabin Release');

test.describe('Cabin Release @regression', () => {
  const packed = cases(ITEM, opensFromDrawer(), listScreen(['CABIN', 'STATUS', 'PATIENT', 'UHID', 'INVOICE NO', 'ADMITTED', 'STATE', 'ACTION']));
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' the board opens on the orphaned beds and widens when asked', async ({
    page,
  }) => {
    /**
     * It opens with "Show only orphans" already ticked, which is the right default and the
     * thing worth pinning: this is a repair tool, so the broken beds are what it should
     * lead with. Untick and it widens to every occupied bed.
     */
    const screen = new HospitalGridPage(page, ITEM);
    await screen.openGridWithRows();

    const orphansOnly = page.locator('input[type="checkbox"]').first();
    await expect(orphansOnly, 'Cabin Release has no orphans filter').toBeVisible();
    await expect(orphansOnly, 'Cabin Release no longer opens on the orphaned beds').toBeChecked();

    const orphans = await screen.rows.count();

    await orphansOnly.uncheck();
    await screen.settle();
    const occupied = await screen.rows.count();

    // Every orphan is an occupied bed, so widening the filter can only ever add rows.
    expect(occupied, 'unticking the orphans filter returned fewer beds').toBeGreaterThanOrEqual(
      orphans
    );

    await orphansOnly.check();
    await screen.settle();
    await expect(
      screen.rows,
      'the orphan list did not come back when the filter was re-applied'
    ).toHaveCount(orphans);

    test.info().annotations.push({
      type: 'cabin release',
      description: `${orphans} orphaned of ${occupied} occupied beds`,
    });
  });

  test(caseId(ITEM, next++) + ' every bed it lists says which bed it is and what state it is in', async ({
    page,
  }) => {
    const screen = new HospitalGridPage(page, ITEM);
    await screen.openGridWithRows();

    // The two columns the screen is read for: which bed, and why it is on this list. A row
    // with either one blank is a row a ward clerk cannot act on.
    for (const column of ['CABIN', 'STATE'] as const) {
      for (const value of await screen.columnValues(column)) {
        expect(value, `a row with no ${column}`).not.toBe('');
      }
    }
  });
});
