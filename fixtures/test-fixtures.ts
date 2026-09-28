import { test as base, expect } from '@playwright/test';
import { LoginPage, HomePage, RegistrationPage, CreatePatientPage } from '../pages';

/**
 * Page objects injected as fixtures, so specs read as
 *   test('...', async ({ loginPage }) => { ... })
 * instead of constructing page objects by hand.
 */
type Pages = {
  loginPage: LoginPage;
  homePage: HomePage;
  registrationPage: RegistrationPage;
  createPatientPage: CreatePatientPage;
};

export const test = base.extend<Pages>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  registrationPage: async ({ page }, use) => {
    await use(new RegistrationPage(page));
  },
  createPatientPage: async ({ page }, use) => {
    await use(new CreatePatientPage(page));
  },
});

export { expect };
