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

function mapPlace(place, verticalKey, zip) {
  const phone = normalizePhone(place.phoneNumber);
  return {
    source: 'google',
    source_id: String(place.cid || place.placeId || `${place.title}|${zip}`),
    business_name: place.title,
    industry: verticalFromName(place.title) || verticalKey || 'area_poi',
    license_type: place.category || 'Google Business listing',
    entity_status: 'active',
    established_date: null,
    address: place.address || null,
    city: null,
    state: 'FL',
    zip,
    phone,
    phone_source: phone ? 'google' : null,
    website: place.website || null,
    website_confidence: place.website ? 'high' : null, // self-declared on their listing
    google_rating: place.rating ?? null,
    google_reviews: place.ratingCount ?? null,
  };
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
