import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, opensFromDrawer, wardLookup } from './_case-packs';

/**
 * OT Service Entry (Billing Dept) @regression
 *
 * The billing department's copy of OT Service Entry. Same form, same page title, and a
 * separate menu entry - which is why the module has two screens called OT SERVICE ENTRY.
 *
 * Driven by the ward's "Search Patient" lookup. Read-only: nothing here submits.
 */

const ITEM = hospitalItem('OT Service Entry (Billing Dept)');

test.describe('OT Service Entry (Billing Dept) @regression', () => {
  cases(ITEM, opensFromDrawer(), wardLookup('Save')).forEach(({ title, run }) => test(title, run));
});
