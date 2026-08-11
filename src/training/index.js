/**
 * Practice-tab API: scenarios, FAQs, live roleplay sessions, grading, history.
 */
import { db } from '../db.js';
import { seedTrainingContent } from './content.js';
import { roleplayReply, gradeSession, generateScenarios, trainingAvailable } from './llm.js';
import { log } from '../util.js';

const j = (s, fb = null) => { try { return s ? JSON.parse(s) : fb; } catch { return fb; } };

function scenarioWithFaqs(id) {
  const s = db.prepare('SELECT * FROM training_scenarios WHERE id = ?').get(id);
  if (!s) return null;
  const ids = j(s.target_faq_ids_json, []);
  const faqs = ids.length
    ? db.prepare(`SELECT * FROM training_faqs WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids)
    : [];
  return { ...s, persona: j(s.persona_json, {}), faqs };
}

function llmError(res, err) {
  const status = err.code === 'NO_KEY' ? 503 : 502;
  res.status(status).json({ error: String(err.message || err) });
}

export function registerTrainingRoutes(app) {
  seedTrainingContent();

  // ---- meta: scenarios + faqs + availability ----
  app.get('/api/training/meta', (req, res) => {
    const scenarios = db.prepare('SELECT * FROM training_scenarios WHERE active = 1 ORDER BY id').all()
      .map((s) => {
        const ids = j(s.target_faq_ids_json, []);
        const questions = ids.length
          ? db.prepare(`SELECT question FROM training_faqs WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids).map((r) => r.question)
          : [];
        return { id: s.id, title: s.title, persona: j(s.persona_json, {}), product_context: s.product_context, difficulty: s.difficulty, duration_seconds: s.duration_seconds, source: s.source, objections: questions };
      });
    const faqs = db.prepare('SELECT * FROM training_faqs WHERE active = 1 ORDER BY id').all()
      .map((f) => ({ id: f.id, question: f.question, category: f.category, rebuttal_points: j(f.rebuttal_points_json, []) }));
    res.json({ available: trainingAvailable(), scenarios, faqs });
  });

  // ---- FAQ management ----
  app.post('/api/training/faqs', (req, res) => {
    const { question, category, rebuttal_points } = req.body || {};
    if (!question) return res.status(400).json({ error: 'question required' });
    const r = db.prepare('INSERT INTO training_faqs (question, category, rebuttal_points_json) VALUES (?, ?, ?)')
      .run(question, category || 'other', JSON.stringify(rebuttal_points || []));
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  });

  // ---- generate scenarios from a new product/promo ----
  app.post('/api/training/scenarios/generate', async (req, res) => {
    const { brief, count } = req.body || {};
    if (!brief?.trim()) return res.status(400).json({ error: 'Describe the product or promo first' });
    try {
      const faqs = db.prepare('SELECT id, question FROM training_faqs WHERE active = 1').all();
      const generated = await generateScenarios(brief.trim(), faqs.map((f) => f.question), Math.min(15, Number(count) || 10));
      const idFor = (q) => faqs.find((f) => f.question === q)?.id;
      const ins = db.prepare(`
        INSERT INTO training_scenarios (title, persona_json, product_context, target_faq_ids_json, difficulty, source)
        VALUES (?, ?, ?, ?, ?, 'generated')
      `);
      const ids = [];
      for (const s of generated) {
        const r = ins.run(s.title, JSON.stringify(s.persona), s.product_context,
          JSON.stringify((s.faq_questions || []).map(idFor).filter(Boolean)), s.difficulty);
        ids.push(Number(r.lastInsertRowid));
      }
      log(`training: generated ${ids.length} scenarios from brief`);
      res.status(201).json({ created: ids.length });
    } catch (err) {
      llmError(res, err);
    }
  });

  app.delete('/api/training/scenarios/:id', (req, res) => {
    db.prepare('UPDATE training_scenarios SET active = 0 WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---- live practice sessions ----
  app.post('/api/training/sessions', async (req, res) => {
    const { scenario_id, rep_name } = req.body || {};
    const scenario = scenarioWithFaqs(Number(scenario_id));
    if (!scenario) return res.status(404).json({ error: 'scenario not found' });
    if (!rep_name?.trim()) return res.status(400).json({ error: 'rep name required' });
    try {
      const opening = await roleplayReply(scenario, scenario.faqs, []);
      const transcript = [{ role: 'prospect', text: opening, at: new Date().toISOString() }];
      const r = db.prepare('INSERT INTO training_sessions (rep_name, scenario_id, transcript_json) VALUES (?, ?, ?)')
        .run(rep_name.trim(), scenario.id, JSON.stringify(transcript));
      res.status(201).json({ session_id: Number(r.lastInsertRowid), opening, duration_seconds: scenario.duration_seconds });
    } catch (err) {
      llmError(res, err);
    }
  });

  app.post('/api/training/sessions/:id/message', async (req, res) => {
    const session = db.prepare("SELECT * FROM training_sessions WHERE id = ? AND status = 'active'").get(Number(req.params.id));
    if (!session) return res.status(404).json({ error: 'active session not found' });
    const text = (req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'empty message' });
    const scenario = scenarioWithFaqs(session.scenario_id);
    const transcript = j(session.transcript_json, []);
    transcript.push({ role: 'rep', text, at: new Date().toISOString() });
    try {
      const reply = await roleplayReply(scenario, scenario.faqs, transcript);
      transcript.push({ role: 'prospect', text: reply, at: new Date().toISOString() });
      db.prepare('UPDATE training_sessions SET transcript_json = ? WHERE id = ?')
        .run(JSON.stringify(transcript), session.id);
      res.json({ reply });
    } catch (err) {
      // keep the rep's line even if the model call failed
      db.prepare('UPDATE training_sessions SET transcript_json = ? WHERE id = ?')
        .run(JSON.stringify(transcript), session.id);
      llmError(res, err);
    }
  });

  app.post('/api/training/sessions/:id/end', async (req, res) => {
    const session = db.prepare('SELECT * FROM training_sessions WHERE id = ?').get(Number(req.params.id));
    if (!session) return res.status(404).json({ error: 'session not found' });
    if (session.status === 'completed') return res.json(j(session.feedback_json, {}));
    const scenario = scenarioWithFaqs(session.scenario_id);
    const transcript = j(session.transcript_json, []);
    const repTurns = transcript.filter((t) => t.role === 'rep').length;
    if (repTurns < 2) {
      db.prepare("UPDATE training_sessions SET status = 'abandoned', ended_at = datetime('now') WHERE id = ?").run(session.id);
      return res.status(400).json({ error: 'Not enough of a call to grade — say at least a couple of things next time.' });
    }
    try {
      const faqRows = scenario.faqs;
      const grade = await gradeSession(scenario, faqRows, transcript);
      db.prepare(`
        UPDATE training_sessions SET status = 'completed', ended_at = datetime('now'),
          score = ?, score_json = ?, feedback_json = ? WHERE id = ?
      `).run(grade.overall, JSON.stringify(grade.buckets), JSON.stringify(grade), session.id);
      res.json(grade);
    } catch (err) {
      llmError(res, err);
    }
  });

  // ---- history + team stats ----
  app.get('/api/training/sessions', (req, res) => {
    const rep = req.query.rep?.trim();
    const rows = db.prepare(`
      SELECT ts.id, ts.rep_name, ts.score, ts.status, ts.started_at, ts.ended_at,
             sc.title AS scenario_title, sc.difficulty
      FROM training_sessions ts JOIN training_scenarios sc ON sc.id = ts.scenario_id
      ${rep ? 'WHERE ts.rep_name = ?' : ''}
      ORDER BY ts.id DESC LIMIT 50
    `).all(...(rep ? [rep] : []));
    res.json(rows);
  });

  app.get('/api/training/sessions/:id', (req, res) => {
    const s = db.prepare('SELECT * FROM training_sessions WHERE id = ?').get(Number(req.params.id));
    if (!s) return res.status(404).json({ error: 'not found' });
    res.json({ ...s, transcript: j(s.transcript_json, []), feedback: j(s.feedback_json, null), buckets: j(s.score_json, null) });
  });

  app.get('/api/training/stats', (req, res) => {
    const rows = db.prepare(`
      SELECT rep_name, COUNT(*) calls, ROUND(AVG(score)) avg_score, MAX(score) best
      FROM training_sessions WHERE status = 'completed'
      GROUP BY rep_name ORDER BY avg_score DESC
    `).all();
    res.json(rows);
  });
}
