/**
 * OpenStreetMap (Overpass API) — free, keyless area prospecting.
 *
 * Different shape from the registries: instead of "new businesses", this
 * answers "what businesses OF TYPE X exist IN ZIP CODES Y" — for reps
 * working a territory. Many POIs carry phone/website tags; the ones
 * without a website are exactly the digital-services targets.
 *
 * Requires zips (an unbounded all-Florida POI dump would be abusive to the
 * free Overpass servers). No established date → recency scores 0, which is
 * correct: these are not known-new businesses.
 */
import { config } from '../config.js';
import { fetchWithTimeout, titleCase, normalizePhone, log } from '../util.js';
import { verticalFromName } from '../verticals.js';

const OSM_TAG_VERTICALS = {
  restaurant: 'restaurants', cafe: 'restaurants', fast_food: 'restaurants', bar: 'restaurants',
  car_repair: 'auto_repair', car: 'auto_repair', tyres: 'auto_repair',
  fitness_centre: 'fitness', sports_centre: 'fitness',
  dentist: 'dental', clinic: 'healthcare', doctors: 'healthcare', veterinary: 'healthcare',
  beauty: 'med_spas', hairdresser: 'home_services', massage: 'med_spas',
};

function buildQuery(zips, categoryKeys) {
  const cats = categoryKeys
    .map((k) => config.osm.categories[k])
    .filter(Boolean);
  const filters = cats.flatMap((c) => c.filters);
  if (!filters.length) return null;
  const zipRe = zips.map((z) => `${String(z).trim()}`).join('|');
  const clauses = filters
    .map((f) => `nwr["addr:postcode"~"^(${zipRe})"][${f}]["name"];`)
    .join('\n  ');
  return `[out:json][timeout:90];\n(\n  ${clauses}\n);\nout center tags 400;`;
}

function mapElement(el, categoryLabelByFilterHit) {
  const t = el.tags || {};
  if (!t.name) return null;
  const phone = normalizePhone(t.phone || t['contact:phone']);
  let website = t.website || t['contact:website'] || null;
  if (website && !/^https?:\/\//.test(website)) website = 'https://' + website;
  const socials = {};
  if (t['contact:facebook']) socials.facebook = t['contact:facebook'];
  if (t['contact:instagram']) socials.instagram = t['contact:instagram'];

  const primaryTag = t.amenity || t.shop || t.craft || t.office || t.leisure || 'POI';
  return {
    source: 'osm',
    source_id: `${el.type}/${el.id}`,
    business_name: titleCase(t.name),
    industry: verticalFromName(t.name) || OSM_TAG_VERTICALS[primaryTag] || 'area_poi',
    license_type: primaryTag,
    entity_status: 'active',
    established_date: null,
    address: [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ') || null,
    city: titleCase(t['addr:city'] || '') || null,
    state: 'FL',
    zip: t['addr:postcode']?.slice(0, 5) || null,
    phone,
    phone_source: phone ? 'osm' : null,
    website,
    website_confidence: website ? 'high' : null, // self-declared by the business
    socials_json: Object.keys(socials).length ? JSON.stringify(socials) : null,
  };
}

export async function fetchOsmProspects({ skipIds = new Set(), limit = Infinity, zips = null, categories = null } = {}) {
  if (!zips || !zips.length) {
    log('osm SKIPPED — area prospecting needs at least one zip code');
    return [];
  }
  const categoryKeys = categories?.length ? categories : Object.keys(config.osm.categories);
  const query = buildQuery(zips, categoryKeys);
  if (!query) return [];
  // The public Overpass servers load-shed often — try mirrors in order
  const endpoints = [...new Set([
    config.osm.overpassUrl,
    'https://overpass.kumi.systems/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
  ])];
  try {
    let data = null, lastErr = null;
    for (const ep of endpoints) {
      try {
        const res = await fetchWithTimeout(ep, {
          method: 'POST',
          timeout: 90000,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(query),
        });
        if (!res.ok) throw new Error(`overpass ${res.status}`);
        data = await res.json();
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (!data) throw lastErr || new Error('all overpass mirrors failed');
    const out = [];
    for (const el of data.elements || []) {
      const p = mapElement(el);
      if (!p) continue;
      if (skipIds.has(p.source_id)) continue;
      out.push(p);
      if (out.length >= limit) break;
    }
    log(`osm → ${out.length} businesses in zips [${zips.join(', ')}]`);
    return out;
  } catch (err) {
    log(`osm SKIPPED — ${err.message}`);
    return [];
  }
}
