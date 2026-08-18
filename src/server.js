import express from 'express';
import compression from 'compression';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, updateProspect, getSetting, setSetting } from './db.js';
import { config } from './config.js';
import { executeRun, SOURCE_REGISTRY } from './pipeline/run.js';
import { enrichProspect } from './enrich/index.js';
import { applyScore, scoreAll } from './pipeline/score.js';
import { createRun, updateRun } from './db.js';
import { marketsForVertical, VERTICAL_NAICS } from './market.js';
import { providerStatus } from './enrich/provider-status.js';
import { registerTrainingRoutes } from './training/index.js';
import { PACKAGES, ADD_ONS, PROJECTS, QUALIFICATION, ESSENTIAL_ADDONS, CLOSE_CHECKLIST, EXPANSION_RHYTHM, ECONOMICS, UPGRADE_TRIGGERS, RULES, recommendOffer, buildProposal, proposalText } from './offers.js';
import { enqueueSequence, deliverDue, deliverEvent } from './sequences.js';
import { emailConfigured, smsConfigured, sendEmail } from './senders.js';
import { generateOutreach } from './outreach.js';
import { nurtureState, nextAction, classifyReply, handoffSummary, snoozeDaysFromText, STAGES } from './nurture.js';
import { VERTICALS } from './verticals.js';
import { log, mapConcurrent } from './util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(compression()); // gzip every response — the prospect list shrinks ~8x

app.set('trust proxy', 1); // Render terminates TLS — keep req.protocol honest

// Health check — must stay ABOVE the auth wall or the host's checker gets
// 401s, marks the instance unhealthy, and serves 502s.
app.get('/healthz', (req, res) => res.json({ ok: true }));

// ---------- per-rep calendar feed (ICS) ----------
// Calendar apps can't do our login, so each rep gets a secret tokenized URL
// they subscribe to once (Google/Apple/Outlook). It carries THEIR work:
// follow-ups due and scheduled sales calls on prospects assigned to them.
// Must live ABOVE the auth wall; the token IS the auth.
const icsEscape = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => '\\' + c).replace(/\r?\n/g, '\\n');
// Timestamps arrive as SQLite "YYYY-MM-DD HH:MM:SS" (UTC) or as ISO strings
// with their own zone marker — accept both.
const parseDbTime = (t) => new Date(/[zZ]$|[+-]\d\d:?\d\d$/.test(t) ? t : t.replace(' ', 'T') + 'Z');
const icsDate = (dbTime) => parseDbTime(dbTime).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
const icsDatePlus30 = (dbTime) =>
  new Date(parseDbTime(dbTime).getTime() + 30 * 60000)
    .toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
app.get('/calendar/:token.ics', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE cal_token = ? AND active = 1').get(String(req.params.token));
  if (!user) return res.status(404).send('Unknown calendar');
  const rows = db.prepare(`
    SELECT id, business_name, dba_name, phone, city, nurture_stage, call_reason, next_touch_at, scheduled_call_at
    FROM prospects
    WHERE assigned_to = ? AND status NOT IN ('not_interested','disqualified','no_contact')
      AND nurture_stage != 'suppressed'
      AND (next_touch_at IS NOT NULL OR scheduled_call_at IS NOT NULL)
  `).all(user.display_name);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const events = [];
  for (const r of rows) {
    const name = r.dba_name || r.business_name;
    const desc = icsEscape([`Stage: ${r.nurture_stage || 'loaded'}`, r.phone ? `Phone: ${r.phone}` : '', r.call_reason || ''].filter(Boolean).join('\n'));
    if (r.next_touch_at && !Number.isNaN(parseDbTime(r.next_touch_at).getTime())) {
      events.push([
        'BEGIN:VEVENT',
        `UID:innovat3-fu-${r.id}@prospect-engine`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${icsDate(r.next_touch_at)}`,
        `DTEND:${icsDatePlus30(r.next_touch_at)}`,
        `SUMMARY:${icsEscape(`Follow up: ${name}${r.city ? ` (${r.city})` : ''}`)}`,
        `DESCRIPTION:${desc}`,
        'END:VEVENT',
      ].join('\r\n'));
    }
    if (r.scheduled_call_at && !Number.isNaN(parseDbTime(r.scheduled_call_at).getTime())) {
      events.push([
        'BEGIN:VEVENT',
        `UID:innovat3-call-${r.id}@prospect-engine`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${icsDate(r.scheduled_call_at)}`,
        `DTEND:${icsDatePlus30(r.scheduled_call_at)}`,
        `SUMMARY:${icsEscape(`Sales call: ${name}${r.city ? ` (${r.city})` : ''}`)}`,
        `DESCRIPTION:${desc}`,
        'END:VEVENT',
      ].join('\r\n'));
    }
  }
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.send([
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//INNOVAT3//Prospect Engine//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:INNOVAT3 — ${icsEscape(user.display_name)}`,
    'X-WR-TIMEZONE:UTC',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n'));
});

// ---------- team invites: the public accept flow ----------
// Lives ABOVE the auth wall — the invite token IS the auth. An invitee has
// no login yet; the link lets them create one (username + password), then
// hands them their calendar feed. Single-use, 7-day expiry, revocable.
const sqlNow = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const inviteByToken = (t) => db.prepare('SELECT * FROM invites WHERE token = ?').get(String(t || ''));
const inviteState = (inv) => {
  if (!inv) return 'invalid';
  if (inv.revoked) return 'revoked';
  if (inv.accepted_at) return 'used';
  if (inv.expires_at <= sqlNow()) return 'expired';
  return 'ok';
};

app.get('/invite/:token', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'invite.html'));
});
app.get('/api/invite/:token', (req, res) => {
  const inv = inviteByToken(req.params.token);
  const state = inviteState(inv);
  if (state !== 'ok') return res.status(410).json({ state });
  res.json({ state, display_name: inv.display_name || '', role: inv.role, expires_at: inv.expires_at });
});
app.post('/api/invite/:token/accept', express.json(), (req, res) => {
  const inv = inviteByToken(req.params.token);
  const state = inviteState(inv);
  if (state !== 'ok') return res.status(410).json({ error: { invalid: 'This invite link is not valid.', revoked: 'This invite was revoked — ask your admin for a new one.', used: 'This invite was already used. If that was you, just sign in.', expired: 'This invite expired — ask your admin for a fresh link.' }[state] });
  const { username, display_name, password } = req.body || {};
  if (!username || !/^[a-z0-9._-]{2,32}$/i.test(username)) return res.status(400).json({ error: 'Username: 2-32 letters/numbers/._-' });
  if (!display_name?.trim()) return res.status(400).json({ error: 'Your name is required — it signs your outreach.' });
  if (!password || String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  const { salt, hash } = hashPassword(password);
  let userId;
  try {
    const r = db.prepare('INSERT INTO users (username, display_name, pass_salt, pass_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(String(username).trim(), String(display_name).trim(), salt, hash, inv.role);
    userId = Number(r.lastInsertRowid);
  } catch {
    return res.status(409).json({ error: 'That username is taken — pick another.' });
  }
  db.prepare("UPDATE invites SET accepted_at = datetime('now'), accepted_user_id = ? WHERE id = ?").run(userId, inv.id);
  log(`invites: ${display_name.trim()} (@${username.trim()}, ${inv.role}) joined via invite from ${inv.created_by || 'admin'}`);
  res.status(201).json({
    username: String(username).trim(),
    display_name: String(display_name).trim(),
    role: inv.role,
    calendar_url: calUrlFor(req, userId),
  });
});

// ---------- auth: per-user accounts with roles ----------
// Every teammate signs in with their own username/password (managed in the
// Settings tab). The env DASHBOARD_USER/PASSWORD pair stays as the master
// admin — the bootstrap login before any users exist, and the break-glass
// login if everyone locks themselves out.
const AUTH_USER = process.env.DASHBOARD_USER || 'innovat3';
const AUTH_PASS = process.env.DASHBOARD_PASSWORD;

export const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => ({
  salt,
  hash: crypto.scryptSync(String(password), salt, 32).toString('hex'),
});
const verifyPassword = (password, salt, hash) => {
  const test = crypto.scryptSync(String(password), salt, 32);
  const real = Buffer.from(hash, 'hex');
  return test.length === real.length && crypto.timingSafeEqual(test, real);
};
const anyUsers = () => db.prepare('SELECT COUNT(*) c FROM users WHERE active = 1').get().c > 0;

app.use((req, res, next) => {
  // The invite accept page needs its stylesheet + script before login exists
  if (req.path === '/style.css' || req.path === '/invite.js') return next();
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const [user, ...rest] = Buffer.from(encoded, 'base64').toString().split(':');
    const pass = rest.join(':');
    if (AUTH_PASS && user === AUTH_USER && pass === AUTH_PASS) {
      req.user = { id: null, username: AUTH_USER, display_name: 'Master admin', role: 'admin' };
      return next();
    }
    const u = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(user);
    if (u && verifyPassword(pass, u.pass_salt, u.pass_hash)) {
      req.user = { id: u.id, username: u.username, display_name: u.display_name, role: u.role };
      return next();
    }
  }
  // Local development with no password configured and no users created
  if (!AUTH_PASS && !anyUsers()) {
    req.user = { id: null, username: 'dev', display_name: 'Dev', role: 'admin' };
    return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Innovat3 Prospect Engine"');
  res.status(401).send('Authentication required');
});

const adminOnly = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  res.status(403).json({ error: 'Admins only' });
};

// The Settings page itself is admin-only
app.use((req, res, next) => {
  if (req.path === '/settings.html' && req.user?.role !== 'admin') {
    return res.status(403).send('Admins only — ask an admin for access.');
  }
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const STATUSES = ['new', 'contacted', 'interested', 'not_interested', 'customer', 'disqualified', 'no_contact'];

// ---------- ownership: who works which prospect ----------
// Two modes, set by the admin in Settings:
//   claim — reps take assignments themselves (Claim button / first touch)
//   auto  — every new prospect is dealt round-robin across active teammates
const calTokenFor = (userId) => {
  const row = db.prepare('SELECT cal_token FROM users WHERE id = ?').get(userId);
  if (row?.cal_token) return row.cal_token;
  const token = crypto.randomBytes(18).toString('hex');
  db.prepare('UPDATE users SET cal_token = ? WHERE id = ?').run(token, userId);
  return token;
};
const calUrlFor = (req, userId) => `${req.protocol}://${req.get('host')}/calendar/${calTokenFor(userId)}.ics`;

function autoAssign({ force = false } = {}) {
  if (!force && getSetting('assignment_mode', 'claim') !== 'auto') return { assigned: 0 };
  const reps = db.prepare('SELECT display_name FROM users WHERE active = 1 ORDER BY id').all().map((r) => r.display_name);
  if (!reps.length) return { assigned: 0, reps };
  const rows = db.prepare(`
    SELECT id FROM prospects
    WHERE assigned_to IS NULL
      AND status NOT IN ('no_contact','not_interested','disqualified','customer')
    ORDER BY score DESC, id
  `).all();
  const upd = db.prepare("UPDATE prospects SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?");
  // rotate the deal so the same rep doesn't always get the cream
  let i = db.prepare('SELECT COUNT(*) c FROM prospects WHERE assigned_to IS NOT NULL').get().c;
  for (const r of rows) upd.run(reps[i++ % reps.length], r.id);
  if (rows.length) log(`ownership: dealt ${rows.length} unassigned prospects across ${reps.length} reps`);
  return { assigned: rows.length, reps };
}

const settingsPayload = () => ({
  assignment_mode: getSetting('assignment_mode', 'claim'),
  fb_group_url: getSetting('fb_group_url', ''),
  docs_url: getSetting('docs_url', ''),
  email_sender: emailConfigured(),
  sms_sender: smsConfigured(),
});
app.get('/api/settings', adminOnly, (req, res) => {
  res.json(settingsPayload());
});
app.patch('/api/settings', adminOnly, (req, res) => {
  const { assignment_mode, fb_group_url, docs_url } = req.body || {};
  if (assignment_mode !== undefined) {
    if (!['claim', 'auto'].includes(assignment_mode)) return res.status(400).json({ error: 'bad mode' });
    setSetting('assignment_mode', assignment_mode);
    if (assignment_mode === 'auto') autoAssign();
  }
  for (const [key, val] of [['fb_group_url', fb_group_url], ['docs_url', docs_url]]) {
    if (val === undefined) continue;
    const v = String(val).trim();
    if (v && !/^https?:\/\//i.test(v)) return res.status(400).json({ error: `${key.replace(/_/g, ' ')} must be a full https:// link` });
    setSetting(key, v);
  }
  res.json(settingsPayload());
});
app.post('/api/assign/distribute', adminOnly, (req, res) => {
  res.json(autoAssign({ force: true }));
});

// A rep takes an unassigned prospect (admins can also reassign)
app.post('/api/prospects/:id/claim', (req, res) => {
  const row = db.prepare('SELECT id, assigned_to FROM prospects WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'not found' });
  const rep = String(req.body?.rep_name || req.user.display_name || '').trim();
  if (!rep) return res.status(400).json({ error: 'Set your name first (click your avatar).' });
  if (row.assigned_to && row.assigned_to !== rep && req.user.role !== 'admin') {
    return res.status(409).json({ error: `Already assigned to ${row.assigned_to}` });
  }
  updateProspect(row.id, { assigned_to: rep });
  res.json(db.prepare('SELECT * FROM prospects WHERE id = ?').get(row.id));
});

// ---------- who am I ----------
app.get('/api/me', (req, res) => {
  res.json({
    username: req.user.username,
    name: req.user.display_name,
    role: req.user.role,
    calendar_url: req.user.id ? calUrlFor(req, req.user.id) : null,
  });
});

// ---------- team management (Settings tab, admin) ----------
app.get('/api/users', adminOnly, (req, res) => {
  const rows = db.prepare('SELECT id, username, display_name, role, active, created_at FROM users ORDER BY id').all();
  res.json(rows.map((u) => ({ ...u, calendar_url: calUrlFor(req, u.id) })));
});

app.post('/api/users', adminOnly, (req, res) => {
  const { username, display_name, password, role } = req.body || {};
  if (!username || !/^[a-z0-9._-]{2,32}$/i.test(username)) return res.status(400).json({ error: 'Username: 2-32 letters/numbers/._-' });
  if (!display_name?.trim()) return res.status(400).json({ error: 'Display name is required' });
  if (!password || String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Role must be admin or user' });
  const { salt, hash } = hashPassword(password);
  try {
    const r = db.prepare('INSERT INTO users (username, display_name, pass_salt, pass_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(username.trim(), display_name.trim(), salt, hash, role);
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  } catch {
    res.status(409).json({ error: 'That username is taken' });
  }
});

app.patch('/api/users/:id', adminOnly, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!u) return res.status(404).json({ error: 'not found' });
  const { role, active, password, display_name } = req.body || {};
  if (role !== undefined && !['admin', 'user'].includes(role)) return res.status(400).json({ error: 'bad role' });
  if (password !== undefined && String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  const sets = [];
  const params = [];
  if (role !== undefined) { sets.push('role = ?'); params.push(role); }
  if (active !== undefined) { sets.push('active = ?'); params.push(active ? 1 : 0); }
  if (display_name !== undefined && display_name.trim()) { sets.push('display_name = ?'); params.push(display_name.trim()); }
  if (password !== undefined) {
    const { salt, hash } = hashPassword(password);
    sets.push('pass_salt = ?', 'pass_hash = ?');
    params.push(salt, hash);
  }
  if (sets.length) db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params, u.id);
  res.json(db.prepare('SELECT id, username, display_name, role, active, created_at FROM users WHERE id = ?').get(u.id));
});

// ---------- invites (admin): generate the link, optionally email it ----------
const inviteUrlFor = (req, token) => `${req.protocol}://${req.get('host')}/invite/${token}`;

app.post('/api/invites', adminOnly, async (req, res) => {
  const { display_name, email, role } = req.body || {};
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Role must be admin or user' });
  const cleanEmail = String(email || '').trim();
  if (cleanEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) return res.status(400).json({ error: 'That email does not look right' });
  const token = crypto.randomBytes(21).toString('hex');
  const r = db.prepare(`
    INSERT INTO invites (token, display_name, email, role, created_by, expires_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', '+7 days'))
  `).run(token, String(display_name || '').trim() || null, cleanEmail || null, role, req.user.display_name || req.user.username);
  const url = inviteUrlFor(req, token);

  // Notification: email it automatically when a sender is configured;
  // otherwise the admin copies the link and sends it themselves.
  let emailed = false;
  let email_error = null;
  if (cleanEmail && emailConfigured()) {
    try {
      await sendEmail({
        to: cleanEmail,
        subject: 'You’re invited to the INNOVAT3 Prospect Engine',
        body: `${display_name?.trim() ? `Hi ${display_name.trim().split(' ')[0]},\n\n` : 'Hi,\n\n'}${req.user.display_name || 'Your admin'} invited you to the INNOVAT3 Prospect Engine (${role === 'admin' ? 'admin access' : 'sales dashboard access'}).

Create your login here — pick your own username and password, takes a minute:
${url}

You'll also get your personal calendar feed link, so your follow-ups and sales calls show up in Google/Apple/Outlook automatically.

This link is single-use and expires in 7 days.

— INNOVAT3 Solutions`,
      });
      emailed = true;
    } catch (err) {
      email_error = String(err.message || err).slice(0, 200);
    }
  }
  res.status(201).json({
    id: Number(r.lastInsertRowid), invite_url: url, role, display_name: display_name?.trim() || null,
    email: cleanEmail || null, emailed, email_error,
    email_possible: emailConfigured(),
    expires_at: db.prepare('SELECT expires_at FROM invites WHERE id = ?').get(Number(r.lastInsertRowid)).expires_at,
  });
});

app.get('/api/invites', adminOnly, (req, res) => {
  const rows = db.prepare('SELECT * FROM invites ORDER BY id DESC LIMIT 50').all();
  res.json(rows.map((inv) => ({
    id: inv.id, display_name: inv.display_name, email: inv.email, role: inv.role,
    created_by: inv.created_by, created_at: inv.created_at, expires_at: inv.expires_at,
    status: inviteState(inv),
    invite_url: inviteState(inv) === 'ok' ? inviteUrlFor(req, inv.token) : null,
    accepted_at: inv.accepted_at,
  })));
});

app.post('/api/invites/:id/revoke', adminOnly, (req, res) => {
  db.prepare('UPDATE invites SET revoked = 1 WHERE id = ? AND accepted_at IS NULL').run(Number(req.params.id));
  res.json({ ok: true });
});

// ---------- client accounts (who are we prospecting FOR) ----------
// NULL account_id = Innovat3's own book. Each client account carries its
// target niches + territory; runs tag their prospects to the account so the
// client's list stays segmented and exports clean into their CRM.
app.get('/api/accounts', (req, res) => {
  if (req.user.role !== 'admin') return res.json([]); // users work the house book only
  const rows = db.prepare('SELECT * FROM accounts ORDER BY active DESC, name').all();
  const counts = Object.fromEntries(
    db.prepare('SELECT account_id, COUNT(*) c FROM prospects WHERE account_id IS NOT NULL GROUP BY account_id').all()
      .map((r) => [r.account_id, r.c])
  );
  res.json(rows.map((a) => ({
    ...a,
    niches: JSON.parse(a.niches_json || '[]'),
    zips: JSON.parse(a.zips_json || '[]'),
    prospects: counts[a.id] || 0,
  })));
});

app.post('/api/accounts', adminOnly, (req, res) => {
  const { name, notes, niches, zips } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Account name is required' });
  const cleanZips = (Array.isArray(zips) ? zips : String(zips || '').split(','))
    .map((z) => String(z).trim()).filter((z) => /^\d{3,5}$/.test(z)).slice(0, 20);
  const r = db.prepare('INSERT INTO accounts (name, notes, niches_json, zips_json) VALUES (?, ?, ?, ?)')
    .run(name.trim(), notes?.trim() || null, JSON.stringify(Array.isArray(niches) ? niches : []), JSON.stringify(cleanZips));
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

app.patch('/api/accounts/:id', adminOnly, (req, res) => {
  const a = db.prepare('SELECT * FROM accounts WHERE id = ?').get(Number(req.params.id));
  if (!a) return res.status(404).json({ error: 'not found' });
  const { name, notes, niches, zips, active } = req.body || {};
  const cleanZips = zips === undefined ? undefined
    : (Array.isArray(zips) ? zips : String(zips || '').split(',')).map((z) => String(z).trim()).filter((z) => /^\d{3,5}$/.test(z)).slice(0, 20);
  db.prepare(`UPDATE accounts SET
      name = COALESCE(?, name), notes = COALESCE(?, notes),
      niches_json = COALESCE(?, niches_json), zips_json = COALESCE(?, zips_json),
      active = COALESCE(?, active)
    WHERE id = ?`).run(
    name?.trim() ?? null, notes ?? null,
    niches === undefined ? null : JSON.stringify(niches),
    cleanZips === undefined ? null : JSON.stringify(cleanZips),
    active === undefined ? null : (active ? 1 : 0), a.id
  );
  res.json(db.prepare('SELECT * FROM accounts WHERE id = ?').get(a.id));
});

// Which client's book is this request looking at? '' / 'house' = Innovat3's
// own; 'all' = everything; a number = that client account. Validated to a
// literal so it can be interpolated into WHERE clauses safely.
function acctSql(req) {
  const a = String(req.query.account || '');
  if (!a || a === 'house') return 'account_id IS NULL';
  if (a === 'all') return '1=1';
  const n = Number(a);
  return Number.isFinite(n) && n > 0 ? `account_id = ${Math.floor(n)}` : 'account_id IS NULL';
}

// ---------- prospects ----------
// Latest-touch subselects: the list is conversation-aware — every row knows
// when it was last touched and whose move it is.
const LAST_TOUCH_COLS = `
  (SELECT MAX(created_at) FROM prospect_touches t WHERE t.prospect_id = prospects.id) AS last_touch_at,
  (SELECT direction FROM prospect_touches t WHERE t.prospect_id = prospects.id ORDER BY t.id DESC LIMIT 1) AS last_touch_dir`;

app.get('/api/prospects', (req, res) => {
  const { q, industry, source, status, minScore, hasEmail, hasPhone, noWebsite, zip, stage, stages, assigned, lastDir, due, sort = 'score', dir = 'desc', page = '1', pageSize = '50' } = req.query;
  const where = [acctSql(req)];
  const params = [];
  if (q) { where.push('(business_name LIKE ? OR dba_name LIKE ? OR contact_name LIKE ? OR city LIKE ?)'); const like = `%${q}%`; params.push(like, like, like, like); }
  if (zip) {
    // comma-separated zips or prefixes: "33101, 334" matches either
    const zips = String(zip).split(',').map((z) => z.trim()).filter(Boolean).slice(0, 20);
    if (zips.length) {
      where.push(`(${zips.map(() => 'zip LIKE ?').join(' OR ')})`);
      params.push(...zips.map((z) => `${z}%`));
    }
  }
  if (industry) { where.push('industry = ?'); params.push(industry); }
  if (source) { where.push('source = ?'); params.push(source); }
  if (status) { where.push('status = ?'); params.push(status); }
  // Parked no-contact prospects stay out of the working views unless
  // explicitly asked for via the status filter
  else where.push("status != 'no_contact'");
  if (minScore) { where.push('score >= ?'); params.push(Number(minScore)); }
  if (hasEmail === '1') where.push("email IS NOT NULL AND email_status != 'invalid'");
  if (hasPhone === '1') where.push('phone IS NOT NULL');
  if (noWebsite === '1') where.push('website IS NULL');
  // Prospecting angles — which product conversation this business invites.
  // Businesses WITH websites are prospects too: weak reviews → LOCAL,
  // no follow-up system behind the site → CONNECT.
  const ANGLES = {
    no_website: 'website IS NULL',
    has_website: 'website IS NOT NULL',
    weak_reviews: '((google_rating IS NOT NULL AND google_rating < 4.2) OR (google_reviews IS NOT NULL AND google_reviews < 15))',
    no_followup: "website IS NOT NULL AND site_signals_json IS NOT NULL AND json_extract(site_signals_json, '$.hasCrm') = 0 AND json_extract(site_signals_json, '$.hasBooking') = 0",
  };
  if (ANGLES[String(req.query.angle || '')]) where.push(ANGLES[String(req.query.angle)]);
  if (stage) { where.push('nurture_stage = ?'); params.push(stage); }
  if (stages) {
    const list = String(stages).split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10);
    if (list.length) { where.push(`nurture_stage IN (${list.map(() => '?').join(',')})`); params.push(...list); }
  }
  if (assigned) { where.push('(assigned_to = ? OR assigned_to IS NULL)'); params.push(assigned); }
  const owner = String(req.query.owner || '');
  if (owner === 'unassigned') where.push('assigned_to IS NULL');
  else if (owner) { where.push('assigned_to = ?'); params.push(owner); }
  if (lastDir === 'in' || lastDir === 'out') {
    where.push(`(SELECT direction FROM prospect_touches t WHERE t.prospect_id = prospects.id ORDER BY t.id DESC LIMIT 1) = ?`);
    params.push(lastDir);
    where.push("nurture_stage != 'suppressed'");
  }
  if (due === '1') {
    where.push("next_touch_at IS NOT NULL AND next_touch_at <= datetime('now') AND nurture_stage != 'suppressed'");
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sortCol = { score: 'score', established: 'established_date', name: 'business_name', created: 'created_at', city: 'city', last_touch: 'last_touch_at' }[sort] || 'score';
  const dirSql = dir === 'asc' ? 'ASC' : 'DESC';
  const limit = Math.min(200, Number(pageSize) || 50);
  const offset = (Math.max(1, Number(page)) - 1) * limit;
  const total = db.prepare(`SELECT COUNT(*) c FROM prospects ${whereSql}`).get(...params).c;
  const rows = db.prepare(
    `SELECT prospects.*, ${LAST_TOUCH_COLS} FROM prospects ${whereSql} ORDER BY ${sortCol} ${dirSql} NULLS LAST, id DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);
  res.json({ total, page: Number(page), pageSize: limit, rows });
});

// ---------- the rep's work queue ----------
// Answers "what do I do right now": replies waiting on us, follow-ups due,
// handoffs to complete, untouched fresh leads. Counts feed the queue chips.
app.get('/api/queue', (req, res) => {
  const rep = String(req.query.rep || '');
  const mine = rep ? ' AND (assigned_to IS NULL OR assigned_to = ?)' : '';
  const args = rep ? [rep] : [];
  const WORKABLE = `status NOT IN ('not_interested','disqualified','customer','no_contact') AND nurture_stage != 'suppressed' AND ${acctSql(req)}`;
  const lastDirIs = (d) =>
    `(SELECT direction FROM prospect_touches t WHERE t.prospect_id = prospects.id ORDER BY t.id DESC LIMIT 1) = '${d}'`;
  const count = (sql) => db.prepare(`SELECT COUNT(*) c FROM prospects WHERE ${sql}${mine}`).get(...args).c;
  res.json({
    your_move: count(`${WORKABLE} AND ${lastDirIs('in')}`),
    due: count(`${WORKABLE} AND next_touch_at IS NOT NULL AND next_touch_at <= datetime('now')`),
    handoffs: count(`${WORKABLE} AND nurture_stage IN ('qualified','handoff_requested','call_scheduled')`),
    fresh: count(`status = 'new' AND score >= 50 AND ${acctSql(req)}`),
  });
});

app.get('/api/prospects/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM prospects WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json({ ...row, offer: recommendOffer(row) });
});

// ---------- offers knowledge base ----------
app.get('/api/offers', (req, res) => {
  // Rep-safe knowledge base — economics (commission/margins) deliberately
  // excluded; that lives behind the admin-only /api/economics.
  res.json({
    packages: PACKAGES, addOns: ADD_ONS, projects: PROJECTS,
    qualification: QUALIFICATION, essentialAddons: ESSENTIAL_ADDONS,
    closeChecklist: CLOSE_CHECKLIST, expansionRhythm: EXPANSION_RHYTHM,
    upgradeTriggers: UPGRADE_TRIGGERS, rules: RULES,
  });
});

// ---------- outreach generator ----------
app.post('/api/prospects/:id/outreach', async (req, res) => {
  const row = db.prepare('SELECT * FROM prospects WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'not found' });
  const channel = ['sms', 'voicemail'].includes(req.body?.channel) ? req.body.channel : 'email';
  try {
    res.json(await generateOutreach(row, channel, req.body?.rep_name || req.user.display_name || ''));
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
});

// ---------- nurture flow (Prospect Nurture & Human Handoff Playbook) ----------
// Automation warms the relationship; a human monetizes it. These routes are
// rep-driven: GET the current state + suggested playbook message, POST /sent
// after sending it, POST /reply with what the prospect wrote back.
const getProspect = (req) => db.prepare('SELECT * FROM prospects WHERE id = ?').get(Number(req.params.id));

app.get('/api/prospects/:id/nurture', (req, res) => {
  const row = getProspect(req);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(nurtureState(row, String(req.query.rep || '')));
});

const logTouch = db.prepare(`
  INSERT INTO prospect_touches (prospect_id, direction, channel, text, classification, stage_after, rep)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const setStage = (id, stage) =>
  db.prepare("UPDATE prospects SET nurture_stage = ?, updated_at = datetime('now') WHERE id = ?").run(stage, id);
const setNextTouch = (id, days) =>
  db.prepare(`UPDATE prospects SET next_touch_at = ${days == null ? 'NULL' : "datetime('now', ?)"} WHERE id = ?`)
    .run(...(days == null ? [id] : [`+${days} days`, id]));
// Once they've qualified, the sales status should say so
const PROMOTED_STAGES = ['qualified', 'handoff_requested', 'call_scheduled', 'sales_conversation'];

// Rep confirms the suggested message went out → log it and advance the stage.
app.post('/api/prospects/:id/nurture/sent', (req, res) => {
  const row = getProspect(req);
  if (!row) return res.status(404).json({ error: 'not found' });
  if ((row.nurture_stage || 'loaded') === 'suppressed') {
    return res.status(400).json({ error: 'This prospect is suppressed — no further outreach.' });
  }
  const rep = String(req.body?.rep_name || '');
  const channel = ['sms', 'email', 'call'].includes(req.body?.channel) ? req.body.channel : 'sms';
  const action = nextAction(row, rep);
  const text = String(req.body?.text || action.message || '').trim();
  if (!text) return res.status(400).json({ error: 'Nothing to send at this stage.' });
  // The client may pass the stage the send corresponds to (e.g. a BUSY
  // acknowledgment or a call disposition holds the current stage).
  const requested = String(req.body?.stage_to || '');
  const stageTo = STAGES.some((s) => s.key === requested)
    ? requested
    : (action.stage_to || row.nurture_stage || 'loaded');
  logTouch.run(row.id, 'out', channel, text, null, stageTo, rep || null);
  setStage(row.id, stageTo);
  // Every outbound arms the follow-up clock: if they don't reply, this
  // conversation resurfaces in the ⏰ Due queue instead of dying quietly.
  const snooze = Number(req.body?.snooze_days);
  if (stageTo === 'suppressed' || stageTo === 'sales_conversation') setNextTouch(row.id, null);
  else setNextTouch(row.id, Number.isFinite(snooze) && snooze > 0 ? Math.min(snooze, 90) : 2);
  const statusUpdates = {};
  if (row.status === 'new') statusUpdates.status = 'contacted';
  if (PROMOTED_STAGES.includes(stageTo) && ['new', 'contacted'].includes(row.status)) statusUpdates.status = 'interested';
  if (!row.assigned_to && rep) statusUpdates.assigned_to = rep; // first touch claims the prospect
  if (Object.keys(statusUpdates).length) updateProspect(row.id, statusUpdates);
  res.json(nurtureState(getProspect(req), rep));
});

// Rep pastes what the prospect replied → classify, advance, suggest next move.
app.post('/api/prospects/:id/nurture/reply', (req, res) => {
  const row = getProspect(req);
  if (!row) return res.status(404).json({ error: 'not found' });
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Paste the prospect’s reply first.' });
  const rep = String(req.body?.rep_name || '');
  const channel = ['sms', 'email', 'call'].includes(req.body?.channel) ? req.body.channel : 'sms';
  const stage = row.nurture_stage || 'loaded';
  const cls = classifyReply(text, stage);

  // Inbound stage moves. Most advancement happens when the rep SENDS the next
  // message; replies only move the needle where the reply itself is the event:
  let stageTo = stage;
  if (cls === 'OPT_OUT' || cls === 'NOT_INTERESTED') stageTo = 'suppressed';           // §05: stop immediately
  else if (cls === 'INTERESTED') stageTo = 'qualified';                                 // high-intent bypass
  else if (stage === 'outreach_sent' && !['BUSY', 'WRONG_PERSON'].includes(cls)) stageTo = 'engaged';
  else if (stage === 'opportunity' && cls === 'POSITIVE') stageTo = 'qualified';        // gap acknowledged
  logTouch.run(row.id, 'in', channel, text, cls, stageTo, rep || null);
  if (stageTo !== stage) setStage(row.id, stageTo);
  if (cls === 'OPT_OUT' || cls === 'NOT_INTERESTED') updateProspect(row.id, { status: 'not_interested' });
  else if ((cls === 'INTERESTED' || PROMOTED_STAGES.includes(stageTo)) && !['customer'].includes(row.status)) {
    updateProspect(row.id, { status: 'interested' });
  }
  if (!row.assigned_to && rep) updateProspect(row.id, { assigned_to: rep });

  // Follow-up clock: BUSY snoozes by what they actually said ("next week" →
  // 7 days); opt-outs clear it; any other reply is due NOW — it's our move.
  let snoozedDays = null;
  if (cls === 'BUSY') {
    snoozedDays = snoozeDaysFromText(text);
    setNextTouch(row.id, snoozedDays);
  } else if (stageTo === 'suppressed') setNextTouch(row.id, null);
  else setNextTouch(row.id, 0);

  const fresh = getProspect(req);
  const action = nextAction(fresh, rep, cls);
  if (cls === 'BUSY' && snoozedDays) {
    const dueDate = db.prepare("SELECT date(next_touch_at) d FROM prospects WHERE id = ?").get(row.id).d;
    action.note = `They're busy — follow-up scheduled for ${dueDate} (they said "${text.slice(0, 60)}"). It'll surface in your ⏰ Due queue; send the acknowledgment below now.`;
  }
  res.json({ classification: cls, action, state: nurtureState(fresh, rep) });
});

// Manual override — undo a mis-click or restart a lapsed thread.
app.post('/api/prospects/:id/nurture/stage', (req, res) => {
  const row = getProspect(req);
  if (!row) return res.status(404).json({ error: 'not found' });
  const stage = String(req.body?.stage || '');
  if (!STAGES.some((s) => s.key === stage)) return res.status(400).json({ error: 'bad stage' });
  setStage(row.id, stage);
  res.json(nurtureState(getProspect(req), String(req.body?.rep_name || '')));
});

// The salesperson's handoff package (playbook §04) — everything they need
// to walk in warm: contact, opportunity, gap in the prospect's own words,
// pricing signals, and the full conversation.
app.get('/api/prospects/:id/handoff', (req, res) => {
  const row = getProspect(req);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json({ text: handoffSummary(row, String(req.query.rep || '')) });
});

app.patch('/api/prospects/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT id, status FROM prospects WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'not found' });
  const { status, notes, assigned_to, contact_name, contact_title, email, phone, website, next_touch_at, scheduled_call_at } = req.body;
  if (status && !STATUSES.includes(status)) return res.status(400).json({ error: 'bad status' });
  updateProspect(id, { status, notes, assigned_to, contact_name, contact_title, email, phone, website, next_touch_at, scheduled_call_at });
  // Close triggers: WON kicks off onboarding (docs email + team to-dos);
  // LOST drops them into the reactivation funnel (free value + FB group)
  let sequence = null;
  if (status && status !== row.status) {
    const rep = String(req.body.rep_name || req.user.display_name || '').trim();
    if (status === 'customer') sequence = enqueueSequence(id, 'onboarding', rep);
    if (status === 'not_interested') sequence = enqueueSequence(id, 'reactivation', rep);
    if (sequence?.queued) deliverDue().catch(() => {}); // fire the immediate steps now
  }
  res.json({ ...db.prepare('SELECT * FROM prospects WHERE id = ?').get(id), sequence });
});

// ---------- discovery call: talking points → checklist → live pricing ----------
// The rep works the QUALIFICATION talking points on the call, checks off what
// the prospect cares about, and the package + pricing structure assembles
// itself per the Pricing Standard. GET returns state; PATCH saves and both
// return the freshly computed proposal.
// v1 discovery checklists saved under the old 8-question keys — fold them
// into the v2 six-need diagnostic so nothing a rep checked is lost.
const LEGACY_NEED_KEYS = {
  presence: 'presence', reviews: 'reputation', lead_capture: 'crm_follow_up',
  follow_up: 'crm_follow_up', phone_coverage: 'ai_calls', old_database: 'growth',
  marketing: 'full_marketing', content_supply: 'full_marketing',
};
const discoveryPayload = (row, rep) => {
  const d = (() => { try { return JSON.parse(row.discovery_json || '{}'); } catch { return {}; } })();
  d.checked = [...new Set((d.checked || []).map((k) => LEGACY_NEED_KEYS[k] || k))];
  const proposal = buildProposal(row, d);
  return {
    items: QUALIFICATION.map((q) => ({ key: q.key, area: q.area, question: q.question, rep_says: q.rep_says, do_not: q.do_not, checked: d.checked.includes(q.key) })),
    essentials: ESSENTIAL_ADDONS.map((e) => {
      const addon = e.addon ? ADD_ONS.find((a) => a.name === e.addon) : null;
      return { key: e.key, question: e.question, addon: e.addon, scoped: e.scoped || null, price: addon?.price || 'quoted after scoping', when: e.when, checked: (d.extras || []).includes(e.key) };
    }),
    close_checklist: CLOSE_CHECKLIST,
    notes: d.notes || '',
    proposal,
    proposal_text: proposalText(row, proposal, rep),
  };
};
app.get('/api/prospects/:id/discovery', (req, res) => {
  const row = getProspect(req);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(discoveryPayload(row, String(req.query.rep || req.user.display_name || '')));
});
app.patch('/api/prospects/:id/discovery', (req, res) => {
  const row = getProspect(req);
  if (!row) return res.status(404).json({ error: 'not found' });
  const validKeys = new Set(QUALIFICATION.map((q) => q.key));
  const validExtras = new Set(ESSENTIAL_ADDONS.map((e) => e.key));
  const d = {
    checked: (Array.isArray(req.body?.checked) ? req.body.checked : [])
      .map((k) => LEGACY_NEED_KEYS[k] || k).filter((k) => validKeys.has(k)),
    extras: (Array.isArray(req.body?.extras) ? req.body.extras : []).filter((n) => validExtras.has(n)),
    notes: String(req.body?.notes || '').slice(0, 4000),
  };
  updateProspect(row.id, { discovery_json: JSON.stringify(d) });
  res.json(discoveryPayload({ ...row, discovery_json: JSON.stringify(d) }, String(req.body?.rep_name || req.user.display_name || '')));
});

// ---------- economics: MANAGEMENT ONLY ----------
// Commission and margin logic never reaches rep-facing UI or proposals.
app.get('/api/economics', adminOnly, (req, res) => {
  res.json({
    ...ECONOMICS,
    packages: PACKAGES.map((p) => ({
      name: p.name, monthly: p.monthly, setup: p.setup,
      commission_monthly: Math.round(p.monthly * ECONOMICS.standard_commission),
      commission_setup: Math.round(p.setup * ECONOMICS.standard_commission),
    })),
  });
});

// ---------- unified history: every touch, send, and to-do on one timeline ----------
app.get('/api/prospects/:id/history', (req, res) => {
  const id = Number(req.params.id);
  const touches = db.prepare('SELECT id, direction, channel, text, classification, stage_after, rep, created_at FROM prospect_touches WHERE prospect_id = ? ORDER BY id DESC LIMIT 200').all(id);
  const sends = db.prepare("SELECT id, sequence, step_key, channel, due_at, status, sent_via, sent_at, subject, error FROM sequence_events WHERE prospect_id = ? AND step_key != 'entered' ORDER BY due_at").all(id);
  const todos = db.prepare('SELECT id, text, assigned_to, done, due_at, created_at FROM todos WHERE prospect_id = ? ORDER BY done, due_at').all(id);
  res.json({ touches, sends, todos });
});

// ---------- to-dos: the rep's marching orders ----------
app.get('/api/todos', (req, res) => {
  const rep = String(req.query.rep || req.user.display_name || '');
  const all = req.query.all === '1' && req.user.role === 'admin';
  const rows = db.prepare(`
    SELECT todos.*, prospects.business_name, prospects.dba_name
    FROM todos LEFT JOIN prospects ON prospects.id = todos.prospect_id
    WHERE todos.done = 0 ${all ? '' : 'AND (todos.assigned_to = ? OR todos.assigned_to IS NULL)'}
    ORDER BY todos.due_at LIMIT 100
  `).all(...(all ? [] : [rep]));
  res.json(rows);
});
app.post('/api/todos', (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'What needs doing?' });
  const r = db.prepare('INSERT INTO todos (prospect_id, assigned_to, text, due_at) VALUES (?, ?, ?, ?)')
    .run(req.body?.prospect_id || null, String(req.body?.rep_name || req.user.display_name || '') || null, text, req.body?.due_at || null);
  res.json(db.prepare('SELECT * FROM todos WHERE id = ?').get(Number(r.lastInsertRowid)));
});
app.patch('/api/todos/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'not found' });
  if (req.body?.done !== undefined) {
    db.prepare("UPDATE todos SET done = ?, done_at = CASE WHEN ? THEN datetime('now') ELSE NULL END WHERE id = ?")
      .run(req.body.done ? 1 : 0, req.body.done ? 1 : 0, row.id);
  }
  res.json(db.prepare('SELECT * FROM todos WHERE id = ?').get(row.id));
});

// ---------- outbox: queued sequence sends ----------
// With Resend/Twilio configured these go out on their own; without, a rep
// clears them here with one tap (copy → send from their own phone/mail).
app.get('/api/outbox', (req, res) => {
  const rows = db.prepare(`
    SELECT sequence_events.*, prospects.business_name, prospects.dba_name, prospects.assigned_to
    FROM sequence_events JOIN prospects ON prospects.id = sequence_events.prospect_id
    WHERE sequence_events.status IN ('pending', 'failed')
    ORDER BY sequence_events.due_at LIMIT 100
  `).all();
  res.json({ rows, email_sender: emailConfigured(), sms_sender: smsConfigured() });
});
app.post('/api/outbox/:id/send', async (req, res) => {
  const ev = db.prepare("SELECT * FROM sequence_events WHERE id = ? AND status IN ('pending', 'failed')").get(Number(req.params.id));
  if (!ev) return res.status(404).json({ error: 'not found or already sent' });
  const out = await deliverEvent(ev, { manual: !!req.body?.manual, rep: String(req.body?.rep_name || req.user.display_name || '') });
  if (!out.delivered) return res.status(502).json({ error: out.reason || 'delivery failed' });
  res.json(out);
});
app.post('/api/outbox/:id/skip', (req, res) => {
  db.prepare("UPDATE sequence_events SET status = 'skipped' WHERE id = ? AND status IN ('pending', 'failed')").run(Number(req.params.id));
  res.json({ ok: true });
});

// ---------- My book: the rep's own dashboard ----------
// Everything they own in one payload: pipeline grouped by conversation
// stage, open to-dos, queued sends, and today's numbers.
app.get('/api/my', (req, res) => {
  const rep = String(req.query.rep || req.user.display_name || '');
  if (!rep) return res.status(400).json({ error: 'no rep name' });
  const prospects = db.prepare(`
    SELECT prospects.*, ${LAST_TOUCH_COLS} FROM prospects
    WHERE assigned_to = ? AND status NOT IN ('no_contact', 'disqualified')
    ORDER BY (next_touch_at IS NOT NULL AND next_touch_at <= datetime('now')) DESC, last_touch_at DESC, score DESC
    LIMIT 400
  `).all(rep);
  const todos = db.prepare(`
    SELECT todos.*, prospects.business_name, prospects.dba_name
    FROM todos LEFT JOIN prospects ON prospects.id = todos.prospect_id
    WHERE todos.done = 0 AND todos.assigned_to = ? ORDER BY todos.due_at LIMIT 50
  `).all(rep);
  const outbox = db.prepare(`
    SELECT sequence_events.*, prospects.business_name, prospects.dba_name
    FROM sequence_events JOIN prospects ON prospects.id = sequence_events.prospect_id
    WHERE sequence_events.status IN ('pending', 'failed') AND prospects.assigned_to = ?
    ORDER BY sequence_events.due_at LIMIT 50
  `).all(rep);
  const touchesToday = db.prepare(`
    SELECT COUNT(*) c FROM prospect_touches WHERE rep = ? AND direction = 'out' AND created_at >= date('now')
  `).get(rep).c;
  res.json({
    rep,
    prospects,
    todos,
    outbox,
    senders: { email: emailConfigured(), sms: smsConfigured() },
    counts: {
      book: prospects.length,
      due: prospects.filter((p) => p.next_touch_at && p.next_touch_at.replace(' ', 'T') <= new Date().toISOString()).length,
      your_move: prospects.filter((p) => p.last_touch_dir === 'in').length,
      customers: prospects.filter((p) => p.status === 'customer').length,
      todos: todos.length,
      touches_today: touchesToday,
    },
  });
});

app.post('/api/prospects/:id/enrich', async (req, res) => {
  const row = db.prepare('SELECT * FROM prospects WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'not found' });
  try {
    await enrichProspect(row);
    applyScore(row.id);
    res.json(db.prepare('SELECT * FROM prospects WHERE id = ?').get(row.id));
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// ---------- Bulk re-enrich ----------
// Second pass over prospects still missing an email or phone — the move
// after adding enrichment API keys (Apollo/Serper), so the existing book
// gets the benefit without waiting for new ingests.
app.post('/api/reenrich', async (req, res) => {
  if (activeRuns.size > 0) return res.status(409).json({ error: 'A run is already in progress' });
  const limit = Math.min(500, Number(req.body?.limit) || 200);
  // Parked no-contact prospects are first in line — this sweep is exactly
  // how they earn their way back onto the board.
  const rows = db.prepare(`
    SELECT * FROM prospects
    WHERE (email IS NULL OR phone IS NULL
           OR (source = 'google' AND legal_name IS NULL))
      AND status NOT IN ('not_interested', 'disqualified', 'customer')
    ORDER BY (status = 'no_contact') DESC, score DESC, id DESC LIMIT ?
  `).all(limit);
  if (!rows.length) return res.status(400).json({ error: 'Nothing to re-enrich — every workable prospect already has an email and phone' });

  const runId = createRun({ mode: 'reenrich', count: rows.length });
  activeRuns.add(runId);
  updateRun(runId, { stage: 'enrich', stats: { enrichTotal: rows.length, enriched: 0 } });
  (async () => {
    let done = 0, revived = 0;
    await mapConcurrent(rows, config.pipeline.enrichConcurrency, async (row) => {
      await enrichProspect(row).catch(() => {});
      applyScore(row.id);
      const fresh = db.prepare('SELECT email, email_status, phone, status FROM prospects WHERE id = ?').get(row.id);
      if (fresh.status === 'no_contact' && ((fresh.email && ['verified', 'valid_mx'].includes(fresh.email_status)) || fresh.phone)) {
        updateProspect(row.id, { status: 'new' });
        revived++;
      }
      done++;
      if (done % 10 === 0 || done === rows.length) updateRun(runId, { stats: { enriched: done } });
    });
    updateRun(runId, { status: 'done', stats: { ingested: 0, reenriched: done, revived } });
  })()
    .catch((err) => updateRun(runId, { status: 'failed', error: String(err?.message || err) }))
    .finally(() => activeRuns.delete(runId));
  res.status(202).json({ runId, count: rows.length });
});

// ---------- The Daily 50 ----------
// Today's tiered call sheet: the freshest unworked prospects above the
// pool threshold, grouped 🔥 high / 🟢 strong / 🟡 explore.
app.get('/api/daily', (req, res) => {
  const size = Math.min(200, Number(req.query.size) || 50);
  const rep = String(req.query.rep || '');
  // Unclaimed or mine — two reps shouldn't cold-open the same roofer
  const mine = rep ? 'AND (assigned_to IS NULL OR assigned_to = ?)' : '';
  const rows = db.prepare(`
    SELECT prospects.*, ${LAST_TOUCH_COLS} FROM prospects
    WHERE status = 'new' AND score >= 50 AND ${acctSql(req)} ${mine}
    ORDER BY (created_at >= date('now')) DESC, score DESC, id DESC
    LIMIT ?
  `).all(...(rep ? [rep, size] : [size]));
  const groups = { high: [], strong: [], explore: [] };
  for (const r of rows) (groups[r.tier] || groups.explore).push(r);
  res.json({
    date: new Date().toISOString().slice(0, 10),
    counts: { high: groups.high.length, strong: groups.strong.length, explore: groups.explore.length },
    rows,
  });
});

// ---------- Market intelligence (Census CBP) ----------
// "Where should we prospect HVAC?" → FL counties ranked by establishment
// density for the vertical's NAICS codes.
app.get('/api/markets/:vertical', async (req, res) => {
  try {
    res.json(await marketsForVertical(req.params.vertical));
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
});

// ---------- stats ----------
app.get('/api/stats', (req, res) => {
  // Working book = everything except parked no-contact rows
  const W = `status != 'no_contact' AND ${acctSql(req)}`;
  const total = db.prepare(`SELECT COUNT(*) c FROM prospects WHERE ${W}`).get().c;
  const today = db.prepare(`SELECT COUNT(*) c FROM prospects WHERE ${W} AND created_at >= date('now')`).get().c;
  const withEmail = db.prepare(`SELECT COUNT(*) c FROM prospects WHERE ${W} AND email IS NOT NULL AND email_status IN ('verified','valid_mx')`).get().c;
  const withPhone = db.prepare(`SELECT COUNT(*) c FROM prospects WHERE ${W} AND phone IS NOT NULL`).get().c;
  const noWebsite = db.prepare(`SELECT COUNT(*) c FROM prospects WHERE ${W} AND website IS NULL`).get().c;
  const weakReviews = db.prepare(`SELECT COUNT(*) c FROM prospects WHERE ${W} AND ((google_rating IS NOT NULL AND google_rating < 4.2) OR (google_reviews IS NOT NULL AND google_reviews < 15))`).get().c;
  const avgScore = db.prepare(`SELECT ROUND(AVG(score)) a FROM prospects WHERE ${W}`).get().a || 0;
  const parked = db.prepare(`SELECT COUNT(*) c FROM prospects WHERE status = 'no_contact' AND ${acctSql(req)}`).get().c;
  const inHandoff = db.prepare(`SELECT COUNT(*) c FROM prospects WHERE ${W} AND nurture_stage IN ('qualified','handoff_requested','call_scheduled')`).get().c;
  const callsToday = db.prepare("SELECT COUNT(*) c FROM prospects WHERE date(scheduled_call_at) = date('now')").get().c;
  const touchesToday = db.prepare("SELECT COUNT(*) c FROM prospect_touches WHERE direction = 'out' AND created_at >= date('now')").get().c;
  const byStatus = Object.fromEntries(db.prepare('SELECT status, COUNT(*) c FROM prospects GROUP BY status').all().map((r) => [r.status, r.c]));
  const byIndustry = db.prepare(`SELECT industry, COUNT(*) c FROM prospects WHERE ${W} GROUP BY industry ORDER BY c DESC`).all();
  res.json({ total, today, withEmail, withPhone, noWebsite, weakReviews, avgScore, parked, inHandoff, callsToday, touchesToday, byStatus, byIndustry });
});

// ---------- follow-up calendar (right rail) ----------
// Per-day counts of due follow-ups and scheduled sales calls for a month.
function calendarDays(month, acct) {
  const days = {};
  for (const r of db.prepare(`
    SELECT CAST(strftime('%d', next_touch_at) AS INTEGER) d, COUNT(*) c FROM prospects
    WHERE ${acct} AND next_touch_at LIKE ? AND nurture_stage != 'suppressed'
      AND status NOT IN ('not_interested','disqualified','customer','no_contact')
    GROUP BY d
  `).all(`${month}%`)) {
    days[r.d] = { due: r.c, call: 0 };
  }
  for (const r of db.prepare(`
    SELECT CAST(strftime('%d', scheduled_call_at) AS INTEGER) d, COUNT(*) c FROM prospects
    WHERE ${acct} AND scheduled_call_at LIKE ? GROUP BY d
  `).all(`${month}%`)) {
    days[r.d] = days[r.d] || { due: 0, call: 0 };
    days[r.d].call = r.c;
  }
  return days;
}

app.get('/api/calendar', (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || ''))
    ? String(req.query.month)
    : new Date().toISOString().slice(0, 7);
  res.json({ month, days: calendarDays(month, acctSql(req)) });
});

// ---------- the whole right rail in ONE request ----------
// Next best call + calendar + handoffs-in-motion together, so the dashboard
// paints the rail with a single round-trip instead of four.
app.get('/api/rail', (req, res) => {
  const acct = acctSql(req);
  const WORKABLE = `status NOT IN ('not_interested','disqualified','customer','no_contact') AND nurture_stage != 'suppressed' AND ${acct}`;
  const lastDirIs = `(SELECT direction FROM prospect_touches t WHERE t.prospect_id = prospects.id ORDER BY t.id DESC LIMIT 1)`;

  let next_best = db.prepare(`
    SELECT prospects.*, ${LAST_TOUCH_COLS} FROM prospects
    WHERE ${WORKABLE} AND ${lastDirIs} = 'in'
    ORDER BY last_touch_at ASC LIMIT 1
  `).get() || null;
  let next_best_reason = next_best ? 'replied' : null;
  if (!next_best) {
    next_best = db.prepare(`
      SELECT prospects.*, ${LAST_TOUCH_COLS} FROM prospects
      WHERE ${WORKABLE} AND next_touch_at IS NOT NULL AND next_touch_at <= datetime('now')
      ORDER BY next_touch_at ASC LIMIT 1
    `).get() || null;
    if (next_best) next_best_reason = 'due';
  }

  const month = new Date().toISOString().slice(0, 7);
  const handoffs = db.prepare(`
    SELECT prospects.*, ${LAST_TOUCH_COLS} FROM prospects
    WHERE ${WORKABLE} AND nurture_stage IN ('qualified','handoff_requested','call_scheduled')
    ORDER BY last_touch_at ASC LIMIT 3
  `).all();

  res.json({ next_best, next_best_reason, month, days: calendarDays(month, acct), handoffs });
});

// ---------- provider diagnostics ----------
app.get('/api/providers', async (req, res) => {
  res.json(await providerStatus());
});

// ---------- runs ----------
// A crash/restart (e.g. the host killing the process) orphans in-flight
// runs — mark them failed at boot so the dashboard shows what happened.
db.prepare(`
  UPDATE runs SET status = 'failed', finished_at = datetime('now'),
    error = 'Interrupted — the server restarted mid-run (host redeploy or out-of-memory kill).'
  WHERE status = 'running'
`).run();

// One-time migration: prospects scored before the Opportunity Score existed
// have no tier — recompute them under the new model (offline, fast).
const untiered = db.prepare('SELECT COUNT(*) c FROM prospects WHERE tier IS NULL').get().c;
if (untiered > 0) {
  log(`rescoring ${untiered} prospects under the Opportunity Score model…`);
  scoreAll();
}

// Strict-email migration: purge guessed emails from earlier runs — they
// were never real contacts. Prospects left with no contact channel get
// parked; re-enrich sweeps will retry them against the providers.
if (!config.enrichment.email.allowGuessed) {
  const guessed = db.prepare("SELECT COUNT(*) c FROM prospects WHERE email_status = 'guessed'").get().c;
  if (guessed > 0) {
    db.prepare("UPDATE prospects SET email = NULL, email_status = NULL, email_source = NULL WHERE email_status = 'guessed'").run();
    const demoted = db.prepare(
      "UPDATE prospects SET status = 'no_contact' WHERE status = 'new' AND phone IS NULL AND email IS NULL"
    ).run().changes;
    log(`strict-email migration: cleared ${guessed} guessed emails, parked ${demoted} prospects now missing contact info`);
    scoreAll();
  }
}

const activeRuns = new Set();
app.post('/api/runs', (req, res) => {
  if (activeRuns.size > 0) return res.status(409).json({ error: 'A run is already in progress' });
  const { limit, days, industries, sources, zips, categories, requireContact, account_id } = req.body || {};
  // Prospecting FOR a client is an admin capability
  let accountId;
  if (account_id) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can run prospecting for client accounts' });
    const acct = db.prepare('SELECT id FROM accounts WHERE id = ? AND active = 1').get(Number(account_id));
    if (!acct) return res.status(400).json({ error: 'Unknown client account' });
    accountId = acct.id;
  }
  const cleanZips = Array.isArray(zips)
    ? zips.map((z) => String(z).trim()).filter((z) => /^\d{3,5}$/.test(z)).slice(0, 20)
    : undefined;
  const runId = createRun({ limit, days, industries, sources, zips: cleanZips, requireContact, accountId });
  activeRuns.add(runId);
  executeRun({ limit, days, industries, sources, zips: cleanZips, categories, requireContact, accountId, runId })
    .then(() => autoAssign())
    .catch(() => {})
    .finally(() => activeRuns.delete(runId));
  res.status(202).json({ runId });
});

app.get('/api/runs', (req, res) => {
  res.json(db.prepare('SELECT * FROM runs ORDER BY id DESC LIMIT 20').all());
});

app.get('/api/runs/:id', (req, res) => {
  const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(Number(req.params.id));
  if (!run) return res.status(404).json({ error: 'not found' });
  res.json(run);
});

// ---------- config for the UI ----------
app.get('/api/meta', (req, res) => {
  res.json({
    industries: [
      ...Object.entries(VERTICALS).map(([key, v]) => ({ key, label: v.label, priority: v.priority })),
      { key: 'new_business', label: 'New Businesses (unclassified)' },
      { key: 'gov_contractors', label: 'Federal Contractors (SAM.gov)' },
      { key: 'area_poi', label: 'Area Businesses (unclassified)' },
      ...config.dbpr.boards
        .filter((b) => !VERTICALS[b.key]) // boards whose key is already a vertical are covered above
        .map((b) => ({ key: b.key, label: b.label })),
    ],
    boards: config.dbpr.boards.map((b) => ({ key: b.key, label: b.label, enabled: b.enabled })),
    marketVerticals: Object.keys(VERTICAL_NAICS),
    sources: Object.entries(SOURCE_REGISTRY).map(([key, s]) => ({
      key,
      label: s.label,
      needsZips: !!s.needsZips,
      available: s.needsKey
        ? !!(process.env[s.needsKey] || (s.altKey && process.env[s.altKey]))
        : true,
      needsKey: s.needsKey || null,
    })),
    osmCategories: Object.entries(config.osm.categories).map(([key, c]) => ({ key, label: c.label })),
    statuses: STATUSES,
    scoringMode: config.scoring.mode,
    defaults: { limit: config.pipeline.defaultLimit, days: config.pipeline.defaultDaysWindow },
  });
});

// ---------- CSV export ----------
app.get('/api/export.csv', (req, res) => {
  const rows = db.prepare(`SELECT * FROM prospects WHERE ${acctSql(req)} ORDER BY score DESC`).all();
  const cols = ['business_name', 'dba_name', 'industry', 'license_type', 'established_date', 'contact_name', 'contact_title', 'email', 'email_status', 'phone', 'website', 'city', 'state', 'zip', 'score', 'status', 'assigned_to', 'source', 'source_id', 'notes'];
  const esc = (v) => (v == null ? '' : `"${String(v).replaceAll('"', '""')}"`);
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="prospects.csv"');
  res.send(csv);
});

// Sequence sender loop: delivers due onboarding/reactivation sends through
// the configured providers. With none configured it does nothing — those
// events wait in the Outbox for a manual one-tap send.
if (emailConfigured() || smsConfigured()) {
  setInterval(() => deliverDue().catch(() => {}), 60000);
  log(`sequences: auto-delivery on (email: ${emailConfigured() ? 'Resend' : 'manual'}, sms: ${smsConfigured() ? 'Twilio' : 'manual'})`);
} else {
  log('sequences: no email/SMS provider configured — queued sends wait in the Outbox for manual delivery (set RESEND_API_KEY+MAIL_FROM and/or TWILIO_* to automate)');
}

// Built-in daily scheduler for hosted deployments (no external cron needed).
// Set DAILY_RUN_HOUR (0-23, America/New_York) to auto-run the pipeline once
// per day; DAILY_RUN_LIMIT controls batch size (default 100).
const DAILY_RUN_HOUR = process.env.DAILY_RUN_HOUR !== undefined ? Number(process.env.DAILY_RUN_HOUR) : null;
if (DAILY_RUN_HOUR !== null && Number.isInteger(DAILY_RUN_HOUR) && DAILY_RUN_HOUR >= 0 && DAILY_RUN_HOUR <= 23) {
  const limit = Number(process.env.DAILY_RUN_LIMIT) || 100;
  setInterval(async () => {
    const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    if (nowET.getHours() !== DAILY_RUN_HOUR) return;
    if (activeRuns.size > 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const already = db.prepare("SELECT id FROM runs WHERE started_at >= ? AND status != 'failed'").get(today);
    if (already) return;
    log(`scheduler: starting daily run (limit ${limit})`);
    const runId = createRun({ limit, scheduled: true });
    activeRuns.add(runId);
    try {
      await executeRun({ limit, runId });
      autoAssign();
    } catch { /* recorded on the run row */ } finally {
      activeRuns.delete(runId);
    }
  }, 60000);
  log(`scheduler: daily pipeline run enabled at ${DAILY_RUN_HOUR}:00 America/New_York (limit ${Number(process.env.DAILY_RUN_LIMIT) || 100})`);
}

registerTrainingRoutes(app);

const port = process.env.PORT || 3000;
app.listen(port, () => log(`Innovat3 Prospect Engine → http://localhost:${port}`));
