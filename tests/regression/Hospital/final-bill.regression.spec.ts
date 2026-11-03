import { test, expect } from '../../../fixtures';
import { HospitalGridPage, hospitalItem } from '../../../pages';
import { caseId, cases, listScreen, opensFromDrawer } from './_case-packs';

/**
 * FINAL BILL @regression
 *
 * The screen that ends an admission: the patients ready to be billed out, and the buttons
 * that do it - Generate Bill, Generate Package Bill, Send Discharge Notification, Transfer
 * To Temporary Cabin.
 *
 * Those are the most consequential buttons in the module. This suite proves they are there
 * and presses none of them.
 */

const ITEM = hospitalItem('FINAL BILL');

test.describe('FINAL BILL @regression', () => {
  const packed = cases(ITEM, opensFromDrawer(), listScreen(['INVOICE NO', 'NAME', 'MOBILENO', 'CABINNO', 'ASSIGN DOCTOR', 'ACTION']));
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' it lists the patients awaiting a final bill, with every action it offers', async ({
    page,
  }) => {
    const screen = new HospitalGridPage(page, ITEM);
    await screen.openGridWithRows();

    for (const invoice of await screen.columnValues('INVOICE NO')) {
      expect(invoice, 'a row with no invoice number').toMatch(/\d/);
    }

    for (const action of [
      'Reload',
      'Send Discharge Notification',
      'Transfer To Temporary Cabin',
      'Generate Bill',
      'Generate Package Bill',
    ]) {
      await expect(
        page.getByRole('button', { name: new RegExp(`^${action}$`, 'i') }).first(),
        `FINAL BILL lost its "${action}" button`
      ).toBeVisible();
    }
  });

  test(caseId(ITEM, next++) + ' it filters to one patient and back', async ({ page }) => {
    const screen = new HospitalGridPage(page, ITEM);
    await screen.openGridWithRows();

    const before = await screen.rows.count();
    const [name] = await screen.columnValues('NAME');
    expect(name, 'the FINAL BILL list came back empty').not.toBe('');

    await screen.searchFor(name);

    const matches = await screen.columnValues('NAME');
    expect(matches.length, `nothing came back for "${name}"`).toBeGreaterThan(0);
    for (const match of matches) expect(match.toLowerCase()).toContain(name.toLowerCase());

    await screen.searchFor('');
    await expect(screen.rows).toHaveCount(before);
  });
});
