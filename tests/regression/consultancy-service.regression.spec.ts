import { test, expect } from '../../fixtures';
import { ConsultancyServicePage } from '../../pages';
import type { ConsultancyWardPatient, ServiceOption } from '../../pages';
import { consultancyService } from '../../data/test-data';

const { CART_COLUMNS, BILL_COLUMNS, SCHEDULES, CANCEL_REASONS, MESSAGES, BILL_ROW_CAP } =
  ConsultancyServicePage;

/** The index of the first service in `options` that costs nothing, or -1. */
function freeService(options: ServiceOption[]): number {
  return options.findIndex((option) => option.rate === 0);
}

/** The index of the first service in `options` that costs something, or -1. */
function pricedService(options: ServiceOption[]): number {
  return options.findIndex((option) => option.rate > 0);
}

/**
 * Consultancy Service @regression — CS-01 … CS-23.
 *
 * Signed-in suite: it runs on the session saved by tests/auth.setup.ts.
 *
 * Covers /hospital/nurse-station, Consultancy Service — the tab the ward uses to put a
 * consultant's visit, or any other chargeable service, onto an admitted patient's bill.
 * The tabs beside it have suites of their own: Medicine Indent is TC_NS_001 … TC_NS_011 in
 * nurse-station.regression.spec.ts, Diet Indent is DI-01 … DI-15 in
 * diet-indent.regression.spec.ts, and Diet Dashboard is DD-01 … DD-17 in
 * diet-dashboard.regression.spec.ts.
 *
 * How the tab works, since nothing on it says
 * -------------------------------------------
 * The ward list fills a patient panel of four read-only boxes. Under that is one line
 * entry row — Service, Doctor Name, Service Date, Schedule, Rate, Qty — and *Enter on Qty*
 * is what commits a line: there is no Add button, the only button between the two grids
 * being Save. The upper grid is the cart, lines costed but not yet billed, with Total
 * Amount and a discount box under it. The lower grid is the bill, every consultancy
 * already saved against the admission, with a bin that opens a cancel-with-reason dialog.
 *
 * Eight findings about this tab are worth knowing before reading the cases. Each is a case
 * marked test.fail(), so a run reports it as expected-to-fail and reports it as
 * *unexpectedly passing* on the day the module is corrected — which is the signal to drop
 * the marker and keep the assertion. Nothing here is rewritten to match the defect, which
 * would turn it into a documented feature and leave nothing watching for the fix.
 *
 *   - CS-12 The cart is not emptied when another patient is picked. Lines entered for the
 *     patient in bed A are still in the cart, and still in Total Amount, after the nurse
 *     clicks the patient in bed B — and Save then bills them to B. The worst of the eight:
 *     one mis-click puts one patient's consultants on another patient's bill, and nothing
 *     on screen says so happened.
 *   - CS-13 The same lines also survive leaving the tab and coming back, and that round
 *     trip *does* clear the patient panel — so the cart can be sitting there, with a total
 *     under it, against no patient at all.
 *   - CS-14 The Rate box is editable, and whatever is typed into it is what the line
 *     carries. A service the catalogue prices at 1000 goes onto the bill at 1 because
 *     somebody typed 1. CS-22 is the same finding followed through the save.
 *   - CS-15 Committing a line puts Service Date back to the day the tab opened on, so a
 *     service performed yesterday cannot be entered as yesterday's. The box takes the
 *     date, keeps it through the whole of the entry, and drops it at the Enter — a render
 *     after the row lands, which is why the case reads it settled rather than straight away.
 *   - CS-16 Service Change — the discount box under Total Amount — is read by nothing. It
 *     takes a number, keeps it, and neither the cart line nor the saved row carries it.
 *   - CS-17 Doctor Name is a required field, enforced with "Please select fields." — but
 *     the first row of its lookup is a blank record, and picking that satisfies the guard.
 *     The line is committed, and saved, with no doctor against it.
 *   - CS-18 A lookup search that matches nothing shows an empty bordered row with no text
 *     in it, rather than saying there is no such service.
 *   - CS-23 The bill grid stops at fifteen rows, and there is no pager, no page-size box
 *     and no total anywhere on the tab. Six of the first eighteen beds are already on
 *     exactly fifteen. A sixteenth consultancy saved against one of those is charged and
 *     then cannot be seen here at all — and because the bin lives on the row, it cannot be
 *     cancelled from this tab either. This one bit the suite before it was understood: a
 *     writing case picked a patient already at the cap, saved, and could not find its own
 *     row. Every writing case now goes through patientBelowBillCap for that reason.
 *
 * Three things the tab gets right are covered as ordinary cases, because they are the ones
 * most worth a regression guard: Qty rejects zero and negatives (CS-07), Service and
 * Doctor are required (CS-06), and cancelling a saved service demands a reason and records
 * it in the change log (CS-20, CS-21).
 *
 * What writes, and what it leaves behind
 * --------------------------------------
 * Only the second describe saves. Every case there charges a live admission, so each one
 * takes back off the bill what it put on, in a finally, through the tab's own cancel
 * dialog — which is a cancellation with a stated reason, recorded in IPD Bill Change
 * History, not a deletion. Each case also prefers a service the catalogue prices at zero,
 * so a run that dies between the save and the cleanup has still moved nobody's bill. The
 * one exception is CS-22, which is about the rate and so has to use a priced service; it
 * types the rate *down* to 1 and cancels it like the rest.
 *
 * The cleanup takes off only the rows its own case added — see cancelSince, and the note
 * over the second describe. On a long-stay patient the bill is fifteen real consultancies,
 * and a cleanup that simply emptied it would unpick a month of somebody's treatment.
 *
 * A run that should not write can leave the whole of it out:
 *
 *   npx playwright test tests/regression/consultancy-service.regression.spec.ts -g "CS-0|CS-1|CS-23"
 */
test.describe('Consultancy Service @regression', () => {
  test('CS-01 Consultancy Service opens from the Nurse Station tab strip, with both grids', async ({
    homePage,
    consultancyServicePage,
  }) => {
    await homePage.goto();
    await homePage.expectLoaded();

    const link = await homePage.openModule('Hospital', ConsultancyServicePage.PATH);
    await expect(link).toHaveText(/Nurse Station/i);
    await link.click();

    // The page opens on Medicine Indent — Consultancy Service is four tabs along, not
    // where it lands, which is the step this case is here to prove.
    await consultancyServicePage.openNurseStation();
    await expect(consultancyServicePage.tab('MEDICINE INDENT')).toHaveClass(/active/);

    await consultancyServicePage.openConsultancyService();

    // The line entry row, whole.
    for (const label of ['Service', 'Doctor Name', 'Schedule']) {
      await expect(consultancyServicePage.lookup(label), `the ${label} lookup is missing`).toBeVisible();
    }
    await expect(consultancyServicePage.serviceDateBox).toBeVisible();
    await expect(consultancyServicePage.rate).toBeEditable();
    await expect(consultancyServicePage.quantity).toBeEditable();
    await expect(consultancyServicePage.save).toBeEnabled();

    // Both grids, each with its own columns and a last one for the bin.
    await expect(
      consultancyServicePage.cartGrid.locator('thead th .sortable-column-header')
    ).toHaveText([...CART_COLUMNS]);
    await expect(
      consultancyServicePage.billGrid.locator('thead th .sortable-column-header')
    ).toHaveText([...BILL_COLUMNS]);
  });

  test('CS-02 the ward list narrows to a bed or an admission number', async ({
    consultancyServicePage,
  }) => {
    const data = consultancyService();

    await consultancyServicePage.openConsultancy();
    const everyone = await consultancyServicePage.patientCards.count();
    expect(everyone, 'the ward list came back empty').toBeGreaterThan(0);

    const patient = await consultancyServicePage.wardPatient(data.wardIndex);

    // An admission number is unique, so it brings back the one card.
    await consultancyServicePage.searchPatient(patient.admissionNo);
    await expect(consultancyServicePage.patientCards).toHaveCount(1, { timeout: 30_000 });
    expect((await consultancyServicePage.readCard(consultancyServicePage.patientCards.first())).admissionNo).toBe(
      patient.admissionNo
    );

    // A bed brings back that bed and every bed whose name contains it — "ICU" reaches
    // NICU-11 and Neuro ICU-13 as well — so what is checked is that every card matches,
    // not how many there are.
    const ward = patient.bed.replace(/-\d+$/, '');
    await consultancyServicePage.searchPatient(ward);
    await expect(consultancyServicePage.patientCards.first()).toBeVisible({ timeout: 30_000 });
    const beds = await Promise.all(
      (await consultancyServicePage.patientCards.all()).map((card) =>
        consultancyServicePage.readCard(card)
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
    await consultancyServicePage.searchPatient(data.noSuchTerm);
    await expect(
      consultancyServicePage.patientCards,
      'a term no bed matches still listed patients'
    ).toHaveCount(0, { timeout: 30_000 });
  });

  test('CS-03 picking a ward patient fills the patient panel, and none of it can be typed into', async ({
    consultancyServicePage,
  }) => {
    const data = consultancyService();

    await consultancyServicePage.openConsultancy();
    const ward = await consultancyServicePage.wardPatient(data.wardIndex);
    const patient = await consultancyServicePage.selectPatient(ward.admissionNo);

    // Inv.No is the admission number — the tab names it Inv.No, but it is the number the
    // ward card carries, not an invoice number of its own.
    expect(patient.invoiceNo, 'Inv.No is not the admission number of the card that was clicked').toBe(
      ward.admissionNo
    );
    expect(patient.name, 'the patient panel named nobody').not.toBe('');
    expect(
      patient.cabinNo,
      `the panel says ${patient.cabinNo}, which does not hold the bed ${ward.bed}`
    ).toContain(ward.bed);
    // Assigned Doctor is not asserted to be filled: an admission can genuinely be under no
    // consultant yet, and an empty box there is the ward's state, not the tab's fault.

    // All four are disabled in the markup — there is no typing a patient into this form,
    // by a nurse or by a test. The ward list is the only way in.
    for (const field of [
      consultancyServicePage.invoiceNo,
      consultancyServicePage.patientName,
      consultancyServicePage.assignedDoctor,
      consultancyServicePage.cabinNo,
    ]) {
      await expect(field, 'a patient field can be typed into').toBeDisabled();
    }
  });

  test('CS-04 the Service lookup answers a search with the services it matches, and their rates', async ({
    consultancyServicePage,
  }) => {
    const data = consultancyService();

    await consultancyServicePage.openConsultancy();
    const ward = await consultancyServicePage.wardPatient(data.wardIndex);
    await consultancyServicePage.selectPatient(ward.admissionNo);

    const matches = await consultancyServicePage.serviceOptions(data.serviceSearch);
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

    // The catalogue holds entries that share a name and differ only in rate — two called
    // "ICU Visit", at 1000 and at 0. That is the ward's data rather than the tab's doing,
    // and the lookup does show the rate beside each, which is the only thing that tells
    // them apart. Recorded rather than asserted on: which names repeat is live data.
    const names = matches.map((option) => option.name);
    const repeated = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
    if (repeated.length > 0) {
      test.info().annotations.push({
        type: 'services offered under one name at more than one rate',
        description: repeated
          .map(
            (name) =>
              `${name}: ${matches
                .filter((option) => option.name === name)
                .map((option) => option.rate)
                .join(', ')}`
          )
          .join(' — '),
      });
    }
  });

  test('CS-05 picking a service puts its catalogue rate on the form, and Schedule offers two', async ({
    consultancyServicePage,
  }) => {
    const data = consultancyService();

    await consultancyServicePage.openConsultancy();
    const ward = await consultancyServicePage.wardPatient(data.wardIndex);
    await consultancyServicePage.selectPatient(ward.admissionNo);

    // Nothing is picked on arrival, and the rate starts at nothing.
    expect(await consultancyServicePage.picked('Service'), 'a service was picked already').toBe('');
    expect(Number(await consultancyServicePage.rate.inputValue())).toBe(0);

    const matches = await consultancyServicePage.serviceOptions(data.serviceSearch);
    const index = pricedService(matches);
    test.skip(index === -1, `nothing matching "${data.serviceSearch}" carries a rate today`);

    const picked = await consultancyServicePage.pickRow('Service', index);
    expect(picked, 'the lookup put a different service on the form').toBe(matches[index].name);
    await expect(
      consultancyServicePage.rate,
      'the catalogue rate never reached the Rate box'
    ).toHaveValue(String(matches[index].rate), { timeout: 15_000 });

    // The doctor lookup searches the consultant list, and brings back the one match.
    const doctor = await consultancyServicePage.pickDoctor(data.doctorSearch);
    expect(doctor.toLowerCase(), 'the Doctor Name lookup picked somebody else').toContain(
      data.doctorSearch.toLowerCase()
    );

    // Schedule holds exactly On Time and Off Time — no placeholder, no third option.
    const panel = await consultancyServicePage.openLookup('Schedule');
    await expect(consultancyServicePage.lookupRows(panel)).toHaveText([...SCHEDULES]);
    expect(await consultancyServicePage.pickSchedule('Off Time')).toBe('Off Time');
  });

  test('CS-06 a line with no service, or no doctor, is refused', async ({
    consultancyServicePage,
  }) => {
    // Each refusal costs the full wait for a line that never arrives, twice over.
    test.setTimeout(180_000);
    const data = consultancyService();

    await consultancyServicePage.openConsultancy();
    const ward = await consultancyServicePage.wardPatient(data.wardIndex);
    await consultancyServicePage.selectPatient(ward.admissionNo);

    // Nothing picked at all: a quantity on its own is not a line.
    const bare = await consultancyServicePage.tryAddLine({ qty: 1 });
    expect(bare.added, 'a quantity with no service was taken as a line').toBe(false);
    expect(bare.said, 'nothing was said about the empty line').toContain(MESSAGES.missingFields);

    // A service but no doctor. Doctor Name is required, and this is the guard that CS-17
    // then walks straight through with the lookup's blank row.
    const noDoctor = await consultancyServicePage.tryAddLine({
      service: data.serviceSearch,
      schedule: 'On Time',
      qty: 1,
    });
    expect(noDoctor.added, 'a line with no doctor was taken').toBe(false);
    expect(noDoctor.said, 'nothing was said about the missing doctor').toContain(
      MESSAGES.missingFields
    );

    await expect(consultancyServicePage.cartRows, 'a refused line reached the cart').toHaveCount(0);
  });

  test('CS-07 a quantity of zero, or a negative one, is refused', async ({
    consultancyServicePage,
  }) => {
    // Two refusals, each paying the full wait for a line that never arrives.
    test.setTimeout(180_000);
    const data = consultancyService();

    await consultancyServicePage.openConsultancy();
    const ward = await consultancyServicePage.wardPatient(data.wardIndex);
    await consultancyServicePage.selectPatient(ward.admissionNo);

    for (const quantity of [0, -5]) {
      const attempt = await consultancyServicePage.tryAddLine({
        service: data.serviceSearch,
        doctor: data.doctorSearch,
        schedule: 'On Time',
        qty: quantity,
      });
      expect(attempt.added, `a quantity of ${quantity} was taken as a line`).toBe(false);
      expect(attempt.said, `nothing was said about a quantity of ${quantity}`).toContain(
        MESSAGES.badQuantity
      );
    }

    await expect(consultancyServicePage.cartRows, 'a refused line reached the cart').toHaveCount(0);

    // The refusal leaves the service and the doctor where they were, so the nurse corrects
    // the number rather than picking the service again.
    expect(await consultancyServicePage.picked('Service'), 'the refusal cleared the service').not.toBe(
      ''
    );
    expect(await consultancyServicePage.picked('Doctor Name'), 'the refusal cleared the doctor').not.toBe(
      ''
    );
  });

  test('CS-08 Enter on Qty adds the line at rate x qty, and Total Amount is the cart', async ({
    consultancyServicePage,
  }) => {
    const data = consultancyService();

    await consultancyServicePage.openConsultancy();
    const ward = await consultancyServicePage.wardPatient(data.wardIndex);
    await consultancyServicePage.selectPatient(ward.admissionNo);

    for (const [index, quantity] of data.quantities.entries()) {
      const matches = await consultancyServicePage.serviceOptions(data.serviceSearch);
      expect(matches.length, 'the catalogue offered nothing to bill').toBeGreaterThan(index);
      const option = matches[index];
      await consultancyServicePage.pickRow('Service', index);

      const line = await consultancyServicePage.addLine({
        doctor: data.doctorSearch,
        schedule: SCHEDULES[index % SCHEDULES.length],
        qty: quantity,
      });

      expect(line.service, 'the cart line names a different service').toBe(option.name);
      expect(line.qty, 'the cart line carries a different quantity').toBe(quantity);
      expect(line.rate, 'the cart line is not at the catalogue rate').toBe(option.rate);
      expect(
        line.amount,
        `${option.name} at ${option.rate} x ${quantity} came to ${line.amount}`
      ).toBe(option.rate * quantity);
      expect(line.schedule, 'the schedule never reached the cart line').toBe(
        SCHEDULES[index % SCHEDULES.length]
      );
    }

    const cart = await consultancyServicePage.cart();
    expect(cart, 'the cart does not hold one line per commit').toHaveLength(data.quantities.length);

    const sum = cart.reduce((running, line) => running + line.amount, 0);
    expect(await consultancyServicePage.total(), 'Total Amount is not the sum of the cart').toBe(sum);

    // The entry row is cleared ready for the next line, except the service and its rate,
    // which are left in place — the ward often bills the same service twice over.
    const entry = await consultancyServicePage.entryRow();
    expect(entry.qty, 'the quantity was left on the form after the line went in').toBe(0);
    expect(entry.doctor, 'the doctor was left on the form after the line went in').toBe('');
  });

  test('CS-09 a cart line can be taken off again before it is saved', async ({
    consultancyServicePage,
  }) => {
    const data = consultancyService();

    await consultancyServicePage.openConsultancy();
    const ward = await consultancyServicePage.wardPatient(data.wardIndex);
    await consultancyServicePage.selectPatient(ward.admissionNo);

    const matches = await consultancyServicePage.serviceOptions(data.serviceSearch);
    expect(matches.length, 'the catalogue offered nothing to bill').toBeGreaterThan(1);

    await consultancyServicePage.pickRow('Service', 0);
    const first = await consultancyServicePage.addLine({
      doctor: data.doctorSearch,
      schedule: 'On Time',
      qty: 1,
    });
    await consultancyServicePage.serviceOptions(data.serviceSearch);
    await consultancyServicePage.pickRow('Service', 1);
    const second = await consultancyServicePage.addLine({
      doctor: data.doctorSearch,
      schedule: 'On Time',
      qty: 1,
    });

    expect(await consultancyServicePage.total()).toBe(first.amount + second.amount);

    // The bin acts on the first click: no confirmation, no message — the row simply goes.
    await consultancyServicePage.removeCartLine(0);

    const left = await consultancyServicePage.cart();
    expect(left, 'the bin took off more than the one row').toHaveLength(1);
    expect(left[0].service, 'the bin took off the wrong row').toBe(second.service);
    expect(
      await consultancyServicePage.total(),
      'Total Amount still carries the line that was taken off'
    ).toBe(second.amount);
  });

  test('CS-10 Save with an empty cart is refused', async ({ consultancyServicePage }) => {
    const data = consultancyService();

    await consultancyServicePage.openConsultancy();
    const ward = await consultancyServicePage.wardPatient(data.wardIndex);
    await consultancyServicePage.selectPatient(ward.admissionNo);

    await expect(consultancyServicePage.cartRows, 'the cart was not empty to start with').toHaveCount(
      0
    );
    const billed = await consultancyServicePage.billRows.count();

    expect(await consultancyServicePage.saveBill(), 'an empty Save was not refused').toContain(
      MESSAGES.emptyCart
    );
    await expect(
      consultancyServicePage.billRows,
      'an empty Save still put something on the bill'
    ).toHaveCount(billed);
  });

  test('CS-11 the bill lists what the ward has already charged this admission', async ({
    consultancyServicePage,
  }) => {
    test.setTimeout(180_000);

    await consultancyServicePage.openConsultancy();

    // A patient with nothing on their bill yet is the normal case on a quiet ward and not
    // a failure, so the ward is walked until one with a bill turns up.
    let found: ConsultancyWardPatient | undefined;
    for (let index = 0; index < 10 && found === undefined; index++) {
      const ward = await consultancyServicePage.wardPatient(index);
      await consultancyServicePage.selectPatient(ward.admissionNo);
      if ((await consultancyServicePage.billRows.count()) > 0) found = ward;
    }
    test.skip(found === undefined, 'no patient in the first ten beds has been charged a service');

    const bill = await consultancyServicePage.bill();
    for (const row of bill) {
      expect(row.service, 'a charge was listed against no service').not.toBe('');
      expect(row.qty, `"${row.service}" was billed in a quantity of ${row.qty}`).toBeGreaterThan(0);
      expect(row.rate, `"${row.service}" was billed below zero`).toBeGreaterThanOrEqual(0);
      expect(
        row.amount,
        `"${row.service}" at ${row.rate} x ${row.qty} less ${row.discount} is on the bill as ${row.amount}`
      ).toBe(row.rate * row.qty - row.discount);
      expect(row.servedBy, `"${row.service}" was billed by nobody`).not.toBe('');
      expect(
        row.serviceDate,
        `"${row.service}" carries a date of "${row.serviceDate}"`
      ).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}:\d{2} (AM|PM)$/);
    }

    // The doctor is not asserted to be filled, because it is not always: CS-17 is the
    // case about how a blank one gets onto the bill in the first place.
    const headless = bill.filter((row) => row.doctor === '');
    if (headless.length > 0) {
      test.info().annotations.push({
        type: 'services billed with no doctor against them',
        description: headless.map((row) => row.service).join(', '),
      });
    }
  });

  test('CS-12 the cart is emptied when another patient is picked', async ({
    consultancyServicePage,
  }) => {
    test.setTimeout(180_000);
    const data = consultancyService();

    await consultancyServicePage.openConsultancy();
    const first = await consultancyServicePage.wardPatient(data.wardIndex);
    const second = await consultancyServicePage.wardPatient(data.wardIndex + 1);
    test.skip(
      first.admissionNo === second.admissionNo,
      'the ward list is too short to hold two different patients'
    );

    const one = await consultancyServicePage.selectPatient(first.admissionNo);
    await consultancyServicePage.addLine({
      service: data.serviceSearch,
      doctor: data.doctorSearch,
      schedule: 'On Time',
      qty: 1,
    });
    const entered = await consultancyServicePage.cart();
    expect(entered, 'nothing was in the cart to carry over').toHaveLength(1);

    // Now the mis-click this case is about: the nurse moves to the next bed.
    const two = await consultancyServicePage.selectPatient(second.admissionNo);
    expect(two.invoiceNo, 'the panel never moved to the second patient').toBe(second.admissionNo);
    expect(two.name, 'the panel never moved to the second patient').not.toBe(one.name);

    // What is on screen at this point: the second patient's name and bed, over the first
    // patient's services, with the first patient's money in Total Amount. Save from here
    // and the second patient is billed for the first one's consultants.
    test.info().annotations.push({
      type: 'what Save would bill, and to whom',
      description:
        `entered for ${one.name} (${one.invoiceNo}): ` +
        entered.map((line) => `${line.service} x${line.qty} = ${line.amount}`).join(', ') +
        ` — on screen against ${two.name} (${two.invoiceNo})`,
    });

    // Expected-to-fail: picking a patient should start that patient's bill, not inherit
    // the last one's. See the file header.
    test.fail();
    await expect(
      consultancyServicePage.cartRows,
      "the previous patient's uncommitted services are still in the cart"
    ).toHaveCount(0);
    expect(
      await consultancyServicePage.total(),
      "Total Amount still carries the previous patient's services"
    ).toBe(0);
  });

  test('CS-13 the cart is emptied when the tab is left and come back to', async ({
    consultancyServicePage,
  }) => {
    test.setTimeout(180_000);
    const data = consultancyService();

    await consultancyServicePage.openConsultancy();
    const ward = await consultancyServicePage.wardPatient(data.wardIndex);
    const patient = await consultancyServicePage.selectPatient(ward.admissionNo);
    await consultancyServicePage.addLine({
      service: data.serviceSearch,
      doctor: data.doctorSearch,
      schedule: 'On Time',
      qty: 1,
    });
    expect(await consultancyServicePage.cart(), 'nothing was in the cart to carry over').toHaveLength(
      1
    );

    await consultancyServicePage.openTab('MEDICINE INDENT');
    await consultancyServicePage.openTab(ConsultancyServicePage.TAB);
    await consultancyServicePage.expectLoaded();

    // Read once the pane has stopped moving. Coming back to the tab paints the grid before
    // its contents are back in it, so for about a second the cart reads empty and then
    // fills again — and a case that read in that window would report the tab clearing the
    // cart, which it does not. See settledCart.
    const left = await consultancyServicePage.settledCart();

    // The round trip does clear the patient panel — which is the half of this the tab gets
    // right, and is also what makes the other half worse: the cart is left holding lines,
    // and Total Amount a figure, against nobody at all.
    const after = await consultancyServicePage.readPatient();
    expect(after.name, 'the patient panel survived the tab round trip').toBe('');

    test.info().annotations.push({
      type: 'what is on screen after the round trip',
      description:
        `patient panel: ${after.name === '' ? 'empty' : after.name} — cart: ` +
        left.map((line) => `${line.service} x${line.qty} = ${line.amount}`).join(', ') +
        ` — Total Amount: ${await consultancyServicePage.total()}` +
        ` (entered for ${patient.name})`,
    });

    // Expected-to-fail: a cart with no patient against it should not exist. See the header.
    test.fail();
    expect(
      left,
      'the cart survived the tab round trip that cleared the patient it belonged to'
    ).toHaveLength(0);
  });

  test('CS-14 the catalogue rate cannot be typed over on the form', async ({
    consultancyServicePage,
  }) => {
    const data = consultancyService();

    await consultancyServicePage.openConsultancy();
    const ward = await consultancyServicePage.wardPatient(data.wardIndex);
    await consultancyServicePage.selectPatient(ward.admissionNo);

    const matches = await consultancyServicePage.serviceOptions(data.serviceSearch);
    const index = pricedService(matches);
    test.skip(index === -1, `nothing matching "${data.serviceSearch}" carries a rate today`);
    const option = matches[index];
    await consultancyServicePage.pickRow('Service', index);

    // Typed down to 1 rather than up, on purpose: the cart is never saved here, but a case
    // that typed a rate *up* and then died before clearing the cart would have left a
    // bigger number on screen than the ward meant to charge.
    const line = await consultancyServicePage.addLine({
      doctor: data.doctorSearch,
      schedule: 'On Time',
      rate: 1,
      qty: 1,
    });

    test.info().annotations.push({
      type: 'what the catalogue says, and what the line carries',
      description: `${option.name}: catalogue ${option.rate}, line ${line.rate}, amount ${line.amount}`,
    });

    // Expected-to-fail: a ward nurse adding a consultant's visit is not the person who
    // prices it. The rate belongs to the catalogue, and the box should not take a new one.
    // CS-22 follows the same finding through the save. See the file header.
    test.fail();
    await expect(
      consultancyServicePage.rate,
      'the Rate box can be typed into at the nurse station'
    ).toBeDisabled();
    expect(line.rate, 'the line went in at the rate that was typed, not the catalogue rate').toBe(
      option.rate
    );
  });

  test('CS-15 the Service Date chosen survives committing the line', async ({
    consultancyServicePage,
  }) => {
    const data = consultancyService();

    await consultancyServicePage.openConsultancy();
    const ward = await consultancyServicePage.wardPatient(data.wardIndex);
    await consultancyServicePage.selectPatient(ward.admissionNo);

    // The box opens on a date of the app's own choosing, and takes the back-date without
    // complaint. What it opened on is read back rather than compared against this machine's
    // clock: the two disagree for the few minutes either side of midnight, and a run that
    // crossed it failed here against an app that was behaving perfectly.
    const openedOn = await consultancyServicePage.serviceDate.inputValue();
    expect(openedOn, 'the Service Date box did not open on a date at all').toMatch(
      /^\d{4}-\d{2}-\d{2}$/
    );
    expect(
      openedOn,
      'the Service Date box already held the back-date this case is about to set'
    ).not.toBe(data.backdated);
    await consultancyServicePage.setServiceDate(data.backdated);

    await consultancyServicePage.pickService(data.serviceSearch);
    await consultancyServicePage.pickDoctor(data.doctorSearch);
    await consultancyServicePage.pickSchedule('On Time');

    // It is still there through the whole of the entry — right up to the Enter.
    await expect(
      consultancyServicePage.serviceDate,
      'the Service Date was lost before the line was even committed'
    ).toHaveValue(data.backdated);

    await consultancyServicePage.quantity.fill('1');
    await consultancyServicePage.quantity.press('Enter');
    await expect(consultancyServicePage.cartRows).toHaveCount(1, { timeout: 30_000 });

    // Read once the box has stopped moving, not the moment the row lands: the reset comes
    // a render after the commit, so an immediate read still shows the date that was typed.
    // See settledServiceDate.
    const after = await consultancyServicePage.settledServiceDate();
    test.info().annotations.push({
      type: 'the Service Date across the commit',
      description:
        `opened on ${openedOn}, set to ${data.backdated}, ` +
        `settles at ${after} once the line is in`,
    });

    // Expected-to-fail: a service performed three days ago cannot be entered as three days
    // ago — committing the line silently puts the date back to the day the tab opened on,
    // and the saved row then carries the moment of the save rather than either. See the
    // file header.
    test.fail();
    expect(after, 'committing the line put the Service Date back').toBe(data.backdated);
    expect(after, 'the Service Date was put back to the day the tab opened on').not.toBe(openedOn);
  });

  test('CS-16 Service Change comes off the amount', async ({ consultancyServicePage }) => {
    const data = consultancyService();

    await consultancyServicePage.openConsultancy();
    const ward = await consultancyServicePage.wardPatient(data.wardIndex);
    await consultancyServicePage.selectPatient(ward.admissionNo);

    const matches = await consultancyServicePage.serviceOptions(data.serviceSearch);
    const index = matches.findIndex((option) => option.rate > data.discount);
    test.skip(
      index === -1,
      `nothing matching "${data.serviceSearch}" costs more than the ${data.discount} discount today`
    );
    const option = matches[index];
    await consultancyServicePage.pickRow('Service', index);

    await consultancyServicePage.fillLine({
      doctor: data.doctorSearch,
      schedule: 'On Time',
      qty: 1,
    });
    await consultancyServicePage.serviceChange.fill(String(data.discount));
    await consultancyServicePage.quantity.press('Enter');
    await expect(consultancyServicePage.cartRows).toHaveCount(1, { timeout: 30_000 });

    const [line] = await consultancyServicePage.cart();

    // The box keeps what was typed into it, so nothing on screen suggests it was ignored.
    await expect(
      consultancyServicePage.serviceChange,
      'the discount box did not even keep what was typed into it'
    ).toHaveValue(String(data.discount));

    test.info().annotations.push({
      type: 'the discount, and what the line charged',
      description:
        `${option.name} at ${option.rate}, discount box ${data.discount} — ` +
        `line carries a Service Change of ${line.serviceChange} and an amount of ${line.amount}`,
    });

    // Expected-to-fail: the box is on the form, the cart has a column for it and the bill
    // a Discount column, and nothing reads any of it. See the file header.
    test.fail();
    expect(line.serviceChange, 'the discount never reached the cart line').toBe(data.discount);
    expect(line.amount, 'the discount was not taken off the amount').toBe(
      option.rate - data.discount
    );
  });

  test('CS-17 the blank row in the Doctor Name lookup cannot stand in for a doctor', async ({
    consultancyServicePage,
  }) => {
    test.setTimeout(180_000);
    const data = consultancyService();

    await consultancyServicePage.openConsultancy();
    const ward = await consultancyServicePage.wardPatient(data.wardIndex);
    await consultancyServicePage.selectPatient(ward.admissionNo);

    // The first row of the unsearched doctor list carries no code and no name.
    const panel = await consultancyServicePage.openLookup('Doctor Name');
    const first = (await consultancyServicePage.lookupRows(panel).first().allInnerTexts())
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    test.skip(first !== '', 'the doctor list no longer opens on a blank row');

    await consultancyServicePage.pickService(data.serviceSearch);
    const doctor = await consultancyServicePage.pickRow('Doctor Name', 0);
    expect(doctor, 'the blank row put a name on the form after all').toBe('');

    // CS-06 has the same commit, without touching the lookup at all, refused with
    // "Please select fields." This one differs only in having opened the lookup and
    // clicked its blank row — and that is enough to satisfy the guard.
    const attempt = await consultancyServicePage.tryAddLine({ schedule: 'On Time', qty: 1 });

    test.info().annotations.push({
      type: 'what the blank doctor row got past the guard',
      description:
        `line committed: ${attempt.added}` +
        `${attempt.said ? `, the tab said "${attempt.said}"` : ', in silence'}`,
    });

    // Expected-to-fail: Doctor Name is required, and a blank record in the lookup is not a
    // doctor. The same line saves, so the blank reaches the bill - the annotation on CS-11
    // lists the ones already on it. See the file header.
    test.fail();
    expect(attempt.added, 'a line with a blank doctor was committed to the cart').toBe(false);
    expect(attempt.said, 'nothing was said about the blank doctor').toContain(
      MESSAGES.missingFields
    );
  });

  test('CS-18 a lookup search that matches nothing says so', async ({
    consultancyServicePage,
  }) => {
    const data = consultancyService();

    await consultancyServicePage.openConsultancy();
    const ward = await consultancyServicePage.wardPatient(data.wardIndex);
    await consultancyServicePage.selectPatient(ward.admissionNo);

    const panel = await consultancyServicePage.searchLookup('Service', data.noSuchTerm);

    // Nothing selectable comes back, which is right.
    await expect(
      consultancyServicePage.lookupRows(panel),
      'a term no service matches still offered services'
    ).toHaveCount(0);
    expect(
      await consultancyServicePage.lookupIsEmpty(panel),
      'the lookup came back with neither results nor an empty state'
    ).toBe(true);

    // Expected-to-fail: what the nurse is shown is an empty bordered row with no text in
    // it — the same picture as a lookup that has not finished loading. See the header.
    test.fail();
    const emptyState = panel.locator('tr.rz-datatable-emptymessage-row');
    await expect(
      emptyState,
      'the empty lookup shows a blank row rather than saying there is no such service'
    ).not.toHaveText(/^\s*$/);
  });

  test('CS-23 the bill lists every service charged, however many there are', async ({
    consultancyServicePage,
  }) => {
    test.setTimeout(180_000);

    await consultancyServicePage.openConsultancy();

    // A patient the grid has stopped listing. Six of the first eighteen beds sit on exactly
    // fifteen rows, so one is normally a few clicks away — but a ward whose longest stay is
    // shorter than that genuinely has nothing to report here.
    const capped: string[] = [];
    for (let index = 0; index < 18 && capped.length === 0; index++) {
      const ward = await consultancyServicePage.wardPatient(index);
      await consultancyServicePage.selectPatient(ward.admissionNo);
      if ((await consultancyServicePage.billRows.count()) >= BILL_ROW_CAP) {
        capped.push(`${ward.bed} (${ward.admissionNo})`);
      }
    }
    test.skip(
      capped.length === 0,
      'no patient in the first eighteen beds has been charged fifteen services'
    );

    // Nothing offers the rest: no pager, no page-size box, no total, no "show more".
    await expect(
      consultancyServicePage.page.locator(
        '.mud-table-pagination:visible, .rz-paginator:visible, .pagination:visible'
      ),
      'the bill grid has a pager after all — this case needs rewriting around it'
    ).toHaveCount(0);

    test.info().annotations.push({
      type: 'patients whose bill stops at the cap',
      description: `${capped.join(', ')} — ${BILL_ROW_CAP} rows listed, no pager, no total`,
    });

    // Expected-to-fail: the list stops at fifteen and says nothing about it. A sixteenth
    // consultancy is charged and then cannot be seen on this tab — which also means it
    // cannot be cancelled from here, the bin being on the row. See the file header.
    test.fail();
    expect(
      await consultancyServicePage.billRows.count(),
      'the bill stops at fifteen rows, with nothing on the tab saying there are more'
    ).toBeLessThan(BILL_ROW_CAP);
  });
});

/**
 * The cases that save. Each charges a live admission and takes its own charges back off
 * again through the tab's cancel dialog, in a finally, so a failure mid-case still cleans
 * up. See the file header for why they are separated.
 *
 * Two rules every case here keeps, and the reasons are not interchangeable.
 *
 * The patient is chosen through patientBelowBillCap, never by bed number alone: a service
 * saved against a patient already on fifteen rows is invisible on this tab afterwards
 * (CS-23), so a case that wrote to one could neither check its own work nor take it back
 * off again.
 *
 * And the cleanup is cancelSince, never "cancel everything on the bill": on a long-stay
 * patient the bill is fifteen real consultancies, and a cleanup that walked it would unpick
 * a month of somebody's treatment the first time an assertion failed early. cancelSince
 * takes off only what the baseline cannot account for.
 */
test.describe('Consultancy Service - saving @regression', () => {
  test('CS-19 Save puts the cart on the bill and clears it', async ({
    consultancyServicePage,
  }) => {
    test.setTimeout(240_000);
    const data = consultancyService();

    await consultancyServicePage.openConsultancy();
    const found = await consultancyServicePage.patientBelowBillCap(data.wardIndex, 1);
    test.skip(found === undefined, 'every patient in reach is already at the bill-grid cap');
    const ward = found as ConsultancyWardPatient;

    const matches = await consultancyServicePage.serviceOptions(data.serviceSearch);
    const index = freeService(matches);
    test.skip(index === -1, `nothing matching "${data.serviceSearch}" is free of charge today`);
    await consultancyServicePage.pickRow('Service', index);

    const billed = await consultancyServicePage.bill();
    const line = await consultancyServicePage.addLine({
      doctor: data.doctorSearch,
      schedule: 'On Time',
      qty: 1,
    });

    try {
      expect(await consultancyServicePage.saveBill(), 'the save was not acknowledged').toContain(
        MESSAGES.saved
      );

      // The cart is emptied by the save — this is the one place the tab does clear it.
      await expect(
        consultancyServicePage.cartRows,
        'the cart still holds the lines that were just billed'
      ).toHaveCount(0, { timeout: 30_000 });

      // And the bill has grown by exactly the line that was saved.
      await expect(consultancyServicePage.billRows).toHaveCount(billed.length + 1, {
        timeout: 60_000,
      });
      // Saved services are appended, so the new one is the last row — and the count above
      // has already established that it is the only one the save added.
      const bill = await consultancyServicePage.bill();
      const saved = bill[bill.length - 1];

      expect(saved.service, 'the bill names a different service').toBe(line.service);
      expect(saved.qty, 'the bill carries a different quantity').toBe(line.qty);
      expect(saved.rate, 'the bill carries a different rate').toBe(line.rate);
      expect(saved.amount, 'the bill carries a different amount').toBe(line.amount);
      expect(saved.servedBy, 'the bill does not say who charged it').not.toBe('');
      // Everything that was on the bill before is still on it, unchanged.
      expect(bill.slice(0, billed.length), 'the save disturbed the rest of the bill').toEqual(
        billed
      );
    } finally {
      const removed = await consultancyServicePage.cancelSince(billed);
      test.info().annotations.push({
        type: 'cleanup',
        description: `${removed} service(s) this case added, cancelled off ${ward.admissionNo}`,
      });
    }
  });

  test('CS-20 a saved service is cancelled with a reason, and the rest of the bill is left alone', async ({
    consultancyServicePage,
  }) => {
    test.setTimeout(240_000);
    const data = consultancyService();

    await consultancyServicePage.openConsultancy();
    // Room for two: this case saves a pair so it can show that cancelling one leaves the
    // other standing.
    const found = await consultancyServicePage.patientBelowBillCap(data.wardIndex, 2);
    test.skip(found === undefined, 'no patient in reach has room on the bill for two services');
    const ward = found as ConsultancyWardPatient;

    const matches = await consultancyServicePage.serviceOptions(data.serviceSearch);
    const index = freeService(matches);
    test.skip(index === -1, `nothing matching "${data.serviceSearch}" is free of charge today`);

    const billed = await consultancyServicePage.bill();
    const before = billed.length;

    // Different quantities, so the two can be told apart afterwards: a Save stamps every
    // row it writes with the same moment, so the ServiceDate separates nothing.
    for (const quantity of [1, 2]) {
      await consultancyServicePage.serviceOptions(data.serviceSearch);
      await consultancyServicePage.pickRow('Service', index);
      await consultancyServicePage.addLine({
        doctor: data.doctorSearch,
        schedule: 'On Time',
        qty: quantity,
      });
    }

    try {
      expect(await consultancyServicePage.saveBill()).toContain(MESSAGES.saved);
      await expect(consultancyServicePage.billRows).toHaveCount(before + 2, { timeout: 60_000 });
      const saved = await consultancyServicePage.bill();
      const survivor = saved[saved.length - 1];

      // The dialog says what it is about to take off, and the chips fill the reason box.
      const dialog = await consultancyServicePage.openCancel(saved.length - 2);
      await expect(dialog, 'the dialog does not name the service it is cancelling').toContainText(
        saved[saved.length - 2].service
      );
      for (const reason of CANCEL_REASONS) {
        await expect(
          consultancyServicePage.cancelChip(reason),
          `the dialog does not offer "${reason}"`
        ).toBeVisible();
      }
      await consultancyServicePage.keepService.click();
      await expect(consultancyServicePage.billRows, 'Keep service cancelled it anyway').toHaveCount(
        before + 2
      );

      expect(
        await consultancyServicePage.cancelBillLine(saved.length - 2),
        'the cancellation was not acknowledged'
      ).toContain(MESSAGES.cancelled);

      const left = await consultancyServicePage.bill();
      expect(left, 'cancelling one service took more than one off').toHaveLength(before + 1);
      expect(left[left.length - 1].qty, 'cancelling one service took off the wrong one').toBe(
        survivor.qty
      );
      expect(left.slice(0, before), 'the cancellation disturbed the rest of the bill').toEqual(
        billed
      );
    } finally {
      const removed = await consultancyServicePage.cancelSince(billed);
      test.info().annotations.push({
        type: 'cleanup',
        description: `${removed} service(s) this case added, cancelled off ${ward.admissionNo}`,
      });
    }
  });

  test('CS-21 the cancel dialog refuses a blank reason', async ({ consultancyServicePage }) => {
    test.setTimeout(240_000);
    const data = consultancyService();

    await consultancyServicePage.openConsultancy();
    const found = await consultancyServicePage.patientBelowBillCap(data.wardIndex, 1);
    test.skip(found === undefined, 'every patient in reach is already at the bill-grid cap');
    const ward = found as ConsultancyWardPatient;

    const matches = await consultancyServicePage.serviceOptions(data.serviceSearch);
    const index = freeService(matches);
    test.skip(index === -1, `nothing matching "${data.serviceSearch}" is free of charge today`);
    await consultancyServicePage.pickRow('Service', index);

    const billed = await consultancyServicePage.bill();
    const before = billed.length;
    await consultancyServicePage.addLine({
      doctor: data.doctorSearch,
      schedule: 'On Time',
      qty: 1,
    });

    try {
      expect(await consultancyServicePage.saveBill()).toContain(MESSAGES.saved);
      await expect(consultancyServicePage.billRows).toHaveCount(before + 1, { timeout: 60_000 });

      await consultancyServicePage.openCancel(before);
      await expect(consultancyServicePage.cancelReason).toHaveValue('');
      await consultancyServicePage.confirmCancel.click();

      // The refusal is an inline message under the box, not a snackbar — the dialog stays
      // open with the service still on the bill behind it.
      await expect(
        consultancyServicePage.cancelDialog,
        'a blank reason took the service off the bill'
      ).toBeVisible();
      await expect(
        consultancyServicePage.cancelDialog,
        'nothing in the dialog says the reason is required'
      ).toContainText(/reason/i);
      await expect(consultancyServicePage.billRows).toHaveCount(before + 1);

      // A reason too short to mean anything is refused the same way.
      await consultancyServicePage.cancelReason.fill('x');
      await consultancyServicePage.confirmCancel.click();
      await expect(
        consultancyServicePage.cancelDialog,
        'a one-character reason took the service off the bill'
      ).toBeVisible();
      await expect(consultancyServicePage.billRows).toHaveCount(before + 1);
    } finally {
      // The dialog is left open by the assertions above, and the cleanup's own cancel needs
      // it closed. Non-fatal, so a dialog that has already gone does not mask the failure.
      await consultancyServicePage.keepService.click().catch(() => {});
      const removed = await consultancyServicePage.cancelSince(billed);
      test.info().annotations.push({
        type: 'cleanup',
        description: `${removed} service(s) this case added, cancelled off ${ward.admissionNo}`,
      });
    }
  });

  test('CS-22 a rate typed over the catalogue rate does not reach the bill', async ({
    consultancyServicePage,
  }) => {
    test.setTimeout(240_000);
    const data = consultancyService();

    await consultancyServicePage.openConsultancy();
    const found = await consultancyServicePage.patientBelowBillCap(data.wardIndex, 1);
    test.skip(found === undefined, 'every patient in reach is already at the bill-grid cap');
    const ward = found as ConsultancyWardPatient;
    const patient = await consultancyServicePage.readPatient();

    // A priced service, because the whole of this case is about what happens to the price.
    const matches = await consultancyServicePage.serviceOptions(data.serviceSearch);
    const index = pricedService(matches);
    test.skip(index === -1, `nothing matching "${data.serviceSearch}" carries a rate today`);
    const option = matches[index];
    await consultancyServicePage.pickRow('Service', index);

    const billed = await consultancyServicePage.bill();

    // Typed down to 1, never up: this is a live bill, and the finding is the same either
    // way round. A rate typed up would be a charge the ward never meant to make.
    await consultancyServicePage.addLine({
      doctor: data.doctorSearch,
      schedule: 'On Time',
      rate: 1,
      qty: 1,
    });

    try {
      expect(await consultancyServicePage.saveBill()).toContain(MESSAGES.saved);
      await expect(consultancyServicePage.billRows).toHaveCount(billed.length + 1, {
        timeout: 60_000,
      });

      const bill = await consultancyServicePage.bill();
      const saved = bill[bill.length - 1];

      test.info().annotations.push({
        type: 'what went on the bill',
        description:
          `${patient.name} (${patient.invoiceNo}): ${saved.service} — ` +
          `catalogue ${option.rate}, billed ${saved.rate} x ${saved.qty} = ${saved.amount}`,
      });

      // Expected-to-fail: the rate a ward nurse types is the rate the patient is charged.
      // CS-14 is the same finding at the form; this is it on the bill, which is where it
      // matters. See the file header.
      test.fail();
      expect(
        saved.rate,
        'the bill took the rate that was typed at the nurse station, not the catalogue rate'
      ).toBe(option.rate);
    } finally {
      const removed = await consultancyServicePage.cancelSince(billed);
      test.info().annotations.push({
        type: 'cleanup',
        description: `${removed} service(s) this case added, cancelled off ${ward.admissionNo}`,
      });
    }
  });
});
