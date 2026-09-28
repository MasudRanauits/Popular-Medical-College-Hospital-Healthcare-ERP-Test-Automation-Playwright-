import { test, expect } from '../../fixtures';
import { primaryUser } from '../../data/users';

/**
 * Login @regression — TC_LOGIN_001 … TC_LOGIN_007.
 *
 * Signed-out suite: it must not inherit the session saved by tests/auth.setup.ts.
 *
 * The ERP login form relies on HTML5 `required` rather than a server-rendered
 * validation summary, so the empty-field cases assert constraint validity plus
 * "the form was never submitted" instead of looking for an error banner.
 */
test.describe('Login @regression', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('TC_LOGIN_001 login page is displayed with all required elements', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.expectLoaded();

    await expect(loginPage.username).toBeEditable();
    await expect(loginPage.username).toHaveAttribute('placeholder', 'Enter your username');
    await expect(loginPage.password).toBeEditable();
    await expect(loginPage.password).toHaveAttribute('type', 'password');
    await expect(loginPage.password).toHaveAttribute('placeholder', 'Enter your password');
    await expect(loginPage.submit).toBeEnabled();
    await expect(loginPage.submit).toHaveText(/log in/i);
    await expect(loginPage.rememberMe).toBeVisible();
    await expect(loginPage.forgotPassword).toBeVisible();
    await expect(loginPage.error).toBeHidden();
  });

  test('TC_LOGIN_003 invalid username with valid password is rejected', async ({ loginPage }) => {
    const { password } = primaryUser();

    await loginPage.goto();
    await loginPage.login('no_such_user_9912', password);

    await loginPage.expectInvalidLogin();
  });

  test('TC_LOGIN_004 valid username with invalid password is rejected', async ({ loginPage }) => {
    const { username } = primaryUser();

    await loginPage.goto();
    await loginPage.login(username, 'WrongPass!123');

    await loginPage.expectInvalidLogin();
  });

  test('TC_LOGIN_005 empty username is blocked by field validation', async ({ loginPage }) => {
    const { password } = primaryUser();

    await loginPage.goto();
    await loginPage.login('', password);

    await loginPage.expectRequiredFieldValidation(loginPage.username);
    await loginPage.expectNotSubmitted();
  });

  test('TC_LOGIN_006 empty password is blocked by field validation', async ({ loginPage }) => {
    const { username } = primaryUser();

    await loginPage.goto();
    await loginPage.login(username, '');

    await loginPage.expectRequiredFieldValidation(loginPage.password);
    await loginPage.expectNotSubmitted();
  });

  test('TC_LOGIN_007 both fields empty are blocked by field validation', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login('', '');

    await loginPage.expectRequiredFieldValidation(loginPage.username);
    await loginPage.expectRequiredFieldValidation(loginPage.password);
    await loginPage.expectNotSubmitted();
  });

  test('TC_LOGIN_002 valid credentials land on the home page', async ({ loginPage, homePage }) => {
    const { username, password } = primaryUser();

    await loginPage.goto();
    await loginPage.login(username, password);

    await homePage.expectLoaded();
    await expect(homePage.tenantName).toHaveText(/popular medical college and hospital/i);
    await expect(homePage.userRole).toHaveText(/administrator/i);
    await expect(loginPage.error).toBeHidden();
  });
});
