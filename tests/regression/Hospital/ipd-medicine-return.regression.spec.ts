import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, opensFromDrawer, wardLookup } from './_case-packs';

/**
 * IPD MEDICINE RETURN @regression
 *
 * Returns unused medicine from the ward to the pharmacy and credits it back.
 *
 * The one screen in this family that prints its lookup columns in a different order from
 * the other seven - InvoiceNo first, where the rest lead with the bed. That is pinned in
 * _module.regression.spec.ts, and is why every row here is read by header name.
 *
 * Driven by the ward's "Search Patient" lookup. Read-only: nothing here submits.
 */

const ITEM = hospitalItem('IPD MEDICINE RETURN');

test.describe('IPD MEDICINE RETURN @regression', () => {
  cases(ITEM, opensFromDrawer(), wardLookup('Save')).forEach(({ title, run }) => test(title, run));
});
