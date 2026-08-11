import { config } from './config.js';

const ENTITY_SUFFIXES = /\b(l\.?l\.?c\.?|inc\.?|corp\.?|corporation|incorporated|company|co\.?|p\.?a\.?|p\.?l\.?|pllc|llp|ltd\.?|limited|enterprises?|group|services?|solutions?|of florida|florida|fl)\b/gi;

/** "SMITH ROOFING OF FLORIDA, LLC" -> "smith roofing" and token list */
export function cleanBusinessName(name) {
  if (!name) return { clean: '', tokens: [] };
  let s = name.toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(ENTITY_SUFFIXES, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = s.split(' ').filter((t) => t.length > 1);
  return { clean: s, tokens };
}

const COMPANY_KEYWORDS = /\b(inc|llc|corp|corporation|co|company|ltd|llp|pllc|pa|pl|group|enterprises?|services?|construction|builders?|contracting|contractors?|plumbing|electric|electrical|roofing|painting|pools?|properties|holdings|associates|partners|solutions|industries|son|sons|bros|brothers|trust|dba)\b|&|#|\d/i;

/** True when a "name" is clearly a business, not a person. */
export function looksLikeCompany(raw) {
  return COMPANY_KEYWORDS.test(raw || '');
}

/** "SMITH, JOHN A JR" (DBPR style) -> { first: "John", last: "Smith", full: "John Smith" } */
export function parsePersonName(raw) {
  if (!raw) return null;
  const s = raw.trim().replace(/\s+/g, ' ');
  if (!s || looksLikeCompany(s)) return null;
  let first, last;
  if (s.includes(',')) {
    const [l, rest] = s.split(',', 2);
    last = l.trim();
    first = (rest || '').trim().split(' ')[0] || '';
  } else {
    const parts = s.split(' ');
    if (parts.length < 2) return null;
    first = parts[0];
    last = parts[parts.length - 1].replace(/^(JR|SR|II|III|IV)$/i, '') || parts[parts.length - 2];
  }
  first = titleCase(first);
  last = titleCase(last);
  if (!first || !last) return null;
  return { first, last, full: `${first} ${last}` };
}

export function titleCase(s) {
  return (s || '').toLowerCase()
    .replace(/(^|[\s\-'])([a-z])/g, (m, p, c) => p + c.toUpperCase())
    .replace(/\b(Llc|Inc|Corp|Pllc|Llp|Lp|Pa|Ltd|Dba|Usa|Ii|Iii|Iv)\b/g, (m) => m.toUpperCase())
    .replace(/'S\b/g, "'s") // possessives: Tommy'S -> Tommy's
    .trim();
}

/**
 * The name you'd actually SAY to the owner: prefer the DBA (that's the brand
 * customers know), drop trailing legal suffixes ("​, INC.", "LLC", "P.A."),
 * and fix shouty registry all-caps. "LONGBOAT KEY BUILDERS, INC." →
 * "Longboat Key Builders". Legal name stays untouched in the record.
 */
export function friendlyBizName(name, dba = null) {
  let n = String(dba || name || '').trim();
  if (!n) return '';
  n = n.replace(/[,\s]+(l\.?l\.?c\.?|inc\.?|corp\.?|corporation|incorporated|p\.?l\.?l\.?c\.?|l\.?l\.?p\.?|p\.?a\.?|p\.?l\.?|ltd\.?|limited)\s*$/i, '');
  n = n.replace(/[,\s]+$/, '');
  if (n === n.toUpperCase() && /[A-Z]{3}/.test(n)) n = titleCase(n);
  return n || String(name || '').trim();
}

/** MM/DD/YYYY or MMDDYYYY -> ISO YYYY-MM-DD (null if invalid) */
export function toISODate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) m = s.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (!m) {
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
  }
  const [, mm, dd, yyyy] = m;
  const month = mm.padStart(2, '0');
  const day = dd.padStart(2, '0');
  if (+month < 1 || +month > 12 || +day < 1 || +day > 31 || +yyyy < 1900) return null;
  return `${yyyy}-${month}-${day}`;
}

export function daysSince(isoDate) {
  if (!isoDate) return Infinity;
  return Math.floor((Date.now() - new Date(isoDate + 'T00:00:00Z').getTime()) / 86400000);
}

/**
 * Zip refinement: zips is a list like ["33101", "334"] — full zips or
 * prefixes (e.g. "334" = all of Palm Beach area). Null/empty = no filter.
 */
export function zipMatches(zip, zips) {
  if (!zips || !zips.length) return true;
  if (!zip) return false;
  const z5 = String(zip).trim().slice(0, 5);
  return zips.some((w) => z5.startsWith(String(w).trim()));
}

export function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  if (digits.length !== 10) return null;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

const FETCH_HEADERS = { 'User-Agent': config.pipeline.userAgent, Accept: 'text/html,application/xhtml+xml,text/csv,*/*' };

export async function fetchWithTimeout(url, opts = {}) {
  const timeout = opts.timeout ?? config.pipeline.requestTimeoutMs;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    return await fetch(url, {
      redirect: 'follow',
      ...opts,
      headers: { ...FETCH_HEADERS, ...(opts.headers || {}) },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

/** Run tasks over items with bounded concurrency. */
export async function mapConcurrent(items, limit, fn, onProgress) {
  const results = new Array(items.length);
  let next = 0, done = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        results[i] = { error: String(err?.message || err) };
      }
      done++;
      if (onProgress) onProgress(done, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export function log(...args) {
  console.log(new Date().toISOString().slice(11, 19), ...args);
}
