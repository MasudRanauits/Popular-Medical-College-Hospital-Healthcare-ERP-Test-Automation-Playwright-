import { test, expect } from '../../../fixtures';
import { CabinDashboardPage, hospitalItem } from '../../../pages';
import { caseId, cases, opensFromDrawer } from './_case-packs';

/**
 * Cabin dashboard @regression
 *
 * The bed board for the whole hospital: eight hundred-odd tiles grouped into cards by
 * ward, a three-colour legend over them, and a search box that filters the board live.
 *
 * It is the screen the ward looks at to answer "is there a bed", so the cases are the two
 * things it is used for - seeing which beds are free, and finding a particular one.
 *
 * The colours are the data, and they are Bootstrap contextual classes rather than anything
 * semantic: btn-danger is booked, btn-success is free, btn-warning is with house keeping.
 * No text on a tile says which it is and there is no aria state either, so the class is
 * the only thing carrying it - which means the board is unreadable to a screen reader and
 * to anyone who cannot separate red from green.
 *
 * Read-only. Clicking a bed tile is how the ward starts an allocation, so nothing here
 * clicks one.
 */

const ITEM = hospitalItem('Cabin dashboard');

test.describe('Cabin dashboard @regression', () => {
  const packed = cases(ITEM, opensFromDrawer());
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' the board opens with its legend and every bed in the hospital', async ({
    cabinDashboardPage,
  }) => {
    await cabinDashboardPage.openBoard();

    for (const label of CabinDashboardPage.LEGEND) {
      await expect(
        cabinDashboardPage.legend(label),
        `the board has no "${label}" swatch`
      ).toBeVisible();
    }

    // A hospital of this size runs several hundred beds; a board showing a handful has
    // failed to load the rest rather than emptied.
    const beds = await cabinDashboardPage.tiles.count();
    expect(beds, 'beds on the board').toBeGreaterThan(100);

    // Grouped into wards rather than printed as one list.
    expect(await cabinDashboardPage.wardCards.count(), 'ward cards').toBeGreaterThan(0);
  });

  test(caseId(ITEM, next++) + ' every bed is in one of the three states, and both occupancies exist', async ({
    cabinDashboardPage,
  }) => {
    await cabinDashboardPage.openBoard();

    const census = await cabinDashboardPage.census();
    const total = await cabinDashboardPage.tiles.count();

    // No tile is left uncoloured: an uncoloured bed is one the board cannot say anything
    // about, which is worse than a wrong colour because it reads as "free" to a tired eye.
    expect(census.booked + census.free + census.housekeeping, 'beds accounted for').toBe(total);

    // A live hospital always has some of each; a board showing zero free *and* zero booked
    // has lost its occupancy data rather than filled up.
    expect(census.booked, 'booked beds').toBeGreaterThan(0);
    expect(census.free, 'free beds').toBeGreaterThan(0);

    test.info().annotations.push({
      type: 'census',
      description: `${census.booked} booked, ${census.free} free, ${census.housekeeping} house keeping, ${total} beds`,
    });
  });

  test(caseId(ITEM, next++) + ' a bed tile carries its number, rent, department and type', async ({
    cabinDashboardPage,
  }) => {
    await cabinDashboardPage.openBoard();

    const tile = await cabinDashboardPage.readTile(cabinDashboardPage.tiles.first());

    expect(tile.cabinNo, 'the tile has no bed number').not.toBe('');
    // Rent is printed to two places, and a free bed legitimately carries 0.00.
    expect(tile.rent, `${tile.cabinNo} has no rent`).toMatch(/^\d+\.\d{2}$/);
    expect(tile.department, `${tile.cabinNo} has no department`).not.toBe('');
    expect(tile.cabinType, `${tile.cabinNo} has no cabin type`).not.toBe('');
  });

  test(caseId(ITEM, next++) + ' the board filters to the ward searched for', async ({
    cabinDashboardPage,
  }) => {
    await cabinDashboardPage.openBoard();
    const all = await cabinDashboardPage.tiles.count();

    const seed = await cabinDashboardPage.readTile(cabinDashboardPage.tiles.first());
    // The ward prefix rather than the whole bed number: "ICU" out of "Neuro ICU-15", so
    // the case is a ward filter and not a single-bed lookup.
    const term = seed.cabinType.split(/\s+/)[0];

    await cabinDashboardPage.searchFor(term);

    const shown = await cabinDashboardPage.tiles.count();
    expect(shown, `nothing on the board matches "${term}"`).toBeGreaterThan(0);
    expect(shown, `"${term}" matched the whole hospital`).toBeLessThan(all);
  });

  test(caseId(ITEM, next++) + ' a search matching no bed empties the board and clears again', async ({
    cabinDashboardPage,
  }) => {
    await cabinDashboardPage.openBoard();
    const all = await cabinDashboardPage.tiles.count();

    await cabinDashboardPage.searchFor('ZZZ-NO-SUCH-BED-9912');
    await expect(cabinDashboardPage.tiles).toHaveCount(0);

    await cabinDashboardPage.searchFor('');
    await expect(cabinDashboardPage.tiles).toHaveCount(all);
  });
});
