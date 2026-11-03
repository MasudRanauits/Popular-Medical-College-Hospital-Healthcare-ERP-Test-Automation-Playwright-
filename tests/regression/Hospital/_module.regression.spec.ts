import { test, expect } from '../../../fixtures';
import {
  DischargedEditPage,
  HospitalGridPage,
  HospitalPatientScreenPage,
  HospitalScreenPage,
  HospitalWardScreenPage,
  HOSPITAL_MENU,
  hospitalArea,
  hospitalItem,
} from '../../../pages';
import { recentDischargedInvoice } from './_case-packs';

/**
 * Hospital module @regression - HOSP-MOD-001 ... HOSP-MOD-012.
 *
 * The cases that belong to the module rather than to any one menu. Everything else in this
 * folder is one file per drawer menu, named after the menu; this is the file for the
 * questions that only make sense across several of them at once.
 *
 * Two kinds of case live here.
 *
 * The drawer itself - that it offers all eighty screens, that it opens from the launcher,
 * that none of it is served to someone signed out.
 *
 * And the registers: one case holding a map of how the whole module behaves on some axis,
 * so that an accidental change shows up as one named failure rather than being discovered
 * by whoever automates the screen next. The toolbars of the eighteen setup grids, the five
 * different patient pickers, the screens that share a page title with another screen, the
 * payment buttons that are not gated. None of those can be asserted on a single screen,
 * and all of them are things this suite learned the hard way.
 *
 * Read-only throughout.
 */

test.describe('Hospital module @regression', () => {
  test('HOSP-MOD-001 the drawer lists every Hospital screen, and nothing else', async ({
    hospitalMenuPage,
  }) => {
    await hospitalMenuPage.openDrawer();

    const onScreen = await hospitalMenuPage.hrefs();
    const expected = HOSPITAL_MENU.map((item) => item.href);

    // Reported as two differences rather than as a failed equality, because "expected 80,
    // got 81" says nothing and this says which entry moved.
    const missing = expected.filter((href) => !onScreen.includes(href));
    const extra = onScreen.filter((href) => !expected.includes(href));
    expect(missing, 'menu entries this suite covers that the drawer no longer has').toEqual([]);
    expect(extra, 'drawer entries this suite does not cover - add them to HOSPITAL_MENU').toEqual(
      []
    );

    // As a set, deliberately, and not as a sequence. HOSPITAL_MENU is kept grouped by the
    // part of the module each screen belongs to, because that grouping is what the per-menu
    // files are organised by. The drawer's own order is a different one - roughly by when
    // each screen was added - and pinning it here would catch a reshuffle nobody has asked
    // us to catch.
    expect(onScreen.length, 'entries in the Hospital drawer').toBe(expected.length);
  });

  test('HOSP-MOD-002 the drawer opens from the launcher tile, not only by deep link', async ({
    hospitalMenuPage,
  }) => {
    const dashboard = hospitalItem('Dashboard');

    await hospitalMenuPage.open(dashboard);

    await expect(hospitalMenuPage.page).toHaveURL(new RegExp(dashboard.href, 'i'));
    await new HospitalScreenPage(hospitalMenuPage.page, dashboard).expectLoaded();
  });

  test('HOSP-MOD-003 an unknown Hospital route is refused rather than rendered', async ({
    page,
  }) => {
    await page.goto('/hospital/no-such-screen-9912');

    // Whatever the shell does with it, the one thing it must not do is render a Hospital
    // screen.
    await expect(page.locator('h4.page-title')).toHaveCount(0, { timeout: 30_000 });
  });

  test('HOSP-MOD-004 two different menu entries never open the same screen twice', async () => {
    // A pure check on the register, no browser needed: two entries sharing an href means a
    // duplicated menu item, which is a menu bug whether or not the screen behind it works.
    const byHref = new Map<string, string[]>();
    for (const item of HOSPITAL_MENU) {
      byHref.set(item.href, [...(byHref.get(item.href) ?? []), item.label]);
    }
    const duplicates = [...byHref.entries()].filter(([, labels]) => labels.length > 1);
    expect(duplicates, 'menu entries pointing at the same route').toEqual([]);
  });

  test('HOSP-MOD-005 screens that share a page title are reported, not assumed', async () => {
    /**
     * Three pairs of screens render the same `h4.page-title` as each other:
     *
     *   OT Service Entry / OT Service Entry (Billing Dept)        - "OT SERVICE ENTRY"
     *   CONSULTANCY SERVICE / Consultant Service Entry (Billing)  - "IPD CONSULTANCY SERVICE"
     *   Edit Bed and Cabins (Discharged) / Edit Food and Beverage - "DISCHARGED CABIN CHARGE"
     *
     * The first two pairs are a ward screen and the billing department's copy of it, and
     * sharing a title is defensible. The third is not: Edit Food and Beverage announces
     * itself as "DISCHARGED CABIN CHARGE", which is the other screen's name, and a clerk
     * who lands there from the menu has nothing on screen telling them which of the two
     * they are editing.
     *
     * This pins the set, so a *new* collision shows up as a failure here. It is not
     * asserting that the ones below are correct - the Food and Beverage one is not.
     */
    const known = ['DISCHARGED CABIN CHARGE', 'IPD CONSULTANCY SERVICE', 'OT SERVICE ENTRY'];

    const counts = new Map<string, string[]>();
    for (const item of HOSPITAL_MENU) {
      if (!item.title) continue;
      counts.set(item.title, [...(counts.get(item.title) ?? []), item.label]);
    }
    const shared = [...counts.entries()]
      .filter(([, labels]) => labels.length > 1)
      .map(([title]) => title)
      .sort();

    expect(shared, 'screens sharing a page title').toEqual(known);
  });

  test('HOSP-MOD-006 each setup screen carries the toolbar it is supposed to carry', async ({
    page,
  }) => {
    /**
     * The register for a family that is not as uniform as it looks.
     *
     * Eighteen screens on one grid component, and no two toolbars the same. Eleven have the
     * page-size box and seven do not. Fifteen open a create dialog from "Add New"; three -
     * Service Packages, Package Sub-Items and Cabin Groups - add a row inline from "New"
     * and "Save" instead. Service Group, Cabin Groups and Package Sub-Items have no filter
     * box at all, so the only way to find a row on them is to read down the grid. The
     * filter that does exist is labelled "Search...", "Search" or "Search by name" by screen.
     *
     * None of that is a bug on its own; all of it is the kind of thing that changes by
     * accident. One case holding the whole map fails with the screen and the control named,
     * and is one edit to update when a toolbar legitimately changes.
     */
    test.setTimeout(900_000);

    const screens = [
      ...hospitalArea('setup'),
      hospitalItem('OT Rooms'),
      hospitalItem('OT Type'),
      hospitalItem('Anaesthesia Type'),
      hospitalItem('PROCEDURE WEIGHT'),
    ];

    const actual: Record<string, string> = {};
    for (const item of screens) {
      const screen = new HospitalGridPage(page, item);
      await screen.openGrid();

      const toolbar = await screen.toolbar();
      actual[item.label] = (Object.keys(toolbar) as (keyof typeof toolbar)[])
        .filter((control) => toolbar[control])
        .join(',');
    }

    expect(actual).toEqual({
      // Service Group is the one grid with no filter box of its own.
      'Service Group': 'pageSize,addNew,reload,export',
      'Master Service Group': 'search,addNew',
      'SERVICE HEADS': 'search,addNew,reload',
      'Service Packages': 'search,addNew',
      'Package Sub-Items': 'addNew',
      'Cabin Categories': 'search,addNew',
      Cabin: 'search,pageSize,addNew,reload,export',
      'Cabin Groups': '',
      'Cabin Charge Rule': 'search,pageSize,addNew,reload',
      Department: 'search,pageSize,addNew,reload,export',
      'Floor Setup': 'search,pageSize,addNew,reload,export',
      Areas: 'search,pageSize,addNew,reload,export',
      District: 'search,pageSize,addNew,reload,export',
      'Dynamic Form Category': 'search,pageSize,addNew,reload,export',
      'OT Rooms': 'search,pageSize,addNew,reload,export',
      'OT Type': 'search,pageSize,addNew,reload,export',
      'Anaesthesia Type': 'search,pageSize,addNew,reload,export',
      // The one OT master with no Export.
      'PROCEDURE WEIGHT': 'search,pageSize,addNew,reload',
    });
  });

  test('HOSP-MOD-007 one ward screen prints the lookup columns in its own order', async ({
    page,
  }) => {
    /**
     * A finding, pinned - small, and exactly the kind of thing that is never noticed and
     * then costs an afternoon.
     *
     * Seven of the eight ward screens print the Search Patient lookup as CabinNo, FullName,
     * InvoiceNo. IPD Medicine Return prints InvoiceNo, CabinNo, FullName. Same component,
     * same three columns, same patient list. A clerk moving between the screens reads the
     * first column as a bed on seven of them and as an admission number on the eighth.
     *
     * It is also a trap for anything automating these screens by column position, which is
     * how this suite first failed.
     */
    test.setTimeout(600_000);

    const wardScreens = [
      'Bed/Cabin Transfer',
      'PATIENT TRANSFER( INTER-DEPT )',
      'Package Transfer',
      'Hospital Patients Package Management',
      'IPD MEDICINE RETURN',
      'OT Service Entry',
      'OT Service Entry (Billing Dept)',
      'OT Info (NS)',
    ];

    const orders: Record<string, string> = {};
    for (const label of wardScreens) {
      const screen = new HospitalWardScreenPage(page, hospitalItem(label));
      await screen.openScreen();
      await screen.openLookup();
      orders[label] = (await screen.columns()).join(',');
    }

    const common = 'CabinNo,FullName,InvoiceNo';
    expect(orders).toEqual({
      'Bed/Cabin Transfer': common,
      'PATIENT TRANSFER( INTER-DEPT )': common,
      'Package Transfer': common,
      'Hospital Patients Package Management': common,
      'IPD MEDICINE RETURN': 'InvoiceNo,CabinNo,FullName',
      'OT Service Entry': common,
      'OT Service Entry (Billing Dept)': common,
      'OT Info (NS)': common,
    });
  });

  test('HOSP-MOD-008 the payment screens do not gate their Save the way Admission Cancel does', async ({
    page,
  }) => {
    /**
     * The inconsistency, pinned.
     *
     * Admission Cancel ships its button disabled and lets the pick enable it. The three
     * money screens do not: Advance Collection, Advance Return and Visitor Pass all render
     * Save live with no admission on the form and nothing in the panel.
     *
     * What that button then does with no patient is not something this suite is going to
     * find out - it is a live hospital's advance-payment screen. What can be said is that
     * the module gates its most destructive action and leaves its payment actions ungated,
     * in the same markup pattern on the same family of screens.
     */
    test.setTimeout(300_000);

    const ungated: string[] = [];

    for (const label of ['Advance Collection', 'Advance Return', 'Visitor Pass']) {
      const screen = new HospitalPatientScreenPage(page, hospitalItem(label));
      await screen.openScreen();

      const button = screen.action('Save');
      await expect(button, `${label} has no Save button`).toBeVisible();
      const classes = (await button.getAttribute('class')) ?? '';
      if (!classes.includes('disabled')) ungated.push(label);
    }

    expect(ungated.sort(), 'screens whose Save is live before an admission is picked').toEqual([
      'Advance Collection',
      'Advance Return',
      'Visitor Pass',
    ]);
  });

  test('HOSP-MOD-009 the module picks a patient five different ways', async () => {
    /**
     * The register this whole folder is shaped by.
     *
     * Every one of these screens acts on one admitted patient, and the module offers five
     * different controls for choosing them - two of which are the same Radzen lookup under
     * different labels, and two of which are labelled identically while being different
     * controls:
     *
     *   admission lookup   "Admission No" / "Invoice No" / "Adm.No", four columns
     *   ward lookup        "Search Patient", three columns, five to a page
     *   UHID lookup        "Admission No" / "Adm.No", seven columns keyed on the UHID
     *   bill picker        "PATIENT" on the change history, seven columns
     *   typed invoice      no picker at all, on the five discharged editors and Re-Admit
     *
     * None of this is broken; all of it is why a clerk moving between these screens has to
     * learn each one separately, and why this suite needed five page objects to drive what
     * is nominally one action.
     *
     * A register rather than a browser case: it pins the shape of the module so a sixth way
     * shows up here rather than being discovered by whoever automates it next.
     */
    const byControl: Record<string, string[]> = {
      'admission lookup': [
        'Admission Cancel',
        'Advance Collection',
        'Advance Return',
        'Visitor Pass',
        'Extra Cabin Allot/Cancel',
        'Manual Cabin Charge',
        'Billing Dashboard',
        'DRAFT BILL',
        'IPD Service Dashboard',
        'IPD DUE COLLECTION',
        'EDIT DISCHARGED BILL SUMMARY',
        'Discharged Patients All Service',
        'Edit/Delete Services',
      ],
      'ward lookup': [
        'Bed/Cabin Transfer',
        'PATIENT TRANSFER( INTER-DEPT )',
        'Package Transfer',
        'Hospital Patients Package Management',
        'IPD MEDICINE RETURN',
        'OT Service Entry',
        'OT Service Entry (Billing Dept)',
        'OT Info (NS)',
      ],
      'UHID lookup': [
        'IPD Service Entry (Billing Dept)',
        'Consultant Service Entry (Billing Dept)',
      ],
      'bill picker': ['IPD Bill Change History'],
      'typed invoice number': [
        'EDIT DISCHARGED IPD SERVICES',
        'EDIT DISCHARGED CONSULTANT SERVICES',
        'EDIT DISCHARGED OT SERVICES',
        'Edit Bed and Cabins ( Discharged )',
        'Edit Food and Beverage ( Discharged)',
        'Re-Admit',
      ],
    };

    // Every screen named is a real menu entry: hospitalItem throws if it is not, so this
    // register cannot drift away from the drawer without failing.
    for (const labels of Object.values(byControl)) {
      for (const label of labels) expect(hospitalItem(label).label).toBe(label);
    }

    expect(Object.keys(byControl), 'ways to pick a patient').toHaveLength(5);
    expect(byControl['admission lookup'].length, 'screens on the admission lookup').toBe(13);
    expect(byControl['typed invoice number'].length, 'screens with no picker at all').toBe(6);
  });

  test('HOSP-MOD-010 every discharged editor loads the same bill the same way', async ({ page }) => {
    /**
     * The five discharged editors split one bill between them - services, consultants, OT,
     * beds, food - so the same invoice number has to be accepted by all five. One that
     * silently refused a number the others accept would send a clerk hunting for a second
     * number that does not exist.
     *
     * Not every screen holds lines for every patient: a patient who never went to theatre
     * has no OT services, and that is data rather than a defect. So what is asserted across
     * all five is that the patient loads, and that they agree on who it is.
     */
    test.setTimeout(600_000);

    const invoice = await recentDischargedInvoice(page);
    test.skip(invoice === '', 'no patient has been discharged in the last thirty days');

    const editors = [
      'EDIT DISCHARGED IPD SERVICES',
      'EDIT DISCHARGED CONSULTANT SERVICES',
      'EDIT DISCHARGED OT SERVICES',
      'Edit Bed and Cabins ( Discharged )',
      'Edit Food and Beverage ( Discharged)',
    ];

    const loaded: Record<string, string> = {};
    for (const label of editors) {
      const screen = new DischargedEditPage(page, hospitalItem(label));
      await screen.openScreen();
      loaded[label] = await screen.loadInvoice(invoice);
    }

    const refused = Object.entries(loaded)
      .filter(([, name]) => name === '')
      .map(([label]) => label);
    expect(refused, `screens that would not load invoice ${invoice}`).toEqual([]);

    const names = [...new Set(Object.values(loaded))];
    expect(names, `the five editors disagree about who invoice ${invoice} belongs to`).toHaveLength(
      1
    );
  });
});

test.describe('Hospital module @regression signed out', () => {
  // Must not inherit the session tests/auth.setup.ts saves.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('HOSP-MOD-011 a Hospital route is not served to an unauthenticated visitor', async ({
    page,
    loginPage,
  }) => {
    // Admission Cancel rather than a dashboard: if any route in the module were going to be
    // left unguarded, the read-only one would be the forgivable one.
    await page.goto(hospitalItem('Admission Cancel').href);

    await expect(page).toHaveURL(/\/Account\/Login/);
    await loginPage.expectLoaded();
    await expect(page.locator('h4.page-title')).toHaveCount(0);
  });

  test('HOSP-MOD-012 the Hospital drawer is not rendered signed out', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/Account\/Login/);
    await expect(page.locator('aside.mud-drawer a.mud-nav-link')).toHaveCount(0);
    await expect(page.getByText('Hospital', { exact: true })).toHaveCount(0);
  });
});
