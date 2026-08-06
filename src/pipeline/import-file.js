/**
 * Manually import a downloaded data file (useful when SFTP is blocked or
 * for quarterly backfills):
 *   npm run import -- --source sunbiz --file ~/Downloads/20260805c.txt
 *
 * The file is copied into data/downloads/ where the pipeline will pick it
 * up on every run; then run `npm run pipeline` to ingest + enrich.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DOWNLOADS_DIR } from '../config.js';
import { parseSunbizFile } from '../sources/sunbiz.js';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1]] : null)).filter(Boolean)
);

if (args.source !== 'sunbiz' || !args.file) {
  console.error('Usage: npm run import -- --source sunbiz --file <path-to-daily-file.txt>');
  process.exit(1);
}
const src = path.resolve(args.file);
const dest = path.join(DOWNLOADS_DIR, `sunbiz_${path.basename(src)}`);
fs.copyFileSync(src, dest);
const rows = parseSunbizFile(dest);
console.log(`Imported ${path.basename(src)} → ${dest}`);
console.log(`Contains ${rows.length} parseable filings. Run \`npm run pipeline\` to ingest them.`);
