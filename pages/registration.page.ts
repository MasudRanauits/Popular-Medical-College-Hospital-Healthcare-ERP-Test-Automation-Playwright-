import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';
import type { RegistrationPatient } from '../data/test-data';

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
    await this.clickUntilVisible(this.moduleTile, this.patientRegistrationLink, '/');

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
  readonly referredBy: Locator;

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
  /** Read-only summary the ADDRESS card composes from the fields above it. */
  readonly addressSummary: Locator;

  readonly previous: Locator;
  readonly next: Locator;
  readonly confirm: Locator;
  readonly printIdCard: Locator;
  readonly clear: Locator;
  /** The dialog Confirm Registeration raises, carrying the new Patient ID. */
  readonly successDialog: Locator;

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
    // District and Thana are MudAutocomplete, not MudSelect: their text input is visible
    // and filters the list as you type, so both are located as inputs rather than as a
    // container to click.
    this.district = this.autocompleteField('District');
    // Referred by is a Radzen lookup dropped into the MudBlazor form - it carries no
    // .mud- class at all, and its label is a plain <p> above the control, not a <label>.
    this.referredBy = page.locator('.rz-dropdown').first();

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
    this.thana = this.autocompleteField('Thana');
    this.postOffice = this.textField('PO');
    // The one textarea on the form, and it carries no label of its own.
    this.addressSummary = page.locator('textarea.form-control').last();

    // "Previews" and "Registeration" are the app's spellings, not typos here.
    this.previous = page.getByRole('button', { name: 'Previews' });
    this.next = page.getByRole('button', { name: 'Next' });
    this.confirm = page.getByRole('button', { name: 'Confirm Registeration' });
    this.printIdCard = page.getByRole('button', { name: 'Print ID CARD' });
    this.clear = page.getByRole('button', { name: 'CLEAR' });
    this.successDialog = page.locator('.mud-dialog').filter({ hasText: /patient id/i }).first();
  }

  /**
   * Fills the Patient tab from `data`. Ordered the way the form reads, and DOB is set
   * before anything below it because choosing a date re-renders the Year/Month/Day boxes
   * sitting between the two halves of the form.
   */
  async fillPatient(data: RegistrationPatient): Promise<void> {
    await this.choose(this.title, data.title);
    await this.fullName.fill(data.fullName);
    await this.choose(this.gender, data.gender);
    await this.setDob(data.dob.year, data.dob.month, data.dob.day);
    await this.choose(this.maritalStatus, data.maritalStatus);
    await this.choose(this.religion, data.religion);
    await this.choose(this.bloodGroup, data.bloodGroup);
    await this.mobileNo.fill(data.mobileNo);
    await this.choose(this.idType, data.idType);
    await this.idNo.fill(data.idNo);
    await this.choose(this.occupation, data.occupation);
    await this.chooseReferredBy(data.referredBy);
    // Thana is filtered by District, so District has to be chosen first.
    await this.chooseFromAutocomplete(this.district, data.district);
    await this.chooseFromAutocomplete(this.thana, data.thana);
  }

  /**
   * Submits the wizard and dismisses the dialog it raises, returning the Patient ID the
   * dialog reports. The ID is the only receipt the app gives: the form clears itself on
   * Ok, and Print ID CARD stays disabled.
   *
   * The dialog is found by the Patient ID it carries rather than by its message, which
   * reads "Conform New Patient SuccessFully Save" - misspelt, and not worth pinning a
   * locator to.
   */
  async confirmRegistration(): Promise<string> {
    await this.confirm.click();
    await expect(this.successDialog).toBeVisible({ timeout: 60_000 });

    const message = (await this.successDialog.innerText()).replace(/\s+/g, ' ');
    const id = message.match(/Patient ID\s*(\d+)/i)?.[1];
    if (!id) throw new Error(`No Patient ID in the confirmation dialog: "${message}"`);

    await this.successDialog.getByRole('button', { name: 'Ok', exact: true }).click();
    await expect(this.successDialog).toBeHidden();
    return id;
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

  /** The typed input of the MudAutocomplete carrying `label`, e.g. 'District'. */
  private autocompleteField(label: string): Locator {
    return this.page
      .locator('.mud-autocomplete')
      .filter({ hasText: label })
      .locator('input[type="text"]')
      .first();
  }

  /** The list popover MudBlazor renders for whichever select or autocomplete is open. */
  private get openPopover(): Locator {
    return this.page.locator('.mud-popover-open');
  }

  /**
   * One option in that popover. The text is matched on the item's own <p> with :text-is,
   * so 'A+' cannot also select 'AB+'; it goes through has: because the text engine
   * resolves to that <p> rather than to the .mud-list-item the click has to land on.
   */
  private popoverItem(option: string): Locator {
    return this.openPopover
      .locator('.mud-list-item')
      .filter({ has: this.page.locator(`p:text-is("${option}")`) })
      .first();
  }

  /** Opens `select` and picks `option` out of the popover it renders. */
  async choose(select: Locator, option: string): Promise<void> {
    await select.click();
    await this.popoverItem(option).click();
    await expect(this.openPopover).toHaveCount(0);
  }

  /**
   * Picks `option` from an autocomplete by typing it and clicking the match. Both address
   * autocompletes fetch their options, so the list lags behind the keystrokes.
   */
  async chooseFromAutocomplete(input: Locator, option: string): Promise<void> {
    await input.click();
    await input.fill(option);
    const item = this.popoverItem(option);
    await expect(item).toBeVisible({ timeout: 30_000 });
    await item.click();
    await expect(input).toHaveValue(option);
  }

  /**
   * Sets DOB through the MudDatePicker, which is the only way in: the input is readonly,
   * and the Year/Month/Day boxes beside it are a read-out of the chosen date rather than a
   * second entry point - typing an age into them leaves DOB empty.
   *
   * Three views, in the order the picker walks through them: year list, month grid, day
   * cell. Picking the year advances to the month grid on its own, so there is no month
   * header to click in between.
   */
  async setDob(year: number, month: string, day: number): Promise<void> {
    await this.dob.click();
    const picker = this.openPopover.last();

    // MudBlazor scrolls the year list to the current year, never to a birth year.
    await picker.locator('.mud-button-year').click();
    const yearItem = picker.locator('.mud-picker-year').filter({ hasText: String(year) }).first();
    await yearItem.scrollIntoViewIfNeeded();
    await yearItem.click();

    await picker.locator('.mud-picker-month').filter({ hasText: month }).first().click();

    // The leading and trailing cells belong to the neighbouring months and carry mud-hidden.
    // Anchored hasText rather than :text-is - the digits sit in a <p> inside the day button,
    // so the text engine would match that <p> and not the button that has to be clicked.
    await picker
      .locator('.mud-picker-calendar-day:not(.mud-hidden)')
      .filter({ hasText: new RegExp(`^${day}$`) })
      .first()
      .click();

    await expect(this.openPopover).toHaveCount(0);
    await expect(this.dob).not.toHaveValue('');
  }

  /**
   * Picks a doctor in "Referred by". Radzen, not MudBlazor: clicking it opens a panel with
   * its own search box and a DoctorCodeNo/DoctoName grid, and the doctor has to be clicked
   * as a row in that grid.
   */
  async chooseReferredBy(term: string): Promise<void> {
    await this.referredBy.click();
    const panel = this.page
      .locator('.rz-dropdown-panel')
      .filter({ has: this.page.locator('.rz-lookup-panel') })
      .first();
    await panel.locator('.rz-lookup-search input').fill(term);
    await panel.locator('.rz-lookup-search button').click();
    const row = panel.locator('tbody tr').filter({ hasText: term }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.click();
    await expect(panel).toBeHidden();
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
