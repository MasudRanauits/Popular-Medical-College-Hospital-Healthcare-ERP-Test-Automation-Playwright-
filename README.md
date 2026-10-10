# Popular Medical College Hospital — Healthcare ERP Test Automation

End-to-end and API test automation for the PMCH Healthcare ERP, built with
[Playwright](https://playwright.dev) and TypeScript.

## Getting started

```bash
npm install
npx playwright install        # browsers, already done once after scaffolding
cp .env.example .env          # then fill in BASE_URL and credentials
```

Tests that need a live environment are **skipped** until `BASE_URL` is set in `.env`,
so a fresh clone runs green out of the box.

## Running tests

| Command | What it runs |
| --- | --- |
| `npm test` | Everything — setup, UI suites on all browsers, API |
| `npm run test:smoke` | `tests/smoke` only |
| `npm run test:regression` | `tests/regression` only |
| `npm run test:api` | API project only (no browser session) |
| `npm run test:chromium` | UI suites on Chromium only |
| `npm run test:headed` | Headed browser |
| `npm run test:ui` | Playwright UI mode |
| `npm run test:debug` | Inspector / step debugging |
| `npm run report` | Open the last HTML report |
| `npm run docs` | Rebuild the QA documents in [docs/](docs/) from the last run |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run codegen` | Record a test against the app |

## Project structure

```
tests/
  smoke/            Fast critical-path checks — run on every build
  regression/       Full functional coverage per ERP module
  api/              REST API tests (no browser)
  auth.setup.ts     Logs in once, saves the session for all UI projects
pages/              Page Object Model — one class per screen, extends BasePage
fixtures/           Custom Playwright fixtures that inject page objects / API context
utils/              env.ts (config + credentials), helpers.ts (waits, formatters)
data/               Test users and data builders
playwright/.auth/   Saved storage state (git-ignored)
docs/               Test Case Document and Bug Report — PDF, HTML source, evidence
scripts/            Document build: evidence collector, HTML-to-PDF printer
```

## QA documents

Two deliverables live in [docs/](docs/), each its own file:

| Document | What it is |
| --- | --- |
| [docs/TEST_CASES.pdf](docs/TEST_CASES.pdf) | All 138 test cases in one PDF — steps, data, expected result, priority and last-run status per case |
| [docs/BUG_REPORT.pdf](docs/BUG_REPORT.pdf) | The defects raised from the last cycle, with screenshots, videos and traces |

```bash
npm run docs            # evidence + both PDFs
npm run docs:evidence   # pull screenshots/videos/traces out of playwright-report/
npm run docs:pdf        # re-print docs/src/*.html to PDF
```

The prose is hand-written in `docs/src/*.html`; only the evidence under
`docs/assets/failures/` is generated. A PDF cannot play video — open
`docs/src/bug-report.html` in a browser for the inline players. See
[docs/README.md](docs/README.md).

## How authentication works

The `setup` project runs [tests/auth.setup.ts](tests/auth.setup.ts) first. It logs in once
and writes the session to `playwright/.auth/user.json`. Every UI project declares
`dependencies: ['setup']` and loads that file as `storageState`, so no spec logs in again.

Specs that must start signed-out opt out per file:

```ts
test.use({ storageState: { cookies: [], origins: [] } });
```

## Writing a test

```ts
import { test, expect } from '../../fixtures';

test('registers a new patient', async ({ dashboardPage }) => {
  await dashboardPage.goto();
  // ...
});
```

Page objects are injected as fixtures — add new ones in [fixtures/test-fixtures.ts](fixtures/test-fixtures.ts).

## Conventions

- **Selectors** live in page objects, never in specs. Prefer `getByRole` / `getByLabel`
  over CSS; fall back to `data-testid` when the ERP markup gives nothing semantic.
- **Test data** is generated per run via builders in [data/test-data.ts](data/test-data.ts)
  so parallel workers never collide on a record.
- **Credentials** come from `.env` only. Nothing secret gets committed.

## Before the first real run

The page objects ship with placeholder selectors marked `TODO` — they are guesses at the
ERP's markup. Point `BASE_URL` at the app, run `npm run codegen`, and replace them.
