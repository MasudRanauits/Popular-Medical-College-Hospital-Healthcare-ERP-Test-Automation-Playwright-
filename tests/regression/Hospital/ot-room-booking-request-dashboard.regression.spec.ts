import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, listScreen, opensFromDrawer } from './_case-packs';

/**
 * OT Room Booking Request Dashboard @regression
 *
 * The same requests seen from the theatre side, with the scheduled date against each.
 *
 * A report: read-only, and its columns are its contract.
 */

const ITEM = hospitalItem('OT Room Booking Request Dashboard');

test.describe('OT Room Booking Request Dashboard @regression', () => {
  cases(
    ITEM,
    opensFromDrawer(),
    listScreen([
      'INVOICENO', 'PATIENT NAME', 'CABINNO', 'OTNAME', 'OTROOM', 'SCHEDULEDATE',
      'REQUESTDATE', 'REQUESTTIME', 'USERNAME'
    ])
  ).forEach(({ title, run }) => test(title, run));
});
