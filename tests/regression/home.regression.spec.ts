import { test, expect } from '../../fixtures';
import { reloadTolerant } from '../../utils/helpers';

/**
 * Home / module launcher @regression — TC_HOME_001 … TC_HOME_007.
 *
 * Signed-in suite: it runs on the session saved by tests/auth.setup.ts, so every
 * test starts already authenticated and only the last case clears the session.
 *
 * The launcher is a MudBlazor shell, so module tiles are plain text nodes rather
 * than links or buttons — homePage.module() matches them exactly, because a
 * substring match also hits the hidden language dropdown (its options contain "HR").
 */

/** Core modules that must always be on the launcher for an administrator. */
const CORE_MODULES = ['REGISTRATION', 'OPD', 'Pharmacy', 'Diagnostic', 'HR', 'ACCOUNT'];

test.describe('Home @regression', () => {
  test('TC_HOME_001 home page is displayed with all required elements', async ({ homePage }) => {
    await homePage.goto();
    await homePage.expectLoaded();

    await expect(homePage.tenantName).toBeVisible();
    await expect(homePage.tenantName).not.toBeEmpty();
    await expect(homePage.userName).toBeVisible();
    await expect(homePage.userRole).toBeVisible();
    await expect(homePage.languageSelector).toBeVisible();
  });

  test('TC_HOME_002 core ERP modules are listed on the launcher', async ({ homePage }) => {
    await homePage.goto();
    await homePage.expectLoaded();

    for (const name of CORE_MODULES) {
      await expect(homePage.module(name), `module "${name}" is on the launcher`).toBeVisible();
    }
  });

  test('TC_HOME_003 tenant is the hospital the session belongs to', async ({ homePage }) => {
    await homePage.goto();
    await homePage.expectLoaded();

    await expect(homePage.tenantName).toHaveText(/popular medical college and hospital/i);
  });

  test('TC_HOME_004 signed-in user context is shown', async ({ homePage }) => {
    await homePage.goto();
    await homePage.expectLoaded();

    await expect(homePage.userRole).toHaveText(/administrator/i);
    await expect(homePage.userName).not.toBeEmpty();
  });

  test('TC_HOME_005 a module tile that does not exist is not rendered', async ({ homePage }) => {
    await homePage.goto();
    await homePage.expectLoaded();

    await expect(homePage.module('NO_SUCH_MODULE_9912')).toBeHidden();
  });

  test('TC_HOME_006 reloading keeps the user on the launcher', async ({ homePage }) => {
    await homePage.goto();
    await homePage.expectLoaded();

    // Tolerant of the host throttle: a raw reload throws outright on the 429 the login
    // suite's bad-password cases leave behind, which has nothing to do with this case.
    await reloadTolerant(homePage.page);

    await homePage.expectLoaded();
    await expect(homePage.module(CORE_MODULES[0])).toBeVisible();
  });
});

test.describe('Home @regression signed out', () => {
  // Must not inherit the session saved by tests/auth.setup.ts.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('TC_HOME_007 an unauthenticated visitor is sent to the login page', async ({ homePage, loginPage }) => {
    await homePage.goto();

    await expect(homePage.page).toHaveURL(/\/Account\/Login/);
    await loginPage.expectLoaded();
    await expect(homePage.tenantName).toBeHidden();
  });
});
