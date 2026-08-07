/**
 * SAM.gov — federal contractor registrations (Entity Management API).
 * Free API key from https://sam.gov (Account Details → API Key) or
 * https://api.data.gov. Entities include a Government Business POC with
 * name — and often email — plus registration date and address.
 *
 * Set SAM_API_KEY to enable. Good fit for selling to businesses that
 * just registered to win government work (they're investing in growth).
 */
import { config } from '../config.js';
import { fetchWithTimeout, titleCase, normalizePhone, zipMatches, toISODate, daysSince, log } from '../util.js';

const BASE = 'https://api.sam.gov/entity-information/v3/entities';

function fmtDate(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function mapEntity(e) {
  const reg = e.entityRegistration || {};
  const core = e.coreData || {};
  const addr = core.physicalAddress || {};
  const pocs = e.pointsOfContact || {};
  const poc = pocs.governmentBusinessPOC || pocs.electronicBusinessPOC || {};

  const name = reg.legalBusinessName;
  if (!name) return null;
  const established = toISODate(reg.registrationDate) || toISODate(core.entityInformation?.entityStartDate);

  const contact_name = poc.firstName && poc.lastName
    ? `${titleCase(poc.firstName)} ${titleCase(poc.lastName)}` : null;

  return {
    source: 'sam',
    source_id: reg.ueiSAM || reg.cageCode || name,
    business_name: titleCase(name),
    dba_name: reg.dbaName ? titleCase(reg.dbaName) : null,
    industry: 'gov_contractors',
    license_type: 'SAM.gov Registrant',
    entity_status: (reg.registrationStatus || '').toLowerCase() === 'active' ? 'active' : 'inactive',
    established_date: established,
    address: [addr.addressLine1, addr.addressLine2].filter(Boolean).join(', ') || null,
    city: titleCase(addr.city) || null,
    state: addr.stateOrProvinceCode || config.sam.state,
    zip: (addr.zipCode || '').slice(0, 5) || null,
    contact_name,
    contact_title: contact_name ? (poc.title || 'Government Business POC') : null,
    contact_source: contact_name ? 'sam_poc' : null,
    email: poc.email ? String(poc.email).toLowerCase() : null,
    email_status: poc.email ? 'valid_mx' : null,
    email_source: poc.email ? 'sam' : null,
    phone: normalizePhone(poc.usPhone || core.entityInformation?.phone),
    phone_source: poc.usPhone ? 'sam' : null,
  };
}

export async function fetchSamProspects({ days = 180, skipIds = new Set(), limit = Infinity, zips = null } = {}) {
  const key = process.env.SAM_API_KEY;
  if (!key) {
    log('sam SKIPPED — no SAM_API_KEY set');
    return [];
  }
  const from = new Date(Date.now() - days * 86400000);
  const out = [];
  let page = 0;
  try {
    while (out.length < limit && page < 10) {
      const params = new URLSearchParams({
        api_key: key,
        registrationStatus: 'A',
        physicalAddressProvinceOrStateCode: config.sam.state,
        registrationDate: `[${fmtDate(from)},${fmtDate(new Date())}]`,
        includeSections: 'entityRegistration,coreData,pointsOfContact',
        page: String(page),
        size: '100',
      });
      const res = await fetchWithTimeout(`${BASE}?${params}`, { timeout: 60000 });
      if (!res.ok) throw new Error(`sam api ${res.status}`);
      const data = await res.json();
      const entities = data.entityData || [];
      if (!entities.length) break;
      for (const e of entities) {
        const p = mapEntity(e);
        if (!p || !p.established_date) continue;
        if (p.entity_status !== 'active') continue;
        if (skipIds.has(p.source_id)) continue;
        if (daysSince(p.established_date) > days) continue;
        if (!zipMatches(p.zip, zips)) continue;
        out.push(p);
        if (out.length >= limit) break;
      }
      page++;
    }
    log(`sam → ${out.length} new FL registrants (last ${days}d)`);
  } catch (err) {
    log(`sam SKIPPED — ${err.message}`);
  }
  return out;
}
