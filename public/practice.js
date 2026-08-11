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

function repName() {
  return $('#rep-name').value.trim();
}

/* ---------- home ---------- */
async function loadHome() {
  state.meta = await api('/api/training/meta');
  $('#no-key').classList.toggle('hidden', state.meta.available);

  $('#scenario-grid').innerHTML = state.meta.scenarios.map((s) => `
    <div class="scenario-card" data-id="${s.id}">
      <div class="sc-title"><span>${esc(s.title)}</span><span class="diff ${esc(s.difficulty)}">${esc(s.difficulty)}</span></div>
      <div class="sc-persona">${esc(s.persona.name)} · ${esc(s.persona.business)} (${esc(s.persona.vertical)})</div>
      <div class="sc-persona">${esc(s.persona.situation)}</div>
      <div class="sc-objections">${s.objections.map((o) => `<span class="chip">${esc(o)}</span>`).join('')}</div>
    </div>`).join('');

  const history = await api('/api/training/sessions');
  $('#history-body').innerHTML = history.length ? history.map((h) => `
    <tr><td>${h.score != null ? `<span class="score-badge ${h.score >= 70 ? 'tier-strong' : h.score >= 50 ? 'tier-explore' : 'tier-below'}">${h.score}</span>` : '<span class="muted">—</span>'}</td>
    <td>${esc(h.rep_name)}</td><td>${esc(h.scenario_title)}</td>
    <td><span class="diff ${esc(h.difficulty)}">${esc(h.difficulty)}</span></td>
    <td class="muted">${esc((h.started_at || '').slice(0, 16))}</td></tr>`).join('')
    : '<tr><td colspan="5" class="muted" style="text-align:center;padding:20px">No practice calls yet — pick a scenario above.</td></tr>';

  const stats = await api('/api/training/stats');
  $('#stats-body').innerHTML = stats.length ? stats.map((s) => `
    <tr><td><strong>${esc(s.rep_name)}</strong></td><td>${s.calls}</td><td>${s.avg_score}</td><td>${s.best}</td></tr>`).join('')
    : '<tr><td colspan="4" class="muted" style="text-align:center;padding:20px">Complete a call to get on the board.</td></tr>';
}

/* ---------- call ---------- */
function addBubble(role, text) {
  const who = role === 'rep' ? 'You' : state.scenario.persona.name;
  $('#chat').insertAdjacentHTML('beforeend',
    `<div class="bubble ${role}"><span class="who">${esc(who)}</span>${esc(text)}</div>`);
  $('#chat').scrollTop = $('#chat').scrollHeight;
}

function setTyping(on) {
  document.querySelector('.bubble.typing')?.remove();
  if (on) {
    $('#chat').insertAdjacentHTML('beforeend', `<div class="bubble prospect typing">${esc(state.scenario.persona.name)} is talking…</div>`);
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
    if (state.remaining <= 0) {
      clearInterval(state.timer);
      endCall();
    }
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
      body: JSON.stringify({ scenario_id: scenarioId, rep_name: repName() }),
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
const BUCKET_MAX = { discovery: 20, objection_handling: 25, value_communication: 25, rapport: 15, closing: 15 };
const BUCKET_LABEL = { discovery: 'Discovery', objection_handling: 'Objection handling', value_communication: 'Value communication', rapport: 'Rapport', closing: 'Closing' };
const OUTCOME_LABEL = { booked_next_step: '📅 Booked a next step!', warm_interest: '🌡️ Warm interest', neutral: '😐 Left neutral', lost: '❌ Lost them' };

function renderResults(g) {
  show('results');
  const ring = $('#result-score');
  ring.textContent = g.overall;
  ring.className = 'score-ring ' + (g.overall >= 75 ? 'tier-high' : g.overall >= 50 ? 'tier-mid' : 'tier-low');
  $('#result-headline').textContent = OUTCOME_LABEL[g.outcome] || 'Call complete';
  $('#result-summary').textContent = g.summary || '';

  $('#result-buckets').innerHTML = Object.entries(g.buckets || {}).map(([k, v]) => `
    <div class="bucket-row">
      <div style="display:flex;justify-content:space-between"><span>${BUCKET_LABEL[k] || k}</span><strong>${v}/${BUCKET_MAX[k] || 20}</strong></div>
      <div class="bar"><div class="fill" style="width:${Math.min(100, (v / (BUCKET_MAX[k] || 20)) * 100)}%"></div></div>
    </div>`).join('');

  $('#result-faqs').innerHTML = (g.faq_results || []).map((f) => `
    <div class="faq-row">
      <div style="display:flex;justify-content:space-between;gap:8px"><span>${esc(f.question)}</span><span class="handled ${esc(f.handled)}">${esc(f.handled)}</span></div>
      <div class="fb">${esc(f.feedback)}</div>
    </div>`).join('') || '<span class="muted">No objections were raised.</span>';

  $('#result-strengths').innerHTML = (g.strengths || []).map((s) => `<li>${esc(s)}</li>`).join('') || '<li class="muted">—</li>';
  $('#result-focus').innerHTML = (g.focus_areas || []).map((s) => `<li>${esc(s)}</li>`).join('') || '<li class="muted">—</li>';
  $('#result-rebuttals').innerHTML = (g.rebuttals || []).map((r) => `
    <div class="rebuttal"><div class="q">${esc(r.question)}</div>${esc(r.say_this)}</div>`).join('')
    || '<span class="muted">You handled everything — nothing to steal.</span>';
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
$('#again-btn').onclick = () => startCall(state.scenario.id);
$('#home-btn').onclick = () => { show('home'); loadHome(); };

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
    $('#gen-status').textContent = `✅ ${r.created} scenarios added below.`;
    $('#gen-brief').value = '';
    loadHome();
  } catch (e) {
    $('#gen-status').textContent = `❌ ${e.message}`;
  } finally {
    $('#gen-btn').disabled = false;
  }
};

/* ---------- boot ---------- */
$('#rep-name').value = localStorage.getItem('rep_name') || '';
$('#rep-name').addEventListener('change', () => localStorage.setItem('rep_name', repName()));
loadHome();
