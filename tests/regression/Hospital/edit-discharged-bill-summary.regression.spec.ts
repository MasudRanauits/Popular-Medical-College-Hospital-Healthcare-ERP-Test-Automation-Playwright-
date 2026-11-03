import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { admissionLookup, cases, opensFromDrawer } from './_case-packs';

/**
 * EDIT DISCHARGED BILL SUMMARY @regression
 *
 * Corrects the totals on a discharged bill - the discount and what is left payable.
 * One of the three discharged-correction screens that has a picker; the other five make
 * the clerk type an invoice number from memory.
 *
 * Driven by the module's admission lookup. Read-only: nothing here submits.
 */

const ITEM = hospitalItem('EDIT DISCHARGED BILL SUMMARY');

test.describe('EDIT DISCHARGED BILL SUMMARY @regression', () => {
  cases(ITEM, opensFromDrawer(), admissionLookup('Save', { mayBeEmpty: true })).forEach(({ title, run }) => test(title, run));
});
