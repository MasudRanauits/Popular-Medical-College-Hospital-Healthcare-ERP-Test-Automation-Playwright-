import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, opensFromDrawer, setupGrid } from './_case-packs';

/**
 * OT Type @regression
 *
 * The kinds of operation the theatre records against a case.
 *
 * A reference-data grid. The grid itself is checked here; which toolbar buttons this
 * particular screen carries is pinned for all eighteen at once in _module.regression.
 */

const ITEM = hospitalItem('OT Type');

test.describe('OT Type @regression', () => {
  cases(ITEM, opensFromDrawer(), setupGrid()).forEach(({ title, run }) => test(title, run));
});
