/**
 * Apollo.io enrichment (APOLLO_API_KEY).
 *
 * We feed Apollo what the state records already gave us — decision-maker
 * name, business name, domain (when found), city/state — and get back
 * direct contact data: verified work email, phone, LinkedIn, title.
 *
 *   People Match:       POST /api/v1/people/match        (person email/phone)
 *   Org Enrichment:     GET  /api/v1/organizations/enrich (company phone)
 *
 * Notes: people/match consumes an Apollo export credit per match. Phone
 * numbers come from the person's organization record (synchronous);
 * Apollo's per-person mobile reveal is async/webhook-only, so it is not
 * used here.
 */
import { providers } from '../config.js';
import { fetchWithTimeout, normalizePhone, log } from '../util.js';

const BASE = 'https://api.apollo.io/api/v1';

// Apollo failures must be LOUD — a bad key/plan silently produces the
// same output as "person not found", which hides real problems.
let errorLogCount = 0;
export function logApolloError(err) {
  if (errorLogCount < 5) {
    log(`APOLLO ERROR: ${err.message} — check the key's endpoint permissions and that your plan includes API access`);
    errorLogCount++;
    if (errorLogCount === 5) log('APOLLO ERROR: (further Apollo errors suppressed this session)');
  }
}

/** Live credential check for the provider-status panel. */
export async function checkApollo() {
  if (!providers.apollo) return { configured: false };
  try {
    const res = await fetchWithTimeout('https://api.apollo.io/api/v1/auth/health', {
      headers: { 'X-Api-Key': providers.apollo }, timeout: 8000,
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.is_logged_in) return { configured: true, ok: true };
    return {
      configured: true, ok: false,
      error: res.status === 401 ? 'Key rejected (401) — wrong or revoked key'
        : res.status === 403 ? 'Forbidden (403) — plan has no API access or key lacks endpoint permissions'
        : `auth check failed (${res.status})`,
    };
  } catch (err) {
    return { configured: true, ok: false, error: String(err.message || err) };
  }
}

async function apolloFetch(path, opts = {}) {
  const res = await fetchWithTimeout(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': providers.apollo,
      ...(opts.headers || {}),
    },
  });
  if (res.status === 429) throw new Error('apollo rate limit (429)');
  if (!res.ok) throw new Error(`apollo ${res.status}`);
  return res.json();
}

function mapEmailStatus(apolloStatus) {
  if (apolloStatus === 'verified') return 'verified';
  if (apolloStatus === 'guessed') return 'guessed';
  return 'valid_mx'; // extrapolated / unavailable-status but email present
}

function pickPhone(person) {
  const org = person?.organization || {};
  const candidates = [
    ...(person?.phone_numbers || []).map((p) => p?.sanitized_number || p?.raw_number),
    org.primary_phone?.number,
    org.phone,
    org.sanitized_phone,
  ];
  for (const c of candidates) {
    const p = normalizePhone(c);
    if (p) return p;
  }
  return null;
}

/**
 * Enrich one prospect through Apollo.
 * @param {object} args { person: {first,last}|null, businessName, domain|null, city, state }
 * @returns {object} { email, email_status, phone, linkedin, title } (all nullable)
 */
export async function apolloEnrich({ person, businessName, domain, city, state }) {
  const out = { email: null, email_status: null, phone: null, linkedin: null, title: null };
  if (!providers.apollo) return out;

  // --- Person match (best: direct decision-maker contact) ---
  if (person) {
    try {
      const body = {
        first_name: person.first,
        last_name: person.last,
        reveal_personal_emails: false,
      };
      if (domain) body.domain = domain;
      if (businessName) body.organization_name = businessName;
      const data = await apolloFetch('/people/match', { method: 'POST', body: JSON.stringify(body) });
      const p = data?.person;
      if (p) {
        if (p.email && !/email_not_unlocked/.test(p.email)) {
          out.email = p.email.toLowerCase();
          out.email_status = mapEmailStatus(p.email_status);
        }
        out.phone = pickPhone(p);
        out.linkedin = p.linkedin_url || null;
        out.title = p.title || null;
      }
    } catch (err) {
      logApolloError(err);
    }
  }

  // --- Organization enrichment (company phone when person match missed) ---
  if (!out.phone && domain) {
    try {
      const data = await apolloFetch(`/organizations/enrich?domain=${encodeURIComponent(domain)}`);
      const org = data?.organization;
      if (org) {
        out.phone = normalizePhone(org.primary_phone?.number || org.phone || org.sanitized_phone);
        if (!out.linkedin) out.linkedin = org.linkedin_url || null;
      }
    } catch (err) {
      logApolloError(err);
    }
  }

  return out;
}
