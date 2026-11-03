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
| `npm run test:hospital` | The whole Hospital module — `tests/regression/Hospital` |
| `npm run test:hospital:quick` | The Hospital module without the 80-route `@nav` series |
| `npm run test:hospital:smoke` | Hospital smoke only |
| `npm run test:responsive` | Hospital layout at phone, tablet and laptop widths |
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
    Hospital/       The Hospital (IPD) module — all 80 of its screens
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

## The Hospital module

The hospital's inpatient side is the biggest module in the ERP — 80 screens behind one
launcher tile — so it has a folder of its own under `tests/regression/Hospital/`:

**One spec file per drawer menu, named after the menu.** To find a screen's coverage, look
for its name in the file list:

```
tests/regression/Hospital/
  cabin-release.regression.spec.ts          ← the "Cabin Release" menu
  draft-bill.regression.spec.ts             ← the "DRAFT BILL" menu
  edit-food-and-beverage-discharged.regression.spec.ts
  ...                                       80 of them, one per menu
```

Case ids follow the same rule, so a failure names its screen without anyone looking it up:
`CABIN-RELEASE-003`, `DRAFT-BILL-002`, `ADMISSION-CANCEL-011`.

Four files are not named after a menu, and each says why in its header:

| File | What it holds |
| --- | --- |
| `_module.regression.spec.ts` | The drawer itself, and the cross-screen registers — the toolbar map, the five patient pickers, shared page titles, ungated Save buttons |
| `_module-responsive.regression.spec.ts` | The module at 390px, 768px and 1280px |
| `_case-packs.ts` | The shared bodies behind the six recurring screen shapes (not a spec) |
| `nurse-station-*.regression.spec.ts` | The four Nurse Station **tabs** — Consultancy Service, Diet Indent, Diet Dashboard, IPD Service Entry |

That last row matters: three drawer menus share a name with a Nurse Station tab and are
*different screens*. `consultancy-service.regression.spec.ts` is the menu at
`/hospital/ipd-consultancy-service`; `nurse-station-consultancy-service.regression.spec.ts`
is the tab at `/hospital/nurse-station`, which is where the ward actually works and where
the deep workflow cases live.

### How a per-menu file is put together

Most menus are one of six recurring shapes — a reference-data grid, a report, one of the
patient-lookup families, a date-range report, a discharged-bill editor. The shape lives in
`_case-packs.ts` and the menu file says which one it is, then adds that screen's own cases:

```ts
const ITEM = hospitalItem('Cabin Release');

test.describe('Cabin Release @regression', () => {
  const packed = cases(ITEM, opensFromDrawer(), listScreen([...]));
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' the board opens on the orphaned beds', async ({ page }) => {
    // ...
  });
});
```

The `packed.forEach(... => test(...))` is deliberate rather than clever: Playwright files a
test under whichever file called `test()`, so a pack that declared its own cases would file
two hundred of them under `_case-packs.ts` — exactly the problem this layout exists to fix.

### Five ways to pick a patient

The module has **five** different patient pickers, which is why there are five page objects
rather than one. They are not interchangeable — the same label sits over different controls,
and a suite that trusts the label reads a gender out of the column it expects a name in:

| Page object | Control | Columns | Field prefix |
| --- | --- | --- | --- |
| `HospitalPatientScreenPage` | "Admission No" / "Invoice No" / "Adm.No" | InvoiceNo, CabinNo, FullName, Mobile | `SelectedPatient.` / `_SelectedPatient.` |
| `HospitalWardScreenPage` | "Search Patient" | CabinNo, FullName, InvoiceNo | `_SelectedPatient.` / `SelectedIPDPatientInfo.` |
| `HospitalUhidScreenPage` | "Admission No" / "Adm.No" | UHID, Full Name, Gender, Blood Group, Cabin Type, Cabin No, Department | `SelectedPatientInfo.` |
| `BillChangeHistoryPage` | "PATIENT" | Bill No, Patient, UHID, Status, Admitted, Discharged, Changes | n/a |
| `DischargedEditPage` | a typed invoice number | none — no picker at all | `SelectedPatient.` |

Every one of these reads its rows **by column header, never by position**: several screens
print the same columns in a different order from their neighbours.

`pages/hospital-menu.page.ts` holds `HOSPITAL_MENU` — every menu entry with its route and
the page title the screen renders. It is the module's register: the navigation suite asserts
the live drawer against it, and the smoke suite takes its screen list from the `smoke: true`
entries, so the gate and the register cannot drift apart.

**The suite is read-only.** It runs against the live hospital system, so no case in it
submits an admission, a cancellation or a payment. Where a workflow can only be proved by
writing, the case stops at the submit and says so.

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
