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
   * Waits for `ready` - whatever marks the real page - to finish rendering.
   *
   * The app prerenders its NotAuthorized template before the Blazor circuit connects, so
   * "Access Denied" is on screen within ~50ms of every module route and is swapped for the
   * real page about a third of a second later. This used to race the two and re-navigate
   * whenever the denial won, which is always - so every page load paid a 5s wait and a
   * reload, sometimes two, for a denial that was never real.
   *
   * Now it simply waits for the real page. A re-navigation is kept as a last resort, for
   * when the page never arrives and the denial is still on screen: the one load in twenty
   * that genuinely comes back denied clears on a fresh attempt, and a real permission
   * failure outlives that too, so the caller's own assertion still reports it.
   */
  protected async settleAuthorization(ready: Locator, attempts = 2): Promise<void> {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      if ((await this.visible(ready, 'ready')) === 'ready') return;
      if (attempt === attempts) return;

      // Not denied, just missing: leave it to the caller to say what it expected and fail.
      if (!(await this.accessDenied.first().isVisible().catch(() => false))) return;

      await gotoTolerant(this.page, this.path);
      await waitForAppReady(this.page);
    }
  }

  /**
   * Clicks `trigger` until `appears` shows up, re-fetching `path` between attempts.
   *
   * Two different things go wrong with the launcher tiles and they look identical. The
   * tiles are painted before Blazor wires their handlers, so a click landing in that gap is
   * swallowed - clicking again fixes that. And when the host is answering 429, which it
   * does for about ten seconds after the login suite's bad-password cases, the circuit never
   * starts at all and no number of clicks will help: the page has to be fetched again.
   *
   * Silent on failure - the caller asserts on `appears` and reports it in its own words.
   */
  protected async clickUntilVisible(
    trigger: Locator,
    appears: Locator,
    path: string,
    attempts = 3
  ): Promise<void> {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      await trigger.click().catch(() => {});
      if (await this.visible(appears, true, 10_000)) return;
      if (attempt === attempts) return;

      await gotoTolerant(this.page, path);
      await waitForAppReady(this.page);
    }
  }

  /** Resolves to `tag` once `locator` is visible, or to the fallback if it never is. */
  private async visible<T, F>(locator: Locator, tag: T, timeout = 30_000, fallback?: F) {
    return locator
      .first()
      .waitFor({ state: 'visible', timeout })
      .then(() => tag)
      .catch(() => fallback as F);
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
