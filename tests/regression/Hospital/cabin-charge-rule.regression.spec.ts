import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, opensFromDrawer, setupGrid } from './_case-packs';

/**
 * Cabin Charge Rule @regression
 *
 * When a bed-day starts and ends: the calendar change time, the grace periods at each end
 * and the hourly rules inside them. One row, and it decides what every inpatient is
 * charged for their stay.
 *
 * A reference-data grid. The grid itself is checked here; which toolbar buttons this
 * particular screen carries is pinned for all eighteen at once in _module.regression.
 */

const ITEM = hospitalItem('Cabin Charge Rule');

test.describe('Cabin Charge Rule @regression', () => {
  cases(ITEM, opensFromDrawer(), setupGrid()).forEach(({ title, run }) => test(title, run));
});
