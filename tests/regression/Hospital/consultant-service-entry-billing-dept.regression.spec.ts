import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, opensFromDrawer, uhidLookup } from './_case-packs';

/**
 * Consultant Service Entry (Billing Dept) @regression
 *
 * The billing department's consultancy entry, and one of the two screens driven by the
 * module's UHID lookup - seven columns keyed on the patient's hospital number rather than
 * on their admission.
 *
 * Its control is labelled "Adm.No" and is not the admission lookup that label names
 * everywhere else in the module.
 *
 * Read-only: nothing here submits.
 */

const ITEM = hospitalItem('Consultant Service Entry (Billing Dept)');

test.describe('Consultant Service Entry (Billing Dept) @regression', () => {
  cases(ITEM, opensFromDrawer(), uhidLookup()).forEach(({ title, run }) => test(title, run));
});
