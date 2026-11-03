import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, dischargedEdit, opensFromDrawer } from './_case-packs';

/**
 * Edit Food and Beverage ( Discharged) @regression
 *
 * Corrects the food and beverage charges on a discharged bill.
 *
 * It announces itself as "DISCHARGED CABIN CHARGE" - the same page title as Edit Bed and
 * Cabins - so a clerk landing here from the menu has nothing on screen telling them which
 * of the two they are in. That collision is pinned in _module.regression.spec.ts.
 *
 * One of the five discharged-bill editors. There is no picker: the clerk types an invoice
 * number. Nothing here is saved - a Save on this screen changes what somebody was charged
 * after they were invoiced and sent home.
 */

const ITEM = hospitalItem('Edit Food and Beverage ( Discharged)');

test.describe('Edit Food and Beverage ( Discharged) @regression', () => {
  cases(ITEM, opensFromDrawer(), dischargedEdit()).forEach(({ title, run }) => test(title, run));
});
