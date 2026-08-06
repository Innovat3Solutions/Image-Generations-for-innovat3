import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, updateProspect } from './db.js';
import { config } from './config.js';
import { executeRun } from './pipeline/run.js';
import { enrichProspect } from './enrich/index.js';
import { scoreProspect } from './pipeline/score.js';
import { createRun } from './db.js';
import { log } from './util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const STATUSES = ['new', 'contacted', 'interested', 'not_interested', 'customer', 'disqualified'];

// ---------- prospects ----------
app.get('/api/prospects', (req, res) => {
  const { q, industry, source, status, minScore, hasEmail, hasPhone, noWebsite, sort = 'score', dir = 'desc', page = '1', pageSize = '50' } = req.query;
  const where = [];
  const params = [];
  if (q) { where.push('(business_name LIKE ? OR dba_name LIKE ? OR contact_name LIKE ? OR city LIKE ?)'); const like = `%${q}%`; params.push(like, like, like, like); }
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
    const enriched = await enrichProspect(row);
    const { score, breakdown } = scoreProspect(enriched);
    updateProspect(row.id, { score, score_breakdown_json: JSON.stringify(breakdown) });
    res.json(db.prepare('SELECT * FROM prospects WHERE id = ?').get(row.id));
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
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
const activeRuns = new Set();
app.post('/api/runs', (req, res) => {
  if (activeRuns.size > 0) return res.status(409).json({ error: 'A run is already in progress' });
  const { limit, days, industries, sources } = req.body || {};
  const runId = createRun({ limit, days, industries, sources });
  activeRuns.add(runId);
  executeRun({ limit, days, industries, sources, runId })
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
      { key: 'new_business', label: 'New Businesses (Sunbiz)' },
      ...config.dbpr.boards.map((b) => ({ key: b.key, label: b.label, enabled: b.enabled })),
    ],
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

const port = process.env.PORT || 3000;
app.listen(port, () => log(`Innovat3 Prospect Engine → http://localhost:${port}`));
