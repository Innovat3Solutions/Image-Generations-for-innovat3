/**
 * Live provider diagnostics — answers "are my API keys actually working?"
 * with a real authenticated call per provider, not just "key present".
 */
import { providers } from '../config.js';
import { fetchWithTimeout } from '../util.js';
import { checkApollo } from './apollo.js';

/**
 * "Key rejected" alone doesn't tell an admin what to FIX. Fingerprint the
 * stored key (safe prefix + length — enough to eyeball against the vendor
 * dashboard, never the whole secret) and flag the classic paste accidents.
 */
function keyInfo(key, expected = null) {
  if (!key) return null;
  const issues = [];
  if (/^["']|["']$/.test(key)) issues.push('wrapped in quotes');
  if (key !== key.trim() || /[\r\n]/.test(key)) issues.push('stray whitespace/line break');
  if (expected?.prefix && !key.startsWith(expected.prefix)) {
    issues.push(`expected to start with "${expected.prefix}"`);
  }
  return {
    fingerprint: `${key.slice(0, 5)}… · ${key.length} chars`,
    issues: issues.length ? issues : undefined,
  };
}

async function checkScrapegraph() {
  if (!providers.scrapegraph) return { configured: false, needsKeyName: 'SCRAPEGRAPHAI_API_KEY' };
  const info = keyInfo(providers.scrapegraph, { prefix: 'sgai-' });
  try {
    // v2 API (v1 rejects newly issued keys as deprecated)
    const res = await fetchWithTimeout('https://v2-api.scrapegraphai.com/api/credits', {
      headers: { 'SGAI-APIKEY': providers.scrapegraph },
      timeout: 10000,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        configured: true, ok: false, keyInfo: info,
        error: `${data?.error?.message || `HTTP ${res.status}`} — re-copy the key from scrapegraphai.com/dashboard (starts with sgai-)`,
      };
    }
    const credits = data?.remaining_credits ?? data?.credits ?? data?.balance;
    return { configured: true, ok: true, keyInfo: info, note: credits != null ? `${credits} credits left` : undefined };
  } catch (err) {
    return { configured: true, ok: false, keyInfo: info, error: String(err.message || err) };
  }
}

async function checkSerper() {
  if (!providers.serper) return { configured: false };
  const info = keyInfo(providers.serper);
  // serper.dev keys are 40 hex chars — a 64-char key is usually from
  // serpapi.com, a different product with the same-sounding name
  if (/^[0-9a-f]{64}$/i.test(providers.serper)) {
    info.issues = [...(info.issues || []), 'looks like a serpapi.com key — this app uses serper.dev (different service)'];
  }
  try {
    const res = await fetchWithTimeout('https://google.serper.dev/search', {
      method: 'POST', timeout: 8000,
      headers: { 'X-API-KEY': providers.serper, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: 'ping', num: 1 }),
    });
    if (res.ok) return { configured: true, ok: true, keyInfo: info };
    const data = await res.json().catch(() => null);
    const vendorMsg = data?.message ? ` — serper says "${data.message}"` : '';
    return {
      configured: true, ok: false, keyInfo: info,
      error: res.status === 403 || res.status === 401
        ? `Key rejected (${res.status})${vendorMsg} — re-copy from serper.dev → Dashboard → API Key`
        : res.status === 429 ? 'Out of credits (429) — top up at serper.dev' : `error ${res.status}${vendorMsg}`,
    };
  } catch (err) {
    return { configured: true, ok: false, keyInfo: info, error: String(err.message || err) };
  }
}

async function checkSerpapi() {
  if (!providers.serpapi) return { configured: false };
  const info = keyInfo(providers.serpapi);
  try {
    const res = await fetchWithTimeout(`https://serpapi.com/account.json?api_key=${providers.serpapi}`, { timeout: 10000 });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.error) {
      return { configured: true, ok: false, keyInfo: info, error: `${data?.error || `HTTP ${res.status}`} — re-copy from serpapi.com/manage-api-key` };
    }
    const left = data?.total_searches_left ?? data?.plan_searches_left;
    return { configured: true, ok: true, keyInfo: info, note: left != null ? `${left} searches left` : undefined };
  } catch (err) {
    return { configured: true, ok: false, keyInfo: info, error: String(err.message || err) };
  }
}

async function checkHunter() {
  if (!providers.hunter) return { configured: false };
  try {
    const res = await fetchWithTimeout(`https://api.hunter.io/v2/account?api_key=${providers.hunter}`, { timeout: 8000 });
    return res.ok
      ? { configured: true, ok: true }
      : { configured: true, ok: false, error: `error ${res.status}` };
  } catch (err) {
    return { configured: true, ok: false, error: String(err.message || err) };
  }
}

async function checkSam() {
  if (!process.env.SAM_API_KEY) return { configured: false };
  try {
    const res = await fetchWithTimeout(
      `https://api.sam.gov/entity-information/v3/entities?api_key=${process.env.SAM_API_KEY}&registrationStatus=A&physicalAddressProvinceOrStateCode=FL&page=0&size=1`,
      { timeout: 10000 }
    );
    return res.ok
      ? { configured: true, ok: true }
      : { configured: true, ok: false, error: `error ${res.status}` };
  } catch (err) {
    return { configured: true, ok: false, error: String(err.message || err) };
  }
}

async function checkCensus() {
  if (!process.env.CENSUS_API_KEY) return { configured: false };
  try {
    const res = await fetchWithTimeout(
      `https://api.census.gov/data/2022/cbp?get=ESTAB&for=state:12&NAICS2017=238220&key=${process.env.CENSUS_API_KEY}`,
      { timeout: 10000 }
    );
    const body = await res.text();
    return res.ok && !body.trimStart().startsWith('<')
      ? { configured: true, ok: true }
      : { configured: true, ok: false, error: 'key rejected' };
  } catch (err) {
    return { configured: true, ok: false, error: String(err.message || err) };
  }
}

export async function providerStatus() {
  const [apollo, serper, serpapi, hunter, sam, census, scrapegraph] = await Promise.all([
    checkApollo(), checkSerper(), checkSerpapi(), checkHunter(), checkSam(), checkCensus(), checkScrapegraph(),
  ]);
  return {
    apollo: { label: 'Apollo (emails + phones)', ...apollo },
    serper: { label: 'Serper (website + listings discovery)', ...serper },
    serpapi: { label: 'SerpAPI (automatic backup for Serper)', ...serpapi },
    hunter: { label: 'Hunter (email finding)', ...hunter },
    sam: { label: 'SAM.gov (contractor source)', ...sam },
    census: { label: 'Census (market intel)', ...census },
    scrapegraph: { label: 'ScrapeGraphAI (AI site extraction)', ...scrapegraph },
    anthropic: { label: 'Claude (AI extraction, outreach & practice)', configured: !!process.env.ANTHROPIC_API_KEY, ok: !!process.env.ANTHROPIC_API_KEY, needsKeyName: 'ANTHROPIC_API_KEY' },
  };
}
