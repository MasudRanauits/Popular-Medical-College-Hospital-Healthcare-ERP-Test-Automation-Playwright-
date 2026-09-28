import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Patient Registration list at /hospital/newregistration.
 *
 * Reached the way a user reaches it: click the REGISTRATION tile on the launcher, which
 * loads that module's menu into the left drawer, then click PATIENT REGISTRATION there.
 * The drawer carries only Notifications/Messages until a module tile is picked, so the
 * sidebar link genuinely does not exist before that first click.
 *
 * The page itself is a MudBlazor data grid: a "Show From"/"Show To" date filter, a
 * free-text search, an "Add New" button opening the create-patient wizard, and one row
 * per patient with an edit link in the ACTION column.
 *
 * MudBlazor regenerates input ids on every render ("mudinputsntkjoh6"), so every field
 * here is located by label, placeholder or href — never by id.
 */
export class RegistrationPage extends BasePage {
  protected readonly path = '/hospital/newregistration';

  /** Columns the grid always renders, in order. Matched case-insensitively: the markup
   *  is title case but CSS uppercases it, and innerText follows the CSS. */
  static readonly COLUMNS = [/name/i, /uhid/i, /reg date/i, /phone number/i, /dob/i, /action/i];

  /** REGISTRATION tile on the launcher — main content, not the drawer. */
  readonly moduleTile: Locator;
  readonly sidebar: Locator;
  /** REGISTRATION group header inside the drawer; a MudNavGroup toggle, so it is a
   *  <button> with no href and carries no link role. */
  readonly sidebarMenu: Locator;
  readonly patientRegistrationLink: Locator;

  readonly heading: Locator;
  readonly showFrom: Locator;
  readonly showTo: Locator;
  readonly showButton: Locator;
  readonly addNew: Locator;
  readonly search: Locator;
  readonly table: Locator;
  readonly rows: Locator;

  constructor(page: Page) {
    super(page);
    this.moduleTile = page.locator('.menu-text').filter({ hasText: /^REGISTRATION$/ });
    this.sidebar = page.locator('aside.mud-drawer');
    this.sidebarMenu = this.sidebar.locator('.mud-nav-link').filter({ hasText: /^REGISTRATION$/ });
    this.patientRegistrationLink = this.sidebar.locator(`a.mud-nav-link[href="${this.path}"]`);

    this.heading = page.locator('h4.page-title');
    this.showFrom = this.dateFilter('Show From');
    this.showTo = this.dateFilter('Show To');
    this.showButton = page.getByRole('button', { name: 'Show', exact: true });
    // Rendered as a styled anchor, not a <button>, so getByRole('button') never matches it.
    this.addNew = page.getByRole('link', { name: 'Add New' });
    this.search = page.getByPlaceholder('Search');
    this.table = page.locator('table.mud-table-root');
    this.rows = this.table.locator('tbody tr');
  }

  /** The input inside the MudBlazor field carrying `label`, e.g. dateFilter('Show From'). */
  private dateFilter(label: string): Locator {
    return this.page.locator('.mud-input-control').filter({ hasText: label }).locator('input').first();
  }

  /**
   * Opens the page the way a user does: REGISTRATION tile on the launcher, then
   * PATIENT REGISTRATION in the drawer it populates. Expects the launcher to be open.
   */
  async openFromLauncher(): Promise<void> {
    await this.moduleTile.click();
    await expect(this.patientRegistrationLink).toBeVisible();
    await this.patientRegistrationLink.click();
  }

  async expectLoaded(): Promise<void> {
    // Covers click-driven navigation too, not just goto().
    await this.settleAuthorization(this.heading);
    await expect(this.page).toHaveURL(new RegExp(this.path));
    await expect(this.heading).toHaveText(/patient registration/i, { timeout: 30_000 });
    await expect(this.table).toBeVisible({ timeout: 30_000 });
  }

  /** Types `term` into the search box and waits for the grid to re-render. */
  async searchFor(term: string): Promise<void> {
    await this.search.fill(term);
    // The grid filters client-side on each keystroke; settle before counting rows.
    await this.page.waitForTimeout(1_500);
  }

  /** Patient name in the first column of `row`. */
  nameCell(row: Locator): Locator {
    return row.locator('td').first();
  }

  /** Edit link in the ACTION column of `row` — /hospital/patients/edit/<uhid>. */
  editLink(row: Locator): Locator {
    return row.locator('td').last().locator('a[href*="/patients/edit/"]');
  }
}


/**
 * Create-patient wizard at /hospital/patients/new, opened by "Add New" on the patient
 * registration list.
 *
 * Three tabs — Patient, Contact Person, Corporate Client — over a Previous/Next/Confirm
 * Registeration footer ("Registeration" is the app's spelling, kept so the locator
 * matches the live button).
 *
 * MudBlazor field mechanics, both of which decide how things are located here:
 *  - text fields render a <label for=...>, so getByLabel resolves them exactly;
 *  - selects back the control with a *hidden* input, so getByLabel finds nothing and
 *    the visible .mud-select container has to be used instead.
 */
export class CreatePatientPage extends BasePage {
  protected readonly path = '/hospital/patients/new';

  /** Fields the form marks mandatory, each rendered with a "Required" hint. */
  static readonly REQUIRED_FIELDS = ['Full Name', 'Gender', 'DOB', 'Blood Group', 'Mobile No'];

  readonly heading: Locator;
  readonly patientTab: Locator;
  readonly contactPersonTab: Locator;
  readonly corporateClientTab: Locator;

  readonly fullName: Locator;
  readonly givenName: Locator;
  readonly surname: Locator;
  readonly fatherName: Locator;
  readonly motherName: Locator;
  readonly spouse: Locator;
  readonly mobileNo: Locator;
  readonly email: Locator;
  readonly idNo: Locator;

  readonly title: Locator;
  readonly gender: Locator;
  readonly maritalStatus: Locator;
  readonly religion: Locator;
  readonly bloodGroup: Locator;
  readonly idType: Locator;
  readonly occupation: Locator;
  readonly district: Locator;

  readonly ageYears: Locator;
  readonly ageMonths: Locator;
  readonly ageDays: Locator;
  readonly dob: Locator;

  readonly houseNo: Locator;
  readonly roadNo: Locator;
  readonly area: Locator;
  readonly village: Locator;
  readonly thana: Locator;
  readonly postOffice: Locator;

  readonly previous: Locator;
  readonly next: Locator;
  readonly confirm: Locator;
  readonly printIdCard: Locator;
  readonly clear: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.locator('h4.page-title');
    this.patientTab = this.tab('Patient');
    this.contactPersonTab = this.tab('Contact Person');
    this.corporateClientTab = this.tab('Corporate Client');

    this.fullName = this.textField('Full Name');
    this.givenName = this.textField('Given Name');
    this.surname = this.textField('Surname');
    this.fatherName = this.textField('Father Name');
    this.motherName = this.textField('Mother Name');
    this.spouse = this.textField('Spouse');
    this.mobileNo = this.textField('Mobile No');
    this.email = this.textField('Email');
    this.idNo = this.textField('IDNo');

    this.title = this.selectField('Title');
    this.gender = this.selectField('Gender');
    this.maritalStatus = this.selectField('Marital Status');
    this.religion = this.selectField('Religion');
    this.bloodGroup = this.selectField('Blood Group');
    this.idType = this.selectField('ID Type');
    this.occupation = this.selectField('Occupation');
    this.district = this.selectField('District');

    // Age, not birth date: three 3-digit boxes the app tags with data-age-part.
    this.ageYears = page.locator('input[data-age-part="year"]');
    this.ageMonths = page.locator('input[data-age-part="month"]');
    this.ageDays = page.locator('input[data-age-part="day"]');
    // Filled through a MudDatePicker, so the input itself is readonly.
    this.dob = this.textField('DOB');

    this.houseNo = this.textField('House No');
    this.roadNo = this.textField('Road No');
    this.area = this.textField('Area');
    this.village = this.textField('Village');
    this.thana = this.textField('Thana');
    this.postOffice = this.textField('PO');

    // "Previews" and "Registeration" are the app's spellings, not typos here.
    this.previous = page.getByRole('button', { name: 'Previews' });
    this.next = page.getByRole('button', { name: 'Next' });
    this.confirm = page.getByRole('button', { name: 'Confirm Registeration' });
    this.printIdCard = page.getByRole('button', { name: 'Print ID CARD' });
    this.clear = page.getByRole('button', { name: 'CLEAR' });
  }

  /** A MudBlazor text input, resolved through its <label for=...>. */
  private textField(label: string): Locator {
    return this.page.getByLabel(label, { exact: true });
  }

  /**
   * A MudBlazor select. Its own input is hidden, so the visible container is used.
   * MudBlazor nests two .mud-select nodes per control; the outer one is the clickable.
   */
  private selectField(label: string): Locator {
    return this.page.locator('.mud-select').filter({ hasText: label }).first();
  }

  private tab(name: string): Locator {
    return this.page.locator('[role="tab"]').filter({ hasText: name });
  }

  /** The "Required" hint rendered beside `label`'s control. */
  requiredHint(label: string): Locator {
    return this.page
      .locator('.mud-input-control')
      .filter({ hasText: label })
      .getByText('Required', { exact: true })
      .first();
  }

  async expectLoaded(): Promise<void> {
    // Covers click-driven navigation too, not just goto().
    await this.settleAuthorization(this.heading);
    await expect(this.page).toHaveURL(new RegExp(this.path));
    await expect(this.heading).toHaveText(/create patient/i, { timeout: 30_000 });
    await expect(this.patientTab).toBeVisible({ timeout: 30_000 });
  }
}
