import { test, expect } from '../../fixtures';
import { primaryUser } from '../../data/users';
import { admissionData, registrationPatient } from '../../data/test-data';

/**
 * Admission @regression — TC_ADM_001 … TC_ADM_002, TC_FLOW_001.
 *
 * Signed-in suite: it runs on the session saved by tests/auth.setup.ts. The one exception
 * is TC_FLOW_001 at the bottom of the file, which runs signed out because logging in is
 * the first thing it checks.
 *
 * Covers the New Admission wizard at /hospital/patientadmission, reached through the
 * Hospital module. The wizard admits a patient who is already registered, so the UHID is
 * read out of the patient registration list rather than hard-coded — the grid holds live
 * hospital data and no patient in it is guaranteed to still be there next week.
 *
 * TC_ADM_001 and TC_ADM_002 stop short of submitting the wizard. Admitting a patient end
 * to end is TC_FLOW_001, in the second describe below, which registers the patient it
 * admits rather than picking one out of live data.
 */
test.describe('Admission @regression', () => {
  /** UHID of the most recently registered patient, taken from the registration grid. */
  async function newestUhid(registrationPage: {
    goto: () => Promise<void>;
    expectLoaded: () => Promise<void>;
    rows: import('@playwright/test').Locator;
  }): Promise<string> {
    await registrationPage.goto();
    await registrationPage.expectLoaded();
    // NAME, UHID, REG DATE, PHONE NUMBER, DOB, ACTION - UHID is the second column.
    const uhid = (await registrationPage.rows.first().locator('td').nth(1).innerText()).trim();
    expect(uhid).toMatch(/^\d{10,}$/);
    return uhid;
  }

  test('TC_ADM_001 New Admission opens from the Hospital module menu', async ({
    homePage,
    admissionPage,
  }) => {
    await homePage.goto();
    await homePage.expectLoaded();

    const link = await homePage.openModule('Hospital', '/hospital/patientadmission');
    await link.click();

    await admissionPage.expectLoaded();
    await expect(admissionPage.uhid).toBeEditable();
    await expect(admissionPage.tab('Patient')).toHaveClass(/active/);
  });

  test('TC_ADM_002 searching a UHID loads that patient into the wizard', async ({
    registrationPage,
    admissionPage,
  }) => {
    const uhid = await newestUhid(registrationPage);
    // Normalised, because the grid cell wraps the name and the dashboard row does not.
    const name = (await registrationPage.rows.first().locator('td').first().innerText())
      .replace(/\s+/g, ' ')
      .trim();

    await admissionPage.goto();
    await admissionPage.expectLoaded();
    await admissionPage.searchByUhid(uhid);

    // The wizard fills the Patient tab from the registration record, so the two must agree.
    await expect(admissionPage.fullName).toHaveValue(name);
    await expect(admissionPage.patientMobile).not.toHaveValue('');
    await expect(admissionPage.dob).not.toHaveValue('');
  });
});


/**
 * Patient journey @regression — TC_FLOW_001.
 *
 * One patient, followed the way the hospital actually takes one on: log in, register them
 * at the front desk, then admit them to a ward through the New Admission wizard.
 *
 * Why it is one test and not three. The admission wizard needs a patient who is registered
 * and not already on a ward, and the only way to be sure of that is to have just registered
 * them. Split into separate tests, the admission half would have to go hunting for a UHID
 * in live data and would re-admit the same person on a second run.
 *
 * It runs signed out, because logging in is the first thing it checks. The rest of the
 * regression suite runs on the session tests/auth.setup.ts saves.
 *
 * This test writes to the live database, twice: a patient record and an admission holding a
 * real bed and real advance payments. Neither is undone by deleting a row - cancelling an
 * admission is its own workflow under Hospital > Admission Cancel. Run it deliberately.
 */
test.describe('Patient journey @regression', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  // A retry would repeat both writes, which is never worth it: a failure after the
  // registration went through leaves a patient behind either way, and the retry would add
  // a second one rather than tell us anything new.
  test.describe.configure({ retries: 0 });

  test('TC_FLOW_001 logs in, registers a patient, then admits them', async ({
    loginPage,
    homePage,
    createPatientPage,
    admissionPage,
    admissionDashboardPage,
  }) => {
    // Three form-filling passes and four printed documents over a slow host; the 90s
    // project default is not enough.
    test.setTimeout(600_000);

    const patient = registrationPatient();
    const admission = admissionData();
    const expectedTotal =
      Number(admission.payment.cardAmount) +
      Number(admission.payment.bkash) +
      Number(admission.payment.cash);

    await test.step('log in', async () => {
      const { username, password } = primaryUser();
      await loginPage.goto();
      await loginPage.expectLoaded();
      await loginPage.login(username, password);
      await homePage.expectLoaded();
    });

    const uhid = await test.step('register the patient', async () => {
      await createPatientPage.goto();
      await createPatientPage.expectLoaded();

      await createPatientPage.fillPatient(patient);
      await expect(createPatientPage.dob).toHaveValue('4/10/1998');

      const id = await createPatientPage.confirmRegistration();
      expect(id).toMatch(/^\d{10,}$/);
      return id;
    });

    await test.step('admit the patient just registered', async () => {
      await admissionPage.goto();
      await admissionPage.expectLoaded();
      await admissionPage.searchByUhid(uhid);

      // The wizard pulling up the right patient is what ties the two halves together.
      await expect(admissionPage.fullName).toHaveValue(patient.fullName);
      await expect(admissionPage.patientMobile).toHaveValue(patient.mobileNo);

      await admissionPage.fillContactPerson(admission.contact);
      await admissionPage.fillAdvancePayment(admission.payment);

      // The Total Payment panel is the page's own sum, so it is the honest check that all
      // three amounts registered - these boxes ignore a value set straight on them.
      await expect(admissionPage.page.getByText('Total:').locator('..')).toContainText(
        String(expectedTotal)
      );

      await admissionPage.next.click();
      await expect(admissionPage.tab('Admission Detail')).toHaveClass(/active/);

      await admissionPage.fillAdmissionDetail(admission.detail);

      const confirmation = await admissionPage.confirmAdmission();
      expect(confirmation).not.toMatch(/error|failed|invalid/i);
      // Recorded rather than asserted on: the modal's wording is the app's, and pinning a
      // locator to it would break on a typo fix. The report keeps it for whoever reads the run.
      test.info().annotations.push({ type: 'confirmation', description: confirmation });
    });

    const admissionNo = await test.step('the admission is on the books', async () => {
      // Hospital > Dashboard, the list of everyone currently admitted. This is where a new
      // admission shows up whole, and it is what this step proves itself against. The
      // wizard's confirmation modal is not enough on its own: the wizard puts modals up for
      // other reasons too, so asserting that one appeared would pass whether or not the
      // admission was written.
      await admissionDashboardPage.goto();
      await admissionDashboardPage.expectLoaded();

      // Searched by the name as registered. The grid prints the patient's title in front of
      // it ("Mr Masud Rana Test-12") but the search matches the name without it, so the
      // registered name is the term that works - see AdmissionDashboardPage.searchFor.
      await admissionDashboardPage.searchFor(patient.fullName);

      const row = admissionDashboardPage.rowFor(patient.fullName);
      await expect(row, `no admission on the ward for ${patient.fullName}`).toBeVisible({
        timeout: 30_000,
      });

      // Deliberately not asserted here: that the advance payments reached the admission.
      // On the runs so far they did not - Hospital > Advance Dashboard carried no row for the
      // admission this flow created, even though the wizard summed the three amounts to 6000
      // before the submit. Whether that is a missing step (Advance Collection is its own page)
      // or a defect is a question for the people who own the module, so this test asserts what
      // it can stand behind - the patient is admitted, to the right ward, in a bed - and the
      // pre-submit total above is left in to prove the amounts were entered.

      // Admission number, then the details that prove it is this patient on the ward asked
      // for - the ward name is part of the bed number the wizard assigned.
      const no = await admissionDashboardPage.cell(row, 'admissionNo');
      expect(no, `admission number for UHID ${uhid}`).toMatch(/^\d{10,}$/);
      expect(await admissionDashboardPage.cell(row, 'phone')).toBe(patient.mobileNo);
      expect(await admissionDashboardPage.cell(row, 'cabinNo')).toContain(
        admission.detail.admittedTo
      );
      return no;
    });

    await test.step('the admission can be found by its number and printed', async () => {
      // The same admission, reached the other way the dashboard is used - by the number the
      // front desk is given rather than by the patient's name.
      await admissionDashboardPage.searchFor(admissionNo);
      await expect(admissionDashboardPage.rows).toHaveCount(1, { timeout: 30_000 });

      const row = admissionDashboardPage.rows.first();
      expect(await admissionDashboardPage.cell(row, 'name')).toContain(patient.fullName);

      // The paperwork that goes with a new admission, printed one button at a time. Each
      // opens its own tab on a PDF the browser built, so what came out is checked as bytes -
      // a tab opens whether or not the document rendered. See AdmissionDashboardPage.printAll.
      const printed = await admissionDashboardPage.printAll(row);
      expect(printed.length, 'print buttons in the Action cell').toBeGreaterThanOrEqual(4);
      for (const document of printed) {
        expect(document.header, `document ${document.index + 1} is not a PDF`).toMatch(/^%PDF-/);
        expect(document.size, `document ${document.index + 1} is empty`).toBeGreaterThan(1_000);
      }

      test.info().annotations.push({
        type: 'printed',
        description: printed.map((d) => `#${d.index + 1}: ${d.size} bytes`).join(', '),
      });
    });
  });
});
