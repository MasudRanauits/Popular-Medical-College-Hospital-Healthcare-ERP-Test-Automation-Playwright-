import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Patient Registration list at /hospital/newregistration.
 *
 * Reached the way a user reaches it: click the REGISTRATION tile on the launcher, which
 * loads that module's menu into the left drawer, then click PATIENT REGISTRATION there.
 * The drawer carries only Notifications/Messages until a module tile is picked, so the
 * sidebar link genuinely does not exist before that first click.
 *
 * The page itself is a MudBlazor data grid: a "Show From"/"Show To" date filter, a
 * free-text search, an "Add New" button opening the create-patient wizard, and one row
 * per patient with an edit link in the ACTION column.
 *
 * MudBlazor regenerates input ids on every render ("mudinputsntkjoh6"), so every field
 * here is located by label, placeholder or href — never by id.
 */
export class RegistrationPage extends BasePage {
  protected readonly path = '/hospital/newregistration';

  /** Columns the grid always renders, in order. Matched case-insensitively: the markup
   *  is title case but CSS uppercases it, and innerText follows the CSS. */
  static readonly COLUMNS = [/name/i, /uhid/i, /reg date/i, /phone number/i, /dob/i, /action/i];

  /** REGISTRATION tile on the launcher — main content, not the drawer. */
  readonly moduleTile: Locator;
  readonly sidebar: Locator;
  /** REGISTRATION group header inside the drawer; a MudNavGroup toggle, so it is a
   *  <button> with no href and carries no link role. */
  readonly sidebarMenu: Locator;
  readonly patientRegistrationLink: Locator;

  readonly heading: Locator;
  readonly showFrom: Locator;
  readonly showTo: Locator;
  readonly showButton: Locator;
  readonly addNew: Locator;
  readonly search: Locator;
  readonly table: Locator;
  readonly rows: Locator;

  constructor(page: Page) {
    super(page);
    this.moduleTile = page.locator('.menu-text').filter({ hasText: /^REGISTRATION$/ });
    this.sidebar = page.locator('aside.mud-drawer');
    this.sidebarMenu = this.sidebar.locator('.mud-nav-link').filter({ hasText: /^REGISTRATION$/ });
    this.patientRegistrationLink = this.sidebar.locator(`a.mud-nav-link[href="${this.path}"]`);

    this.heading = page.locator('h4.page-title');
    this.showFrom = this.dateFilter('Show From');
    this.showTo = this.dateFilter('Show To');
    this.showButton = page.getByRole('button', { name: 'Show', exact: true });
    // Rendered as a styled anchor, not a <button>, so getByRole('button') never matches it.
    this.addNew = page.getByRole('link', { name: 'Add New' });
    this.search = page.getByPlaceholder('Search');
    this.table = page.locator('table.mud-table-root');
    this.rows = this.table.locator('tbody tr');
  }

  /** The input inside the MudBlazor field carrying `label`, e.g. dateFilter('Show From'). */
  private dateFilter(label: string): Locator {
    return this.page.locator('.mud-input-control').filter({ hasText: label }).locator('input').first();
  }

  /**
   * Opens the page the way a user does: REGISTRATION tile on the launcher, then
   * PATIENT REGISTRATION in the drawer it populates. Expects the launcher to be open.
   */
  async openFromLauncher(): Promise<void> {
    await this.moduleTile.click();
    await expect(this.patientRegistrationLink).toBeVisible();
    await this.patientRegistrationLink.click();
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(this.path));
    await expect(this.heading).toHaveText(/patient registration/i, { timeout: 30_000 });
    await expect(this.table).toBeVisible({ timeout: 30_000 });
  }

  /** Types `term` into the search box and waits for the grid to re-render. */
  async searchFor(term: string): Promise<void> {
    await this.search.fill(term);
    // The grid filters client-side on each keystroke; settle before counting rows.
    await this.page.waitForTimeout(1_500);
  }

  /** Patient name in the first column of `row`. */
  nameCell(row: Locator): Locator {
    return row.locator('td').first();
  }

  /** Edit link in the ACTION column of `row` — /hospital/patients/edit/<uhid>. */
  editLink(row: Locator): Locator {
    return row.locator('td').last().locator('a[href*="/patients/edit/"]');
  }
}
