/**
 * Prints the two QA documents in docs/src to PDF, using the Chromium that Playwright
 * already installs - so there is nothing extra to add to the project.
 *
 *   node scripts/build-docs.mjs                 # both
 *   node scripts/build-docs.mjs test-cases      # one, by source file stem
 *
 * Page size and margins come from each document's own `@page` rule (test-cases is
 * landscape, bug-report portrait); preferCSSPageSize is what hands that control over.
 * The page number is drawn by Chromium into the bottom margin, not by the document.
 *
 * Videos referenced by the bug report cannot play in a PDF - doc.css hides them for
 * print and the document points the reader at the files instead.
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'docs', 'src');
const OUT = path.join(ROOT, 'docs');

const DOCUMENTS = [
  { source: 'test-cases.html', pdf: 'TEST_CASES.pdf', footer: 'Test Case Document — PMCH Healthcare ERP' },
  { source: 'bug-report.html', pdf: 'BUG_REPORT.pdf', footer: 'Bug Report — PMCH Healthcare ERP' },
];

/** Chromium draws this into the bottom margin of every page. */
function footerTemplate(label) {
  return `<div style="width:100%;font:7pt 'Segoe UI',Arial,sans-serif;color:#5a6b7c;
      padding:0 12mm;display:flex;justify-content:space-between;">
    <span>${label}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>`;
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const wanted = only.length
    ? DOCUMENTS.filter((d) => only.some((a) => d.source.startsWith(a.replace(/\.html$/, ''))))
    : DOCUMENTS;

  if (!wanted.length) throw new Error(`No document matches ${only.join(', ')}.`);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    for (const doc of wanted) {
      const source = path.join(SRC, doc.source);
      if (!fs.existsSync(source)) throw new Error(`Missing ${path.relative(ROOT, source)}`);

      // networkidle so the screenshots are decoded before the print snapshot is taken.
      await page.goto(pathToFileURL(source).href, { waitUntil: 'networkidle' });
      await page.emulateMedia({ media: 'print' });

      const target = path.join(OUT, doc.pdf);
      await page.pdf({
        path: target,
        preferCSSPageSize: true,
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: footerTemplate(doc.footer),
      });

      const kb = Math.round(fs.statSync(target).size / 1024);
      console.log(`${path.relative(ROOT, source)} -> ${path.relative(ROOT, target)} (${kb} KB)`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
