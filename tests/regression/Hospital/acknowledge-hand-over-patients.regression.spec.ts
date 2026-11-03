import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, listScreen, opensFromDrawer } from './_case-packs';

/**
 * Acknowledge Hand Over Patients @regression
 *
 * Patients handed from one nurse to the next at shift change, waiting to be acknowledged
 * by the nurse taking them on. An EMR route, reached from the Hospital drawer.
 *
 * A report: read-only, and its columns are its contract.
 */

const ITEM = hospitalItem('Acknowledge Hand Over Patients');

test.describe('Acknowledge Hand Over Patients @regression', () => {
  cases(
    ITEM,
    opensFromDrawer(),
    listScreen([
      'INVOICENO', 'PATIENT NAME', 'CABINNO', 'HAND OVER BY', 'HAND OVER TO', 'ACTION'
    ])
  ).forEach(({ title, run }) => test(title, run));
});
