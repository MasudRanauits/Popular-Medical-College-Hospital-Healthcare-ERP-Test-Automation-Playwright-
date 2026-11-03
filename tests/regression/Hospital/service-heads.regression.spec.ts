import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, opensFromDrawer, setupGrid } from './_case-packs';

/**
 * SERVICE HEADS @regression
 *
 * The service catalogue itself - every chargeable item with its rate, its commission
 * splits and its VAT. The widest grid in the module at fifteen columns, and the one
 * screen in this family built on MudBlazor rather than Blazorise.
 *
 * It is also the one screen in the module that does not fit a phone - see
 * _module-responsive.regression.spec.ts, where that failure is reported.
 *
 * A reference-data grid. The grid itself is checked here; which toolbar buttons this
 * particular screen carries is pinned for all eighteen at once in _module.regression.
 */

const ITEM = hospitalItem('SERVICE HEADS');

test.describe('SERVICE HEADS @regression', () => {
  cases(ITEM, opensFromDrawer(), setupGrid()).forEach(({ title, run }) => test(title, run));
});
