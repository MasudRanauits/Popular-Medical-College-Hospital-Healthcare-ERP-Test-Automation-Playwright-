import { test, expect } from '../../fixtures';
import { RegistrationPage, CreatePatientPage } from '../../pages';

/**
 * Registration @regression — TC_REG_001 … TC_REG_009.
 *
 * Signed-in suite: it runs on the session saved by tests/auth.setup.ts.
 *
 * Follows the module end to end. First the route a user actually takes — REGISTRATION
 * tile on the launcher, which loads that module's menu into the left drawer, then
 * PATIENT REGISTRATION in the drawer — then the patient list it lands on, then the
 * create-patient wizard "Add New" opens.
 *
 * Two things shape how these cases are written:
 *  - the grid holds live hospital data, so no test hard-codes a patient; the search
 *    cases read a name out of the first row and search for that;
 *  - nothing here submits the wizard, because confirming a registration against the live
 *    database leaves a real patient record behind on every run. Registering a patient for
 *    real is part of TC_FLOW_001, in tests/regression/admission.regression.spec.ts, which
 *    goes on to admit the patient it registered.
 */
test.describe('Registration @regression', () => {
  test('TC_REG_001 REGISTRATION tile loads the module menu into the sidebar', async ({
    homePage,
    registrationPage,
  }) => {
    await homePage.goto();
    await homePage.expectLoaded();

    // The drawer carries no module menu until a tile is picked.
    await expect(registrationPage.sidebar).toBeVisible();
    await expect(registrationPage.patientRegistrationLink).toHaveCount(0);

    await registrationPage.moduleTile.click();

    await expect(registrationPage.sidebarMenu).toBeVisible();
    await expect(registrationPage.patientRegistrationLink).toBeVisible();
    await expect(registrationPage.patientRegistrationLink).toHaveAttribute(
      'href',
      '/hospital/newregistration'
    );
  });

  test('TC_REG_002 PATIENT REGISTRATION opens the patient list', async ({
    homePage,
    registrationPage,
  }) => {
    await homePage.goto();
    await homePage.expectLoaded();

    await registrationPage.openFromLauncher();

    await registrationPage.expectLoaded();
    await expect(registrationPage.page).toHaveURL(/\/hospital\/newregistration$/);
  });

  test('TC_REG_003 patient list is displayed with all required elements', async ({
    registrationPage,
  }) => {
    await registrationPage.goto();
    await registrationPage.expectLoaded();

    await expect(registrationPage.showFrom).toBeVisible();
    await expect(registrationPage.showTo).toBeVisible();
    await expect(registrationPage.showButton).toBeEnabled();
    await expect(registrationPage.addNew).toBeVisible();
    await expect(registrationPage.addNew).toHaveAttribute('href', /\/patients\/new$/);
    await expect(registrationPage.search).toBeEditable();
  });

  test('TC_REG_004 the grid lists patients under the expected columns', async ({
    registrationPage,
  }) => {
    await registrationPage.goto();
    await registrationPage.expectLoaded();

    const headers = registrationPage.table.locator('th');
    await expect(headers).toHaveCount(RegistrationPage.COLUMNS.length);
    await expect(headers).toHaveText(RegistrationPage.COLUMNS);

    // Over a year the hospital always registers somebody, so an empty grid here means the
    // fetch failed. Today alone proves nothing: the grid opens filtered to today and the
    // front desk may not have registered anyone yet - see RegistrationPage.showLastDays.
    await registrationPage.showLastDays();
  });



  test('TC_REG_008 Add New opens the create-patient form', async ({
    registrationPage,
    createPatientPage,
  }) => {
    await registrationPage.goto();
    await registrationPage.expectLoaded();

    await registrationPage.addNew.click();

    await createPatientPage.expectLoaded();
    await expect(createPatientPage.page).toHaveURL(/\/hospital\/patients\/new$/);
  });

  test('TC_REG_009 the create-patient form opens on the Patient tab', async ({
    createPatientPage,
  }) => {
    await createPatientPage.goto();
    await createPatientPage.expectLoaded();

    await expect(createPatientPage.patientTab).toHaveAttribute('aria-selected', 'true');
    await expect(createPatientPage.contactPersonTab).toHaveAttribute('aria-selected', 'false');
    await expect(createPatientPage.corporateClientTab).toHaveAttribute('aria-selected', 'false');
  });
});
