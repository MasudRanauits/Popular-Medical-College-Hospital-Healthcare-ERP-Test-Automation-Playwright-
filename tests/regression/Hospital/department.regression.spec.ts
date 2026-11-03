import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, opensFromDrawer, setupGrid } from './_case-packs';

/**
 * Department @regression
 *
 * The clinical departments a patient can be admitted under.
 *
 * A reference-data grid. The grid itself is checked here; which toolbar buttons this
 * particular screen carries is pinned for all eighteen at once in _module.regression.
 */

const ITEM = hospitalItem('Department');

test.describe('Department @regression', () => {
  cases(ITEM, opensFromDrawer(), setupGrid()).forEach(({ title, run }) => test(title, run));
});
