import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, opensFromDrawer, setupGrid } from './_case-packs';

/**
 * Service Packages @regression
 *
 * Fixed-price bundles - a delivery package, a cath-lab package - with their duration.
 * Adds rows inline from "New" rather than through a dialog.
 *
 * A reference-data grid. The grid itself is checked here; which toolbar buttons this
 * particular screen carries is pinned for all eighteen at once in _module.regression.
 */

const ITEM = hospitalItem('Service Packages');

test.describe('Service Packages @regression', () => {
  cases(ITEM, opensFromDrawer(), setupGrid()).forEach(({ title, run }) => test(title, run));
});
