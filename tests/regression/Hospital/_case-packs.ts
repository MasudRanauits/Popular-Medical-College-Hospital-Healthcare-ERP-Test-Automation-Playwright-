import type { Page, TestInfo, TestType } from '@playwright/test';
import { test, expect } from '../../../fixtures';
import {
  DischargedEditPage,
  HospitalDateDashboardPage,
  HospitalGridPage,
  HospitalPatientScreenPage,
  HospitalScreenPage,
  HospitalUhidScreenPage,
  HospitalWardScreenPage,
  hospitalItem,
  type HospitalMenuItem,
} from '../../../pages';
import { daysAgo, isoDate } from '../../../utils/helpers';

/**
 * Shared cases for the Hospital module's per-menu suites.
 *
 * There is one spec file per drawer menu in this folder, named after the menu, so finding
 * a screen's coverage is a matter of reading the file list. Most of those menus are one of
 * six recurring shapes, though, and writing the same twenty lines seventy-seven times would
 * make every one of them worse: a fix to how a grid is settled would have to land in
 * eighteen files, and in practice would land in nine.
 *
 * So the shape lives here and the menu file says which shape it is:
 *
 *   const packed = cases(ITEM, opensFromDrawer(), setupGrid());
 *   packed.forEach(({ title, run }) => test(title, run));
 *   let next = packed.length + 1;
 *   test(caseId(ITEM, next++) + ' ...', async ({ page }) => { ... });  // its own behaviour
 *
 * Note what that loop is doing: the builders below return a title and a body, and the menu
 * file is what calls `test()`. That is deliberate. Playwright takes a test's reported file
 * from the call site, so a pack that called `test()` itself would file every one of these
 * cases under _case-packs.ts - and a report where two hundred cases all claim to live in
 * one shared helper is exactly the problem this folder was reorganised to fix.
 *
 * Case ids are derived from the menu name, so every id says which screen it belongs to:
 * CABIN-RELEASE-001, DRAFT-BILL-002, and so on.
 */

/**
 * The body of a test, typed against this project's own fixtures.
 *
 * Pulled out of the `test` object rather than off `Parameters<typeof test>`: `test()` is
 * overloaded, so indexing its parameters picks the `(title, details, body)` overload and
 * hands back `TestDetails` instead of a function. Inferring the fixture types out of the
 * TestType is what keeps `page`, `cabinDashboardPage` and the rest typed inside a pack.
 */
type TestBody = typeof test extends TestType<infer Args, infer Workers>
  ? (args: Args & Workers, testInfo: TestInfo) => Promise<void> | void
  : never;

/** One case, ready for the menu file to declare. */
export interface HospitalCase {
  title: string;
  run: TestBody;
}

/** A case before it has been numbered. */
type Builder = (item: HospitalMenuItem) => { suffix: string; run: TestBody };

/** The file-name and case-id stem for a menu, e.g. "Billing Dashboard(Counter)" → billing-dashboard-counter. */
export function menuSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The case id for the nth case of a menu's suite, e.g. caseId(item, 1) → "CABIN-RELEASE-001". */
export function caseId(item: HospitalMenuItem, n: number): string {
  return `${menuSlug(item.label).toUpperCase()}-${String(n).padStart(3, '0')}`;
}

/** Numbers a menu's shared cases, in the order they are listed. */
export function cases(item: HospitalMenuItem, ...builders: Builder[]): HospitalCase[] {
  return builders.map((build, index) => {
    const { suffix, run } = build(item);
    return { title: `${caseId(item, index + 1)} ${suffix}`, run };
  });
}

/**
 * Every menu's first case: the route behind the drawer entry is its own screen.
 *
 * Deep-linked rather than clicked through the drawer. Opening the drawer is its own
 * subject, with its own cases in _module.regression.spec.ts; what this proves is the route
 * and the screen behind it.
 *
 * `HospitalScreenPage.expectLoaded` waits for the screen's own page title - or, on the five
 * screens that render none, for a tab or column only that screen has - checks the title is
 * the one HOSPITAL_MENU records for this menu, and checks no Access Denied is left on
 * screen. That last part matters: the Blazor router prerenders its NotAuthorized template
 * on *every* route in this ERP, so "Access Denied" flashes up for about a third of a second
 * everywhere and means nothing.
 */
export const opensFromDrawer = (): Builder => (item) => ({
  suffix: `${item.label} opens its own screen @nav`,
  run: async ({ page }) => {
    const screen = new HospitalScreenPage(page, item);

    await screen.open();

    await screen.expectLoaded();
    await expect(page).toHaveURL(
      new RegExp(item.href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    );
  },
});

/**
 * A reference-data grid: Areas, District, Cabin, the OT masters and the rest.
 *
 * Asserts only that the grid rendered with named columns, because that is all eighteen of
 * these screens genuinely have in common. Their toolbars do not match each other at all -
 * fifteen open a create dialog from "Add New", three add a row inline from "New", three
 * have no filter box, seven have no page-size box - and the whole map is pinned in one
 * place, HOSP-MOD-006, rather than asserted screen by screen.
 */
export const setupGrid = (): Builder => (item) => ({
  suffix: `${item.label} renders its grid`,
  run: async ({ page }) => {
    const screen = new HospitalGridPage(page, item);

    await screen.openGrid();

    const columns = (await screen.columns()).filter((name) => name !== '');
    expect(columns.length, `${item.label} column headers`).toBeGreaterThan(0);
  },
});

/**
 * A report or board, whose columns are its contract.
 *
 * Unlike the setup grids, these get their column list pinned in full. A dashboard that
 * quietly loses its DUE column, or renames ASSIGNDOC, is still a working page and a broken
 * report - nothing errors, the number just stops being on screen.
 *
 * Trailing blank headers are dropped before comparing: several of these grids end with an
 * unlabelled column holding a row button, which is styling rather than part of the report.
 */
export const listScreen =
  (columns: string[], gridSelector?: string): Builder =>
  (item) => ({
    suffix: `${item.label} reports under its own columns`,
    run: async ({ page }) => {
      const screen = new HospitalGridPage(page, item, gridSelector);

      await screen.openGrid();

      const actual = (await screen.columns()).filter((name) => name !== '');
      expect(actual, `${item.label} columns`).toEqual(columns);
    },
  });

/** The four columns the admission lookup can print. Not every screen prints all four. */
const ADMISSION_LOOKUP_COLUMNS = ['InvoiceNo', 'CabinNo', 'FullName', 'Mobile'];

/**
 * An admission number, as this ERP actually issues them.
 *
 * Six digits or more, not the eleven a current inpatient carries. Today's admissions look
 * like 26020019315, but the discharged screens reach back years and those are shorter -
 * 240310115 is a real one, nine digits. A suite that learned the pattern off the live ward
 * and applied it to the discharged lookups failed on perfectly good data.
 */
const ADMISSION_NUMBER = /^\d{6,}$/;

/**
 * A screen driven by the module's admission lookup - the control labelled "Admission No",
 * "Invoice No" or "Adm.No".
 *
 * The column list is checked as a subset rather than an exact match: most of these screens
 * print all four, and IPD Due Collection and Edit Discharged Bill Summary print three,
 * dropping CabinNo. What has to be true everywhere is that the two columns a clerk
 * identifies a patient by are there.
 *
 * `action` is the screen's own button, where it has one. IPD Service Dashboard has none -
 * it is a read-only view of what an admission has been charged.
 *
 * `mayBeEmpty` is for the four screens whose lookup is a filtered subset rather than the
 * ward: IPD Due Collection lists only admissions that still owe money, Edit/Delete Services
 * only those with a service that can still be edited, and the two discharged-correction
 * screens only bills still inside whatever window the ERP allows a correction in. All four
 * have been seen both full and empty within an hour, and a case that demanded a row there
 * would fail for the best possible reason. Every other screen in the family lists the whole
 * ward, so an empty lookup is a real failure and is reported as one.
 */
export const admissionLookup =
  (action: string | null, { mayBeEmpty = false }: { mayBeEmpty?: boolean } = {}): Builder =>
  (item) => ({
    suffix: `${item.label} lists admissions in its lookup`,
    run: async ({ page }) => {
      const screen = new HospitalPatientScreenPage(page, item);

      await screen.openScreen();
      await screen.openLookup();

      const columns = await screen.columns();
      expect(columns.length, `${item.label} lookup columns`).toBeGreaterThan(0);
      for (const column of columns) {
        expect(ADMISSION_LOOKUP_COLUMNS, `${item.label} prints an unknown column`).toContain(
          column
        );
      }
      for (const required of ['InvoiceNo', 'FullName']) {
        expect(columns, `${item.label} lookup has no ${required}`).toContain(required);
      }

      const listed = await screen.lookupResults.count();
      if (listed === 0 && mayBeEmpty) {
        test.info().annotations.push({
          type: 'lookup',
          description: `${item.label} is listing nobody - its lookup is a filtered subset, so this is data rather than a defect`,
        });
      } else {
        expect(listed, `${item.label} listed no admissions at all`).toBeGreaterThan(0);

        // The other columns can legitimately be empty on a given admission, so only the
        // key is asserted across the board.
        const first = await screen.readRow(screen.lookupResults.first());
        expect(first.invoiceNo, `${item.label} listed a row with no admission number`).toMatch(
          ADMISSION_NUMBER
        );
      }

      if (action) {
        await expect(screen.action(action), `${item.label} has no ${action}`).toBeVisible();
      }
    },
  });

/**
 * A screen driven by the ward's "Search Patient" lookup.
 *
 * The module's *second* patient picker, and not interchangeable with the one above: three
 * columns instead of four, five rows a page instead of ten, readonly panel fields instead
 * of disabled ones, and - the difference a user runs into - it searches the admission
 * number, which the admission lookup does not.
 *
 * Columns are compared as a set, because IPD Medicine Return prints the same three in its
 * own order. Everything in HospitalWardScreenPage reads by header name for that reason.
 */
export const wardLookup =
  (action: string): Builder =>
  (item) => ({
    suffix: `${item.label} lists the ward in its Search Patient lookup`,
    run: async ({ page }) => {
      const screen = new HospitalWardScreenPage(page, item);

      await screen.openScreen();
      await screen.openLookup();

      expect((await screen.columns()).slice().sort(), `${item.label} lookup columns`).toEqual(
        [...HospitalWardScreenPage.LOOKUP_COLUMNS].sort()
      );

      const first = await screen.readRow(screen.lookupResults.first());
      expect(first.cabinNo, `${item.label} listed a patient with no bed`).not.toBe('');
      expect(first.invoiceNo, `${item.label} listed a row with no admission number`).toMatch(
        ADMISSION_NUMBER
      );

      await expect(screen.action(action), `${item.label} has no ${action}`).toBeVisible();
    },
  });

/**
 * One of the billing department's two entry screens, driven by the UHID lookup.
 *
 * The module's fourth patient picker. Its control is labelled "Admission No" exactly like
 * the admission lookup's and is a different thing behind the label: seven columns keyed on
 * the UHID. The two screens using it cannot even agree on how to spell three of those
 * column headers, which is why the page object reads them by meaning.
 */
export const uhidLookup = (): Builder => (item) => ({
  suffix: `${item.label} picks its patient by UHID`,
  run: async ({ page }) => {
    const screen = new HospitalUhidScreenPage(page, item);

    await screen.openScreen();
    await screen.openLookup();

    const row = await screen.readRow(screen.lookupResults.first());
    expect(row.uhid, `${item.label} listed a patient with no UHID`).toMatch(/^\d{6,}$/);
    expect(row.fullName, `${item.label} listed a patient with no name`).not.toBe('');
    expect(row.cabinNo, `${item.label} listed a patient with no bed`).not.toBe('');

    await expect(screen.action('Save'), `${item.label} has no Save`).toBeVisible();
  },
});

/**
 * A date-range report: two date boxes, a Show button, and a grid that stays empty until
 * Show is pressed.
 *
 * The opening state is the thing worth pinning. These screens come up with both dates on
 * today and nothing in the grid, so an empty grid here is normal rather than a failure -
 * and a build that defaulted the range to "this month" would quietly change what every
 * clerk sees first.
 *
 * The dates are polled rather than read once: flatpickr stamps today's date in a moment
 * after the box is on screen, so a single read taken the instant the page settles sees an
 * empty string - rarely on an idle host, reliably when the whole suite is running.
 */
export const dateDashboard = (): Builder => (item) => ({
  suffix: `${item.label} opens on today with an empty grid`,
  run: async ({ page }) => {
    const dashboard = new HospitalDateDashboardPage(page, item);

    await dashboard.openDashboard();

    const today = HospitalDateDashboardPage.todayValues();
    for (const [end, box] of [
      ['Start Date', dashboard.startDate],
      ['End Date', dashboard.endDate],
    ] as const) {
      await expect
        .poll(async () => today.includes(await box.inputValue()), {
          message: `${item.label} did not open with ${end} on today (${today.join(' or ')})`,
          timeout: 30_000,
        })
        .toBe(true);
    }

    await expect(dashboard.show, `${item.label} has no Show button`).toBeVisible();

    // Headers are rendered up front; rows are not fetched until Show.
    expect((await dashboard.columns()).length, `${item.label} column headers`).toBeGreaterThan(0);
  },
});

/**
 * One of the five discharged-bill editors, which load a bill by typed invoice number.
 *
 * There is no picker on these screens - a bare numeric box, and the clerk types a number
 * they are expected to already know. Nothing lists the discharged patients and nothing
 * validates the number as it is typed.
 */
export const dischargedEdit = (): Builder => (item) => ({
  suffix: `${item.label} opens on an empty invoice box`,
  run: async ({ page }) => {
    const screen = new DischargedEditPage(page, item);

    await screen.openScreen();

    // A number box, so the browser itself refuses letters - the only validation there is.
    await expect(screen.invoiceNo).toHaveAttribute('type', 'number');
    await expect(screen.invoiceNo).toBeEditable();
    await expect(screen.save, `${item.label} has no Save`).toBeVisible();

    // Nothing loaded, so no bill lines and no patient.
    await expect(screen.lines).toHaveCount(0);
    expect((await screen.patientName.inputValue()).trim()).toBe('');
  },
});

/**
 * A real discharged invoice, read off Billing Dashboard (Office) at run time.
 *
 * The five discharged editors have no picker, so a suite testing them has to know a real
 * invoice number before it can do anything. Never hard-coded: these are real people's bills
 * and last month's discharges are not next month's.
 *
 * Returns '' when the report comes back empty, which callers treat as a skip rather than a
 * failure - a quiet month is not a defect.
 */
export async function recentDischargedInvoice(page: Page): Promise<string> {
  const office = new HospitalDateDashboardPage(page, hospitalItem('Billing Dashboard(Office)'));
  await office.openDashboard();
  await office.setRange(daysAgo(30), isoDate());
  await office.show_();

  if ((await office.rows.count()) === 0) return '';

  // UHID, INVOICENO, NAME, BED NO, DISCHARGE DATE - the invoice is the second column.
  const invoice = (await office.rows.first().locator('td').nth(1).innerText()).trim();
  return /^\d{10,}$/.test(invoice) ? invoice : '';
}
