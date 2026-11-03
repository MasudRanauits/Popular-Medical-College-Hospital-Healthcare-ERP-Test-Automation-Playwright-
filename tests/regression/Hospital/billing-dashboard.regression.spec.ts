import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { admissionLookup, cases, opensFromDrawer } from './_case-packs';

/**
 * Billing Dashboard @regression
 *
 * The billing department's working screen for one admission: every service on the bill,
 * with a service head that can be added to it.
 *
 * Driven by the module's admission lookup. Read-only: nothing here submits.
 */

const ITEM = hospitalItem('Billing Dashboard');

test.describe('Billing Dashboard @regression', () => {
  cases(ITEM, opensFromDrawer(), admissionLookup('Save')).forEach(({ title, run }) => test(title, run));
});
