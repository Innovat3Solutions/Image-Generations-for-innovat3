/* Innovat3 Sales Practice */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const state = { meta: null, session: null, scenario: null, timer: null, remaining: 0, ending: false };

async function api(path, opts) {
  const res = await fetch(path, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body;
}

function show(view) {
  for (const v of ['home', 'call', 'results']) $(`#view-${v}`).classList.toggle('hidden', v !== view);
}

const repName = () => $('#rep-name').value.trim();

/* ---------- home ---------- */
async function loadHome() {
  state.meta = await api('/api/training/meta');
  $('#demo-banner').classList.toggle('hidden', state.meta.available);

  $('#scenario-grid').innerHTML = state.meta.scenarios.map((s) => `
    <div class="scenario-card" data-id="${s.id}">
      <div class="sc-title"><span>${esc(s.title)}</span><span class="diff ${esc(s.difficulty)}">${esc(s.difficulty)}</span></div>
      <div class="sc-persona">${esc(s.persona.name)} · ${esc(s.persona.business)} (${esc(s.persona.vertical)})</div>
      <div class="sc-persona">${esc(s.persona.situation)}</div>
      <div class="sc-objections">${s.objections.map((o) => `<span class="chip">${esc(o)}</span>`).join('')}</div>
    </div>`).join('');

  const focus = $('#opt-focus');
  focus.innerHTML = '<option value="">Coach\'s choice</option>' +
    state.meta.faqs.map((f) => `<option value="${f.id}">${esc(f.question)}${f.category === 'learned' ? ' 🌱' : ''}</option>`).join('');

  $('#materials-list').innerHTML = state.meta.materials.map((m) => `
    <details class="gen-box" style="margin-bottom:8px">
      <summary style="cursor:pointer;font-weight:600;font-size:13px">${esc(m.label)}</summary>
      <textarea data-key="${esc(m.key)}" class="material-edit" style="margin-top:8px">${esc(m.content)}</textarea>
      <button class="btn ghost material-save" data-key="${esc(m.key)}" style="align-self:flex-start">Save</button>
    </details>`).join('');

  const history = await api('/api/training/sessions');
  $('#history-body').innerHTML = history.length ? history.map((h) => `
    <tr>
      <td>${h.score != null ? `<span class="score-badge ${h.score >= 8 ? 'tier-strong' : h.score >= 6 ? 'tier-explore' : 'tier-below'}">${h.score}/10</span>` : '<span class="muted">—</span>'}</td>
      <td>${esc(h.rep_name)}</td>
      <td>${esc(h.mode === 'real_call' ? 'Real call' : h.scenario_title || 'Roleplay')}</td>
      <td>${h.mode === 'real_call' ? '📞 real' : `<span class="diff ${esc(h.difficulty || 'medium')}">${esc(h.difficulty || '')}</span>`}</td>
      <td class="muted">${esc((h.started_at || '').slice(0, 16))}</td>
    </tr>`).join('')
    : '<tr><td colspan="5" class="muted" style="text-align:center;padding:20px">No practice calls yet — pick a scenario above.</td></tr>';

  const stats = await api('/api/training/stats');
  $('#stats-body').innerHTML = stats.length ? stats.map((s) => `
    <tr><td><strong>${esc(s.rep_name)}</strong></td><td>${s.calls}</td><td>${s.avg_score}/10</td><td>${s.best}/10</td></tr>`).join('')
    : '<tr><td colspan="4" class="muted" style="text-align:center;padding:20px">Complete a call to get on the board.</td></tr>';

  loadProgress();
}

async function loadProgress() {
  const rep = repName();
  if (!rep) { $('#progress-section').classList.add('hidden'); return; }
  try {
    const p = await api(`/api/training/progress?rep=${encodeURIComponent(rep)}`);
    if (!p.calls) { $('#progress-section').classList.add('hidden'); return; }
    $('#progress-section').classList.remove('hidden');
    const trendMsg = p.trend
      ? p.trend.verdict === 'improving'
        ? `📈 You're getting better — recent calls average <strong>+${p.trend.delta}</strong> over your early ones. Keep going.`
        : p.trend.verdict === 'slipping'
          ? `📉 Recent calls are <strong>${p.trend.delta}</strong> below your earlier average — look at your weakest category below.`
          : `➡️ Holding steady — push your weakest category to break through.`
      : `Run ${4 - p.calls > 0 ? 4 - p.calls : 'a few'} more calls to unlock your trend.`;
    const maxBar = 10;
    $('#progress-card').innerHTML = `
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;align-items:center">
        <div><strong>${esc(p.rep)}</strong> · ${p.calls} graded call${p.calls === 1 ? '' : 's'}</div>
        <div style="font-size:13px">${trendMsg}</div>
      </div>
      <div class="spark" style="margin-top:12px">${p.scores.map((s) => `
        <div class="spark-col" title="${esc(s.date)}: ${s.score}/10"><div class="spark-fill" style="height:${(s.score / maxBar) * 100}%"></div></div>`).join('')}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:12px">
        ${Object.entries(p.categories).map(([k, v]) => `<span class="chip">${esc(k.replace(/_/g, ' '))}: <strong>&nbsp;${v}</strong></span>`).join('')}
      </div>`;
  } catch { $('#progress-section').classList.add('hidden'); }
}

/* ---------- call ---------- */
function addBubble(role, text) {
  const who = role === 'rep' ? 'You' : (state.scenario?.persona?.name || 'Prospect');
  $('#chat').insertAdjacentHTML('beforeend',
    `<div class="bubble ${role}"><span class="who">${esc(who)}</span>${esc(text)}</div>`);
  $('#chat').scrollTop = $('#chat').scrollHeight;
}

function setTyping(on) {
  document.querySelector('.bubble.typing')?.remove();
  if (on) {
    $('#chat').insertAdjacentHTML('beforeend', `<div class="bubble prospect typing">${esc(state.scenario?.persona?.name || '…')} is talking…</div>`);
    $('#chat').scrollTop = $('#chat').scrollHeight;
  }
}

function startTimer(seconds) {
  clearInterval(state.timer);
  state.remaining = seconds;
  const tick = () => {
    const m = Math.floor(state.remaining / 60);
    const s = String(state.remaining % 60).padStart(2, '0');
    $('#call-timer').textContent = `${m}:${s}`;
    $('#call-timer').classList.toggle('low', state.remaining <= 30);
    if (state.remaining <= 0) { clearInterval(state.timer); endCall(); }
    state.remaining--;
  };
  tick();
  state.timer = setInterval(tick, 1000);
}

async function startCall(scenarioId) {
  if (!repName()) { alert('Put your name in the top-right first — scores are tracked per rep.'); $('#rep-name').focus(); return; }
  const scenario = state.meta.scenarios.find((s) => s.id === scenarioId);
  state.scenario = scenario;
  state.ending = false;
  show('call');
  $('#call-persona').textContent = `${scenario.persona.name} — ${scenario.persona.business}`;
  $('#call-context').textContent = `${scenario.title} · Selling: ${scenario.product_context}`;
  $('#chat').innerHTML = '';
  setTyping(true);
  try {
    const r = await api('/api/training/sessions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario_id: scenarioId,
        rep_name: repName(),
        gatekeeper: $('#opt-gatekeeper').checked,
        focus_faq_id: $('#opt-focus').value || null,
      }),
    });
    state.session = r.session_id;
    setTyping(false);
    addBubble('prospect', r.opening);
    startTimer(r.duration_seconds || 180);
    $('#chat-text').focus();
  } catch (e) {
    setTyping(false);
    alert(e.message);
    show('home');
  }
}

async function sendLine(text) {
  addBubble('rep', text);
  setTyping(true);
  try {
    const r = await api(`/api/training/sessions/${state.session}/message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    setTyping(false);
    if (!state.ending) addBubble('prospect', r.reply);
  } catch (e) {
    setTyping(false);
    addBubble('prospect', `[line hiccup: ${e.message}]`);
  }
}

async function endCall() {
  if (state.ending) return;
  state.ending = true;
  clearInterval(state.timer);
  setTyping(false);
  $('#end-call').disabled = true;
  $('#end-call').textContent = 'Scoring your call…';
  try {
    const grade = await api(`/api/training/sessions/${state.session}/end`, { method: 'POST' });
    renderResults(grade);
  } catch (e) {
    alert(e.message);
    show('home');
    loadHome();
  } finally {
    $('#end-call').disabled = false;
    $('#end-call').textContent = 'End call & get scored';
  }
}

/* ---------- results ---------- */
const CAT_LABEL = {
  persuasion: 'Persuasion', confidence: 'Confidence', product_knowledge: 'Product knowledge',
  quickness: 'Quickness', upsell_recognition: 'Upsell recognition', closing: 'Closing',
};
const OUTCOME_LABEL = {
  closed: '💰 Closed!', appointment_set: '📅 Appointment set', warm_interest: '🌡️ Warm interest',
  objection_unresolved: '🧱 Objection unresolved', did_not_engage: '🚪 Didn\'t engage', lost: '❌ Lost them',
};

function renderResults(g) {
  show('results');
  $('#result-demo-note').classList.toggle('hidden', !g.demo);
  const ring = $('#result-score');
  ring.textContent = `${g.overall}/10`;
  ring.className = 'score-ring ' + (g.overall >= 8 ? 'tier-high' : g.overall >= 6 ? 'tier-mid' : 'tier-low');
  $('#result-headline').textContent = OUTCOME_LABEL[g.outcome] || 'Call complete';
  $('#result-summary').textContent = g.summary || '';
  $('#result-progress').textContent = g.progress_note || '';

  $('#result-buckets').innerHTML = Object.entries(g.categories || {}).map(([k, v]) => `
    <div class="bucket-row">
      <div style="display:flex;justify-content:space-between"><span>${CAT_LABEL[k] || k}</span><strong>${v}/10</strong></div>
      <div class="bar"><div class="fill" style="width:${v * 10}%"></div></div>
    </div>`).join('');

  $('#result-faqs').innerHTML = (g.faq_results || []).map((f) => `
    <div class="faq-row">
      <div style="display:flex;justify-content:space-between;gap:8px"><span>${esc(f.question)}</span><span class="handled ${esc(f.handled)}">${esc(f.handled)}</span></div>
      <div class="fb">${esc(f.feedback)}</div>
    </div>`).join('') || '<span class="muted">No objections were raised.</span>';
  $('#result-growth').textContent = g.library_growth
    ? `🌱 ${g.library_growth} new objection${g.library_growth === 1 ? '' : 's'} from this call added to the team library.` : '';

  $('#result-strengths').innerHTML = (g.what_worked || []).map((s) => `<li>${esc(s)}</li>`).join('') || '<li class="muted">—</li>';
  $('#result-fix').textContent = g.what_to_fix || '—';
  $('#result-altline').textContent = g.alternative_line ? `"${g.alternative_line}"` : '—';
  $('#result-pace').textContent = g.pace_check || '—';
  $('#result-rebuttals').innerHTML = (g.rebuttals || []).map((r) => `
    <div class="rebuttal"><div class="q">${esc(r.question)}</div>${esc(r.say_this)}</div>`).join('')
    || '<span class="muted">You handled everything — nothing to steal.</span>';

  $('#report-btn').href = `/api/training/sessions/${g.session_id}/report.pdf`;
  $('#report-btn').classList.toggle('hidden', !g.session_id);
}

/* ---------- events ---------- */
$('#scenario-grid').addEventListener('click', (e) => {
  const card = e.target.closest('.scenario-card');
  if (card) startCall(Number(card.dataset.id));
});

$('#chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('#chat-text').value.trim();
  if (!text || !state.session) return;
  $('#chat-text').value = '';
  sendLine(text);
});

$('#end-call').onclick = endCall;
$('#again-btn').onclick = () => state.scenario ? startCall(state.scenario.id) : (show('home'), loadHome());
$('#home-btn').onclick = () => { show('home'); loadHome(); };

$('#real-grade-btn').onclick = async () => {
  if (!repName()) { alert('Put your name in the top-right first.'); $('#rep-name').focus(); return; }
  const transcript = $('#real-transcript').value.trim();
  if (!transcript) { $('#real-transcript').focus(); return; }
  $('#real-grade-btn').disabled = true;
  $('#real-status').textContent = 'Grading… (~30s)';
  try {
    const grade = await api('/api/training/grade-call', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rep_name: repName(), transcript, context: $('#real-context').value.trim() }),
    });
    state.scenario = null;
    $('#real-status').textContent = '';
    $('#real-transcript').value = '';
    renderResults(grade);
  } catch (e) {
    $('#real-status').textContent = `❌ ${e.message}`;
  } finally {
    $('#real-grade-btn').disabled = false;
  }
};

$('#gen-btn').onclick = async () => {
  const brief = $('#gen-brief').value.trim();
  if (!brief) { $('#gen-brief').focus(); return; }
  $('#gen-btn').disabled = true;
  $('#gen-status').textContent = 'Generating scenarios… (~30s)';
  try {
    const r = await api('/api/training/scenarios/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief, count: 10 }),
    });
    $('#gen-status').textContent = `✅ ${r.created} scenarios added.`;
    $('#gen-brief').value = '';
    loadHome();
  } catch (e) {
    $('#gen-status').textContent = `❌ ${e.message}`;
  } finally {
    $('#gen-btn').disabled = false;
  }
};

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.material-save');
  if (!btn) return;
  const key = btn.dataset.key;
  const content = document.querySelector(`.material-edit[data-key="${key}"]`).value;
  btn.textContent = 'Saving…';
  try {
    await api(`/api/training/materials/${key}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    btn.textContent = 'Saved ✓';
    setTimeout(() => { btn.textContent = 'Save'; }, 1500);
  } catch (err) {
    btn.textContent = 'Save';
    alert(err.message);
  }
});

/* ---------- boot ---------- */
$('#rep-name').value = localStorage.getItem('rep_name') || '';
$('#rep-name').addEventListener('change', () => { localStorage.setItem('rep_name', repName()); loadProgress(); });
loadHome();
