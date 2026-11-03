import { test, expect } from '../../../fixtures';
import { HospitalGridPage, hospitalItem } from '../../../pages';
import { caseId, cases, listScreen, opensFromDrawer } from './_case-packs';

/**
 * Print Discharged Patient admission form @regression
 *
 * Reprints an admission form after the patient has gone home.
 *
 * It opens empty by design - there is no "all discharged patients" list behind it - so the
 * three boxes above the grid are the whole screen. A clerk who does not have one of those
 * three keys cannot use it at all.
 */

const ITEM = hospitalItem('Print Discharged Patient admission form');

test.describe('Print Discharged Patient admission form @regression', () => {
  const packed = cases(ITEM, opensFromDrawer(), listScreen(['INVOICENO', 'NAME', 'MOBILE NO', 'ASSIGNED DOCTOR', 'DISCHARGE DATE']));
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' it offers three ways in and opens with no patient', async ({
    page,
  }) => {
    const screen = new HospitalGridPage(page, ITEM);
    await screen.openGrid();

    for (const label of ['Invoice No', 'UHID', 'Mobile No']) {
      await expect(
        page.getByText(new RegExp(`^\\s*${label}\\s*$`, 'i')).first(),
        `the print-discharged screen lost its "${label}" box`
      ).toBeVisible();
    }

    // Opening empty is the point: it is a lookup, not a report.
    await expect(screen.rows).toHaveCount(0);
  });
});
