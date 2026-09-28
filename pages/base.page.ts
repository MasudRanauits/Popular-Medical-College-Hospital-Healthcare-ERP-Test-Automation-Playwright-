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

  /** The Blazor router's NotAuthorized page, rendered in place of the requested route. */
  get accessDenied(): Locator {
    return this.page.getByRole('heading', { name: /access denied/i });
  }

  /**
   * Waits for either `ready` — whatever marks the real page — or the router's
   * "Access Denied", and re-navigates when it is the latter.
   *
   * Opening a module route intermittently renders Access Denied even though the session
   * is an administrator's, at a rate of roughly one load in twenty. It is the ERP, not
   * the session: the same saved state loads the page fine before and after, and a
   * *fresh* attempt clears it while an immediate re-navigation does not — so the pause
   * between attempts is what does the work here, the same way gotoTolerant waits out the
   * host's 429s.
   *
   * Racing the two outcomes is what makes the check reliable at all: sampling with
   * isVisible() asks before Blazor has rendered either one and always sees neither.
   *
   * A genuine permission failure outlives every attempt, so the caller's own assertion
   * still fails — with its own message rather than this one.
   */
  protected async settleAuthorization(ready: Locator, attempts = 3): Promise<void> {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const appeared = await Promise.race([
        this.visible(ready, 'ready'),
        this.visible(this.accessDenied, 'denied'),
      ]);
      if (appeared !== 'denied') return;

      await this.page.waitForTimeout(5_000);
      await gotoTolerant(this.page, this.path);
      await waitForAppReady(this.page);
    }
  }

  /** Resolves to `tag` once `locator` is visible, or to 'timeout' if it never is. */
  private async visible<T extends string>(locator: Locator, tag: T): Promise<T | 'timeout'> {
    return locator
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 })
      .then(() => tag)
      .catch(() => 'timeout' as const);
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
