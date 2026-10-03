/**
 * Pulls the failure evidence out of the last run and lays it out under
 * docs/assets/failures/<TEST_ID>/, so the bug report can reference screenshots, videos
 * and traces by a stable path instead of by Playwright's content hashes.
 *
 *   node scripts/collect-evidence.mjs            # rebuild from playwright-report/
 *   node scripts/collect-evidence.mjs --keep     # add to what is already there
 *
 * Source is playwright-report/index.html, which carries the whole run - the JSON model
 * and every attachment - and survives between runs, unlike test-results/ which the next
 * run wipes. The report is a base64 zip embedded in that one HTML file; readReport below
 * unpacks it with zlib alone, so this script needs nothing installed.
 *
 * Also writes docs/assets/failures/manifest.json: one entry per failed test, with the
 * error, the timings and the files copied. docs/src/bug-report.html is written by hand
 * against those paths - this script never edits it.
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_HTML = path.join(ROOT, 'playwright-report', 'index.html');
const OUT_DIR = path.join(ROOT, 'docs', 'assets', 'failures');

/* ---------------------------------------------------------------- zip reader */

/**
 * Entries of a zip buffer, as { name: Buffer }.
 *
 * Reads the central directory backwards from the End Of Central Directory record, which
 * is the only way to find the entries without guessing at local-header lengths. Handles
 * the two compression methods a Playwright report uses: 0 (stored) and 8 (deflate).
 */
function unzip(buffer) {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('not a zip: no end-of-central-directory record');

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = {};

  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('corrupt central directory');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);

    // The local header repeats the name and extra field, at its own lengths.
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(start, start + compressedSize);

    if (!name.endsWith('/')) entries[name] = method === 0 ? raw : zlib.inflateRawSync(raw);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** The run model embedded in playwright-report/index.html, plus a reader for its files. */
function readReport() {
  if (!fs.existsSync(REPORT_HTML))
    throw new Error(`No report at ${path.relative(ROOT, REPORT_HTML)}. Run the suite first.`);

  const html = fs.readFileSync(REPORT_HTML, 'utf8');
  const match = html.match(
    /id="playwrightReportBase64">data:application\/zip;base64,([A-Za-z0-9+/=]+)/
  );
  if (!match) throw new Error('The report carries no embedded run data.');

  const entries = unzip(Buffer.from(match[1], 'base64'));
  const json = (name) => JSON.parse(Buffer.from(entries[name]).toString('utf8'));
  const report = json('report.json');
  const files = report.files.map((f) => json(`${f.fileId}.json`));

  // Attachments are written beside index.html, not into the zip.
  const dataDir = path.join(path.dirname(REPORT_HTML), 'data');
  return {
    report,
    files,
    readAttachment: (p) => fs.readFileSync(path.join(dataDir, path.basename(p))),
  };
}

/* ------------------------------------------------------------------ evidence */

/** TC_ADM_002 out of "TC_ADM_002 searching a UHID ...", else a slug of the whole title. */
function testId(title) {
  const tagged = title.match(/^(TC_[A-Z0-9_]+)/);
  if (tagged) return tagged[1];
  return title
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase()
    .slice(0, 48);
}

const EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'video/webm': 'webm',
  'text/markdown': 'md',
  'text/plain': 'txt',
  'application/zip': 'zip',
};

function main() {
  const keep = process.argv.includes('--keep');
  const { report, files, readAttachment } = readReport();

  if (!keep && fs.existsSync(OUT_DIR)) fs.rmSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const failures = [];

  for (const file of files) {
    for (const test of file.tests ?? []) {
      if (test.outcome === 'expected' || test.outcome === 'skipped') continue;

      const id = testId(test.title);
      const dir = path.join(OUT_DIR, id);
      fs.mkdirSync(dir, { recursive: true });

      const entry = {
        id,
        title: test.title,
        suite: test.path.join(' > '),
        spec: `${file.fileName}:${test.location.line}`,
        project: test.projectName,
        outcome: test.outcome,
        durationMs: test.duration,
        attempts: [],
      };

      (test.results ?? []).forEach((result, index) => {
        const attempt = index + 1;
        const error = (result.errors?.[0]?.message ?? '').replace(/\[[0-9;]*m/g, '').trim();
        const copied = [];

        for (const attachment of result.attachments ?? []) {
          if (!attachment.path) continue;
          const extension =
            EXTENSIONS[attachment.contentType] || path.extname(attachment.path).slice(1) || 'bin';
          const name = `${attachment.name}-${attempt}.${extension}`;
          fs.writeFileSync(path.join(dir, name), readAttachment(attachment.path));
          copied.push({
            name: attachment.name,
            file: `${id}/${name}`,
            contentType: attachment.contentType,
          });
        }

        entry.attempts.push({
          attempt,
          status: result.status,
          durationMs: result.duration,
          startedAt: result.startTime,
          error: error.split('\n').slice(0, 12).join('\n'),
          attachments: copied,
        });
      });

      failures.push(entry);
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    run: {
      startedAt: report.startTime,
      durationMs: report.duration,
      projects: report.projectNames,
      ...report.stats,
    },
    failures,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const attachmentCount = failures.reduce(
    (n, f) => n + f.attempts.reduce((m, a) => m + a.attachments.length, 0),
    0
  );
  console.log(
    `Run of ${new Date(report.startTime).toISOString()}: ${report.stats.expected} passed, ` +
      `${report.stats.unexpected} failed, ${report.stats.flaky} flaky.`
  );
  for (const failure of failures)
    console.log(`  ${failure.id}  ${failure.spec}  (${failure.attempts.length} attempt(s))`);
  console.log(`${attachmentCount} file(s) -> ${path.relative(ROOT, OUT_DIR)}`);
}

main();
