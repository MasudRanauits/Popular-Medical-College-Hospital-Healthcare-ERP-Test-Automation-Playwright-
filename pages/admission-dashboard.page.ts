import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';
import { readFile } from 'fs/promises';

/** One PDF a print button produced, read back out of the blob the app handed the browser. */
export interface PrintedDocument {
  /** Position in the Action cell, left to right - which document it is, in the app's order. */
  index: number;
  /** The blob: URL the document came back on - the download's, or the popup's. */
  url: string;
  /** Bytes of the PDF. */
  size: number;
  /** First bytes of the file, e.g. "%PDF-1.4" - what proves it is really a PDF. */
  header: string;
}

/**
 * Admission dashboard at /hospital/patientlist-dashboard - Hospital module, "Dashboard"
 * at the top of the drawer. It lists every patient currently admitted.
 *
 * A third grid framework again: this page is Blazorise, so the table is
 * <table class="b-datagrid"> with its own pager, not a MudBlazor or Radzen grid. The
 * table is pinned by its ADM.NO header rather than by class alone, because the page also
 * carries three hidden Radzen lookup grids - the Department, Doctor Name and CabinType
 * filters - and their headers and rows answer a bare `th`/`tbody tr` locator too.
 *
 * Search is one box over the whole row: admission number, phone, cabin number and patient
 * name all filter through it. See searchFor for the one way the box and the grid disagree.
 */
export class AdmissionDashboardPage extends BasePage {
  /** Also the drawer link's href, so specs opening it through the menu share this one. */
  static readonly PATH = '/hospital/patientlist-dashboard';

  protected readonly path = AdmissionDashboardPage.PATH;

  /** How long one print is given to produce its document. The first of the four is over a
   *  megabyte and is built on the server before a byte of it reaches the browser. */
  private static readonly PRINT_TIMEOUT = 90_000;

  /** The grid's columns, in order. */
  static readonly COLUMNS = [
    'ADM.NO',
    'ADM.DATE',
    'ADM.TIME',
    'NAME',
    'CABINNO',
    'ASSIGNED DOCTOR',
    'PHONE',
    'ADDRESS',
    'CABINTYPE',
    'PACKAGE',
    'ACTION',
  ] as const;

  /** Column positions, for reading a cell out of a row by name. */
  static readonly COLUMN = {
    admissionNo: 0,
    admissionDate: 1,
    admissionTime: 2,
    name: 3,
    cabinNo: 4,
    assignedDoctor: 5,
    phone: 6,
    address: 7,
    cabinType: 8,
  } as const;

  readonly search: Locator;
  readonly grid: Locator;
  readonly rows: Locator;
  readonly printList: Locator;
  readonly printPackageList: Locator;
  readonly pageSize: Locator;

  constructor(page: Page) {
    super(page);
    // One visible "Search..." box on the page; the Radzen lookups keep theirs hidden.
    this.search = page.getByPlaceholder('Search...').first();
    this.grid = page
      .locator('table.b-datagrid')
      .filter({ has: page.locator('th', { hasText: 'ADM.NO' }) })
      .first();
    this.rows = this.grid.locator('tbody tr');
    this.printList = page.getByRole('button', { name: 'Print List', exact: true });
    this.printPackageList = page.getByRole('button', { name: 'Print Package List', exact: true });
    this.pageSize = page.locator('select[name="PaginationContext.CurrentPageSize"]');
  }

  /**
   * Types `term` into the search box and leaves the grid to filter.
   *
   * The caller asserts on what comes back - rowFor and the count assertions retry, so
   * there is nothing here to wait on explicitly.
   *
   * One trap, for a name: the NAME column renders the patient's title in front of the
   * name ("Mr Jalal Miah") but the search matches the name as it was registered, without
   * it. Searching a name copied straight out of the grid therefore returns nothing -
   * searchableName strips the title back off.
   */
  async searchFor(term: string): Promise<void> {
    await this.search.fill('');
    await this.search.fill(term);
  }

  /** Clears the search box and waits for the grid to come back unfiltered. */
  async clearSearch(): Promise<void> {
    await this.search.fill('');
    await expect(this.rows.first()).toBeVisible({ timeout: 30_000 });
  }

  /**
   * A name from the NAME column as the search box will match it - the leading title
   * dropped. See searchFor for why.
   */
  static searchableName(displayed: string): string {
    return displayed
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^(Mr|Mrs|Ms|Miss|Md|Mst|Baby|Dr|Prof)\.?\s+/i, '');
  }

  /** The single row matching `term`, e.g. an admission number. */
  rowFor(term: string): Locator {
    return this.rows.filter({ hasText: term }).first();
  }

  /** A row's cells, whitespace-normalised, in COLUMN order. */
  async cells(row: Locator): Promise<string[]> {
    return (await row.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
  }

  /** One cell of `row`, e.g. cell(row, 'cabinNo'). */
  async cell(row: Locator, column: keyof typeof AdmissionDashboardPage.COLUMN): Promise<string> {
    const index = AdmissionDashboardPage.COLUMN[column];
    return (await row.locator('td').nth(index).innerText()).replace(/\s+/g, ' ').trim();
  }

  /**
   * The print buttons in a row's Action cell.
   *
   * Matched on the printer icon, not on the button class. Every button in the cell carries
   * `btn-print`, but some rows also carry a cloud-arrow-down button among them, and that
   * one produces no document at all - no popup, no download, nothing on screen - so
   * clicking it as part of a print run would hang waiting for a PDF that never comes.
   */
  printButtons(row: Locator): Locator {
    return row.locator('td').last().locator('button').filter({
      has: this.page.locator('i.fa-print'),
    });
  }

  /**
   * Clicks every print button in `row`, left to right, and returns the PDF each one
   * produced.
   *
   * One at a time on purpose: each click opens its own tab, and the app reuses nothing
   * between them, so firing them together would leave the documents unmatched to the
   * buttons that opened them.
   *
   * How the PDF is read back. The app builds the file in the browser and hands it to
   * Chrome as a blob, which lands one of two ways. On this host it lands as a *download*:
   * the blob carries a filename, so Chrome saves it and leaves the tab the app opened
   * alongside it permanently blank - which is what the old wait for a blob: URL on that
   * tab sat through until it timed out. Where it does not download, the tab is left
   * sitting on the blob: URL in Chrome's PDF viewer instead.
   *
   * So both are armed before the click and whichever answers first is the document: a
   * saved download is read off disk, a document tab is fetched from the page that created
   * the blob - a blob: URL belongs to its creator and nothing else can read it. Either way
   * what is checked is the bytes, not that a tab opened.
   */
  async printAll(row: Locator): Promise<PrintedDocument[]> {
    const context = this.page.context();
    const buttons = this.printButtons(row);
    await expect(buttons.first()).toBeVisible({ timeout: 30_000 });

    const count = await buttons.count();
    const printed: PrintedDocument[] = [];

    for (let index = 0; index < count; index++) {
      // The first of these is the document on this host; the second is the fallback. Both
      // resolve to null on their own timeout rather than rejecting, so the race below is
      // settled by whichever actually happened.
      const downloading = this.page
        .waitForEvent('download', { timeout: AdmissionDashboardPage.PRINT_TIMEOUT })
        .catch(() => null);
      // The tab is opened by the click handler itself, so it is there within a moment or
      // it is not coming - only the document inside it is worth a long wait.
      const opening = context.waitForEvent('page', { timeout: 15_000 }).catch(() => null);
      const documentTab = opening.then((popup) =>
        popup
          ?.waitForURL(/^blob:/, { timeout: AdmissionDashboardPage.PRINT_TIMEOUT })
          .then(() => popup)
          .catch(() => null) ?? null
      );

      await buttons.nth(index).click();

      const document = await Promise.race([
        downloading.then((download) => (download ? { download } : null)),
        documentTab.then((popup) => (popup ? { popup } : null)),
      ]);

      if (document && 'download' in document) {
        const bytes = await readFile(await document.download.path());
        printed.push({
          index,
          url: document.download.url(),
          size: bytes.length,
          header: bytes.subarray(0, 8).toString('latin1'),
        });
      } else if (document) {
        const url = document.popup.url();
        printed.push({ index, url, ...(await this.readPdf(url)) });
      } else {
        throw new Error(
          `print button ${index + 1} produced no document - nothing was saved, and the tab ` +
            `it opened never became one`
        );
      }

      // The app opens a tab for every print whether the document ends up in it or not;
      // left behind they pile up over the four buttons.
      await (await opening)?.close().catch(() => {});
    }

    return printed;
  }

  /** Size and leading bytes of the blob at `url`, fetched from the page that created it. */
  private async readPdf(url: string): Promise<{ size: number; header: string }> {
    return this.page.evaluate(async (blobUrl) => {
      const response = await fetch(blobUrl);
      const bytes = new Uint8Array(await response.arrayBuffer());
      return {
        size: bytes.length,
        header: String.fromCharCode(...bytes.slice(0, 8)),
      };
    }, url);
  }

  async expectLoaded(): Promise<void> {
    await this.settleAuthorization(this.grid);
    await expect(this.page).toHaveURL(new RegExp(this.path, 'i'));
    await expect(this.search).toBeVisible({ timeout: 30_000 });
    // The ward is never empty, so a grid with no rows means the fetch failed.
    await expect(this.rows.first()).toBeVisible({ timeout: 60_000 });
  }
}
