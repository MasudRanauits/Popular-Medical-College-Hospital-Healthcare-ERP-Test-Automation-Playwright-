import { test, expect } from '../../../fixtures';
import { HospitalDateDashboardPage, hospitalItem } from '../../../pages';
import { caseId, cases, dateDashboard, opensFromDrawer } from './_case-packs';
import { daysAgo, isoDate } from '../../../utils/helpers';

/**
 * Advance Dashboard @regression
 *
 * Every advance payment taken over a date range, with who paid and when.
 *
 * The screen the date-range family's behaviour is worked on, since all six share the
 * shape. Read-only throughout: the suite sets a range and reads what comes back.
 */

const ITEM = hospitalItem('Advance Dashboard');

test.describe('Advance Dashboard @regression', () => {
  const packed = cases(ITEM, opensFromDrawer(), dateDashboard());
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' Show fills the grid for the range asked for', async ({ page }) => {
    const dashboard = new HospitalDateDashboardPage(page, ITEM);
    await dashboard.openDashboard();

    await expect(dashboard.rows, 'the grid had rows before Show was pressed').toHaveCount(0);

    // A week back: long enough that a hospital this size has taken an advance payment in
    // it, short enough that the report comes back quickly.
    await dashboard.setRange(daysAgo(7), isoDate());
    await dashboard.show_();

    await expect(
      dashboard.rows.first(),
      'no advance payments in the last seven days'
    ).toBeVisible({ timeout: 60_000 });

    await expect(dashboard.headers).toHaveText([
      /ADMISSION ID/i,
      /PATIENT NAME/i,
      /PAY DATE/i,
      /PAY TIME/i,
      /AMOUNT/i,
      // The grid carries a trailing unlabelled column for its row action.
      /^$/,
    ]);

    // Every row is a payment: an admission number and an amount, both filled in.
    for (const row of await dashboard.read()) {
      expect(row[0], 'a row with no admission number').toMatch(/^\d{10,}$/);
      expect(row[4], 'a row with no amount').toMatch(/\d/);
    }
  });

  test(caseId(ITEM, next++) + ' a range in the future comes back with nothing', async ({ page }) => {
    // The honest negative: a report that returns rows for a range that has not happened is
    // ignoring its own filter, which is the failure mode worth catching on a date screen.
    const dashboard = new HospitalDateDashboardPage(page, ITEM);
    await dashboard.openDashboard();

    const future = isoDate(new Date(Date.now() + 365 * 86_400_000));
    await dashboard.setRange(future, future);
    await dashboard.show_();

    await expect(dashboard.rows).toHaveCount(0);
  });

  test(caseId(ITEM, next++) + ' a wider range never returns fewer rows than a narrower one inside it', async ({
    page,
  }) => {
    /**
     * A property rather than a fixture: whatever the ward did this week, a report over
     * thirty days must contain at least what the report over seven days contained.
     *
     * Both reads are taken at the top page size the grid offers, so the comparison is
     * between two full pages rather than between two pages of ten.
     */
    test.setTimeout(240_000);

    const dashboard = new HospitalDateDashboardPage(page, ITEM);
    await dashboard.openDashboard();
    await dashboard.pageSize.selectOption('250');

    await dashboard.setRange(daysAgo(7), isoDate());
    await dashboard.show_();
    const week = await dashboard.rows.count();

    await dashboard.setRange(daysAgo(30), isoDate());
    await dashboard.show_();
    const month = await dashboard.rows.count();

    expect(
      month,
      `30 days returned ${month} rows, 7 days returned ${week}`
    ).toBeGreaterThanOrEqual(week);
  });
});
