import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, opensFromDrawer, wardLookup } from './_case-packs';

/**
 * OT Info (NS) @regression
 *
 * The nurse station’s view of an operation - what it was and who did it, without the
 * billing lines.
 *
 * Driven by the ward's "Search Patient" lookup. Read-only: nothing here submits.
 */

const ITEM = hospitalItem('OT Info (NS)');

test.describe('OT Info (NS) @regression', () => {
  cases(ITEM, opensFromDrawer(), wardLookup('Save')).forEach(({ title, run }) => test(title, run));
});
