import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, opensFromDrawer, setupGrid } from './_case-packs';

/**
 * OT Rooms @regression
 *
 * The theatre rooms that can be booked.
 *
 * A reference-data grid. The grid itself is checked here; which toolbar buttons this
 * particular screen carries is pinned for all eighteen at once in _module.regression.
 */

const ITEM = hospitalItem('OT Rooms');

test.describe('OT Rooms @regression', () => {
  cases(ITEM, opensFromDrawer(), setupGrid()).forEach(({ title, run }) => test(title, run));
});
