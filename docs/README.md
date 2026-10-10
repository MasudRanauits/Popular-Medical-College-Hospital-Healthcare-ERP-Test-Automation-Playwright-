# QA documents

Two deliverables, each a separate document, both built from the sources in `src/`.

| Document | PDF | Source | Pages |
| --- | --- | --- | --- |
| **Test Case Document** — all 138 cases in one file | [`TEST_CASES.pdf`](TEST_CASES.pdf) | [`src/test-cases.html`](src/test-cases.html) | 56, A4 landscape |
| **Bug Report** — 37 defects + 1 closed automation defect, with screenshots and video | [`BUG_REPORT.pdf`](BUG_REPORT.pdf) | [`src/bug-report.html`](src/bug-report.html) | 32, A4 portrait |

Both reflect the full regression run of **05 Oct 2026, 15:28 UTC** — 99 tests in 33 m 33 s:
94 expected (78 passed, 16 expected-to-fail), 2 failed, 3 skipped — plus the **IPD Service
Entry run of 06 Oct 2026**: 27 cases, 13 passed and 14 expected-to-fail, nothing unexpected
and nothing skipped. That suite is new; every other suite is unchanged.

**Expected-to-fail is not a broken test.** Thirty cases are marked `test.fail()`: each asserts
the behaviour the module is supposed to have, fails on every run, and is reported as
*unexpectedly passing* — which fails the build — the day the module is corrected. Each is a
defect in the bug report (BUG-009 … BUG-037). The two red cases of the 05 Oct cycle, DD-02 and
DD-13, were resolved on 10 Oct: BUG-018 turned out to be the ERP host clock running ~12 hours
fast, not a Diet Dashboard defect, and the assertion moved to DD-18, which measures the skew
directly and is marked `test.fail()` like every other held defect.

**IPD Service Entry has no evidence folder, on purpose.** That tab offers no way to take a
saved service off a bill again (BUG-027), so no case in its suite presses Save against a cart
with anything in it — the evidence for its fourteen defects is the cart, the form and the grid
headers rather than a charge made and undone.

## Video

A PDF cannot play video, so the bug report's PDF keeps the captions and drops the
players. For the recordings, either open `src/bug-report.html` in a browser — the players
are inline — or open the files directly:

```
docs/assets/failures/DD-02/video-1.webm   BUG-018, attempt 1
docs/assets/failures/DD-02/video-2.webm   BUG-018, attempt 2 (retry)
docs/assets/failures/DD-13/video-1.webm   the same default after a tab round trip
docs/assets/failures/DD-13/video-2.webm   attempt 2 (retry)
```

The Playwright trace is richer than either, with DOM snapshots, network and console per
step:

```
npx playwright show-trace docs/assets/failures/DD-02/trace-2.zip
```

`TC_ADM_002/` is kept from the 03 Oct run because BUG-001 is still open — it is the only
folder here that is not from the latest run. Clearing it means dropping that defect's evidence.

## Evidence

`assets/failures/` holds one folder per failed test, named by its case ID, plus
`manifest.json` describing the run. It is written by the collector, not by hand.

Case IDs in both schemes are recognised — `TC_ADM_002` and the shorter `CS-12` / `DD-02` /
`DI-06` the Nurse Station suites use.

```
assets/failures/
  manifest.json                 run stats, per-attempt status, timings, error text
  DD-02/                        05 Oct run — BUG-018, BUG-019
    screenshot-1.png  screenshot-2.png
    video-1.webm      video-2.webm
    error-context-1.md  error-context-2.md    page snapshot at the failure
    trace-2.zip
  DD-13/                        05 Oct run — BUG-018 after a tab round trip
  TC_ADM_002/                   03 Oct run — kept for BUG-001, see above
```

Cases marked `test.fail()` produce no artifacts: Playwright records nothing for a test that
failed as expected. Their evidence is the run annotation each one writes — visible per test in
`npm run report`.

## Rebuilding

```bash
npm run docs            # evidence + both PDFs
npm run docs:evidence   # re-read playwright-report/ into assets/failures/
npm run docs:pdf        # re-print src/*.html to PDF
npm run docs:pdf -- bug-report    # just one
```

`docs:evidence` reads `playwright-report/index.html` from the most recent run, so run the
suite first if you want current artifacts. It rewrites `assets/failures/` wholesale; pass
`--keep` to add to what is there instead.

`docs:pdf` prints with the Chromium that Playwright already installs — nothing extra to
add to the project. Page size comes from each document's own `@page` rule.

## Editing

The prose is hand-written: the collector never touches `src/`. Edit the HTML, then run
`npm run docs:pdf`. Both documents share `src/doc.css`, and both are written to read
correctly in a browser and in print.

After a new run, the order is: run the suite → `npm run docs:evidence` → update the status
columns in `src/test-cases.html` and raise or close defects in `src/bug-report.html` →
`npm run docs:pdf`.

Use `docs:evidence --keep` while any defect in the report still points at an older run's
artifacts, as BUG-001 does; a plain run clears the folder.

**Watch for unexpectedly passing.** A case marked `test.fail()` that starts passing means the
module was corrected: close the defect it holds, drop the `test.fail()` line, keep the
assertion, and move its row in `src/test-cases.html` from `known fail` to `pass`.
