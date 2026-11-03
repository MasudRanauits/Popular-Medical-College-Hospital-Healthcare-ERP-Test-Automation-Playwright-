import { test, expect } from '../../../fixtures';
import { HospitalGridPage, hospitalItem } from '../../../pages';
import { caseId, cases, opensFromDrawer } from './_case-packs';

/**
 * IPD Service Entry Dashboard @regression
 *
 * Every service entered onto an inpatient bill over a period, with who entered it - the
 * report the billing office reconciles the ward's charging against.
 *
 * The one report in the module with preset ranges (Today, Yesterday, Last 7 days, This
 * month) rather than two date boxes, so those are what it is used through and what is
 * checked. Its grid is MudBlazor, like Service Heads and Billing Dashboard (Counter).
 *
 * Read-only.
 */

const ITEM = hospitalItem('IPD Service Entry Dashboard');

test.describe('IPD Service Entry Dashboard @regression', () => {
  const packed = cases(ITEM, opensFromDrawer());
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' it offers its four quick ranges and an export', async ({ page }) => {
    const screen = new HospitalGridPage(page, ITEM);
    await screen.openGrid();

    for (const range of ['Today', 'Yesterday', 'Last 7 days', 'This month']) {
      await expect(
        page.getByRole('button', { name: new RegExp(`^${range}$`, 'i') }),
        `the service-entry report lost its "${range}" range`
      ).toBeVisible();
    }

    await expect(
      page.getByRole('button', { name: /export excel/i }),
      'the service-entry report lost its export'
    ).toBeVisible();
  });

  test(caseId(ITEM, next++) + ' it answers a quick range with the services entered in it', async ({
    page,
  }) => {
    const screen = new HospitalGridPage(page, ITEM);
    await screen.openGrid();

    /**
     * Two steps, not one: the range sets the dates and **Load** fetches the report.
     *
     * Easy to miss, and it fails quietly rather than loudly - pressing a range on its own
     * leaves the grid showing "No entries match.", which reads exactly like a period in
     * which the hospital charged nothing.
     *
     * "Last 7 days" rather than "This month", and the reason is worth writing down: on the
     * first of the month, "This month" sets both dates to today and the report is
     * legitimately empty. A case written against it passes all month and fails on the 1st,
     * looking exactly like a broken report. Seven days always spans a working day.
     */
    const lastWeek = page.getByRole('button', { name: /^last 7 days$/i });
    await expect(lastWeek, 'the report never offered its Last 7 days range').toBeEnabled({
      timeout: 120_000,
    });
    await lastWeek.click();

    await page.getByRole('button', { name: /^load$/i }).click();

    /**
     * Polled on the cells rather than on the rows, and that is the point of the case.
     *
     * The report renders a single placeholder row - "Nothing loaded yet." - in the same
     * tbody it will fill. That row is a row: it is visible, it is the first row, and a
     * wait for a visible row is satisfied by it instantly while the month's data is still
     * in flight. It carries no `td` of its own, which is what tells the two apart.
     */
    await expect
      .poll(() => screen.rows.first().locator('td').count(), {
        message: 'the service-entry report came back with no services for the last seven days',
        timeout: 120_000,
      })
      .toBeGreaterThan(3);

    // A hospital of this size enters services every day, so a week has to hold a few.
    expect(await screen.rows.count(), 'services entered in the last seven days').toBeGreaterThan(1);
  });
});
