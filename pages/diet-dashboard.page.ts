import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/** One row of either Diet Dashboard grid. Both grids print the same nine columns. */
export interface DietDashboardRow {
  indentNo: string;
  admissionNo: string;
  patientName: string;
  cabinNo: string;
  dietName: string;
  /** As the grid prints it: dd/MM/yyyy. */
  indentDate: string;
  /** As the grid prints it: hh:mm AM/PM. */
  indentTime: string;
  status: string;
  remarks: string;
  /** The tenth cell - the row's action button, 'Stop' on the running grid, 'Continue' on
   *  the stopped one. Read back rather than assumed, because it is the only thing on
   *  screen that says which grid a row is in. */
  action: string;
}

/** Which of the two grids a case is talking about. See the class note. */
export type DietGrid = 'running' | 'stopped';

/** What pressing a row's Stop or Continue button did. */
export interface DietActionOutcome {
  /** The row as the grid it moved into has it. */
  row: DietDashboardRow;
  /**
   * Anything the app put on screen over the action - a dialog it asked through, or a
   * message it raised - and '' when it went through in silence. See stopIndent.
   */
  said: string;
}

/**
 * Nurse Station > Diet Dashboard, at /hospital/nurse-station - the tab where the ward
 * sees every diet indent raised in a date range and starts or stops the meal that is
 * actually running for each patient.
 *
 * Its own page object, like DietIndentPage, rather than part of either: this tab shares
 * the route and the tab strip with Medicine Indent and Diet Indent and nothing else. No
 * ward list, no form, no lookup, no snackbar - two grids and a filter bar.
 *
 * What the two grids are
 * ----------------------
 * Nothing on screen says. They carry identical headers, neither has a caption or a
 * heading, and they sit one above the other in the same card style. The only difference
 * rendered is the button in the last cell. Established by reading 166 live rows across
 * two date ranges and by driving both buttons:
 *
 *   - The upper grid is the diet each patient is *currently on* - one row per admission
 *     number, never more - and its button is Stop.
 *   - The lower grid is every other indent in the range: diets that were stopped, that a
 *     later indent superseded, or that the canteen has already dealt with. Its button is
 *     Continue.
 *
 * Status does not separate them. Both grids carry Pending, PR Submitted, Served and
 * Reviewed rows; a Pending row sits in the upper grid when it is the diet now running and
 * in the lower grid when it is not. So `running` and `stopped` here are about which grid
 * a row is in, which is the app's own distinction, not about the Status column.
 *
 * Stop writes PR Submitted and drops the row into the lower grid. Continue writes Pending
 * and lifts it back into the upper one, displacing whatever that patient was on. Both act
 * on the first click: no confirmation, no message, no snackbar - the row simply moves.
 * See the DD-16 and DD-18 notes in the spec.
 *
 * Two things about the filter bar are not guessable from looking at it. The date boxes
 * render empty while the dashboard is already filtered to today - the value lives in a
 * hidden input the flatpickr never mirrors, which is DD-02. And a date typed into a box
 * does not reach that hidden input until the box loses focus, which is why setRange
 * blurs and then waits for the value rather than trusting the fill.
 */
export class DietDashboardPage extends BasePage {
  /** Also the drawer link's href, so specs opening it through the menu share this one. */
  static readonly PATH = '/hospital/nurse-station';

  protected readonly path = DietDashboardPage.PATH;

  /** The outer tab this page object lives on. */
  static readonly TAB = 'DIET DASHBOARD';

  /**
   * Both grids' columns, in order. The tenth is unlabelled; it holds the action button.
   *
   * Spelled as the markup spells them, not as the screen shows them: the headers are
   * uppercased by CSS, so a case asserting on "INDENT NO" is asserting on the stylesheet
   * rather than on the page, and toHaveText reads the text under it.
   */
  static readonly COLUMNS = [
    'Indent No',
    'Admission No',
    'Patient Name',
    'CabinNo',
    'Diet Name',
    'Indent Date',
    'Indent Time',
    'Status',
    'Remarks',
  ] as const;

  /** Column positions, for sorting by name and for reading one cell out of a row. */
  static readonly COLUMN = {
    indentNo: 0,
    admissionNo: 1,
    patientName: 2,
    cabinNo: 3,
    dietName: 4,
    indentDate: 5,
    indentTime: 6,
    status: 7,
    remarks: 8,
    action: 9,
  } as const;

  /** The statuses seen on this dashboard, in the order an indent passes through them. */
  static readonly STATUSES = ['Pending', 'PR Submitted', 'Served', 'Reviewed'] as const;

  /** What each grid's action button says. */
  static readonly ACTIONS = { running: 'Stop', stopped: 'Continue' } as const;

  /**
   * The most rows either grid has ever been seen to hold, over any date range.
   *
   * Not a page size - there is no pager, no page-size box and no total anywhere on the
   * tab. It is where the list simply stops. DD-07 is the case about it.
   */
  static readonly ROW_CAP = 120;

  /** The filter bar: two flatpickrs, a search box and the button that re-runs the query. */
  readonly startDate: Locator;
  readonly endDate: Locator;
  readonly search: Locator;
  readonly show: Locator;

  /**
   * What the app will actually filter on, as opposed to what the boxes show.
   *
   * flatpickr renders two inputs per field: a hidden one carrying the value the form
   * posts, and the visible box the nurse types into. On this tab the two disagree on
   * load - see the class note - so both are exposed and the cases say which they mean.
   */
  readonly startDateValue: Locator;
  readonly endDateValue: Locator;

  constructor(page: Page) {
    super(page);

    // Matched on class rather than through the field group: opening either calendar makes
    // the picker's own year spinner visible inside the same div.form-group, so an
    // `input:visible` under the group stops resolving to one element.
    this.startDate = page.locator('input.input.form-control[placeholder="Start Date"]');
    this.endDate = page.locator('input.input.form-control[placeholder="End Date"]');
    this.startDateValue = page.locator('input[name="StartDate"]');
    this.endDateValue = page.locator('input[name="EndDate"]');

    this.search = this.group('Search').locator('input');
    this.show = page.getByRole('button', { name: 'Show', exact: true });
  }

  /**
   * The field group carrying `label` - a <div class="form-group"> holding a
   * <label class="form-label"> and its control, the shape every Blazor form in this ERP
   * uses. No <label for=...> is rendered, so getByLabel resolves none of it.
   */
  group(label: string): Locator {
    return this.page.locator('div.form-group:visible').filter({
      has: this.page.locator('label.form-label', { hasText: new RegExp(`^\\s*${label}\\s*$`) }),
    });
  }

  /** One of the page's tabs, e.g. tab('DIET DASHBOARD'). CSS uppercases the label. */
  tab(name: string): Locator {
    return this.page
      .locator('a.nav-link')
      .filter({ hasText: new RegExp(`^${name}$`, 'i') })
      .first();
  }

  /** Opens `name` and waits for its pane to take over. */
  async openTab(name: string): Promise<void> {
    await this.tab(name).click();
    await expect(this.tab(name)).toHaveClass(/active/);
  }

  /**
   * Either grid.
   *
   * Taken by position, which is all there is to take them by: the two tables carry the
   * same classes, the same column headers and no caption, id or label between them. Only
   * visible tables are counted, so the Medicine Indent and Diet Indent markup still in
   * the DOM behind this tab cannot be picked up by mistake.
   */
  grid(which: DietGrid): Locator {
    return this.page
      .locator('table.b-datagrid.common-tbl:visible')
      .nth(which === 'running' ? 0 : 1);
  }

  /** The rows of either grid. */
  rows(which: DietGrid): Locator {
    return this.grid(which).locator('tbody tr');
  }

  /** The upper grid - the diet each patient is on right now. */
  get runningRows(): Locator {
    return this.rows('running');
  }

  /** The lower grid - every other indent in the range. */
  get stoppedRows(): Locator {
    return this.rows('stopped');
  }

  /** Lands on Nurse Station with the tab strip up. The page opens on Medicine Indent. */
  async openNurseStation(): Promise<void> {
    await this.goto();
    await this.settleAuthorization(this.tab(DietDashboardPage.TAB));
    await expect(this.page).toHaveURL(new RegExp(this.path, 'i'));
    await expect(this.tab(DietDashboardPage.TAB)).toBeVisible({ timeout: 30_000 });
  }

  /** Switches to Diet Dashboard and waits for both grids to stop moving. */
  async openDietDashboard(): Promise<void> {
    await this.openTab(DietDashboardPage.TAB);
    await this.expectLoaded();
    await this.settle();
  }

  /** Opens the page and lands on Diet Dashboard - what every case here starts with. */
  async openDashboard(): Promise<void> {
    await this.openNurseStation();
    await this.openDietDashboard();
  }

  /**
   * Sets the date range, as YYYY-MM-DD, and waits for the app to take both values.
   *
   * A date typed into a flatpickr box reaches the hidden input the app filters on only
   * when the box loses focus, so each one is escaped - to close the calendar it opened -
   * and the pair is then blurred together before the values are waited on. Without the
   * wait the End Date of the previous range is still in place when Show is clicked, and
   * the grid comes back filtered on a range nobody asked for.
   */
  async setRange(start: string, end: string): Promise<void> {
    await this.startDate.fill(start);
    await this.page.keyboard.press('Escape');
    await this.endDate.fill(end);
    await this.page.keyboard.press('Escape');
    // Neither box is left holding focus: the blur is what commits the value.
    await this.search.click();

    await expect(this.startDateValue, 'the Start Date never reached the filter').toHaveValue(
      start,
      { timeout: 15_000 }
    );
    await expect(this.endDateValue, 'the End Date never reached the filter').toHaveValue(end, {
      timeout: 15_000,
    });
  }

  /** Clicks Show and waits for both grids to settle on the new range. */
  async applyFilter(): Promise<void> {
    await this.show.click();
    // Show disables itself for about a second while the query runs; a case that clicked
    // again straight away would be clicking a disabled button.
    await expect(this.show).toBeEnabled({ timeout: 60_000 });
    await this.settle();
  }

  /** Sets the range and runs it. */
  async filterByDates(start: string, end: string): Promise<void> {
    await this.setRange(start, end);
    await this.applyFilter();
  }

  /**
   * Types `term` into the Search box and waits for both grids to settle.
   *
   * Show is not needed: this box filters as it is typed, against both grids at once. It
   * matches on indent number, admission number, patient name, cabin and diet name, and it
   * is neither case- nor whole-word-sensitive.
   */
  async searchFor(term: string): Promise<void> {
    await this.search.fill('');
    await this.search.fill(term);
    await this.settle();
  }

  /** Either grid read back, one object per row, in the order it is displayed. */
  async read(which: DietGrid): Promise<DietDashboardRow[]> {
    const rows = await this.rows(which).all();

    return Promise.all(
      rows.map(async (row) => {
        const [
          indentNo,
          admissionNo,
          patientName,
          cabinNo,
          dietName,
          indentDate,
          indentTime,
          status,
          remarks,
          action,
        ] = (await row.locator('td').allInnerTexts()).map((cell) =>
          cell.replace(/\s+/g, ' ').trim()
        );
        return {
          indentNo,
          admissionNo,
          patientName,
          cabinNo,
          dietName,
          indentDate,
          indentTime,
          status,
          remarks,
          action,
        };
      })
    );
  }

  /** Both grids read back together, for the cases that are about how they divide up. */
  async readBoth(): Promise<{ running: DietDashboardRow[]; stopped: DietDashboardRow[] }> {
    return { running: await this.read('running'), stopped: await this.read('stopped') };
  }

  /** One column of a grid, e.g. column('running', 'indentTime'). */
  async column(
    which: DietGrid,
    name: keyof typeof DietDashboardPage.COLUMN
  ): Promise<string[]> {
    const nth = DietDashboardPage.COLUMN[name] + 1;
    return (await this.rows(which).locator(`td:nth-child(${nth})`).allInnerTexts()).map((cell) =>
      cell.replace(/\s+/g, ' ').trim()
    );
  }

  /** The row for `indentNo` in `which` grid. Indent numbers are unique across both. */
  rowFor(which: DietGrid, indentNo: string): Locator {
    return this.rows(which).filter({ hasText: indentNo }).first();
  }

  /** Which grid `indentNo` is in, or 'absent' when the range on screen does not hold it. */
  async locateIndent(indentNo: string): Promise<DietGrid | 'absent'> {
    if ((await this.rowFor('running', indentNo).count()) > 0) return 'running';
    if ((await this.rowFor('stopped', indentNo).count()) > 0) return 'stopped';
    return 'absent';
  }

  /** Whatever the app is asking through right now - a real dialog, not a parked one. */
  get dialogs(): Locator {
    // Scoped to what is on screen on purpose. The shell keeps empty MudBlazor and
    // Bootstrap dialog containers mounted at all times, so a bare [role="dialog"] count
    // is never zero and would report a confirmation on every click.
    return this.page.locator('.modal.show:visible, .mud-dialog:visible, [role="dialog"]:visible');
  }

  /**
   * Presses a row's action button, waits for the row to arrive in the other grid, and
   * reports anything the app said while it did.
   *
   * The move is normally the only acknowledgement there is - neither button raises a
   * snackbar and neither asks first - so the move is also the only thing to wait on.
   * Polled rather than awaited on a single locator because both grids re-render whole,
   * which detaches the row that was clicked.
   *
   * Two things make "the app said nothing" easy to get wrong, and both are handled here.
   * A snackbar from the screen before - the Save on the Diet Indent tab, say - is still in
   * the stack and still carries its text, so the stack is left to go quiet first and only
   * what arrives *after* the click is counted. And the dialog containers are mounted
   * empty, so only visible ones count.
   */
  private async act(from: DietGrid, indentNo: string): Promise<DietActionOutcome> {
    const to: DietGrid = from === 'running' ? 'stopped' : 'running';
    const showing = this.page.locator('div.snackbar.snackbar-show');
    const stack = this.page.locator('div.snackbar');

    // Non-fatal: if something is still on screen afterwards, the caller's assertion
    // reports whatever it saw.
    await expect(showing).toHaveCount(0, { timeout: 20_000 }).catch(() => {});
    const snackbarsBefore = await stack.count();
    const dialogsBefore = await this.dialogs.count();

    const row = this.rowFor(from, indentNo);
    await expect(row, `${indentNo} is not in the ${from} grid`).toBeVisible({ timeout: 30_000 });
    await row.locator('button').first().click();

    let said = '';
    await expect
      .poll(
        async () => {
          if (said === '') {
            // A dialog first: if the app ever starts asking, that is what a nurse sees
            // before anything moves.
            if ((await this.dialogs.count()) > dialogsBefore) {
              said = (await this.dialogs.last().innerText()).replace(/\s+/g, ' ').trim();
            } else if (
              (await showing.count()) > 0 ||
              (await stack.count()) > snackbarsBefore
            ) {
              // A snackbar fades a few seconds after it is raised, swapping snackbar-show
              // for snackbar-hide but keeping its text, so a faded one is still readable.
              const newest = ((await showing.count()) > 0 ? showing : stack).last();
              said = (await newest.innerText()).replace(/\s+/g, ' ').trim();
            }
          }
          return this.locateIndent(indentNo);
        },
        {
          timeout: 60_000,
          intervals: new Array(60).fill(1_000),
          message:
            `${indentNo} never moved from the ${from} grid to the ${to} grid` +
            ' (if the app now asks before acting, the question was never answered)',
        }
      )
      .toBe(to);

    const moved = (await this.read(to)).find((listed) => listed.indentNo === indentNo);
    return { row: moved as DietDashboardRow, said };
  }

  /** Stops the diet `indentNo` is running, and reports what the app did about it. */
  async stopIndent(indentNo: string): Promise<DietActionOutcome> {
    return this.act('running', indentNo);
  }

  /** Puts `indentNo` back as the patient's running diet, and reports the same. */
  async continueIndent(indentNo: string): Promise<DietActionOutcome> {
    return this.act('stopped', indentNo);
  }

  /** One grid's column header, e.g. header('running', 'indentDate'). */
  header(which: DietGrid, name: keyof typeof DietDashboardPage.COLUMN): Locator {
    return this.grid(which).locator('thead th').nth(DietDashboardPage.COLUMN[name]);
  }

  /**
   * Which way a column is sorted, as its header reports it.
   *
   * The grid marks the sorted column, and only that one, with a Font Awesome caret -
   * fa-sort-up or fa-sort-down - injected into the header. There is no aria-sort and no
   * class on the <th> itself, so the icon is the whole of the signal; DD-12b is the case
   * that holds the app to it.
   */
  async sortDirection(
    which: DietGrid,
    name: keyof typeof DietDashboardPage.COLUMN
  ): Promise<'ascending' | 'descending' | 'none'> {
    // Read off the header itself rather than through a locator on the icon: an unsorted
    // column has no <i> at all, and getAttribute on a locator matching nothing waits for
    // one to appear rather than reporting that there is none.
    const icon = await this.header(which, name).evaluate(
      (cell) => cell.querySelector('i')?.getAttribute('class') ?? ''
    );
    if (icon.includes('fa-sort-up')) return 'ascending';
    if (icon.includes('fa-sort-down')) return 'descending';
    return 'none';
  }

  /**
   * Clicks a grid's column header to sort by it, and waits for the new order to land.
   *
   * Each grid sorts on its own - sorting one leaves the other alone - and the header
   * toggles between ascending and descending only; there is no third click back to
   * unsorted.
   *
   * Two waits, because the caret and the rows do not arrive together: the header is
   * marked as soon as the click is handled, and the grid re-renders after that. Waiting
   * on the *order* changing would do for neither - a column already in the order asked
   * for comes back identical, and a grid holding one date re-sorted by date never moves a
   * row - so the column is read until three readings agree.
   */
  async sortBy(which: DietGrid, name: keyof typeof DietDashboardPage.COLUMN): Promise<void> {
    await this.header(which, name).click();
    await expect
      .poll(() => this.sortDirection(which, name), {
        timeout: 30_000,
        message: `the ${which} grid's ${name} header was never marked as sorted`,
      })
      .not.toBe('none');
    await this.settleColumn(which, name);
  }

  /** Waits for one column of a grid to read the same `stable` times running. */
  private async settleColumn(
    which: DietGrid,
    name: keyof typeof DietDashboardPage.COLUMN,
    stable = 3
  ): Promise<void> {
    let previous = '';
    let unchanged = -1;

    await expect
      .poll(
        async () => {
          const current = (await this.column(which, name)).join('|');
          unchanged = current === previous ? unchanged + 1 : 0;
          previous = current;
          return unchanged;
        },
        {
          timeout: 45_000,
          intervals: new Array(45).fill(1_000),
          message: `the ${which} grid never settled after sorting by ${name}`,
        }
      )
      .toBeGreaterThanOrEqual(stable);
  }

  /**
   * Waits for both grids to stop changing - `stable` readings of the same row counts, a
   * second apart.
   *
   * Settling is all there is to watch. The grids have no spinner and there is no HTTP
   * request to wait on either: their rows arrive over the Blazor circuit's socket, and
   * the previous range's rows stay on screen while the new ones are in flight. Read
   * without this, a filter case reads the list from before its own Show.
   */
  async settle(stable = 3): Promise<void> {
    let previous = '';
    let unchanged = 0;

    await expect
      .poll(
        async () => {
          const counts = `${await this.runningRows.count()}/${await this.stoppedRows.count()}`;
          unchanged = counts === previous ? unchanged + 1 : 0;
          previous = counts;
          return unchanged;
        },
        {
          timeout: 60_000,
          intervals: new Array(60).fill(1_000),
          message: 'the Diet Dashboard grids never stopped changing',
        }
      )
      .toBeGreaterThanOrEqual(stable);
  }

  /** Asserts Diet Dashboard is the pane on screen, with its filter bar and both grids. */
  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(this.path, 'i'));
    await expect(this.tab(DietDashboardPage.TAB)).toHaveClass(/active/);
    await expect(this.show).toBeVisible({ timeout: 30_000 });
    await expect(this.search).toBeVisible({ timeout: 30_000 });
    // Two grids, always: the tab renders both even when the range brings back no rows.
    await expect(
      this.page.locator('table.b-datagrid.common-tbl:visible'),
      'Diet Dashboard should render two grids'
    ).toHaveCount(2, { timeout: 30_000 });
  }
}
