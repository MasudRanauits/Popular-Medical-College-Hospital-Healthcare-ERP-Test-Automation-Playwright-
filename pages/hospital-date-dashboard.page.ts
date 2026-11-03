import { Page, Locator, expect } from '@playwright/test';
import { HospitalScreenPage, HospitalMenuItem } from './hospital-menu.page';

/**
 * The date-range dashboards of the Hospital module - Advance Dashboard, Advance Return
 * Dashboard, IPD Due Collection Dashboard, Billing Dashboard (Counter) and (Office),
 * Investigation Indent Dashboard.
 *
 * Six screens, one shape: two date boxes over a Blazorise datagrid, and a Show button that
 * is the only thing that fills it. They open with the grid empty and both dates on today,
 * which is worth knowing before writing an assertion about an empty grid - an empty one is
 * the normal opening state here, not a failure, and the first case in the HOSP-DASH series
 * is exactly that.
 *
 * Two date controls, not one
 * --------------------------
 * Five of the six use flatpickr and hold their dates as YYYY-MM-DD. Billing Dashboard
 * (Counter) uses a MudBlazor date picker instead and holds them as M/D/YYYY. Nothing on
 * screen distinguishes them, and a locator written against either one finds nothing at all
 * on the other - which is how this page object came to be anchored on the field labels
 * rather than on the input classes. `DATE_FORMAT` below matches both, because "does it open
 * on today" is a question worth asking of both and the answer is spelled differently.
 *
 * The flatpickr boxes are not readonly, unlike the ones on Diet Dashboard: `fill()` with a
 * YYYY-MM-DD works and the box keeps what was typed. The picker pops open on focus and sits
 * over the Show button, so every fill here is followed by an Escape to put it away -
 * without it, the Show click lands on the calendar.
 *
 * Read-only: these screens report, they do not write.
 */
export class HospitalDateDashboardPage extends HospitalScreenPage {
  /**
   * What each end of the range is labelled. IPD Due Collection Dashboard says "From Date"
   * and "To Date"; the other five say "Start Date" and "End Date".
   */
  static readonly DATE_LABELS = {
    start: /^\s*(Start Date|From Date|From)\s*$/,
    end: /^\s*(End Date|To Date|To)\s*$/,
  } as const;

  /** Today, as each of the two date controls spells it. */
  static todayValues(now = new Date()): string[] {
    const pad = (part: number) => String(part).padStart(2, '0');
    const [year, month, day] = [now.getFullYear(), now.getMonth() + 1, now.getDate()];
    return [
      `${year}-${pad(month)}-${pad(day)}`, // flatpickr
      `${month}/${day}/${year}`, // MudBlazor
    ];
  }

  readonly startDate: Locator;
  readonly endDate: Locator;
  readonly show: Locator;
  readonly grid: Locator;
  readonly headers: Locator;
  readonly rows: Locator;
  readonly search: Locator;
  readonly pageSize: Locator;

  constructor(page: Page, item: HospitalMenuItem) {
    super(page, item);

    // Anchored on the field label, which is the only thing the two date controls have in
    // common - see the class note. The wrapper is a Bootstrap form-group on the flatpickr
    // screens and a MudBlazor input-control on the one Mud screen, so both are matched.
    //
    // flatpickr renders a hidden sibling holding the value the form posts, and these two
    // agree on arrival, so the visible box is both the one to type into and the one to
    // assert on.
    const field = (label: RegExp) =>
      page
        .locator('div.form-group, div.mud-input-control')
        .filter({ has: page.locator('label', { hasText: label }) })
        .locator('input:visible')
        .first();

    this.startDate = field(HospitalDateDashboardPage.DATE_LABELS.start);
    this.endDate = field(HospitalDateDashboardPage.DATE_LABELS.end);

    this.show = page.getByRole('button', { name: /^show$/i }).first();

    // Both grid components again, and on the same screen that brought the second date
    // control: Billing Dashboard (Counter) is MudBlazor top to bottom while the other five
    // are Blazorise. Header row and rows are spelled the same way in each.
    this.grid = page.locator('table.b-datagrid, table.mud-table-root').first();
    this.headers = this.grid.locator('thead th');
    this.rows = this.grid.locator('tbody tr');

    this.search = page.locator('input.form-control[placeholder="Search..."]:visible').first();
    this.pageSize = page.locator('select[name="PaginationContext.CurrentPageSize"]').first();
  }

  /** Opens the screen and waits for the date boxes, which arrive with the grid. */
  async openDashboard(): Promise<void> {
    await this.open();
    await this.expectLoaded();
    await expect(this.startDate, `${this.item.label} rendered no date range`).toBeVisible({
      timeout: 60_000,
    });
  }

  /** The column titles, as the markup spells them. */
  async columns(): Promise<string[]> {
    return (await this.headers.allInnerTexts())
      .map((text) => text.replace(/\s+/g, ' ').trim())
      .filter((text) => text !== '');
  }

  /**
   * Types a date into a flatpickr box and puts the calendar away again.
   *
   * Retried, because flatpickr initialises itself a moment after the box is on screen and
   * stamps today's date over whatever is in it when it does. A fill that lands in that gap
   * is silently undone: the box reads today, the Show that follows reports today, and the
   * case fails somewhere else entirely. Waiting for the box to be visible is not enough -
   * it is visible before flatpickr has touched it.
   */
  async setDate(box: Locator, isoDate: string, attempts = 3): Promise<void> {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      await box.fill(isoDate);
      await this.page.keyboard.press('Escape');

      const took = await expect(box)
        .toHaveValue(isoDate, { timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
      if (took) return;

      await this.page.waitForTimeout(1_000);
    }

    // Out of attempts: assert once more so the failure names the box and both values.
    await expect(box, 'the date box kept reverting to its own default').toHaveValue(isoDate);
  }

  /** Sets both ends of the range. Both take YYYY-MM-DD. */
  async setRange(from: string, to: string): Promise<void> {
    await this.setDate(this.startDate, from);
    await this.setDate(this.endDate, to);
  }

  /**
   * Clicks Show and waits for the grid to answer.
   *
   * A report over a quiet range legitimately comes back with nothing, so this cannot wait
   * for a row. It waits for the grid to stop changing instead, and the caller says what it
   * expected to find.
   */
  async show_(): Promise<void> {
    await this.show.click();
    await this.settle();
  }

  /** Waits for the grid to stop changing: two identical reads, half a second apart. */
  async settle(timeout = 30_000): Promise<void> {
    const deadline = Date.now() + timeout;
    // Not '' - an empty string is what an empty grid reads back as, so a settle starting
    // there would return on its first look and wait for nothing at all.
    let previous = '<<unread>>';
    for (;;) {
      await this.page.waitForTimeout(500);
      const current = (await this.rows.allInnerTexts().catch(() => [])).join('|');
      if (current === previous) return;
      previous = current;
      if (Date.now() >= deadline) return;
    }
  }

  /** Every row as its cell texts. */
  async read(): Promise<string[][]> {
    const rows: string[][] = [];
    for (const row of await this.rows.all()) {
      rows.push(
        (await row.locator('td').allInnerTexts()).map((text) => text.replace(/\s+/g, ' ').trim())
      );
    }
    return rows;
  }
}
