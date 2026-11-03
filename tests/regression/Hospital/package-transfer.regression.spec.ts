import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, opensFromDrawer, wardLookup } from './_case-packs';

/**
 * Package Transfer @regression
 *
 * Moves a patient from one fixed-price package to another.
 *
 * Driven by the ward's "Search Patient" lookup. Read-only: nothing here submits.
 */

const ITEM = hospitalItem('Package Transfer');

test.describe('Package Transfer @regression', () => {
  cases(ITEM, opensFromDrawer(), wardLookup('Save')).forEach(({ title, run }) => test(title, run));
});
