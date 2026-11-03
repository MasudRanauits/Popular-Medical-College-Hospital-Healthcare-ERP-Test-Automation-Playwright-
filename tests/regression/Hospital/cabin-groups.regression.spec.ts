import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, opensFromDrawer, setupGrid } from './_case-packs';

/**
 * Cabin Groups @regression
 *
 * Groups of beds, used to apply a rule or a rate to several at once. The only grid in the
 * family whose toolbar is a bare Save, and one of the three with no filter box.
 *
 * A reference-data grid. The grid itself is checked here; which toolbar buttons this
 * particular screen carries is pinned for all eighteen at once in _module.regression.
 */

const ITEM = hospitalItem('Cabin Groups');

test.describe('Cabin Groups @regression', () => {
  cases(ITEM, opensFromDrawer(), setupGrid()).forEach(({ title, run }) => test(title, run));
});
