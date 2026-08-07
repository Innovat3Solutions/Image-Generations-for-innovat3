/**
 * Live provider diagnostics — answers "are my API keys actually working?"
 * with a real authenticated call per provider, not just "key present".
 */
import { providers } from '../config.js';
import { fetchWithTimeout } from '../util.js';
import { checkApollo } from './apollo.js';

async function checkSerper() {
  if (!providers.serper) return { configured: false };
  try {
    const res = await fetchWithTimeout('https://google.serper.dev/search', {
      method: 'POST', timeout: 8000,
      headers: { 'X-API-KEY': providers.serper, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: 'ping', num: 1 }),
    });
    if (res.ok) return { configured: true, ok: true };
    return { configured: true, ok: false, error: res.status === 403 || res.status === 401 ? `Key rejected (${res.status})` : res.status === 429 ? 'Out of credits (429)' : `error ${res.status}` };
  } catch (err) {
    return { configured: true, ok: false, error: String(err.message || err) };
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
  const [apollo, serper, hunter, sam, census] = await Promise.all([
    checkApollo(), checkSerper(), checkHunter(), checkSam(), checkCensus(),
  ]);
  return {
    apollo: { label: 'Apollo (emails + phones)', ...apollo },
    serper: { label: 'Serper (website discovery)', ...serper },
    hunter: { label: 'Hunter (email finding)', ...hunter },
    sam: { label: 'SAM.gov (contractor source)', ...sam },
    census: { label: 'Census (market intel)', ...census },
  };
}
