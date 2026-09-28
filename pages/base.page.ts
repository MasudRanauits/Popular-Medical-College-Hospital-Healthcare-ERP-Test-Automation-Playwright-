import { Page, Locator, expect } from '@playwright/test';
import { gotoTolerant, waitForAppReady } from '../utils/helpers';

/** Shared behaviour for every page object: navigation, common chrome, readiness. */
export abstract class BasePage {
  readonly page: Page;

  /** Path relative to baseURL, e.g. '/patients'. Overridden by each page object. */
  protected abstract readonly path: string;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await gotoTolerant(this.page, this.path);
    await waitForAppReady(this.page);
  }

  get toast(): Locator {
    return this.page.locator('.toast, .alert, [role="alert"]').first();
  }

  async expectToast(message: string | RegExp): Promise<void> {
    await expect(this.toast).toContainText(message);
  }

  async expectLoaded(): Promise<void> {
    await waitForAppReady(this.page);
    await expect(this.page).toHaveURL(new RegExp(this.path));
  }
}
