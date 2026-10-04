import { test, expect } from '../../fixtures';
import { DietIndentPage } from '../../pages';
import { dietIndent } from '../../data/test-data';

const { MESSAGES } = DietIndentPage;

/**
 * Diet Indent @regression — DI-01 … DI-15.
 *
 * Signed-in suite: it runs on the session saved by tests/auth.setup.ts.
 *
 * Covers /hospital/nurse-station, Diet Indent — where the ward nurse orders meals for an
 * admitted patient: pick the patient off the ward list, set an outlet and a priority, list
 * the food patterns, save. Medicine Indent, the tab next to it, is TC_NS_001 … TC_NS_011 in
 * nurse-station.regression.spec.ts; the two forms share a route and almost no markup, which
 * is why they have a page object each.
 *
 * No case hard-codes a patient. Which beds are occupied changes by the hour, so each case
 * reads one — or two, for DI-15 — out of the live ward list and works with whoever that
 * turns out to be.
 *
 * Three findings about this form are worth knowing before reading the cases:
 *
 *   - A patient cannot be given the same food pattern twice while the first order is still
 *     pending: the line is turned away at Enter with "Already has indent for this food
 *     pattern". That is the duplicate guard this module actually has, and DI-14 is the
 *     case about it. It is also why no case names a food pattern — each asks for the first
 *     one the ward will still take, because every save here leaves the next case one
 *     pattern less to choose from. A suite that always reached for the first pattern on
 *     the list saved once and then could not build an indent at all.
 *   - The quantity is not recorded. Every line lands in the indent table as 1, whether 5,
 *     9 or 0 is typed, and reaches Verify Indent as 1 as well. DI-06 is the case that says
 *     so, and it is marked test.fail() because the behaviour it asserts is the one the
 *     module is supposed to have, not the one it has. DI-10 records the same thing as an
 *     annotation rather than asserting it.
 *   - Nothing is answered inline. Every refusal and every save arrives as a Blazorise
 *     snackbar, in the same element with the same classes, so the text is the only thing
 *     separating them — which is why the expected strings are pinned on the page object.
 *
 * The second describe below writes. Each of its cases files one real diet indent against a
 * real patient on a live ward, which is the only way to test a save; DI-15 files two. They
 * land as Pending on Verify Indent, where the canteen sees them and where they can be
 * cancelled. Nothing in the first describe saves — its negative cases are negative
 * precisely because the app refuses them, and its positive ones never reach Save.
 */
test.describe('Diet Indent @regression', () => {
  test('DI-01 Diet Indent > Add Indent opens from the Hospital module menu', async ({
    homePage,
    dietIndentPage,
  }) => {
    await homePage.goto();
    await homePage.expectLoaded();

    const link = await homePage.openModule('Hospital', DietIndentPage.PATH);
    await expect(link).toHaveText(/Nurse Station/i);
    await link.click();

    // The page opens on Medicine Indent, so Diet Indent is a click away rather than where
    // it lands — which is the step this case is here to prove.
    await dietIndentPage.openNurseStation();
    await expect(dietIndentPage.tab('MEDICINE INDENT')).toHaveClass(/active/);

    await dietIndentPage.openDietIndent();

    // Add Indent is the sub-tab the diet form opens on, and the form is on screen whole.
    await expect(dietIndentPage.outlet).toBeVisible();
    await expect(dietIndentPage.patternLookup).toBeVisible();
    await expect(dietIndentPage.remarks).toBeEditable();
    await expect(dietIndentPage.itemsTable).toBeVisible();

    // The dropdowns offer what this tab offers. Priority is not the Medicine Indent list:
    // that one has six entries, this one three, which is the sharpest evidence on the page
    // that the two tabs are separate forms rather than one form in two modes.
    await expect(dietIndentPage.priority.locator('option')).toHaveText([
      'Select Item',
      ...DietIndentPage.PRIORITIES,
    ]);
    await expect(dietIndentPage.outlet.locator('option')).toHaveText([
      'Select Canteen',
      ...DietIndentPage.OUTLETS,
    ]);
    await expect(dietIndentPage.itemsTable.locator('th')).toHaveText([
      ...DietIndentPage.ITEM_COLUMNS,
      // The fourth column is unlabelled; it holds each row's delete button.
      '',
    ]);
  });

  test('DI-02 selecting a ward patient fills the indent form with that patient', async ({
    dietIndentPage,
  }) => {
    // Nothing here is indented; the data is only for the bed it points at.
    const diet = dietIndent();

    await dietIndentPage.openAddIndent();
    const [card] = await dietIndentPage.wardPatients(1, diet.wardIndex);

    // Empty before the click: the four patient boxes are disabled in the markup, so the
    // ward card is the only thing that can fill them.
    await expect(dietIndentPage.patientName).toHaveValue('');
    await expect(dietIndentPage.patientName).toBeDisabled();
    await expect(dietIndentPage.indentFor).toBeDisabled();
    await expect(dietIndentPage.cabin).toBeDisabled();

    const patient = await dietIndentPage.selectPatient(card.admissionNo);

    // "Indent for" is the UHID, not the admission number the card was found by.
    expect(patient.uhid, 'Indent for should carry the patient UHID').toMatch(/^\d{6,}$/);
    expect(patient.name, 'the patient name never arrived').not.toBe('');
    expect(patient.admittedOn, 'the admission date never arrived').not.toBe('');
    // The form prints the bed as "P(HCU-27)" where the card prints "HCU-27", so the card's
    // bed is contained in the form's cabin rather than equal to it.
    expect(patient.cabin, `the form opened a different bed than ${card.bed}`).toContain(card.bed);
  });

  test('DI-03 Save without a priority is refused', async ({ dietIndentPage }) => {
    const diet = dietIndent();

    await dietIndentPage.openAddIndent();
    const [card] = await dietIndentPage.wardPatients(1, diet.wardIndex);
    await dietIndentPage.selectPatient(card.admissionNo);
    await dietIndentPage.chooseOutlet(diet.outlet);

    // Everything but the priority, so the refusal can only be about the priority.
    await dietIndentPage.addItem(diet.patternSearch, diet.mark, diet.quantities[0]);
    await expect(dietIndentPage.itemRows).toHaveCount(1);
    await expect(dietIndentPage.priority, 'the priority should still be unset').toHaveValue('0');

    expect(await dietIndentPage.saveIndent()).toBe(MESSAGES.noPriority);
    // Refused, not saved: a save empties the form, and this one is untouched.
    await expect(dietIndentPage.itemRows).toHaveCount(1);
    await expect(dietIndentPage.patientName).not.toHaveValue('');
  });

  test('DI-06 a quantity of zero should not be added to the indent', async ({
    dietIndentPage,
  }) => {
    // The behaviour asserted below is the one the module is supposed to have. It does not
    // have it: a quantity of 0 is taken like any other, and the line is added reading 1.
    //
    // Marked expected-to-fail rather than rewritten to match, because rewriting it would
    // turn a defect into a documented feature and leave nothing watching for the fix. A run
    // reports this as expected-to-fail; if the form is corrected, the run reports it as
    // unexpectedly passing, which is the signal to delete this line and keep the assertion.
    //
    // The same defect is why every other case here reads quantities back rather than
    // assuming them. See the file header.
    test.fail();

    const diet = dietIndent();

    await dietIndentPage.openAddIndent();
    const [card] = await dietIndentPage.wardPatients(1, diet.wardIndex);
    await dietIndentPage.selectPatient(card.admissionNo);

    // offerItem steps over any pattern the ward already has on order and stops at the
    // first one the app answers about this line - so whatever comes back here is the
    // app's verdict on the quantity, not on the patient's meal plan.
    const attempt = await dietIndentPage.offerItem(diet.patternSearch, diet.mark, 0);

    expect(
      attempt.added,
      `a line with no quantity was added to the indent on "${attempt.pattern}"`
    ).toBe(false);
    expect(attempt.message, 'the refusal should name the quantity').toMatch(/quantity|qty/i);
  });

  test('DI-07 a negative quantity is not accepted', async ({ dietIndentPage }) => {
    const diet = dietIndent();

    await dietIndentPage.openAddIndent();
    const [card] = await dietIndentPage.wardPatients(1, diet.wardIndex);
    await dietIndentPage.selectPatient(card.admissionNo);

    // A pattern on the form, so the only thing left for the box to be judged on is
    // what goes into it.
    await dietIndentPage.pickAnyPattern(diet.patternSearch);

    // Set and typed, because they are different paths into the control: fill writes the
    // value, pressSequentially sends the keystrokes a nurse would, and a box can refuse
    // one and take the other.
    await dietIndentPage.quantity.fill('-5');
    expect(
      Number(await dietIndentPage.quantity.inputValue()),
      'the quantity box took a negative value'
    ).toBeGreaterThanOrEqual(0);

    await dietIndentPage.quantity.fill('');
    await dietIndentPage.quantity.pressSequentially('-5', { delay: 50 });
    const typed = await dietIndentPage.quantity.inputValue();
    expect(typed, 'the quantity box took a typed minus sign').not.toContain('-');
    expect(
      Number(typed || 0),
      'the quantity box took a typed negative value'
    ).toBeGreaterThanOrEqual(0);
  });

  test('DI-08 Save with the required fields empty is refused, one reason at a time', async ({
    dietIndentPage,
  }) => {
    const diet = dietIndent();

    await dietIndentPage.openAddIndent();

    // Nothing filled in at all. The indent table is what it complains about first.
    expect(await dietIndentPage.saveIndent(), 'Save on an empty form').toBe(MESSAGES.noItems);

    // A patient, still nothing to send up.
    const [card] = await dietIndentPage.wardPatients(1, diet.wardIndex);
    await dietIndentPage.selectPatient(card.admissionNo);
    await dietIndentPage.choosePriority(diet.priority);
    await expect(dietIndentPage.itemRows).toHaveCount(0);
    expect(await dietIndentPage.saveIndent(), 'Save with no food pattern listed').toBe(
      MESSAGES.noItems
    );

    // A line cannot be added without a pattern either - that one is refused at the line,
    // before Save is ever reached, because Enter on Quantity is the add action.
    await dietIndentPage.quantity.fill(String(diet.quantities[0]));
    await dietIndentPage.quantity.press('Enter');
    await expect(dietIndentPage.snackbar).toHaveText(MESSAGES.noPattern);
    await expect(dietIndentPage.itemRows).toHaveCount(0);
  });

  test('DI-08b Save with an indent but no patient is refused', async ({ dietIndentPage }) => {
    const diet = dietIndent();

    await dietIndentPage.openAddIndent();
    await dietIndentPage.choosePriority(diet.priority);
    await dietIndentPage.chooseOutlet(diet.outlet);
    await dietIndentPage.addItem(diet.patternSearch, diet.mark, diet.quantities[0]);

    // The patient panel is the one required field a nurse cannot type into, so leaving it
    // empty is the easiest mistake to make on this form - and the app names it precisely.
    await expect(dietIndentPage.patientName).toHaveValue('');
    expect(await dietIndentPage.saveIndent()).toBe(MESSAGES.noPatient);
    await expect(dietIndentPage.itemRows).toHaveCount(1);
  });

  test('DI-10 several food patterns can be listed on one indent', async ({ dietIndentPage }) => {
    const diet = dietIndent(3);

    await dietIndentPage.openAddIndent();
    const [card] = await dietIndentPage.wardPatients(1, diet.wardIndex);
    await dietIndentPage.selectPatient(card.admissionNo);
    await dietIndentPage.choosePriority(diet.priority);

    const sent = diet.quantities.map((quantity, line) => ({
      remarks: `${diet.mark} line ${line + 1}`,
      quantity,
    }));
    const added = await dietIndentPage.addItems(diet.patternSearch, sent);

    const listed = await dietIndentPage.items();
    expect(listed, 'the indent table lost a line').toHaveLength(sent.length);

    // Every line is a different pattern, in the order they were added, each carrying its
    // own remarks - which is what "all selected items are displayed" means on this form.
    expect(listed.map((line) => line.pattern)).toEqual(added.map((line) => line.pattern));
    expect(new Set(listed.map((line) => line.pattern)).size, 'a pattern was listed twice').toBe(
      sent.length
    );
    expect(listed.map((line) => line.remarks)).toEqual(sent.map((line) => line.remarks));

    // Not asserted: that the quantities are the ones typed. They are not - the table reads
    // 1 on every line whatever was sent, and DI-06 is the case that says so. Recorded here
    // so the report carries the evidence for whoever owns the module.
    test.info().annotations.push({
      type: 'quantity not recorded',
      description:
        `typed ${sent.map((line) => line.quantity).join(', ')} - ` +
        `the indent table recorded ${listed.map((line) => line.quantity).join(', ')}`,
    });
  });

  test('DI-11 letters and symbols are not accepted as a quantity', async ({ dietIndentPage }) => {
    const diet = dietIndent();

    await dietIndentPage.openAddIndent();
    const [card] = await dietIndentPage.wardPatients(1, diet.wardIndex);
    await dietIndentPage.selectPatient(card.admissionNo);

    // A pattern on the form, so the only thing left for the box to be judged on is
    // what goes into it.
    await dietIndentPage.pickAnyPattern(diet.patternSearch);

    for (const rubbish of ['abc', '!@#', '1a2']) {
      await dietIndentPage.quantity.fill('');
      await dietIndentPage.quantity.pressSequentially(rubbish, { delay: 50 });

      // A number and nothing else, or nothing at all. Anything the box did take from
      // "abc" or "!@#" would show up here as a character this pattern does not allow.
      expect(
        await dietIndentPage.quantity.inputValue(),
        `the quantity box took "${rubbish}"`
      ).toMatch(/^\d*$/);
    }
  });
});

/**
 * Diet Indent saves @regression — DI-04, DI-05, DI-09, DI-12, DI-13, DI-14, DI-15.
 *
 * Every case here files at least one real diet indent against a real patient on a live
 * ward. That is the only way to test a save, and the cases are separated into their own
 * describe so a run that should not write can leave them out:
 *
 *   npx playwright test tests/regression/diet-indent.regression.spec.ts -g "DI-0[12368]|DI-1[01]"
 *
 * Each indent lands as Pending on Verify Indent and carries a mark unique to the case in
 * its Remarks, which is both how the case finds its own indent afterwards and how whoever
 * clears them down can tell them from a nurse's.
 *
 * Retries are off. A retry would file a second indent, and the three duplicate cases -
 * DI-05, DI-13, DI-14 - are counting indents, so a retry is the one thing that could make
 * them wrong about the app. A failure after the save went through leaves an indent behind
 * either way; a retry would add another rather than tell us anything new.
 */
test.describe('Diet Indent saves @regression', () => {
  test.describe.configure({ retries: 0 });

  /**
   * Builds a one-line indent ready to save, for `admissionNo` or else for whoever the
   * run's ward offset lands on.
   */
  async function fillIndent(
    dietIndentPage: DietIndentPage,
    diet: ReturnType<typeof dietIndent>,
    admissionNo?: string
  ) {
    const bed = admissionNo ?? (await dietIndentPage.wardPatients(1, diet.wardIndex))[0].admissionNo;
    const patient = await dietIndentPage.selectPatient(bed);
    await dietIndentPage.chooseOutlet(diet.outlet);
    await dietIndentPage.choosePriority(diet.priority);
    const line = await dietIndentPage.addItem(diet.patternSearch, diet.mark, diet.quantities[0]);
    return { patient, line };
  }

  test('DI-04 a diet indent saves against an admitted patient', async ({ dietIndentPage }) => {
    // A ward list, a lookup search and a save over a slow host; the 90s project default is
    // not enough.
    test.setTimeout(240_000);
    const diet = dietIndent();

    await dietIndentPage.openAddIndent();
    await fillIndent(dietIndentPage, diet);

    expect(await dietIndentPage.saveIndent()).toBe(MESSAGES.saved);
    // The message alone is not proof: the snackbar carries refusals too, in the same
    // element. The form emptying itself is the app's second account of the same event.
    await dietIndentPage.expectFormCleared();
  });

  test('DI-05 clicking Save twice files the indent once', async ({ dietIndentPage }) => {
    test.setTimeout(300_000);
    const diet = dietIndent();

    await dietIndentPage.openAddIndent();
    await fillIndent(dietIndentPage, diet);

    expect(await dietIndentPage.saveIndent(), 'the first Save').toBe(MESSAGES.saved);

    // Straight back onto Save, with nothing touched in between - the double-click a nurse
    // makes when the host is slow and the first click looks like it did nothing.
    //
    // What stops the second one is that the save emptied the form: there is no longer an
    // indent table to file, so the app refuses it for the same reason it refuses a blank
    // form. That is a weaker guard than a disabled button - it depends on the clear
    // landing before the second click does - so the count on Verify Indent below is what
    // this case actually stands on.
    expect(await dietIndentPage.saveIndent(), 'the second Save').toBe(MESSAGES.noItems);
    expect(await dietIndentPage.saveIndent(), 'the third Save').toBe(MESSAGES.noItems);

    await dietIndentPage.waitForIndentMarked(diet.mark);
    await dietIndentPage.expectOnlyIndent(diet.mark);
  });

  test('DI-09 the remarks and quantity entered reach the saved indent', async ({
    dietIndentPage,
  }) => {
    test.setTimeout(300_000);
    const diet = dietIndent();

    await dietIndentPage.openAddIndent();
    const { line } = await fillIndent(dietIndentPage, diet);

    expect(await dietIndentPage.saveIndent()).toBe(MESSAGES.saved);
    const raised = await dietIndentPage.waitForIndentMarked(diet.mark);

    // Remarks survive the save intact - they are free text, and the only field on this form
    // whose exact value a case can set and read back.
    expect(raised.remarks).toBe(diet.mark);
    expect(raised.groupName, 'the saved indent is for a different food pattern').toBe(
      line.pattern
    );
    // The quantity reaches Verify Indent as whatever the indent table held, which is the
    // same 1 for every line - so this agrees with the table rather than with what was
    // typed. DI-06 is the case about that; here it is checked only for consistency between
    // the two screens.
    expect(Number(raised.quantity)).toBe(line.quantity);
  });

  test('DI-12 a saved indent appears on Verify Indent as Pending', async ({ dietIndentPage }) => {
    test.setTimeout(300_000);
    const diet = dietIndent();

    await dietIndentPage.openAddIndent();
    const { patient } = await fillIndent(dietIndentPage, diet);

    expect(await dietIndentPage.saveIndent()).toBe(MESSAGES.saved);

    const raised = await dietIndentPage.waitForIndentMarked(diet.mark);
    expect(raised.indentNo, 'the indent was filed without a number').toMatch(/^\d{10,}$/);
    expect(raised.priority).toBe(diet.priority);
    expect(raised.outlet).toBe(diet.outlet);
    // The grid prints the bare bed where the form printed "P(Ex-HDU-02)".
    expect(patient.cabin, `Verify Indent shows ${raised.cabinNo}`).toContain(raised.cabinNo);
    expect(raised.status, 'a new indent should be waiting for the canteen').toBe('Pending');
    expect(raised.userName, 'the indent was filed under no user').not.toBe('');
  });

  test('DI-13 a saved indent survives a reload, and is not filed twice by it', async ({
    dietIndentPage,
  }) => {
    test.setTimeout(300_000);
    const diet = dietIndent();

    await dietIndentPage.openAddIndent();
    await fillIndent(dietIndentPage, diet);

    expect(await dietIndentPage.saveIndent()).toBe(MESSAGES.saved);
    const raised = await dietIndentPage.waitForIndentMarked(diet.mark);

    // A full reload, not a tab switch: this is the nurse who is not sure the save took and
    // refreshes the browser. The risk it covers is a form that re-posts what it still holds.
    await dietIndentPage.openAddIndent();
    await expect(dietIndentPage.itemRows, 'the reloaded form still holds the indent').toHaveCount(
      0
    );
    await expect(dietIndentPage.patientName).toHaveValue('');

    const afterReload = await dietIndentPage.expectOnlyIndent(diet.mark);
    expect(afterReload.indentNo, 'the reload filed a second indent').toBe(raised.indentNo);
    expect(afterReload.status).toBe('Pending');
  });

  test('DI-14 re-saving the same patient indent does not file it again', async ({
    dietIndentPage,
  }) => {
    test.setTimeout(360_000);
    const diet = dietIndent();

    await dietIndentPage.openAddIndent();
    const [card] = await dietIndentPage.wardPatients(1, diet.wardIndex);
    const { line } = await fillIndent(dietIndentPage, diet, card.admissionNo);

    expect(await dietIndentPage.saveIndent()).toBe(MESSAGES.saved);
    const raised = await dietIndentPage.waitForIndentMarked(diet.mark);

    // Back to the form, the same patient, the same meal - the nurse who is not sure the
    // first one went in and orders it again. This is the duplicate the app actually
    // guards: it turns the line away at Enter, before Save is ever reached, because that
    // patient already has that food pattern on order.
    await dietIndentPage.openTab('ADD INDENT');
    await dietIndentPage.selectPatient(card.admissionNo);
    await dietIndentPage.choosePriority(diet.priority);

    const repeat = await dietIndentPage.offerNamedPattern(
      diet.patternSearch,
      line.pattern,
      diet.mark,
      diet.quantities[0]
    );
    expect(repeat.added, `"${line.pattern}" was ordered twice for the same patient`).toBe(false);
    expect(repeat.message).toBe(MESSAGES.duplicatePattern);

    // And with nothing in the table, Save has nothing to file either.
    expect(await dietIndentPage.saveIndent(), 'the repeat Save').toBe(MESSAGES.noItems);

    const afterRepeat = await dietIndentPage.expectOnlyIndent(diet.mark);
    expect(afterRepeat.indentNo).toBe(raised.indentNo);
  });

  test('DI-15 two patients get an indent each', async ({ dietIndentPage }) => {
    test.setTimeout(420_000);
    const first = dietIndent();
    const second = dietIndent();

    await dietIndentPage.openAddIndent();
    const [one, two] = await dietIndentPage.wardPatients(2, first.wardIndex);
    expect(one.admissionNo, 'the ward list offered the same patient twice').not.toBe(
      two.admissionNo
    );

    const filed: Awaited<ReturnType<typeof fillIndent>>[] = [];
    for (const [card, diet] of [
      [one, first],
      [two, second],
    ] as const) {
      // The save clears the form, so the second indent starts from an empty one - no
      // reload is needed between them, and not reloading is the point: this is the case
      // that says one nurse can work down the ward without the form carrying anything
      // over from the last patient.
      filed.push(await fillIndent(dietIndentPage, diet, card.admissionNo));
      expect(await dietIndentPage.saveIndent(), `the indent for ${card.bed}`).toBe(
        MESSAGES.saved
      );
      await dietIndentPage.expectFormCleared();
      await dietIndentPage.openTab('ADD INDENT');
    }

    const raisedFirst = await dietIndentPage.waitForIndentMarked(first.mark);
    const raisedSecond = await dietIndentPage.waitForIndentMarked(second.mark);

    // Two indents, two numbers, two beds - not one indent that the second save overwrote.
    expect(raisedFirst.indentNo, 'both patients were filed under one indent number').not.toBe(
      raisedSecond.indentNo
    );
    expect(filed[0].patient.cabin).toContain(raisedFirst.cabinNo);
    expect(filed[1].patient.cabin).toContain(raisedSecond.cabinNo);
    expect(raisedFirst.cabinNo, 'both indents went to the same bed').not.toBe(
      raisedSecond.cabinNo
    );

    await dietIndentPage.expectOnlyIndent(first.mark);
    await dietIndentPage.expectOnlyIndent(second.mark);
  });
});
