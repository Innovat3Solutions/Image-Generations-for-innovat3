/**
 * Per-prospect enrichment: website → socials → contact info → email → phone.
 */
import { discoverWebsite } from './website.js';
import { findEmail } from './email.js';
import { parsePersonName } from '../util.js';
import { updateProspect } from '../db.js';

export async function enrichProspect(row) {
  const updates = { enriched_at: new Date().toISOString() };

  const person = row.contact_name ? parsePersonName(row.contact_name) : null;
  const web = await discoverWebsite(row);

  if (web.website) {
    updates.website = web.website;
    updates.website_confidence = web.website_confidence;
  }
  if (Object.keys(web.socials).length) updates.socials_json = JSON.stringify(web.socials);

  // Phone: keep source-record phone if present, else use one from their site
  if (!row.phone && web.phones.length) {
    updates.phone = web.phones[0];
    updates.phone_source = 'website';
  }

  const emailHit = await findEmail(
    { ...row, website: updates.website || row.website },
    web.emails,
    person
  );
  if (emailHit) Object.assign(updates, emailHit);

  updateProspect(row.id, updates);
  return { ...row, ...updates };
}
