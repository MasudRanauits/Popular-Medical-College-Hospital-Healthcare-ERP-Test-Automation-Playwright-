# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: regression\admission.regression.spec.ts >> Admission @regression >> TC_ADM_002 searching a UHID loads that patient into the wizard
- Location: tests\regression\admission.regression.spec.ts:52:7

# Error details

```
TimeoutError: locator.innerText: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('table.mud-table-root').locator('tbody tr').first().locator('td').nth(1)

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - text: 
  - generic [ref=e2]:
    - banner [ref=e3]:
      - toolbar [ref=e4]:
        - button [ref=e5] [cursor=pointer]
        - heading "Popular Medical College and Hospital Limited" [level=2] [ref=e11]
        - button [ref=e13] [cursor=pointer]
        - 'button "Language: English" [ref=e19] [cursor=pointer]'
        - generic [ref=e20]:
          - img [ref=e21] [cursor=pointer]: NA
          - generic [ref=e22]:
            - generic [ref=e23]: NA
            - generic [ref=e24]: Administrator
          - button "Open user menu" [ref=e26] [cursor=pointer]
    - complementary [ref=e31]:
      - navigation [ref=e36]:
        - generic [ref=e40] [cursor=pointer]:
          - generic [ref=e41]: HIS ERP
          - generic [ref=e42]: Healthcare Information System
        - navigation [ref=e43]:
          - button "Toggle lncjpy04h" [expanded] [ref=e44] [cursor=pointer]:
            - generic [ref=e45]: REGISTRATION
          - navigation [ref=e55]:
            - link "PATIENT REGISTRATION" [ref=e57] [cursor=pointer]:
              - /url: /hospital/newregistration
    - generic [ref=e67]:
      - heading "PATIENT REGISTRATION" [level=4] [ref=e71]:
        - button [ref=e72] [cursor=pointer]
        - text: PATIENT REGISTRATION
      - generic [ref=e78]:
        - generic [ref=e79]:
          - generic [ref=e83]:
            - generic [ref=e84] [cursor=pointer]:
              - textbox "Show From" [ref=e85]: 10/3/2026
              - button "Open" [ref=e87]
              - group "Show From"
            - generic: Show From
          - generic [ref=e95]:
            - generic [ref=e96] [cursor=pointer]:
              - textbox "Show To" [ref=e97]: 10/3/2026
              - button "Open" [ref=e99]
              - group "Show To"
            - generic: Show To
          - button "Show" [ref=e105] [cursor=pointer]
          - group [ref=e108]:
            - link "Add New" [ref=e109] [cursor=pointer]:
              - /url: hospital/patients/new
            - button "Reload" [ref=e111] [cursor=pointer]
        - generic [ref=e113]:
          - toolbar [ref=e114]:
            - textbox "Search" [ref=e122]
          - table [ref=e125]:
            - rowgroup [ref=e126]:
              - row [ref=e127]:
                - columnheader "Name Sort Column options" [ref=e128]:
                  - generic [ref=e129]:
                    - generic [ref=e130] [cursor=pointer]: Name
                    - generic [ref=e131] [cursor=pointer]:
                      - button "Sort" [ref=e132]
                      - button "Column options" [ref=e138]
                - columnheader "UHID Sort Column options" [ref=e143]:
                  - generic [ref=e144]:
                    - generic [ref=e145] [cursor=pointer]: UHID
                    - generic [ref=e146] [cursor=pointer]:
                      - button "Sort" [ref=e147]
                      - button "Column options" [ref=e153]
                - columnheader "REG DATE Sort Column options" [ref=e158]:
                  - generic [ref=e159]:
                    - generic [ref=e160] [cursor=pointer]: REG DATE
                    - generic [ref=e161] [cursor=pointer]:
                      - button "Sort" [ref=e162]
                      - button "Column options" [ref=e168]
                - columnheader "Phone Number Sort Column options" [ref=e173]:
                  - generic [ref=e174]:
                    - generic [ref=e175] [cursor=pointer]: Phone Number
                    - generic [ref=e176] [cursor=pointer]:
                      - button "Sort" [ref=e177]
                      - button "Column options" [ref=e183]
                - columnheader "DOB Sort Column options" [ref=e188]:
                  - generic [ref=e189]:
                    - generic [ref=e190] [cursor=pointer]: DOB
                    - generic [ref=e191] [cursor=pointer]:
                      - button "Sort" [ref=e192]
                      - button "Column options" [ref=e198]
                - columnheader "ACTION" [ref=e203]
            - rowgroup
            - rowgroup:
              - row
          - toolbar [ref=e206]:
            - paragraph [ref=e207]: "Rows per page:"
            - generic [ref=e208]: "10"
            - paragraph [ref=e217]: 0-0 of 0
            - generic [ref=e218]:
              - button "First page" [disabled]
              - button "Previous page" [disabled]
              - button "Next page" [disabled]
              - button "Last page" [disabled]
```

# Test source

```ts
  1   | import { test, expect } from '../../fixtures';
  2   | import type { Page } from '@playwright/test';
  3   | import { primaryUser } from '../../data/users';
  4   | import { admissionData, registrationPatient } from '../../data/test-data';
  5   | 
  6   | /**
  7   |  * Admission @regression — TC_ADM_001 … TC_ADM_002, TC_FLOW_001.
  8   |  *
  9   |  * Signed-in suite: it runs on the session saved by tests/auth.setup.ts. The one exception
  10  |  * is TC_FLOW_001 at the bottom of the file, which runs signed out because logging in is
  11  |  * the first thing it checks.
  12  |  *
  13  |  * Covers the New Admission wizard at /hospital/patientadmission, reached through the
  14  |  * Hospital module. The wizard admits a patient who is already registered, so the UHID is
  15  |  * read out of the patient registration list rather than hard-coded — the grid holds live
  16  |  * hospital data and no patient in it is guaranteed to still be there next week.
  17  |  *
  18  |  * TC_ADM_001 and TC_ADM_002 stop short of submitting the wizard. Admitting a patient end
  19  |  * to end is TC_FLOW_001, in the second describe below, which registers the patient it
  20  |  * admits rather than picking one out of live data.
  21  |  */
  22  | test.describe('Admission @regression', () => {
  23  |   /** UHID of the most recently registered patient, taken from the registration grid. */
  24  |   async function newestUhid(registrationPage: {
  25  |     goto: () => Promise<void>;
  26  |     expectLoaded: () => Promise<void>;
  27  |     rows: import('@playwright/test').Locator;
  28  |   }): Promise<string> {
  29  |     await registrationPage.goto();
  30  |     await registrationPage.expectLoaded();
  31  |     // NAME, UHID, REG DATE, PHONE NUMBER, DOB, ACTION - UHID is the second column.
> 32  |     const uhid = (await registrationPage.rows.first().locator('td').nth(1).innerText()).trim();
      |                                                                            ^ TimeoutError: locator.innerText: Timeout 30000ms exceeded.
  33  |     expect(uhid).toMatch(/^\d{10,}$/);
  34  |     return uhid;
  35  |   }
  36  | 
  37  |   test('TC_ADM_001 New Admission opens from the Hospital module menu', async ({
  38  |     homePage,
  39  |     admissionPage,
  40  |   }) => {
  41  |     await homePage.goto();
  42  |     await homePage.expectLoaded();
  43  | 
  44  |     const link = await homePage.openModule('Hospital', '/hospital/patientadmission');
  45  |     await link.click();
  46  | 
  47  |     await admissionPage.expectLoaded();
  48  |     await expect(admissionPage.uhid).toBeEditable();
  49  |     await expect(admissionPage.tab('Patient')).toHaveClass(/active/);
  50  |   });
  51  | 
  52  |   test('TC_ADM_002 searching a UHID loads that patient into the wizard', async ({
  53  |     registrationPage,
  54  |     admissionPage,
  55  |   }) => {
  56  |     const uhid = await newestUhid(registrationPage);
  57  |     // Normalised, because the grid cell wraps the name and the dashboard row does not.
  58  |     const name = (await registrationPage.rows.first().locator('td').first().innerText())
  59  |       .replace(/\s+/g, ' ')
  60  |       .trim();
  61  | 
  62  |     await admissionPage.goto();
  63  |     await admissionPage.expectLoaded();
  64  |     await admissionPage.searchByUhid(uhid);
  65  | 
  66  |     // The wizard fills the Patient tab from the registration record, so the two must agree.
  67  |     await expect(admissionPage.fullName).toHaveValue(name);
  68  |     await expect(admissionPage.patientMobile).not.toHaveValue('');
  69  |     await expect(admissionPage.dob).not.toHaveValue('');
  70  |   });
  71  | });
  72  | 
  73  | 
  74  | /**
  75  |  * Patient journey @regression — TC_FLOW_001.
  76  |  *
  77  |  * One patient, followed the way the hospital actually takes one on: log in, register them
  78  |  * at the front desk, then admit them to a ward through the New Admission wizard.
  79  |  *
  80  |  * Why it is one test and not three. The admission wizard needs a patient who is registered
  81  |  * and not already on a ward, and the only way to be sure of that is to have just registered
  82  |  * them. Split into separate tests, the admission half would have to go hunting for a UHID
  83  |  * in live data and would re-admit the same person on a second run.
  84  |  *
  85  |  * It runs signed out, because logging in is the first thing it checks. The rest of the
  86  |  * regression suite runs on the session tests/auth.setup.ts saves.
  87  |  *
  88  |  * This test writes to the live database, twice: a patient record and an admission holding a
  89  |  * real bed and real advance payments. Neither is undone by deleting a row - cancelling an
  90  |  * admission is its own workflow under Hospital > Admission Cancel. Run it deliberately.
  91  |  */
  92  | test.describe('Patient journey @regression', () => {
  93  |   test.use({ storageState: { cookies: [], origins: [] } });
  94  | 
  95  |   // A retry would repeat both writes, which is never worth it: a failure after the
  96  |   // registration went through leaves a patient behind either way, and the retry would add
  97  |   // a second one rather than tell us anything new.
  98  |   test.describe.configure({ retries: 0 });
  99  | 
  100 |   /**
  101 |    * The admitted-patient row for `name` on Hospital > Patient Dashboard For Billing Dept:
  102 |    * ADMISSIONNO, ADMISSION DATE, PATIENT NAME, MOBILENO, BLOODGROUP, BEDNO, ASSIGNDOC, ...
  103 |    *
  104 |    * This is where a new admission shows up whole, and it is what the last step proves
  105 |    * itself against. The confirmation modal is not enough on its own: the wizard puts modals
  106 |    * up for other reasons too, so asserting that one appeared would pass whether or not the
  107 |    * admission was written.
  108 |    */
  109 |   async function admittedRow(page: Page, name: string): Promise<string> {
  110 |     await page.goto('/hospital/patient-dashboard-for-billing-dept', { waitUntil: 'domcontentloaded' });
  111 | 
  112 |     const rows = page.locator('tbody tr');
  113 |     await expect(rows.first()).toBeVisible({ timeout: 60_000 });
  114 |     await page.getByPlaceholder('Search...').first().fill(name);
  115 | 
  116 |     const row = rows.filter({ hasText: name }).first();
  117 |     await expect(row, `no admission on the ward for ${name}`).toBeVisible({ timeout: 30_000 });
  118 |     return (await row.innerText()).replace(/\s+/g, ' ').trim();
  119 |   }
  120 | 
  121 |   test('TC_FLOW_001 logs in, registers a patient, then admits them', async ({
  122 |     loginPage,
  123 |     homePage,
  124 |     createPatientPage,
  125 |     admissionPage,
  126 |   }) => {
  127 |     // Three form-filling passes over a slow host; the 90s project default is not enough.
  128 |     test.setTimeout(420_000);
  129 | 
  130 |     const patient = registrationPatient();
  131 |     const admission = admissionData();
  132 |     const expectedTotal =
```