/* Innovat3 Prospect Engine — dashboard */
const $ = (sel) => document.querySelector(sel);
const state = { page: 1, sort: 'score', dir: 'desc', meta: null, pollTimer: null };

const STATUS_LABELS = {
  new: 'New', contacted: 'Contacted', interested: 'Interested',
  not_interested: 'Not interested', customer: 'Customer', disqualified: 'Disqualified',
  no_contact: 'Parked (no contact info)',
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
}

/* ---------- meta / filters ---------- */
async function loadMeta() {
  state.meta = await api('/api/meta');
  const indSel = $('#f-industry');
  for (const ind of state.meta.industries) {
    indSel.insertAdjacentHTML('beforeend', `<option value="${esc(ind.key)}">${esc(ind.label)}</option>`);
  }
  const stSel = $('#f-status');
  for (const [k, label] of Object.entries(STATUS_LABELS)) {
    stSel.insertAdjacentHTML('beforeend', `<option value="${k}">${label}</option>`);
  }
  const srcGrid = $('#run-sources');
  srcGrid.innerHTML = '<span class="muted" style="grid-column:1/-1">Data sources:</span>';
  for (const s of state.meta.sources) {
    const disabled = !s.available;
    const note = disabled ? ` <span class="muted">(needs ${s.needsKey})</span>` : s.needsZips ? ' <span class="muted">(needs zips)</span>' : '';
    const checked = s.available && !s.needsZips ? 'checked' : '';
    srcGrid.insertAdjacentHTML('beforeend',
      `<label class="chk"><input type="checkbox" class="run-src" value="${esc(s.key)}" ${checked} ${disabled ? 'disabled' : ''}/> ${esc(s.label)}${note}</label>`);
  }
  const grid = $('#run-industries');
  grid.innerHTML = '<span class="muted" style="grid-column:1/-1">DBPR license boards:</span>';
  for (const b of state.meta.boards) {
    grid.insertAdjacentHTML('beforeend',
      `<label class="chk"><input type="checkbox" class="run-ind" value="${esc(b.key)}" ${b.enabled ? 'checked' : ''}/> ${esc(b.label)}</label>`);
  }
  const catGrid = $('#run-osmcats');
  catGrid.innerHTML = '<span class="muted" style="grid-column:1/-1">OpenStreetMap categories:</span>';
  for (const c of state.meta.osmCategories) {
    catGrid.insertAdjacentHTML('beforeend',
      `<label class="chk"><input type="checkbox" class="run-cat" value="${esc(c.key)}" checked /> ${esc(c.label)}</label>`);
  }
  // OSM categories only matter when the OSM source is on
  srcGrid.addEventListener('change', () => {
    const osmOn = document.querySelector('.run-src[value="osm"]')?.checked;
    catGrid.classList.toggle('hidden', !osmOn);
  });
  $('#run-limit').value = state.meta.defaults.limit;
  $('#run-days').value = state.meta.defaults.days;
}

/* ---------- stats ---------- */
async function loadStats() {
  const s = await api('/api/stats');
  $('#stats').innerHTML = `
    <div class="tile"><div class="value">${s.total.toLocaleString()}</div><div class="label">Total prospects</div></div>
    <div class="tile"><div class="value">${s.today.toLocaleString()}</div><div class="label">Added today</div></div>
    <div class="tile"><div class="value">${s.withEmail.toLocaleString()}</div><div class="label">Reachable by email</div><div class="hint">verified or valid MX</div></div>
    <div class="tile"><div class="value">${s.withPhone.toLocaleString()}</div><div class="label">Have phone</div></div>
    <div class="tile"><div class="value">${s.noWebsite.toLocaleString()}</div><div class="label">No website yet</div><div class="hint">prime for digital services</div></div>
    <div class="tile"><div class="value">${s.avgScore}</div><div class="label">Avg score</div></div>
    <div class="tile"><div class="value">${(s.parked || 0).toLocaleString()}</div><div class="label">Parked — no contact</div><div class="hint">retried by re-enrich sweeps</div></div>
  `;
}

/* ---------- table ---------- */
function filterParams() {
  const p = new URLSearchParams();
  if ($('#f-q').value) p.set('q', $('#f-q').value);
  if ($('#f-industry').value) p.set('industry', $('#f-industry').value);
  if ($('#f-source').value) p.set('source', $('#f-source').value);
  if ($('#f-status').value) p.set('status', $('#f-status').value);
  if ($('#f-minscore').value) p.set('minScore', $('#f-minscore').value);
  if ($('#f-zip').value.trim()) p.set('zip', $('#f-zip').value.trim());
  if ($('#f-hasemail').checked) p.set('hasEmail', '1');
  if ($('#f-hasphone').checked) p.set('hasPhone', '1');
  if ($('#f-nowebsite').checked) p.set('noWebsite', '1');
  p.set('sort', state.sort);
  p.set('dir', state.dir);
  p.set('page', state.page);
  return p;
}

function industryLabel(key) {
  const hit = (state.meta?.industries || []).find((i) => i.key === key);
  return hit ? hit.label : key;
}

function emailCell(r) {
  if (!r.email) return '<span class="muted">—</span>';
  const label = { verified: '✓ verified', valid_mx: '✓ MX ok', guessed: '? guessed', invalid: '✕ invalid' }[r.email_status] || r.email_status || '';
  return `<div>${esc(r.email)}</div><span class="chip ${esc(r.email_status || '')}">${label}</span>`;
}

function webCell(r) {
  const socials = r.socials_json ? JSON.parse(r.socials_json) : {};
  const icons = [];
  if (r.website) icons.push(`<a href="${esc(r.website)}" target="_blank" rel="noopener" title="Website">🌐</a>`);
  if (socials.facebook) icons.push(`<a href="${esc(socials.facebook)}" target="_blank" rel="noopener" title="Facebook">📘</a>`);
  if (socials.instagram) icons.push(`<a href="${esc(socials.instagram)}" target="_blank" rel="noopener" title="Instagram">📸</a>`);
  if (socials.linkedin) icons.push(`<a href="${esc(socials.linkedin)}" target="_blank" rel="noopener" title="LinkedIn">💼</a>`);
  return icons.length ? `<span class="weblinks">${icons.join('')}</span>` : '<span class="muted">none</span>';
}

async function loadTable() {
  if (state.dailyMode) return loadDaily();
  $('#daily-bar').classList.add('hidden');
  const data = await api('/api/prospects?' + filterParams());
  const tbody = $('#tbody');
  if (!data.rows.length) {
    tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state">
      <div class="big">🎯</div>
      <p><strong>No prospects yet.</strong></p>
      <p>Hit <em>Run pipeline</em> to pull today's new Florida businesses and licensees.</p>
    </div></td></tr>`;
  } else {
    tbody.innerHTML = data.rows.map((r) => `
      <tr data-id="${r.id}">
        <td><span class="score-badge tier-${esc(r.tier || 'below')}" title="${esc(r.call_reason || '')}">${r.score}</span></td>
        <td><div class="biz-name">${esc(r.dba_name || r.business_name)}</div><div class="biz-sub">${esc(r.dba_name ? r.business_name : (r.license_type || ''))}</div></td>
        <td>${esc(industryLabel(r.industry))}</td>
        <td>${esc(r.established_date || '—')}</td>
        <td>${r.contact_name ? `<div>${esc(r.contact_name)}</div><div class="biz-sub">${esc(r.contact_title || '')}</div>` : '<span class="muted">—</span>'}</td>
        <td>${emailCell(r)}</td>
        <td>${esc(r.phone || '—')}</td>
        <td>${webCell(r)}</td>
        <td>${esc(r.city || '—')}</td>
        <td><select class="status-select" data-id="${r.id}">
          ${Object.entries(STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${r.status === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select></td>
      </tr>`).join('');
  }
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  $('#count-label').textContent = `${data.total.toLocaleString()} prospects`;
  $('#page-label').textContent = `Page ${data.page} of ${pages}`;
  $('#prev').disabled = data.page <= 1;
  $('#next').disabled = data.page >= pages;
}

/* ---------- The Daily 50 ---------- */
function rowHtml(r) {
  return `
    <tr data-id="${r.id}">
      <td><span class="score-badge tier-${esc(r.tier || 'below')}" title="${esc(r.call_reason || '')}">${r.score}</span></td>
      <td><div class="biz-name">${esc(r.dba_name || r.business_name)}</div><div class="biz-sub">${esc(r.dba_name ? r.business_name : (r.license_type || ''))}</div></td>
      <td>${esc(industryLabel(r.industry))}</td>
      <td>${esc(r.established_date || '—')}</td>
      <td>${r.contact_name ? `<div>${esc(r.contact_name)}</div><div class="biz-sub">${esc(r.contact_title || '')}</div>` : '<span class="muted">—</span>'}</td>
      <td>${emailCell(r)}</td>
      <td>${esc(r.phone || '—')}</td>
      <td>${webCell(r)}</td>
      <td>${esc(r.city || '—')}</td>
      <td><select class="status-select" data-id="${r.id}">
        ${Object.entries(STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${r.status === k ? 'selected' : ''}>${v}</option>`).join('')}
      </select></td>
    </tr>`;
}

async function loadDaily() {
  const data = await api('/api/daily?size=50');
  const bar = $('#daily-bar');
  bar.classList.remove('hidden');
  bar.innerHTML = `
    <strong>TODAY'S ${data.rows.length}</strong>
    <span class="tier-count">🔥 ${data.counts.high} High Opportunity</span>
    <span class="tier-count">🟢 ${data.counts.strong} Strong Fit</span>
    <span class="tier-count">🟡 ${data.counts.explore} Worth Exploring</span>
    <span class="muted">${data.date} · fresh prospects, best first — every score badge tooltip says why to call</span>
  `;
  $('#tbody').innerHTML = data.rows.length
    ? data.rows.map(rowHtml).join('')
    : `<tr><td colspan="10"><div class="empty-state"><div class="big">🔥</div><p><strong>No qualified prospects yet today.</strong></p><p>Run the pipeline to fill today's sheet.</p></div></td></tr>`;
  $('#count-label').textContent = `${data.rows.length} on today's sheet`;
  $('#page-label').textContent = '';
  $('#prev').disabled = true;
  $('#next').disabled = true;
}

/* ---------- drawer ---------- */
async function openDrawer(id) {
  const r = await api(`/api/prospects/${id}`);
  const socials = r.socials_json ? JSON.parse(r.socials_json) : {};
  const officers = r.officers_json ? JSON.parse(r.officers_json) : null;
  const breakdown = r.score_breakdown_json ? JSON.parse(r.score_breakdown_json) : {};
  const opportunities = r.opportunities_json ? JSON.parse(r.opportunities_json) : [];
  const signals = r.site_signals_json ? JSON.parse(r.site_signals_json) : null;
  const drawer = $('#drawer');
  drawer.innerHTML = `
    <button class="close-x" id="drawer-close">✕</button>
    <h2>${esc(r.dba_name || r.business_name)}</h2>${r.dba_name ? `<p class="muted" style="margin-top:-4px">legal entity: ${esc(r.business_name)}</p>` : ''}
    <p class="muted">${esc(r.license_type || '')} · ${esc(industryLabel(r.industry))} · <span class="score-badge tier-${esc(r.tier || 'below')}">${r.score}</span></p>

    ${r.call_reason ? `<section><h3>Why you should call</h3><div class="call-reason">${esc(r.call_reason)}</div></section>` : ''}

    ${r.offer ? `<section><h3>Recommended offer</h3>
      <div class="offer-box">
        <div class="oh"><span>${esc(r.offer.entry.name)} — $${r.offer.entry.monthly}/mo <span class="muted">· $${r.offer.entry.setup} setup</span></span><a href="/offers.html" class="muted" style="font-size:11px">full pricing →</a></div>
        <div style="margin-top:6px">${esc(r.offer.why)}</div>
        <div style="margin-top:8px;font-style:italic;color:var(--ink-2)">${esc(r.offer.entry.talk_track)}</div>
        <div class="offer-path">
          <div style="font-size:10px;font-weight:700;letter-spacing:0.05em;color:var(--muted);text-transform:uppercase">Upsell ladder</div>
          ${r.offer.path.map((s, i) => `<div class="offer-step"><span class="os-name">${i === 0 ? '▶' : '↑'} ${esc(s.name)} $${s.monthly}${s.key === 'ai' || s.key === 'growth' ? '+' : ''}/mo</span><span class="muted">${esc(s.trigger)}</span></div>`).join('')}
        </div>
      </div>
    </section>` : ''}

    <section>
      <h3>Nurture flow <span class="muted" style="font-weight:400;font-size:11px">— warm them up by text/email, then hand off to a human</span></h3>
      <div id="n-panel"><span class="muted">Loading…</span></div>
    </section>

    ${opportunities.length ? `<section><h3>Detected opportunities</h3>${opportunities.map((o) => `
      <div class="opp"><div class="opp-head"><span>${esc(o.label)}</span><span class="lvl ${esc(o.level)}">${esc(o.level)}</span></div>
      <div class="why">${esc(o.why)}</div></div>`).join('')}</section>` : ''}

    <section>
      <h3>Contact</h3>
      <dl class="kv">
        <dt>Decision maker</dt><dd>${esc(r.contact_name || '—')} ${r.contact_title ? `<span class="muted">(${esc(r.contact_title)})</span>` : ''}</dd>
        <dt>Email</dt><dd>${r.email ? `${esc(r.email)} <span class="chip ${esc(r.email_status || '')}">${esc(r.email_status || '')}</span> <button class="copy-btn" data-copy="${esc(r.email)}">copy</button>` : '—'}</dd>
        <dt>Phone</dt><dd>${r.phone ? `${esc(r.phone)} <button class="copy-btn" data-copy="${esc(r.phone)}">copy</button>` : '—'}</dd>
        <dt>Website</dt><dd>${r.website ? `<a href="${esc(r.website)}" target="_blank" rel="noopener">${esc(r.website)}</a> <span class="muted">(${esc(r.website_confidence || '')})</span>` : 'none found'}</dd>
        ${signals ? `<dt>Site quality</dt><dd>${signals.quality}/100 <span class="muted">· ${signals.platform}${signals.mobileViewport ? '' : ' · not mobile-ready'}${signals.hasBooking ? ' · booking ✓' : ' · no booking'}${signals.hasChat ? ' · chat ✓' : ' · no chat'}${signals.hasCrm ? ' · CRM ✓' : ''}</span></dd>` : ''}
        <dt>Socials</dt><dd>${Object.keys(socials).length ? Object.entries(socials).map(([k, v]) => `<a href="${esc(v)}" target="_blank" rel="noopener">${k}</a>`).join(' · ') : 'none found'}</dd>
      </dl>
    </section>

    <section>
      <h3>Business</h3>
      <dl class="kv">
        <dt>Established</dt><dd>${esc(r.established_date || '—')}</dd>
        <dt>Address</dt><dd>${esc([r.address, r.city, r.state, r.zip].filter(Boolean).join(', ') || '—')}</dd>
        <dt>Source</dt><dd>${esc({ sunbiz: 'Sunbiz filing', dbpr: 'DBPR license', nppes: 'NPI registry', sam: 'SAM.gov registration', osm: 'OpenStreetMap', google: 'Google Business listing' }[r.source] || r.source)} · ${esc(r.source_id)}</dd>
        <dt>Record status</dt><dd>${esc(r.entity_status || '—')}</dd>
        ${r.google_reviews ? `<dt>Google reviews</dt><dd>${r.google_rating}★ · ${r.google_reviews} reviews</dd>` : ''}
      </dl>
    </section>

    ${officers?.officers?.length ? `<section><h3>Officers (Sunbiz)</h3><dl class="kv">${officers.officers.map((o) => `<dt>${esc(o.title || 'Officer')}</dt><dd>${esc(o.name)}${o.city ? ` <span class="muted">· ${esc(o.city)}, ${esc(o.state)}</span>` : ''}</dd>`).join('')}${officers.registeredAgent?.name ? `<dt>Reg. agent</dt><dd>${esc(officers.registeredAgent.name)}</dd>` : ''}</dl></section>` : ''}

    <section>
      <h3>Score breakdown</h3>
      <div class="breakdown">${Object.entries(breakdown).map(([k, v]) => `<span class="chip">${esc(k.replaceAll('_', ' '))}: +${v}</span>`).join('') || '<span class="muted">not scored yet</span>'}</div>
    </section>

    <section>
      <h3>Sales workflow</h3>
      <div class="form-row" style="margin-top:0">
        <label>Status
          <select id="d-status">${Object.entries(STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${r.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        </label>
        <label>Assigned to
          <input id="d-assigned" value="${esc(r.assigned_to || '')}" placeholder="rep name" />
        </label>
      </div>
      <label style="display:block;margin-top:10px;font-size:12px;color:var(--ink-2)">Notes
        <textarea id="d-notes">${esc(r.notes || '')}</textarea>
      </label>
      <div class="drawer-actions">
        <button class="btn primary" id="d-save">Save</button>
        <button class="btn ghost" id="d-reenrich">↻ Re-enrich</button>
      </div>
    </section>
  `;
  drawer.classList.remove('hidden');
  $('#drawer-overlay').classList.remove('hidden');

  $('#drawer-close').onclick = closeDrawer;
  drawer.querySelectorAll('.copy-btn').forEach((b) => {
    b.onclick = () => { navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'copied!'; };
  });
  $('#d-save').onclick = async () => {
    await api(`/api/prospects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: $('#d-status').value,
        assigned_to: $('#d-assigned').value,
        notes: $('#d-notes').value,
      }),
    });
    closeDrawer();
    loadTable();
  };
  // nurture flow panel
  renderNurture(id).catch((e) => { $('#n-panel').innerHTML = `<span class="muted">${esc(e.message)}</span>`; });

  $('#d-reenrich').onclick = async () => {
    $('#d-reenrich').disabled = true;
    $('#d-reenrich').textContent = 'Enriching…';
    try {
      await api(`/api/prospects/${id}/enrich`, { method: 'POST' });
      openDrawer(id);
      loadTable();
      loadStats();
    } catch (e) {
      alert('Enrichment failed: ' + e.message);
      $('#d-reenrich').disabled = false;
      $('#d-reenrich').textContent = '↻ Re-enrich';
    }
  };
}

function closeDrawer() {
  $('#drawer').classList.add('hidden');
  $('#drawer-overlay').classList.add('hidden');
}

/* ---------- nurture flow (Playbook: automation warms, humans monetize) ---------- */
const repName = () => localStorage.getItem('rep_name') || '';

async function renderNurture(id) {
  const state = await api(`/api/prospects/${id}/nurture?rep=${encodeURIComponent(repName())}`);
  paintNurture(id, state, null);
}

function paintNurture(id, state, lastReply) {
  const el = $('#n-panel');
  if (!el) return;
  // A classified reply may override the default next move (BUSY hold,
  // polite close, high-intent bypass) — prefer the reply-aware action.
  const sug = lastReply?.action || state.suggestion;
  const suppressed = state.stage === 'suppressed';
  const stages = state.stages.filter((s) => s.key !== 'suppressed');
  const idx = stages.findIndex((s) => s.key === state.stage);
  const handoffReady = ['qualified', 'handoff_requested', 'call_scheduled', 'sales_conversation'].includes(state.stage);

  el.innerHTML = `
    <div class="stage-bar">${suppressed
      ? '<span class="stage-pill suppressed">⛔ Suppressed — no further outreach on this channel</span>'
      : stages.map((s, i) => `<span class="stage-pill${i < idx ? ' done' : ''}${i === idx ? ' current' : ''}" title="${esc(s.label)}">${i < idx ? '✓ ' : ''}${esc(s.label)}</span>`).join('')}
    </div>
    ${lastReply ? `<div class="n-cls">Reply read as <span class="cls-chip ${esc(lastReply.classification)}">${esc(lastReply.classification.replaceAll('_', ' '))}</span></div>` : ''}
    ${sug.note ? `<div class="n-note">${esc(sug.note)}${sug.branch && !suppressed ? ` <span class="muted">· Opportunity track: ${esc(state.branches[sug.branch] || sug.branch)}</span>` : ''}</div>` : ''}
    ${sug.message ? `
      <textarea id="n-msg" class="outreach-out">${esc(sug.message)}</textarea>
      <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;align-items:center">
        <button class="btn primary" id="n-copy">📋 Copy</button>
        ${suppressed ? '' : '<button class="btn" id="n-sent">✓ I sent this</button>'}
        ${state.stage === 'loaded' && sug.alt ? '<button class="btn ghost" id="n-alt">✉️ Email version</button><button class="btn ghost" id="n-ai">✨ AI-personalize</button>' : ''}
        <span id="n-msg-note" class="muted" style="font-size:11px"></span>
      </div>` : ''}
    ${!suppressed ? `
      <label style="display:block;margin-top:12px;font-size:12px;color:var(--ink-2)">They replied? Paste it here — it gets read, classified, and the next move teed up
        <textarea id="n-reply" placeholder='e.g. "Thanks! Who is this?"'></textarea>
      </label>
      <button class="btn ghost" id="n-log" style="margin-top:6px">↩ Log their reply</button>` : ''}
    ${handoffReady ? `
      <button class="btn" id="n-handoff" style="margin-top:10px">📄 Build sales handoff package</button>
      <div id="n-handoff-wrap" class="hidden">
        <textarea id="n-handoff-out" class="outreach-out" readonly style="min-height:220px"></textarea>
        <button class="btn primary" id="n-handoff-copy" style="margin-top:6px">📋 Copy package</button>
      </div>` : ''}
    ${state.touches.length ? `<details style="margin-top:10px"><summary class="muted" style="cursor:pointer;font-size:12px">Conversation log (${state.touches.length})</summary>
      <div class="touch-log">${state.touches.map((t) => `<div class="touch ${esc(t.direction)}"><span class="who">${t.direction === 'out' ? 'US →' : '← THEM'}</span> ${esc(t.text)}${t.classification ? ` <span class="cls-chip sm ${esc(t.classification)}">${esc(t.classification.replaceAll('_', ' '))}</span>` : ''}</div>`).join('')}</div></details>` : ''}
  `;

  const copyBtn = (btnEl, getText) => {
    if (!btnEl) return;
    const orig = btnEl.textContent;
    btnEl.onclick = () => {
      navigator.clipboard.writeText(getText());
      btnEl.textContent = '✓ Copied';
      setTimeout(() => { btnEl.textContent = orig; }, 1500);
    };
  };
  copyBtn($('#n-copy'), () => $('#n-msg').value);

  const sent = $('#n-sent');
  if (sent) sent.onclick = async () => {
    sent.disabled = true;
    try {
      const text = $('#n-msg').value;
      const next = await api(`/api/prospects/${id}/nurture/sent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text, rep_name: repName(), stage_to: sug.stage_to,
          channel: /^Subject:/i.test(text) ? 'email' : 'sms',
        }),
      });
      paintNurture(id, next, null);
    } catch (e) { alert(e.message); sent.disabled = false; }
  };

  const alt = $('#n-alt');
  if (alt) alt.onclick = () => {
    const showingEmail = alt.dataset.on === '1';
    $('#n-msg').value = showingEmail ? sug.message : `Subject: ${sug.alt.email_subject}\n\n${sug.alt.email_body}`;
    alt.dataset.on = showingEmail ? '' : '1';
    alt.textContent = showingEmail ? '✉️ Email version' : '💬 Text version';
  };

  const ai = $('#n-ai');
  if (ai) ai.onclick = async () => {
    ai.disabled = true;
    ai.textContent = 'Writing…';
    try {
      const ch = $('#n-alt')?.dataset.on === '1' ? 'email' : 'sms';
      const out = await api(`/api/prospects/${id}/outreach`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: ch, rep_name: repName() }),
      });
      $('#n-msg').value = ch === 'email' && out.subject ? `Subject: ${out.subject}\n\n${out.body}` : out.body;
      $('#n-msg-note').textContent = out.generated === 'template'
        ? 'Personalized template — connect ANTHROPIC_API_KEY for fully AI-written drafts.'
        : 'AI draft — read it once before sending; it only used verified facts.';
    } catch (e) { alert(e.message); } finally {
      ai.disabled = false;
      ai.textContent = '✨ AI-personalize';
    }
  };

  const logBtn = $('#n-log');
  if (logBtn) logBtn.onclick = async () => {
    const text = $('#n-reply').value.trim();
    if (!text) return;
    logBtn.disabled = true;
    try {
      const out = await api(`/api/prospects/${id}/nurture/reply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, rep_name: repName() }),
      });
      paintNurture(id, out.state, { classification: out.classification, action: out.action });
    } catch (e) { alert(e.message); logBtn.disabled = false; }
  };

  const ho = $('#n-handoff');
  if (ho) ho.onclick = async () => {
    ho.disabled = true;
    try {
      const out = await api(`/api/prospects/${id}/handoff?rep=${encodeURIComponent(repName())}`);
      $('#n-handoff-wrap').classList.remove('hidden');
      $('#n-handoff-out').value = out.text;
      copyBtn($('#n-handoff-copy'), () => $('#n-handoff-out').value);
    } catch (e) { alert(e.message); } finally { ho.disabled = false; }
  };
}

/* ---------- runs ---------- */
function showRunBanner(text, spinning = true) {
  const b = $('#run-banner');
  b.classList.remove('hidden');
  b.innerHTML = `${spinning ? '<span class="spin"></span>' : ''}<span>${text}</span>`;
}

async function pollRun(runId) {
  clearInterval(state.pollTimer);
  state.pollTimer = setInterval(async () => {
    try {
      const run = await api(`/api/runs/${runId}`);
      const stats = JSON.parse(run.stats_json || '{}');
      if (run.status === 'running') {
        const fill = stats.contactableTarget ? ` · ${stats.contactable || 0}/${stats.contactableTarget} contactable` : '';
        const stageText = {
          ingest: `Pulling new businesses & licensees…${stats.round > 1 ? ` (round ${stats.round})` : ''}`,
          enrich: `Enriching — websites, emails, phones… (${stats.enriched || 0}/${stats.enrichTotal ?? '?'})`,
          score: 'Scoring prospects…',
        }[run.stage] || 'Starting…';
        showRunBanner(`Run #${runId}: ${stageText}${fill}`);
      } else {
        clearInterval(state.pollTimer);
        if (run.status === 'done') {
          showRunBanner(stats.reenriched !== undefined
            ? `✅ Run #${runId} complete — re-enriched ${stats.reenriched} prospects${stats.revived ? `, revived ${stats.revived} parked ones with new contact info` : ''}.`
            : `✅ Run #${runId} complete — ${stats.contactable ?? stats.ingested ?? 0} contactable prospects added${stats.parked ? ` (${stats.parked} parked without contact info)` : ''}.`, false);
          setTimeout(() => $('#run-banner').classList.add('hidden'), 8000);
        } else {
          showRunBanner(`❌ Run #${runId} failed: ${esc(run.error || 'unknown error').slice(0, 300)}`, false);
        }
        loadStats();
        loadTable();
      }
    } catch { /* transient */ }
  }, 1500);
}

/* ---------- events ---------- */
function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function bindEvents() {
  const refresh = () => { state.page = 1; loadTable(); };
  $('#f-q').addEventListener('input', debounce(refresh, 300));
  $('#f-zip').addEventListener('input', debounce(refresh, 300));
  for (const id of ['f-industry', 'f-source', 'f-status', 'f-minscore', 'f-hasemail', 'f-hasphone', 'f-nowebsite']) {
    $('#' + id).addEventListener('change', refresh);
  }
  $('#prev').onclick = () => { state.page--; loadTable(); };
  $('#next').onclick = () => { state.page++; loadTable(); };

  document.querySelectorAll('th.sortable').forEach((th) => {
    th.onclick = () => {
      const col = th.dataset.sort;
      if (state.sort === col) state.dir = state.dir === 'desc' ? 'asc' : 'desc';
      else { state.sort = col; state.dir = 'desc'; }
      document.querySelectorAll('th.sortable').forEach((t) => t.classList.remove('sorted-desc', 'sorted-asc'));
      th.classList.add(state.dir === 'desc' ? 'sorted-desc' : 'sorted-asc');
      loadTable();
    };
  });

  $('#tbody').addEventListener('click', (e) => {
    if (e.target.closest('.status-select') || e.target.closest('a')) return;
    const tr = e.target.closest('tr[data-id]');
    if (tr) openDrawer(tr.dataset.id);
  });
  $('#tbody').addEventListener('change', async (e) => {
    const sel = e.target.closest('.status-select');
    if (!sel) return;
    await api(`/api/prospects/${sel.dataset.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: sel.value }),
    });
    loadStats();
  });

  $('#drawer-overlay').onclick = closeDrawer;

  // Bulk re-enrich
  $('#btn-reenrich').onclick = async () => {
    if (!confirm('Run a second enrichment pass over every prospect still missing an email or phone? Uses your configured data providers (Apollo/Serper credits).')) return;
    try {
      const { runId, count } = await api('/api/reenrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      showRunBanner(`Run #${runId}: re-enriching ${count} prospects…`);
      pollRun(runId);
    } catch (e) {
      alert(e.message);
    }
  };

  // Daily 50 toggle
  $('#btn-daily').onclick = () => {
    state.dailyMode = !state.dailyMode;
    $('#btn-daily').classList.toggle('primary', state.dailyMode);
    $('#filters').style.display = state.dailyMode ? 'none' : '';
    loadTable();
  };

  // run modal
  $('#btn-run').onclick = () => {
    $('#modal-overlay').classList.remove('hidden');
    // Live-check the data provider keys so a dead key is visible BEFORE the run
    $('#provider-status').innerHTML = '<span class="muted">Checking data providers…</span>';
    api('/api/providers').then((ps) => {
      $('#provider-status').innerHTML = Object.values(ps).map((p) => {
        const cls = !p.configured ? 'off' : p.ok ? 'ok' : 'fail';
        const mark = !p.configured ? '○' : p.ok ? '✓' : '✕';
        const err = p.configured && !p.ok ? ` — ${esc(p.error || 'failing')}` : !p.configured ? ' — no key' : '';
        return `<span class="prov ${cls}" title="${esc(p.error || '')}">${mark} ${esc(p.label)}${err}</span>`;
      }).join('');
    }).catch(() => {
      $('#provider-status').innerHTML = '<span class="muted">Provider check unavailable</span>';
    });
  };
  $('#run-cancel').onclick = () => $('#modal-overlay').classList.add('hidden');
  $('#modal-overlay').addEventListener('click', (e) => {
    if (e.target === $('#modal-overlay')) $('#modal-overlay').classList.add('hidden');
  });
  $('#run-start').onclick = async () => {
    const sources = [...document.querySelectorAll('.run-src:checked')].map((c) => c.value);
    const industries = [...document.querySelectorAll('.run-ind:checked')].map((c) => c.value);
    const categories = [...document.querySelectorAll('.run-cat:checked')].map((c) => c.value);
    const zips = $('#run-zips').value.split(',').map((z) => z.trim()).filter(Boolean);
    try {
      const { runId } = await api('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: Number($('#run-limit').value) || 100,
          days: Number($('#run-days').value) || 180,
          sources,
          industries: industries.length ? industries : undefined,
          zips: zips.length ? zips : undefined,
          categories: categories.length ? categories : undefined,
        }),
      });
      $('#modal-overlay').classList.add('hidden');
      showRunBanner(`Run #${runId} starting…`);
      pollRun(runId);
    } catch (e) {
      alert(e.message);
    }
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeDrawer(); $('#modal-overlay').classList.add('hidden'); }
  });
}

/* ---------- boot ---------- */
(async function init() {
  await loadMeta();
  bindEvents();
  loadStats();
  loadTable();
  // resume banner if a run is already in flight
  const runs = await api('/api/runs');
  const active = runs.find((r) => r.status === 'running');
  if (active) { showRunBanner(`Run #${active.id} in progress…`); pollRun(active.id); }
})();
