import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { admissionLookup, cases, opensFromDrawer } from './_case-packs';

/**
 * Advance Return @regression
 *
 * Gives an advance payment back. The mirror of Advance Collection, and just as much a
 * real money movement, so nothing here is saved.
 *
 * Driven by the module's admission lookup. Read-only: nothing here submits.
 */

const ITEM = hospitalItem('Advance Return');

test.describe('Advance Return @regression', () => {
  cases(ITEM, opensFromDrawer(), admissionLookup('Save')).forEach(({ title, run }) => test(title, run));
});
