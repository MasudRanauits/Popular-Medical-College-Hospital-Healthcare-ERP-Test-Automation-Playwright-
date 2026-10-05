import { test, expect } from '../../fixtures';
import { IpdServiceEntryPage } from '../../pages';
import type { IpdServiceOption } from '../../pages';
import { ipdServiceEntry } from '../../data/test-data';

const { CART_COLUMNS, BILL_COLUMNS, MESSAGES, BILL_ROW_CAP, TAB } = IpdServiceEntryPage;

/** The index of the first service in `options` that costs nothing, or -1. */
function freeService(options: IpdServiceOption[]): number {
  return options.findIndex((option) => option.rate === 0);
}

/** The index of the first service in `options` that costs something, or -1. */
function pricedService(options: IpdServiceOption[]): number {
  return options.findIndex((option) => option.rate > 0);
}

/**
 * IPD Service Entry @regression — IS-01 … IS-27.
 *
 * Signed-in suite: it runs on the session saved by tests/auth.setup.ts.
 *
 * Covers /hospital/nurse-station, IPD Service Entry — the tab the ward uses to put a
 * chargeable service, a procedure or an OT item onto an admitted patient's bill. The tabs
 * beside it have suites of their own: Medicine Indent is TC_NS_001 … TC_NS_011 in
 * nurse-station.regression.spec.ts, Consultancy Service is CS-01 … CS-23 in
 * consultancy-service.regression.spec.ts, Diet Indent is DI-01 … DI-15 in
 * diet-indent.regression.spec.ts, and Diet Dashboard is DD-01 … DD-17 in
 * diet-dashboard.regression.spec.ts.
 *
 * How the tab works, since nothing on it says
 * -------------------------------------------
 * The ward list fills a patient panel of six read-only boxes — Inv.No, Name, Gender, Age,
 * Assigned Doctor, CabinNo. Under that is one line entry row — Service, Code, Remarks,
 * Service Date, Start Date Time, End Date Time, Rate, Qty — and *Enter on Qty* is what
 * commits a line: there is no Add button, the only buttons under the cart being Save and
 * Print All. The upper grid is the cart, lines costed but not yet billed, with Total Amount
 * and a discount box under it. The lower grid is the bill, every service already saved
 * against the admission, with who saved it and when.
 *
 * Nothing in this suite saves, and that is a finding rather than caution
 * ---------------------------------------------------------------------
 * Consultancy Service puts a bin on every row of its bill, which opens a cancel-with-reason
 * dialog — which is how the cases over there can charge a live admission and take the
 * charge back off again. This tab's bill grid has nine columns and no control of any kind
 * on the row: a service saved here cannot be cancelled, corrected or removed from this tab
 * at all. That is IS-24, and it is also the reason every case below stops at the cart. A
 * case that pressed Save would be making a permanent change to a real patient's bill with
 * no way to undo it, which no amount of care in the test makes acceptable.
 *
 * So the cases here cover everything up to the Save and the one refusal that writes
 * nothing — IS-25, Save against an empty cart. The behaviour of the save itself is a gap,
 * recorded as such in the Known coverage gaps section of the Test Case Document, and it
 * stays a gap until the tab offers a way back.
 *
 * Fourteen findings, and why they are marked rather than written around
 * --------------------------------------------------------------------
 * Each is a case marked test.fail(), so a run reports it as expected-to-fail and reports it
 * as *unexpectedly passing* on the day the module is corrected — which is the signal to
 * drop the marker and keep the assertion. Nothing here is rewritten to match the defect,
 * which would turn it into a documented feature and leave nothing watching for the fix.
 *
 *   - IS-13 The cart is not emptied when another patient is picked. Lines entered for the
 *     patient in bed A are still in the cart, and still in Total Amount, after the nurse
 *     clicks the patient in bed B — and Save then bills them to B. The worst of the
 *     fourteen: one mis-click puts one patient's services on another patient's bill, and
 *     nothing on screen says so happened. The same defect Consultancy Service carries.
 *   - IS-14 The same lines also survive leaving the tab and coming back, and that round
 *     trip *does* reset the patient panel — Inv.No goes back to 0 — so the cart can be
 *     sitting there, with a total under it, against no patient at all.
 *   - IS-15 The Rate box is editable, and whatever is typed into it is what the line
 *     carries. A service the catalogue prices at 1000 goes into the cart at 1 because
 *     somebody typed 1.
 *   - IS-16 Service Change — the discount box under Total Amount — is read by nothing. It
 *     takes a number, the commit resets it to 0, and neither the cart line nor Total Amount
 *     carries it.
 *   - IS-17 Committing a line puts Service Date back to the moment of the commit, so a
 *     service performed three days ago cannot be entered as three days ago. The box takes
 *     the back-date and keeps it through the whole of the entry, right up to the Enter.
 *   - IS-18 The cart grid has a Schedule column and the tab has no Schedule control
 *     anywhere on it, so the column is empty on every line ever entered.
 *   - IS-19 Picking a service never fills the Code box. It stays empty and stays editable,
 *     so the one field that could tie a line to a catalogue entry is free text nobody sets.
 *   - IS-20 An End Date Time earlier than the Start Date Time is taken without a word. A
 *     service that ran from 6pm to 8am the same morning goes into the cart as entered.
 *   - IS-21 Start Date Time and End Date Time are *not* cleared when a line is committed,
 *     although the service, the remarks, the rate and the quantity all are — so the next
 *     line silently inherits the window of the one before it.
 *   - IS-22 A lookup search that matches nothing shows an empty bordered row with no text
 *     in it, rather than saying there is no such service.
 *   - IS-23 The bill grid stops at fifteen rows, and there is no pager, no page-size box
 *     and no total anywhere on the tab. A sixteenth service saved against such a patient is
 *     charged and then cannot be seen here at all.
 *   - IS-24 There is no bin, no edit and no cancel on a bill row — see above.
 *   - IS-26 The bill grid's eighth column is headed "End End".
 *   - IS-07 A line with no service picked is refused in silence: nothing is added to the
 *     cart and nothing is said. Compare IS-06, where a bad quantity *is* worded.
 *
 * Three things the tab gets right are covered as ordinary cases, because they are the ones
 * most worth a regression guard: Qty rejects zero and negatives with a message (IS-06), the
 * cart bins take a line back off and the total follows (IS-09, IS-10), and Save refuses an
 * empty cart rather than writing one (IS-25).
 *
 * What this suite leaves behind
 * -----------------------------
 * Nothing. No case saves, so no bill moves. The cart is client state on the Blazor circuit
 * and each case gets its own, but the cases that deliberately strand lines — IS-13 and
 * IS-14, whose whole subject is a cart that outlives what should clear it — empty it
 * through the bins in a finally anyway, so a shared session could not hand those lines to
 * whatever ran next.
 */
test.describe('IPD Service Entry @regression', () => {
  test('IS-01 IPD Service Entry opens from the Nurse Station tab strip, with both grids', async ({
    homePage,
    ipdServiceEntryPage,
  }) => {
    await homePage.goto();
    await homePage.expectLoaded();

    const link = await homePage.openModule('Hospital', IpdServiceEntryPage.PATH);
    await expect(link).toHaveText(/Nurse Station/i);
    await link.click();

    // The page opens on Medicine Indent — IPD Service Entry is five tabs along, not where
    // it lands, which is the step this case is here to prove.
    await ipdServiceEntryPage.openNurseStation();
    await expect(ipdServiceEntryPage.tab('MEDICINE INDENT')).toHaveClass(/active/);

    await ipdServiceEntryPage.openIpdServiceEntry();

    // The line entry row, whole.
    await expect(ipdServiceEntryPage.serviceLookup, 'the Service lookup is missing').toBeVisible();
    await expect(ipdServiceEntryPage.code).toBeEditable();
    await expect(ipdServiceEntryPage.remarks).toBeEditable();
    for (const label of ['Service Date', 'Start Date Time', 'End Date Time']) {
      await expect(ipdServiceEntryPage.dateBox(label), `the ${label} box is missing`).toBeVisible();
    }
    await expect(ipdServiceEntryPage.rate).toBeEditable();
    await expect(ipdServiceEntryPage.quantity).toBeEditable();
    await expect(ipdServiceEntryPage.save).toBeEnabled();
    await expect(ipdServiceEntryPage.printAll).toBeVisible();

    // Both grids, each with its own columns. The cart carries a tenth for the bin; the
    // bill does not, which is IS-24.
    await expect(
      ipdServiceEntryPage.cartGrid.locator('thead th .sortable-column-header')
    ).toHaveText([...CART_COLUMNS]);
    await expect(
      ipdServiceEntryPage.billGrid.locator('thead th .sortable-column-header')
    ).toHaveText([...BILL_COLUMNS]);
  });

  test('IS-02 the ward list narrows to a bed or an admission number', async ({
    ipdServiceEntryPage,
  }) => {
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();
    const everyone = await ipdServiceEntryPage.patientCards.count();
    expect(everyone, 'the ward list came back empty').toBeGreaterThan(0);

    const patient = await ipdServiceEntryPage.wardPatient(data.wardIndex);

    // An admission number is unique, so it brings back the one card.
    await ipdServiceEntryPage.searchPatient(patient.admissionNo);
    await expect(ipdServiceEntryPage.patientCards).toHaveCount(1, { timeout: 30_000 });
    expect(
      (await ipdServiceEntryPage.readCard(ipdServiceEntryPage.patientCards.first())).admissionNo
    ).toBe(patient.admissionNo);

    // A bed brings back that bed and every bed whose name contains it — "HDU" reaches
    // Ex-HDU-06 as well — so what is checked is that every card matches, not how many
    // there are.
    const ward = patient.bed.replace(/-\d+$/, '');
    await ipdServiceEntryPage.searchPatient(ward);
    await expect(ipdServiceEntryPage.patientCards.first()).toBeVisible({ timeout: 30_000 });
    const beds = await Promise.all(
      (await ipdServiceEntryPage.patientCards.all()).map((card) =>
        ipdServiceEntryPage.readCard(card)
      )
    );
    for (const card of beds) {
      expect(
        `${card.bed} ${card.admissionNo}`.toLowerCase(),
        `"${ward}" brought back ${card.bed}, which does not match it`
      ).toContain(ward.toLowerCase());
    }

    // And a term the ward does not hold empties the list rather than falling back to all
    // of it, which is what would make the search useless.
    await ipdServiceEntryPage.searchPatient(data.noSuchTerm);
    await expect(
      ipdServiceEntryPage.patientCards,
      'a term no bed matches still listed patients'
    ).toHaveCount(0, { timeout: 30_000 });
  });

  test('IS-03 picking a ward patient fills the patient panel, and none of it can be typed into', async ({
    ipdServiceEntryPage,
  }) => {
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();

    // Nothing is on the panel before a card is clicked — Inv.No sits at 0, which is this
    // tab's empty state rather than an admission number.
    expect(await ipdServiceEntryPage.invoiceNo.inputValue(), 'a patient was loaded already').toBe(
      '0'
    );

    const ward = await ipdServiceEntryPage.wardPatient(data.wardIndex);
    const patient = await ipdServiceEntryPage.selectPatient(ward.admissionNo);

    // Inv.No is the admission number — the tab names it Inv.No, but it is the number the
    // ward card carries, not an invoice number of its own.
    expect(patient.invoiceNo, 'Inv.No is not the admission number of the card that was clicked').toBe(
      ward.admissionNo
    );
    expect(patient.name, 'the patient panel named nobody').not.toBe('');
    expect(patient.gender, 'the panel gave no gender').not.toBe('');
    // Age prints as the ERP formats it — "74Y 0M 0D" — so it is checked for shape, not
    // for a number.
    expect(patient.age, `the panel gave an unreadable age: "${patient.age}"`).toMatch(
      /\d+\s*Y/i
    );
    expect(
      patient.cabinNo,
      `the panel says ${patient.cabinNo}, which does not hold the bed ${ward.bed}`
    ).toContain(ward.bed);
    // Assigned Doctor is not asserted to be filled: an admission can genuinely be under no
    // consultant yet, and an empty box there is the ward's state, not the tab's fault.

    // All six are disabled in the markup — there is no typing a patient into this form,
    // by a nurse or by a test. The ward list is the only way in.
    for (const field of [
      ipdServiceEntryPage.invoiceNo,
      ipdServiceEntryPage.patientName,
      ipdServiceEntryPage.gender,
      ipdServiceEntryPage.age,
      ipdServiceEntryPage.assignedDoctor,
      ipdServiceEntryPage.cabinNo,
    ]) {
      await expect(field, 'a patient field can be typed into').toBeDisabled();
    }
  });

  test('IS-04 the Service lookup answers a search with the services it matches, and their rates', async ({
    ipdServiceEntryPage,
  }) => {
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();
    const ward = await ipdServiceEntryPage.wardPatient(data.wardIndex);
    await ipdServiceEntryPage.selectPatient(ward.admissionNo);

    const matches = await ipdServiceEntryPage.serviceOptions(data.serviceSearch);
    expect(
      matches.length,
      `the catalogue offered nothing matching "${data.serviceSearch}"`
    ).toBeGreaterThan(0);

    for (const option of matches) {
      expect(
        option.name.toLowerCase(),
        `"${option.name}" came back for "${data.serviceSearch}" without containing it`
      ).toContain(data.serviceSearch.toLowerCase());
      expect(Number.isNaN(option.rate), `"${option.name}" has no readable rate`).toBe(false);
      expect(option.rate, `"${option.name}" is priced below zero`).toBeGreaterThanOrEqual(0);
    }

    // The catalogue prices several of these at zero — "CCU Visit", "HDU Visit", "Ward
    // Visit" all came back at 0 against an "ICU Visit" at 1000. That is the ward's data
    // rather than the tab's doing, and the lookup does show the rate beside each name,
    // which is the only thing that tells two entries of the same name apart. Recorded
    // rather than asserted on: what the catalogue prices at what is live data.
    test.info().annotations.push({
      type: `services matching "${data.serviceSearch}"`,
      description: matches.map((option) => `${option.name} @ ${option.rate}`).join(' · '),
    });
  });

  test('IS-05 picking a service puts its catalogue rate on the form', async ({
    ipdServiceEntryPage,
  }) => {
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();
    const ward = await ipdServiceEntryPage.wardPatient(data.wardIndex);
    await ipdServiceEntryPage.selectPatient(ward.admissionNo);

    // Nothing is picked on arrival, and the rate and quantity both start at nothing.
    expect(await ipdServiceEntryPage.picked(), 'a service was picked already').toBe('');
    expect(Number(await ipdServiceEntryPage.rate.inputValue())).toBe(0);
    expect(Number(await ipdServiceEntryPage.quantity.inputValue())).toBe(0);

    const matches = await ipdServiceEntryPage.serviceOptions(data.serviceSearch);
    const index = pricedService(matches);
    test.skip(index === -1, `nothing matching "${data.serviceSearch}" carries a rate today`);

    const picked = await ipdServiceEntryPage.pickRow(index);
    expect(picked, 'the lookup put a different service on the form').toBe(matches[index].name);
    await expect(
      ipdServiceEntryPage.rate,
      'the catalogue rate never reached the Rate box'
    ).toHaveValue(String(matches[index].rate), { timeout: 15_000 });

    // And the Service Date box opens on a date and a time of the app's own choosing, which
    // is what IS-17 goes on to show cannot be changed.
    expect(
      await ipdServiceEntryPage.serviceDate.inputValue(),
      'the Service Date box did not open on a date and a time'
    ).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  test('IS-06 Qty refuses zero and negatives, and says why', async ({ ipdServiceEntryPage }) => {
    // Each refusal costs the full wait for a line that never arrives, twice over.
    test.setTimeout(180_000);
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();
    const ward = await ipdServiceEntryPage.wardPatient(data.wardIndex);
    await ipdServiceEntryPage.selectPatient(ward.admissionNo);

    const matches = await ipdServiceEntryPage.serviceOptions(data.serviceSearch);
    const index = freeService(matches);
    test.skip(index === -1, `nothing matching "${data.serviceSearch}" is free of charge today`);
    await ipdServiceEntryPage.pickRow(index);

    // A refused line leaves the service where it was, so the second attempt does not pick
    // it again — that is what makes this one of the few places the tab behaves kindly.
    for (const quantity of [0, -1]) {
      const attempt = await ipdServiceEntryPage.tryAddLine({ qty: quantity });
      expect(attempt.added, `a quantity of ${quantity} was committed to the cart`).toBe(false);
      expect(attempt.said, `nothing was said about a quantity of ${quantity}`).toContain(
        MESSAGES.badQuantity
      );
    }

    await expect(ipdServiceEntryPage.cartRows, 'the cart took a refused line').toHaveCount(0);
  });

  test('IS-07 a line with no service is refused, and the tab says so', async ({
    ipdServiceEntryPage,
  }) => {
    test.setTimeout(120_000);
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();
    const ward = await ipdServiceEntryPage.wardPatient(data.wardIndex);
    await ipdServiceEntryPage.selectPatient(ward.admissionNo);

    // Nothing picked, a perfectly good quantity. IS-06 is the same commit with the
    // quantity wrong, and that one *is* worded — which is what makes the silence here a
    // defect rather than a house style.
    expect(await ipdServiceEntryPage.picked(), 'a service was picked already').toBe('');
    const attempt = await ipdServiceEntryPage.tryAddLine({ qty: 1 });

    // The half the tab gets right: the line is not taken.
    expect(attempt.added, 'a line with no service was committed to the cart').toBe(false);

    test.info().annotations.push({
      type: 'what the tab said about the missing service',
      description: attempt.said === '' ? 'nothing at all' : `"${attempt.said}"`,
    });

    // Expected-to-fail: the nurse presses Enter, nothing lands in the cart, and nothing on
    // screen explains why — the same keystroke that works every other time. Consultancy
    // Service answers the same mistake with "Please select fields." See the file header.
    test.fail();
    expect(
      attempt.said,
      'the tab refused the line without saying anything about the missing service'
    ).not.toBe('');
  });

  test('IS-08 Enter on Qty commits the line, and the cart carries what was entered', async ({
    ipdServiceEntryPage,
  }) => {
    test.setTimeout(180_000);
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();
    const ward = await ipdServiceEntryPage.wardPatient(data.wardIndex);
    await ipdServiceEntryPage.selectPatient(ward.admissionNo);

    const matches = await ipdServiceEntryPage.serviceOptions(data.serviceSearch);
    const index = pricedService(matches);
    test.skip(index === -1, `nothing matching "${data.serviceSearch}" carries a rate today`);
    const option = matches[index];
    await ipdServiceEntryPage.pickRow(index);

    await expect(ipdServiceEntryPage.cartRows, 'the cart was not empty to begin with').toHaveCount(
      0
    );

    const quantity = data.quantities[0];
    const line = await ipdServiceEntryPage.addLine({ remarks: data.mark, qty: quantity });

    expect(line.service, 'the cart names a different service').toBe(option.name);
    expect(line.rate, 'the cart carries a different rate').toBe(option.rate);
    expect(line.qty, 'the cart carries a different quantity').toBe(quantity);
    expect(line.amount, 'the amount is not the rate times the quantity').toBe(
      option.rate * quantity
    );

    // The commit clears the row for the next line — the service, the remarks, the rate and
    // the quantity all go back to empty. The two date boxes do not, which is IS-21.
    const after = await ipdServiceEntryPage.entryRow();
    expect(after.service, 'the service was left on the form after the commit').toBe('');
    expect(after.remarks, 'the remarks were left on the form after the commit').toBe('');
    expect(after.rate, 'the rate was left on the form after the commit').toBe(0);
    expect(after.qty, 'the quantity was left on the form after the commit').toBe(0);
  });

  test('IS-09 the cart bin takes a line off, and Total Amount drops with it', async ({
    ipdServiceEntryPage,
  }) => {
    test.setTimeout(240_000);
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();
    const ward = await ipdServiceEntryPage.wardPatient(data.wardIndex);
    await ipdServiceEntryPage.selectPatient(ward.admissionNo);

    const matches = await ipdServiceEntryPage.serviceOptions(data.serviceSearch);
    const index = pricedService(matches);
    test.skip(index === -1, `nothing matching "${data.serviceSearch}" carries a rate today`);
    const option = matches[index];

    // Two lines of different quantities, so the one that survives can be told from the one
    // that went: the cart prints no identifier of its own beyond what was typed into it.
    const [first, second] = [data.quantities[0], data.quantities[0] + 1];
    for (const quantity of [first, second]) {
      await ipdServiceEntryPage.serviceOptions(data.serviceSearch);
      await ipdServiceEntryPage.pickRow(index);
      await ipdServiceEntryPage.addLine({ remarks: `${data.mark}-${quantity}`, qty: quantity });
    }
    expect(await ipdServiceEntryPage.total(), 'Total Amount is not the sum of the two lines').toBe(
      option.rate * (first + second)
    );

    await ipdServiceEntryPage.removeCartLine(0);

    const left = await ipdServiceEntryPage.cart();
    expect(left, 'taking one line off took more than one').toHaveLength(1);
    expect(left[0].qty, 'taking one line off took the wrong one').toBe(second);
    expect(
      await ipdServiceEntryPage.total(),
      'Total Amount did not drop with the line that was taken off'
    ).toBe(option.rate * second);
  });

  test('IS-10 Total Amount is the sum of the cart', async ({ ipdServiceEntryPage }) => {
    test.setTimeout(240_000);
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();
    const ward = await ipdServiceEntryPage.wardPatient(data.wardIndex);
    await ipdServiceEntryPage.selectPatient(ward.admissionNo);

    const matches = await ipdServiceEntryPage.serviceOptions(data.serviceSearch);
    const index = pricedService(matches);
    test.skip(index === -1, `nothing matching "${data.serviceSearch}" carries a rate today`);

    // Total Amount is checked after every line rather than only at the end, so a total that
    // drifts is caught on the line that broke it rather than attributed to the last one.
    let expected = 0;
    for (const quantity of data.quantities) {
      await ipdServiceEntryPage.serviceOptions(data.serviceSearch);
      await ipdServiceEntryPage.pickRow(index);
      const line = await ipdServiceEntryPage.addLine({
        remarks: `${data.mark}-${quantity}`,
        qty: quantity,
      });
      expected += line.amount;

      await expect(
        ipdServiceEntryPage.totalAmount,
        `Total Amount is not the sum of the ${await ipdServiceEntryPage.cartRows.count()} lines in the cart`
      ).toHaveValue(String(expected), { timeout: 15_000 });
    }

    const cart = await ipdServiceEntryPage.cart();
    expect(cart, 'the cart lost a line along the way').toHaveLength(data.quantities.length);
    expect(
      cart.reduce((sum, line) => sum + line.amount, 0),
      'the cart rows do not add up to Total Amount'
    ).toBe(await ipdServiceEntryPage.total());
  });

  test('IS-11 the Remarks typed on a line reach the cart row', async ({ ipdServiceEntryPage }) => {
    test.setTimeout(180_000);
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();
    const ward = await ipdServiceEntryPage.wardPatient(data.wardIndex);
    await ipdServiceEntryPage.selectPatient(ward.admissionNo);

    const matches = await ipdServiceEntryPage.serviceOptions(data.serviceSearch);
    const index = freeService(matches);
    test.skip(index === -1, `nothing matching "${data.serviceSearch}" is free of charge today`);
    await ipdServiceEntryPage.pickRow(index);

    const line = await ipdServiceEntryPage.addLine({ remarks: data.mark, qty: 1 });

    // Remarks is the only free-text field on the tab that reaches the grid, which makes it
    // the only thing a case — or a nurse — can mark a line with. Worth a guard of its own
    // for that reason, quite apart from the field being useful.
    expect(line.remarks, 'the remarks typed on the line never reached the cart row').toBe(
      data.mark
    );
  });

  test('IS-12 the service window typed on a line reaches the cart row', async ({
    ipdServiceEntryPage,
  }) => {
    test.setTimeout(180_000);
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();
    const ward = await ipdServiceEntryPage.wardPatient(data.wardIndex);
    await ipdServiceEntryPage.selectPatient(ward.admissionNo);

    const matches = await ipdServiceEntryPage.serviceOptions(data.serviceSearch);
    const index = freeService(matches);
    test.skip(index === -1, `nothing matching "${data.serviceSearch}" is free of charge today`);
    await ipdServiceEntryPage.pickRow(index);

    // The hidden halves of the two flatpickrs are what the form posts, and they carry an
    // ISO stamp where the visible boxes carry the shape that was typed. Both are read, so
    // a value that reaches the box but not the form would still be caught.
    const start = await ipdServiceEntryPage.setDateTime('Start Date Time', data.window.start);
    const end = await ipdServiceEntryPage.setDateTime('End Date Time', data.window.end);
    expect(start, 'the start of the window never reached the form').not.toBe('');
    expect(end, 'the end of the window never reached the form').not.toBe('');

    const line = await ipdServiceEntryPage.addLine({ remarks: data.mark, qty: 1 });

    // The grid reformats both as M/d/yyyy h:mm:ss AM/PM, so they are compared as moments
    // rather than as strings — the only honest way to check a value the grid rewrites.
    expect(
      new Date(line.startDate).getTime(),
      `the cart row shows a start of "${line.startDate}", not ${data.window.start}`
    ).toBe(new Date(data.window.start).getTime());
    expect(
      new Date(line.endDate).getTime(),
      `the cart row shows an end of "${line.endDate}", not ${data.window.end}`
    ).toBe(new Date(data.window.end).getTime());
  });

  test('IS-13 the cart is emptied when another patient is picked', async ({
    ipdServiceEntryPage,
  }) => {
    test.setTimeout(240_000);
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();
    const first = await ipdServiceEntryPage.wardPatient(data.wardIndex);
    const firstPanel = await ipdServiceEntryPage.selectPatient(first.admissionNo);

    const matches = await ipdServiceEntryPage.serviceOptions(data.serviceSearch);
    const index = freeService(matches);
    test.skip(index === -1, `nothing matching "${data.serviceSearch}" is free of charge today`);
    await ipdServiceEntryPage.pickRow(index);

    try {
      const line = await ipdServiceEntryPage.addLine({ remarks: data.mark, qty: data.quantities[0] });

      // A different bed. Read off the ward rather than named, so the case does not depend
      // on a particular admission still being there.
      const second = await ipdServiceEntryPage.wardPatient(data.wardIndex + 1);
      test.skip(
        second.admissionNo === first.admissionNo,
        'the ward list is one bed long, so there is no second patient to move to'
      );
      const secondPanel = await ipdServiceEntryPage.selectPatient(second.admissionNo);

      // The patient half moves, which is not in doubt.
      expect(secondPanel.invoiceNo, 'the patient panel did not move to the second bed').toBe(
        second.admissionNo
      );

      const cart = await ipdServiceEntryPage.settledCart();
      test.info().annotations.push({
        type: 'whose services are in the cart, and whose name is over it',
        description:
          `entered for ${firstPanel.name} (${firstPanel.invoiceNo}, ${first.bed}); ` +
          `panel now shows ${secondPanel.name} (${secondPanel.invoiceNo}, ${second.bed}); ` +
          `cart holds ${cart.length} line(s) — ${cart
            .map((row) => `${row.service} x${row.qty} @ ${row.rate}`)
            .join(', ')} — with ${await ipdServiceEntryPage.total()} in Total Amount`,
      });

      // Expected-to-fail: picking a patient starts that patient's bill. Press Save from
      // here and the second patient is billed for the first one's services, with nothing
      // on screen marking the lines as somebody else's. The worst defect on the tab. See
      // the file header.
      test.fail();
      expect(
        cart,
        `the cart still holds ${line.service}, entered for ${first.bed}, under ${second.bed}`
      ).toHaveLength(0);
      expect(
        await ipdServiceEntryPage.total(),
        "Total Amount still holds the previous patient's money"
      ).toBe(0);
    } finally {
      // The subject of this case is a cart that outlives what should clear it, so it is
      // emptied by hand rather than left for the next thing on the circuit to inherit.
      await ipdServiceEntryPage.clearCart().catch(() => {});
    }
  });

  test('IS-14 the cart does not outlive leaving the tab', async ({ ipdServiceEntryPage }) => {
    test.setTimeout(240_000);
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();
    const ward = await ipdServiceEntryPage.wardPatient(data.wardIndex);
    await ipdServiceEntryPage.selectPatient(ward.admissionNo);

    const matches = await ipdServiceEntryPage.serviceOptions(data.serviceSearch);
    const index = freeService(matches);
    test.skip(index === -1, `nothing matching "${data.serviceSearch}" is free of charge today`);
    await ipdServiceEntryPage.pickRow(index);

    try {
      await ipdServiceEntryPage.addLine({ remarks: data.mark, qty: data.quantities[0] });

      await ipdServiceEntryPage.openTab('MEDICINE INDENT');
      await ipdServiceEntryPage.openTab(TAB);
      await ipdServiceEntryPage.expectLoaded();

      // Read settled, not the instant the pane repaints: returning to the tab paints the
      // grid empty for about a second before refilling it, and a read in that window would
      // report a cart the tab had cleared when it had not.
      const cart = await ipdServiceEntryPage.settledCart();
      const panel = await ipdServiceEntryPage.readPatient();

      test.info().annotations.push({
        type: 'what survived the round trip',
        description:
          `cart: ${cart.length} line(s), Total Amount ${await ipdServiceEntryPage.total()}; ` +
          `patient panel: Inv.No "${panel.invoiceNo}", name "${panel.name}"`,
      });

      // The half the tab gets right, and the half that makes the other half dangerous: the
      // panel is reset, so whatever is in the cart now belongs to nobody.
      expect(panel.invoiceNo, 'the patient panel kept the patient across the round trip').toBe('0');

      // Expected-to-fail: a cart with no patient against it should not exist. Either both
      // survive the round trip or neither does, and the next nurse to pick a patient
      // inherits these lines — which is IS-13 by another route. See the file header.
      test.fail();
      expect(cart, 'the cart outlived the tab it was entered on').toHaveLength(0);
    } finally {
      await ipdServiceEntryPage.clearCart().catch(() => {});
    }
  });

  test('IS-15 the catalogue rate cannot be typed over on the form', async ({
    ipdServiceEntryPage,
  }) => {
    test.setTimeout(180_000);
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();
    const ward = await ipdServiceEntryPage.wardPatient(data.wardIndex);
    await ipdServiceEntryPage.selectPatient(ward.admissionNo);

    const matches = await ipdServiceEntryPage.serviceOptions(data.serviceSearch);
    const index = pricedService(matches);
    test.skip(index === -1, `nothing matching "${data.serviceSearch}" carries a rate today`);
    const option = matches[index];
    await ipdServiceEntryPage.pickRow(index);

    // Typed down to 1 rather than up, on purpose: the cart is never saved here, but a case
    // that typed a rate *up* and then died before clearing the cart would have left a
    // bigger number on screen than the ward meant to charge.
    const line = await ipdServiceEntryPage.addLine({ remarks: data.mark, rate: 1, qty: 2 });

    test.info().annotations.push({
      type: 'what the catalogue says, and what the line carries',
      description: `${option.name}: catalogue ${option.rate}, line ${line.rate} x ${line.qty} = ${line.amount}`,
    });

    // Expected-to-fail: a ward nurse entering a service is not the person who prices it.
    // The rate belongs to the catalogue, and the box should not take a new one. The amount
    // is asserted too, because that is the number that reaches the bill. See the header.
    test.fail();
    await expect(
      ipdServiceEntryPage.rate,
      'the Rate box can be typed into at the nurse station'
    ).toBeDisabled();
    expect(line.rate, 'the line went in at the rate that was typed, not the catalogue rate').toBe(
      option.rate
    );
  });

  test('IS-16 Service Change comes off the amount', async ({ ipdServiceEntryPage }) => {
    test.setTimeout(180_000);
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();
    const ward = await ipdServiceEntryPage.wardPatient(data.wardIndex);
    await ipdServiceEntryPage.selectPatient(ward.admissionNo);

    const matches = await ipdServiceEntryPage.serviceOptions(data.serviceSearch);
    const index = matches.findIndex((option) => option.rate > data.discount);
    test.skip(
      index === -1,
      `nothing matching "${data.serviceSearch}" costs more than the ${data.discount} discount today`
    );
    const option = matches[index];
    await ipdServiceEntryPage.pickRow(index);

    const line = await ipdServiceEntryPage.addLine({
      remarks: data.mark,
      serviceChange: data.discount,
      qty: 1,
    });

    test.info().annotations.push({
      type: 'the discount, and what the line charged',
      description:
        `${option.name} at ${option.rate}, discount box set to ${data.discount} — ` +
        `line carries a Service Change of ${line.serviceChange} and an amount of ${line.amount}; ` +
        `the box now reads ${await ipdServiceEntryPage.serviceChange.inputValue()} and ` +
        `Total Amount ${await ipdServiceEntryPage.total()}`,
    });

    // Expected-to-fail: the box is on the form, the cart has a Service Change column and
    // the bill a Discount column, and nothing reads any of it. Worse than the Consultancy
    // Service version of this defect, because the commit also wipes the box — so a nurse
    // who looks back at it sees a zero and may well type it again. See the file header.
    test.fail();
    expect(line.serviceChange, 'the discount never reached the cart line').toBe(data.discount);
    expect(line.amount, 'the discount was not taken off the amount').toBe(
      option.rate - data.discount
    );
    await expect(
      ipdServiceEntryPage.serviceChange,
      'the commit wiped the discount box as well as ignoring it'
    ).toHaveValue(String(data.discount));
  });

  test('IS-17 the Service Date chosen survives committing the line', async ({
    ipdServiceEntryPage,
  }) => {
    test.setTimeout(180_000);
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();
    const ward = await ipdServiceEntryPage.wardPatient(data.wardIndex);
    await ipdServiceEntryPage.selectPatient(ward.admissionNo);

    // The box opens on a date and time of the app's own choosing, and takes the back-date
    // without complaint. What it opened on is read back rather than compared against this
    // machine's clock: the two disagree for the few minutes either side of midnight, and a
    // run that crossed it would fail here against an app behaving perfectly.
    const openedOn = await ipdServiceEntryPage.serviceDate.inputValue();
    expect(openedOn, 'the Service Date box did not open on a date and a time').toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/
    );
    expect(
      openedOn,
      'the Service Date box already held the back-date this case is about to set'
    ).not.toBe(data.backdated);

    const matches = await ipdServiceEntryPage.serviceOptions(data.serviceSearch);
    const index = freeService(matches);
    test.skip(index === -1, `nothing matching "${data.serviceSearch}" is free of charge today`);
    await ipdServiceEntryPage.pickRow(index);

    await ipdServiceEntryPage.setServiceDate(data.backdated);
    await ipdServiceEntryPage.remarks.fill(data.mark);

    // It is still there through the whole of the entry — right up to the Enter.
    //
    // Read through moment() rather than compared as a string: the hidden input posts
    // "2026-10-03T10:00:00" for a date a nurse typed and "2026-10-06 16:23" for one the
    // app set, so a string comparison here fails on the format and never reaches the
    // defect this case is about.
    expect(
      IpdServiceEntryPage.moment(await ipdServiceEntryPage.serviceDate.inputValue()),
      'the Service Date was lost before the line was even committed'
    ).toBe(IpdServiceEntryPage.moment(data.backdated));

    await ipdServiceEntryPage.quantity.fill('1');
    await ipdServiceEntryPage.quantity.press('Enter');
    await expect(ipdServiceEntryPage.cartRows).toHaveCount(1, { timeout: 30_000 });

    // Read once the box has stopped moving, not the moment the row lands: the reset comes a
    // render after the commit, so an immediate read still shows the date that was typed.
    const after = await ipdServiceEntryPage.settledServiceDate();
    test.info().annotations.push({
      type: 'the Service Date across the commit',
      description: `opened on ${openedOn}, set to ${data.backdated}, settles at ${after} once the line is in`,
    });

    // Expected-to-fail: a service performed three days ago cannot be entered as three days
    // ago — committing the line silently puts the date back to the moment of the commit,
    // and the saved row then carries that rather than when the service happened. See the
    // file header.
    test.fail();
    expect(
      IpdServiceEntryPage.moment(after),
      'committing the line threw the Service Date away'
    ).toBe(IpdServiceEntryPage.moment(data.backdated));
  });

  test('IS-18 a committed line carries the schedule its column is for', async ({
    ipdServiceEntryPage,
  }) => {
    test.setTimeout(180_000);
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();
    const ward = await ipdServiceEntryPage.wardPatient(data.wardIndex);
    await ipdServiceEntryPage.selectPatient(ward.admissionNo);

    // There is no Schedule control on this tab at all — not a lookup, not a select, not a
    // box. Consultancy Service has one, offering On Time and Off Time, and this tab shares
    // the column without sharing the control.
    const scheduleControls = await ipdServiceEntryPage.group('Schedule').count();

    const matches = await ipdServiceEntryPage.serviceOptions(data.serviceSearch);
    const index = freeService(matches);
    test.skip(index === -1, `nothing matching "${data.serviceSearch}" is free of charge today`);
    await ipdServiceEntryPage.pickRow(index);

    const line = await ipdServiceEntryPage.addLine({ remarks: data.mark, qty: 1 });

    // The column is there — IS-01 asserts the full header list — so this is not a case of
    // a grid that simply does not show schedules.
    await expect(
      ipdServiceEntryPage.cartGrid.locator('thead th', { hasText: 'Schedule' }),
      'the cart grid has no Schedule column at all, so this case needs rewriting'
    ).toBeVisible();

    test.info().annotations.push({
      type: 'the Schedule column, and what can fill it',
      description:
        `fields labelled "Schedule" on the entry form: ${scheduleControls}; ` +
        `the committed line's Schedule cell: "${line.schedule}"`,
    });

    // Expected-to-fail: the cart grid carries a column the tab gives the nurse no way to
    // fill, so it is empty on every line ever entered — a column of nothing between the
    // service and its rate. See the file header.
    test.fail();
    expect(
      scheduleControls,
      'the entry form has no Schedule field, so the cart column can never be filled'
    ).toBeGreaterThan(0);
    expect(line.schedule, 'the committed line carries no schedule').not.toBe('');
  });

  test('IS-19 picking a service fills the Code box', async ({ ipdServiceEntryPage }) => {
    test.setTimeout(180_000);
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();
    const ward = await ipdServiceEntryPage.wardPatient(data.wardIndex);
    await ipdServiceEntryPage.selectPatient(ward.admissionNo);

    expect(await ipdServiceEntryPage.code.inputValue(), 'the Code box was filled already').toBe('');

    const matches = await ipdServiceEntryPage.serviceOptions(data.serviceSearch);
    test.skip(
      matches.length === 0,
      `the catalogue offered nothing matching "${data.serviceSearch}" today`
    );
    const picked = await ipdServiceEntryPage.pickRow(0);
    const filled = await ipdServiceEntryPage.code.inputValue();

    // Whatever the box is for, the tab lets a nurse type anything into it — and then
    // commits the line regardless, so the free text is not even validated on the way out.
    await ipdServiceEntryPage.code.fill(data.code);
    const line = await ipdServiceEntryPage.addLine({ remarks: data.mark, qty: 1 });

    test.info().annotations.push({
      type: 'the Code box, before and after',
      description:
        `picking "${picked}" left the Code box reading "${filled}"; ` +
        `typing "${data.code}" into it committed a line for "${line.service}" all the same`,
    });

    // Expected-to-fail: Code sits beside the Service lookup and is plainly meant to hold
    // the catalogue code of whatever was picked — it is the one field that could tie a line
    // to a catalogue entry. Nothing fills it, and it stays editable, so it is free text
    // nobody sets and nothing reads. See the file header.
    test.fail();
    expect(filled, `picking "${picked}" left the Code box empty`).not.toBe('');
  });

  test('IS-20 an End Date Time before the Start Date Time is refused', async ({
    ipdServiceEntryPage,
  }) => {
    test.setTimeout(180_000);
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();
    const ward = await ipdServiceEntryPage.wardPatient(data.wardIndex);
    await ipdServiceEntryPage.selectPatient(ward.admissionNo);

    const matches = await ipdServiceEntryPage.serviceOptions(data.serviceSearch);
    const index = freeService(matches);
    test.skip(index === -1, `nothing matching "${data.serviceSearch}" is free of charge today`);
    await ipdServiceEntryPage.pickRow(index);

    // Six in the evening to eight the same morning — a service that finished ten hours
    // before it started.
    await ipdServiceEntryPage.setDateTime('Start Date Time', data.reversed.start);
    await ipdServiceEntryPage.setDateTime('End Date Time', data.reversed.end);

    const attempt = await ipdServiceEntryPage.tryAddLine({ remarks: data.mark, qty: 1 });
    const cart = await ipdServiceEntryPage.cart();

    test.info().annotations.push({
      type: 'the reversed window, and what the cart did with it',
      description:
        `start ${data.reversed.start}, end ${data.reversed.end} — ` +
        `line committed: ${attempt.added}` +
        `${attempt.said ? `, the tab said "${attempt.said}"` : ', in silence'}` +
        `${cart.length > 0 ? `; the row reads ${cart[0].startDate} → ${cart[0].endDate}` : ''}`,
    });

    // Expected-to-fail: a window whose end precedes its start is not a service window, and
    // neither the box nor the commit says a word about it. Nothing downstream can make
    // sense of the row either — a duration read off it is negative. See the file header.
    test.fail();
    expect(attempt.added, 'a line whose end precedes its start was committed to the cart').toBe(
      false
    );
    expect(attempt.said, 'nothing was said about the reversed window').not.toBe('');
  });

  test('IS-21 the service window is cleared with the rest of the line', async ({
    ipdServiceEntryPage,
  }) => {
    test.setTimeout(180_000);
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();
    const ward = await ipdServiceEntryPage.wardPatient(data.wardIndex);
    await ipdServiceEntryPage.selectPatient(ward.admissionNo);

    const matches = await ipdServiceEntryPage.serviceOptions(data.serviceSearch);
    const index = freeService(matches);
    test.skip(index === -1, `nothing matching "${data.serviceSearch}" is free of charge today`);
    await ipdServiceEntryPage.pickRow(index);

    await ipdServiceEntryPage.setDateTime('Start Date Time', data.window.start);
    await ipdServiceEntryPage.setDateTime('End Date Time', data.window.end);
    await ipdServiceEntryPage.addLine({ remarks: data.mark, qty: 1 });

    const after = await ipdServiceEntryPage.entryRow();

    // The rest of the row *is* cleared — IS-08 asserts that — so this is not a tab that
    // keeps the whole line for the next entry. It keeps these two and nothing else.
    expect(after.service, 'the service was left on the form, so this case has moved on').toBe('');

    test.info().annotations.push({
      type: 'what the commit left in the two date boxes',
      description: `Start Date Time "${after.startDateTime}", End Date Time "${after.endDateTime}"`,
    });

    // Expected-to-fail: the next service entered for this patient silently inherits the
    // window of the last one unless the nurse notices and clears both boxes by hand. The
    // commit clears the service, the remarks, the rate and the quantity — leaving these two
    // behind is an omission, not a convenience. See the file header.
    test.fail();
    expect(after.startDateTime, 'the Start Date Time was left on the form after the commit').toBe(
      ''
    );
    expect(after.endDateTime, 'the End Date Time was left on the form after the commit').toBe('');
  });

  test('IS-22 a lookup search that matches nothing says so', async ({ ipdServiceEntryPage }) => {
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();
    const ward = await ipdServiceEntryPage.wardPatient(data.wardIndex);
    await ipdServiceEntryPage.selectPatient(ward.admissionNo);

    const panel = await ipdServiceEntryPage.searchLookup(data.noSuchTerm);

    // Nothing selectable comes back, which is right.
    await expect(
      ipdServiceEntryPage.lookupRows(panel),
      'a term no service matches still offered services'
    ).toHaveCount(0);
    expect(
      await ipdServiceEntryPage.lookupIsEmpty(panel),
      'the lookup came back with neither results nor an empty state'
    ).toBe(true);

    // Expected-to-fail: what the nurse is shown is an empty bordered row with no text in
    // it — the same picture as a lookup that has not finished loading. See the header.
    test.fail();
    await expect(
      panel.locator('tr.rz-datatable-emptymessage-row'),
      'the empty lookup shows a blank row rather than saying there is no such service'
    ).not.toHaveText(/^\s*$/);
  });

  test('IS-23 the bill lists every service charged, however many there are', async ({
    ipdServiceEntryPage,
  }) => {
    test.setTimeout(240_000);

    await ipdServiceEntryPage.openIpdService();

    // A patient the grid has stopped listing. Long-stay beds sit on exactly fifteen rows,
    // so one is normally a few clicks away — but a ward whose longest stay is shorter than
    // that genuinely has nothing to report here.
    const capped: string[] = [];
    const seen: string[] = [];
    for (let index = 0; index < 18 && capped.length === 0; index++) {
      const ward = await ipdServiceEntryPage.wardPatient(index);
      await ipdServiceEntryPage.selectPatient(ward.admissionNo);
      const rows = await ipdServiceEntryPage.billRows.count();
      seen.push(`${ward.bed}: ${rows}`);
      if (rows >= BILL_ROW_CAP) capped.push(`${ward.bed} (${ward.admissionNo})`);
    }
    test.info().annotations.push({
      type: 'saved services listed per bed',
      description: seen.join(' · '),
    });
    test.skip(
      capped.length === 0,
      `no patient in the first eighteen beds has ${BILL_ROW_CAP} services on the bill`
    );

    // Nothing offers the rest: no pager, no page-size box, no total, no "show more".
    await expect(
      ipdServiceEntryPage.page.locator(
        '.mud-table-pagination:visible, .rz-paginator:visible, .pagination:visible'
      ),
      'the bill grid has a pager after all — this case needs rewriting around it'
    ).toHaveCount(0);

    test.info().annotations.push({
      type: 'patients whose bill stops at the cap',
      description: `${capped.join(', ')} — ${BILL_ROW_CAP} rows listed, no pager, no total`,
    });

    // Expected-to-fail: the list stops at fifteen and says nothing about it. A sixteenth
    // service is charged and then cannot be seen on this tab at all — and since the row
    // carries no control either (IS-24), it cannot be reached from here by any route. See
    // the file header.
    test.fail();
    expect(
      await ipdServiceEntryPage.billRows.count(),
      `the bill stops at ${BILL_ROW_CAP} rows, with nothing on the tab saying there are more`
    ).toBeLessThan(BILL_ROW_CAP);
  });

  test('IS-24 a service saved by mistake can be taken off the bill', async ({
    ipdServiceEntryPage,
  }) => {
    test.setTimeout(240_000);
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();

    // Any patient who has been charged something — the case is about what the row offers,
    // so it needs a row.
    let found = false;
    for (let index = 0; index < 12 && !found; index++) {
      const ward = await ipdServiceEntryPage.wardPatient(data.wardIndex + index);
      await ipdServiceEntryPage.selectPatient(ward.admissionNo);
      found = (await ipdServiceEntryPage.billRows.count()) > 0;
    }
    test.skip(!found, 'no patient in reach has a service on the bill to try to take off');

    const row = ipdServiceEntryPage.billRows.first();
    const controls = await row.locator('button, a, input[type="checkbox"]').count();
    const cells = await row.locator('td').count();

    // The cart's rows *do* carry a bin, so this is not a grid library that cannot render
    // one — the tab simply does not put one here.
    const cartHasBins = CART_COLUMNS.length + 1;

    test.info().annotations.push({
      type: 'what a bill row offers',
      description:
        `${cells} cells against ${BILL_COLUMNS.length} named columns and ${controls} control(s); ` +
        `the cart grid, by comparison, renders ${cartHasBins} columns — its extra one is the bin`,
    });

    // Expected-to-fail: a service charged to the wrong patient, at the wrong rate or in the
    // wrong quantity — all of which this tab makes easy, see IS-13 and IS-15 — is permanent
    // as far as this screen is concerned. Consultancy Service puts a bin on every bill row
    // that opens a cancel-with-reason dialog and writes the cancellation to IPD Bill Change
    // History; the same admission's services entered here offer nothing at all. This is
    // also why no case in this suite saves. See the file header.
    test.fail();
    expect(
      controls,
      'a saved service offers no way to cancel, correct or remove it from this tab'
    ).toBeGreaterThan(0);
  });

  test('IS-25 Save refuses an empty cart', async ({ ipdServiceEntryPage }) => {
    test.setTimeout(180_000);
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();
    const ward = await ipdServiceEntryPage.wardPatient(data.wardIndex);
    await ipdServiceEntryPage.selectPatient(ward.admissionNo);

    // The one Save this suite presses, and the reason it is safe to press: the cart is
    // empty, so a refusal is the only outcome that writes nothing. Asserted rather than
    // assumed — if a line were somehow in the cart, this click would charge a real patient.
    const billed = await ipdServiceEntryPage.billRows.count();
    await expect(
      ipdServiceEntryPage.cartRows,
      'the cart is not empty, so this case must not press Save'
    ).toHaveCount(0);

    expect(await ipdServiceEntryPage.clickSave(), 'Save said nothing about the empty cart').toContain(
      MESSAGES.emptyCart
    );

    // And nothing was written: the bill is exactly as long as it was.
    await expect(
      ipdServiceEntryPage.billRows,
      'Save against an empty cart still put something on the bill'
    ).toHaveCount(billed);
  });

  test('IS-26 the bill grid names its columns', async ({ ipdServiceEntryPage }) => {
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();
    const ward = await ipdServiceEntryPage.wardPatient(data.wardIndex);
    await ipdServiceEntryPage.selectPatient(ward.admissionNo);

    const headers = await ipdServiceEntryPage.billGrid
      .locator('thead th .sortable-column-header')
      .allInnerTexts();

    test.info().annotations.push({
      type: 'the bill grid as it heads its columns',
      description: headers.map((text) => text.trim()).join(' | '),
    });

    // Expected-to-fail: the eighth column is headed "End End". It sits beside "Start Date"
    // and holds the end of the service window, so what it should read is "End Date" — the
    // name the cart grid uses for the same value one grid up. Cosmetic, and on the screen a
    // ward nurse reads all day. See the file header.
    test.fail();
    expect(
      headers.map((text) => text.trim()),
      'the bill grid heads its end-of-window column "End End"'
    ).toContain('End Date');
  });

  test('IS-27 saved services carry the window they were entered with', async ({
    ipdServiceEntryPage,
  }) => {
    test.setTimeout(240_000);
    const data = ipdServiceEntry();

    await ipdServiceEntryPage.openIpdService();

    // Several beds rather than one: a single patient whose services were all entered
    // without a window would say nothing either way.
    let rows: { bed: string; withWindow: number; total: number }[] = [];
    for (let index = 0; index < 8; index++) {
      const ward = await ipdServiceEntryPage.wardPatient(data.wardIndex + index);
      await ipdServiceEntryPage.selectPatient(ward.admissionNo);
      const bill = await ipdServiceEntryPage.bill();
      if (bill.length === 0) continue;
      rows.push({
        bed: ward.bed,
        withWindow: bill.filter((line) => line.startDate !== '' || line.endDate !== '').length,
        total: bill.length,
      });
    }
    test.skip(rows.length === 0, 'no patient in reach has a service on the bill to read');

    const saved = rows.reduce((sum, bed) => sum + bed.total, 0);
    const windowed = rows.reduce((sum, bed) => sum + bed.withWindow, 0);

    test.info().annotations.push({
      type: 'saved services carrying a Start Date or an End End',
      description:
        `${windowed} of ${saved} across ${rows.length} bed(s) — ` +
        rows.map((bed) => `${bed.bed}: ${bed.withWindow}/${bed.total}`).join(' · '),
    });

    // Deliberately not marked test.fail(), and deliberately not asserting that the window
    // reaches the bill.
    //
    // The two window boxes are optional on the entry form, so a bill of services entered
    // without one is a bill that is telling the truth. Proving that a *saved* window is
    // dropped would mean saving — and this tab offers no way to take a saved service off
    // again (IS-24), so the suite does not. What the case can do honestly is read what is
    // there and record it: across every bed in reach, not one saved service has ever been
    // seen carrying either end of a window, against a cart grid that shows both (IS-12).
    // That is a figure for whoever owns the module to explain, not a defect this suite is
    // in a position to raise. It is listed under Known coverage gaps for the same reason.
    expect(
      saved,
      'no bill rows were read at all, so the annotation above says nothing'
    ).toBeGreaterThan(0);
    for (const bed of rows) {
      expect(
        bed.withWindow,
        `${bed.bed} reports more services with a window than it has services`
      ).toBeLessThanOrEqual(bed.total);
    }
  });
});
