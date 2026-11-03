import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';
import { gotoTolerant, waitForAppReady } from '../utils/helpers';

/** Which part of the Hospital module a screen belongs to. Drives the suite groupings. */
export type HospitalArea = 'patient' | 'billing' | 'service' | 'ot' | 'discharged' | 'setup';

/** One entry of the Hospital module's drawer menu. */
export interface HospitalMenuItem {
  /** The drawer link's own text, as the markup spells it. Case is CSS, not content. */
  label: string;
  /** The drawer link's href, and the route the screen is deep-linked by. */
  href: string;
  /**
   * The screen's own `h4.page-title`, spelled as the markup carries it.
   *
   * Five screens render no page title at all - `anchor` stands in for it there.
   *
   * It is often not the menu label: "Bed/Cabin Transfer" opens "CABIN TRANSFER", "Re-Admit"
   * opens "BRING DISCHARGED PATIENT LIVE", "DIET INDENT" opens "FOOD INDENT". Every one of
   * these was read off the running app rather than guessed, which is the only way to tell a
   * deliberately renamed screen from a route that has started rendering the wrong one.
   */
  title?: string;
  /**
   * What says the screen rendered, where there is no page title: a tab or a column header.
   * Matched as text, anywhere on the page.
   */
  anchor?: string;
  area: HospitalArea;
  /** Marked on the screens the smoke suite checks. See tests/smoke/hospital.smoke.spec.ts. */
  smoke?: boolean;
}

/**
 * Every item in the Hospital module's drawer, grouped by the part of the module it belongs
 * to rather than by the order the drawer happens to list them in.
 *
 * Eighty of them, read off the live ERP (v5.0.1) rather than written from a specification,
 * so this list is itself the assertion: a drawer that grows, loses or renames an entry
 * fails HOSP-NAV-001 with the difference named, and a route that stops rendering its own
 * screen fails its own case in the HOSP-NAV series.
 *
 * The grouping is what the sibling suites are built on - `hospitalArea('setup')` is how the
 * setup-grid suite knows its fourteen screens - which is why it wins over drawer order here.
 *
 * Four entries leave the module: Medicine Indent is a Pharmacy route, DIET INDENT a Canteen
 * one, OT Assistant Payment an /ipd one and Acknowledge Hand Over Patients an EMR one. They
 * are in this list because they are in this menu - a nurse reaching them from here is using
 * the Hospital module, whatever the route says.
 */
export const HOSPITAL_MENU: readonly HospitalMenuItem[] = [
  // --- patient flow ---------------------------------------------------------------------
  { label: 'Dashboard', href: '/hospital/patientlist-dashboard', title: 'DASHBOARD', area: 'patient', smoke: true },
  // The admission wizard renders its tab strip, not a page title.
  { label: 'New Admission', href: '/hospital/patientadmission', anchor: 'ADMISSION ONE', area: 'patient', smoke: true },
  { label: 'Cabin dashboard', href: '/hospital/cabin-dashboard', title: 'CABIN DASHBOARD', area: 'patient', smoke: true },
  { label: 'Nurse Station', href: '/hospital/nurse-station', title: 'NURSE STATION', area: 'patient', smoke: true },
  { label: 'Bed/Cabin Transfer', href: '/hospital/Cabin-Transfer', title: 'CABIN TRANSFER', area: 'patient', smoke: true },
  { label: 'Cabin Release', href: '/hospital/cabin-release', title: 'CABIN RELEASE', area: 'patient' },
  { label: 'Nurses Duty', href: '/hospital/Nurses-Duty', title: 'NURSES DUTY', area: 'patient' },
  { label: 'Visitor Pass', href: '/hospital/visiting-card', title: 'VISITING CARD', area: 'patient' },
  // No page title: this one puts its name in a card header instead. Also the one route in
  // the module seen to answer Access Denied for real - twice in a row, to an administrator
  // who has it in their menu - and then to load cleanly on every attempt since. If this
  // case fails on a denial, that is what it is, and it is intermittent rather than a
  // permission that was never granted.
  { label: 'Edit Patient Basic Info', href: '/hospital/patientinfoedit-dashboard', anchor: 'BASIC INFO', area: 'patient' },
  { label: 'PATIENT TRANSFER( INTER-DEPT )', href: '/hospital/inter-dept-transfer', title: 'INTER-DEPARTMENT TRANSFER', area: 'patient' },
  { label: 'Admission Cancel', href: '/hospital/admission-cancel', title: 'ADMISSION CANCEL', area: 'patient', smoke: true },
  { label: 'Extra Cabin Allot/Cancel', href: '/hospital/extra-cabin', title: 'EXTRA CABINS', area: 'patient' },
  { label: 'Re-Admit', href: '/hospital/bring-discharged-patient-live', title: 'BRING DISCHARGED PATIENT LIVE', area: 'patient' },
  { label: 'House Keeping Dashboard', href: '/hospital/house-keeping-dashboard', title: 'HOUSE KEEPING DASHBOARD', area: 'patient' },
  { label: 'Acknowledge Hand Over Patients', href: '/emr/hand-over-list-dashboard', title: 'ACKNOWLEDGE HAND OVER PATIENTS', area: 'patient' },

  // --- billing --------------------------------------------------------------------------
  { label: 'Billing Dashboard', href: '/hospital/hospital-billing-dashboard', title: 'BILLING DASHBOARD', area: 'billing', smoke: true },
  { label: 'Billing Dashboard(Counter)', href: '/hospital/billing-dashboard-counter', title: 'BILLING DASHBOARD (COUNTER)', area: 'billing' },
  { label: 'Billing Dashboard(Office)', href: '/hospital/billing-dashboard-office', title: 'BILLING DASHBOARD (OFFICE)', area: 'billing' },
  { label: 'DRAFT BILL', href: '/hospital/hospital-billing', title: 'DRAFT BILL', area: 'billing', smoke: true },
  { label: 'FINAL BILL', href: '/hospital/pre-final-billing', title: 'FINAL BILL', area: 'billing', smoke: true },
  { label: 'IPD Bill Change History', href: '/hospital/ipd-bill-change-history', title: 'IPD BILL CHANGE HISTORY', area: 'billing' },
  { label: 'Advance Dashboard', href: '/hospital/advance-payment-dashboard', title: 'ADVANCE DASHBOARD', area: 'billing' },
  { label: 'Advance Collection', href: '/hospital/advance-payment', title: 'ADVANCE PAYMENT', area: 'billing', smoke: true },
  { label: 'Advance Return', href: '/hospital/advance-return', title: 'ADVANCE RETURN', area: 'billing' },
  { label: 'Advance Return Dashboard', href: '/hospital/advance-return-dashboard', title: 'ADVANCE RETURN DASHBOARD', area: 'billing' },
  { label: 'IPD DUE COLLECTION', href: '/hospital/ipd-due-collection', title: 'IPD DUE COLLECTION', area: 'billing' },
  { label: 'IPD Due Collection Dashboard', href: '/hospital/ipd-due-collection-dashboard', title: 'IPD DUE COLLECTION DASHBOARD', area: 'billing' },
  { label: 'Patient Dashboard For Billing Dept', href: '/hospital/patient-dashboard-for-billing-dept', title: 'PATIENT DASHBOARD FOR BILLING DEPARTMENT', area: 'billing' },
  { label: 'Edit/Delete Services', href: '/hospital/edit-hospital-bill-details', title: 'EDIT AND CANCEL HOSPITAL BILL DETAILS', area: 'billing' },
  { label: 'Manual Cabin Charge', href: '/hospital/manual-cabin-day', title: 'MANUAL CABIN DAY', area: 'billing' },
  { label: 'Mpo Change History', href: '/hospital/mpo-change-history', title: 'MPO CHANGE HISTORY', area: 'billing' },
  // These two render a tab strip instead of a page title: ADMITTED PATIENT / DISCHARGED PATIENT.
  { label: 'Doctor Transfer History', href: '/hospital/doctor-transfer-history', anchor: 'DOCTOR CODE', area: 'billing' },
  { label: 'Patient Package History', href: '/hospital/patient-package-history', anchor: 'ADMITTED PATIENT', area: 'billing' },
  { label: 'Package Transfer', href: '/hospital/package-transfer', title: 'PACKAGE TRANSFER', area: 'billing' },
  { label: 'Hospital Patients Package Management', href: '/hospital/patient-package-management', title: 'PACKAGE MANAGEMENT', area: 'billing' },

  // --- services ---------------------------------------------------------------------------
  { label: 'IPD Service Entry', href: '/hospital/ipd-service-record', title: 'IPD SERVICE', area: 'service', smoke: true },
  { label: 'IPD Service Entry (Billing Dept)', href: '/hospital/ipd-service-record-extra', title: 'IPD SERVICE ENTRY (BILLING DEPT)', area: 'service' },
  { label: 'IPD Service Entry Dashboard', href: '/hospital/ipd-service-entry-dashboard', title: 'IPD SERVICE ENTRY DASHBOARD', area: 'service' },
  { label: 'IPD Service Dashboard', href: '/hospital/ipd-service-details-dashboard', title: 'IPD SERVICE DASHBOARD', area: 'service' },
  { label: 'CONSULTANCY SERVICE', href: '/hospital/ipd-consultancy-service', title: 'IPD CONSULTANCY SERVICE', area: 'service', smoke: true },
  { label: 'Consultant Service Entry (Billing Dept)', href: '/hospital/ipd-consultancy-service-extra', title: 'IPD CONSULTANCY SERVICE', area: 'service' },
  { label: 'Investigation Indent', href: '/hospital/ipdinvestigation-indent', title: 'IPD INVESTIGATION INDENT', area: 'service' },
  { label: 'Investigation Indent Dashboard', href: '/hospital/ipdinvestigation-indent-dashboard', title: 'INVESTIGATION INDENT DASHBOARD', area: 'service' },
  // Pharmacy's own route, reached from the Hospital drawer. Tabs, no page title.
  { label: 'Medicine Indent', href: '/pharmacy/medicine-indent', anchor: 'ADD INDENT', area: 'service' },
  { label: 'IPD MEDICINE RETURN', href: '/hospital/medicine-return-indent', title: 'MEDICINE RETURN INDENT', area: 'service' },
  // Canteen's own route; the menu calls it DIET INDENT and the screen calls itself FOOD INDENT.
  { label: 'DIET INDENT', href: '/canteen/canteen-indent', title: 'FOOD INDENT', area: 'service', smoke: true },
  { label: 'IPD Package Service Mapping', href: '/hospital/ipd-package-service', title: 'IPD PACKAGE SERVICE', area: 'service' },

  // --- operating theatre --------------------------------------------------------------------
  { label: 'OT Service Entry', href: '/hospital/addedit-otservice', title: 'OT SERVICE ENTRY', area: 'ot' },
  { label: 'OT Service Entry (Billing Dept)', href: '/hospital/addedit-otservice-extra', title: 'OT SERVICE ENTRY', area: 'ot' },
  { label: 'OT Info (NS)', href: '/hospital/addedit-otinfo-nursestation', title: 'OT INFO NURSE STATION', area: 'ot' },
  { label: 'OT Room Request', href: '/hospital/otroom-booking-request', title: 'OTROOM BOOKING REQUEST', area: 'ot' },
  { label: 'OT Room Booking Request Dashboard', href: '/hospital/otroom-booking-request-dashboard', title: 'OTROOM BOOKING REQUEST DASHBOARD', area: 'ot' },
  { label: 'OT Calendar', href: '/hospital/otroom-book', title: 'OTROOM BOOK', area: 'ot' },
  { label: 'OT Rooms', href: '/hospital/OTRoom', title: 'OT ROOM', area: 'ot' },
  { label: 'OT Type', href: '/hospital/OTType', title: 'OT TYPE', area: 'ot' },
  { label: 'Anaesthesia Type', href: '/hospital/AnaesthesiaType', title: 'ANAESTHESIA TYPE', area: 'ot' },
  { label: 'PROCEDURE WEIGHT', href: '/hospital/Procedure-Weight', title: 'PROCEDURE WEIGHT', area: 'ot' },
  { label: 'OT Assistant Payment', href: '/ipd/ot-assistant-payment', title: 'OT ASSISTANT PAYMENT', area: 'ot' },

  // --- discharged-patient corrections ---------------------------------------------------------
  { label: 'Discharged Patients All Service', href: '/hospital/discharged-hospital-billing-dashboard', title: 'DISCHARGED PATIENT DASHBOARD', area: 'discharged' },
  { label: 'EDIT DISCHARGED IPD SERVICES', href: '/hospital/ipd-discharged-service-dashboard', title: 'DISCHARGED PATIENT IPDSERVICE DASHBOARD', area: 'discharged' },
  { label: 'EDIT DISCHARGED CONSULTANT SERVICES', href: '/hospital/discharged-consultation-dashboard', title: 'EDIT DISCHARGED CONSULTANT SERVICES', area: 'discharged' },
  { label: 'EDIT DISCHARGED OT SERVICES', href: '/hospital/discharged-otservice-dashboard', title: 'EDIT DISCHARGED OT SERVICES', area: 'discharged' },
  { label: 'EDIT DISCHARGED BILL SUMMARY', href: '/hospital/edit-discharged-patient-bill-item', title: 'EDIT DISCHARGED BILL SUMMARY', area: 'discharged' },
  // These two render the same page title as each other - a finding, reported by HOSP-NAV-085.
  { label: 'Edit Bed and Cabins ( Discharged )', href: '/hospital/discharged-cabin-bed-dashboard', title: 'DISCHARGED CABIN CHARGE', area: 'discharged' },
  { label: 'Edit Food and Beverage ( Discharged)', href: '/hospital/discharged-food-beverage', title: 'DISCHARGED CABIN CHARGE', area: 'discharged' },
  { label: 'Print Discharged Patient admission form', href: '/hospital/print-discharged-patient-admission', title: 'PRINT ADMISSION FORM', area: 'discharged' },

  // --- setup / masters -------------------------------------------------------------------------
  { label: 'Service Group', href: '/hospital/service-group', title: 'SERVICE GROUP', area: 'setup' },
  { label: 'Master Service Group', href: '/hospital/master-service-group', title: 'MASTER SERVICE GROUP', area: 'setup' },
  { label: 'SERVICE HEADS', href: '/hospital/service-executing', title: 'SERVICE EXECUTING', area: 'setup' },
  { label: 'Service Packages', href: '/hospital/service-package', title: 'SERVICE PACKAGE', area: 'setup' },
  { label: 'Package Sub-Items', href: '/hospital/service-package-subitems', title: 'PACKAGE ITEM', area: 'setup' },
  { label: 'Cabin Categories', href: '/hospital/cabin-categories', title: 'CABIN CATEGORIES', area: 'setup' },
  { label: 'Cabin', href: '/hospital/cabin', title: 'CABIN', area: 'setup' },
  { label: 'Cabin Groups', href: '/hospital/cabin-groups', title: 'CABIN GROUPS', area: 'setup' },
  { label: 'Cabin Charge Rule', href: '/hospital/Cabin-ChargeRule', title: 'CABIN CHARGE RULE', area: 'setup' },
  { label: 'Department', href: '/hospital/department', title: 'DEPARTMENT', area: 'setup' },
  { label: 'Floor Setup', href: '/hospital/floor', title: 'FLOOR', area: 'setup' },
  { label: 'Areas', href: '/hospital/areas', title: 'AREA', area: 'setup' },
  { label: 'District', href: '/hospital/district', title: 'DISTRICT', area: 'setup' },
  { label: 'Dynamic Form Category', href: '/hospital/dynamic-form-category', title: 'DYNAMIC FORM CATEGORY', area: 'setup' },
];

/** The menu items in `area`, for a suite that covers one part of the module. */
export function hospitalArea(area: HospitalArea): HospitalMenuItem[] {
  return HOSPITAL_MENU.filter((item) => item.area === area);
}

/** Looks a menu item up by its drawer label. Throws rather than returning undefined. */
export function hospitalItem(label: string): HospitalMenuItem {
  const item = HOSPITAL_MENU.find((entry) => entry.label === label);
  if (!item) throw new Error(`No Hospital menu item labelled "${label}".`);
  return item;
}

/** Escapes a literal for use inside a RegExp - page titles carry ( ), / and &. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The Hospital module's drawer, and the launcher tile that opens it.
 *
 * Eighty screens sit behind one tile, which is why this is its own page object rather than
 * a method on HomePage: the drawer is the module's index, and HOSPITAL_MENU above is the
 * only written-down record of what that index is supposed to contain.
 */
export class HospitalMenuPage extends BasePage {
  protected readonly path = '/';

  /** The launcher tile, matched exactly - see HomePage.module for why exactness matters. */
  static readonly TILE = 'Hospital';

  readonly drawer: Locator;
  readonly links: Locator;
  /** The appbar's hamburger - the only way into the drawer below the md breakpoint. */
  readonly drawerToggle: Locator;

  constructor(page: Page) {
    super(page);
    this.drawer = page.locator('aside.mud-drawer');
    this.links = this.drawer.locator('a.mud-nav-link[href]');
    this.drawerToggle = page.locator('header.mud-appbar button.mud-icon-button').first();
  }

  /** The drawer link for `item`, located by href - labels repeat across modules. */
  link(item: HospitalMenuItem): Locator {
    return this.drawer.locator(`a.mud-nav-link[href="${item.href}"]`);
  }

  /**
   * Opens the launcher and clicks the Hospital tile, leaving the module's menu loaded.
   *
   * Waits for the menu to be *attached*, not visible, and that distinction is the whole
   * reason this does not go through BasePage.clickUntilVisible. Below MudBlazor's md
   * breakpoint the drawer renders closed - the links are in the DOM, sized and positioned
   * off to the left, and `toBeVisible` is false for every one of them. A visibility-based
   * wait therefore works perfectly on a laptop and times out on every phone and tablet
   * case, which is exactly how it failed.
   *
   * What "open" means at a given width is `isDrawerOpen`, and it is the responsive suite's
   * subject rather than a precondition of loading the menu.
   *
   * What it waits for is one *named* Hospital route, not merely "a nav link". The drawer is
   * never empty - it carries the shell's own couple of links before any module is opened,
   * and keeps the previous module's menu while the next one is being fetched - so a wait on
   * `links.first()` is satisfied immediately and by the wrong menu. That is not theoretical:
   * it let the smoke suite read a two-entry drawer and report the Hospital module as having
   * lost seventy-eight screens.
   *
   * The retry is still needed for the reason BasePage gives: a tile click that lands before
   * Blazor has wired the handler is swallowed, and while the host is answering 429 the
   * circuit never starts at all and the page has to be fetched again.
   */
  async openDrawer(attempts = 3): Promise<void> {
    await this.goto();
    await expect(this.page.locator('.his-tenant-name')).toBeVisible({ timeout: 30_000 });

    // Any Hospital route would do as the marker; the dashboard is the first entry and the
    // one the module is least likely to lose.
    const marker = this.link(HOSPITAL_MENU[0]);

    for (let attempt = 1; attempt <= attempts; attempt++) {
      await this.page
        .getByText(HospitalMenuPage.TILE, { exact: true })
        .first()
        .click()
        .catch(() => {});

      const loaded = await marker
        .waitFor({ state: 'attached', timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
      if (loaded) return;

      if (attempt < attempts) {
        await gotoTolerant(this.page, this.path);
        await waitForAppReady(this.page);
      }
    }

    await expect(marker, 'the Hospital menu never loaded into the drawer').toBeAttached({
      timeout: 30_000,
    });
  }

  /**
   * Every href the drawer is carrying right now, in the order it lists them.
   *
   * Normalised to a leading slash: one entry - Patient Package History - is authored as a
   * relative href, which resolves the same for the router and would otherwise read as a
   * missing item against HOSPITAL_MENU.
   */
  async hrefs(): Promise<string[]> {
    // Attached rather than visible, for the reason openDrawer gives: a closed drawer still
    // carries every link, and this reads the menu rather than what is on screen.
    await expect(this.links.first()).toBeAttached({ timeout: 30_000 });
    const hrefs = await this.links.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('href') ?? '')
    );
    return hrefs.map((href) => (href.startsWith('/') ? href : `/${href}`));
  }

  /** Opens the drawer and navigates to `item` by clicking its link, the way a user does. */
  async open(item: HospitalMenuItem): Promise<void> {
    await this.openDrawer();
    const link = this.link(item);
    await expect(link, `no drawer link for "${item.label}"`).toBeAttached({ timeout: 30_000 });

    // Opened first where the drawer is collapsed - below the md breakpoint the links are
    // off-screen and a click on one would be a click on nothing.
    if (!(await this.isDrawerOpen())) {
      await this.drawerToggle.click();
      await expect(link).toBeVisible({ timeout: 20_000 });
    }

    await link.click();
    await waitForAppReady(this.page);
  }

  /** Whether the drawer is open. Below the md breakpoint it starts closed - HOSP-RWD-001. */
  async isDrawerOpen(): Promise<boolean> {
    const classes = (await this.drawer.first().getAttribute('class')) ?? '';
    return classes.includes('mud-drawer--open');
  }

  /**
   * The scrim MudBlazor lays over the page while the drawer is open below the breakpoint.
   *
   * It is also how the drawer is closed there. The hamburger opens it and then sits *under*
   * this overlay, so a second click on the hamburger is intercepted and times out - which
   * is not a bug, it is what a modal drawer is. Tapping the page beside the drawer is the
   * gesture, and this is that element.
   */
  get drawerScrim(): Locator {
    return this.page.locator('.mud-overlay').first();
  }

  /** Closes the drawer however this width closes it: the scrim if there is one, else the toggle. */
  async closeDrawer(): Promise<void> {
    if (!(await this.isDrawerOpen())) return;
    if ((await this.drawerScrim.count()) > 0) {
      await this.drawerScrim.click();
    } else {
      await this.drawerToggle.click();
    }
  }
}

/**
 * Any one Hospital screen, addressed by its menu entry.
 *
 * What all eighty screens have in common and nothing more: the route, the `h4.page-title`
 * the shell paints above the screen, and the Blazor NotAuthorized page that sometimes shows
 * up in front of it. The screen-family page objects in this folder extend this one.
 *
 * Why the page title is the landmark: it is the one element the shell renders for every
 * screen, it carries that screen's own name, and it arrives only once the Blazor circuit has
 * rendered the route - so waiting for it is waiting for the real page rather than for the
 * prerendered NotAuthorized template that beats it to the screen. BasePage.settleAuthorization
 * describes that race; it is why a bare goto plus isVisible reported four of these eighty
 * routes as Access Denied when, waited out properly, all eighty load.
 */
export class HospitalScreenPage extends BasePage {
  protected readonly path: string;

  readonly item: HospitalMenuItem;

  constructor(page: Page, item: HospitalMenuItem) {
    super(page);
    this.item = item;
    this.path = item.href;
  }

  /**
   * The screen's own title bar.
   *
   * `.first()` is not defensive: Discharged Patients All Service nests four sub-panels that
   * each carry a page title of their own, and the screen's is the outermost.
   */
  get pageTitle(): Locator {
    return this.page.locator('h4.page-title').first();
  }

  /** Whatever says this screen rendered - its page title, or the anchor standing in for one. */
  get landmark(): Locator {
    if (this.item.title) return this.pageTitle;
    return this.page.getByText(this.item.anchor!, { exact: false }).first();
  }

  /** Opens the route directly and waits out the NotAuthorized flash. */
  async open(): Promise<void> {
    await gotoTolerant(this.page, this.path);
    await waitForAppReady(this.page);
    await this.settleAuthorization(this.landmark);
  }

  /**
   * Asserts the screen is the one its menu entry promises.
   *
   * Three things, in the order they tell you most: the landmark is up, the title says what
   * the menu entry says it will, and the route was not answered with Access Denied. The
   * denial check comes last because by the time the landmark is up a prerender denial is
   * long gone - it is there for the case where the landmark is up *and* a denial is still
   * on screen, which is what a half-authorised route looks like.
   */
  async expectLoaded(): Promise<void> {
    await expect(this.landmark, `"${this.item.label}" never rendered`).toBeVisible({
      timeout: 60_000,
    });
    if (this.item.title) {
      await expect(this.pageTitle).toHaveText(
        new RegExp(`^\\s*${escapeRegExp(this.item.title)}\\s*$`, 'i')
      );
    }
    await expect(this.accessDenied).toBeHidden();
  }

  /** Whether the document is wider than the window - the one thing a layout must never be. */
  async horizontalOverflow(): Promise<{
    overflows: boolean;
    scrollWidth: number;
    clientWidth: number;
  }> {
    const { scrollWidth, clientWidth } = await this.page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    return { overflows: scrollWidth > clientWidth, scrollWidth, clientWidth };
  }
}
