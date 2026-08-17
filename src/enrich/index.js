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
import { registryCrossRef } from './registry.js';
import { aiSiteExtract, aiExtractAvailable } from './ai-extract.js';
import { config, providers } from '../config.js';
import { parsePersonName, looksLikeCompany, titleCase } from '../util.js';
import { updateProspect } from '../db.js';

const EMAIL_RANK = { verified: 3, valid_mx: 2, guessed: 1 };

export async function enrichProspect(row) {
  const updates = { enriched_at: new Date().toISOString() };

  // Google-first prospects: find the legal entity behind the listing first —
  // it supplies the filing date, and its decision-maker powers the Apollo
  // lookup below.
  if (row.source === 'google' && !row.legal_name) {
    Object.assign(updates, await registryCrossRef(row));
    row = { ...row, ...updates };
  }

  let person = row.contact_name ? parsePersonName(row.contact_name) : null;
  const web = await discoverWebsite(row);

  if (web.website) {
    updates.website = web.website;
    updates.website_confidence = web.website_confidence;
    const signals = analyzeSite(web.html);
    if (signals) updates.site_signals_json = JSON.stringify(signals);
  }
  const socials = { ...web.socials };

  // AI extraction (the ScrapeGraphAI SmartScraper pattern): when the cheap
  // heuristics leave contact gaps, have a model read the site — including
  // contact/about subpages — for emails, phones, and the people behind it.
  const website0 = updates.website || row.website;
  if (aiExtractAvailable() && website0 && (!row.email || !row.phone || !row.contact_name)) {
    const ai = await aiSiteExtract({ ...row, website: website0 }, web.html);
    if (ai) {
      for (const e of ai.emails) if (!web.emails.includes(e)) web.emails.push(e);
      for (const p of ai.phones) if (!web.phones.includes(p)) web.phones.push(p);
      // A named human beats no decision maker — but never overwrite one
      if (!row.contact_name && ai.people.length) {
        const boss = ai.people.find((p) => /owner|founder|principal|president|ceo|broker|dr\.?|doctor/i.test(p.title)) || ai.people[0];
        if (!looksLikeCompany(boss.name)) {
          updates.contact_name = titleCase(boss.name);
          updates.contact_title = boss.title;
          updates.contact_source = 'site_ai';
          person = person || parsePersonName(boss.name);
        }
      }
      // Extra site facts ride along with the signal analysis
      if (ai.facts) {
        const signals = updates.site_signals_json ? JSON.parse(updates.site_signals_json) : {};
        signals.ai = ai.facts;
        updates.site_signals_json = JSON.stringify(signals);
      }
    }
  }

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
  // Strict mode (default): a guessed email — from any provider — is not a
  // contact. Only verified/found addresses are stored.
  const usable = config.enrichment.email.allowGuessed
    ? candidates
    : candidates.filter((c) => c.email_status !== 'guessed');
  usable.sort((a, b) => (EMAIL_RANK[b.email_status] || 0) - (EMAIL_RANK[a.email_status] || 0));
  if (usable.length) Object.assign(updates, usable[0]);

  updateProspect(row.id, updates);
  return { ...row, ...updates };
}
