/**
 * Outreach generator — the first touchpoint: introduce Innovat3, pay a
 * genuine, specific compliment, and ask one light question that invites a
 * reply. NOT a pitch — the goal is a response. Claude-powered when
 * ANTHROPIC_API_KEY is set; a solid template fallback otherwise.
 */
import Anthropic from '@anthropic-ai/sdk';
import { VERTICALS } from './verticals.js';
import { recommendOffer } from './offers.js';
import { daysSince, friendlyBizName } from './util.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';
const BETAS = ['server-side-fallback-2026-07-01'];

let _client = null;
const client = () => (_client ||= new Anthropic());

const j = (s, fb = null) => { try { return s ? JSON.parse(s) : fb; } catch { return fb; } };

/** "Med Spas / Cosmetic Clinics" -> singular "med spa", plural "med spas" */
function verticalNouns(label) {
  let s = (label || 'business').split('/')[0].trim().toLowerCase();
  const isAcronym = /^[A-Z]{2,}$/.test((label || '').split('/')[0].trim());
  if (isAcronym) {
    const a = label.split('/')[0].trim();
    return { singular: `${a} business`, plural: `${a} businesses` };
  }
  if (s.endsWith('s') && !s.endsWith('ss')) s = s.slice(0, -1);
  return { singular: s, plural: `${s}s` };
}

function prospectFacts(p) {
  const age = daysSince(p.established_date);
  const label = VERTICALS[p.industry]?.label || 'business';
  const nouns = verticalNouns(label);
  const signals = j(p.site_signals_json);
  const socials = j(p.socials_json, {});
  return {
    // The name customers know: DBA over legal name, suffixes stripped —
    // "Longboat Key Builders", never "LONGBOAT KEY BUILDERS, INC."
    business: friendlyBizName(p.business_name, p.dba_name),
    legalName: p.business_name,
    googleRating: p.google_rating || null,
    googleReviews: p.google_reviews || null,
    // A prospect named after the person (solo licensee) shouldn't be
    // addressed like a company ("congrats on getting Jane Doe off the ground")
    businessIsPersonName: !!p.contact_name && p.business_name.toLowerCase() === p.contact_name.toLowerCase(),
    contactFirst: (p.contact_name || '').split(' ')[0] || null,
    vertical: nouns.singular,
    verticalPlural: nouns.plural,
    city: p.city,
    ageDays: Number.isFinite(age) ? age : null,
    isNew: Number.isFinite(age) && age <= 120,
    website: p.website,
    siteQuality: signals?.quality ?? null,
    hasSocial: Object.keys(socials).length > 0,
    socialList: Object.keys(socials).join(', '),
    source: p.source,
  };
}

const OUTREACH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['subject', 'body'],
  properties: {
    subject: { type: 'string', description: 'Email subject (empty string for SMS)' },
    body: { type: 'string', description: 'The message, ready to copy-paste' },
  },
};

export async function generateOutreach(prospect, channel = 'email', repName = '') {
  const facts = prospectFacts(prospect);
  const offer = recommendOffer(prospect);

  if (!process.env.ANTHROPIC_API_KEY) {
    return { ...templateOutreach(facts, channel, repName), generated: 'template' };
  }

  const response = await client().beta.messages.create({
    model: MODEL,
    max_tokens: 1024,
    betas: BETAS,
    fallbacks: 'default',
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: OUTREACH_SCHEMA },
    },
    system: `You write first-touch outreach for Innovat3 Solutions (websites, reviews, CRM, AI receptionists and marketing for small businesses), following the INNOVAT3 Nurture Playbook: the cold opener is KUDOS ONLY. Introduce yourself by name, pay a genuine SPECIFIC compliment rooted in the facts provided (never generic flattery, never invented facts — never claim to have seen reviews or work you weren't given), and close warm. The only goal is to earn a reply. Rules:
- Sound like a real person, not a marketing blast. No buzzwords, no "I hope this finds you well", no exclamation spam.
- NO pitch, NO packages or prices, NO meeting ask, and NO business-problem questions (nothing about missed calls, leads, websites, or marketing) — those come later in the flow.
- Close with warmth: "keep doing what you're doing"-style kudos, or at most one light personal question about them/their work (e.g. how the first months have been). Never a sales question.
- If the business is brand-new, congratulate them on the launch specifically (their trade, their city).
- If they have no website, do NOT shame them — compliment what they DO have (new license, social presence, being established in their area).
- Email: subject ≤ 6 words, lowercase-casual is fine; body 60-110 words; sign with the rep's name and "INNOVAT3 Solutions".
- SMS: subject must be an empty string; body ≤ 300 characters, name who you are.
- VOICEMAIL: subject must be an empty string; a SPOKEN script of at most 85 words, warm and unhurried, written the way people actually talk. Say the rep's name and "Innovat3 Solutions" in the first sentence, pay the one specific compliment, make clear there's no emergency, invite a callback or text to this number, and say the rep's name again before signing off. No pitch, no prices, no URLs.
- Comply with CAN-SPAM norms: nothing deceptive in the subject.`,
    messages: [{
      role: 'user',
      content: `CHANNEL: ${channel}
REP NAME: ${repName || 'the rep'}

PROSPECT FACTS (only use these — do not invent details):
${JSON.stringify(facts, null, 2)}

For your own context (do NOT pitch it): our likely entry offer for them later is ${offer.entry.name} — ${offer.why}

Write the ${channel === 'sms' ? 'text message' : channel === 'voicemail' ? 'voicemail script' : 'email'}.`,
    }],
  });
  if (response.stop_reason === 'refusal') throw new Error('Generation was declined — try again.');
  const block = response.content.find((b) => b.type === 'text');
  return { ...JSON.parse(block.text), generated: 'ai' };
}

/** Keyless fallback — honest, specific, uses only known facts. */
export function templateOutreach(f, channel, repName) {
  const rep = repName || 'The Innovat3 team';
  const hi = f.contactFirst ? `Hi ${f.contactFirst}` : 'Hi there';
  const months = f.ageDays != null ? Math.max(1, Math.round(f.ageDays / 30)) : null;
  // "Delgado Roofing" vs a solo licensee whose "business" is their own name
  const theBiz = f.businessIsPersonName ? `your new ${f.vertical}` : f.business;
  const launchRef = f.businessIsPersonName ? `getting your ${f.vertical} up and running` : `getting ${f.business} off the ground`;

  const compliment = f.isNew
    ? `Congrats on ${launchRef}${f.city ? ` in ${f.city}` : ''} — starting a ${f.vertical} takes real guts, and most people never do it.`
    : f.website && f.siteQuality >= 60
      ? `Came across ${theBiz}${f.city ? ` in ${f.city}` : ''} — your site makes it genuinely clear what you do, which is rarer than you'd think.`
      : f.hasSocial
        ? `Came across ${theBiz}${f.city ? ` in ${f.city}` : ''} — you're clearly putting in the work on ${f.socialList || 'social'}, and it shows.`
        : `Came across ${theBiz}${f.city ? ` in ${f.city}` : ''} — always good to see a local ${f.vertical} building a name the old-fashioned way.`;

  // Playbook cold opener: kudos only — no pitch, no prices, no sales question.
  if (channel === 'voicemail') {
    const firstName = rep.split(' ')[0];
    return {
      subject: '',
      body: `Hey${f.contactFirst ? ` ${f.contactFirst}` : ''}, this is ${firstName} with Innovat3 Solutions here in Florida. ${f.isNew ? `I came across ${theBiz}${f.city ? ` in ${f.city}` : ''} — congrats on ${launchRef}, that takes real guts.` : `I came across ${theBiz}${f.city ? ` in ${f.city}` : ''} and really liked what I saw.`} Nothing urgent at all — I just wanted to introduce myself and put a name to the number. When you get a second, feel free to call or text me back right here. Again, it's ${firstName} with Innovat3 Solutions. Have a great one${f.contactFirst ? `, ${f.contactFirst}` : ''}.`,
    };
  }
  if (channel === 'sms') {
    return {
      subject: '',
      body: `${hi}, this is ${rep.split(' ')[0]} with Innovat3 Solutions here in Florida. ${f.isNew ? `Congrats on ${launchRef}${months ? ` — ${months} month${months > 1 ? 's' : ''} in already` : ''}!` : `Came across ${theBiz} and wanted to reach out.`} Really like what you're doing — no pitch here, just wanted to introduce myself and give you some kudos. Keep it up!`,
    };
  }
  return {
    subject: f.isNew ? `congrats on ${f.businessIsPersonName ? 'the new ' + f.vertical : f.business}` : `had to give you some credit`,
    body: `${hi},

${compliment}

I'm ${rep === 'The Innovat3 team' ? 'with Innovat3 Solutions' : `${rep.split(' ')[0]} with Innovat3 Solutions`} — we work with a lot of ${f.verticalPlural}${f.city ? ` around ${f.city}` : ''}, and you can usually tell pretty quickly when someone cares about the work. Nothing complicated here; just wanted to reach out and give you some credit.

Keep doing what you're doing.

${rep}
INNOVAT3 Solutions`,
  };
}
