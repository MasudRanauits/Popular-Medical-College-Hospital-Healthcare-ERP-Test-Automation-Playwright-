import { Page, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

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

/**
 * Reloads the page, waiting out the host's throttle the way gotoTolerant does.
 *
 * A plain page.reload() does not return a 429 response - it throws
 * net::ERR_HTTP_RESPONSE_CODE_FAILURE - so a test that merely happens to reload during the
 * cool-off fails for a reason unrelated to what it asserts.
 */
export async function reloadTolerant(page: Page, maxWaitMs = 90_000): Promise<void> {
  const deadline = Date.now() + maxWaitMs;
  let lastProblem = 'no response';

  for (;;) {
    const response = await page.reload({ waitUntil: 'domcontentloaded' }).catch((error: Error) => {
      lastProblem = error.message.split('\n')[0];
      return null;
    });
    if (response && response.status() !== 429) return;
    if (response) lastProblem = `HTTP ${response.status()}`;

    if (Date.now() >= deadline) {
      throw new Error(
        `Reload never came back cleanly within ${Math.round(maxWaitMs / 1000)}s (${lastProblem}).`
      );
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

/** Where run counters are kept between runs. Local state, never committed. */
const COUNTER_FILE = path.resolve(__dirname, '..', 'playwright', '.run-counters.json');

/**
 * Next number in a counter that survives between runs, so a test record built from fixed
 * details can still carry a "Test-1", "Test-2", ... suffix instead of landing in the ERP
 * as yet another indistinguishable copy of the last one.
 *
 * Each call advances the counter, so call it once per run - the data factories do. The
 * sequence restarts at 1 if the file is deleted, which is the way to reset it.
 *
 * No locking: the suite runs on a single worker (see playwright.config.ts), so nothing
 * else is writing this file at the same time.
 */
export function nextRunNumber(counter: string): number {
  let counters: Record<string, number> = {};
  try {
    counters = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'));
  } catch {
    // First run, or the file was deleted or corrupted - start the sequence over.
  }

  const next = (counters[counter] ?? 0) + 1;
  counters[counter] = next;
  fs.mkdirSync(path.dirname(COUNTER_FILE), { recursive: true });
  fs.writeFileSync(COUNTER_FILE, JSON.stringify(counters, null, 2));
  return next;
}
