/**
 * INNOVAT3 Prospect Nurture & Human Handoff Playbook v1.0 (Aug 2026),
 * as a working engine. Automation creates and warms the relationship;
 * humans monetize it. The flow:
 *
 *   loaded → outreach_sent → engaged → permission → opportunity(+qualify)
 *   → qualified → handoff_requested → call_scheduled → sales_conversation
 *   (plus: suppressed for opt-outs / not-interested)
 *
 * Since no SMS/email provider is wired up yet, the engine is rep-driven:
 * it suggests the exact playbook message for the current stage (merge
 * fields filled from real prospect data only), the rep sends it from
 * their own phone/inbox, pastes the reply back, and the engine
 * classifies it, advances the stage, and picks the next move —
 * including the high-intent bypass straight to handoff.
 */
import { db } from './db.js';
import { VERTICALS } from './verticals.js';
import { recommendOffer } from './offers.js';
import { friendlyBizName } from './util.js';

const j = (s, fb = null) => { try { return s ? JSON.parse(s) : fb; } catch { return fb; } };

export const STAGES = [
  { key: 'loaded', label: 'Prospect Loaded' },
  { key: 'outreach_sent', label: 'Outreach Sent' },
  { key: 'engaged', label: 'Engaged' },
  { key: 'permission', label: 'Permission to Share' },
  { key: 'opportunity', label: 'Opportunity Identified' },
  { key: 'qualified', label: 'Qualified / Warm' },
  { key: 'handoff_requested', label: 'Handoff Requested' },
  { key: 'call_scheduled', label: 'Call Scheduled' },
  { key: 'sales_conversation', label: 'Sales Conversation' },
  { key: 'suppressed', label: 'Suppressed' },
];

// ---- Reply classification (playbook §05) --------------------------------

const CLASSIFIERS = [
  ['OPT_OUT', /\bstop\b|\bunsubscribe\b|remove me|don'?t (text|message|contact|email) me|take me off/i],
  ['NOT_INTERESTED', /not interested|no thanks|no thank you|we'?re (good|all set|fine)|not for (us|me)|pass\b/i],
  ['INTERESTED', /how much|price|pricing|cost\b|tell me more|more info|need (that|this)|interested|sounds good|let'?s talk|call me|yes,? call|set (that|it) up/i],
  ['WRONG_PERSON', /wrong (person|number)|someone else (handles|does)|not my (department|area|thing)|you('?d| would) want to talk to|that'?s my (partner|wife|husband|manager)/i],
  ['BUSY', /\bbusy\b|slammed|swamped|later\b|next (week|month)|circle back|bad time|in the middle of|try me/i],
  ['CURIOUS', /what (do|does|did) you|who('?s| is) this|what company|how (does|would) (this|that|it) work|what did you (notice|see|find)/i],
  ['POSITIVE', /\bthank|appreciate|kudos|that'?s (nice|kind)|awesome|means a lot|🙏|😊|glad to hear/i],
];

// Permission grants and gap acknowledgments read in-context, not globally
const PERMISSION_YES = /\bsure\b|\byes\b|\byeah\b|\bok(ay)?\b|go ahead|of course|shoot|absolutely|why not|i'?m listening|go for it/i;
const GAP_ACK = /\bno\b|\bnope\b|nothing|manual|we don'?t|not really|been meaning|honestly|falls? through|we miss|voicemail|slips?|ourselves|myself|by hand/i;

export function classifyReply(text, stage) {
  const t = (text || '').trim();
  for (const [label, re] of CLASSIFIERS) {
    if (re.test(t)) return label;
  }
  if (stage === 'permission' && PERMISSION_YES.test(t)) return 'POSITIVE';
  if ((stage === 'opportunity') && GAP_ACK.test(t)) return 'POSITIVE';
  return 'UNCLEAR';
}

/** "try me next week" → how many days to snooze the follow-up. */
export function snoozeDaysFromText(text) {
  const t = (text || '').toLowerCase();
  if (/next month|in a month|a few weeks/.test(t)) return 30;
  if (/next week/.test(t)) return 7;
  if (/later this week|end of (the )?week|this week/.test(t)) return 3;
  if (/tomorrow/.test(t)) return 1;
  if (/couple (of )?days|few days/.test(t)) return 2;
  return 3;
}

// ---- Merge data (playbook §06: only real data, never fabricate) ---------

function mergeData(p, repName) {
  const signals = j(p.site_signals_json);
  const socials = j(p.socials_json, {});
  return {
    first_name: (p.contact_name || '').split(' ')[0] || 'there',
    // The conversational name: DBA first (the brand customers know), legal
    // suffixes stripped — nobody texts "congrats, LONGBOAT KEY BUILDERS, INC."
    business_name: friendlyBizName(p.business_name, p.dba_name),
    review_count: p.google_reviews || null,
    rating: p.google_rating || null,
    rep_name: repName || '{{your name}}',
    website_status: p.website ? 'has_site' : 'none',
    site_quality: signals?.quality ?? null,
    online_booking: !!signals?.hasBooking,
    lead_form_status: !!signals?.hasForm,
    has_chat: !!signals?.hasChat,
    social_activity: Object.keys(socials).length > 0,
    has_phone: !!p.phone,
    vertical: VERTICALS[p.industry]?.label || 'business',
  };
}

function fill(template, m) {
  return template.replaceAll('{{first_name}}', m.first_name)
    .replaceAll('{{business_name}}', m.business_name)
    .replaceAll('{{rep_name}}', m.rep_name)
    .replaceAll('{{review_count}}', String(m.review_count ?? ''))
    .replace(/\.\.(?!\.)/g, '.'); // "…Inc.. Would" → "…Inc. Would"
}

// ---- Playbook messages (verbatim §02-§04) -------------------------------

export const OPENERS = {
  // Personalization rule: only claim what the data shows. The REVIEW opener
  // is used only when we actually hold Google review data for the prospect
  // (google source / cross-link); otherwise the GENERAL opener.
  review: `Hey {{first_name}}! This is {{rep_name}}. I came across {{business_name}} online and ended up reading through some of your reviews — people clearly love what you guys do. Just wanted to introduce myself and give you some kudos. That kind of reputation doesn't happen by accident.`,
  general: `Hey {{first_name}}! This is {{rep_name}}. I came across {{business_name}} online and wanted to reach out. I really like what you guys are doing and just wanted to introduce myself and give you some kudos.`,
  question: `Hey {{first_name}}, quick question - are you the person who handles the marketing/customer follow-up for {{business_name}}, or is that someone else on the team?`,
  email: {
    subject: 'Had to give you some credit',
    body: `Hey {{first_name}},

I came across {{business_name}} and spent a little time checking you guys out online.

I have to give you some credit — it's obvious you guys care about the work you're doing. Nothing complicated here, I just wanted to reach out and give you some kudos.

Keep doing what you're doing.

{{rep_name}}
INNOVAT3 Solutions`,
  },
};

const RAPPORT = `Of course! It's well deserved. We work with a lot of businesses and you can usually tell pretty quickly when someone is really taking care of their customers. You guys definitely stood out. I did notice one or two things while I was looking at {{business_name}} that I thought could potentially help you guys get a little more out of what you're already doing. Nothing crazy - would you mind if I shared them with you?`;

export const BRANCHES = {
  missed_calls: {
    label: 'Missed Calls',
    message: `You guys already seem to have people interested in what you do. One thing we see with businesses like yours is that calls inevitably get missed when everyone's busy. We've been helping businesses automatically text those callers back so those opportunities don't disappear. Do you guys have anything doing that right now?`,
    maps_to: 'connect',
  },
  lead_followup: {
    label: 'Lead Follow-Up',
    message: `One thing I was curious about - when somebody reaches out through your website or social media, do you guys have anything automatically following up with them, or is your team handling that manually?`,
    maps_to: 'connect',
  },
  after_hours: {
    label: 'After-Hours / AI Receptionist',
    message: `I was curious about something when I was looking at the business - when someone calls after hours or while everyone is tied up, what happens to that call right now?`,
    maps_to: 'ai',
  },
  online_presence: {
    label: 'Online Presence / Landing Page',
    message: `You've already got a solid business behind the brand. One thing I noticed is there may be an opportunity to make it easier for someone who finds you online to understand what you do, reach out, and leave a review without bouncing around different places. Do you have one page that's currently doing all of that for you?`,
    maps_to: 'launch',
  },
  reactivation: {
    label: 'Dormant Leads / Reactivation',
    message: `A lot of good businesses have a database full of people who reached out before but never moved forward. We've been helping businesses reconnect with those old opportunities automatically. Do you guys ever go back through older leads, or does that mostly sit untouched?`,
    maps_to: 'growth',
  },
};

// Light re-engagement when a message has sat unanswered for days — never
// guilt-trippy, never a pitch, matched to what we last sent.
export const BUMPS = {
  outreach_sent: `Hey {{first_name}}, {{rep_name}} again — I know things get busy, just didn't want my note to get buried. No agenda here; hope business is treating you well!`,
  engaged: `Hey {{first_name}}, just floating this back up — happy to share those couple of things I noticed at {{business_name}} whenever you have a sec. If now's not the time, no worries at all.`,
  permission: `Hey {{first_name}}, just floating this back up — happy to share those couple of things I noticed at {{business_name}} whenever you have a sec. If now's not the time, no worries at all.`,
  opportunity: `Hey {{first_name}}, no pressure on my last question — I know that stuff isn't always top of mind. Just curious how you guys handle it today.`,
  qualified: `Hey {{first_name}}, just checking back — still happy to have someone walk you through what we noticed at {{business_name}}. Would a quick call this week work?`,
  handoff_requested: `Hey {{first_name}}, just checking back — still happy to have someone walk you through what we noticed at {{business_name}}. Would a quick call this week work?`,
};
const BUMP_AFTER_DAYS = 3;

const HANDOFF = `Got it. That's actually exactly why I brought it up. I think there may be a really simple way we could help without making this into some huge project. Rather than me trying to explain everything over text, let me have someone from our team reach out and walk you through what we noticed and what we'd recommend for {{business_name}}. Would a quick call be okay?`;
const HANDOFF_YES = `Perfect. Is later today or tomorrow better?`;
const HANDOFF_TIME = `Great - is morning or afternoon usually easier for you?`;
const BUSY_ACK = `Totally get it - I'll circle back. When's usually a better time for you, later this week or next?`;
const WRONG_PERSON_MSG = `Ah, got it - thanks for letting me know. Who would be the right person to talk to about that? Happy to reach out to them directly.`;
const CLOSE_POLITE = `No worries at all - appreciate you letting me know. If anything ever changes, we're around. Keep up the good work!`;

/** Pick the ONE opportunity branch this prospect's real data supports. */
export function pickBranch(p) {
  const m = mergeData(p, '');
  if (m.website_status === 'none') return 'online_presence';
  if (m.has_phone && !m.has_chat) return 'missed_calls';
  if (m.lead_form_status && !m.has_chat && !m.online_booking) return 'lead_followup';
  if (!m.online_booking && /Med Spa|Dentist|Healthcare|HVAC|Plumbing|Roofing|Electrical/i.test(m.vertical)) return 'after_hours';
  if (m.site_quality != null && m.site_quality < 60) return 'online_presence';
  return 'lead_followup';
}

/**
 * The engine: given the prospect's stage and (optionally) a just-classified
 * inbound reply, return what the rep should do/send next.
 */
export function nextAction(p, repName, classification = null, touches = null) {
  const m = mergeData(p, repName);
  const stage = p.nurture_stage || 'loaded';
  const branchKey = pickBranch(p);
  const branch = BRANCHES[branchKey];

  // Silence handling: our last message has sat unanswered for days → a light
  // bump for the SAME stage, not the next-step message (which assumes a
  // reply that never came).
  if (!classification && touches?.length && BUMPS[stage]) {
    const last = touches[touches.length - 1];
    const ageDays = (Date.now() - new Date(last.created_at.replace(' ', 'T') + 'Z').getTime()) / 86400000;
    if (last.direction === 'out' && ageDays >= BUMP_AFTER_DAYS) {
      return {
        stage_to: stage,
        message: fill(BUMPS[stage], m),
        note: `No reply in ${Math.floor(ageDays)} days — send a light bump, not the next step. One bump, then let it breathe; two silences in a row means park it for a few weeks.`,
        branch: branchKey,
        is_bump: true,
      };
    }
  }

  // High-intent bypass (playbook §05): pricing/interest → straight to handoff
  if (classification === 'INTERESTED') {
    return { stage_to: 'handoff_requested', message: fill(HANDOFF, m), note: 'HIGH-INTENT BYPASS — they asked for more/pricing. Do not force remaining nurture steps; hand off.', branch: branchKey };
  }
  if (classification === 'OPT_OUT') {
    return { stage_to: 'suppressed', message: null, note: '⛔ OPT-OUT — suppress this channel immediately. No further marketing messages.', branch: branchKey };
  }
  if (classification === 'NOT_INTERESTED') {
    return { stage_to: 'suppressed', message: fill(CLOSE_POLITE, m), note: 'Close politely and stop. Do not argue or manufacture rapport.', branch: branchKey };
  }
  if (classification === 'BUSY') {
    return { stage_to: stage, message: fill(BUSY_ACK, m), note: 'Acknowledge and schedule a follow-up — set yourself a reminder.', branch: branchKey };
  }
  if (classification === 'WRONG_PERSON') {
    return { stage_to: stage, message: fill(WRONG_PERSON_MSG, m), note: 'Route to the correct contact; update the contact fields when you learn who.', branch: branchKey };
  }

  switch (stage) {
    case 'loaded': {
      const hasReviews = (m.review_count || 0) >= 3 && (m.rating || 0) >= 4;
      return {
        stage_to: 'outreach_sent',
        message: fill(hasReviews ? OPENERS.review : OPENERS.general, m),
        alt: { question_opener: fill(OPENERS.question, m), email_subject: OPENERS.email.subject, email_body: fill(OPENERS.email.body, m) },
        note: hasReviews
          ? `Cold opener — kudos only, review-based (${m.review_count} Google reviews at ${m.rating}★ — real data). NO pitch, NO $99, NO meeting ask. Goal: any genuine response.`
          : 'Cold opener — kudos only. NO pitch, NO $99, NO meeting ask. Goal: any genuine response. (No Google-review data for this prospect, so the general opener is used — never claim reviews we can\'t see.)',
        branch: branchKey,
      };
    }
    case 'outreach_sent':
      return { stage_to: 'engaged', message: fill(RAPPORT, m), note: 'They responded — send the rapport + permission ask. Wait for a real reply before this; never continue as if they replied when they didn\'t.', branch: branchKey };
    case 'engaged':
      return { stage_to: 'permission', message: fill(RAPPORT, m), note: 'Rapport + ask permission to share an observation.', branch: branchKey };
    case 'permission':
      return { stage_to: 'opportunity', message: fill(branch.message, m), note: `Permission granted → share ONE opportunity: ${branch.label} (chosen from their actual data). The message ends with the single qualifying question — send it and wait.`, branch: branchKey };
    case 'opportunity':
      return { stage_to: 'qualified', message: fill(HANDOFF, m), note: 'They acknowledged the gap in their own words → move to human handoff. Don\'t over-sell.', branch: branchKey };
    case 'qualified':
      return { stage_to: 'handoff_requested', message: fill(HANDOFF, m), note: 'Ask for the call.', branch: branchKey };
    case 'handoff_requested':
      return { stage_to: 'call_scheduled', message: HANDOFF_YES, note: 'They said yes → lock the day, then time of day.', followup: HANDOFF_TIME, branch: branchKey };
    case 'call_scheduled':
      return { stage_to: 'sales_conversation', message: HANDOFF_TIME, note: 'Confirm morning/afternoon, then generate the handoff package below and alert the assigned salesperson. Automation stops here — a human owns it now.', branch: branchKey };
    default:
      return { stage_to: stage, message: null, note: stage === 'suppressed' ? 'Suppressed — no further outreach on this channel.' : 'A human owns this conversation now.', branch: branchKey };
  }
}

/** Everything the salesperson should receive at handoff (playbook §04). */
export function handoffSummary(p, repName) {
  const touches = db.prepare('SELECT * FROM prospect_touches WHERE prospect_id = ? ORDER BY id').all(p.id);
  const inbound = touches.filter((t) => t.direction === 'in');
  const branchKey = pickBranch(p);
  const branch = BRANCHES[branchKey];
  const offer = recommendOffer(p);
  const channels = [...new Set(touches.map((t) => t.channel))].join(', ') || '—';
  const pricingAsked = inbound.some((t) => /how much|price|pricing|cost/i.test(t.text));
  const gapReply = inbound.filter((t) => t.stage_after === 'qualified' || t.stage_after === 'opportunity').map((t) => t.text).slice(-1)[0];

  return `=== INNOVAT3 SALES HANDOFF ===
Business: ${p.dba_name || p.business_name}${(p.legal_name || p.dba_name) ? ` (legal entity: ${p.legal_name || p.business_name})` : ''}
Contact: ${p.contact_name || 'unknown'}${p.contact_title ? ` (${p.contact_title})` : ''}
Phone: ${p.phone || '—'} · Email: ${p.email || '—'}
Location: ${[p.city, p.state, p.zip].filter(Boolean).join(', ')}
Source: ${p.source} (${p.source_id}) · Established: ${p.established_date || '—'}
Channels used: ${channels} · Nurtured by: ${repName || '—'}

OPPORTUNITY IDENTIFIED: ${branch.label}
Gap disclosed by prospect: ${gapReply ? `"${gapReply}"` : 'see conversation below'}
Pricing questions asked: ${pricingAsked ? 'YES — they asked about cost' : 'no'}
Permission to call: YES · ${p.scheduled_call_at ? `CALL SCHEDULED: ${p.scheduled_call_at} ET` : `Preferred timing: ${inbound.slice(-1)[0]?.text ? `see last reply: "${inbound.slice(-1)[0].text}"` : '—'}`}

LIKELY STARTING POINT (guidance, not a quote — diagnose first):
${offer.entry.name} $${offer.entry.monthly}/mo — ${offer.why}

MEANINGFUL REPLIES:
${inbound.map((t) => `  [${(t.created_at || '').slice(5, 16)}] (${t.classification || '—'}) "${t.text}"`).join('\n') || '  (none logged)'}

FULL CONVERSATION:
${touches.map((t) => `  ${t.direction === 'out' ? 'US →' : '← THEM'} ${t.text}`).join('\n') || '  (none logged)'}
==============================`;
}

export function nurtureState(p, repName) {
  const touches = db.prepare('SELECT * FROM prospect_touches WHERE prospect_id = ? ORDER BY id').all(p.id);
  return {
    stage: p.nurture_stage || 'loaded',
    stages: STAGES,
    branch: pickBranch(p),
    branches: Object.fromEntries(Object.entries(BRANCHES).map(([k, b]) => [k, b.label])),
    suggestion: nextAction(p, repName, null, touches),
    touches,
    next_touch_at: p.next_touch_at || null,
    scheduled_call_at: p.scheduled_call_at || null,
    assigned_to: p.assigned_to || null,
  };
}
