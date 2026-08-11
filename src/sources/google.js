/**
 * Google Business listings (via the Serper places API — the same
 * SERPER_API_KEY used for website discovery).
 *
 * Flips discovery around: instead of starting from legal entities
 * ("SMITH HOLDINGS OF FLORIDA, LLC"), this starts from the storefront —
 * the name, phone, website, and reviews a business actually shows
 * customers on Google.
 *
 * Cross-linking: a listing that matches an existing state-registry
 * prospect (same phone or same website domain) is NOT inserted as a
 * duplicate. Instead the existing row is upgraded in place: the Google
 * listing name becomes its dba_name (the brand to use in messages),
 * missing phone/website are filled in, and rating/review counts are
 * attached — which also unlocks the review-based nurture opener.
 *
 * Like OSM, listings carry no founding date, so recency scores 0 —
 * correct, since these are not known-new businesses. Needs zips.
 */
import { db, updateProspect } from '../db.js';
import { providers } from '../config.js';
import { fetchWithTimeout, normalizePhone, log } from '../util.js';
import { verticalFromName } from '../verticals.js';

// What we type into the Google search box, per vertical.
const QUERIES = {
  roofing: 'roofing contractor',
  hvac: 'HVAC company',
  plumbing: 'plumber',
  electrical: 'electrician',
  construction: 'general contractor',
  landscaping: 'landscaping company',
  pool_service: 'pool service',
  home_services: 'home services company',
  auto_repair: 'auto repair shop',
  restaurants: 'restaurant',
  med_spas: 'med spa',
  dental: 'dentist',
  healthcare: 'medical clinic',
  law: 'law firm',
  real_estate: 'real estate agency',
  fitness: 'gym',
};
const DEFAULT_VERTICALS = ['roofing', 'hvac', 'plumbing', 'electrical', 'construction', 'med_spas', 'dental', 'law'];

const domainOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
};

/**
 * Try to attach this listing to a prospect we already track (state
 * registries know the legal entity; Google knows the brand). Returns true
 * when linked, so the caller skips inserting a duplicate.
 */
function crossLink(place) {
  const phone = normalizePhone(place.phoneNumber);
  const domain = place.website ? domainOf(place.website) : null;
  let row = null;
  if (phone) {
    row = db.prepare("SELECT * FROM prospects WHERE phone = ? AND source != 'google'").get(phone);
  }
  if (!row && domain) {
    row = db.prepare("SELECT * FROM prospects WHERE website LIKE ? AND source != 'google'").get(`%${domain}%`);
  }
  if (!row) return false;

  const fields = { google_rating: place.rating ?? null, google_reviews: place.ratingCount ?? null };
  // The listing title is the DBA — the name customers actually know
  if (place.title && place.title.toLowerCase() !== row.business_name.toLowerCase() && !row.dba_name) {
    fields.dba_name = place.title;
  }
  if (!row.phone && phone) { fields.phone = phone; fields.phone_source = 'google'; }
  if (!row.website && place.website) { fields.website = place.website; fields.website_confidence = 'high'; }
  updateProspect(row.id, fields);
  return true;
}

/** "500 Main St, Sarasota, FL 34236" → { street, city, zip } */
function parseAddress(address) {
  if (!address) return { street: null, city: null, zip: null };
  const zip = (address.match(/\bFL\s+(\d{5})/) || [])[1] || null;
  const parts = address.split(',').map((s) => s.trim());
  // last part is "FL 34236" — city is the part before it
  const city = parts.length >= 2 ? parts[parts.length - 2] : null;
  return { street: parts[0] || null, city: /\d/.test(city || '') ? null : city, zip };
}

function mapPlace(place, verticalKey, searchZip) {
  const phone = normalizePhone(place.phoneNumber);
  const addr = parseAddress(place.address);
  return {
    source: 'google',
    source_id: String(place.cid || place.placeId || `${place.title}|${searchZip}`),
    business_name: place.title,
    industry: verticalFromName(place.title) || verticalKey || 'area_poi',
    license_type: place.category || 'Google Business listing',
    entity_status: 'active',
    established_date: null,
    address: addr.street,
    city: addr.city,
    state: 'FL',
    zip: addr.zip || searchZip,
    phone,
    phone_source: phone ? 'google' : null,
    website: place.website || null,
    website_confidence: place.website ? 'high' : null, // self-declared on their listing
    google_rating: place.rating ?? null,
    google_reviews: place.ratingCount ?? null,
  };
}

/**
 * The other direction of the Google-first flow: a registry candidate
 * (Sunbiz filing, DBPR license, …) that matches an existing LISTING
 * prospect is absorbed into it rather than inserted as a duplicate.
 * The listing keeps the brand identity; the registry contributes what
 * only it knows — legal entity, filing/licensure date, decision-maker,
 * officers — plus any contact info the listing lacked.
 */
export function absorbIntoListing(candidate) {
  const domain = candidate.website ? domainOf(candidate.website) : null;
  let row = null;
  if (candidate.phone) {
    row = db.prepare("SELECT * FROM prospects WHERE source = 'google' AND phone = ?").get(candidate.phone);
  }
  if (!row && domain) {
    row = db.prepare("SELECT * FROM prospects WHERE source = 'google' AND website LIKE ?").get(`%${domain}%`);
  }
  if (!row) return false;

  const fields = {};
  if (!row.legal_name) fields.legal_name = candidate.business_name;
  if (!row.established_date && candidate.established_date) fields.established_date = candidate.established_date;
  if (!row.contact_name && candidate.contact_name) {
    fields.contact_name = candidate.contact_name;
    fields.contact_title = candidate.contact_title ?? null;
    fields.contact_source = candidate.contact_source ?? null;
  }
  if (!row.officers_json && candidate.officers_json) fields.officers_json = candidate.officers_json;
  if (!row.phone && candidate.phone) { fields.phone = candidate.phone; fields.phone_source = candidate.phone_source; }
  if (!row.email && candidate.email) {
    fields.email = candidate.email;
    fields.email_status = candidate.email_status ?? null;
    fields.email_source = candidate.email_source ?? null;
  }
  if (!row.county && candidate.county) fields.county = candidate.county;
  if (Object.keys(fields).length) updateProspect(row.id, fields);
  return true;
}

export async function fetchGoogleProspects({ skipIds = new Set(), limit = Infinity, zips = null, boards = null } = {}) {
  if (!providers.serper) {
    log('google SKIPPED — needs SERPER_API_KEY');
    return [];
  }
  if (!zips || !zips.length) {
    log('google SKIPPED — listing discovery needs at least one zip code');
    return [];
  }
  const verticalKeys = (boards?.length ? boards : DEFAULT_VERTICALS).filter((k) => QUERIES[k]);
  const out = [];
  let linked = 0;
  try {
    outer:
    for (const zip of zips) {
      for (const vk of verticalKeys) {
        const res = await fetchWithTimeout('https://google.serper.dev/places', {
          method: 'POST',
          headers: { 'X-API-KEY': providers.serper, 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: `${QUERIES[vk]} near ${zip}`, gl: 'us' }),
        });
        if (!res.ok) throw new Error(`serper places ${res.status}`);
        const data = await res.json();
        for (const place of data.places || []) {
          if (!place.title) continue;
          // stay in-territory: Serper "near <zip>" can drift into neighbors
          if (place.address && !/\bFL\b|Florida/i.test(place.address)) continue;
          if (crossLink(place)) { linked++; continue; }
          const p = mapPlace(place, vk, String(zip));
          if (skipIds.has(p.source_id)) continue;
          if (out.some((x) => x.source_id === p.source_id)) continue;
          out.push(p);
          if (out.length >= limit) break outer;
        }
      }
    }
    log(`google → ${out.length} new listings, ${linked} cross-linked to existing prospects (zips [${zips.join(', ')}])`);
    return out;
  } catch (err) {
    log(`google SKIPPED — ${err.message}`);
    return out;
  }
}
