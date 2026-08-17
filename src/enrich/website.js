/**
 * Website + social media discovery.
 *
 * Strategy 1 (free): generate candidate domains from the business name,
 * check DNS, fetch the homepage, and verify the business name (or city /
 * contact name) actually appears on the page before accepting it.
 *
 * Strategy 2 (better, needs SERPER_API_KEY): Google search via serper.dev
 * for `"<business name>" <city> FL` and take a matching organic result;
 * also finds Facebook/Instagram pages for website-less businesses.
 */
import dns from 'node:dns/promises';
import * as cheerio from 'cheerio';
import { config, providers } from '../config.js';
import { cleanBusinessName, fetchWithTimeout, normalizePhone } from '../util.js';

const SKIP_DOMAINS = /(facebook|instagram|linkedin|yelp|google|yellowpages|bbb\.org|mapquest|angi|houzz|thumbtack|homeadvisor|buildzoom|manta|dnb\.com|bizapedia|opencorporates|sunbiz|myfloridalicense|zoominfo|crunchbase|indeed|glassdoor|x\.com|twitter|tiktok|youtube|nextdoor|porch\.com|birdeye|alignable)\./i;

function candidateDomains(name) {
  const { tokens } = cleanBusinessName(name);
  if (!tokens.length) return [];
  const { tlds, maxCandidates } = config.enrichment.website;
  const joined = tokens.join('');
  const bases = new Set();
  if (joined.length >= 5 && joined.length <= 30) bases.add(joined);
  if (tokens.length > 1) {
    bases.add(tokens.join('-'));
    bases.add(tokens.map((t) => t[0]).join('') + tokens[tokens.length - 1]);
  }
  bases.add(joined + 'fl');
  const out = [];
  for (const b of bases) {
    if (!/^[a-z0-9-]{4,40}$/.test(b)) continue;
    for (const tld of tlds) out.push(`${b}.${tld}`);
  }
  return out.slice(0, maxCandidates);
}

async function hasDns(domain) {
  try {
    const r = await dns.resolve4(domain);
    return r.length > 0;
  } catch {
    return false;
  }
}

/** Fetch homepage; return { html, $, finalUrl } or null. */
async function fetchHomepage(url) {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('html')) return null;
    const html = (await res.text()).slice(0, 800000);
    return { html, $: cheerio.load(html), finalUrl: res.url || url };
  } catch {
    return null;
  }
}

/** How strongly does this page look like it belongs to the business? */
function matchScore(page, prospect) {
  const { tokens } = cleanBusinessName(prospect.business_name);
  const text = (page.$('title').text() + ' ' + (page.$('meta[name="description"]').attr('content') || '') + ' ' + page.$('h1,h2').text()).toLowerCase();
  const body = page.html.toLowerCase();
  let score = 0;
  const hits = tokens.filter((t) => text.includes(t)).length;
  if (tokens.length && hits === tokens.length) score += 3;
  else if (hits >= Math.ceil(tokens.length / 2)) score += 2;
  else if (tokens.length && tokens.filter((t) => body.includes(t)).length === tokens.length) score += 1;
  if (prospect.city && body.includes(prospect.city.toLowerCase())) score += 1;
  if (prospect.contact_name && body.includes(prospect.contact_name.toLowerCase())) score += 2;
  if (prospect.phone && body.replace(/\D/g, '').includes(prospect.phone.replace(/\D/g, ''))) score += 2;
  // Parked-domain tells
  if (/domain (is )?for sale|godaddy|parked|sedoparking|dan\.com/i.test(page.$('title').text())) score = 0;
  return score;
}

const SOCIAL_PATTERNS = {
  facebook: /https?:\/\/(?:www\.)?facebook\.com\/(?!sharer|share|plugins|tr\b)[A-Za-z0-9_.\-/%]+/g,
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/(?!p\/|share)[A-Za-z0-9_.\-/%]+/g,
  linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9_.\-/%]+/g,
  x: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/(?!intent|share)[A-Za-z0-9_]+/g,
  tiktok: /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9_.]+/g,
  youtube: /https?:\/\/(?:www\.)?youtube\.com\/(?:channel|c|user|@)[A-Za-z0-9_.\-/%@]+/g,
  yelp: /https?:\/\/(?:www\.)?yelp\.com\/biz\/[A-Za-z0-9_.\-/%]+/g,
};

export function extractSocials(html) {
  const socials = {};
  for (const [key, re] of Object.entries(SOCIAL_PATTERNS)) {
    const m = html.match(re);
    if (m) socials[key] = m[0].replace(/[").,;]+$/, '');
  }
  return socials;
}

export function extractContactInfo(html) {
  const emails = [...new Set((html.match(/mailto:([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g) || [])
    .map((m) => m.slice(7).toLowerCase())
    .filter((e) => !/\.(png|jpg|gif|webp)$/.test(e) && !/example\.|sentry|wixpress|godaddy/.test(e)))];
  const tels = [...new Set((html.match(/tel:\+?[\d\-. ()]{7,20}/g) || []).map((m) => normalizePhone(m.slice(4))).filter(Boolean))];
  if (!tels.length) {
    const m = html.replace(/<script[\s\S]*?<\/script>/g, '').match(/\(?\b(\d{3})\)?[-. ](\d{3})[-. ](\d{4})\b/);
    if (m) {
      const p = normalizePhone(m[0]);
      if (p) tels.push(p);
    }
  }
  return { emails, phones: tels };
}

async function serperSearch(query) {
  const res = await fetchWithTimeout('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': providers.serper, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, gl: 'us', num: 10 }),
  });
  if (!res.ok) throw new Error(`serper ${res.status}`);
  return res.json();
}

/** SerpAPI fallback — same Google results, normalized to serper's shape. */
async function serpapiSearch(query) {
  const res = await fetchWithTimeout(
    `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=10&api_key=${providers.serpapi}`
  );
  if (!res.ok) throw new Error(`serpapi ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`serpapi: ${data.error}`);
  return { organic: (data.organic_results || []).map((r) => ({ link: r.link })) };
}

/** Google search through whichever paid provider is up: serper → serpapi. */
async function webSearch(query) {
  if (providers.serper) {
    try {
      return await serperSearch(query);
    } catch (err) {
      if (!providers.serpapi) throw err;
    }
  }
  return serpapiSearch(query);
}

/**
 * Discover the prospect's website + socials + on-site contact info.
 * Returns { website, website_confidence, socials, emails, phones }.
 */
export async function discoverWebsite(prospect) {
  const result = { website: null, website_confidence: null, socials: {}, emails: [], phones: [], html: null };
  const minScore = config.enrichment.website.minMatchScore;
  const candidates = [];

  // Already know the site (Google listing / OSM tag — self-declared by the
  // business)? Fetch it directly for signals/socials/contacts; no discovery.
  if (prospect.website) {
    const page = await fetchHomepage(prospect.website);
    if (page) {
      result.website = page.finalUrl.replace(/\/$/, '');
      result.website_confidence = prospect.website_confidence || 'high';
      result.html = page.html;
      Object.assign(result.socials, extractSocials(page.html));
      const info = extractContactInfo(page.html);
      result.emails = info.emails;
      result.phones = info.phones;
      return result;
    }
  }

  // Provider-backed search first (highest quality)
  if (providers.serper || providers.serpapi) {
    try {
      const q = `"${prospect.business_name}" ${prospect.city || ''} FL`;
      const data = await webSearch(q);
      for (const item of (data.organic || []).slice(0, 6)) {
        try {
          const host = new URL(item.link).hostname;
          if (SKIP_DOMAINS.test(host + '/')) {
            const socials = extractSocials(item.link);
            Object.assign(result.socials, socials);
            continue;
          }
          candidates.push(`https://${host}`);
        } catch { /* bad url */ }
      }
    } catch { /* provider down — fall through to guessing */ }
  }

  // Free fallback: domain guessing
  if (!candidates.length) {
    for (const domain of candidateDomains(prospect.business_name)) {
      if (await hasDns(domain)) candidates.push(`https://${domain}`);
      if (candidates.length >= 4) break;
    }
  }

  let best = null;
  for (const url of [...new Set(candidates)].slice(0, 5)) {
    const page = await fetchHomepage(url);
    if (!page) continue;
    const score = matchScore(page, prospect);
    // A redirect to a different host (parked domains, free-site builders)
    // needs stronger evidence than a page served from the guessed domain.
    let required = minScore;
    try {
      if (new URL(page.finalUrl).hostname.replace(/^www\./, '') !== new URL(url).hostname.replace(/^www\./, '')) {
        required = Math.max(minScore, 5);
      }
    } catch { /* keep default */ }
    if (score >= required && (!best || score > best.score)) best = { url: page.finalUrl, page, score };
    if (best && best.score >= 5) break;
  }

  if (best) {
    result.website = best.url.replace(/\/$/, '');
    result.website_confidence = best.score >= 4 ? 'high' : 'medium';
    result.html = best.page.html;
    Object.assign(result.socials, extractSocials(best.page.html));
    const info = extractContactInfo(best.page.html);
    result.emails = info.emails;
    result.phones = info.phones;
  }
  return result;
}
