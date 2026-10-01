import { test, expect } from '../../fixtures';
import { admissionData } from '../../data/test-data';

/**
 * Smoke: the New Admission wizard at /hospital/patientadmission.
 *
 * Covers the four marked tabs in the order they are worked through:
 *   1. Patient  2. Contact Person  3. Advance Payment  4. Admission Detail
 *
 * Smoke only - nothing here submits. "Create Patient Admission" writes a real admission
 * holding a real bed and real advance payments, and undoing one is its own workflow under
 * Hospital > Admission Cancel. The end-to-end submit lives in TC_FLOW_001, in
 * tests/regression/admission.regression.spec.ts.
 *
 * Runs on the session tests/auth.setup.ts saves.
 */
test.describe('Admission @smoke', () => {
  test('the wizard opens on the Patient tab with its required fields ready', async ({
    admissionPage,
  }) => {
    await admissionPage.goto();
    await admissionPage.expectLoaded();

    await expect(admissionPage.tab('Patient')).toHaveClass(/active/);
    await expect(admissionPage.uhid).toBeEditable();

    // The fields the form marks required - red-bordered on an untouched Patient tab.
    await expect(admissionPage.fullName).toBeEditable();
    await expect(admissionPage.surname).toBeEditable();
    await expect(admissionPage.dob).toBeVisible();
    await expect(admissionPage.patientMobile).toBeEditable();
    await expect(admissionPage.select('Blood Group')).toBeVisible();
  });

  test('the four marked tabs open in order', async ({ admissionPage }) => {
    await admissionPage.goto();
    await admissionPage.expectLoaded();

    // openTab asserts the tab goes active; each check below is that the pane behind it
    // actually rendered, so a tab that switches without its fields arriving still fails.
    await admissionPage.openTab('Patient');
    await expect(admissionPage.fullName).toBeVisible();

    await admissionPage.openTab('Contact Person');
    await expect(admissionPage.field('Guardian Name')).toBeVisible();
    await expect(admissionPage.select('Relation')).toBeVisible();

    await admissionPage.openTab('Advance Payment');
    await expect(admissionPage.select('Select Card')).toBeVisible();
    await expect(admissionPage.field('BKash Payment')).toBeVisible();
    await expect(admissionPage.field('Payment (Cash)')).toBeVisible();

    await admissionPage.openTab('Admission Detail');
    await expect(admissionPage.select('Select Department')).toBeVisible();
    await expect(admissionPage.select('Admitted to')).toBeVisible();
    await expect(admissionPage.select('Bed/Cabin')).toBeVisible();
  });

  test('a patient loads by UHID into the Patient tab', async ({
    registrationPage,
    admissionPage,
  }) => {
    // The wizard admits a patient who is already registered, so the UHID is read out of the
    // registration grid rather than hard-coded - the grid holds live hospital data and no
    // patient in it is guaranteed to still be there next week.
    await registrationPage.goto();
    await registrationPage.expectLoaded();

    // NAME, UHID, REG DATE, PHONE NUMBER, DOB, ACTION - UHID is the second column.
    const uhid = (await registrationPage.rows.first().locator('td').nth(1).innerText()).trim();
    expect(uhid).toMatch(/^\d{10,}$/);

    await admissionPage.goto();
    await admissionPage.expectLoaded();
    await admissionPage.searchByUhid(uhid);

    // The wizard fills the Patient tab from the registration record.
    await expect(admissionPage.fullName).not.toHaveValue('');
    await expect(admissionPage.patientMobile).not.toHaveValue('');
    await expect(admissionPage.dob).not.toHaveValue('');
  });

  test('the tabs take entry in order, up to the submit', async ({ admissionPage }) => {
    // Three tabs filled in over a slow host; the 90s project default is not enough.
    test.setTimeout(240_000);

    const admission = admissionData();
    const expectedTotal =
      Number(admission.payment.cardAmount) +
      Number(admission.payment.bkash) +
      Number(admission.payment.cash);

    await admissionPage.goto();
    await admissionPage.expectLoaded();

    await test.step('2. Contact Person', async () => {
      await admissionPage.fillContactPerson(admission.contact);
      await expect(admissionPage.field('Guardian Name')).toHaveValue(
        admission.contact.guardianName
      );
    });

    await test.step('3. Advance Payment', async () => {
      await admissionPage.fillAdvancePayment(admission.payment);

      // The Total Payment panel is the page's own sum, so it is the honest check that all
      // three amounts registered - these boxes ignore a value set straight on them.
      await expect(admissionPage.page.getByText('Total:').locator('..')).toContainText(
        String(expectedTotal)
      );
    });

    await test.step('4. Admission Detail', async () => {
      await admissionPage.next.click();
      await expect(admissionPage.tab('Admission Detail')).toHaveClass(/active/);

      await admissionPage.choose('Select Department', admission.detail.department);
      await admissionPage.choose('Admitted to', admission.detail.admittedTo);

      // The bed list is fetched off "Admitted to"; it arriving is what says the ward took.
      // Index 1 is the first real bed, index 0 being the "Select..." placeholder.
      const beds = admissionPage.select('Bed/Cabin');
      await expect(beds.locator('option')).not.toHaveCount(1, { timeout: 30_000 });
      await beds.selectOption({ index: 1 });
      await expect(beds).not.toHaveValue('');

      const doctor = await admissionPage.chooseDoctor(
        'Assigned Doctor',
        admission.detail.doctorSearch
      );
      expect(doctor).toContain(admission.detail.doctorSearch);
    });

    // Deliberately no submit: see the file header.
    await expect(admissionPage.createAdmission).toBeEnabled();
  });
});
