import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, opensFromDrawer, wardLookup } from './_case-packs';

/**
 * OT Service Entry @regression
 *
 * Records an operation against a patient: the indication, the incision, the anaesthesia,
 * the surgeon, the times, and the service lines it is billed as.
 *
 * Driven by the ward's "Search Patient" lookup. Read-only: nothing here submits.
 */

const ITEM = hospitalItem('OT Service Entry');

test.describe('OT Service Entry @regression', () => {
  cases(ITEM, opensFromDrawer(), wardLookup('Save')).forEach(({ title, run }) => test(title, run));
});
