/**
 * Pipeline orchestrator: ingest → enrich → score.
 *
 * CLI:  npm run pipeline -- --limit 100 --days 180 --industries construction,electrical
 * API:  POST /api/runs (server calls executeRun asynchronously)
 * Cron: 0 7 * * 1-5  cd /path/to/app && npm run pipeline -- --limit 100
 */
import { config } from '../config.js';
import { db, insertProspect, existingSourceIds, createRun, updateRun } from '../db.js';
import { fetchDbprProspects } from '../sources/dbpr.js';
import { fetchSunbizProspects } from '../sources/sunbiz.js';
import { fetchNppesProspects } from '../sources/nppes.js';
import { fetchSamProspects } from '../sources/sam.js';
import { fetchOsmProspects } from '../sources/osm.js';
import { enrichProspect } from '../enrich/index.js';
import { applyScore } from './score.js';
import { mapConcurrent, log } from '../util.js';

export const SOURCE_REGISTRY = {
  sunbiz: { label: 'Sunbiz — new FL entities (all industries)', fetch: fetchSunbizProspects },
  dbpr: { label: 'DBPR — new FL licenses', fetch: fetchDbprProspects },
  nppes: { label: 'NPPES — new healthcare providers', fetch: fetchNppesProspects },
  sam: { label: 'SAM.gov — new federal contractors', fetch: fetchSamProspects, needsKey: 'SAM_API_KEY' },
  osm: { label: 'OpenStreetMap — businesses by area (needs zips)', fetch: fetchOsmProspects, needsZips: true },
};

export async function executeRun(params = {}) {
  const limit = params.limit ?? config.pipeline.defaultLimit;
  const days = params.days ?? config.pipeline.defaultDaysWindow;
  const industries = params.industries ?? null; // null = all enabled boards
  const zips = params.zips?.length ? params.zips : null;
  const sources = (params.sources ?? ['sunbiz', 'dbpr', 'nppes', 'sam'])
    .filter((s) => SOURCE_REGISTRY[s] && config[s]?.enabled !== false);
  const runId = params.runId ?? createRun({ limit, days, industries, sources, zips });

  try {
    // ---- Stage 1: ingest ------------------------------------------------
    updateRun(runId, { stage: 'ingest', stats: { limit, days, zips } });
    const candidates = [];

    // Split the budget between sources so one source can't crowd out the other
    const perSource = sources.length > 1 ? Math.ceil(limit / sources.length) : limit;

    for (const key of sources) {
      const src = SOURCE_REGISTRY[key];
      if (src.needsZips && !zips) continue;
      const skip = existingSourceIds(key);
      const fetched = await src.fetch({
        days, skipIds: skip, limit: perSource, zips,
        boards: industries, categories: params.categories,
      });
      candidates.push(...fetched);
    }

    // Newest first, respect overall limit
    candidates.sort((a, b) => (b.established_date || '').localeCompare(a.established_date || ''));
    const batch = candidates.slice(0, limit);

    const insertedIds = [];
    for (const p of batch) {
      if (insertProspect(p)) {
        const row = db.prepare('SELECT id FROM prospects WHERE source = ? AND source_id = ?')
          .get(p.source, p.source_id);
        insertedIds.push(row.id);
      }
    }
    log(`run#${runId} ingested ${insertedIds.length} new prospects`);
    updateRun(runId, { stats: { ingested: insertedIds.length } });

    // ---- Stage 2: enrich ------------------------------------------------
    updateRun(runId, { stage: 'enrich' });
    const rows = insertedIds.map((id) => db.prepare('SELECT * FROM prospects WHERE id = ?').get(id));
    let enriched = 0;
    await mapConcurrent(rows, config.pipeline.enrichConcurrency, async (row) => {
      await enrichProspect(row);
      enriched++;
    }, (done, total) => {
      if (done % 10 === 0 || done === total) updateRun(runId, { stats: { enriched: done, enrichTotal: total } });
    });
    log(`run#${runId} enriched ${enriched}`);

    // ---- Stage 3: score -------------------------------------------------
    updateRun(runId, { stage: 'score' });
    for (const id of insertedIds) applyScore(id);

    updateRun(runId, { status: 'done', stats: { scored: insertedIds.length } });
    log(`run#${runId} done`);
    return { runId, ingested: insertedIds.length };
  } catch (err) {
    log(`run#${runId} FAILED`, err);
    updateRun(runId, { status: 'failed', error: String(err?.stack || err) });
    throw err;
  }
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1];
  }
  executeRun({
    limit: args.limit ? Number(args.limit) : undefined,
    days: args.days ? Number(args.days) : undefined,
    industries: args.industries ? args.industries.split(',') : undefined,
    sources: args.sources ? args.sources.split(',') : undefined,
    zips: args.zips ? args.zips.split(',') : undefined,
    categories: args.categories ? args.categories.split(',') : undefined,
  }).then((r) => {
    console.log(`\nDone. Ingested ${r.ingested} prospects (run #${r.runId}).`);
    console.log('Start the dashboard with `npm start` and open http://localhost:3000');
  }).catch(() => process.exit(1));
}
