/**
 * Close-triggered follow-up sequences.
 *
 *   WON (status → customer)        → onboarding: welcome email with the
 *     docs + what-happens-next, a day-2 kickoff-prep email, and to-dos so
 *     the rep routes the build (demo, mock-up, assets) to the team.
 *   LOST (status → not_interested) → reactivation funnel: a no-hard-feelings
 *     text AND email with free value — the invite to the Facebook group —
 *     then a 90-day resurface so the book never forgets them.
 *
 * Events queue in sequence_events; deliverDue() sends them through the
 * configured providers (Resend / Twilio). With no provider configured they
 * wait in the Outbox where a rep sends them with one tap.
 */
import { db, getSetting, updateProspect } from './db.js';
import { emailConfigured, smsConfigured, sendEmail, sendSms } from './senders.js';
import { friendlyBizName } from './util.js';
import { log } from './util.js';

const insertEvent = db.prepare(`
  INSERT INTO sequence_events (prospect_id, sequence, step_key, channel, due_at, recipient, subject, body, rep)
  VALUES (?, ?, ?, ?, datetime('now', ?), ?, ?, ?, ?)
`);
const insertTodo = db.prepare(`
  INSERT INTO todos (prospect_id, assigned_to, text, due_at) VALUES (?, ?, ?, datetime('now', ?))
`);
const logTouch = db.prepare(`
  INSERT INTO prospect_touches (prospect_id, direction, channel, text, stage_after, rep)
  VALUES (?, 'out', ?, ?, ?, ?)
`);

const emailOk = (p) => p.email && ['verified', 'valid_mx'].includes(p.email_status);

/** Idempotent: a prospect enters each sequence at most once. */
export function enqueueSequence(prospectId, sequence, rep = '') {
  const p = db.prepare('SELECT * FROM prospects WHERE id = ?').get(prospectId);
  if (!p) return { queued: 0 };
  if (p.nurture_stage === 'suppressed') return { queued: 0, reason: 'suppressed — no further outreach' };
  const already = db.prepare('SELECT id FROM sequence_events WHERE prospect_id = ? AND sequence = ?').get(prospectId, sequence);
  if (already) return { queued: 0, reason: 'already in this sequence' };
  // Entry marker: makes the idempotency check hold even when no sends can
  // queue (e.g. won with no verified email) — to-dos must never duplicate.
  db.prepare(`
    INSERT INTO sequence_events (prospect_id, sequence, step_key, channel, due_at, body, status, rep)
    VALUES (?, ?, 'entered', 'note', datetime('now'), '(entered sequence)', 'skipped', ?)
  `).run(prospectId, sequence, rep || null);

  const biz = friendlyBizName(p.business_name, p.dba_name);
  const first = (p.contact_name || '').split(' ')[0] || null;
  const hi = first ? `Hi ${first}` : 'Hi there';
  const repFirst = (rep || 'The Innovat3 team').split(' ')[0];
  const signature = rep ? `${rep}\nINNOVAT3 Solutions` : 'The INNOVAT3 team';
  let queued = 0;

  if (sequence === 'onboarding') {
    const docsUrl = getSetting('docs_url', '');
    if (emailOk(p)) {
      insertEvent.run(prospectId, 'onboarding', 'welcome', 'email', '+0 minutes', p.email,
        `Welcome to INNOVAT3, ${biz}!`,
        `${hi},

Welcome aboard — we're genuinely excited to get ${biz} set up. Here's what happens next:

1. ONBOARDING DOCS — everything we need from you (business info, brand assets, access) is in your welcome packet${docsUrl ? `:\n   ${docsUrl}` : ' (your rep will send the link shortly).'}
2. KICKOFF CALL — ${rep ? `${repFirst} will` : 'we’ll'} reach out to schedule a 20-minute kickoff to walk through the plan.
3. BUILD — our team gets to work; you'll see the first version before anything goes live.

Nothing is needed from you this minute — just keep an eye out for the kickoff invite. If any questions come up, reply here any time.

${signature}`, rep) && queued++;

      insertEvent.run(prospectId, 'onboarding', 'kickoff_prep', 'email', '+2 days', p.email,
        `Getting ${biz} ready — a quick checklist`,
        `${hi},

Quick heads-up on what makes your build fast and painless. Whenever you get a chance, gather:

• Your logo (any format is fine)
• 5–10 photos of your work, team, or location
• The exact business name, phone, and hours you want shown
• Any existing accounts we should connect (Google Business, Facebook, current website host)

You can reply to this email with everything, or bring it to the kickoff call — either works.

${signature}`, rep) && queued++;
    }

    // The rep's marching orders — these show on their dashboard until done
    const owner = p.assigned_to || rep || null;
    if (!emailOk(p)) insertTodo.run(prospectId, owner, `No verified email on ${biz} — deliver the welcome + docs by text or on the kickoff call`, '+0 minutes');
    insertTodo.run(prospectId, owner, `Send ${biz} the signed proposal + onboarding docs${docsUrl ? '' : ' (set the docs link in Settings → Automation first)'}`, '+0 minutes');
    insertTodo.run(prospectId, owner, `Collect ${biz}'s brand assets — logo, photos, accounts/access`, '+2 days');
    insertTodo.run(prospectId, owner, `Schedule the kickoff call with ${first || biz}`, '+1 days');
    insertTodo.run(prospectId, owner, `Route ${biz}'s build request to the team (site / demo / mock-up per the proposal)`, '+1 days');
  }

  if (sequence === 'reactivation') {
    const fbUrl = getSetting('fb_group_url', '');
    const fbLine = fbUrl
      ? `we run a free Facebook group where we share what's working for local businesses — marketing ideas, review tactics, stuff you can use with or without us. Come hang out: ${fbUrl}`
      : `we share free marketing tips for local businesses — no strings attached. If you'd like the invite to our free Facebook group, just reply "invite".`;
    if (p.phone) {
      insertEvent.run(prospectId, 'reactivation', 'free_value_sms', 'sms', '+0 minutes', p.phone, '',
        `${hi}, ${repFirst} with Innovat3 here. Sorry we couldn't make it work this time — no hard feelings at all. Parting gift: ${fbLine} Door's always open if timing changes.`, rep) && queued++;
    }
    if (emailOk(p)) {
      insertEvent.run(prospectId, 'reactivation', 'free_value_email', 'email', '+0 minutes', p.email,
        `No hard feelings — a parting gift from INNOVAT3`,
        `${hi},

Sorry we weren't able to work together this time — genuinely, no hard feelings. Timing matters, and we'd rather be useful than pushy.

In the meantime, ${fbLine}

If things change down the road, you know where to find us.

${signature}`, rep) && queued++;
    }
    // Resurface in ~90 days as a warm reactivation check-in
    updateProspect(prospectId, { next_touch_at: db.prepare("SELECT datetime('now', '+90 days') t").get().t });
  }

  if (queued) log(`sequences: ${biz} entered ${sequence} (${queued} sends queued)`);
  return { queued, sequence };
}

/** Deliver one queued event through the matching provider. */
export async function deliverEvent(ev, { manual = false, rep = '' } = {}) {
  const can = ev.channel === 'email' ? emailConfigured() : smsConfigured();
  if (!can && !manual) return { delivered: false, reason: 'no provider' };
  try {
    let via = 'manual';
    if (can) {
      const out = ev.channel === 'email'
        ? await sendEmail({ to: ev.recipient, subject: ev.subject, body: ev.body })
        : await sendSms({ to: ev.recipient, body: ev.body });
      via = out.via;
    }
    db.prepare("UPDATE sequence_events SET status = 'sent', sent_via = ?, sent_at = datetime('now'), error = NULL WHERE id = ?").run(via, ev.id);
    const text = ev.channel === 'email' ? `Subject: ${ev.subject}\n\n${ev.body}` : ev.body;
    logTouch.run(ev.prospect_id, ev.channel, text, null, rep || ev.rep || (via === 'manual' ? null : 'auto'));
    return { delivered: true, via };
  } catch (err) {
    db.prepare("UPDATE sequence_events SET status = 'failed', error = ? WHERE id = ?").run(String(err.message || err).slice(0, 500), ev.id);
    return { delivered: false, reason: String(err.message || err) };
  }
}

/** Sender loop tick: push every due pending event through its provider. */
export async function deliverDue() {
  const due = db.prepare(`
    SELECT * FROM sequence_events
    WHERE status IN ('pending', 'failed') AND due_at <= datetime('now')
    ORDER BY due_at LIMIT 25
  `).all();
  let sent = 0;
  for (const ev of due) {
    if (ev.status === 'failed' && ev.error && !/^(Resend|Twilio) 5/.test(ev.error)) continue; // don't hammer hard rejections
    const out = await deliverEvent(ev);
    if (out.delivered) sent++;
  }
  if (sent) log(`sequences: delivered ${sent} due sends`);
  return { due: due.length, sent };
}
