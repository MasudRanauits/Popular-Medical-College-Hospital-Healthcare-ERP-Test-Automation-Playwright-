import { test, expect } from '../../fixtures';
import { AdmissionDashboardPage } from '../../pages';

/**
 * Admission dashboard @regression — TC_ADMD_001 … TC_ADMD_007.
 *
 * Signed-in suite: it runs on the session saved by tests/auth.setup.ts.
 *
 * Covers /hospital/patientlist-dashboard — Hospital module, "Dashboard" at the top of the
 * drawer — the list of everyone currently admitted. This is where an admission is looked
 * up after the fact, so the cases are the two things the page is used for: finding one
 * admission in it, and printing that admission's paperwork.
 *
 * Read-only, all of it. Nothing here admits, discharges or edits a patient; the print
 * buttons render documents and leave the record alone. The grid holds live hospital data,
 * so no case hard-codes an admission — each reads one out of the first row and searches
 * for what it just read.
 */
test.describe('Admission dashboard @regression', () => {
  /**
   * The first admission in the unfiltered grid, as the seed for a search case.
   *
   * Which admission it is changes by the hour, and that is the point: a case that searches
   * for what it just read keeps working as the ward turns over.
   */
  async function seedAdmission(dashboard: AdmissionDashboardPage) {
    await dashboard.goto();
    await dashboard.expectLoaded();

    const cells = await dashboard.cells(dashboard.rows.first());
    expect(cells[AdmissionDashboardPage.COLUMN.admissionNo]).toMatch(/^\d{10,}$/);
    return {
      admissionNo: cells[AdmissionDashboardPage.COLUMN.admissionNo],
      name: cells[AdmissionDashboardPage.COLUMN.name],
      cabinNo: cells[AdmissionDashboardPage.COLUMN.cabinNo],
      phone: cells[AdmissionDashboardPage.COLUMN.phone],
    };
  }

  test('TC_ADMD_001 Dashboard opens from the Hospital module menu', async ({
    homePage,
    admissionDashboardPage,
  }) => {
    await homePage.goto();
    await homePage.expectLoaded();

    // The drawer link is labelled just "Dashboard" - the module it belongs to is what says
    // which dashboard - so it is reached by href rather than by name.
    const link = await homePage.openModule('Hospital', AdmissionDashboardPage.PATH);
    await expect(link).toHaveText(/Dashboard/i);
    await link.click();

    await admissionDashboardPage.expectLoaded();
    await expect(admissionDashboardPage.search).toBeEditable();
    await expect(admissionDashboardPage.printList).toBeVisible();
    await expect(admissionDashboardPage.printPackageList).toBeVisible();
  });

  test('TC_ADMD_002 the grid lists admissions under the expected columns', async ({
    admissionDashboardPage,
  }) => {
    await admissionDashboardPage.goto();
    await admissionDashboardPage.expectLoaded();

    const headers = admissionDashboardPage.grid.locator('th');
    await expect(headers).toHaveCount(AdmissionDashboardPage.COLUMNS.length);
    await expect(headers).toHaveText(AdmissionDashboardPage.COLUMNS.map((c) => new RegExp(c, 'i')));

    // Every admitted patient has an admission number and a bed; the rest of the row can be
    // blank on a given record, so only these two are worth asserting across the page.
    for (const column of ['admissionNo', 'cabinNo'] as const) {
      const cells = admissionDashboardPage.rows.locator(
        `td:nth-child(${AdmissionDashboardPage.COLUMN[column] + 1})`
      );
      for (const text of await cells.allInnerTexts()) expect(text.trim()).not.toBe('');
    }
  });

  test('TC_ADMD_003 searching an admission number finds that admission', async ({
    admissionDashboardPage,
  }) => {
    const seed = await seedAdmission(admissionDashboardPage);

    await admissionDashboardPage.searchFor(seed.admissionNo);

    // An admission number is unique, so the filter has to come back with exactly one row.
    await expect(admissionDashboardPage.rows).toHaveCount(1, { timeout: 30_000 });
    const row = admissionDashboardPage.rows.first();
    expect(await admissionDashboardPage.cell(row, 'admissionNo')).toBe(seed.admissionNo);
    expect(await admissionDashboardPage.cell(row, 'name')).toBe(seed.name);
  });

  test('TC_ADMD_004 searching a patient name finds their admission', async ({
    admissionDashboardPage,
  }) => {
    const seed = await seedAdmission(admissionDashboardPage);

    // Searched without the title the grid prints in front of the name - see
    // AdmissionDashboardPage.searchFor. "Mr Jalal Miah" returns nothing; "Jalal Miah" does.
    const term = AdmissionDashboardPage.searchableName(seed.name);
    expect(term, `${seed.name} is a title and nothing else`).not.toBe('');
    await admissionDashboardPage.searchFor(term);

    // Not a count assertion: a name is not unique, and a ward holding two Jalal Miahs is
    // ordinary. What has to be true is that the one we started from is among them.
    const row = admissionDashboardPage.rowFor(seed.admissionNo);
    await expect(row, `no admission for ${term}`).toBeVisible({ timeout: 30_000 });
    expect(await admissionDashboardPage.cell(row, 'name')).toBe(seed.name);
  });

  test('TC_ADMD_005 searching a phone number finds that admission', async ({
    admissionDashboardPage,
  }) => {
    const seed = await seedAdmission(admissionDashboardPage);
    test.skip(seed.phone === '', 'the admission at the top of the grid carries no phone number');

    await admissionDashboardPage.searchFor(seed.phone);

    // A family shares a number often enough that this is not a count assertion either.
    const row = admissionDashboardPage.rowFor(seed.admissionNo);
    await expect(row, `no admission on phone ${seed.phone}`).toBeVisible({ timeout: 30_000 });
    expect(await admissionDashboardPage.cell(row, 'phone')).toBe(seed.phone);
  });

  test('TC_ADMD_006 searching a cabin number finds the patient in that bed', async ({
    admissionDashboardPage,
  }) => {
    const seed = await seedAdmission(admissionDashboardPage);

    await admissionDashboardPage.searchFor(seed.cabinNo);

    // A bed holds one patient at a time, so every row this returns has to be that bed -
    // and the admission we started from has to be one of them.
    const row = admissionDashboardPage.rowFor(seed.admissionNo);
    await expect(row, `nobody in ${seed.cabinNo}`).toBeVisible({ timeout: 30_000 });
    for (const cabin of await admissionDashboardPage.rows
      .locator(`td:nth-child(${AdmissionDashboardPage.COLUMN.cabinNo + 1})`)
      .allInnerTexts()) {
      expect(cabin.replace(/\s+/g, ' ').trim()).toContain(seed.cabinNo);
    }
  });

  test('TC_ADMD_007 every Action print button renders a PDF', async ({
    admissionDashboardPage,
  }) => {
    // Four documents, each built on the server and shipped to the browser whole; the first
    // is over a megabyte, and the project's 90s default does not cover all four.
    test.setTimeout(240_000);

    const seed = await seedAdmission(admissionDashboardPage);
    await admissionDashboardPage.searchFor(seed.admissionNo);
    const row = admissionDashboardPage.rowFor(seed.admissionNo);
    await expect(row).toBeVisible({ timeout: 30_000 });

    const printed = await admissionDashboardPage.printAll(row);

    // The Action cell carried four print buttons on every row seen so far. Asserting the
    // floor rather than the number keeps a fifth document from failing the case.
    expect(printed.length, 'print buttons in the Action cell').toBeGreaterThanOrEqual(4);

    for (const document of printed) {
      // Each button opens its own tab on a blob: URL, which renders in Chrome's PDF viewer
      // and has no DOM to read - so what the button produced is checked as bytes. A page
      // that failed to render still opens a tab, and an error page is not a PDF.
      expect(document.header, `document ${document.index + 1} is not a PDF`).toMatch(/^%PDF-/);
      expect(document.size, `document ${document.index + 1} is empty`).toBeGreaterThan(1_000);
    }

    // No two of them should be the same file: these are different documents - the
    // admission form, the ID card, the sticker sheet - and all four coming back identical
    // would mean the buttons are wired to one handler.
    const sizes = printed.map((d) => d.size);
    expect(new Set(sizes).size, `distinct documents among ${sizes.join(', ')} bytes`).toBeGreaterThan(1);

    test.info().annotations.push({
      type: 'printed',
      description: printed.map((d) => `#${d.index + 1}: ${d.size} bytes`).join(', '),
    });
  });
});
