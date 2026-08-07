/**
 * Market intelligence — U.S. Census County Business Patterns (CBP).
 * Answers "WHERE should we prospect <vertical>?" with establishment
 * counts per Florida county for the vertical's NAICS codes.
 *
 * Free key: https://api.census.gov/data/key_signup.html → CENSUS_API_KEY
 * (the API works unkeyed for light use; a key removes throttling).
 */
import { fetchWithTimeout, log } from './util.js';

// Vertical → NAICS 2017 codes (CBP publishes at 2-6 digit NAICS)
export const VERTICAL_NAICS = {
  roofing: ['238160'],
  hvac: ['238220'],
  plumbing: ['238220'],           // plumbing+HVAC share 238220 (Plumbing, Heating, AC)
  electrical: ['238210'],
  general_contractors: ['236118', '236220'],
  law_firms: ['541110'],
  med_spas: ['812199', '621399'],
  dental: ['621210'],
  real_estate: ['531210'],
  property_management: ['531311'],
  accounting: ['541211', '541213', '541219'],
  insurance: ['524210'],
  auto_repair: ['811111', '811121'],
  fitness: ['713940'],
  home_services: ['561720', '561730', '561710'],
  restaurants: ['722511', '722513'],
  healthcare: ['621111'],
};

// FIPS → county name for the big FL counties (API also returns NAME)
const CBP_URL = 'https://api.census.gov/data/2022/cbp';

export async function marketsForVertical(vertical) {
  const naicsList = VERTICAL_NAICS[vertical];
  if (!naicsList) return { error: `no NAICS mapping for vertical '${vertical}'` };
  const key = process.env.CENSUS_API_KEY;
  const results = new Map();
  for (const naics of naicsList) {
    const params = new URLSearchParams({
      get: 'NAME,ESTAB,EMP',
      for: 'county:*',
      in: 'state:12', // Florida
      NAICS2017: naics,
    });
    if (key) params.set('key', key);
    const res = await fetchWithTimeout(`${CBP_URL}?${params}`, { timeout: 30000 });
    if (!res.ok) throw new Error(`census api ${res.status}`);
    const body = await res.text();
    if (body.trimStart().startsWith('<')) {
      throw new Error('Census API needs CENSUS_API_KEY — free instant key at https://api.census.gov/data/key_signup.html');
    }
    const rows = JSON.parse(body); // [header, ...rows]
    const [header, ...data] = rows;
    const idx = Object.fromEntries(header.map((h, i) => [h, i]));
    for (const r of data) {
      const county = r[idx.NAME].replace(/ County, Florida$/, '');
      const estab = Number(r[idx.ESTAB]) || 0;
      const emp = Number(r[idx.EMP]) || 0;
      const cur = results.get(county) || { county, establishments: 0, employees: 0 };
      cur.establishments += estab;
      cur.employees += emp;
      results.set(county, cur);
    }
  }
  const markets = [...results.values()].sort((a, b) => b.establishments - a.establishments);
  log(`census: ${vertical} → ${markets.length} FL counties`);
  return { vertical, naics: naicsList, markets: markets.slice(0, 20) };
}
