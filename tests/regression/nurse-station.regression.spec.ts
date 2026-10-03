import { test, expect } from '../../fixtures';
import { NurseStationPage } from '../../pages';
import type { NurseStationPage as NurseStation } from '../../pages/nurse-station.page';
import { medicineIndent } from '../../data/test-data';

/**
 * Nurse Station @regression — TC_NS_001 … TC_NS_011.
 *
 * Signed-in suite: it runs on the session saved by tests/auth.setup.ts.
 *
 * Covers /hospital/nurse-station, Medicine Indent — where the ward nurse raises a medicine
 * indent against an admitted patient: find the patient by admission number, set a
 * priority, list the drugs and quantities, save. The cases are that flow end to end
 * (TC_NS_004, confirmed on Verify Indent by TC_NS_005), the five ways the form is supposed
 * to refuse, and the Verify Indent tab the pharmacy works from (TC_NS_011).
 *
 * This suite writes. TC_NS_004 and TC_NS_005 each file a real indent against a real
 * patient on a live ward, which is the only way to test a save; both land as Pending on
 * Verify Indent, where they can be seen and cancelled. Nothing else here saves — the
 * negative cases are negative precisely because the app refuses them, and TC_NS_009 adds
 * no line at all.
 *
 * No case hard-codes a patient. Which beds are occupied changes by the hour, so each case
 * reads a patient out of the live ward list and works with whoever that turns out to be.
 */
test.describe('Nurse Station @regression', () => {
  /**
   * Opens the page and returns the admission number of the first patient on the ward.
   *
   * Which patient that is changes through the day, and that is the point: a case that
   * indents for whoever is in the first bed keeps working as the ward turns over.
   */
  async function wardPatient(nurseStation: NurseStation): Promise<string> {
    await nurseStation.goto();
    await nurseStation.expectLoaded();

    const { admissionNo } = await nurseStation.firstWardPatient();
    expect(admissionNo, 'the first ward card carries no admission number').toMatch(/^\d{10,}$/);
    return admissionNo;
  }

  test('TC_NS_001 Nurse Station opens from the Hospital module menu', async ({
    homePage,
    nurseStationPage,
  }) => {
    await homePage.goto();
    await homePage.expectLoaded();

    const link = await homePage.openModule('Hospital', NurseStationPage.PATH);
    await expect(link).toHaveText(/Nurse Station/i);
    await link.click();

    await nurseStationPage.expectLoaded();
    // Medicine Indent > Add Indent is where the page opens; nothing has to be clicked to
    // get to it, so the indent form is on screen straight away.
    await expect(nurseStationPage.tab('MEDICINE INDENT')).toHaveClass(/active/);
    await expect(nurseStationPage.tab('ADD INDENT')).toHaveClass(/active/);
    await expect(nurseStationPage.save).toBeVisible();
  });

  test('TC_NS_002 the Add Indent form offers every control the indent needs', async ({
    nurseStationPage,
  }) => {
    await nurseStationPage.goto();
    await nurseStationPage.expectLoaded();

    for (const tab of NurseStationPage.TABS) {
      await expect(nurseStationPage.tab(tab), `the ${tab} tab is missing`).toBeVisible();
    }

    // Every priority a ward can raise an indent under. A missing one would silently
    // narrow what the nurse can file, which no other assertion on this page would catch.
    for (const priority of NurseStationPage.PRIORITIES) {
      await expect(
        nurseStationPage.priority.locator('option', { hasText: priority })
      ).toHaveCount(1);
    }

    await expect(nurseStationPage.outlet).toBeVisible();
    await expect(nurseStationPage.otRoom).toBeVisible();
    await expect(nurseStationPage.productLookup).toBeVisible();
    await expect(nurseStationPage.quantity).toBeEditable();

    // Asserted one by one rather than as a list: the grid carries two further columns
    // after these - the quantity spinner's and the delete button's - and both head an
    // empty <th>, so a whole-row match would have to spell out two blanks to pass.
    // Read as innerText, not textContent: the markup indents each header onto its own
    // line, and CSS is what uppercases it on screen.
    const headers = nurseStationPage.itemsGrid.locator('th');
    for (const [index, column] of NurseStationPage.ITEM_COLUMNS.entries()) {
      await expect(headers.nth(index), `column ${index + 1}`).toHaveText(
        new RegExp(`^${column}$`, 'i'),
        { useInnerText: true }
      );
    }
  });

  test('TC_NS_003 searching an admission number opens that patient on the indent form', async ({
    nurseStationPage,
  }) => {
    const admissionNo = await wardPatient(nurseStationPage);

    await nurseStationPage.searchPatient(admissionNo);
    // An admission number belongs to one admission, so the ward list has to come back
    // with exactly the one card.
    await expect(nurseStationPage.patientCards).toHaveCount(1, { timeout: 30_000 });

    const patient = await nurseStationPage.selectPatient(admissionNo);

    // The form is filled from the admission record, not from what was typed: the UHID is
    // the patient's own number and has nothing to do with the admission number searched for.
    expect(patient.uhid, 'Indent for').toMatch(/^\d+$/);
    expect(patient.name, 'Name').not.toBe('');
    expect(patient.cabin, 'Cabin').not.toBe('');
    expect(patient.admittedOn, 'Admitted DateTime').toMatch(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/);
  });

  test('TC_NS_004 a ten-line medicine indent saves against an admitted patient', async ({
    nurseStationPage,
  }) => {
    // Ten lines, each a lookup search, a pick and a round trip to the server; the
    // project's 90s default covers about three of them.
    test.setTimeout(420_000);

    const indent = medicineIndent(10);
    const admissionNo = await wardPatient(nurseStationPage);
    const patient = await nurseStationPage.selectPatient(admissionNo);

    await nurseStationPage.choosePriority(indent.priority);
    // The dropdown starts marked invalid - it is the one field on the form with no
    // sensible default - so a priority that took is visible in the class, not just in the
    // value.
    await expect(nurseStationPage.priority).toHaveClass(/is-valid/);

    const ordered = await nurseStationPage.addItems(indent.productSearch, indent.quantities);

    expect(ordered).toHaveLength(indent.quantities.length);
    // One search term, a different medicine per line: two lines of the same drug would
    // mean the lookup handed back the same row twice.
    expect(new Set(ordered.map((line) => line.product)).size, 'distinct medicines').toBe(
      ordered.length
    );

    // What the table holds has to be what was ordered - the same drugs, in the same order,
    // each in the quantity that was typed. The quantities are random per run, so a form
    // that dropped or transposed one would show up here and nowhere else.
    expect(await nurseStationPage.items()).toEqual(ordered);

    expect(await nurseStationPage.saveIndent()).toMatch(/successful save/i);

    // A saved indent leaves the form: the table empties and the priority falls back to its
    // placeholder, ready for the next one. A table still holding ten lines would mean the
    // confirmation was shown over an indent that never left.
    await expect(nurseStationPage.itemRows).toHaveCount(0, { timeout: 30_000 });
    await expect(nurseStationPage.priority).toHaveClass(/is-invalid/);

    test.info().annotations.push({
      type: 'indent',
      description:
        `${patient.name} (${patient.cabin}), ${indent.priority}: ` +
        ordered.map((line) => `${line.product} x${line.quantity}`).join('; '),
    });
  });

  test('TC_NS_005 a saved indent appears on Verify Indent as Pending', async ({
    nurseStationPage,
  }) => {
    test.setTimeout(240_000);

    // Two lines rather than ten: this case is about where the indent ends up, and
    // TC_NS_004 already covers the length of one.
    const indent = medicineIndent(2);
    const admissionNo = await wardPatient(nurseStationPage);

    // The last indent number issued before this case files its own, so the one it files
    // can be named rather than guessed at. Indent numbers run in sequence, which is the
    // only handle there is: the save confirms itself with a snackbar and no number, and
    // the grid cannot be counted on to show the indent at all - see latestIndent.
    const before = await nurseStationPage.latestIndent();
    await nurseStationPage.openTab('ADD INDENT');

    const patient = await nurseStationPage.selectPatient(admissionNo);
    await nurseStationPage.choosePriority(indent.priority);
    await nurseStationPage.addItems(indent.productSearch, indent.quantities);
    expect(await nurseStationPage.saveIndent()).toMatch(/successful save/i);

    const raised = await nurseStationPage.waitForIndentAfter(before?.indentNo);

    // The indent reached the pharmacy as the one this case filed: same bed, same priority,
    // and raised rather than dispensed - the pharmacy has still to act on it.
    expect(raised.cabinNo).toBe(patient.cabin);
    expect(raised.priority).toBe(indent.priority);
    expect(raised.status).toMatch(/pending/i);
    expect(raised.userName).not.toBe('');
    expect(Number(raised.indentNo)).toBeGreaterThan(Number(before?.indentNo ?? 0));
  });

  test('TC_NS_006 an admission number nobody is admitted under returns no patient', async ({
    nurseStationPage,
  }) => {
    await nurseStationPage.goto();
    await nurseStationPage.expectLoaded();

    // Shaped like an admission number so the search is tested rather than the input
    // validation - this is a number the ward could have had and does not.
    await nurseStationPage.searchPatient('99999999999');

    await expect(nurseStationPage.patientCards).toHaveCount(0, { timeout: 30_000 });
    // No patient means no indent: the form stays empty rather than keeping whoever was
    // last on it.
    await expect(nurseStationPage.patientName).toHaveValue('');

    // And the list comes back when the search is cleared - a filter, not a failed fetch.
    await nurseStationPage.searchPatient('');
    await expect(nurseStationPage.patientCards.first()).toBeVisible({ timeout: 30_000 });
  });

  test('TC_NS_007 Save with no patient and no priority is refused', async ({
    nurseStationPage,
  }) => {
    await nurseStationPage.goto();
    await nurseStationPage.expectLoaded();

    await nurseStationPage.save.click();

    // The form answers this one in the markup rather than in a message: Priority is the
    // required field with no default, and it is left marked invalid. Worth asserting
    // because an indent saved with no patient would be an indent nobody can serve.
    await expect(nurseStationPage.priority).toHaveClass(/is-invalid/);
    await expect(nurseStationPage.patientName).toHaveValue('');
    await expect(nurseStationPage.itemRows).toHaveCount(0);
  });

  test('TC_NS_008 Save with a patient but no medicines is refused', async ({
    nurseStationPage,
  }) => {
    const admissionNo = await wardPatient(nurseStationPage);
    await nurseStationPage.selectPatient(admissionNo);
    await nurseStationPage.choosePriority('Routine');

    // Everything the form asks for except the one thing an indent is: the drugs.
    expect(await nurseStationPage.saveIndent()).toMatch(/please fill medicine table/i);

    // Refused, not reset - the nurse gets to add the medicines and save again rather than
    // starting over, so the patient and the priority have to survive the refusal.
    await expect(nurseStationPage.patientName).not.toHaveValue('');
    await expect(nurseStationPage.priority).toHaveClass(/is-valid/);
  });

  test('TC_NS_009 a medicine with a quantity of zero is not added to the indent', async ({
    nurseStationPage,
  }) => {
    const admissionNo = await wardPatient(nurseStationPage);
    await nurseStationPage.selectPatient(admissionNo);
    await nurseStationPage.choosePriority('Routine');

    const indent = medicineIndent(1);
    // The quantity box takes 0 happily; what it will not do is commit the line. A zero
    // that got through would reach the pharmacy as an order for nothing.
    expect(await nurseStationPage.tryAddItem(indent.productSearch, 0, 0)).toBe(false);
    await expect(nurseStationPage.itemRows).toHaveCount(0);

    // The refusal leaves the medicine on the form, so it takes only a real quantity to
    // put the same line through - which is what says it was refused for the zero rather
    // than for the drug.
    const line = await nurseStationPage.commitSelected(indent.quantities[0]);
    await expect(nurseStationPage.itemRows).toHaveCount(1);
    expect((await nurseStationPage.items())[0]).toEqual(line);
  });

  test('TC_NS_010 the patient panel cannot be filled in by hand', async ({ nurseStationPage }) => {
    await nurseStationPage.goto();
    await nurseStationPage.expectLoaded();

    // All four are disabled in the markup. The indent is bound to an admission, and the
    // only thing that binds it is a card in the ward list - a typed-in name would file the
    // indent against a patient the ward has no record of.
    for (const field of [
      nurseStationPage.indentFor,
      nurseStationPage.patientName,
      nurseStationPage.cabin,
      nurseStationPage.admittedDateTime,
    ]) {
      await expect(field).toBeDisabled();
    }

    // Item Description is the same: it is what the Product Code lookup writes, not a box
    // for typing a drug name the catalogue does not carry.
    await expect(nurseStationPage.itemDescription).toBeDisabled();
  });

  test('TC_NS_011 Verify Indent lists the ward\'s pending indents', async ({
    nurseStationPage,
  }) => {
    await nurseStationPage.goto();
    await nurseStationPage.expectLoaded();

    // Opened first: the status tabs and the grid below are the Verify Indent pane's own
    // markup and are not on the page at all while Add Indent is the tab showing.
    const indents = await nurseStationPage.verifiedIndents();

    // The four states an indent passes through as the pharmacy works it, with Pending -
    // raised and not yet acted on - the one the pane opens on.
    for (const state of ['Pending', 'Partially Served', 'Served', 'Cancelled']) {
      await expect(nurseStationPage.tab(state), `the ${state} tab is missing`).toBeVisible();
    }
    await expect(nurseStationPage.tab('Pending')).toHaveClass(/active/);

    const headers = nurseStationPage.verifyGrid.locator('th');
    for (const [index, column] of NurseStationPage.VERIFY_COLUMNS.entries()) {
      await expect(headers.nth(index), `column ${index + 1}`).toHaveText(
        new RegExp(`^${column}$`, 'i'),
        { useInnerText: true }
      );
    }

    test.skip(indents.length === 0, 'the ward has no indent pending to read');

    // Asserted about the rows that are there, not about the ward's whole backlog: the
    // grid lists sixteen indents and stops, ordered by priority rather than by time, so
    // what it shows is a slice and not a count of anything. See NurseStationPage.
    for (const indent of indents) {
      expect(indent.indentNo, 'indent number').toMatch(/^\d{10,}$/);
      expect(indent.cabinNo, `${indent.indentNo} is against no bed`).not.toBe('');
      // Under the Pending tab, nothing else belongs here.
      expect(indent.status, `${indent.indentNo} status`).toMatch(/pending/i);
      expect(
        NurseStationPage.PRIORITIES as readonly string[],
        `${indent.indentNo} carries a priority the form cannot raise`
      ).toContain(indent.priority);
    }
  });
});
