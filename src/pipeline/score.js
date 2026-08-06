/**
 * Prospect scoring (0–100), fully weight-configurable in config/default.json.
 *
 * Two modes:
 *  - digital_services (default): you SELL websites/branding/marketing, so a
 *    brand-new business with NO website is the opportunity. Contactability
 *    still dominates — a prospect you can't reach is worth nothing.
 *  - reachability: classic lead scoring — established digital presence
 *    scores higher (useful if you sell to businesses that already invest).
 */
import { config } from '../config.js';
import { daysSince } from '../util.js';
import { db, updateProspect } from '../db.js';

export function scoreProspect(p) {
  const w = config.scoring.weights;
  const mode = config.scoring.mode;
  const modeW = w[mode] || w.digital_services;
  const parts = {};

  if (p.contact_name) parts.decision_maker = w.hasContactName;
  if (p.phone) parts.phone = w.hasPhone;

  if (p.email) {
    if (p.email_status === 'verified') parts.email = w.emailVerified;
    else if (p.email_status === 'valid_mx') parts.email = w.emailValidMx;
    else if (p.email_status === 'guessed') parts.email = w.emailGuessed;
  }

  const age = daysSince(p.established_date);
  if (Number.isFinite(age)) {
    // Linear decay: brand-new = full points, 180 days old = 0
    parts.recency = Math.max(0, Math.round(w.recencyMax * (1 - age / 180)));
  }

  if (p.entity_status === 'active') parts.active = w.activeStatus;

  const socials = p.socials_json ? JSON.parse(p.socials_json) : {};
  const hasSocial = Object.keys(socials).length > 0;
  if (p.website) parts.web_presence = modeW.hasWebsite;
  else if (hasSocial) parts.web_presence = modeW.socialOnly;
  else parts.web_presence = modeW.noWebsite;

  const score = Math.min(100, Math.max(0, Object.values(parts).reduce((a, b) => a + b, 0)));
  return { score, breakdown: parts };
}

export function scoreAll({ onlyUnscored = false } = {}) {
  const rows = db.prepare(
    `SELECT * FROM prospects ${onlyUnscored ? 'WHERE score = 0' : ''}`
  ).all();
  for (const row of rows) {
    const { score, breakdown } = scoreProspect(row);
    updateProspect(row.id, { score, score_breakdown_json: JSON.stringify(breakdown) });
  }
  return rows.length;
}
