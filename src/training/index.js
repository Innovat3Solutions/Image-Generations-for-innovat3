/**
 * Practice-tab API: scenarios, FAQs, company materials, live roleplay,
 * real-call grading, progress tracking, PDF score reports.
 *
 * Works in two modes: full (ANTHROPIC_API_KEY set) and demo (canned
 * prospect + sample scorecard, clearly labeled) so the tab is visible
 * and clickable before the key is configured.
 */
import PDFDocument from 'pdfkit';
import { db } from '../db.js';
import { seedTrainingContent } from './content.js';
import {
  roleplayReply, gradeSession, generateScenarios, trainingAvailable,
  demoReply, demoGrade, CATEGORIES,
} from './llm.js';
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

function materials() {
  return db.prepare('SELECT key, label, content FROM training_materials ORDER BY rowid').all();
}

function repHistory(repName, excludeSessionId = 0, limit = 5) {
  return db.prepare(`
    SELECT started_at, score, score_json, feedback_json FROM training_sessions
    WHERE rep_name = ? AND status = 'completed' AND id != ?
    ORDER BY id DESC LIMIT ?
  `).all(repName, excludeSessionId, limit).reverse().map((r) => {
    const cats = j(r.score_json, {});
    const weakest = Object.entries(cats).sort((a, b) => a[1] - b[1])[0]?.[0] || '—';
    return {
      date: (r.started_at || '').slice(0, 10),
      overall: r.score,
      weakest,
      what_to_fix: (j(r.feedback_json, {}).what_to_fix || '').slice(0, 120),
    };
  });
}

/** Grow the objection library from objections the coach flagged as new. */
function absorbNewObjections(grade) {
  let added = 0;
  for (const o of grade.new_objections || []) {
    if (!o.question || o.question.length < 8) continue;
    const norm = o.question.toLowerCase().replace(/[^a-z0-9 ]/g, '');
    const existing = db.prepare('SELECT question FROM training_faqs').all();
    const dup = existing.some((e) => {
      const en = e.question.toLowerCase().replace(/[^a-z0-9 ]/g, '');
      return en.includes(norm) || norm.includes(en);
    });
    if (dup) continue;
    db.prepare('INSERT INTO training_faqs (question, category, rebuttal_points_json) VALUES (?, ?, ?)')
      .run(o.question, 'learned', JSON.stringify(o.rebuttal_points || []));
    added++;
  }
  if (added) log(`training: library grew by ${added} objection(s) from a graded call`);
  return added;
}

function llmError(res, err) {
  const status = err.code === 'NO_KEY' ? 503 : 502;
  res.status(status).json({ error: String(err.message || err) });
}

async function finishGrading(res, session, { scenarioDescription, faqs, transcript, isRealCall }) {
  const demo = !trainingAvailable();
  let grade;
  if (demo) {
    grade = demoGrade(session.rep_name);
  } else {
    grade = await gradeSession({
      scenarioDescription,
      faqs,
      materials: materials(),
      transcript,
      repName: session.rep_name,
      history: repHistory(session.rep_name, session.id),
      isRealCall,
    });
    grade.library_growth = absorbNewObjections(grade);
  }
  db.prepare(`
    UPDATE training_sessions SET status = 'completed', ended_at = datetime('now'),
      score = ?, score_json = ?, feedback_json = ? WHERE id = ?
  `).run(grade.overall, JSON.stringify(grade.categories), JSON.stringify(grade), session.id);
  res.json({ ...grade, session_id: session.id });
}

export function registerTrainingRoutes(app) {
  seedTrainingContent();

  // ---- meta ----
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
    res.json({ available: trainingAvailable(), scenarios, faqs, materials: materials() });
  });

  // ---- company materials ----
  app.put('/api/training/materials/:key', (req, res) => {
    const { content } = req.body || {};
    const r = db.prepare("UPDATE training_materials SET content = ?, updated_at = datetime('now') WHERE key = ?")
      .run(String(content || ''), req.params.key);
    if (!r.changes) return res.status(404).json({ error: 'unknown material' });
    res.json({ ok: true });
  });

  // ---- FAQ management ----
  app.post('/api/training/faqs', (req, res) => {
    const { question, category, rebuttal_points } = req.body || {};
    if (!question) return res.status(400).json({ error: 'question required' });
    const r = db.prepare('INSERT INTO training_faqs (question, category, rebuttal_points_json) VALUES (?, ?, ?)')
      .run(question, category || 'other', JSON.stringify(rebuttal_points || []));
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  });

  // ---- scenario generation ----
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
      let created = 0;
      for (const s of generated) {
        ins.run(s.title, JSON.stringify(s.persona), s.product_context,
          JSON.stringify((s.faq_questions || []).map(idFor).filter(Boolean)), s.difficulty);
        created++;
      }
      res.status(201).json({ created });
    } catch (err) {
      llmError(res, err);
    }
  });

  app.delete('/api/training/scenarios/:id', (req, res) => {
    db.prepare('UPDATE training_scenarios SET active = 0 WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---- roleplay sessions ----
  app.post('/api/training/sessions', async (req, res) => {
    const { scenario_id, rep_name, gatekeeper, focus_faq_id } = req.body || {};
    const scenario = scenarioWithFaqs(Number(scenario_id));
    if (!scenario) return res.status(404).json({ error: 'scenario not found' });
    if (!rep_name?.trim()) return res.status(400).json({ error: 'rep name required' });
    const demo = !trainingAvailable();
    const options = {
      gatekeeper: !!gatekeeper,
      focus_faq_id: focus_faq_id ? Number(focus_faq_id) : null,
      focus_question: focus_faq_id
        ? db.prepare('SELECT question FROM training_faqs WHERE id = ?').get(Number(focus_faq_id))?.question
        : null,
      demo,
    };
    try {
      const opening = demo
        ? demoReply(scenario, scenario.faqs, [])
        : await roleplayReply(scenario, scenario.faqs, materials(), [], options);
      const transcript = [{ role: 'prospect', text: opening, at: new Date().toISOString() }];
      const r = db.prepare('INSERT INTO training_sessions (rep_name, scenario_id, transcript_json, options_json) VALUES (?, ?, ?, ?)')
        .run(rep_name.trim(), scenario.id, JSON.stringify(transcript), JSON.stringify(options));
      res.status(201).json({ session_id: Number(r.lastInsertRowid), opening, duration_seconds: scenario.duration_seconds, demo });
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
    const options = j(session.options_json, {});
    const transcript = j(session.transcript_json, []);
    transcript.push({ role: 'rep', text, at: new Date().toISOString() });
    try {
      const reply = options.demo || !trainingAvailable()
        ? demoReply(scenario, scenario.faqs, transcript)
        : await roleplayReply(scenario, scenario.faqs, materials(), transcript, options);
      transcript.push({ role: 'prospect', text: reply, at: new Date().toISOString() });
      db.prepare('UPDATE training_sessions SET transcript_json = ? WHERE id = ?')
        .run(JSON.stringify(transcript), session.id);
      res.json({ reply });
    } catch (err) {
      db.prepare('UPDATE training_sessions SET transcript_json = ? WHERE id = ?')
        .run(JSON.stringify(transcript), session.id);
      llmError(res, err);
    }
  });

  app.post('/api/training/sessions/:id/end', async (req, res) => {
    const session = db.prepare('SELECT * FROM training_sessions WHERE id = ?').get(Number(req.params.id));
    if (!session) return res.status(404).json({ error: 'session not found' });
    if (session.status === 'completed') return res.json({ ...j(session.feedback_json, {}), session_id: session.id });
    const scenario = scenarioWithFaqs(session.scenario_id);
    const transcript = j(session.transcript_json, []);
    if (transcript.filter((t) => t.role === 'rep').length < 2) {
      db.prepare("UPDATE training_sessions SET status = 'abandoned', ended_at = datetime('now') WHERE id = ?").run(session.id);
      return res.status(400).json({ error: 'Not enough of a call to grade — say at least a couple of things next time.' });
    }
    try {
      await finishGrading(res, session, {
        scenarioDescription: `Roleplay: the rep called ${scenario.persona.name} of ${scenario.persona.business} (${scenario.persona.vertical}). ${scenario.persona.situation} Selling: ${scenario.product_context}`,
        faqs: scenario.faqs,
        transcript,
        isRealCall: false,
      });
    } catch (err) {
      llmError(res, err);
    }
  });

  // ---- Mode 2: grade a real call ----
  app.post('/api/training/grade-call', async (req, res) => {
    const { rep_name, transcript, context } = req.body || {};
    if (!rep_name?.trim()) return res.status(400).json({ error: 'rep name required' });
    if (!transcript?.trim() || transcript.trim().length < 100) {
      return res.status(400).json({ error: 'Paste the full call transcript (at least a few exchanges).' });
    }
    const scenario = db.prepare('SELECT id FROM training_scenarios ORDER BY id LIMIT 1').get();
    const r = db.prepare(`
      INSERT INTO training_sessions (rep_name, scenario_id, transcript_json, mode, options_json)
      VALUES (?, ?, ?, 'real_call', '{}')
    `).run(rep_name.trim(), scenario?.id ?? 0, JSON.stringify([{ role: 'rep', text: '[real call]', at: new Date().toISOString() }, { role: 'prospect', text: '[real call]', at: new Date().toISOString() }]));
    const session = db.prepare('SELECT * FROM training_sessions WHERE id = ?').get(Number(r.lastInsertRowid));
    const faqs = db.prepare('SELECT * FROM training_faqs WHERE active = 1').all();
    try {
      await finishGrading(res, session, {
        scenarioDescription: `REAL CALL pasted by the rep.${context ? ` Context from the rep: ${context}` : ''}`,
        faqs,
        transcript: transcript.trim(),
        isRealCall: true,
      });
    } catch (err) {
      llmError(res, err);
    }
  });

  // ---- history / team / progress ----
  app.get('/api/training/sessions', (req, res) => {
    const rep = req.query.rep?.trim();
    const rows = db.prepare(`
      SELECT ts.id, ts.rep_name, ts.score, ts.status, ts.mode, ts.started_at,
             sc.title AS scenario_title, sc.difficulty
      FROM training_sessions ts LEFT JOIN training_scenarios sc ON sc.id = ts.scenario_id
      ${rep ? 'WHERE ts.rep_name = ?' : ''}
      ORDER BY ts.id DESC LIMIT 50
    `).all(...(rep ? [rep] : []));
    res.json(rows);
  });

  app.get('/api/training/sessions/:id', (req, res) => {
    const s = db.prepare('SELECT * FROM training_sessions WHERE id = ?').get(Number(req.params.id));
    if (!s) return res.status(404).json({ error: 'not found' });
    res.json({ ...s, transcript: j(s.transcript_json, []), feedback: j(s.feedback_json, null), categories: j(s.score_json, null) });
  });

  app.get('/api/training/stats', (req, res) => {
    res.json(db.prepare(`
      SELECT rep_name, COUNT(*) calls, ROUND(AVG(score), 1) avg_score, MAX(score) best
      FROM training_sessions WHERE status = 'completed'
      GROUP BY rep_name ORDER BY avg_score DESC
    `).all());
  });

  /** Per-rep trajectory: recent scores + category averages + trend verdict. */
  app.get('/api/training/progress', (req, res) => {
    const rep = req.query.rep?.trim();
    if (!rep) return res.status(400).json({ error: 'rep required' });
    const rows = db.prepare(`
      SELECT id, score, score_json, started_at FROM training_sessions
      WHERE rep_name = ? AND status = 'completed' ORDER BY id ASC
    `).all(rep);
    const scores = rows.map((r) => ({ id: r.id, score: r.score, date: (r.started_at || '').slice(5, 10) }));
    const catTotals = {};
    for (const r of rows) {
      for (const [k, v] of Object.entries(j(r.score_json, {}))) {
        (catTotals[k] ||= []).push(v);
      }
    }
    const catAvg = Object.fromEntries(Object.entries(catTotals).map(([k, arr]) => [k, +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)]));
    let trend = null;
    if (rows.length >= 4) {
      const half = Math.floor(rows.length / 2);
      const early = rows.slice(0, half).reduce((a, r) => a + r.score, 0) / half;
      const late = rows.slice(-half).reduce((a, r) => a + r.score, 0) / half;
      const delta = +(late - early).toFixed(1);
      trend = { delta, verdict: delta >= 0.5 ? 'improving' : delta <= -0.5 ? 'slipping' : 'steady' };
    }
    res.json({ rep, calls: rows.length, scores: scores.slice(-15), categories: catAvg, trend });
  });

  // ---- PDF score report ----
  app.get('/api/training/sessions/:id/report.pdf', (req, res) => {
    const s = db.prepare(`
      SELECT ts.*, sc.title AS scenario_title FROM training_sessions ts
      LEFT JOIN training_scenarios sc ON sc.id = ts.scenario_id WHERE ts.id = ?
    `).get(Number(req.params.id));
    if (!s || s.status !== 'completed') return res.status(404).json({ error: 'completed session not found' });
    const g = j(s.feedback_json, {});
    const date = (s.ended_at || s.started_at || '').slice(0, 10);
    const scenarioTag = s.mode === 'real_call' ? 'RealCall' : (s.scenario_title || 'Roleplay').replace(/[^A-Za-z0-9]+/g, '');
    const filename = `${s.rep_name.replace(/[^A-Za-z0-9]+/g, '')}_${scenarioTag}_${date}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(18).text('Innovat3 — Sales Call Score Report', { continued: false });
    doc.moveDown(0.3).fontSize(10).fillColor('#555')
      .text(`Rep: ${s.rep_name}   ·   ${s.mode === 'real_call' ? 'Real call' : `Scenario: ${s.scenario_title}`}   ·   ${date}`);
    doc.moveDown();

    doc.fillColor('#000').fontSize(30).text(`${g.overall}/10`, { continued: true })
      .fontSize(12).fillColor('#555').text(`   overall · outcome: ${g.outcome || '—'}`);
    doc.moveDown();

    doc.fillColor('#000').fontSize(13).text('Category scores');
    for (const c of CATEGORIES) {
      const v = g.categories?.[c];
      if (v == null) continue;
      doc.fontSize(11).fillColor('#333').text(`  ${c.replace(/_/g, ' ')}: ${v}/10`);
    }
    doc.moveDown();

    const section = (title, body) => {
      doc.fontSize(13).fillColor('#000').text(title);
      doc.fontSize(11).fillColor('#333').text(body, { paragraphGap: 4 });
      doc.moveDown(0.7);
    };
    section('What worked', (g.what_worked || []).map((w) => `• ${w}`).join('\n') || '—');
    section('What to fix', g.what_to_fix || '—');
    section('Alternative line', g.alternative_line || '—');
    section('Pace check (goal: 4 closes/week)', g.pace_check || '—');
    if (g.progress_note) section('Trajectory', g.progress_note);
    if ((g.faq_results || []).length) {
      section('Objection handling', g.faq_results.map((f) => `• [${f.handled}] ${f.question} — ${f.feedback}`).join('\n'));
    }
    if ((g.rebuttals || []).length) {
      section('Rebuttals to steal', g.rebuttals.map((r) => `• ${r.question}\n  "${r.say_this}"`).join('\n'));
    }
    section('Coach summary', g.summary || '—');
    doc.fontSize(8).fillColor('#999').text('Save this file to the shared score-tracking drive folder.', { align: 'center' });
    doc.end();
  });
}
