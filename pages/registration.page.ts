import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Patient Registration list at /hospital/newregistration — reached from the launcher by
 * expanding the REGISTRATION menu in the left drawer and clicking PATIENT REGISTRATION.
 *
 * The page is a MudBlazor data grid: a "Show From"/"Show To" date filter, a free-text
 * search, an "Add New" button that opens the create-patient wizard, and one row per
 * patient with an edit link in the ACTION column.
 *
 * MudBlazor generates input ids per render ("mudinputsntkjoh6"), so every field here is
 * located by label, placeholder or href — never by id.
 */
export class RegistrationPage extends BasePage {
  protected readonly path = '/hospital/newregistration';

  /** Columns the grid always renders, in order. Matched case-insensitively: the markup
   *  is title case but CSS uppercases it, and innerText follows the CSS. */
  static readonly COLUMNS = [/name/i, /uhid/i, /reg date/i, /phone number/i, /dob/i, /action/i];

  /** Left drawer — present on every authenticated page, not just this one. */
  readonly sidebar: Locator;
  readonly registrationMenu: Locator;
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
    this.sidebar = page.locator('aside.mud-drawer');
    // The menu is an <a> without href — a MudNavGroup toggle, so it has no link role.
    this.registrationMenu = this.sidebar.getByText('REGISTRATION', { exact: true });
    this.patientRegistrationLink = this.sidebar.locator(`a.mud-nav-link[href="${this.path}"]`);

    this.heading = page.getByText('PATIENT REGISTRATION', { exact: true }).last();
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
   * Opens the page the way a user does: expand REGISTRATION in the drawer, then click
   * PATIENT REGISTRATION. Assumes the launcher (or any authenticated page) is open.
   */
  async openFromSidebar(): Promise<void> {
    await this.registrationMenu.click();
    await expect(this.patientRegistrationLink).toBeVisible();
    await this.patientRegistrationLink.click();
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(this.path));
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
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
