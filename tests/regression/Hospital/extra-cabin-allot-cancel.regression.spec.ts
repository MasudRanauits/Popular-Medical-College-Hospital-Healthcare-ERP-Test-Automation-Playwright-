import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { admissionLookup, cases, opensFromDrawer } from './_case-packs';

/**
 * Extra Cabin Allot/Cancel @regression
 *
 * Allots up to three extra beds to one admission - an attendant’s bed, or a second
 * cabin - and frees them again. Carries four Radzen lookups, only the first of which is
 * the patient; the page object picks it by label for that reason.
 *
 * Driven by the module's admission lookup. Read-only: nothing here submits.
 */

const ITEM = hospitalItem('Extra Cabin Allot/Cancel');

test.describe('Extra Cabin Allot/Cancel @regression', () => {
  cases(ITEM, opensFromDrawer(), admissionLookup('Save')).forEach(({ title, run }) => test(title, run));
});
