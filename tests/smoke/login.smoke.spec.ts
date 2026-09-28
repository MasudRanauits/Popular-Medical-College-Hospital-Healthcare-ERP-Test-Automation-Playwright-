import { test, expect } from '../../fixtures';
import { primaryUser } from '../../data/users';

/**
 * Smoke: authentication against the EMSL Health ERP identity provider.
 * Runs signed-out — these specs must not inherit the saved session.
 */
test.describe('Login @smoke', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login page renders all fields', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.expectLoaded();

    await expect(loginPage.username).toHaveAttribute('placeholder', 'Enter your username');
    await expect(loginPage.password).toHaveAttribute('placeholder', 'Enter your password');
    await expect(loginPage.submit).toHaveText(/log in/i);
    await expect(loginPage.rememberMe).toBeVisible();
    await expect(loginPage.forgotPassword).toBeVisible();
  });

  test('valid credentials land on the module launcher', async ({ loginPage, homePage }) => {
    const { username, password } = primaryUser();

    await loginPage.goto();
    await loginPage.login(username, password);

    await homePage.expectLoaded();
    await expect(homePage.tenantName).toHaveText(/popular medical college and hospital/i);
    await expect(homePage.userRole).toHaveText(/administrator/i);
  });

  test('invalid password is rejected', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login('admin', 'wrong-password-on-purpose');

    await loginPage.expectInvalidLogin();
  });

  test('unknown user is rejected', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login('no-such-user-12345', 'whatever');

    await loginPage.expectInvalidLogin();
  });

  test('unauthenticated visit redirects to login', async ({ page, loginPage }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/Account\/Login/);
    await loginPage.expectLoaded();
  });
});
