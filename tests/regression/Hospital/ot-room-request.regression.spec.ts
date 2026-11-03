import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, listScreen, opensFromDrawer } from './_case-packs';

/**
 * OT Room Request @regression
 *
 * Requests raised by a ward for a theatre slot, with who asked and when.
 *
 * A report: read-only, and its columns are its contract.
 */

const ITEM = hospitalItem('OT Room Request');

test.describe('OT Room Request @regression', () => {
  cases(
    ITEM,
    opensFromDrawer(),
    listScreen([
      'INVOICENO', 'PATIENT NAME', 'OTROOM', 'REQUESTDATE', 'REQUESTTIME', 'USERNAME'
    ])
  ).forEach(({ title, run }) => test(title, run));
});
