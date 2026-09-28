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

  async expectLoaded(): Promise<void> {
    await expect(this.tenantName).toBeVisible({ timeout: 30_000 });
    await expect(this.userRole).toBeVisible();
    // Landed on the app shell, not bounced back to the identity provider.
    await expect(this.page).not.toHaveURL(/\/Account\/Login/);
  }
}
