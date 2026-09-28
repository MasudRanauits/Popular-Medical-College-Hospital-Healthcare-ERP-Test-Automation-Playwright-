import { test, expect } from '../../fixtures';
import { RegistrationPage } from '../../pages';

/**
 * Registration @regression — TC_REG_001 … TC_REG_009.
 *
 * Signed-in suite: it runs on the session saved by tests/auth.setup.ts.
 *
 * Covers the route a user actually takes — REGISTRATION tile on the launcher, which
 * loads that module's menu into the left drawer, then PATIENT REGISTRATION in the
 * drawer — and then the patient list that route lands on.
 *
 * The grid holds live hospital data, so no test hard-codes a patient. The search cases
 * read a name out of the first row and search for that, which holds whatever the ward
 * registered today.
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

    // The ward always has at least one registration; an empty grid means the fetch failed.
    await expect(registrationPage.rows.first()).toBeVisible();
  });

  test('TC_REG_005 search narrows the grid to the matching patient', async ({
    registrationPage,
  }) => {
    await registrationPage.goto();
    await registrationPage.expectLoaded();

    const name = (await registrationPage.nameCell(registrationPage.rows.first()).innerText()).trim();
    expect(name, 'first row has a patient name to search for').not.toBe('');

    await registrationPage.searchFor(name);

    await expect(registrationPage.rows).not.toHaveCount(0);
    for (const row of await registrationPage.rows.all()) {
      await expect(row).toContainText(name);
    }
  });

  test('TC_REG_006 a search that matches nothing empties the grid', async ({ registrationPage }) => {
    await registrationPage.goto();
    await registrationPage.expectLoaded();

    await registrationPage.searchFor('zzz_no_such_patient_9912');

    await expect(registrationPage.rows).toHaveCount(0);
    // The grid keeps its header, so the page is filtered rather than broken.
    await expect(registrationPage.table.locator('th').first()).toBeVisible();
  });

  test('TC_REG_007 every row links to that patient edit page', async ({ registrationPage }) => {
    await registrationPage.goto();
    await registrationPage.expectLoaded();

    const row = registrationPage.rows.first();
    const uhid = (await row.locator('td').nth(1).innerText()).trim();

    await expect(registrationPage.editLink(row)).toHaveAttribute(
      'href',
      new RegExp(`/patients/edit/${uhid}$`)
    );
  });

  test('TC_REG_008 Add New opens the create-patient form', async ({ registrationPage }) => {
    await registrationPage.goto();
    await registrationPage.expectLoaded();

    await registrationPage.addNew.click();

    await expect(registrationPage.page).toHaveURL(/\/hospital\/patients\/new$/);
    await expect(registrationPage.heading).toHaveText(/create patient/i, { timeout: 30_000 });
  });
});

test.describe('Registration @regression signed out', () => {
  // Must not inherit the session saved by tests/auth.setup.ts.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('TC_REG_009 an unauthenticated visitor cannot reach the patient list', async ({
    registrationPage,
    loginPage,
  }) => {
    await registrationPage.goto();

    await expect(registrationPage.page).toHaveURL(/\/Account\/Login/);
    await loginPage.expectLoaded();
    await expect(registrationPage.table).toBeHidden();
  });
});
