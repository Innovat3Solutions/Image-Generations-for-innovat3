/**
 * Registry cross-reference — the lookup layer of the Google-first flow.
 *
 * A Google Business listing is the storefront truth: the brand customers
 * see, one listing per location, with phone/website/reviews. What it can't
 * tell us is the entity behind it. This step finds that entity and attaches
 * what only the registries know: legal name, filing/licensure date (recency
 * scoring!), the decision-maker, officers.
 *
 * Lookup order:
 *   1. Our own registry rows (Sunbiz / DBPR / NPPES / SAM ingests) — matched
 *      by phone, then website domain, then name-token overlap in the same
 *      zip/city. When the registry row is an untouched duplicate prospect,
 *      it is folded into the listing and removed, so one business = one row.
 *   2. The free NPPES API (live) for healthcare-family verticals.
 *
 * Sunbiz's live search blocks automated traffic, so entity matching beyond
 * our ingested window depends on running the registry sources regularly.
 */
import { db, updateProspect } from '../db.js';
import { cleanBusinessName, fetchWithTimeout, normalizePhone, titleCase, log } from '../util.js';

const REGISTRY_SOURCES = "('sunbiz','dbpr','nppes','sam')";
const NPPES_VERTICALS = new Set(['healthcare', 'dental', 'med_spas']);

const domainOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; } };

function tokenOverlap(a, b) {
  if (!a.length || !b.length) return 0;
  const set = new Set(b);
  return a.filter((t) => set.has(t)).length / Math.max(a.length, b.length);
}

function localRegistryMatch(row) {
  if (row.phone) {
    const m = db.prepare(`SELECT * FROM prospects WHERE phone = ? AND source IN ${REGISTRY_SOURCES} AND id != ?`)
      .get(row.phone, row.id);
    if (m) return { match: m, how: 'phone' };
  }
  const domain = row.website ? domainOf(row.website) : null;
  if (domain) {
    const m = db.prepare(`SELECT * FROM prospects WHERE website LIKE ? AND source IN ${REGISTRY_SOURCES} AND id != ?`)
      .get(`%${domain}%`, row.id);
    if (m) return { match: m, how: 'website' };
  }
  const { tokens } = cleanBusinessName(row.business_name);
  if (tokens.length) {
    const cands = db.prepare(
      `SELECT * FROM prospects WHERE source IN ${REGISTRY_SOURCES} AND id != ?
       AND (zip = ? OR (city IS NOT NULL AND city = ?)) AND business_name LIKE ?`
    ).all(row.id, row.zip ?? '', row.city ?? '', `%${tokens[0]}%`);
    let best = null, bestScore = 0;
    for (const c of cands) {
      const s = tokenOverlap(tokens, cleanBusinessName(c.business_name).tokens);
      if (s > bestScore) { best = c; bestScore = s; }
    }
    if (best && bestScore >= 0.6) return { match: best, how: 'name+area' };
  }
  return null;
}

/** Fold registry data into the listing's update set (never overwrite the brand). */
function fieldsFromRegistryRow(row, m) {
  const f = {};
  if (!row.legal_name) f.legal_name = m.business_name;
  if (!row.established_date && m.established_date) f.established_date = m.established_date;
  if (!row.contact_name && m.contact_name) {
    f.contact_name = m.contact_name;
    f.contact_title = m.contact_title;
    f.contact_source = m.contact_source;
  }
  if (!row.officers_json && m.officers_json) f.officers_json = m.officers_json;
  if (!row.phone && m.phone) { f.phone = m.phone; f.phone_source = m.phone_source; }
  if (!row.email && m.email && m.email_status !== 'guessed') {
    f.email = m.email; f.email_status = m.email_status; f.email_source = m.email_source;
  }
  if (!row.county && m.county) f.county = m.county;
  if (m.license_type && !/Google Business/i.test(m.license_type || '')) {
    f.license_type = `${row.license_type || 'listing'} · ${m.license_type}`;
  }
  return f;
}

/** True when the duplicate registry prospect can be safely removed. */
function isUntouched(m) {
  if (!['new', 'no_contact'].includes(m.status) || m.notes || m.assigned_to) return false;
  const touches = db.prepare('SELECT COUNT(*) c FROM prospect_touches WHERE prospect_id = ?').get(m.id).c;
  return touches === 0;
}

async function nppesLookup(row) {
  const name = cleanBusinessName(row.business_name).clean;
  if (!name) return null;
  const url = 'https://npiregistry.cms.hhs.gov/api/?version=2.1&enumeration_type=NPI-2'
    + `&organization_name=${encodeURIComponent(name)}*&state=FL&limit=20`;
  // the registry API load-sheds intermittently — one retry rides it out
  let res = await fetchWithTimeout(url, { timeout: 15000 });
  if (!res.ok) {
    await new Promise((r) => setTimeout(r, 1500));
    res = await fetchWithTimeout(url, { timeout: 15000 });
  }
  if (!res.ok) throw new Error(`nppes api ${res.status}`);
  const data = await res.json();
  for (const r of data.results || []) {
    const addr = (r.addresses || []).find((a) => a.address_purpose === 'LOCATION') || (r.addresses || [])[0];
    const phoneMatch = row.phone && addr?.telephone_number && normalizePhone(addr.telephone_number) === row.phone;
    const zipMatch = row.zip && addr?.postal_code?.startsWith(row.zip);
    if (!phoneMatch && !zipMatch) continue;
    const b = r.basic || {};
    const official = [b.authorized_official_first_name, b.authorized_official_last_name].filter(Boolean).join(' ');
    return {
      legal_name: b.organization_name || null,
      established_date: b.enumeration_date
        ? b.enumeration_date.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '$3-$1-$2')
        : null,
      contact_name: official ? titleCase(official) : null,
      contact_title: b.authorized_official_title_or_position ? titleCase(b.authorized_official_title_or_position) : null,
      contact_source: 'nppes_official',
      phone: normalizePhone(addr?.telephone_number),
      phone_source: 'nppes',
      license_type: `${r.number ? `NPI ${r.number}` : 'NPI'}`,
    };
  }
  return null;
}

/**
 * Cross-reference a Google-first prospect against the registries.
 * Returns an updates object for updateProspect (may be empty).
 */
export async function registryCrossRef(row) {
  // 1. Registry data we already hold
  const local = localRegistryMatch(row);
  if (local) {
    const fields = fieldsFromRegistryRow(row, local.match);
    // one business, one row: fold the duplicate prospect away when safe
    if (isUntouched(local.match)) {
      db.prepare('DELETE FROM prospects WHERE id = ?').run(local.match.id);
      log(`registry x-ref: "${row.business_name}" ← ${local.match.source} "${local.match.business_name}" (${local.how}, duplicate folded in)`);
    } else {
      log(`registry x-ref: "${row.business_name}" ← ${local.match.source} "${local.match.business_name}" (${local.how})`);
    }
    return fields;
  }

  // 2. NPPES live for healthcare-family listings
  if (NPPES_VERTICALS.has(row.industry)) {
    try {
      const hit = await nppesLookup(row);
      if (hit) {
        const fields = {};
        for (const [k, v] of Object.entries(hit)) {
          if (v == null || k === 'phone_source') continue;
          if (k === 'license_type') { fields.license_type = `${row.license_type || 'listing'} · ${v}`; continue; }
          if (k === 'phone') { if (!row.phone) { fields.phone = v; fields.phone_source = 'nppes'; } continue; }
          if (!row[k]) fields[k] = v;
        }
        if (Object.keys(fields).length) log(`registry x-ref: "${row.business_name}" ← NPPES API (${hit.legal_name})`);
        return fields;
      }
    } catch (err) {
      log(`registry x-ref: NPPES lookup failed for "${row.business_name}" — ${err.message}`);
    }
  }
  return {};
}

/**
 * Bulk pass used by re-enrich sweeps: cross-reference every listing that
 * still has no legal entity attached.
 */
export async function crossRefAllListings() {
  const rows = db.prepare("SELECT * FROM prospects WHERE source = 'google' AND legal_name IS NULL").all();
  let linked = 0;
  for (const row of rows) {
    const fields = await registryCrossRef(row);
    if (Object.keys(fields).length) {
      updateProspect(row.id, fields);
      linked++;
    }
  }
  return { checked: rows.length, linked };
}
