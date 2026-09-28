import { test as setup } from '@playwright/test';
import { LoginPage, HomePage } from '../pages';
import { primaryUser } from '../data/users';
import { STORAGE_STATE } from '../utils/env';

/**
 * Runs once before the UI projects and saves the logged-in browser state to
 * playwright/.auth/user.json, so no spec has to log in again.
 */
setup('authenticate', async ({ page }) => {
  const { username, password } = primaryUser();
  const loginPage = new LoginPage(page);
  const homePage = new HomePage(page);

  await loginPage.goto();
  await loginPage.login(username, password);
  await homePage.expectLoaded();

  await page.context().storageState({ path: STORAGE_STATE });
});
