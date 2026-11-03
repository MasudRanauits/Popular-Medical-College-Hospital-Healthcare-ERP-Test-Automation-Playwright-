import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { admissionLookup, cases, opensFromDrawer } from './_case-packs';

/**
 * IPD Service Dashboard @regression
 *
 * A read-only view of everything charged to one admission. The only screen in the
 * family with no action button at all, which is why the pack is given none.
 *
 * Driven by the module's admission lookup. Read-only: nothing here submits.
 */

const ITEM = hospitalItem('IPD Service Dashboard');

test.describe('IPD Service Dashboard @regression', () => {
  cases(ITEM, opensFromDrawer(), admissionLookup(null)).forEach(({ title, run }) => test(title, run));
});
