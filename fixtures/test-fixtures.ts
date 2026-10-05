import { test as base, expect } from '@playwright/test';
import {
  LoginPage,
  HomePage,
  RegistrationPage,
  CreatePatientPage,
  AdmissionPage,
  AdmissionDashboardPage,
  NurseStationPage,
  DietIndentPage,
  DietDashboardPage,
  ConsultancyServicePage,
} from '../pages';

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
  admissionPage: AdmissionPage;
  admissionDashboardPage: AdmissionDashboardPage;
  nurseStationPage: NurseStationPage;
  dietIndentPage: DietIndentPage;
  dietDashboardPage: DietDashboardPage;
  consultancyServicePage: ConsultancyServicePage;
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
  admissionPage: async ({ page }, use) => {
    await use(new AdmissionPage(page));
  },
  admissionDashboardPage: async ({ page }, use) => {
    await use(new AdmissionDashboardPage(page));
  },
  nurseStationPage: async ({ page }, use) => {
    await use(new NurseStationPage(page));
  },
  dietIndentPage: async ({ page }, use) => {
    await use(new DietIndentPage(page));
  },
  dietDashboardPage: async ({ page }, use) => {
    await use(new DietDashboardPage(page));
  },
  consultancyServicePage: async ({ page }, use) => {
    await use(new ConsultancyServicePage(page));
  },
});

export { expect };
