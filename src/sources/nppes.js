/**
 * NPPES — the national registry of every US healthcare provider and
 * organization (NPI numbers). CMS publishes free weekly files of newly
 * enumerated / updated providers:
 *   https://download.cms.gov/nppes/NPI_Files.html
 *
 * The weekly zip (~5-10 MB) contains a CSV with practice address, PHONE,
 * the provider's name, and — for organizations — the AUTHORIZED OFFICIAL's
 * name, title and phone: a named decision maker for free.
 *
 * We stream the zip → csv and keep Florida rows enumerated inside the
 * window. Perfect feed for selling into new clinics/practices.
 */
import { Readable } from 'node:stream';
import unzipper from 'unzipper';
import { parse } from 'csv-parse';
import { config } from '../config.js';
import { fetchWithTimeout, toISODate, daysSince, titleCase, normalizePhone, zipMatches, log } from '../util.js';

async function findWeeklyFileUrls() {
  const res = await fetchWithTimeout(config.nppes.filesPage, { timeout: 30000 });
  if (!res.ok) throw new Error(`NPPES files page ${res.status}`);
  const html = await res.text();
  // CMS ships V2 weekly files (V1 retired); links may be relative
  const urls = [...html.matchAll(/[A-Za-z0-9_.\/-]*NPPES_Data_Dissemination_\d{6}_\d{6}_Weekly[A-Za-z0-9_.]*\.zip/gi)]
    .map((m) => new URL(m[0], config.nppes.filesPage).href);
  if (!urls.length) throw new Error('no weekly NPPES file found on files page');
  // newest first (file names carry MMDDYY ranges in order on the page)
  return [...new Set(urls)].sort().reverse();
}

function mapRow(r, board = null) {
  const get = (k) => (r[k] || '').trim();
  const entityType = get('Entity Type Code'); // 1 = individual, 2 = organization
  if (!entityType) return null;
  const state = get('Provider Business Practice Location Address State Name');
  if (state !== config.nppes.state) return null;
  const enumDate = toISODate(get('Provider Enumeration Date'));
  if (!enumDate) return null;

  const npi = get('NPI');
  const orgName = get('Provider Organization Name (Legal Business Name)');
  const first = get('Provider First Name');
  const last = get('Provider Last Name (Legal Name)');
  const isOrg = entityType === '2';
  const businessName = isOrg
    ? titleCase(orgName)
    : `${titleCase(first)} ${titleCase(last)}`.trim();
  if (!businessName) return null;

  // Decision maker: orgs name an authorized official; individuals are
  // their own decision maker.
  let contact_name = null, contact_title = null;
  if (isOrg) {
    const aoFirst = get('Authorized Official First Name');
    const aoLast = get('Authorized Official Last Name');
    if (aoFirst && aoLast) {
      contact_name = `${titleCase(aoFirst)} ${titleCase(aoLast)}`;
      contact_title = titleCase(get('Authorized Official Title or Position')) || 'Authorized Official';
    }
  } else if (first && last) {
    contact_name = `${titleCase(first)} ${titleCase(last)}`;
    contact_title = get('Provider Credential Text') || 'Provider';
  }

  const phone = normalizePhone(get('Provider Business Practice Location Address Telephone Number'))
    || normalizePhone(get('Authorized Official Telephone Number'));

  return {
    source: 'nppes',
    source_id: npi,
    business_name: businessName,
    industry: 'healthcare',
    license_type: `NPI ${entityType === '2' ? 'Organization' : 'Provider'} — ${get('Healthcare Provider Taxonomy Code_1') || 'unclassified'}`,
    entity_status: 'active',
    established_date: enumDate,
    address: [get('Provider First Line Business Practice Location Address'), get('Provider Second Line Business Practice Location Address')].filter(Boolean).join(', ') || null,
    city: titleCase(get('Provider Business Practice Location Address City Name')) || null,
    state,
    zip: get('Provider Business Practice Location Address Postal Code')?.slice(0, 5) || null,
    contact_name,
    contact_title,
    contact_source: contact_name ? 'nppes_official' : null,
    phone,
    phone_source: phone ? 'nppes' : null,
  };
}

export async function fetchNppesProspects({ days = 180, skipIds = new Set(), limit = Infinity, zips = null } = {}) {
  let urls;
  try {
    urls = await findWeeklyFileUrls();
  } catch (err) {
    log(`nppes SKIPPED — ${err.message}`);
    return [];
  }
  const out = [];
  for (const url of urls.slice(0, 4)) { // up to ~a month of weeklies
    if (out.length >= limit) break;
    try {
      log(`nppes downloading ${url.split('/').pop()}`);
      const res = await fetchWithTimeout(url, { timeout: 300000 });
      if (!res.ok) throw new Error(`download ${res.status}`);
      const zip = Readable.fromWeb(res.body).pipe(unzipper.Parse({ forceStream: true }));
      for await (const entry of zip) {
        const name = entry.path;
        // The data file: npidata_pfile_*.csv (skip the *_fileheader variant)
        if (!/^npidata_pfile_.*\.csv$/i.test(name) || /fileheader/i.test(name)) {
          entry.autodrain();
          continue;
        }
        const parser = entry.pipe(parse({ columns: true, relax_column_count: true, relax_quotes: true }));
        let total = 0, kept = 0;
        for await (const row of parser) {
          total++;
          const p = mapRow(row);
          if (!p) continue;
          if (skipIds.has(p.source_id)) continue;
          if (daysSince(p.established_date) > days) continue;
          if (!zipMatches(p.zip, zips)) continue;
          out.push(p);
          kept++;
          if (out.length >= limit) {
            parser.destroy();
            break;
          }
        }
        log(`nppes ${name}: ${total} rows → ${kept} new FL providers`);
        break; // one data file per zip
      }
    } catch (err) {
      log(`nppes ${url.split('/').pop()} SKIPPED — ${err.message}`);
    }
  }
  return out;
}
