import { test, expect } from '../../../fixtures';
import { HospitalGridPage, hospitalItem } from '../../../pages';
import { caseId, cases, listScreen, opensFromDrawer } from './_case-packs';

/**
 * Mpo Change History @regression
 *
 * An audit trail: who moved a patient from one marketing officer to another, when, and
 * what the officer was before.
 *
 * Only useful filtered, so it ships with its filter controls on screen and its grid empty.
 * What is asserted is the controls, not a row count - an audit trail is legitimately empty
 * on a quiet day, and a case that demanded rows would fail for the best possible reason.
 */

const ITEM = hospitalItem('Mpo Change History');

test.describe('Mpo Change History @regression', () => {
  const packed = cases(ITEM, opensFromDrawer(), listScreen(['DATE / TIME', 'UHID', 'PATIENT', 'INV NO', 'PREVIOUS MPO', 'CURRENT MPO', 'CHANGED BY']));
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' it opens on its six filters rather than on everything', async ({
    page,
  }) => {
    const screen = new HospitalGridPage(page, ITEM);
    await screen.openGrid();

    for (const label of ['From', 'To', 'UHID', 'Invoice No', 'Patient Name', 'Changed By']) {
      await expect(
        page.getByText(new RegExp(`^\\s*${label}\\s*$`, 'i')).first(),
        `Mpo Change History lost its "${label}" filter`
      ).toBeVisible();
    }

    await expect(page.getByRole('button', { name: /^search$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^clear$/i })).toBeVisible();
  });
});
