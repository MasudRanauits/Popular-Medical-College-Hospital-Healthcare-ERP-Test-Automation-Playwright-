import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Post-login module launcher at "/" — the MudBlazor shell listing every ERP module
 * (Registration, OPD, Pharmacy, Diagnostic, HR, Accounts, ...).
 */
export class HomePage extends BasePage {
  protected readonly path = '/';

  readonly tenantName: Locator;
  readonly userName: Locator;
  readonly userRole: Locator;
  readonly languageSelector: Locator;
  readonly notifications: Locator;

  constructor(page: Page) {
    super(page);
    this.tenantName = page.locator('.his-tenant-name');
    this.userName = page.locator('.his-user-name');
    this.userRole = page.locator('.his-user-role');
    this.languageSelector = page.getByText(/language:/i).first();
    this.notifications = page.getByRole('link', { name: /notifications/i });
  }

  /**
   * Locator for any module tile on the launcher, e.g. module('Pharmacy').
   * Matched exactly: substring matching also hits the hidden language dropdown
   * (its option list contains "HR"), and .first() would then return that hidden node.
   */
  module(name: string | RegExp): Locator {
    return this.page.getByText(name, { exact: true }).first();
  }

  /**
   * Opens the launcher tile `module` and returns the drawer link to `href`, once that
   * module's menu has loaded into the drawer.
   *
   * The click goes through clickUntilVisible because a tile click can be swallowed - see
   * there for the two ways that happens.
   */
  async openModule(module: string | RegExp, href: string): Promise<Locator> {
    const link = this.page.locator(`aside.mud-drawer a.mud-nav-link[href="${href}"]`);

    await this.clickUntilVisible(this.module(module), link, this.path);

    await expect(link).toBeVisible();
    return link;
  }
  async expectLoaded(): Promise<void> {
    await expect(this.tenantName).toBeVisible({ timeout: 30_000 });
    await expect(this.userRole).toBeVisible();
    // Landed on the app shell, not bounced back to the identity provider.
    await expect(this.page).not.toHaveURL(/\/Account\/Login/);
  }
}
