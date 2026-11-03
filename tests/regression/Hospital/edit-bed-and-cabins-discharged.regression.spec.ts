import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, dischargedEdit, opensFromDrawer } from './_case-packs';

/**
 * Edit Bed and Cabins ( Discharged ) @regression
 *
 * Corrects the bed charges on a discharged bill - which bed, for how many days, at what
 * rate.
 *
 * One of the five discharged-bill editors. There is no picker: the clerk types an invoice
 * number. Nothing here is saved - a Save on this screen changes what somebody was charged
 * after they were invoiced and sent home.
 */

const ITEM = hospitalItem('Edit Bed and Cabins ( Discharged )');

test.describe('Edit Bed and Cabins ( Discharged ) @regression', () => {
  cases(ITEM, opensFromDrawer(), dischargedEdit()).forEach(({ title, run }) => test(title, run));
});
