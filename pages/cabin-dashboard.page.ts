import { Page, Locator, expect } from '@playwright/test';
import { HospitalScreenPage, hospitalItem } from './hospital-menu.page';

/** What a bed tile is saying: its number, its nightly rent, and where it is. */
export interface BedTile {
  cabinNo: string;
  /** As printed, e.g. "9000.00". Free beds carry "0.00". */
  rent: string;
  department: string;
  cabinType: string;
  state: BedState;
}

/** The three states a bed tile is coloured by. */
export type BedState = 'booked' | 'free' | 'housekeeping';

/**
 * Cabin dashboard at /hospital/cabin-dashboard - the bed board for the whole hospital.
 *
 * Every bed in the building on one screen: eight hundred-odd tiles grouped into cards by
 * ward, with a three-colour legend over them and a search box that filters the board live.
 * It is the screen the ward looks at to answer "is there a bed", so the cases here are the
 * two things it is used for - seeing which beds are free, and finding a particular one.
 *
 * The colours are the data, and they are Bootstrap contextual classes rather than anything
 * semantic: `btn-danger` is booked, `btn-success` is free, `btn-warning` is with house
 * keeping. There is no text on a tile saying which it is and no aria state either, so a
 * tile's class is the only thing that carries it - which is itself worth knowing, because
 * it means the board is unreadable to a screen reader and to anyone who cannot separate
 * red from green.
 *
 * The legend buttons at the top carry those same three classes, so anything counting tiles
 * by colour has to exclude them. `w-100` is what tells them apart: it is on every bed tile
 * and on none of the legend buttons.
 *
 * Read-only. Clicking a bed tile is how the ward starts an allocation, so nothing here
 * clicks one.
 */
export class CabinDashboardPage extends HospitalScreenPage {
  static readonly PATH = '/hospital/cabin-dashboard';

  /** Bootstrap's class per state, which is the only place a tile's state is recorded. */
  static readonly STATE_CLASS: Record<BedState, string> = {
    booked: 'btn-danger',
    free: 'btn-success',
    housekeeping: 'btn-warning',
  };

  /** The legend's labels, in the order the screen prints them. */
  static readonly LEGEND = ['Booked', 'Free', 'House Keeping'] as const;

  readonly search: Locator;
  /** One card per ward, each holding that ward's tiles. */
  readonly wardCards: Locator;
  /** Every bed tile on the board. `w-100` is what keeps the legend out - see the class note. */
  readonly tiles: Locator;

  constructor(page: Page) {
    super(page, hospitalItem('Cabin dashboard'));
    this.search = page.locator('input.form-control[placeholder="Search..."]:visible').first();
    this.wardCards = page.locator('.cabin-dashboard-card');
    this.tiles = page.locator('button.w-100');
  }

  /** A legend swatch, e.g. legend('Free'). */
  legend(label: string): Locator {
    return this.page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first();
  }

  /** Opens the board and waits for the tiles, which arrive well after the page title. */
  async openBoard(): Promise<void> {
    await this.open();
    await this.expectLoaded();
    await expect(this.tiles.first(), 'the bed board never rendered a tile').toBeVisible({
      timeout: 60_000,
    });
  }

  /** Every tile carrying `state`. */
  tilesIn(state: BedState): Locator {
    return this.page.locator(`button.w-100.${CabinDashboardPage.STATE_CLASS[state]}`);
  }

  /** How many beds are in each state right now. */
  async census(): Promise<Record<BedState, number>> {
    return {
      booked: await this.tilesIn('booked').count(),
      free: await this.tilesIn('free').count(),
      housekeeping: await this.tilesIn('housekeeping').count(),
    };
  }

  /**
   * One tile read back.
   *
   * Four lines separated by `<br>`: bed, rent, department, type. innerText renders those
   * as newlines, so the split is on whitespace runs that contain one.
   */
  async readTile(tile: Locator): Promise<BedTile> {
    const [lines, classes] = await Promise.all([
      tile.innerText(),
      tile.getAttribute('class').then((value) => value ?? ''),
    ]);
    const [cabinNo = '', rent = '', department = '', cabinType = ''] = lines
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');

    const state = (Object.keys(CabinDashboardPage.STATE_CLASS) as BedState[]).find((candidate) =>
      classes.includes(CabinDashboardPage.STATE_CLASS[candidate])
    );

    return { cabinNo, rent, department, cabinType, state: state ?? 'booked' };
  }

  /** Narrows the board to `term` and waits for the tiles to settle. */
  async searchFor(term: string): Promise<void> {
    await this.search.fill('');
    await this.search.fill(term);
    await this.settle();
  }

  /**
   * Waits for the board to stop changing.
   *
   * Eight hundred tiles are re-rendered over the circuit as the term is typed, with the old
   * board still on screen and no spinner over it, so a caller that read straight after the
   * fill read the unfiltered hospital.
   */
  async settle(timeout = 25_000): Promise<void> {
    const deadline = Date.now() + timeout;
    let previous = -1;
    for (;;) {
      await this.page.waitForTimeout(600);
      const current = await this.tiles.count().catch(() => -1);
      if (current === previous) return;
      previous = current;
      if (Date.now() >= deadline) return;
    }
  }
}
