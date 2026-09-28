import { defineConfig, devices } from '@playwright/test';
import { ENV, STORAGE_STATE } from './utils/env';

/**
 * Popular Medical College Hospital - Healthcare ERP Test Automation
 * See https://playwright.dev/docs/test-configuration.
 */

/**
 * Chromium-only window sizing. `--start-maximized` fills the screen on a headed run but
 * is a no-op headless, where there is no window manager - so `--window-size` sets the
 * same 1080p surface explicitly and keeps the two modes rendering the ERP identically.
 * Firefox and WebKit have no equivalent flag; there `viewport: null` just lets the page
 * fill whatever window the browser opened.
 */
const MAXIMIZED = ['--start-maximized', '--window-size=1920,1080'];

/**
 * A device preset with its fixed window size dropped, so the page fills the real
 * browser window. `deviceScaleFactor` has to go with it - Playwright rejects a context
 * that sets one alongside `viewport: null`.
 */
function fullWindow(device: (typeof devices)[string]) {
  const { viewport, deviceScaleFactor, ...rest } = device;
  return { ...rest, viewport: null };
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: ENV.isCI,
  /* One local retry absorbs the host throttle when a submit itself is answered with 429. */
  retries: ENV.isCI ? 2 : 1,
  /* The ERP host drops sessions under concurrent browsers - one worker, everywhere. */
  workers: 1,
  /* The host is slow under concurrent browsers - the 30s default expires mid-navigation. */
  timeout: 90_000,
  /* Firefox on this host needs well over the 5s default to finish a form POST and repaint. */
  expect: { timeout: 15_000 },
  reporter: ENV.isCI
    ? [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: ENV.baseURL,
    /* Self-signed certificate on the ERP host. */
    ignoreHTTPSErrors: true,
    /* Headless everywhere. Pass --headed to watch a run. */
    headless: false,
    /* No fixed viewport - the page fills the whole browser window instead of the
       1280x720 the device presets pin it to. With --start-maximized below, a headed
       Chromium run covers the full screen. */
    viewport: null,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30_000,
    navigationTimeout: 45_000,
  },

  projects: [
    /* Logs in once and saves the session to playwright/.auth/user.json. */
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...fullWindow(devices['Desktop Chrome']), launchOptions: { args: MAXIMIZED } },
    },

    /* API tests need no browser session. */
    {
      name: 'api',
      testDir: './tests/api',
      use: { ...fullWindow(devices['Desktop Chrome']) },
    },

    /* UI suites reuse the saved session. */
    {
      name: 'chromium',
      testIgnore: /tests[\/]api[\/]/,
      use: {
        ...fullWindow(devices['Desktop Chrome']),
        storageState: STORAGE_STATE,
        launchOptions: { args: MAXIMIZED },
      },
      dependencies: ['setup'],
    },
    // {
    //   name: 'firefox',
    //   testIgnore: /tests[\/]api[\/]/,
    //   use: { ...fullWindow(devices['Desktop Firefox']), storageState: STORAGE_STATE },
    //   dependencies: ['setup'],
    // },
    // {
    //   name: 'webkit',
    //   testIgnore: /tests[\/]api[\/]/,
    //   use: { ...fullWindow(devices['Desktop Safari']), storageState: STORAGE_STATE },
    //   dependencies: ['setup'],
    // },

    /* Mobile viewports - enable when the ERP has a responsive target.
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
    */
  ],
});
