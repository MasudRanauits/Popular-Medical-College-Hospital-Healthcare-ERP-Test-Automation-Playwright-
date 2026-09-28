import { Page, expect } from '@playwright/test';

/** Waits for the app to settle: no pending navigation and no visible loading spinner. */
export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  const spinner = page.locator('[data-loading], .spinner, .loading-overlay').first();
  if (await spinner.isVisible().catch(() => false)) {
    await expect(spinner).toBeHidden({ timeout: 30_000 });
  }
}

/**
 * Navigates to `path`, waiting out the host's brute-force throttle.
 *
 * After roughly seven failed logins the ERP answers *every* request from the IP with
 * 429 and `Retry-After: 60` — measured, it clears in about 10s. A login regression run
 * spends that budget quickly, so a test that merely happens to navigate during the
 * cool-off would fail for a reason unrelated to what it asserts.
 */
export async function gotoTolerant(page: Page, path: string, maxWaitMs = 90_000): Promise<void> {
  const deadline = Date.now() + maxWaitMs;
  for (;;) {
    // The app's own assets load slowly; `load` routinely outlives the test timeout.
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    if (response?.status() !== 429) return;
    if (Date.now() >= deadline) {
      throw new Error(`${path} is still rate-limited (HTTP 429) after ${Math.round(maxWaitMs / 1000)}s.`);
    }
    await page.waitForTimeout(5_000);
  }
}

/** Unique suffix for test data, so parallel runs never collide on a patient/invoice name. */
export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/** Formats a Date the way the ERP date pickers expect. Adjust if the app uses another format. */
export function formatDate(date: Date = new Date()): string {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}
