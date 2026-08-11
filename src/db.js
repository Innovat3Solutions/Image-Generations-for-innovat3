import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { DATA_DIR } from './config.js';

export const db = new DatabaseSync(path.join(DATA_DIR, 'prospects.db'));

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS prospects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,               -- 'dbpr' | 'sunbiz'
    source_id TEXT NOT NULL,            -- license number / document number
    business_name TEXT NOT NULL,
    dba_name TEXT,
    industry TEXT,                      -- board key or filing-derived industry
    license_type TEXT,                  -- e.g. 'CBC Cert Building' or 'Florida LLC'
    entity_status TEXT,                 -- active/current etc.
    established_date TEXT,              -- ISO date: original licensure or filing date
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    county TEXT,

    contact_name TEXT,
    contact_title TEXT,
    contact_source TEXT,                -- 'sunbiz_officer' | 'sunbiz_ra' | 'dbpr_licensee' | 'website'
    officers_json TEXT,                 -- full officer/RA list from Sunbiz

    phone TEXT,
    phone_source TEXT,                  -- 'dbpr' | 'website'
    email TEXT,
    email_status TEXT,                  -- 'verified' | 'valid_mx' | 'guessed' | 'invalid' | NULL
    email_source TEXT,                  -- 'website' | 'pattern' | 'hunter'
    website TEXT,
    website_confidence TEXT,            -- 'high' | 'medium'
    socials_json TEXT,                  -- {facebook, instagram, linkedin, x, tiktok, youtube, yelp}

    score INTEGER DEFAULT 0,
    score_breakdown_json TEXT,

    status TEXT DEFAULT 'new',          -- new|contacted|interested|not_interested|customer|disqualified
    assigned_to TEXT,
    notes TEXT,

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    enriched_at TEXT,
    UNIQUE(source, source_id)
  );

  CREATE INDEX IF NOT EXISTS idx_prospects_score ON prospects(score DESC);
  CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
  CREATE INDEX IF NOT EXISTS idx_prospects_industry ON prospects(industry);
  CREATE INDEX IF NOT EXISTS idx_prospects_established ON prospects(established_date);

  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT DEFAULT (datetime('now')),
    finished_at TEXT,
    status TEXT DEFAULT 'running',      -- running|done|failed
    stage TEXT,                         -- ingest|enrich|score
    params_json TEXT,
    stats_json TEXT,
    error TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS training_faqs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    category TEXT,                       -- price|process|trust|timing|competition
    rebuttal_points_json TEXT,           -- talking points a good answer hits
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS training_scenarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    persona_json TEXT NOT NULL,          -- {name,business,vertical,personality,situation}
    product_context TEXT,                -- what the rep is selling this scenario
    target_faq_ids_json TEXT,            -- FAQ ids the prospect will raise
    difficulty TEXT DEFAULT 'medium',    -- easy|medium|hard
    duration_seconds INTEGER DEFAULT 180,
    source TEXT DEFAULT 'seed',          -- seed|custom|generated
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS training_materials (
    key TEXT PRIMARY KEY,                -- pricing|call_script|service_limits|upsells|team_goal
    label TEXT,
    content TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS training_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rep_name TEXT NOT NULL,
    scenario_id INTEGER NOT NULL,
    transcript_json TEXT DEFAULT '[]',   -- [{role:'rep'|'prospect', text, at}]
    mode TEXT DEFAULT 'roleplay',        -- roleplay|real_call
    options_json TEXT,                   -- {gatekeeper, focus_faq_id, demo}
    status TEXT DEFAULT 'active',        -- active|completed|abandoned
    score INTEGER,
    score_json TEXT,                     -- bucket scores
    feedback_json TEXT,                  -- strengths, focus areas, faq results, rebuttals
    started_at TEXT DEFAULT (datetime('now')),
    ended_at TEXT
  );
`);

// Additive migrations for databases created by earlier versions
for (const [col, type] of [
  ['site_signals_json', 'TEXT'],   // booking/chat/forms/mobile analysis
  ['opportunities_json', 'TEXT'],  // detected pitch opportunities
  ['call_reason', 'TEXT'],         // "why you should call" summary
  ['tier', 'TEXT'],                // high | strong | explore | below
]) {
  try {
    db.exec(`ALTER TABLE prospects ADD COLUMN ${col} ${type}`);
  } catch { /* column already exists */ }
}
for (const [col, def] of [['mode', "TEXT DEFAULT 'roleplay'"], ['options_json', 'TEXT']]) {
  try {
    db.exec(`ALTER TABLE training_sessions ADD COLUMN ${col} ${def}`);
  } catch { /* column already exists */ }
}

export function insertProspect(p) {
  const stmt = db.prepare(`
    INSERT INTO prospects (
      source, source_id, business_name, dba_name, industry, license_type,
      entity_status, established_date, address, city, state, zip, county,
      contact_name, contact_title, contact_source, officers_json,
      phone, phone_source, email, email_status, email_source,
      website, website_confidence, socials_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source, source_id) DO NOTHING
  `);
  const r = stmt.run(
    p.source, p.source_id, p.business_name, p.dba_name ?? null, p.industry ?? null,
    p.license_type ?? null, p.entity_status ?? null, p.established_date ?? null,
    p.address ?? null, p.city ?? null, p.state ?? null, p.zip ?? null, p.county ?? null,
    p.contact_name ?? null, p.contact_title ?? null, p.contact_source ?? null,
    p.officers_json ?? null, p.phone ?? null, p.phone_source ?? null,
    p.email ?? null, p.email_status ?? null, p.email_source ?? null,
    p.website ?? null, p.website_confidence ?? null, p.socials_json ?? null
  );
  return r.changes > 0;
}

export function updateProspect(id, fields) {
  const allowed = [
    'contact_name', 'contact_title', 'contact_source', 'phone', 'phone_source',
    'email', 'email_status', 'email_source', 'website', 'website_confidence',
    'socials_json', 'score', 'score_breakdown_json', 'status', 'assigned_to',
    'notes', 'enriched_at', 'site_signals_json', 'opportunities_json',
    'call_reason', 'tier',
  ];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (!keys.length) return;
  const sets = keys.map((k) => `${k} = ?`).join(', ');
  db.prepare(`UPDATE prospects SET ${sets}, updated_at = datetime('now') WHERE id = ?`)
    .run(...keys.map((k) => fields[k] ?? null), id);
}

export function existingSourceIds(source) {
  return new Set(
    db.prepare('SELECT source_id FROM prospects WHERE source = ?').all(source).map((r) => r.source_id)
  );
}

export function createRun(params) {
  const r = db.prepare('INSERT INTO runs (params_json, stats_json) VALUES (?, ?)')
    .run(JSON.stringify(params), JSON.stringify({}));
  return Number(r.lastInsertRowid);
}

export function updateRun(id, { stage, stats, status, error }) {
  const cur = db.prepare('SELECT stats_json FROM runs WHERE id = ?').get(id);
  const merged = { ...JSON.parse(cur?.stats_json || '{}'), ...(stats || {}) };
  db.prepare(`
    UPDATE runs SET
      stage = COALESCE(?, stage),
      stats_json = ?,
      status = COALESCE(?, status),
      error = COALESCE(?, error),
      finished_at = CASE WHEN ? IN ('done','failed') THEN datetime('now') ELSE finished_at END
    WHERE id = ?
  `).run(stage ?? null, JSON.stringify(merged), status ?? null, error ?? null, status ?? '', id);
}
