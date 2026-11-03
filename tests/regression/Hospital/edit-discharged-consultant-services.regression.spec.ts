import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, dischargedEdit, opensFromDrawer } from './_case-packs';

/**
 * EDIT DISCHARGED CONSULTANT SERVICES @regression
 *
 * Takes a consultant visit off a discharged bill, or changes what it cost.
 *
 * One of the five discharged-bill editors. There is no picker: the clerk types an invoice
 * number. Nothing here is saved - a Save on this screen changes what somebody was charged
 * after they were invoiced and sent home.
 */

const ITEM = hospitalItem('EDIT DISCHARGED CONSULTANT SERVICES');

test.describe('EDIT DISCHARGED CONSULTANT SERVICES @regression', () => {
  cases(ITEM, opensFromDrawer(), dischargedEdit()).forEach(({ title, run }) => test(title, run));
});
