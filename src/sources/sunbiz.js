/**
 * Sunbiz — Florida Division of Corporations (new entity filings).
 *
 * The Division of State publishes daily data files of every new corporate
 * filing over public SFTP (credentials are published on their site):
 *   host: sftp.floridados.gov   user: Public   password: PubAccess1845!
 *   dir:  /Public/doc/cor/      files: YYYYMMDDc.txt (fixed-width, 1440 chars)
 *   docs: https://dos.fl.gov/sunbiz/other-services/data-downloads/
 *
 * Each daily file = entities entered into the record THAT day, i.e. exactly
 * the "new businesses" feed the sales team wants. Quarterly files exist for
 * backfill; you can also download files manually and feed them in with:
 *   npm run import -- --source sunbiz --file path/to/20260805c.txt
 */
import fs from 'node:fs';
import path from 'node:path';
import { config, DOWNLOADS_DIR } from '../config.js';
import { toISODate, daysSince, titleCase, log } from '../util.js';
import { FIELDS, OFFICER_BLOCKS, FILING_TYPE_LABELS, field } from './sunbiz-layout.js';

// Decision-maker title priority (Sunbiz title codes, best first)
const TITLE_PRIORITY = ['CEO', 'PRES', 'P', 'OWNR', 'MGR', 'MGRM', 'AMBR', 'MEM', 'MGM', 'VP', 'DIR', 'D', 'TRUS', 'SEC', 'TREA', 'S', 'T'];
const TITLE_LABELS = {
  CEO: 'CEO', PRES: 'President', P: 'President', OWNR: 'Owner', MGR: 'Manager',
  MGRM: 'Managing Member', AMBR: 'Authorized Member', MEM: 'Member', MGM: 'Managing Member',
  VP: 'Vice President', DIR: 'Director', D: 'Director', TRUS: 'Trustee',
  SEC: 'Secretary', TREA: 'Treasurer', S: 'Secretary', T: 'Treasurer',
};

/** Sunbiz officer names are usually "LAST FIRST M" or "LAST, FIRST M". */
function sunbizPersonName(raw) {
  if (!raw) return null;
  const s = raw.trim().replace(/\s+/g, ' ');
  if (!s || s.length < 3) return null;
  let last, first;
  if (s.includes(',')) {
    [last, first] = s.split(',', 2).map((x) => x.trim());
    first = (first || '').split(' ')[0];
  } else {
    const parts = s.split(' ');
    if (parts.length < 2) return null;
    [last, first] = parts;
  }
  if (!first || !last || /\d/.test(first + last)) return null;
  return { first: titleCase(first), last: titleCase(last), full: `${titleCase(first)} ${titleCase(last)}` };
}

function parseOfficers(line) {
  const officers = [];
  for (const block of OFFICER_BLOCKS) {
    const name = field(line, block.name);
    if (!name) continue;
    officers.push({
      title: field(line, block.title),
      type: field(line, block.type), // P person / C corporation
      name,
      city: titleCase(field(line, block.city)),
      state: field(line, block.state),
    });
  }
  return officers;
}

function pickDecisionMaker(officers, raName, raType) {
  const people = officers.filter((o) => o.type !== 'C');
  people.sort((a, b) => {
    const ia = TITLE_PRIORITY.indexOf(a.title), ib = TITLE_PRIORITY.indexOf(b.title);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  for (const o of people) {
    const person = sunbizPersonName(o.name);
    if (person) {
      return {
        contact_name: person.full,
        contact_title: TITLE_LABELS[o.title] || o.title || 'Officer',
        contact_source: 'sunbiz_officer',
        _person: person,
      };
    }
  }
  // Fall back to a human registered agent (often the owner for new LLCs)
  if (raName && raType !== 'C') {
    const person = sunbizPersonName(raName);
    if (person) {
      return {
        contact_name: person.full,
        contact_title: 'Registered Agent',
        contact_source: 'sunbiz_ra',
        _person: person,
      };
    }
  }
  return { contact_name: null, contact_title: null, contact_source: null, _person: null };
}

export function parseSunbizLine(line) {
  if (!line || line.length < 500) return null;
  const corpNumber = field(line, FIELDS.corpNumber);
  const corpName = field(line, FIELDS.corpName);
  if (!corpNumber || !corpName) return null;

  const filingType = field(line, FIELDS.filingType);
  const fileDate = toISODate(field(line, FIELDS.fileDate));
  const officers = parseOfficers(line);
  const raName = field(line, FIELDS.raName);
  const raType = field(line, FIELDS.raType);
  const dm = pickDecisionMaker(officers, raName, raType);

  return {
    source: 'sunbiz',
    source_id: corpNumber,
    business_name: titleCase(corpName),
    industry: 'new_business',
    license_type: FILING_TYPE_LABELS[filingType] || filingType || 'Corporate Filing',
    entity_status: field(line, FIELDS.status) === 'A' ? 'active' : 'inactive',
    established_date: fileDate,
    address: [field(line, FIELDS.addr1), field(line, FIELDS.addr2)].filter(Boolean).join(', ') || null,
    city: titleCase(field(line, FIELDS.city)) || null,
    state: field(line, FIELDS.state) || 'FL',
    zip: field(line, FIELDS.zip) || null,
    ...dm,
    officers_json: JSON.stringify({ officers, registeredAgent: { name: raName, type: raType } }),
    _filingType: filingType,
  };
}

export function parseSunbizFile(filePath) {
  const content = fs.readFileSync(filePath, 'latin1');
  const out = [];
  for (const line of content.split(/\r?\n/)) {
    const p = parseSunbizLine(line);
    if (p) out.push(p);
  }
  return out;
}

function excluded(p) {
  const kw = config.sunbiz.excludeNameKeywords || [];
  const upper = p.business_name.toUpperCase();
  return kw.some((k) => upper.includes(k.toUpperCase()));
}

async function downloadDailyFiles(days, maxFiles = 30) {
  const { default: SftpClient } = await import('ssh2-sftp-client');
  const sftp = new SftpClient();
  const { host, user, password, dir } = config.sunbiz.sftp;
  const downloaded = [];
  try {
    await sftp.connect({ host, username: user, password, readyTimeout: 20000 });
    const listing = await sftp.list(dir);
    const cutoff = new Date(Date.now() - days * 86400000);
    const files = listing
      .filter((f) => /^\d{8}c\.txt$/i.test(f.name))
      .filter((f) => {
        const d = new Date(`${f.name.slice(0, 4)}-${f.name.slice(4, 6)}-${f.name.slice(6, 8)}`);
        return d >= cutoff;
      })
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, maxFiles);
    for (const f of files) {
      const local = path.join(DOWNLOADS_DIR, `sunbiz_${f.name}`);
      if (!fs.existsSync(local) || fs.statSync(local).size !== f.size) {
        log(`sunbiz downloading ${f.name} (${(f.size / 1e6).toFixed(1)} MB)`);
        await sftp.fastGet(`${dir}/${f.name}`, local);
      }
      downloaded.push(local);
    }
  } finally {
    await sftp.end().catch(() => {});
  }
  return downloaded;
}

/**
 * Fetch new Sunbiz filings. Uses SFTP daily files; also picks up any
 * manually-imported files already sitting in data/downloads/.
 */
export async function fetchSunbizProspects({ days = 180, skipIds = new Set(), limit = Infinity } = {}) {
  let files = [];
  try {
    files = await downloadDailyFiles(days);
  } catch (err) {
    log(`sunbiz SFTP unavailable (${err.message}) — falling back to local files in data/downloads/`);
  }
  // Include any manually dropped/imported sunbiz files
  for (const f of fs.readdirSync(DOWNLOADS_DIR)) {
    if (/^sunbiz_.*\.txt$/i.test(f)) {
      const full = path.join(DOWNLOADS_DIR, f);
      if (!files.includes(full)) files.push(full);
    }
  }
  if (!files.length) {
    log('sunbiz: no data files available (SFTP blocked and none imported) — skipping');
    return [];
  }

  const out = [];
  const seen = new Set();
  for (const file of files) {
    for (const p of parseSunbizFile(file)) {
      if (out.length >= limit) return out;
      if (seen.has(p.source_id) || skipIds.has(p.source_id)) continue;
      seen.add(p.source_id);
      if (!p.established_date || daysSince(p.established_date) > days) continue;
      if (p.entity_status !== 'active') continue;
      if (excluded(p)) continue;
      out.push(p);
    }
  }
  log(`sunbiz parsed ${files.length} files → ${out.length} new entities (last ${days}d)`);
  return out;
}
