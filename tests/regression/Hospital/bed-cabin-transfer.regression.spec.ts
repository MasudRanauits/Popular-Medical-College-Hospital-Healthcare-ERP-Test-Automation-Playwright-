import { test, expect } from '../../../fixtures';
import { HospitalWardScreenPage, hospitalItem } from '../../../pages';
import { caseId, cases, opensFromDrawer, wardLookup } from './_case-packs';

/**
 * Bed/Cabin Transfer @regression
 *
 * Moves an inpatient from one bed to another, optionally releasing the bed they were in.
 *
 * This is the screen the ward's "Search Patient" lookup is taken apart on, since all eight
 * screens in that family share the control and this is the simplest of them. The findings
 * below belong to the lookup rather than to transferring as such.
 *
 * Nothing here is saved. A Save moves a real patient into a real bed.
 */

const ITEM = hospitalItem('Bed/Cabin Transfer');

test.describe('Bed/Cabin Transfer @regression', () => {
  const packed = cases(ITEM, opensFromDrawer(), wardLookup('Save'));
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' picking a patient fills the panel with that patient', async ({
    page,
  }) => {
    const screen = new HospitalWardScreenPage(page, ITEM);
    await screen.openScreen();

    const row = await screen.patientAt(0);
    const panel = await screen.selectPatient(0);

    // The two columns the lookup and the panel both carry have to agree. A transfer built
    // on the wrong patient is the failure this screen exists to avoid.
    expect(panel.fullName).toBe(row.fullName);
    expect(panel.cabinNo).toBe(row.cabinNo);

    // And the rest came from the admission record rather than from nowhere.
    expect(panel.assignedDoctor, 'the panel filled no assigned doctor').not.toBe('');
  });

  test(caseId(ITEM, next++) + ' picking a second patient replaces the first, leaving nothing behind', async ({
    page,
  }) => {
    /**
     * Whichever patient the panel is showing is the one who gets moved. A panel that kept
     * any part of the previous patient would move one patient out of another's bed, with
     * nothing on screen saying so.
     */
    const screen = new HospitalWardScreenPage(page, ITEM);
    await screen.openScreen();

    const first = await screen.selectPatient(0);

    const second = await screen.patientAt(1);
    test.skip(
      second.fullName === first.fullName || second.fullName === '',
      'the ward lookup is listing fewer than two distinct patients'
    );
    const panel = await screen.selectPatient(1);

    expect(panel.fullName).toBe(second.fullName);
    expect(panel.cabinNo).toBe(second.cabinNo);
    expect(panel.fullName).not.toBe(first.fullName);
  });

  test(caseId(ITEM, next++) + ' the patient panel cannot be typed into', async ({ page }) => {
    /**
     * Readonly, not disabled - the same thing to a clerk and a different thing to a test.
     * The admission-lookup family disables these boxes; this family marks them readonly;
     * the discharged editors disable them again. Three mechanisms, one intention.
     */
    const screen = new HospitalWardScreenPage(page, ITEM);
    await screen.openScreen();
    await screen.selectPatient(0);

    for (const name of Object.values(HospitalWardScreenPage.PANEL_FIELDS)) {
      if (!(await screen.hasPatientField(name))) continue;
      await expect(screen.patientField(name), `${name} takes typing`).toHaveAttribute(
        'readonly',
        ''
      );
    }
  });

  test(caseId(ITEM, next++) + ' the ward lookup finds a patient by admission number', async ({
    page,
  }) => {
    /**
     * The counterpart to ADMISSION-CANCEL-005, and the reason that one is a defect.
     *
     * The same hospital, the same admitted-patient list, two lookups. This one takes the
     * admission number off the wristband and finds the patient. The one on Admission Cancel
     * and the advance screens returns nothing for it, while printing it in its own first
     * column.
     *
     * So the behaviour over there is not a deliberate "we search names here": the ERP
     * already does this search, two screens away, in the same framework.
     */
    const screen = new HospitalWardScreenPage(page, ITEM);
    await screen.openScreen();

    const seed = await screen.patientAt(0);

    await screen.searchLookup(seed.invoiceNo);

    // An admission number is unique, so exactly that patient has to come back.
    await expect(screen.lookupResults).toHaveCount(1, { timeout: 30_000 });
    expect(await screen.readRow(screen.lookupResults.first())).toMatchObject({
      invoiceNo: seed.invoiceNo,
      fullName: seed.fullName,
    });
  });

  test(caseId(ITEM, next++) + ' the ward lookup finds a patient by name and by bed', async ({
    page,
  }) => {
    const screen = new HospitalWardScreenPage(page, ITEM);
    await screen.openScreen();

    const seed = await screen.patientAt(0);

    await test.step('by name', async () => {
      test.skip(seed.fullName === '', 'the first patient in the lookup carries no name');
      await screen.searchLookup(seed.fullName);

      // Not a count assertion - two patients of one name on a ward is ordinary.
      const found = [];
      for (const row of await screen.lookupResults.all()) found.push(await screen.readRow(row));
      expect(
        found.map((row) => row.invoiceNo),
        `no patient for "${seed.fullName}"`
      ).toContain(seed.invoiceNo);
    });

    await test.step('by bed', async () => {
      await screen.searchLookup(seed.cabinNo);

      const rows = await screen.lookupResults.all();
      expect(rows.length, `nobody in ${seed.cabinNo}`).toBeGreaterThan(0);
      for (const row of rows) {
        expect((await screen.readRow(row)).cabinNo).toContain(seed.cabinNo);
      }
    });
  });

  test(caseId(ITEM, next++) + ' the lookup pages five at a time and the pager reaches the rest', async ({
    page,
  }) => {
    /**
     * Five to a page is a small window onto a ward of several hundred, so the pager under
     * it is the only thing between a clerk and a patient they cannot name. What this case
     * is for is that the pager actually moves: a page button that re-renders the same five
     * patients is the failure worth catching, and it looks identical to a working one.
     */
    const screen = new HospitalWardScreenPage(page, ITEM);
    await screen.openScreen();
    await screen.openLookup();

    await expect(screen.lookupResults).toHaveCount(HospitalWardScreenPage.LOOKUP_PAGE_SIZE);

    const pages = screen.lookupPanel.locator('.rz-paginator-page');
    expect(await pages.count(), 'the ward lookup has no second page to reach').toBeGreaterThan(1);

    const firstPage = [];
    for (const row of await screen.lookupResults.all()) firstPage.push(await screen.readRow(row));

    await pages.nth(1).click();
    await screen.settleLookup();

    const secondPage = [];
    for (const row of await screen.lookupResults.all()) secondPage.push(await screen.readRow(row));

    expect(secondPage.length, 'page two came back empty').toBeGreaterThan(0);
    expect(
      secondPage.map((row) => row.invoiceNo),
      'page two lists the same admissions as page one'
    ).not.toEqual(firstPage.map((row) => row.invoiceNo));
  });

  test(caseId(ITEM, next++) + ' a term matching nobody empties the lookup and clears again', async ({
    page,
  }) => {
    const screen = new HospitalWardScreenPage(page, ITEM);
    await screen.openScreen();
    await screen.openLookup();

    const before = await screen.lookupResults.count();
    expect(before, 'the ward lookup listed nobody to begin with').toBeGreaterThan(0);

    await screen.searchLookup('ZZZNOSUCHPATIENT9912');

    expect(await screen.lookupIsEmpty(), 'the lookup kept listing patients').toBe(true);
    await expect(screen.lookupResults).toHaveCount(0);

    // And it comes back - a filter that cannot be cleared strands the ward on one patient.
    await screen.searchLookup('');
    await expect(screen.lookupResults).toHaveCount(before);
  });

  test(caseId(ITEM, next++) + ' it shows which bed the patient is in and what it costs', async ({
    page,
  }) => {
    /**
     * The "From Cabin" pair - the bed the patient is in and its nightly rent - is filled
     * from the admission rather than typed. Getting it wrong is how a patient is moved out
     * of the wrong bed, so both boxes are checked against the bed the lookup said they
     * were in.
     */
    const screen = new HospitalWardScreenPage(page, ITEM);
    await screen.openScreen();

    const row = await screen.patientAt(0);
    await screen.selectPatient(0);

    const fromCabin = page.locator('input[name$="_SelectedCabin.CabinNo"]').first();
    const rent = page.locator('input[name$="_SelectedCabin.Rent"]').first();

    await expect(fromCabin, "From Cabin is not the patient's bed").toHaveValue(row.cabinNo);
    // Rent is printed to two places; a free bed legitimately carries 0.00.
    await expect(rent, 'From Cabin carries no rent').toHaveValue(/^\d+\.\d{2}$/);
  });
});
