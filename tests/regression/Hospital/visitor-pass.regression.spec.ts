import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { admissionLookup, cases, opensFromDrawer } from './_case-packs';

/**
 * Visitor Pass @regression
 *
 * Sells visitor cards against an admission - how many, at what rate, paid how. The
 * payment fields are left alone here.
 *
 * Driven by the module's admission lookup. Read-only: nothing here submits.
 */

const ITEM = hospitalItem('Visitor Pass');

test.describe('Visitor Pass @regression', () => {
  cases(ITEM, opensFromDrawer(), admissionLookup('Save')).forEach(({ title, run }) => test(title, run));
});
