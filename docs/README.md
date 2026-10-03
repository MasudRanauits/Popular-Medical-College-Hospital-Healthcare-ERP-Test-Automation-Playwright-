# QA documents

Two deliverables, each a separate document, both built from the sources in `src/`.

| Document | PDF | Source | Pages |
| --- | --- | --- | --- |
| **Test Case Document** — all 35 cases in one file | [`TEST_CASES.pdf`](TEST_CASES.pdf) | [`src/test-cases.html`](src/test-cases.html) | 15, A4 landscape |
| **Bug Report** — 8 defects + 1 automation defect, with screenshots and video | [`BUG_REPORT.pdf`](BUG_REPORT.pdf) | [`src/bug-report.html`](src/bug-report.html) | 13, A4 portrait |

Both reflect the regression run of **03 Oct 2026, 08:04 UTC** — 24 tests, 23 passed, 1 failed.

## Video

A PDF cannot play video, so the bug report's PDF keeps the captions and drops the
players. For the recordings, either open `src/bug-report.html` in a browser — the players
are inline — or open the files directly:

```
docs/assets/failures/TC_ADM_002/video-1.webm   attempt 1
docs/assets/failures/TC_ADM_002/video-2.webm   attempt 2 (retry)
```

The Playwright trace is richer than either, with DOM snapshots, network and console per
step:

```
npx playwright show-trace docs/assets/failures/TC_ADM_002/trace-2.zip
```

## Evidence

`assets/failures/` holds one folder per failed test, named by its case ID, plus
`manifest.json` describing the run. It is written by the collector, not by hand.

```
assets/failures/
  manifest.json                 run stats, per-attempt status, timings, error text
  TC_ADM_002/
    screenshot-1.png  screenshot-2.png
    video-1.webm      video-2.webm
    error-context-1.md  error-context-2.md    page snapshot at the failure
    trace-2.zip
```

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
