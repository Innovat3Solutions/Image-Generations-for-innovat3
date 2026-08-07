/**
 * The INNOVAT3 Opportunity Score (0-100) — five buckets:
 *
 *   Business Quality        20  established, real company, decision structure
 *   Digital Opportunity     25  what their web presence is missing
 *   Automation Opportunity  25  how lead/schedule-driven their vertical is +
 *                               missing automation on their own site
 *   Commercial Value        20  what a client in this vertical is worth
 *   Contactability          10  can a rep actually reach them today
 *
 * Tiers: 80+ = 🔥 high · 65-79 = 🟢 strong · 50-64 = 🟡 explore · <50 below pool
 *
 * Alongside the number, scoring emits the DETECTED OPPORTUNITIES (what to
 * pitch) and a one-line CALL REASON — the rep gets a reason, not a row.
 */
import { daysSince } from '../util.js';
import { db, updateProspect } from '../db.js';
import { VERTICALS, DEFAULT_VERTICAL_WEIGHTS } from '../verticals.js';

const j = (s, fallback = null) => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } };

export function scoreProspect(p) {
  const vertical = VERTICALS[p.industry] || null;
  const vw = vertical || DEFAULT_VERTICAL_WEIGHTS;
  const signals = j(p.site_signals_json);
  const socials = j(p.socials_json, {});
  const officers = j(p.officers_json);
  const hasSocial = Object.keys(socials).length > 0;
  const parts = {};

  // ---- Business Quality (20) ----
  let bq = 0;
  if (p.entity_status === 'active') bq += 5;
  const looksLikeCompany = /llc|inc|corp|group|services|company/i.test(p.business_name || '') || !!p.dba_name || p.source_id?.startsWith('HR');
  if (looksLikeCompany) bq += 6;
  if (officers?.officers?.length >= 2) bq += 4;
  if (p.established_date) bq += 5;
  parts.business_quality = Math.min(20, bq);

  // ---- Digital Opportunity (25) — their gaps are our pitch ----
  let dig = 0;
  if (!p.website) {
    dig = hasSocial ? 20 : 25; // social-only still means no owned web presence
  } else if (signals) {
    if (signals.quality < 50) dig += 10;
    else if (signals.quality < 70) dig += 6;
    if (!signals.mobileViewport) dig += 5;
    if (!signals.hasBooking) dig += 4;
    if (!signals.hasChat) dig += 3;
    if (signals.looksStale) dig += 3;
    if (signals.platform === 'free-builder') dig += 3;
  } else {
    dig = 8; // site exists but unanalyzed — assume moderate opportunity
  }
  parts.digital_opportunity = Math.min(25, dig);

  // ---- Automation Opportunity (25) ----
  let auto = Math.min(15, vw.automation ?? 8);
  if (signals) {
    if (signals.hasForm && !signals.hasChat && !signals.hasBooking) auto += 5; // leads in, nothing catches them
    if (p.phone && !signals.hasChat) auto += 3; // phone-centric, no after-hours intake
    if (!signals.hasCrm) auto += 2;
  } else if (p.phone) {
    auto += 5; // phone-only operation
  }
  parts.automation_opportunity = Math.min(25, auto);

  // ---- Commercial Value (20) ----
  parts.commercial_value = Math.min(20, vw.value ?? 8);

  // ---- Contactability (10) ----
  let con = 0;
  if (p.email && p.email_status !== 'invalid') con += p.email_status === 'verified' ? 5 : 4;
  if (p.phone) con += 3;
  if (p.contact_name) con += 2;
  parts.contactability = Math.min(10, con);

  const score = Math.min(100, Math.max(0, Object.values(parts).reduce((a, b) => a + b, 0)));
  const tier = score >= 80 ? 'high' : score >= 65 ? 'strong' : score >= 50 ? 'explore' : 'below';

  const opportunities = detectOpportunities(p, signals, hasSocial, vertical);
  const call_reason = buildCallReason(p, signals, opportunities, vertical, hasSocial);

  return { score, tier, breakdown: parts, opportunities, call_reason };
}

function detectOpportunities(p, signals, hasSocial, vertical) {
  const out = [];
  const add = (key, label, level, why) => out.push({ key, label, level, why });
  const isServiceBiz = (vertical?.automation ?? 8) >= 12;

  if (!p.website) {
    add('website', 'Website build', 'HIGH',
      hasSocial ? 'Active on social but no website of their own.' : 'No web presence found at all.');
  } else if (signals) {
    if (signals.quality < 55) {
      add('website', 'Website redesign', 'HIGH',
        `Site quality ${signals.quality}/100${!signals.mobileViewport ? ', not mobile-optimized' : ''}${signals.looksStale ? `, content dated ${signals.copyrightYear}` : ''}.`);
    } else if (signals.quality < 75) {
      add('website', 'Website improvements', 'MEDIUM', `Site quality ${signals.quality}/100 — functional but leaking leads.`);
    }
    if (signals.hasForm && !signals.hasChat && !signals.hasBooking) {
      add('lead_automation', 'Lead-response automation', 'HIGH',
        'Quote/contact form exists but no immediate-response mechanism detected.');
    }
    if (!signals.hasBooking && isServiceBiz) {
      add('booking', 'Online booking / scheduling', 'HIGH', 'Appointment-driven business with no online booking detected.');
    }
    if (p.phone && !signals.hasChat) {
      add('ai_receptionist', 'AI receptionist / missed-call capture', 'HIGH',
        'Phone-centric operation with no chat or after-hours intake.');
    }
    if (!signals.hasCrm) {
      add('crm', 'CRM implementation', 'MEDIUM', 'No CRM/marketing platform detected on their site.');
    }
    if (!signals.hasAnalytics) {
      add('analytics', 'Tracking & attribution', 'MEDIUM', 'No analytics detected — they can\'t see where leads come from.');
    }
  } else {
    if (p.phone && isServiceBiz) {
      add('ai_receptionist', 'AI receptionist / missed-call capture', 'HIGH', 'Phone-first business — every missed call is a lost job.');
    }
    add('crm', 'CRM & follow-up automation', 'MEDIUM', 'New business building its lead process from scratch.');
  }

  const age = daysSince(p.established_date);
  if (Number.isFinite(age) && age <= 90) {
    add('ground_floor', 'Ground-floor timing', 'HIGH',
      `Established ${age <= 30 ? 'this month' : Math.round(age / 30) + ' months ago'} — infrastructure decisions are being made right now.`);
  }
  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]).slice(0, 5);
}

function buildCallReason(p, signals, opportunities, vertical, hasSocial) {
  const name = p.business_name;
  const vLabel = vertical?.label || 'General';
  const sentences = [];

  const age = daysSince(p.established_date);
  const opener = Number.isFinite(age)
    ? (age <= 45 ? `${name} just launched (${vLabel})` : `${name} launched ~${Math.max(1, Math.round(age / 30))} months ago (${vLabel})`)
    : `${name} is an established business (${vLabel})`;

  const top = opportunities.filter((o) => o.level === 'HIGH' && o.key !== 'ground_floor');
  if (!p.website) {
    sentences.push(`${opener} and has ${hasSocial ? 'social presence but no website — lead with a site + booking bundle' : 'no digital presence yet — lead with the full digital foundation'}.`);
  } else if (top.length) {
    const leads = { lead_automation: 'automated lead follow-up', ai_receptionist: 'missed-call capture and AI intake', website: 'a modern mobile site', booking: 'online scheduling' };
    const pitch = top.map((o) => leads[o.key]).filter(Boolean).slice(0, 2).join(' and ');
    sentences.push(pitch
      ? `${opener}; their site exists but conversion infrastructure is weak — lead with ${pitch}.`
      : `${opener}.`);
  } else {
    sentences.push(`${opener} with solid digital basics — explore automation and scale consulting.`);
  }

  if (p.contact_name) sentences.push(`Ask for ${p.contact_name}${p.contact_title ? ` (${p.contact_title.toLowerCase()})` : ''}.`);
  return sentences.join(' ');
}

export function applyScore(id) {
  const row = db.prepare('SELECT * FROM prospects WHERE id = ?').get(id);
  if (!row) return null;
  const r = scoreProspect(row);
  updateProspect(id, {
    score: r.score,
    tier: r.tier,
    score_breakdown_json: JSON.stringify(r.breakdown),
    opportunities_json: JSON.stringify(r.opportunities),
    call_reason: r.call_reason,
  });
  return r;
}

export function scoreAll() {
  const ids = db.prepare('SELECT id FROM prospects').all();
  for (const { id } of ids) applyScore(id);
  return ids.length;
}
