import { test, expect } from '../../../fixtures';
import { HospitalUhidScreenPage, hospitalItem } from '../../../pages';
import { caseId, cases, opensFromDrawer, uhidLookup } from './_case-packs';

/**
 * IPD Service Entry (Billing Dept) @regression
 *
 * The billing department's copy of the ward's service entry: puts a charge on an
 * inpatient's bill from the billing desk rather than from the ward.
 *
 * One of the two screens driven by the module's UHID lookup - seven columns keyed on the
 * patient's hospital number rather than on their admission. Its control is labelled
 * "Admission No", exactly like the admission lookup everywhere else, and is a different
 * control behind the label. A suite that trusted that label read a gender out of the
 * column where it expected a name.
 *
 * Nothing here is saved.
 */

const ITEM = hospitalItem('IPD Service Entry (Billing Dept)');

test.describe('IPD Service Entry (Billing Dept) @regression', () => {
  const packed = cases(ITEM, opensFromDrawer(), uhidLookup());
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' picking a patient fills the service-entry form', async ({ page }) => {
    // Same risk as the ward screen - a charge on the wrong patient - so the same thing is
    // worth proving.
    const screen = new HospitalUhidScreenPage(page, ITEM);
    await screen.openScreen();

    const row = await screen.patientAt(0);
    const picked = await screen.selectPatient(0);

    expect(picked.uhid).toBe(row.uhid);
    await expect(screen.field('FullName')).toHaveValue(row.fullName);
    // The admission behind the UHID, which is what the charge actually attaches to.
    await expect(screen.field('InvoiceNo')).not.toHaveValue('');
  });
});
