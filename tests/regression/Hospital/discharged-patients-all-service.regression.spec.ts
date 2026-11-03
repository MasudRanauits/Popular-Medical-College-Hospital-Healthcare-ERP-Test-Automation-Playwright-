import { test, expect } from '../../../fixtures';
import { HospitalPatientScreenPage, hospitalItem } from '../../../pages';
import { admissionLookup, caseId, cases, opensFromDrawer } from './_case-packs';

/**
 * Discharged Patients All Service @regression
 *
 * The four discharged-bill editors gathered onto one screen, a tab each: IPD services,
 * consultancy, theatre and the bill summary.
 *
 * One of the three correction screens that has a picker. The other five make the clerk
 * type an invoice number from memory - the inconsistency is pinned in _module.regression.
 *
 * Nothing here is saved. A Save on any of these tabs changes what somebody was charged
 * after they were invoiced and sent home.
 */

const ITEM = hospitalItem('Discharged Patients All Service');

test.describe('Discharged Patients All Service @regression', () => {
  const packed = cases(ITEM, opensFromDrawer(), admissionLookup('Save', { mayBeEmpty: true }));
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' it splits the bill across its four tabs', async ({ page }) => {
    // The tabs are the contract: lose one and that part of a discharged bill becomes
    // unreachable from here.
    const screen = new HospitalPatientScreenPage(page, ITEM);
    await screen.openScreen();

    for (const tab of [
      'IPDSERVICE ENTRY',
      'CONSULTANCY SERVICE ENTRY',
      'OT SERVICE ENTRY',
      'BILL SUMMARY',
    ]) {
      await expect(
        page.getByText(tab, { exact: false }).first(),
        `Discharged Patients All Service lost its "${tab}" tab`
      ).toBeVisible();
    }
  });
});
