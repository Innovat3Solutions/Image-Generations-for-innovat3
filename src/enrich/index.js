/**
 * Per-prospect enrichment: website → socials → Apollo → email → phone.
 *
 * Contact-data priority (the sales team's ask: an email or phone, or both):
 *   email: Apollo verified → their own website → Hunter → Apollo unverified
 *          → pattern guess (MX-checked)
 *   phone: state record → Apollo (person, then company) → their website
 */
import { discoverWebsite } from './website.js';
import { findEmail } from './email.js';
import { apolloEnrich } from './apollo.js';
import { analyzeSite } from './site-analysis.js';
import { providers } from '../config.js';
import { parsePersonName } from '../util.js';
import { updateProspect } from '../db.js';

const EMAIL_RANK = { verified: 3, valid_mx: 2, guessed: 1 };

export async function enrichProspect(row) {
  const updates = { enriched_at: new Date().toISOString() };

  const person = row.contact_name ? parsePersonName(row.contact_name) : null;
  const web = await discoverWebsite(row);

  if (web.website) {
    updates.website = web.website;
    updates.website_confidence = web.website_confidence;
    const signals = analyzeSite(web.html);
    if (signals) updates.site_signals_json = JSON.stringify(signals);
  }
  const socials = { ...web.socials };

  const website = updates.website || row.website;
  const domain = website ? new URL(website).hostname.replace(/^www\./, '') : null;

  // Apollo: direct decision-maker email + phone from their B2B graph.
  // Worth a credit whenever we have someone to look up and are still
  // missing an email or a phone.
  let apollo = null;
  if (providers.apollo && (person || domain) && !(row.email && row.phone)) {
    apollo = await apolloEnrich({
      person,
      businessName: row.business_name,
      domain,
      city: row.city,
      state: row.state,
    });
    if (apollo.linkedin && !socials.linkedin) socials.linkedin = apollo.linkedin;
  }

  if (Object.keys(socials).length) updates.socials_json = JSON.stringify(socials);

  // ---- phone: state record > Apollo > their website ----
  if (!row.phone) {
    if (apollo?.phone) {
      updates.phone = apollo.phone;
      updates.phone_source = 'apollo';
    } else if (web.phones.length) {
      updates.phone = web.phones[0];
      updates.phone_source = 'website';
    }
  }

  // ---- email: best confidence wins ----
  const candidates = [];
  if (apollo?.email) {
    candidates.push({ email: apollo.email, email_status: apollo.email_status, email_source: 'apollo' });
  }
  // Apollo verified is as good as it gets — skip the slower fallbacks
  if (!(apollo?.email && apollo.email_status === 'verified')) {
    const found = await findEmail({ ...row, website }, web.emails, person);
    if (found) candidates.push(found);
  }
  candidates.sort((a, b) => (EMAIL_RANK[b.email_status] || 0) - (EMAIL_RANK[a.email_status] || 0));
  if (candidates.length) Object.assign(updates, candidates[0]);

  updateProspect(row.id, updates);
  return { ...row, ...updates };
}
