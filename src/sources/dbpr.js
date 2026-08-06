/**
 * DBPR — Florida Department of Business & Professional Regulation.
 *
 * DBPR publishes free "licensee data extract" CSVs, refreshed daily/weekly:
 *   https://www2.myfloridalicense.com/sto/file_download/extracts/<file>.csv
 * (linked from each board's "Public Records" page on myfloridalicense.com)
 *
 * File layout (quote/comma delimited, no header row):
 *   0 Board Number          8 City                 16 Effective Date
 *   1 Occupation/Lic Code   9 State                17 Expiration Date
 *   2 Licensee Name        10 Zip                  18 Renewal Period
 *   3 Doing Business As    11 County Code          19 (blank)
 *   4 Class Code           12 License Number       20 Alternate License #
 *   5 Address 1            13 Primary Status       21 CE Exemption
 *   6 Address 2            14 Secondary Status
 *   7 Address 3            15 Original Licensure Date
 *
 * "New" prospects = Original Licensure Date within the window. Rows without
 * an original date fall back to Effective Date ONLY when the license number
 * is absent from our DB and the effective date is inside the window (renewals
 * also bump the effective date, so those are marked lower-confidence).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { config, DOWNLOADS_DIR } from '../config.js';
import { fetchWithTimeout, toISODate, daysSince, parsePersonName, titleCase, log } from '../util.js';

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // extracts refresh at most daily

async function downloadExtract(board) {
  const url = config.dbpr.baseUrl + board.file;
  const cachePath = path.join(DOWNLOADS_DIR, `dbpr_${board.key}.csv`);
  const stat = fs.existsSync(cachePath) ? fs.statSync(cachePath) : null;
  if (stat && Date.now() - stat.mtimeMs < CACHE_TTL_MS) {
    log(`dbpr:${board.key} using cached extract (${(stat.size / 1e6).toFixed(1)} MB)`);
    return cachePath;
  }
  log(`dbpr:${board.key} downloading ${url}`);
  const res = await fetchWithTimeout(url, { timeout: 300000 });
  if (!res.ok) throw new Error(`DBPR download failed (${res.status}) for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(cachePath, buf);
  log(`dbpr:${board.key} downloaded ${(buf.length / 1e6).toFixed(1)} MB`);
  return cachePath;
}

// Placeholder DBA values DBPR uses that are not real business names
const DBA_PLACEHOLDERS = new Set(['INDIVIDUAL', 'N/A', 'NA', 'NONE', 'SAME', 'DBA', 'SELF']);

function parseRow(row, board) {
  const [
    , licCode, licenseeName, rawDba, , addr1, addr2, addr3,
    city, state, zip, county, licNumber, primaryStatus, secondaryStatus,
    originalDate, effectiveDate, , , , altLicense,
  ] = row.map((c) => (c || '').trim());

  // "QB" (qualified business) rows carry no license number and unreliable
  // dates — skip anything without a real license number.
  if (!licNumber && !altLicense) return null;

  const dbaName = DBA_PLACEHOLDERS.has(rawDba.toUpperCase()) ? '' : rawDba;
  const original = toISODate(originalDate);
  const effective = toISODate(effectiveDate);
  const person = parsePersonName(licenseeName);
  const isBusinessRecord = !!dbaName || !person;
  const businessName = dbaName || (person ? person.full : titleCase(licenseeName));

  return {
    source: 'dbpr',
    source_id: altLicense || `${licCode}${licNumber}`,
    business_name: businessName,
    dba_name: dbaName || null,
    industry: board.key,
    license_type: `${licCode} — ${board.label}`,
    entity_status: primaryStatus === 'C' && secondaryStatus === 'A' ? 'active' : 'inactive',
    established_date: original || effective,
    established_confidence: original ? 'original_license_date' : 'effective_date',
    address: [addr1, addr2, addr3].filter(Boolean).join(', ') || null,
    city: titleCase(city) || null,
    state: state || 'FL',
    zip: zip || null,
    county: county || null,
    contact_name: person ? person.full : null,
    contact_title: person ? (isBusinessRecord ? 'Owner / License Holder' : 'Licensee') : null,
    contact_source: person ? 'dbpr_licensee' : null,
    _person: person,
  };
}

/**
 * Fetch new licensees across enabled boards.
 * @param {object} opts { days, boards: [keys], skipIds: Set, limit }
 * @returns {Array} prospect rows (not yet inserted)
 */
export async function fetchDbprProspects({ days = 180, boards = null, skipIds = new Set(), limit = Infinity } = {}) {
  const enabled = config.dbpr.boards.filter(
    (b) => (boards ? boards.includes(b.key) : b.enabled)
  );
  // Split the budget across boards so the first board can't starve the rest
  const perBoard = Number.isFinite(limit) ? Math.ceil(limit / Math.max(1, enabled.length)) : Infinity;
  const out = [];
  for (const board of enabled) {
    if (out.length >= limit) break;
    const boardCap = Math.min(limit, out.length + perBoard);
    let filePath;
    try {
      filePath = await downloadExtract(board);
    } catch (err) {
      log(`dbpr:${board.key} SKIPPED — ${err.message}`);
      continue;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const rows = parse(raw, { relax_column_count: true, relax_quotes: true, skip_empty_lines: true });
    let kept = 0;
    for (const row of rows) {
      if (row.length < 18) continue;
      const p = parseRow(row, board);
      if (!p || !p.business_name || !p.established_date) continue;
      if (p.entity_status !== 'active') continue;
      if (skipIds.has(p.source_id)) continue;
      if (daysSince(p.established_date) > days) continue;
      // Effective-date-only rows are often renewals, not new licenses —
      // require the true original licensure date unless it is missing
      // for the whole board file (some boards omit it).
      if (p.established_confidence !== 'original_license_date') continue;
      out.push(p);
      kept++;
      if (out.length >= boardCap) break;
    }
    log(`dbpr:${board.key} parsed ${rows.length} rows → ${kept} new licensees (last ${days}d)`);
  }
  return out;
}
