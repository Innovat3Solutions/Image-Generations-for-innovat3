/**
 * Debug helper: parse a Sunbiz fixed-width file and pretty-print the first
 * few records so field alignment can be verified against real data.
 *   npm run sunbiz:inspect -- path/to/20260805c.txt [count]
 */
import { parseSunbizFile } from './sunbiz.js';

const [file, count = '3'] = process.argv.slice(2);
if (!file) {
  console.error('Usage: npm run sunbiz:inspect -- <file> [count]');
  process.exit(1);
}
const rows = parseSunbizFile(file);
console.log(`Parsed ${rows.length} records from ${file}\n`);
for (const r of rows.slice(0, Number(count))) {
  console.log(JSON.stringify({ ...r, officers_json: JSON.parse(r.officers_json) }, null, 2));
}
