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
import { fetchWithTimeout, normalizePhone } from '../util.js';

const BASE = 'https://api.apollo.io/api/v1';

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
    } catch { /* fall through to org enrichment */ }
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
    } catch { /* no org data */ }
  }

  return out;
}
