import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, listScreen, opensFromDrawer } from './_case-packs';

/**
 * Patient Dashboard For Billing Dept @regression
 *
 * What the billing desk sees: every current admission with what it has cost so far and
 * what is still owed. The three money columns at the end are the reason the screen
 * exists, so the column list is pinned in full.
 *
 * A report: read-only, and its columns are its contract.
 */

const ITEM = hospitalItem('Patient Dashboard For Billing Dept');

test.describe('Patient Dashboard For Billing Dept @regression', () => {
  cases(
    ITEM,
    opensFromDrawer(),
    listScreen([
      'ADMISSIONNO', 'ADMISSION DATE', 'PATIENT NAME', 'MOBILENO', 'BLOODGROUP', 'BEDNO',
      'ASSIGNDOC', 'TOTAL', 'ADVANCE', 'SERVICE CHARGE', 'DUE'
    ])
  ).forEach(({ title, run }) => test(title, run));
});
