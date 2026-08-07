/**
 * Pipeline orchestrator: ingest → enrich → score.
 *
 * CLI:  npm run pipeline -- --limit 100 --days 180 --industries construction,electrical
 * API:  POST /api/runs (server calls executeRun asynchronously)
 * Cron: 0 7 * * 1-5  cd /path/to/app && npm run pipeline -- --limit 100
 */
import { config } from '../config.js';
import { db, insertProspect, existingSourceIds, createRun, updateRun, updateProspect } from '../db.js';
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

/**
 * A run's promise is "N prospects your reps can actually contact" — not
 * "N rows". With requireContact (the default), the run loops: ingest a
 * batch → enrich → score → park anything with no email AND no phone
 * (status 'no_contact', hidden from reps, revivable by later re-enrich
 * sweeps) → pull more until the contactable target is met, the sources
 * run dry, or the safety caps hit.
 */
export async function executeRun(params = {}) {
  const limit = params.limit ?? config.pipeline.defaultLimit;
  const days = params.days ?? config.pipeline.defaultDaysWindow;
  const industries = params.industries ?? null; // null = all enabled boards
  const zips = params.zips?.length ? params.zips : null;
  const requireContact = params.requireContact ?? config.pipeline.requireContact ?? true;
  const sources = (params.sources ?? ['sunbiz', 'dbpr', 'nppes', 'sam'])
    .filter((s) => SOURCE_REGISTRY[s] && config[s]?.enabled !== false);
  const runId = params.runId ?? createRun({ limit, days, industries, sources, zips, requireContact });

  const MAX_ROUNDS = requireContact ? 4 : 1;
  const INSERT_CAP = limit * 4; // safety valve on ingest volume + enrichment credits

  try {
    let contactable = 0;
    let parked = 0;
    let totalInserted = 0;
    let totalEnriched = 0;

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const need = requireContact ? limit - contactable : limit;
      if (need <= 0) break;

      // Overshoot by the observed miss rate so later rounds converge fast
      const hitRate = totalInserted ? Math.max(0.15, contactable / totalInserted) : 0.6;
      const fetchTarget = Math.min(
        INSERT_CAP - totalInserted,
        requireContact ? Math.ceil(need / hitRate) : need
      );
      if (fetchTarget <= 0) break;

      // ---- ingest -------------------------------------------------------
      updateRun(runId, { stage: 'ingest', stats: { limit, days, zips, round, contactableTarget: requireContact ? limit : null } });
      const candidates = [];
      const perSource = sources.length > 1 ? Math.ceil(fetchTarget / sources.length) : fetchTarget;
      for (const key of sources) {
        const src = SOURCE_REGISTRY[key];
        if (src.needsZips && !zips) continue;
        const skip = existingSourceIds(key); // includes rows inserted in prior rounds
        const fetched = await src.fetch({
          days, skipIds: skip, limit: perSource, zips,
          boards: industries, categories: params.categories,
        });
        candidates.push(...fetched);
      }
      candidates.sort((a, b) => (b.established_date || '').localeCompare(a.established_date || ''));

      const insertedIds = [];
      for (const p of candidates.slice(0, fetchTarget)) {
        if (insertProspect(p)) {
          const row = db.prepare('SELECT id FROM prospects WHERE source = ? AND source_id = ?')
            .get(p.source, p.source_id);
          insertedIds.push(row.id);
        }
      }
      if (!insertedIds.length) {
        log(`run#${runId} round ${round}: sources exhausted`);
        break;
      }
      totalInserted += insertedIds.length;
      log(`run#${runId} round ${round}: ingested ${insertedIds.length} (total ${totalInserted})`);
      updateRun(runId, { stage: 'enrich', stats: { ingested: totalInserted, enrichTotal: totalInserted } });

      // ---- enrich -------------------------------------------------------
      const rows = insertedIds.map((id) => db.prepare('SELECT * FROM prospects WHERE id = ?').get(id));
      await mapConcurrent(rows, config.pipeline.enrichConcurrency, async (row) => {
        await enrichProspect(row);
        totalEnriched++;
      }, (done) => {
        if (done % 10 === 0) updateRun(runId, { stats: { enriched: totalEnriched, enrichTotal: totalInserted } });
      });

      // ---- score + contactability gate ---------------------------------
      updateRun(runId, { stage: 'score', stats: { enriched: totalEnriched } });
      for (const id of insertedIds) {
        applyScore(id);
        const row = db.prepare('SELECT email, email_status, phone FROM prospects WHERE id = ?').get(id);
        const hasContact = (row.email && row.email_status !== 'invalid') || row.phone;
        if (hasContact) {
          contactable++;
        } else if (requireContact) {
          // Park it: invisible to reps, remembered for dedupe, retried by
          // future re-enrich sweeps once its digital footprint appears.
          updateProspect(id, { status: 'no_contact' });
          parked++;
        }
      }
      updateRun(runId, { stats: { contactable, parked } });
      log(`run#${runId} round ${round}: ${contactable}/${requireContact ? limit : totalInserted} contactable, ${parked} parked`);

      if (!requireContact) break;
    }

    updateRun(runId, { status: 'done', stats: { ingested: totalInserted, contactable, parked } });
    log(`run#${runId} done — ${contactable} contactable, ${parked} parked`);
    return { runId, ingested: totalInserted, contactable, parked };
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
    console.log(`\nDone. ${r.contactable} contactable prospects added, ${r.parked} parked without contact info (run #${r.runId}).`);
    console.log('Start the dashboard with `npm start` and open http://localhost:3000');
  }).catch(() => process.exit(1));
}
