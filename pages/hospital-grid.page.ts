import { Page, Locator, expect } from '@playwright/test';
import { HospitalScreenPage, HospitalMenuItem } from './hospital-menu.page';

/** A setup grid read back as its header row and the rows under it. */
export interface GridSnapshot {
  columns: string[];
  /** Each row as its cell texts, whitespace-collapsed. */
  rows: string[][];
}

/**
 * The Hospital module's setup grids - Areas, District, Cabin, Floor, Department, OT Type,
 * Service Group and the rest of the reference data behind the ward.
 *
 * Fourteen screens of the same shape - a grid of reference data under a toolbar - and that
 * is as far as the family resemblance goes. What they do *not* share, each of which cost a
 * run to find out:
 *
 *   The grid component. Thirteen render a Blazorise datagrid; Service Heads renders a
 *   MudBlazor table, sharing none of its classes.
 *
 *   The filter box. Labelled "Search...", "Search" or "Search by name" depending on the
 *   screen, and Service Group, Cabin Groups and Package Sub-Items have none at all.
 *
 *   The create button. "Add New" opens a dialog on eleven of them; on Service Packages,
 *   Package Sub-Items and Cabin Groups it is "New" and it adds a row inline.
 *
 *   The pager. Seven have the page-size box and seven do not.
 *
 * HOSP-GRID-015 pins that whole map, and `toolbar()` below is what it reads it with.
 *
 * Where the page-size box does exist it is a plain `<select>` named
 * `PaginationContext.CurrentPageSize` offering 5/10/25/50/100/250, and it is the only pager
 * these grids have - there are no page buttons, so a grid holding more rows than the size
 * selected simply stops, with nothing on screen saying so. Anything reading a row back out
 * of one of these grids has to raise the size first or search for the row by name.
 *
 * Read-only, all of it. These screens edit hospital-wide reference data that the live wards
 * are using right now; nothing here clicks a save or a delete, and the one case that opens
 * Add New closes it again without submitting.
 */
export class HospitalGridPage extends HospitalScreenPage {
  /** What the page-size box offers, in order. */
  static readonly PAGE_SIZES = ['5', '10', '25', '50', '100', '250'] as const;

  /**
   * The size the box starts on.
   *
   * Ten, not five - five is merely the first option in the list. Worth writing down because
   * the two are easy to confuse by reading the markup alone, and a case that asserted five
   * would be asserting on the option order rather than on the grid.
   */
  static readonly DEFAULT_PAGE_SIZE = '10';

  readonly grid: Locator;
  readonly headers: Locator;
  readonly rows: Locator;
  readonly search: Locator;
  readonly pageSize: Locator;
  readonly addNew: Locator;
  readonly reload: Locator;
  readonly exportButton: Locator;

  /**
   * The grids these screens are built from, as a CSS union.
   *
   * Three components, not one: Blazorise on most, MudBlazor on Service Heads and the
   * service-entry report, Radzen on IPD Bill Change History. All three spell their header
   * row `thead th` and their rows `tbody tr`, so everything in this class works on any of
   * them - only finding the right table differs.
   *
   * Radzen is deliberately *not* in the default. Radzen grids are also what the patient
   * lookups are built from, and several screens keep one in the DOM ahead of their real
   * grid - Package Sub-Items has two - so including it would silently point this page
   * object at a lookup. The one screen whose own grid is Radzen passes it explicitly.
   */
  static readonly GRID = 'table.b-datagrid, table.mud-table-root';
  static readonly RADZEN_GRID = 'table.rz-grid-table';

  /**
   * @param gridSelector overrides which table this screen's grid is, for the screens whose
   *   grid is not one of the two in `GRID`.
   */
  constructor(page: Page, item: HospitalMenuItem, gridSelector: string = HospitalGridPage.GRID) {
    super(page, item);

    this.grid = page.locator(gridSelector).first();
    this.headers = this.grid.locator('thead th');
    this.rows = this.grid.locator('tbody tr');

    // Matched on the start of the placeholder, not the whole of it. No <label for> is
    // rendered on any of these, and the fourteen screens cannot agree on the wording:
    // "Search...", "Search" and "Search by name" are all in use. Visible only - several of
    // these screens keep a second search box inside a modal that is in the DOM from the
    // start.
    this.search = page.locator('input[placeholder^="Search"]:visible').first();
    this.pageSize = page.locator('select[name="PaginationContext.CurrentPageSize"]').first();

    // "Add New" on the eleven screens that open a dialog, "New" on the three that add a row
    // inline. Same button to a user, so one locator.
    this.addNew = page.getByRole('button', { name: /^(add new|new)$/i }).first();
    this.reload = page.getByRole('button', { name: /^reload$/i }).first();
    this.exportButton = page.getByRole('button', { name: /^export$/i }).first();
  }

  /**
   * What this particular screen's toolbar actually offers.
   *
   * The fourteen screens share a component and not a toolbar: seven carry the page-size
   * box, eleven an "Add New" dialog, three an inline "New" row, and two - Cabin Groups and
   * Package Sub-Items - have no filter box at all. HOSP-GRID-015 pins the whole map, which
   * is the honest way to cover a family this uneven: one case that records what each screen
   * has, rather than fourteen cases asserting a uniformity that was never there.
   */
  async toolbar(): Promise<{
    search: boolean;
    pageSize: boolean;
    addNew: boolean;
    reload: boolean;
    export: boolean;
  }> {
    const visible = async (locator: Locator) => (await locator.count()) > 0;
    return {
      search: await visible(this.search),
      pageSize: await visible(this.pageSize),
      addNew: await visible(this.addNew),
      reload: await visible(this.reload),
      export: await visible(this.exportButton),
    };
  }

  /** Opens the screen and waits for the grid itself, not just the title, to arrive. */
  async openGrid(): Promise<void> {
    await this.open();
    await this.expectLoaded();
    await expect(this.grid, `${this.item.label} rendered no grid`).toBeVisible({
      timeout: 60_000,
    });
  }

  /**
   * Opens the screen and waits for its rows, not merely for the table around them.
   *
   * The grid element is painted before its rows are fetched, so a caller that counted rows
   * straight after `openGrid` counted zero on a screen that was about to show eight. Only
   * for screens that are supposed to hold data - a report over a quiet range is
   * legitimately empty and should use `openGrid` and say what it expected.
   */
  async openGridWithRows(timeout = 60_000): Promise<void> {
    await this.openGrid();
    await expect(this.rows.first(), `${this.item.label} listed nothing`).toBeVisible({ timeout });
  }

  /** The column titles, as the markup spells them. CSS is what uppercases them on screen. */
  async columns(): Promise<string[]> {
    return (await this.headers.allInnerTexts()).map((text) => text.replace(/\s+/g, ' ').trim());
  }

  /** The grid read back whole: its headers and every row currently rendered. */
  async snapshot(): Promise<GridSnapshot> {
    const columns = await this.columns();
    const rows: string[][] = [];
    for (const row of await this.rows.all()) {
      rows.push(
        (await row.locator('td').allInnerTexts()).map((text) => text.replace(/\s+/g, ' ').trim())
      );
    }
    return { columns, rows };
  }

  /**
   * Types `term` into the filter box and waits for the grid to answer.
   *
   * The wait is the whole method. These grids filter over the Blazor circuit with the
   * previous rows still on screen and no spinner to say otherwise, so a caller that read
   * straight after the fill read the unfiltered page - the same trap ConsultancyServicePage
   * documents on the ward list. Waiting for the row *text* to stop changing is what settles
   * it, since the row count often does not change at all.
   */
  async searchFor(term: string): Promise<void> {
    await this.search.fill('');
    await this.search.fill(term);
    await this.settle();
  }

  /** Switches the page size and waits for the re-fetch. */
  async setPageSize(size: string): Promise<void> {
    await this.pageSize.selectOption(size);
    await this.settle();
  }

  /**
   * Waits for the grid to stop changing.
   *
   * Two consecutive identical reads, half a second apart, with a ceiling. Polling the
   * rendered text rather than a count because a filter that replaces five rows with five
   * other rows leaves the count alone.
   */
  async settle(timeout = 20_000): Promise<void> {
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

  /** The cell values in `column`, by its position in the header row. */
  async columnValues(column: string): Promise<string[]> {
    const index = (await this.columns()).findIndex(
      (header) => header.toLowerCase() === column.toLowerCase()
    );
    expect(index, `${this.item.label} has no "${column}" column`).toBeGreaterThanOrEqual(0);
    return (await this.rows.locator(`td:nth-child(${index + 1})`).allInnerTexts()).map((text) =>
      text.replace(/\s+/g, ' ').trim()
    );
  }

  /**
   * The create dialog Add New opens, and its close button.
   *
   * Bootstrap modal markup, shared by every one of these screens. Deliberately no submit
   * helper: this ERP is the hospital's live one and these grids are its reference data.
   */
  get modal(): Locator {
    return this.page.locator('.modal.show, .modal[style*="display: block"]').first();
  }

  get modalTitle(): Locator {
    return this.modal.locator('.modal-title').first();
  }

  get modalClose(): Locator {
    return this.modal.locator('button.btn-close, .modal-header button').first();
  }
}
