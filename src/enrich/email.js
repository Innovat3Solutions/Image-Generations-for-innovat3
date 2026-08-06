/**
 * Email discovery + verification, in descending order of quality:
 *   1. Email scraped from the business's own website  → verify
 *   2. Hunter.io domain search (HUNTER_API_KEY)       → 'verified'
 *   3. Pattern guessing (info@, {first}@, …) + MX check → 'guessed'/'valid_mx'
 *
 * Verification levels stored in email_status:
 *   'verified'  — confirmed deliverable by a provider (Hunter/ZeroBounce)
 *   'valid_mx'  — domain accepts mail (MX records exist); address plausible
 *   'guessed'   — pattern guess on a mail-enabled domain
 *   'invalid'   — provider says undeliverable / domain has no MX
 */
import dns from 'node:dns/promises';
import { config, providers } from '../config.js';
import { fetchWithTimeout } from '../util.js';

const mxCache = new Map();
export async function domainHasMx(domain) {
  if (mxCache.has(domain)) return mxCache.get(domain);
  let ok = false;
  try {
    const mx = await dns.resolveMx(domain);
    ok = mx.length > 0;
  } catch { /* NXDOMAIN / no MX */ }
  mxCache.set(domain, ok);
  return ok;
}

async function hunterVerify(email) {
  const res = await fetchWithTimeout(
    `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${providers.hunter}`
  );
  if (!res.ok) throw new Error(`hunter ${res.status}`);
  const { data } = await res.json();
  if (data.status === 'valid') return 'verified';
  if (data.status === 'invalid') return 'invalid';
  return 'valid_mx'; // accept_all / webmail / unknown
}

async function zerobounceVerify(email) {
  const res = await fetchWithTimeout(
    `https://api.zerobounce.net/v2/validate?api_key=${providers.zerobounce}&email=${encodeURIComponent(email)}`
  );
  if (!res.ok) throw new Error(`zerobounce ${res.status}`);
  const data = await res.json();
  if (data.status === 'valid') return 'verified';
  if (['invalid', 'spamtrap', 'abuse', 'do_not_mail'].includes(data.status)) return 'invalid';
  return 'valid_mx';
}

export async function verifyEmail(email) {
  const domain = email.split('@')[1];
  try {
    if (providers.hunter) return await hunterVerify(email);
    if (providers.zerobounce) return await zerobounceVerify(email);
  } catch { /* provider hiccup — fall back to MX */ }
  return (await domainHasMx(domain)) ? 'valid_mx' : 'invalid';
}

async function hunterDomainSearch(domain, person) {
  const res = await fetchWithTimeout(
    `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${providers.hunter}&limit=10`
  );
  if (!res.ok) throw new Error(`hunter ${res.status}`);
  const { data } = await res.json();
  const emails = data?.emails || [];
  if (!emails.length) return null;
  if (person) {
    const hit = emails.find(
      (e) => (e.first_name || '').toLowerCase() === person.first.toLowerCase()
          || (e.last_name || '').toLowerCase() === person.last.toLowerCase()
    );
    if (hit) return { email: hit.value, status: hit.verification?.status === 'valid' ? 'verified' : 'valid_mx', source: 'hunter' };
  }
  const generic = emails.find((e) => e.type === 'generic') || emails[0];
  return { email: generic.value, status: generic.verification?.status === 'valid' ? 'verified' : 'valid_mx', source: 'hunter' };
}

function patternEmails(domain, person) {
  const out = [];
  for (const pat of config.enrichment.email.patterns) {
    let local = pat;
    if (pat.includes('{')) {
      if (!person) continue;
      local = pat
        .replaceAll('{first}', person.first.toLowerCase())
        .replaceAll('{last}', person.last.toLowerCase())
        .replaceAll('{f}', person.first[0].toLowerCase());
    }
    out.push(`${local}@${domain}`);
  }
  return out;
}

/**
 * Find + verify the best email for a prospect.
 * @param prospect row (may include website)
 * @param scraped  emails found on their website
 * @param person   {first,last} of the decision maker, if known
 */
export async function findEmail(prospect, scraped = [], person = null) {
  // 1. Scraped from their own site — best possible source
  for (const email of scraped.slice(0, 3)) {
    const status = await verifyEmail(email);
    if (status !== 'invalid') return { email, email_status: status, email_source: 'website' };
  }

  const domain = prospect.website ? new URL(prospect.website).hostname.replace(/^www\./, '') : null;
  if (!domain) return null;

  // 2. Hunter domain search
  if (providers.hunter) {
    try {
      const hit = await hunterDomainSearch(domain, person);
      if (hit) return { email: hit.email, email_status: hit.status, email_source: hit.source };
    } catch { /* fall through */ }
  }

  // 3. Pattern guessing against a mail-enabled domain
  if (!(await domainHasMx(domain))) return null;
  const guesses = patternEmails(domain, person);
  if (!guesses.length) return null;
  const guess = guesses[0];
  // A provider can actually validate a guess; MX-only stays 'guessed'
  if (providers.hunter || providers.zerobounce) {
    for (const g of guesses.slice(0, 4)) {
      const status = await verifyEmail(g);
      if (status === 'verified') return { email: g, email_status: 'verified', email_source: 'pattern' };
    }
  }
  return { email: guess, email_status: 'guessed', email_source: 'pattern' };
}
