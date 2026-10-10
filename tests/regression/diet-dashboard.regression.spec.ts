import { test, expect } from '../../fixtures';
import { DietDashboardPage, DietIndentPage } from '../../pages';
import type { DietDashboardRow, DietGrid } from '../../pages';
import { dietDashboard, dietIndent } from '../../data/test-data';

const { COLUMNS, ACTIONS, STATUSES, ROW_CAP } = DietDashboardPage;

/** dd/MM/yyyy, as both grids print the Indent Date, read back as a Date. */
function parseGridDate(printed: string): Date {
  const [day, month, year] = printed.split('/').map(Number);
  return new Date(year, month - 1, day);
}

/** YYYY-MM-DD, as the filter boxes take it, in the dd/MM/yyyy the grids print. */
function gridDate(iso: string): string {
  return `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** hh:mm AM/PM, as both grids print the Indent Time, read back as minutes past midnight. */
function parseGridTime(printed: string): number {
  const [, hour, minute, meridiem] = printed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i) ?? [];
  if (hour === undefined) return NaN;
  // 12 AM is midnight and 12 PM is noon, so the 12 is zeroed before the PM shift.
  const hours = (Number(hour) % 12) + (meridiem.toUpperCase() === 'PM' ? 12 : 0);
  return hours * 60 + Number(minute);
}

/** True when `values` never goes backwards - which is what "sorted one way" means here. */
function monotonic(values: number[]): boolean {
  const rising = values.every((value, index) => index === 0 || value >= values[index - 1]);
  const falling = values.every((value, index) => index === 0 || value <= values[index - 1]);
  return rising || falling;
}

/**
 * Which way `values` is in alphabetical order, or 'unsorted'.
 *
 * Used instead of comparing one sorted list against the reverse of another, because the
 * grid stops at 120 rows (DD-07) and sorts before it cuts: ascending hands back the first
 * 120 names and descending the *last* 120, so the two are not each other's reverse even
 * when both are perfectly ordered.
 */
function textOrder(values: string[]): 'ascending' | 'descending' | 'unsorted' {
  const compare = (a: string, b: string) => a.localeCompare(b);
  const ordered = (direction: number) =>
    values.every((value, index) => index === 0 || compare(values[index - 1], value) * direction <= 0);

  if (ordered(1)) return 'ascending';
  if (ordered(-1)) return 'descending';
  return 'unsorted';
}

/**
 * Diet Dashboard @regression — DD-01 … DD-17.
 *
 * Run date note: every case reads the live ward. A day the ward has not ordered on yet
 * leaves the dashboard empty, which is the right answer and not a failure, so the cases
 * that need rows skip rather than fail when there are none.
 *
 * Signed-in suite: it runs on the session saved by tests/auth.setup.ts.
 *
 * Covers /hospital/nurse-station, Diet Dashboard — the tab the ward uses to see every diet
 * indent raised in a date range and to start or stop the meal a patient is actually on.
 * The two tabs beside it have suites of their own: Medicine Indent is TC_NS_001 … TC_NS_011
 * in nurse-station.regression.spec.ts, Diet Indent is DI-01 … DI-15 in
 * diet-indent.regression.spec.ts. This one reads what those write.
 *
 * What the two grids are, since nothing on the page says
 * -----------------------------------------------------
 * They carry identical headers, no caption and no heading; only the button in the last
 * cell differs. The upper grid is the diet each patient is currently on — one row per
 * admission number, never more — and its button is Stop. The lower grid is everything
 * else in the range, and its button is Continue. Status does not separate them: Pending,
 * PR Submitted, Served and Reviewed rows turn up in both. DD-04 is the case that pins
 * this down, and DD-12 is the case about it not being written anywhere on screen.
 *
 * Seven findings about this tab are worth knowing before reading the cases. Each is a case
 * marked test.fail(), so a run reports it as expected-to-fail and reports it as
 * *unexpectedly passing* on the day the module is corrected — which is the signal to drop
 * the marker and keep the assertion. Nothing here is rewritten to match the defect, which
 * would turn it into a documented feature and leave nothing watching for the fix.
 *
 *   - DD-02 The date boxes are blank on arrival while the dashboard is already filtered to
 *     today. The value is in a hidden input the flatpickr never mirrors, so the range in
 *     force is invisible.
 *   - DD-06 A range whose End Date is before its Start Date empties both grids and says
 *     nothing. An empty dashboard is the app's answer to a filter it cannot honour.
 *   - DD-07 Neither grid shows more than 120 rows, and there is no pager, no page-size box
 *     and no total anywhere on the tab. A fortnight and the four weeks around it come back
 *     with the same 120 rows and the same oldest indent; everything before that is
 *     invisible, unannounced. Five days of this ward is already enough to fill both grids.
 *   - DD-09 A search matching nothing empties both grids with no "no records found" — the
 *     same picture as a range with no data and as the refused range in DD-06.
 *   - DD-12 Neither grid is labelled, so which list a row is in — and therefore whether a
 *     patient is on that diet now — has to be inferred from the action button.
 *   - DD-16 Stop acts on the first click. One click takes a patient off the diet they are
 *     on, with no confirmation and no acknowledgement.
 *   - DD-17 Continue on an older indent silently stops whatever that patient is on now.
 *
 * The second describe below writes, and is separated so a run that should not can leave it
 * out:
 *
 *   npx playwright test tests/regression/diet-dashboard.regression.spec.ts -g "DD-0|DD-1[0-3]"
 *
 * No case there acts on a row it did not put there. Each files its own diet indent through
 * the Diet Indent tab first and drives Stop and Continue against that one, so the suite
 * never stops a meal the ward ordered — and each leaves the ward as it found it.
 */
test.describe('Diet Dashboard @regression', () => {
  test('DD-01 Diet Dashboard opens from the Nurse Station tab strip, with both grids', async ({
    homePage,
    dietDashboardPage,
  }) => {
    await homePage.goto();
    await homePage.expectLoaded();

    const link = await homePage.openModule('Hospital', DietDashboardPage.PATH);
    await expect(link).toHaveText(/Nurse Station/i);
    await link.click();

    // The page opens on Medicine Indent — Diet Dashboard is two tabs along, not where it
    // lands, which is the step this case is here to prove.
    await dietDashboardPage.openNurseStation();
    await expect(dietDashboardPage.tab('MEDICINE INDENT')).toHaveClass(/active/);

    await dietDashboardPage.openDietDashboard();

    // The filter bar, whole.
    await expect(dietDashboardPage.startDate).toBeVisible();
    await expect(dietDashboardPage.endDate).toBeVisible();
    await expect(dietDashboardPage.search).toBeEditable();
    await expect(dietDashboardPage.show).toBeEnabled();

    // Both grids, each with the same nine named columns and a tenth for its button.
    for (const which of ['running', 'stopped'] as DietGrid[]) {
      await expect(dietDashboardPage.grid(which).locator('thead th')).toHaveText([
        ...COLUMNS,
        '',
      ]);
    }

    // And the buttons that tell the two apart. A quiet ward can leave either grid empty,
    // so each is only checked when it has rows.
    for (const which of ['running', 'stopped'] as DietGrid[]) {
      if ((await dietDashboardPage.rows(which).count()) === 0) continue;
      const actions = (await dietDashboardPage.read(which)).map((row) => row.action);
      expect(new Set(actions), `the ${which} grid should offer only ${ACTIONS[which]}`).toEqual(
        new Set([ACTIONS[which]])
      );
    }
  });

  test('DD-02 the dashboard opens filtered to today, and says so in the date boxes', async ({
    dietDashboardPage,
  }) => {
    const dates = dietDashboard();

    await dietDashboardPage.openDashboard();

    // The filter really is a single day: the hidden inputs the app posts carry the same
    // date at both ends, and every row on screen was raised on it. That much the tab gets
    // right.
    //
    // Which day is read off the app rather than off this machine's clock, and that is not
    // a weaker assertion - it is the only honest one. The ERP host's clock runs about
    // twelve hours fast (BUG-018, and DD-18 is the case that measures it), so from local
    // noon onwards the app's "today" is tomorrow by the test host's reckoning. Asserting
    // the two agree here made DD-02 fail for half of every day over a defect that has
    // nothing to do with this tab, and told the reader nothing that DD-18 does not say
    // better.
    const opened = await dietDashboardPage.startDateValue.inputValue();
    expect(opened, 'the dashboard did not open on a date at all').toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await expect(
      dietDashboardPage.endDateValue,
      'the dashboard opened on a range rather than on a single day'
    ).toHaveValue(opened);

    if (opened !== dates.today) {
      test.info().annotations.push({
        type: 'the app and this host disagree about what day it is',
        description: `the dashboard opened on ${opened}; this host says ${dates.today} — see DD-18 / BUG-018`,
      });
    }

    const { running, stopped } = await dietDashboardPage.readBoth();
    // Early in the morning the ward has ordered nothing yet, and an empty dashboard is the
    // right answer rather than a missing one - so the rows are only checked when there are
    // some. The hidden inputs above are what this case actually turns on.
    for (const row of [...running, ...stopped]) {
      expect(row.indentDate, `${row.indentNo} is not from the day the dashboard opened on`).toBe(
        gridDate(opened)
      );
    }

    // The boxes the nurse reads are empty all the same — placeholder text and nothing
    // else — so the range in force is nowhere on screen. A nurse who widens the range and
    // comes back has no way to tell what they are now looking at.
    //
    // Expected-to-fail: the assertion below is the behaviour this tab is supposed to have.
    // See the file header.
    test.fail();
    await expect(
      dietDashboardPage.startDate,
      'the Start Date box should show the date the dashboard is filtering from'
    ).not.toHaveValue('');
    await expect(
      dietDashboardPage.endDate,
      'the End Date box should show the date the dashboard is filtering to'
    ).not.toHaveValue('');
  });

  test('DD-03 every row carries a complete diet indent record', async ({
    dietDashboardPage,
  }) => {
    await dietDashboardPage.openDashboard();

    const { running, stopped } = await dietDashboardPage.readBoth();
    const rows = [...running, ...stopped];
    test.skip(rows.length === 0, 'the ward has not ordered a meal yet today');

    for (const row of rows) {
      expect(row.indentNo, 'an indent was listed without a number').toMatch(/^\d{10,}$/);
      expect(row.admissionNo, `${row.indentNo} is against no admission`).toMatch(/^\d{8,}$/);
      expect(row.patientName, `${row.indentNo} is against no patient`).not.toBe('');
      expect(row.cabinNo, `${row.indentNo} names no bed`).not.toBe('');
      expect(row.dietName, `${row.indentNo} names no diet`).not.toBe('');
      expect(row.indentDate, `${row.indentNo} has a date of "${row.indentDate}"`).toMatch(
        /^\d{2}\/\d{2}\/\d{4}$/
      );
      expect(row.indentTime, `${row.indentNo} has a time of "${row.indentTime}"`).toMatch(
        /^\d{2}:\d{2} (AM|PM)$/
      );
      expect(
        STATUSES as readonly string[],
        `${row.indentNo} is in a status this suite has not seen: "${row.status}"`
      ).toContain(row.status);
    }

    // Remarks are not checked for content: they are the nurse's free text and are very
    // often left empty, which is not a defect. What matters is that the column is there,
    // and DD-01 has that.
  });

  test('DD-04 a patient is on one diet at a time, and no indent is in both grids', async ({
    dietDashboardPage,
  }) => {
    await dietDashboardPage.openDashboard();

    const { running, stopped } = await dietDashboardPage.readBoth();
    test.skip(running.length === 0, 'no patient on the ward is on a diet today');

    // One running diet per patient. This is the contract the upper grid actually keeps,
    // and the reason the tab can offer a single Stop per patient: a second row for the
    // same admission number would mean the ward was told to serve two meals at once.
    const admissions = running.map((row) => row.admissionNo);
    const onTwice = admissions.filter((no, index) => admissions.indexOf(no) !== index);
    expect(
      [...new Set(onTwice)],
      'these patients are shown as running two diets at the same time'
    ).toEqual([]);

    // And nothing is in both lists. An indent that was both running and stopped would
    // leave the nurse two contradictory buttons for one order.
    const runningNos = new Set(running.map((row) => row.indentNo));
    const inBoth = stopped.filter((row) => runningNos.has(row.indentNo)).map((row) => row.indentNo);
    expect(inBoth, 'these indents are listed in both grids at once').toEqual([]);

    // Status is deliberately not asserted to split the two grids, because it does not:
    // the same status appears on both sides. Recorded so the report carries the evidence.
    test.info().annotations.push({
      type: 'what each grid holds',
      description:
        `running: ${running.length} row(s), statuses ` +
        `${[...new Set(running.map((r) => r.status))].join(', ') || 'none'} — ` +
        `stopped: ${stopped.length} row(s), statuses ` +
        `${[...new Set(stopped.map((r) => r.status))].join(', ') || 'none'}`,
    });
  });

  test('DD-05 the date range filters both grids', async ({ dietDashboardPage }) => {
    test.setTimeout(180_000);
    const dates = dietDashboard();

    await dietDashboardPage.openDashboard();

    // A week back. Every row that comes back has to fall inside it, in both grids.
    await dietDashboardPage.filterByDates(dates.window.start, dates.window.end);
    const { running, stopped } = await dietDashboardPage.readBoth();
    const from = parseGridDate(gridDate(dates.window.start)).getTime();
    const to = parseGridDate(gridDate(dates.window.end)).getTime();

    expect(
      running.length + stopped.length,
      'a week of a live ward brought back no indents at all'
    ).toBeGreaterThan(0);

    for (const row of [...running, ...stopped]) {
      const raised = parseGridDate(row.indentDate).getTime();
      expect(
        raised >= from && raised <= to,
        `${row.indentNo} is dated ${row.indentDate}, outside ${dates.window.start}..${dates.window.end}`
      ).toBe(true);
    }

    // A window no indent can fall in empties both grids rather than falling back to today.
    await dietDashboardPage.filterByDates(dates.future.start, dates.future.end);
    await expect(dietDashboardPage.runningRows, 'a future range listed running diets').toHaveCount(
      0
    );
    await expect(dietDashboardPage.stoppedRows, 'a future range listed stopped diets').toHaveCount(
      0
    );
  });

  test('DD-06 a date range that runs backwards is refused, not silently emptied', async ({
    dietDashboardPage,
  }) => {
    test.setTimeout(180_000);
    const dates = dietDashboard();

    await dietDashboardPage.openDashboard();

    // The same week as DD-05, with its ends swapped — the range a nurse produces by
    // setting the End Date first and then the Start Date.
    await dietDashboardPage.filterByDates(dates.reversed.start, dates.reversed.end);

    // Both grids come back empty, which is also what an empty week looks like, and what a
    // search with no matches looks like (DD-09). Nothing on the tab distinguishes them.
    const emptied =
      (await dietDashboardPage.runningRows.count()) === 0 &&
      (await dietDashboardPage.stoppedRows.count()) === 0;
    expect(emptied, 'the reversed range brought back rows, so there is nothing to refuse').toBe(
      true
    );

    // Expected-to-fail: a range the app cannot honour should be said so, in the field or
    // on screen, rather than answered with an empty ward. See the file header.
    test.fail();
    const complaint = dietDashboardPage.page.locator(
      '.invalid-feedback, .validation-message, div.snackbar, .toast, [role="alert"]'
    );
    await expect(
      complaint.first(),
      'nothing on the page says the End Date is before the Start Date'
    ).toBeVisible({ timeout: 15_000 });
  });

  test('DD-07 a wide date range is not silently cut off at 120 rows', async ({
    dietDashboardPage,
  }) => {
    test.setTimeout(300_000);
    const dates = dietDashboard();

    await dietDashboardPage.openDashboard();

    await dietDashboardPage.filterByDates(dates.wide.start, dates.wide.end);
    const narrow = await dietDashboardPage.readBoth();
    const atCap = narrow.running.length >= ROW_CAP || narrow.stopped.length >= ROW_CAP;
    test.skip(
      !atCap,
      `the ward raised fewer than ${ROW_CAP} indents since ${dates.wide.start}, so there is nothing to cut off`
    );

    // Twice the window. A ward busy enough to fill a grid over a fortnight was busy over
    // the fortnight before that too, so the older end of the list has to move.
    await dietDashboardPage.filterByDates(dates.wider.start, dates.wider.end);
    const wide = await dietDashboardPage.readBoth();

    const oldest = (rows: DietDashboardRow[]) =>
      rows.map((row) => row.indentNo).sort()[0] ?? 'none';

    test.info().annotations.push({
      type: 'rows returned',
      description:
        `${dates.wide.start}..${dates.wide.end}: ${narrow.running.length}/${narrow.stopped.length} — ` +
        `${dates.wider.start}..${dates.wider.end}: ${wide.running.length}/${wide.stopped.length}`,
    });

    // Expected-to-fail. Both windows come back with exactly 120 rows a grid and the same
    // oldest indent in each: the list is cut at 120 and the rest is simply not there. The
    // tab has no pager, no page-size box and no total, so nothing on screen says so.
    // See the file header.
    test.fail();
    expect(
      oldest(wide.running),
      'doubling the window brought back nothing older in the running grid'
    ).not.toBe(oldest(narrow.running));
    expect(
      oldest(wide.stopped),
      'doubling the window brought back nothing older in the stopped grid'
    ).not.toBe(oldest(narrow.stopped));
  });

  test('DD-08 Search filters both grids, on any column and in any case', async ({
    dietDashboardPage,
  }) => {
    test.setTimeout(180_000);

    await dietDashboardPage.openDashboard();
    const before = await dietDashboardPage.readBoth();
    const all = [...before.running, ...before.stopped];
    test.skip(all.length === 0, 'no diet indent was raised today to search for');

    // Whoever the ward offers, rather than a name this suite picked: which beds are
    // occupied changes by the hour.
    const seed = before.running[0] ?? before.stopped[0];

    // An indent number is unique across both grids, so it narrows the whole dashboard to
    // one row — which is the sharpest evidence that the box filters both grids at once.
    await dietDashboardPage.searchFor(seed.indentNo);
    const byNumber = await dietDashboardPage.readBoth();
    expect(
      [...byNumber.running, ...byNumber.stopped].map((row) => row.indentNo),
      `searching ${seed.indentNo} should leave that indent and nothing else`
    ).toEqual([seed.indentNo]);

    // A patient name, upper and lower case, brings back the same rows: the box ignores
    // case. Every row it brings back is that patient's.
    for (const term of [seed.patientName, seed.patientName.toUpperCase()]) {
      await dietDashboardPage.searchFor(term);
      const matched = await dietDashboardPage.readBoth();
      const rows = [...matched.running, ...matched.stopped];
      expect(rows.length, `"${term}" matched nothing`).toBeGreaterThan(0);
      for (const row of rows) {
        expect(
          row.patientName.toLowerCase(),
          `"${term}" brought back ${row.indentNo}, which is ${row.patientName}`
        ).toContain(seed.patientName.toLowerCase().slice(0, 4));
      }
    }

    // A bed, which is a different column again.
    await dietDashboardPage.searchFor(seed.cabinNo);
    const byBed = await dietDashboardPage.readBoth();
    for (const row of [...byBed.running, ...byBed.stopped]) {
      expect(row.cabinNo, `searching "${seed.cabinNo}" brought back ${row.cabinNo}`).toContain(
        seed.cabinNo
      );
    }

    // And clearing it puts the dashboard back the way it was.
    await dietDashboardPage.searchFor('');
    const after = await dietDashboardPage.readBoth();
    expect(after.running.length + after.stopped.length).toBe(all.length);
  });

  test('DD-09 a search that matches nothing says so', async ({ dietDashboardPage }) => {
    await dietDashboardPage.openDashboard();

    await dietDashboardPage.searchFor('ZZ-NO-SUCH-PATIENT-ZZ');
    await expect(dietDashboardPage.runningRows).toHaveCount(0);
    await expect(dietDashboardPage.stoppedRows).toHaveCount(0);

    // Expected-to-fail: both grids are emptied to bare headers with nothing said. That is
    // the same picture the tab shows for a quiet day and for the refused range in DD-06,
    // so a nurse cannot tell a filter that matched nothing from one the app would not run.
    // See the file header.
    test.fail();
    await expect(
      dietDashboardPage.page.getByText(/no record|no data|not found|nothing to show/i).first(),
      'an empty result should say it is empty'
    ).toBeVisible({ timeout: 15_000 });
  });

  test('DD-10 each grid sorts on its own, without disturbing the other', async ({
    dietDashboardPage,
  }) => {
    test.setTimeout(180_000);
    const dates = dietDashboard();

    await dietDashboardPage.openDashboard();
    // A week, so both grids have enough rows to have an order worth changing.
    await dietDashboardPage.filterByDates(dates.window.start, dates.window.end);

    const before = await dietDashboardPage.readBoth();
    test.skip(
      before.running.length < 2 || before.stopped.length < 2,
      'the week on screen is too quiet for either grid to be re-ordered'
    );

    const stoppedBefore = before.stopped.map((row) => row.indentNo);

    // Sorting the running grid by patient name puts that grid in name order.
    await dietDashboardPage.sortBy('running', 'patientName');
    const first = await dietDashboardPage.column('running', 'patientName');
    const firstOrder = textOrder(first);
    expect(
      firstOrder,
      `the running grid is not in name order: ${first.slice(0, 5).join(', ')}...`
    ).not.toBe('unsorted');

    // And leaves the one below it exactly as it was. Each grid carries its own sort.
    expect(
      await dietDashboardPage.column('stopped', 'indentNo'),
      'sorting the running grid re-ordered the stopped grid too'
    ).toEqual(stoppedBefore);

    // The header toggles: a second click turns the same column round. Asserted as a
    // direction rather than as the reverse of the first list - see textOrder.
    await dietDashboardPage.sortBy('running', 'patientName');
    const second = await dietDashboardPage.column('running', 'patientName');
    expect(
      textOrder(second),
      `clicking the header twice left the grid ${firstOrder}`
    ).toBe(firstOrder === 'ascending' ? 'descending' : 'ascending');
  });

  test('DD-12b the header says which column the grid is sorted by, and which way', async ({
    dietDashboardPage,
  }) => {
    test.setTimeout(180_000);
    const dates = dietDashboard();

    await dietDashboardPage.openDashboard();
    await dietDashboardPage.filterByDates(dates.window.start, dates.window.end);
    test.skip(
      (await dietDashboardPage.runningRows.count()) < 2,
      'the week on screen is too quiet to have an order'
    );

    // Nothing is marked before a column is picked: the list arrives in the app's own
    // order, which it does not claim to be any column's.
    for (const column of ['indentNo', 'indentDate', 'patientName'] as const) {
      expect(
        await dietDashboardPage.sortDirection('running', column),
        `${column} is marked as sorted before anything was clicked`
      ).toBe('none');
    }

    await dietDashboardPage.sortBy('running', 'indentDate');
    expect(
      await dietDashboardPage.sortDirection('running', 'indentDate'),
      'the sorted column is not marked ascending'
    ).toBe('ascending');

    // The caret goes on the sorted column alone, so it says *which* column the order is
    // on and not merely that the grid is sorted at all.
    for (const column of ['indentNo', 'patientName', 'status'] as const) {
      expect(
        await dietDashboardPage.sortDirection('running', column),
        `${column} is marked as sorted as well as Indent Date`
      ).toBe('none');
    }

    // And it turns over with the order.
    await dietDashboardPage.sortBy('running', 'indentDate');
    expect(
      await dietDashboardPage.sortDirection('running', 'indentDate'),
      'the header still reads ascending after the order was reversed'
    ).toBe('descending');

    // The mark agrees with the rows under it, which is the point of it.
    const dates0 = (await dietDashboardPage.column('running', 'indentDate')).map((printed) =>
      parseGridDate(printed).getTime()
    );
    expect(
      dates0.every((value, index) => index === 0 || value <= dates0[index - 1]),
      'the header reads descending but the dates are not'
    ).toBe(true);
  });

  test('DD-11 Indent Date and Indent Time sort chronologically, not as text', async ({
    dietDashboardPage,
  }) => {
    test.setTimeout(180_000);
    const dates = dietDashboard();

    await dietDashboardPage.openDashboard();
    // A week rather than today: a single day is all one date, and a ward's quiet hours are
    // where AM and PM meet. Sorting "11:30 AM" and "05:23 PM" as text puts the afternoon
    // first, and a one-day range would never show it.
    await dietDashboardPage.filterByDates(dates.window.start, dates.window.end);

    test.skip(
      (await dietDashboardPage.runningRows.count()) < 2,
      'the week on screen is too quiet to have an order'
    );

    await dietDashboardPage.sortBy('running', 'indentDate');
    const sortedDates = (await dietDashboardPage.column('running', 'indentDate')).map((printed) =>
      parseGridDate(printed).getTime()
    );
    expect(
      monotonic(sortedDates),
      'the Indent Date column is not in date order - dd/MM/yyyy sorted as text puts the ' +
        '1st of a month before the 28th of the one before it'
    ).toBe(true);

    await dietDashboardPage.sortBy('running', 'indentTime');
    const sortedTimes = (await dietDashboardPage.column('running', 'indentTime')).map(parseGridTime);
    expect(sortedTimes.every(Number.isFinite), 'a time did not parse as hh:mm AM/PM').toBe(true);

    const meridiems = new Set(
      (await dietDashboardPage.column('running', 'indentTime')).map((time) => time.slice(-2))
    );
    test.info().annotations.push({
      type: 'times covered',
      description: `${sortedTimes.length} row(s), ${[...meridiems].join(' and ') || 'none'}`,
    });

    expect(
      monotonic(sortedTimes),
      'the Indent Time column is not in time order - sorted as text, every PM would come ' +
        'before every AM of the same hour'
    ).toBe(true);
  });

  test('DD-12 each grid is labelled, so a nurse can tell which list a row is in', async ({
    dietDashboardPage,
  }) => {
    await dietDashboardPage.openDashboard();

    // Expected-to-fail. The two grids are rendered identically - same classes, same nine
    // headers, no caption, no heading above either card, no aria-label - and sit one above
    // the other. Whether a patient is on the diet in front of you or was taken off it is
    // readable only from the button at the end of the row. See the file header.
    test.fail();

    for (const which of ['running', 'stopped'] as DietGrid[]) {
      const grid = dietDashboardPage.grid(which);
      const named =
        (await grid.locator('caption').count()) > 0 ||
        (await grid.getAttribute('aria-label')) !== null ||
        (await grid.getAttribute('aria-labelledby')) !== null;
      expect(named, `the ${which} grid is rendered with nothing naming it`).toBe(true);
    }
  });

  test('DD-13 leaving the tab and coming back puts the dashboard back on today', async ({
    dietDashboardPage,
  }) => {
    test.setTimeout(180_000);
    const dates = dietDashboard();

    await dietDashboardPage.openDashboard();
    // What the tab opened on, before anything is changed - read off the app rather than
    // off this machine's clock, for the reason DD-02 gives.
    const opened = await dietDashboardPage.startDateValue.inputValue();
    expect(opened, 'the dashboard did not open on a date at all').toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await dietDashboardPage.filterByDates(dates.window.start, dates.window.end);
    await dietDashboardPage.searchFor('a');

    // Off to the tab beside it and back - the nurse who goes to order a meal and returns.
    await dietDashboardPage.openTab(DietIndentPage.TAB);
    await expect(dietDashboardPage.tab(DietIndentPage.TAB)).toHaveClass(/active/);
    await dietDashboardPage.openDietDashboard();

    // The tab refetches from scratch: the search box is empty again and the range is back
    // to today. Worth pinning because the alternative - a stale list from the last visit -
    // is what would make a nurse act on a diet that is no longer running.
    await expect(dietDashboardPage.search, 'the search survived the tab switch').toHaveValue('');
    await expect(
      dietDashboardPage.startDateValue,
      'the range did not go back to the day the dashboard opened on'
    ).toHaveValue(opened);
    await expect(
      dietDashboardPage.endDateValue,
      'the range did not go back to the day the dashboard opened on'
    ).toHaveValue(opened);

    const { running, stopped } = await dietDashboardPage.readBoth();
    for (const row of [...running, ...stopped]) {
      expect(
        row.indentDate,
        `${row.indentNo} is from ${row.indentDate}, not from the day the dashboard went back to`
      ).toBe(gridDate(opened));
    }
  });

  test('DD-18 the ERP host and the ward keep the same clock', async ({ dietDashboardPage }) => {
    const dates = dietDashboard();

    // Not really a Diet Dashboard case: the host's clock stamps every date in the ERP. It
    // lives here because this is the tab where it shows, and because DD-02 and DD-13 used
    // to carry the assertion and failed for half of every day over it.
    //
    // Measured off the HTTP Date header rather than off anything on screen. That header is
    // the host's own clock in GMT, by definition, so it is the one reading that does not
    // depend on what the application does with a date afterwards - and, unlike the
    // dashboard's default range, it is wrong at every hour rather than only after local
    // noon. A case that compared dates instead would pass all morning and fail all
    // afternoon, which is no use to anybody.
    const response = await dietDashboardPage.page.request.head('/Account/Login');
    const stamped = response.headers()['date'];
    expect(stamped, 'the host answered without a Date header, so its clock cannot be read').toBeTruthy();

    const skewMinutes = Math.round((new Date(stamped).getTime() - Date.now()) / 60_000);
    const opened = await dietDashboardPage.openDashboard().then(async () => {
      return dietDashboardPage.startDateValue.inputValue();
    });

    test.info().annotations.push({
      type: 'what the ERP host thinks the time is',
      description:
        `host says ${stamped}; this machine says ${new Date().toUTCString()} — ` +
        `${skewMinutes >= 0 ? '+' : ''}${skewMinutes} minutes. ` +
        `The dashboard opened on ${opened}; this machine's date is ${dates.today}.`,
    });

    // Expected-to-fail: the host runs about twelve hours fast - 718 minutes on every
    // reading taken on 10 Oct - which is the signature of a UTC+6 zone configured as
    // UTC-6 rather than of a clock that has merely drifted. Everything the ERP date-stamps
    // from its own clock is affected, not just this dashboard: from local noon onwards the
    // dashboard's "today" is tomorrow, and saved rows carry the same shifted stamp. Ten
    // minutes is the tolerance - wide enough that ordinary drift and the round trip never
    // trip it, narrow enough that a twelve-hour error cannot hide. See BUG-018.
    test.fail();
    expect(
      Math.abs(skewMinutes),
      `the ERP host's clock is ${skewMinutes} minutes away from this machine's`
    ).toBeLessThan(10);
  });
});

/**
 * Diet Dashboard actions @regression — DD-14 … DD-17.
 *
 * Every case here files at least one real diet indent through the Diet Indent tab and then
 * drives Stop and Continue against that indent and no other. Acting only on its own rows is
 * what makes this safe to run against a live ward: Stop takes a patient off the meal they
 * are on, and a suite that reached for whatever row was at the top of the grid would be
 * stopping meals a nurse ordered.
 *
 * Each case puts back what it moved. The round trip is exact - Continue restores the row to
 * the running grid with the status Stop took off it - so the ward is left as it was found,
 * apart from the indent that was filed, which lands as Pending the way any indent does.
 *
 * Retries are off, for the reason diet-indent.regression.spec.ts turns them off: a retry
 * files a second indent, and these cases are counting rows.
 */
test.describe('Diet Dashboard actions @regression', () => {
  test.describe.configure({ retries: 0 });

  /**
   * Files one diet indent through the Diet Indent tab and returns it as Verify Indent
   * recorded it, so the dashboard cases have an indent number of their own to act on.
   */
  async function fileIndent(
    dietIndentPage: DietIndentPage,
    diet: ReturnType<typeof dietIndent>,
    admissionNo?: string
  ) {
    const bed =
      admissionNo ?? (await dietIndentPage.wardPatients(1, diet.wardIndex))[0].admissionNo;
    const patient = await dietIndentPage.selectPatient(bed);
    await dietIndentPage.chooseOutlet(diet.outlet);
    await dietIndentPage.choosePriority(diet.priority);
    const line = await dietIndentPage.addItem(diet.patternSearch, diet.mark, diet.quantities[0]);

    expect(await dietIndentPage.saveIndent(), 'the indent this case acts on').toBe(
      DietIndentPage.MESSAGES.saved
    );
    const raised = await dietIndentPage.waitForIndentMarked(diet.mark);

    return { admissionNo: bed, patient, line, raised };
  }

  test('DD-14 an indent saved on Diet Indent appears as that patient’s running diet', async ({
    dietIndentPage,
    dietDashboardPage,
  }) => {
    test.setTimeout(360_000);
    const diet = dietIndent();

    await dietIndentPage.openAddIndent();
    const { patient, line, raised } = await fileIndent(dietIndentPage, diet);

    // Straight across to the dashboard, which is where the ward reads what was ordered.
    await dietDashboardPage.openDietDashboard();
    await dietDashboardPage.searchFor(raised.indentNo);

    const listed = (await dietDashboardPage.read('running')).find(
      (row) => row.indentNo === raised.indentNo
    );
    expect(
      listed,
      `${raised.indentNo} was saved but is not the diet ${patient.name} is on`
    ).toBeDefined();

    const row = listed as DietDashboardRow;
    expect(row.patientName, 'the dashboard has the indent against another patient').toContain(
      patient.name.replace(/^(Mr|Mrs|Ms|Miss|Md|Mst|Baby|Dr|Prof)\.?\s+/i, '')
    );
    // The form prints the bed as "P(Ex-HDU-08)" where the dashboard prints the bare bed.
    expect(patient.cabin, `the dashboard shows ${row.cabinNo}`).toContain(row.cabinNo);
    expect(row.dietName, 'the dashboard shows a different food pattern').toBe(line.pattern);
    expect(row.remarks, 'the remarks did not survive the journey').toBe(diet.mark);
    expect(row.status, 'a newly saved indent should be waiting for the canteen').toBe('Pending');
    expect(row.action, 'a running diet should offer Stop').toBe(ACTIONS.running);

    // And it is in one list, not both.
    expect(await dietDashboardPage.rows('stopped').count()).toBe(0);
  });

  test('DD-15 Stop takes the patient off the diet, and Continue puts them back', async ({
    dietIndentPage,
    dietDashboardPage,
  }) => {
    test.setTimeout(420_000);
    const diet = dietIndent();

    await dietIndentPage.openAddIndent();
    const { raised } = await fileIndent(dietIndentPage, diet);

    await dietDashboardPage.openDietDashboard();
    await dietDashboardPage.searchFor(raised.indentNo);
    await expect(dietDashboardPage.runningRows).toHaveCount(1);

    // Stop. The row leaves the running grid for the stopped one and the status is rewritten
    // - which is the whole of what this button does, and the only sign on screen that it
    // did anything.
    const stopped = await dietDashboardPage.stopIndent(raised.indentNo);
    expect(stopped.row.status, 'Stop should take the indent out of Pending').toBe('PR Submitted');
    expect(stopped.row.action, 'a stopped diet should offer Continue').toBe(ACTIONS.stopped);
    expect(stopped.row.dietName, 'Stop changed the diet as well as its state').toBe(
      raised.groupName
    );
    await expect(
      dietDashboardPage.runningRows,
      'the indent is still shown as the diet the patient is on'
    ).toHaveCount(0);

    // Continue, and the round trip closes exactly: same indent, same diet, back in Pending
    // and back in the running grid. This is also what puts the ward back as it was found.
    const resumed = await dietDashboardPage.continueIndent(raised.indentNo);
    expect(resumed.row.status, 'Continue should put the indent back into Pending').toBe('Pending');
    expect(resumed.row.action).toBe(ACTIONS.running);
    expect(resumed.row.dietName).toBe(raised.groupName);
    expect(resumed.row.remarks).toBe(diet.mark);
    await expect(dietDashboardPage.stoppedRows).toHaveCount(0);

    // Not asserted: that either button said anything. Neither raises a snackbar, a toast or
    // a confirmation - the row moving between two unlabelled grids is the entire feedback.
    // DD-16 is the case about that; recorded here so the report carries the evidence.
    test.info().annotations.push({
      type: 'what the buttons said',
      description:
        `Stop: ${stopped.said || 'nothing'} — Continue: ${resumed.said || 'nothing'}. ` +
        `The only change on screen was ${raised.indentNo} moving between the two grids.`,
    });
  });

  test('DD-16 Stop asks before taking a patient off the diet they are on', async ({
    dietIndentPage,
    dietDashboardPage,
  }) => {
    test.setTimeout(420_000);
    const diet = dietIndent();

    await dietIndentPage.openAddIndent();
    const { raised } = await fileIndent(dietIndentPage, diet);

    await dietDashboardPage.openDietDashboard();
    await dietDashboardPage.searchFor(raised.indentNo);

    // One click, and the meal is off. Nothing is asked and nothing is shown: by the time
    // anything could be read, the row has already moved and the status is already written.
    // stopIndent watches for both a dialog and a message from the moment the button is
    // pressed, so this is not a matter of having looked too late.
    const stopped = await dietDashboardPage.stopIndent(raised.indentNo);

    // Put the ward back before reporting, so the finding does not cost a patient their
    // diet: the assertion below fails on purpose, and a failing test runs no further.
    await dietDashboardPage.continueIndent(raised.indentNo);
    await expect(dietDashboardPage.runningRows).toHaveCount(1);

    // Expected-to-fail. Stopping a diet is clinical and unprompted here - the ward's own
    // Diet Indent tab guards a far smaller thing, refusing a repeated food pattern outright
    // (DI-14), while this one takes a patient off their meal on a single click with no
    // confirmation, no undo and no record on screen that it happened. See the file header.
    test.fail();
    expect(
      stopped.said,
      'Stop took the patient off their diet without asking and without saying so'
    ).not.toBe('');
  });

  test('DD-17 Continue on an older indent warns that the running diet will be displaced', async ({
    dietIndentPage,
    dietDashboardPage,
  }) => {
    test.setTimeout(540_000);
    const first = dietIndent();
    const second = dietIndent();

    await dietIndentPage.openAddIndent();
    // Two indents for one patient, so the ward has an order to go back to. The second
    // supersedes the first on its own - that much the app does without being asked.
    const one = await fileIndent(dietIndentPage, first);
    await dietIndentPage.openTab('ADD INDENT');
    const two = await fileIndent(dietIndentPage, second, one.admissionNo);

    await dietDashboardPage.openDietDashboard();
    await dietDashboardPage.searchFor(one.admissionNo);

    expect(
      await dietDashboardPage.locateIndent(two.raised.indentNo),
      'the newer indent should be the diet the patient is on'
    ).toBe('running');
    expect(
      await dietDashboardPage.locateIndent(one.raised.indentNo),
      'the older indent should have been superseded by the newer one'
    ).toBe('stopped');

    // Back to the older meal. The newer one is dropped out of the running grid to make
    // room - correctly, since a patient is on one diet at a time (DD-04) - but nothing on
    // screen says a live order was just cancelled to do it.
    const resumed = await dietDashboardPage.continueIndent(one.raised.indentNo);

    expect(
      await dietDashboardPage.locateIndent(two.raised.indentNo),
      'the patient is shown as running two diets at once'
    ).toBe('stopped');

    // Ward restored: the newer indent is the one it should be left on.
    await dietDashboardPage.continueIndent(two.raised.indentNo);
    expect(await dietDashboardPage.locateIndent(two.raised.indentNo)).toBe('running');

    // Expected-to-fail. Continue is the quiet half of the same gap as DD-16: it does not
    // only start the diet it was pressed on, it stops the one the patient is on, and that
    // second effect is neither asked about nor reported. See the file header.
    test.fail();
    expect(
      resumed.said,
      `Continue on ${one.raised.indentNo} cancelled ${two.raised.indentNo} without asking or saying so`
    ).not.toBe('');
  });
});
