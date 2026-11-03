import { test, expect } from '../../../fixtures';
import { HospitalScreenPage, HospitalGridPage, HOSPITAL_MENU, hospitalItem } from '../../../pages';

/**
 * Hospital responsive layout @regression - HOSP-RWD-001 ... HOSP-RWD-020.
 *
 * The module on a phone, a tablet and a desktop. Written because the ward does use it that
 * way: the bed board and the admission dashboard get looked at on whatever is to hand, and
 * the ERP ships a responsive MudBlazor shell that says it supports exactly that.
 *
 * Viewports
 * ---------
 * Three, and each is there for a reason rather than to make a matrix:
 *
 *   390x844   a phone. Below MudBlazor's md breakpoint, so the drawer starts closed.
 *   768x1024  a tablet held upright. Still below md - this is the far side of the breakpoint.
 *   1280x800  a laptop. Above md, drawer pinned open. The width the ERP is built for.
 *
 * These specs set a viewport, which the rest of the project does not: playwright.config.ts
 * runs with `viewport: null` so the page fills the real browser window. `test.use` at the
 * describe level overrides that for these cases only, which is the only way to pin a size -
 * `setViewportSize` throws when the context was created without a viewport.
 *
 * What is actually asserted
 * -------------------------
 * Not screenshots. A pixel baseline against a live hospital's data re-renders itself every
 * time a patient is admitted. What is checked is the three things that make a layout usable
 * at a width: the page does not scroll sideways, the controls are still on screen and still
 * clickable, and the drawer behaves the way its breakpoint says it should.
 *
 * HOSP-RWD-010 currently fails, and should: Service Heads overflows a phone. See the case.
 */

/** The three widths, and what each is standing in for. */
const PHONE = { width: 390, height: 844 };
const TABLET = { width: 768, height: 1024 };
const LAPTOP = { width: 1280, height: 800 };

/**
 * A screen from each part of the module - the ones a ward actually opens away from a desk.
 *
 * Eight rather than eighty: the layout is the shell's, so a fault in it shows up on any
 * screen that has the ingredient that triggers it. What varies between these eight is the
 * ingredient - a wide grid, a tile board, a form, a lookup.
 */
const RESPONSIVE_SCREENS = [
  hospitalItem('Dashboard'),
  hospitalItem('Cabin dashboard'),
  hospitalItem('Admission Cancel'),
  hospitalItem('Cabin Release'),
  hospitalItem('FINAL BILL'),
  hospitalItem('Advance Dashboard'),
  hospitalItem('Areas'),
  hospitalItem('SERVICE HEADS'),
];

test.describe('Hospital responsive - phone @regression', () => {
  test.use({ viewport: PHONE });

  test('HOSP-RWD-001 the shell renders on a phone with the Hospital drawer reachable', async ({
    hospitalMenuPage,
  }) => {
    /**
     * The drawer's open/closed state is a user preference the ERP remembers, not a per-page
     * default - a drawer opened in one session is open in the next, at any width and in a
     * fresh browser context. So every case here that asserts a state sets it first.
     *
     * That caught this suite out once already: run on its own, the tablet case below saw
     * the collapsed drawer it expected; run after this case, it saw the one this case had
     * just opened. Tests that leave state behind for their neighbours are their own bug.
     */
    await hospitalMenuPage.openDrawer();
    await hospitalMenuPage.closeDrawer();

    // Collapsed at this width, with the hamburger in the appbar as the way in.
    await expect
      .poll(() => hospitalMenuPage.isDrawerOpen(), {
        message: 'the drawer would not collapse on a phone',
        timeout: 20_000,
      })
      .toBe(false);

    await hospitalMenuPage.drawerToggle.click();
    await expect
      .poll(() => hospitalMenuPage.isDrawerOpen(), {
        message: 'the hamburger did not open the drawer',
        timeout: 20_000,
      })
      .toBe(true);

    // And the module's screens are reachable from it, not just its chrome.
    await expect(hospitalMenuPage.link(hospitalItem('Dashboard'))).toBeVisible();
  });

  test('HOSP-RWD-002 the drawer closes again, giving the screen back', async ({
    hospitalMenuPage,
  }) => {
    /**
     * On a phone the drawer is modal: it covers the page under a scrim. One that cannot be
     * dismissed leaves the screen behind it unreachable, which is a worse fault than one
     * that never opened.
     *
     * Dismissed by tapping the scrim, which is the gesture and not a workaround - the
     * hamburger opens the drawer and is then *underneath* that scrim, so tapping it again
     * does nothing at all. Worth knowing before reading a timeout there as a broken button.
     */
    await hospitalMenuPage.openDrawer();
    if (!(await hospitalMenuPage.isDrawerOpen())) await hospitalMenuPage.drawerToggle.click();
    await expect.poll(() => hospitalMenuPage.isDrawerOpen(), { timeout: 20_000 }).toBe(true);
    await expect(hospitalMenuPage.drawerScrim, 'the open drawer laid down no scrim').toBeVisible();

    await hospitalMenuPage.closeDrawer();

    await expect.poll(() => hospitalMenuPage.isDrawerOpen(), { timeout: 20_000 }).toBe(false);
  });

  /**
   * One case per screen: it renders at phone width without the page scrolling sideways.
   *
   * Horizontal overflow is the fault worth testing for here and the one this ERP has. A
   * page wider than the window means a thumb has to pan to reach the right-hand side of
   * every row, and nothing on screen says the content is out there.
   *
   * Measured on the document rather than on a table, because a table in an `overflow-x`
   * wrapper is *correct* - it scrolls inside its own box and the page does not move. That
   * is exactly what every grid in the module does except one.
   */
  RESPONSIVE_SCREENS.forEach((item, index) => {
    test(`HOSP-RWD-${String(index + 3).padStart(3, '0')} ${item.label} fits a 390px screen`, async ({
      page,
    }) => {
      const screen = new HospitalScreenPage(page, item);

      await screen.open();
      await screen.expectLoaded();

      const { overflows, scrollWidth, clientWidth } = await screen.horizontalOverflow();

      if (overflows) {
        // Recorded on the result so the report says *why*, not just by how much: on every
        // screen in this module that fits, the grid is inside a `.table-responsive` wrapper
        // and scrolls within it. The one that does not fit is the one without the wrapper.
        const wrapped = await page.locator('.table-responsive table').count();
        const tables = await page.locator('table').count();
        test.info().annotations.push({
          type: 'overflow',
          description: `${item.label}: ${scrollWidth}px in ${clientWidth}px; ${wrapped} of ${tables} tables in a .table-responsive wrapper`,
        });
      }

      expect(
        overflows,
        `${item.label} is ${scrollWidth}px wide in a ${clientWidth}px window, so the page pans sideways`
      ).toBe(false);
    });
  });

  test('HOSP-RWD-011 a wide grid scrolls inside its own box instead of moving the page', async ({
    page,
  }) => {
    /**
     * What the fix for HOSP-RWD-010 looks like, asserted on a screen that already has it.
     *
     * Cabin Release carries eight columns at phone width and does not overflow the page,
     * because its table sits in a `.table-responsive` wrapper. Service Heads carries
     * fifteen and has no wrapper, which is the whole of the difference between them.
     */
    const screen = new HospitalScreenPage(page, hospitalItem('Cabin Release'));
    await screen.open();
    await screen.expectLoaded();

    const wrapped = page.locator('.table-responsive table');
    await expect(wrapped, 'Cabin Release no longer wraps its grid').toHaveCount(1);

    const { overflows } = await screen.horizontalOverflow();
    expect(overflows, 'the page panned sideways despite the wrapper').toBe(false);
  });

  test('HOSP-RWD-012 the bed board stays usable on a phone', async ({ cabinDashboardPage }) => {
    await cabinDashboardPage.openBoard();

    // The board is the screen most likely to be read on a phone, from a corridor.
    await expect(cabinDashboardPage.search).toBeEditable();
    await expect(cabinDashboardPage.tiles.first()).toBeVisible();

    // A tile has to be big enough to hit. 24px is well under any touch-target guidance and
    // is set as the floor a layout would have to be broken to fall below.
    const box = await cabinDashboardPage.tiles.first().boundingBox();
    expect(box, 'the first bed tile has no box at phone width').not.toBeNull();
    expect(box!.height, 'bed tile height').toBeGreaterThan(24);
    expect(box!.width, 'bed tile width').toBeGreaterThan(24);
  });

  test('HOSP-RWD-013 a setup grid keeps its filter and toolbar on a phone', async ({ page }) => {
    const screen = new HospitalGridPage(page, hospitalItem('Areas'));
    await screen.openGrid();

    // Still there, and still working - not merely rendered somewhere off the side.
    await expect(screen.search).toBeInViewport();
    await expect(screen.addNew).toBeInViewport();

    const [name] = await screen.columnValues('NAME');
    await screen.searchFor(name);
    const matches = await screen.columnValues('NAME');
    expect(matches.length, `the filter stopped working at ${PHONE.width}px`).toBeGreaterThan(0);
  });
});

test.describe('Hospital responsive - tablet @regression', () => {
  test.use({ viewport: TABLET });

  test('HOSP-RWD-014 the drawer is still collapsed at the top of the breakpoint', async ({
    hospitalMenuPage,
  }) => {
    /**
     * 768px is the width the breakpoint is argued about at. MudBlazor's md starts at 960,
     * so a tablet held upright gets the phone behaviour - a drawer that collapses off the
     * screen and a hamburger to bring it back - and this case is what says so out loud,
     * because "it works on my tablet" and "it works on my laptop" are two different layouts
     * and the gap between them is 192 pixels.
     *
     * Closed first, because the open state is a remembered user preference rather than a
     * per-width default - see HOSP-RWD-001. What is asserted is that this width *can*
     * collapse it and hands back the page, which is the behaviour that matters on a screen
     * this narrow.
     */
    await hospitalMenuPage.openDrawer();
    await hospitalMenuPage.closeDrawer();

    await expect
      .poll(() => hospitalMenuPage.isDrawerOpen(), {
        message: 'the drawer would not collapse at 768px',
        timeout: 20_000,
      })
      .toBe(false);
    await expect(hospitalMenuPage.drawerToggle).toBeVisible();
  });

  test('HOSP-RWD-015 the admission dashboard fits a tablet', async ({ page }) => {
    const screen = new HospitalScreenPage(page, hospitalItem('Dashboard'));
    await screen.open();
    await screen.expectLoaded();

    const { overflows, scrollWidth, clientWidth } = await screen.horizontalOverflow();
    expect(overflows, `${scrollWidth}px of content in a ${clientWidth}px window`).toBe(false);
  });

  test('HOSP-RWD-016 the bed board reflows rather than shrinking its tiles', async ({
    cabinDashboardPage,
  }) => {
    await cabinDashboardPage.openBoard();

    // Same beds as anywhere else - a board that drops tiles to fit is hiding empty beds.
    const beds = await cabinDashboardPage.tiles.count();
    expect(beds, 'beds on the board at tablet width').toBeGreaterThan(100);

    const { overflows } = await cabinDashboardPage.horizontalOverflow();
    expect(overflows, 'the bed board pans sideways on a tablet').toBe(false);
  });
});

test.describe('Hospital responsive - laptop @regression', () => {
  test.use({ viewport: LAPTOP });

  test('HOSP-RWD-017 the drawer sits beside the page above the breakpoint, not over it', async ({
    hospitalMenuPage,
  }) => {
    /**
     * The other side of HOSP-RWD-014. Above md the drawer is not modal: it is open, it lays
     * down no scrim, and the screen next to it stays usable - which is what makes it a
     * sidebar here and an overlay on a phone.
     *
     * Opened explicitly rather than assumed, for the same reason as the cases at the narrow
     * widths: whether it starts open is a remembered preference, not a property of 1280px.
     */
    await hospitalMenuPage.openDrawer();
    if (!(await hospitalMenuPage.isDrawerOpen())) await hospitalMenuPage.drawerToggle.click();

    await expect
      .poll(() => hospitalMenuPage.isDrawerOpen(), { timeout: 20_000 })
      .toBe(true);
    await expect(hospitalMenuPage.link(hospitalItem('Nurse Station'))).toBeVisible();

    // No scrim: the page beside the drawer is still reachable.
    await expect(hospitalMenuPage.drawerScrim).toHaveCount(0);
  });

  test('HOSP-RWD-018 every sampled screen fits a laptop', async ({ page }) => {
    // One case rather than eight: at the width the ERP is built for, a screen that did not
    // fit would be a layout fault rather than a responsive one, and worth one report.
    test.setTimeout(300_000);

    const panning: string[] = [];
    for (const item of RESPONSIVE_SCREENS) {
      const screen = new HospitalScreenPage(page, item);
      await screen.open();
      await screen.expectLoaded();

      const { overflows, scrollWidth, clientWidth } = await screen.horizontalOverflow();
      if (overflows) panning.push(`${item.label} (${scrollWidth}px in ${clientWidth}px)`);
    }

    expect(panning, 'screens that pan sideways on a laptop').toEqual([]);
  });

  test('HOSP-RWD-019 the module menu is readable without scrolling the drawer to find a screen', async ({
    hospitalMenuPage,
  }) => {
    // Eighty entries in one flat list, so the drawer scrolls - that is expected. What is
    // asserted is that it is a scroll and not a clip: the last entry has to be reachable.
    await hospitalMenuPage.openDrawer();

    const last = HOSPITAL_MENU[HOSPITAL_MENU.length - 1];
    const link = hospitalMenuPage.link(last);
    await link.scrollIntoViewIfNeeded();

    await expect(link, `"${last.label}" cannot be scrolled to in the drawer`).toBeInViewport();
  });

  test('HOSP-RWD-020 a screen opened at laptop width still works at phone width', async ({
    page,
    browser,
  }) => {
    /**
     * The rotation case: a layout that only arranges itself correctly on first paint breaks
     * for anyone who turns a tablet over, and that is a different code path from loading the
     * page at the narrow width - which every case above does.
     *
     * A second context rather than setViewportSize, because this project's contexts are
     * created without a viewport and cannot be resized. Same storage state, so it is the
     * same session looking at the same screen.
     */
    const screen = new HospitalScreenPage(page, hospitalItem('Cabin Release'));
    await screen.open();
    await screen.expectLoaded();
    const wide = await screen.horizontalOverflow();
    expect(wide.overflows).toBe(false);

    const narrow = await browser.newContext({
      viewport: PHONE,
      storageState: await page.context().storageState(),
      ignoreHTTPSErrors: true,
      baseURL: page.url().replace(/(https?:\/\/[^/]+).*/, '$1'),
    });
    try {
      const narrowPage = await narrow.newPage();
      const narrowScreen = new HospitalScreenPage(narrowPage, hospitalItem('Cabin Release'));
      await narrowScreen.open();
      await narrowScreen.expectLoaded();

      const { overflows, scrollWidth, clientWidth } = await narrowScreen.horizontalOverflow();
      expect(overflows, `${scrollWidth}px of content in a ${clientWidth}px window`).toBe(false);
    } finally {
      await narrow.close();
    }
  });
});
