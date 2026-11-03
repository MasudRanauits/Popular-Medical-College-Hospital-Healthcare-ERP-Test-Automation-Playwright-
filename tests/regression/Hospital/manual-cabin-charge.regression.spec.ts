import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { admissionLookup, cases, opensFromDrawer } from './_case-packs';

/**
 * Manual Cabin Charge @regression
 *
 * Overrides what a patient is charged for their bed: a number of days at a rate, entered
 * by hand. The one screen in the family whose panel has no admission-number box, so the
 * page object falls back to the patient name when waiting for a pick to land.
 *
 * Driven by the module's admission lookup. Read-only: nothing here submits.
 */

const ITEM = hospitalItem('Manual Cabin Charge');

test.describe('Manual Cabin Charge @regression', () => {
  cases(ITEM, opensFromDrawer(), admissionLookup('Save')).forEach(({ title, run }) => test(title, run));
});
