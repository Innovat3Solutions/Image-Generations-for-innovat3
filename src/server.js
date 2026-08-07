import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, updateProspect } from './db.js';
import { config } from './config.js';
import { executeRun, SOURCE_REGISTRY } from './pipeline/run.js';
import { enrichProspect } from './enrich/index.js';
import { applyScore, scoreAll } from './pipeline/score.js';
import { createRun } from './db.js';
import { marketsForVertical, VERTICAL_NAICS } from './market.js';
import { VERTICALS } from './verticals.js';
import { log } from './util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Health check — must stay ABOVE the auth wall or the host's checker gets
// 401s, marks the instance unhealthy, and serves 502s.
app.get('/healthz', (req, res) => res.json({ ok: true }));

// Password-protect everything when DASHBOARD_PASSWORD is set (required for
// any public deployment). Reps sign in once; browsers cache the credentials.
const AUTH_USER = process.env.DASHBOARD_USER || 'innovat3';
const AUTH_PASS = process.env.DASHBOARD_PASSWORD;
if (AUTH_PASS) {
  app.use((req, res, next) => {
    const header = req.headers.authorization || '';
    const [scheme, encoded] = header.split(' ');
    if (scheme === 'Basic' && encoded) {
      const [user, ...rest] = Buffer.from(encoded, 'base64').toString().split(':');
      const pass = rest.join(':');
      if (user === AUTH_USER && pass === AUTH_PASS) return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="Innovat3 Prospect Engine"');
    res.status(401).send('Authentication required');
  });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const STATUSES = ['new', 'contacted', 'interested', 'not_interested', 'customer', 'disqualified'];

// ---------- prospects ----------
app.get('/api/prospects', (req, res) => {
  const { q, industry, source, status, minScore, hasEmail, hasPhone, noWebsite, zip, sort = 'score', dir = 'desc', page = '1', pageSize = '50' } = req.query;
  const where = [];
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
  if (minScore) { where.push('score >= ?'); params.push(Number(minScore)); }
  if (hasEmail === '1') where.push("email IS NOT NULL AND email_status != 'invalid'");
  if (hasPhone === '1') where.push('phone IS NOT NULL');
  if (noWebsite === '1') where.push('website IS NULL');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sortCol = { score: 'score', established: 'established_date', name: 'business_name', created: 'created_at', city: 'city' }[sort] || 'score';
  const dirSql = dir === 'asc' ? 'ASC' : 'DESC';
  const limit = Math.min(200, Number(pageSize) || 50);
  const offset = (Math.max(1, Number(page)) - 1) * limit;
  const total = db.prepare(`SELECT COUNT(*) c FROM prospects ${whereSql}`).get(...params).c;
  const rows = db.prepare(
    `SELECT * FROM prospects ${whereSql} ORDER BY ${sortCol} ${dirSql} NULLS LAST, id DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);
  res.json({ total, page: Number(page), pageSize: limit, rows });
});

app.get('/api/prospects/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM prospects WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

app.patch('/api/prospects/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT id FROM prospects WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'not found' });
  const { status, notes, assigned_to, contact_name, contact_title, email, phone, website } = req.body;
  if (status && !STATUSES.includes(status)) return res.status(400).json({ error: 'bad status' });
  updateProspect(id, { status, notes, assigned_to, contact_name, contact_title, email, phone, website });
  res.json(db.prepare('SELECT * FROM prospects WHERE id = ?').get(id));
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

// ---------- The Daily 50 ----------
// Today's tiered call sheet: the freshest unworked prospects above the
// pool threshold, grouped 🔥 high / 🟢 strong / 🟡 explore.
app.get('/api/daily', (req, res) => {
  const size = Math.min(200, Number(req.query.size) || 50);
  const rows = db.prepare(`
    SELECT * FROM prospects
    WHERE status = 'new' AND score >= 50
    ORDER BY (created_at >= date('now')) DESC, score DESC, id DESC
    LIMIT ?
  `).all(size);
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
  const total = db.prepare('SELECT COUNT(*) c FROM prospects').get().c;
  const today = db.prepare("SELECT COUNT(*) c FROM prospects WHERE created_at >= date('now')").get().c;
  const withEmail = db.prepare("SELECT COUNT(*) c FROM prospects WHERE email IS NOT NULL AND email_status IN ('verified','valid_mx')").get().c;
  const withPhone = db.prepare('SELECT COUNT(*) c FROM prospects WHERE phone IS NOT NULL').get().c;
  const noWebsite = db.prepare('SELECT COUNT(*) c FROM prospects WHERE website IS NULL').get().c;
  const avgScore = db.prepare('SELECT ROUND(AVG(score)) a FROM prospects').get().a || 0;
  const byStatus = Object.fromEntries(db.prepare('SELECT status, COUNT(*) c FROM prospects GROUP BY status').all().map((r) => [r.status, r.c]));
  const byIndustry = db.prepare('SELECT industry, COUNT(*) c FROM prospects GROUP BY industry ORDER BY c DESC').all();
  res.json({ total, today, withEmail, withPhone, noWebsite, avgScore, byStatus, byIndustry });
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

const activeRuns = new Set();
app.post('/api/runs', (req, res) => {
  if (activeRuns.size > 0) return res.status(409).json({ error: 'A run is already in progress' });
  const { limit, days, industries, sources, zips, categories } = req.body || {};
  const cleanZips = Array.isArray(zips)
    ? zips.map((z) => String(z).trim()).filter((z) => /^\d{3,5}$/.test(z)).slice(0, 20)
    : undefined;
  const runId = createRun({ limit, days, industries, sources, zips: cleanZips });
  activeRuns.add(runId);
  executeRun({ limit, days, industries, sources, zips: cleanZips, categories, runId })
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
      available: s.needsKey ? !!process.env[s.needsKey] : true,
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
  const rows = db.prepare('SELECT * FROM prospects ORDER BY score DESC').all();
  const cols = ['business_name', 'dba_name', 'industry', 'license_type', 'established_date', 'contact_name', 'contact_title', 'email', 'email_status', 'phone', 'website', 'city', 'state', 'zip', 'score', 'status', 'assigned_to', 'source', 'source_id', 'notes'];
  const esc = (v) => (v == null ? '' : `"${String(v).replaceAll('"', '""')}"`);
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="prospects.csv"');
  res.send(csv);
});

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
    } catch { /* recorded on the run row */ } finally {
      activeRuns.delete(runId);
    }
  }, 60000);
  log(`scheduler: daily pipeline run enabled at ${DAILY_RUN_HOUR}:00 America/New_York (limit ${Number(process.env.DAILY_RUN_LIMIT) || 100})`);
}

const port = process.env.PORT || 3000;
app.listen(port, () => log(`Innovat3 Prospect Engine → http://localhost:${port}`));
