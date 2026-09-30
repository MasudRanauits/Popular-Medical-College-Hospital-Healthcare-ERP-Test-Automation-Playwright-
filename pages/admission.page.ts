import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';
import type { AdmissionData } from '../data/test-data';

/**
 * New Admission wizard at /hospital/patientadmission - Hospital module, "New Admission"
 * in the drawer.
 *
 * Nothing like the registration wizard underneath: this page is Bootstrap, not MudBlazor.
 * Its dropdowns are native <select class="form-select">, so selectOption works and the
 * options are in the DOM from the start; its tabs are <a class="nav-link"> in a nav-item
 * list; and only the doctor pickers are Radzen lookups - the same .rz-dropdown control the
 * registration form uses for "Referred by".
 *
 * Two outer tabs, Admission One and Admission Two. Admission One holds the inner tabs
 * Patient / Contact Person / Corporate Client / Package / Advance Payment, and Next moves
 * on to Admission Detail, where the department, bed and doctors are chosen.
 */
export class AdmissionPage extends BasePage {
  protected readonly path = '/hospital/patientadmission';

  /** Patient lookup across the top of the page. */
  readonly uhid: Locator;
  readonly mobileSearch: Locator;
  readonly invoiceSearch: Locator;
  readonly search: Locator;
  readonly clearSearch: Locator;

  /**
   * Remarks box of the card column. Four payment blocks are labelled "Remarks", so this
   * one is reached through the column that holds the Select Card dropdown.
   */
  readonly cardRemarks: Locator;

  readonly next: Locator;
  readonly createAdmission: Locator;

  /**
   * Patient tab, filled in by the UHID search rather than by hand. Located by label, not
   * by placeholder: the Contact Person tab reuses "Enter Full Name" for Guardian Name and
   * "Enter Mobile No" for the guardian's number, so a placeholder alone matches two fields.
   */
  readonly fullName: Locator;
  readonly givenName: Locator;
  readonly surname: Locator;
  readonly nid: Locator;
  readonly patientMobile: Locator;
  readonly dob: Locator;

  constructor(page: Page) {
    super(page);
    this.uhid = page.getByPlaceholder('UHID');
    this.mobileSearch = page.getByPlaceholder('Mobile No', { exact: true });
    this.invoiceSearch = page.getByPlaceholder('Invoice No');
    // Three hidden Radzen lookups also carry the accessible name "search", so the visible
    // button is pinned by its Bootstrap class as well as its name - and the name is matched
    // with the surrounding space left in, because the button renders an icon before the word
    // and hasText does not trim a regex the way it trims a string.
    this.search = page.locator('button.btn-primary').filter({ hasText: /^\s*Search\s*$/ });
    this.clearSearch = page.locator('button.btn-danger').filter({ hasText: /^CLEAR$/ });

    this.cardRemarks = page
      .locator('div.col-md-auto')
      .filter({ has: page.locator(`label.form-label:text-is('Select Card')`) })
      .locator('div.form-group')
      .filter({ has: page.locator(`label.form-label:text-is('Remarks')`) })
      .locator('input');

    // Every tab pane carries its own Previous/Next pair, and the label renders with a
    // trailing space next to the chevron, so the visible one is matched on a loose regex.
    this.next = page
      .locator('button.btn-primary:visible')
      .filter({ hasText: /^\s*Next\s*$/ });
    this.createAdmission = page.getByRole('button', { name: 'Create Patient Admission' });

    this.fullName = this.field('Full Name');
    this.givenName = this.field('Given Name');
    this.surname = this.field('Surname');
    this.nid = this.field('ID No');
    // "Mobile No" labels the search bar as well as the patient's own number.
    this.patientMobile = this.group('Mobile No').locator('input[placeholder="Enter Mobile No"]');
    this.dob = this.field('DOB');
  }

  /** One of the page's tabs, e.g. tab('Contact Person'). CSS uppercases the label. */
  tab(name: string): Locator {
    return this.page.locator('a.nav-link').filter({ hasText: new RegExp(`^${name}$`, 'i') });
  }

  /** Opens `name` and waits for its pane to take over, e.g. openTab('Contact Person'). */
  async openTab(name: string): Promise<void> {
    await this.tab(name).click();
    await expect(this.tab(name)).toHaveClass(/active/);
  }

  /**
   * Fills the Contact Person tab top to bottom. Area/Thana is left alone: it is filtered by
   * District and repopulates asynchronously, and the tab is here to prove the fields take
   * input rather than to record a particular guardian.
   */
  async fillContactPerson(c: AdmissionData['contact']): Promise<void> {
    await this.openTab('Contact Person');
    await this.field('Guardian Name').fill(c.guardianName);
    await this.field('Mobile').fill(c.mobile);
    await this.choose('Relation', c.relation);
    await this.field('House No').fill(c.houseNo);
    await this.field('Road No').fill(c.roadNo);
    await this.field('Village').fill(c.village);
    await this.field('Post Office').fill(c.postOffice);
    await this.choose('District', c.district);
    await this.group('Guardian Address').locator('textarea').fill(c.address);
  }

  /** Fills the Advance Payment tab: card, then bKash, then cash. */
  async fillAdvancePayment(p: AdmissionData['payment']): Promise<void> {
    await this.openTab('Advance Payment');
    await this.payByCard(p.card, p.pos, p.cardAmount, p.cardRemarks);
    await this.enterAmount('BKash Payment', p.bkash);
    await this.enterAmount('Payment (Cash)', p.cash);
  }

  /**
   * Fills Admission Detail: department, ward, bed, and the four doctor lookups.
   *
   * The bed list is fetched off "Admitted to", so the ward has to be chosen and the list
   * has to arrive before a bed can be picked - index 1 is the first real bed, index 0 being
   * the "Select..." placeholder. Which bed is free changes run to run, so none is named.
   */
  async fillAdmissionDetail(d: AdmissionData['detail']): Promise<void> {
    await this.choose('Select Department', d.department);
    await this.choose('Admitted to', d.admittedTo);

    const beds = this.select('Bed/Cabin');
    await expect(beds.locator('option')).not.toHaveCount(1, { timeout: 30_000 });
    await beds.selectOption({ index: 1 });

    for (const lookup of ['Referred by', 'Assigned Doctor', 'Chief Consultant', 'JMO/Media']) {
      await this.chooseDoctor(lookup, d.doctorSearch);
    }
  }

  /**
   * Submits the admission and returns whatever the app says back, so the caller can assert
   * on it. The ERP answers a save with a modal rather than by navigating, the same way the
   * registration wizard does.
   */
  async confirmAdmission(): Promise<string> {
    await this.createAdmission.click();
    const dialog = this.page.locator('.modal:visible, .mud-dialog, [role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 60_000 });
    return (await dialog.innerText()).replace(/\s+/g, ' ').trim();
  }
  /** Looks the patient up by UHID and waits for the Patient tab to fill itself in. */
  async searchByUhid(uhid: string): Promise<void> {
    await this.uhid.fill(uhid);
    await this.search.click();
    // The lookup is a round trip; the name arriving is what says it came back.
    await expect(this.fullName).not.toHaveValue('', { timeout: 60_000 });
  }

  /** Picks `option` in the native <select> labelled `label`, e.g. choose('Admitted to', 'HDU'). */
  async choose(label: string, option: string): Promise<void> {
    await this.select(label).selectOption({ label: option });
  }

  /**
   * Picks a doctor in one of the Admission Detail lookups - Referred by, Assigned Doctor,
   * Chief Consultant, JMO/Media. Each is a Radzen lookup: clicking it opens a panel with
   * its own search box and a DoctorCodeNo/DoctoName grid, and the doctor is clicked as a
   * row in that grid.
   *
   * The panel is rendered outside the field group, so it cannot be scoped to the control
   * it belongs to - only one opens at a time, and the visible one is that one.
   *
   * Returns the chosen row text, so a caller can assert on what it actually picked.
   */
  async chooseDoctor(label: string, term: string): Promise<string> {
    await this.group(label).locator('.rz-dropdown').click();

    const panel = this.page.locator('.rz-dropdown-panel:visible').first();
    await panel.locator('.rz-lookup-search input').fill(term);
    await panel.locator('.rz-lookup-search button').click();

    const row = panel.locator('tbody tr').filter({ hasText: term }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    const chosen = (await row.innerText()).replace(/\s+/g, ' ').trim();
    await row.click();
    await expect(panel).toBeHidden();
    return chosen;
  }

  /**
   * Types an amount into one of the payment boxes.
   *
   * fill() does not work on these: they are Blazorise numeric inputs, which re-format on
   * their own key handlers and snap a value set straight on the element back to "0.00".
   * Typing the digits is what the component actually listens for, and the blur is what
   * makes the Total Payment panel recalculate.
   */
  async enterAmount(label: string, value: string): Promise<void> {
    const box = this.field(label);
    await box.click();
    await this.page.keyboard.press('Control+A');
    await box.pressSequentially(value, { delay: 50 });
    await box.blur();
  }

  /**
   * Fills the card block on the Advance Payment tab. A POS has to be chosen before the
   * amount box exists at all - the app renders "Payment (Card)" only once the card has a
   * terminal behind it.
   */
  async payByCard(card: string, pos: string, amount: string, remarks: string): Promise<void> {
    await this.choose('Select Card', card);
    await this.choose('POS', pos);
    await this.enterAmount('Payment (Card)', amount);
    await this.cardRemarks.fill(remarks);
  }
  /**
   * The field group carrying `label`: one <div class="form-group"> holding a
   * <label class="form-label"> and its control. The page renders no <label for=...>, so
   * getByLabel resolves none of these.
   *
   * Matched on the visible group only. Every tab's markup stays in the DOM whether or not
   * its tab is showing, so "District" exists on both the Patient and the Contact Person
   * tab and "Remarks" labels four separate payment blocks.
   */
  group(label: string): Locator {
    return this.page
      .locator('div.form-group:visible')
      .filter({ has: this.page.locator(`label.form-label:text-is('${label}')`) });
  }

  /** The native <select> labelled `label`, e.g. select('Department'). */
  select(label: string): Locator {
    return this.group(label).locator('select.form-select');
  }

  /**
   * The input labelled `label`, e.g. field('BKash Payment').
   *
   * Visible inputs only: DOB is a flatpickr, which parks a hidden mirror input and a year
   * spinner in the same field group as the box a user actually types in.
   */
  field(label: string): Locator {
    return this.group(label).locator('input:visible');
  }

  async expectLoaded(): Promise<void> {
    await this.settleAuthorization(this.uhid);
    await expect(this.page).toHaveURL(new RegExp(this.path, 'i'));
    await expect(this.uhid).toBeVisible({ timeout: 30_000 });
    await expect(this.search).toBeVisible({ timeout: 30_000 });
  }
}
