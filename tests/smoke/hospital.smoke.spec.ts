import { test, expect } from '../../fixtures';
import {
  HOSPITAL_MENU,
  HospitalScreenPage,
  HospitalPatientScreenPage,
  hospitalItem,
} from '../../pages';

/**
 * Smoke: the Hospital module.
 *
 * The build gate for the hospital's inpatient side. It runs on every build, so it holds
 * only the screens a ward cannot work without - twelve of the module's eighty - and asks
 * one question of each: did it come up.
 *
 * What is in and what is not
 * --------------------------
 * In: the admission dashboard, the admission wizard, the bed board, the nurse station, bed
 * transfer, admission cancel, the two bills, advance collection, the two service-entry
 * screens and the diet indent. Those are the screens that stand between a patient arriving
 * and a patient being billed; any one of them dark is a stop-the-line failure.
 *
 * Out: the fourteen setup grids, the date-range reports, the discharged-patient correction
 * screens and the OT masters. Every one of them matters, none of them is on the critical
 * path for the next four hours, and all of them are covered case by case in
 * tests/regression/Hospital/.
 *
 * The list is not maintained here. A screen is in the smoke suite when its entry in
 * HOSPITAL_MENU carries `smoke: true`, so the register and the gate cannot drift apart.
 *
 * Nothing here writes. Smoke on a live hospital ERP means opening screens and reading them.
 * Runs on the session tests/auth.setup.ts saves.
 */

const CRITICAL = HOSPITAL_MENU.filter((item) => item.smoke);

test.describe('Hospital @smoke', () => {
  test('the Hospital module opens from the launcher with its menu', async ({
    hospitalMenuPage,
  }) => {
    await hospitalMenuPage.openDrawer();

    // The drawer being up at all is the module being alive. The exact eighty are
    // HOSP-NAV-001's business, not the build gate's.
    const hrefs = await hospitalMenuPage.hrefs();
    expect(hrefs.length, 'entries in the Hospital drawer').toBeGreaterThanOrEqual(CRITICAL.length);

    for (const item of CRITICAL) {
      expect(hrefs, `"${item.label}" is missing from the drawer`).toContain(item.href);
    }
  });

  /** One case per critical screen, so a dark screen is named in the report. */
  for (const item of CRITICAL) {
    test(`${item.label} comes up`, async ({ page }) => {
      const screen = new HospitalScreenPage(page, item);

      await screen.open();

      await screen.expectLoaded();
    });
  }

  test('the admission dashboard lists the patients currently admitted', async ({
    admissionDashboardPage,
  }) => {
    // One step past "it rendered": the dashboard is the ward's register, and an empty one
    // on a running hospital means the data behind it is gone, not that the beds are.
    await admissionDashboardPage.goto();
    await admissionDashboardPage.expectLoaded();

    await expect(admissionDashboardPage.rows.first()).toBeVisible({ timeout: 60_000 });
    const admissionNo = await admissionDashboardPage.cell(
      admissionDashboardPage.rows.first(),
      'admissionNo'
    );
    expect(admissionNo, 'the first row carries no admission number').toMatch(/^\d{10,}$/);
  });

  test('the bed board knows which beds are free', async ({ cabinDashboardPage }) => {
    await cabinDashboardPage.openBoard();

    const census = await cabinDashboardPage.census();
    expect(census.booked + census.free + census.housekeeping, 'beds on the board').toBeGreaterThan(
      100
    );
    // Both states present: a board that has lost its occupancy data shows one colour.
    expect(census.booked, 'booked beds').toBeGreaterThan(0);
    expect(census.free, 'free beds').toBeGreaterThan(0);
  });

  test('an admission can be looked up and loaded onto a billing screen', async ({ page }) => {
    /**
     * The one end-to-end read in the suite, and the thing most worth smoking: the lookup
     * finds a real inpatient and the screen loads that inpatient's record.
     *
     * Advance Collection rather than Admission Cancel - the two screens are identical in
     * everything this case touches, and smoke should not be pointing at the cancel button
     * on a production system even to look at it.
     */
    const screen = new HospitalPatientScreenPage(page, hospitalItem('Advance Collection'));
    await screen.openScreen();

    const row = await screen.admissionAt(0);
    expect(row.invoiceNo, 'the admission lookup listed nobody').toMatch(/^\d{10,}$/);

    const panel = await screen.selectAdmission(0);

    expect(panel.invoiceNo).toBe(row.invoiceNo);
    expect(panel.fullName).toBe(row.fullName);
    expect(panel.cabinNo).toBe(row.cabinNo);
  });
});
