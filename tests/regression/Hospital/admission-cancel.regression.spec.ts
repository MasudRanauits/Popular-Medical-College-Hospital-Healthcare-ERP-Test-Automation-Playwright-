import { test, expect } from '../../../fixtures';
import { HospitalPatientScreenPage, hospitalItem } from '../../../pages';
import { admissionLookup, caseId, cases, opensFromDrawer } from './_case-packs';

/**
 * Admission Cancel @regression
 *
 * Undoes an admission: the patient comes off the ward, the bed is freed and the advance
 * payments go back. The most destructive single button in the Hospital module.
 *
 * Nothing here cancels anything. What the suite proves is the half that can be proved
 * safely and is where the defects actually are: that the lookup finds the right admission,
 * that the panel fills with that admission and not the one before it, and that the Cancel
 * button is dead until a patient has been picked.
 *
 * This is also the screen the admission lookup's own behaviour is taken apart on, since
 * every screen in that family shares the control. The two findings below - the number that
 * cannot be searched, and the reason box that cannot be typed into - belong to the lookup
 * and the form rather than to cancelling as such.
 *
 * The admission each case uses is read out of the lookup at the time, never hard-coded.
 * These are real inpatients and today's ward is not next week's.
 */

const ITEM = hospitalItem('Admission Cancel');

test.describe('Admission Cancel @regression', () => {
  const packed = cases(ITEM, opensFromDrawer(), admissionLookup('Cancel'));
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' picking an admission fills the patient panel with that admission', async ({
    page,
  }) => {
    const screen = new HospitalPatientScreenPage(page, ITEM);
    await screen.openScreen();

    const row = await screen.admissionAt(0);
    const panel = await screen.selectAdmission(0);

    // The three columns the lookup and the panel both carry have to agree - a panel that
    // fills with somebody else's details is the one failure on this screen that would be
    // catastrophic and silent.
    expect(panel.invoiceNo).toBe(row.invoiceNo);
    expect(panel.fullName).toBe(row.fullName);
    expect(panel.cabinNo).toBe(row.cabinNo);

    // And the rest of the panel came from the admission record, not from nowhere.
    expect(panel.age, 'the panel filled no age').toMatch(/\d/);
    expect(panel.sex, 'the panel filled no gender').not.toBe('');
    expect(panel.department, 'the panel filled no department').not.toBe('');
  });

  test(caseId(ITEM, next++) + ' the patient panel cannot be typed into', async ({ page }) => {
    // The panel is the admission record. If one of these boxes ever became editable, a
    // clerk could retype a patient's name onto a cancellation.
    const screen = new HospitalPatientScreenPage(page, ITEM);
    await screen.openScreen();
    await screen.selectAdmission(0);

    for (const name of Object.values(HospitalPatientScreenPage.PANEL_FIELDS)) {
      await expect(screen.field(name), `SelectedPatient.${name} takes typing`).toBeDisabled();
    }
  });

  test(caseId(ITEM, next++) + ' the lookup does not find an admission by its number', async ({
    page,
  }) => {
    /**
     * A finding, pinned as it behaves.
     *
     * The lookup prints four columns - InvoiceNo, CabinNo, FullName, Mobile - and searches
     * two of them. Typing the admission number that is on screen in column one of the row
     * in front of you returns nothing.
     *
     * That is the way a clerk uses this screen. The admission number is what is on the
     * wristband, on the file and on every other screen in the module; it is what the
     * admission dashboard searches by, and it is the one thing this lookup will not take.
     *
     * It is not a deliberate "we search names here", either: the ward's own lookup, two
     * screens away and in the same framework, does find a patient by admission number -
     * see BED-CABIN-TRANSFER-005.
     *
     * Written as the app behaves so the suite stays green and the defect stays visible.
     * The day the filter covers the columns it prints, this case fails and gets turned back
     * into the assertion it wants to be, which is the three lines commented out at the end.
     */
    const screen = new HospitalPatientScreenPage(page, ITEM);
    await screen.openScreen();

    const seed = await screen.admissionAt(0);

    await screen.searchLookup(seed.invoiceNo);

    expect(
      await screen.lookupIsEmpty(),
      `searching "${seed.invoiceNo}", which is printed in row one of this very grid, returns nothing`
    ).toBe(true);
    await expect(screen.lookupResults).toHaveCount(0);

    // What it should do:
    //   await expect(screen.lookupResults).toHaveCount(1);
    //   expect(await screen.readRow(screen.lookupResults.first()))
    //     .toMatchObject({ invoiceNo: seed.invoiceNo });
  });

  test(caseId(ITEM, next++) + ' the lookup finds an admission by patient name', async ({ page }) => {
    const screen = new HospitalPatientScreenPage(page, ITEM);
    await screen.openScreen();

    const seed = await screen.admissionAt(0);
    test.skip(seed.fullName === '', 'the first admission in the lookup carries no name');

    await screen.searchLookup(seed.fullName);

    // Not a count assertion - a ward holding two patients of the same name is ordinary.
    // What has to be true is that the one we started from is among what came back.
    const found = [];
    for (const row of await screen.lookupResults.all()) found.push(await screen.readRow(row));
    expect(
      found.map((row) => row.invoiceNo),
      `no admission for "${seed.fullName}"`
    ).toContain(seed.invoiceNo);
  });

  test(caseId(ITEM, next++) + ' the lookup finds an admission by bed', async ({ page }) => {
    // The other column the filter does search. Together with the case above, this is what
    // makes the admission-number one a defect rather than a design: the lookup filters on
    // two of the four columns it prints, and the key column is not one of them.
    const screen = new HospitalPatientScreenPage(page, ITEM);
    await screen.openScreen();

    const seed = await screen.admissionAt(0);

    await screen.searchLookup(seed.cabinNo);

    // A bed holds one patient at a time, so every row this returns has to be for that bed.
    const rows = await screen.lookupResults.all();
    expect(rows.length, `nobody in ${seed.cabinNo}`).toBeGreaterThan(0);
    for (const row of rows) {
      expect((await screen.readRow(row)).cabinNo).toContain(seed.cabinNo);
    }
  });

  test(caseId(ITEM, next++) + ' a term matching no admission says nothing at all', async ({
    page,
  }) => {
    /**
     * The empty state, which is not one.
     *
     * Radzen's no-matches row renders as a single cell carrying `rz-datatable-emptymessage`
     * and nothing inside it - no "no records found", no message of any kind. So a search
     * that found nobody and a search that is still loading look identical, and both look
     * like a grid holding one blank admission.
     */
    const screen = new HospitalPatientScreenPage(page, ITEM);
    await screen.openScreen();

    await screen.searchLookup('ZZZNOSUCHADMISSION9912');

    expect(await screen.lookupIsEmpty(), 'the lookup kept listing admissions').toBe(true);
    await expect(screen.lookupResults).toHaveCount(0);

    const message = await screen.lookupPanel
      .locator('td.rz-datatable-emptymessage')
      .first()
      .innerText();
    expect(
      message.trim(),
      'the empty state carries no message, so a failed search is indistinguishable from a loading one'
    ).toBe('');
  });

  test(caseId(ITEM, next++) + ' clearing the search gives the whole ward back', async ({ page }) => {
    // The half a happy-path case never reaches: a filter that cannot be cleared strands the
    // clerk on one patient until they reload the screen.
    const screen = new HospitalPatientScreenPage(page, ITEM);
    await screen.openScreen();
    await screen.openLookup();

    const before = await screen.lookupResults.count();
    expect(before, 'the lookup listed nobody to begin with').toBeGreaterThan(0);

    await screen.searchLookup('ZZZNOSUCHADMISSION9912');
    await expect(screen.lookupResults).toHaveCount(0);

    await screen.searchLookup('');

    await expect(screen.lookupResults).toHaveCount(before);
  });

  test(caseId(ITEM, next++) + ' Cancel is dead until an admission is picked', async ({ page }) => {
    /**
     * The gate on the most destructive button in the module. Cancel with nothing picked
     * would be a cancellation against whatever the form last held.
     *
     * It ships disabled and the pick enables it, which is the right design - this case is
     * here so it stays that way. The module's three payment screens do not do this; see
     * the register in _module.regression.spec.ts.
     */
    const screen = new HospitalPatientScreenPage(page, ITEM);
    await screen.openScreen();

    const cancel = screen.action('Cancel');
    await expect(cancel, 'Cancel is live with no admission on the form').toHaveClass(/disabled/);

    await screen.selectAdmission(0);

    await expect(cancel, 'Cancel stayed dead after an admission was picked').not.toHaveClass(
      /disabled/
    );
  });

  test(caseId(ITEM, next++) + ' the remarks box never takes a cancellation reason', async ({
    page,
  }) => {
    /**
     * A finding, pinned.
     *
     * The screen renders a "Remarks" box next to its Cancel button, and that box is
     * disabled in the markup - before an admission is picked and after. So a cancellation
     * carries no reason, and the field that exists to record one cannot be typed into.
     *
     * Every other box on this screen is disabled for a good reason: they are the admission
     * record. Remarks is not part of the record - it is the clerk's own input, and it is
     * the only trace of why a bed was freed and an advance refunded.
     */
    const screen = new HospitalPatientScreenPage(page, ITEM);
    await screen.openScreen();

    const remarks = page.locator('input[name="RemarksTxt"]');
    await expect(remarks, 'the Remarks box is not on the Admission Cancel form').toBeVisible();
    await expect(remarks, 'Remarks is editable before a patient is picked').toBeDisabled();

    await screen.selectAdmission(0);

    await expect(
      remarks,
      'Remarks takes a cancellation reason once an admission is picked'
    ).toBeDisabled();
  });
});
