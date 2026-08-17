/* Innovat3 Prospect Engine — dashboard */
const $ = (sel) => document.querySelector(sel);
const state = { page: 1, sort: 'score', dir: 'desc', meta: null, pollTimer: null, me: null, accounts: [], account: 'house' };

// Whose book is on screen — Innovat3's own ('house') or a client account (id)
const withAcct = (url) => (state.account && state.account !== 'house'
  ? url + (url.includes('?') ? '&' : '?') + 'account=' + state.account
  : url);
const currentAccount = () => state.accounts.find((a) => String(a.id) === String(state.account)) || null;

const STATUS_LABELS = {
  new: 'New', contacted: 'Contacted', interested: 'Interested',
  not_interested: 'Not interested', customer: 'Customer', disqualified: 'Disqualified',
  no_contact: 'Parked (no contact info)',
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- time & link helpers ---------- */
// SQLite datetimes are UTC "YYYY-MM-DD HH:MM:SS"
const parseDb = (s) => (s ? new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z') : null);
function ago(dbTime) {
  const d = parseDb(dbTime);
  if (!d) return '';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 14) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}
function ageWords(iso) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso + 'T00:00:00Z').getTime()) / 86400000);
  if (!Number.isFinite(days) || days < 0) return iso;
  if (days < 14) return `${days}d old`;
  if (days < 90) return `${Math.round(days / 7)} wk old`;
  if (days < 730) return `${Math.round(days / 30)} mo old`;
  return `${Math.floor(days / 365)}+ yr old`;
}
const isDue = (r) => r.next_touch_at && parseDb(r.next_touch_at) <= new Date();
const sqlDate = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
const digits = (phone) => '+1' + String(phone || '').replace(/\D/g, '').replace(/^1/, '');
const telHref = (phone) => `tel:${digits(phone)}`;
const smsHref = (phone, body) => `sms:${digits(phone)}?&body=${encodeURIComponent(body || '')}`;
function mailtoHref(email, msg) {
  const m = String(msg || '').match(/^Subject:\s*(.+)\n\n([\s\S]*)$/i);
  return `mailto:${email}?subject=${encodeURIComponent(m ? m[1] : '')}&body=${encodeURIComponent(m ? m[2] : msg || '')}`;
}
function mapsUrl(r) {
  if (r.source === 'google' && /^\d+$/.test(r.source_id)) return `https://maps.google.com/?cid=${r.source_id}`;
  return `https://www.google.com/maps/search/${encodeURIComponent([r.dba_name || r.business_name, r.city, 'FL'].filter(Boolean).join(' '))}`;
}

const STAGE_SHORT = {
  loaded: null, outreach_sent: 'Opener sent', engaged: 'Engaged', permission: 'Permission',
  opportunity: 'Opportunity', qualified: 'Qualified', handoff_requested: 'Handoff asked',
  call_scheduled: 'Call set', sales_conversation: 'With sales', suppressed: 'Suppressed',
};

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
  // Google listings are the seed source — needs zips, so check it the
  // moment the rep provides them
  $('#run-zips')?.addEventListener('input', () => {
    const google = document.querySelector('.run-src[value="google"]');
    if (google && !google.disabled) google.checked = $('#run-zips').value.trim().length > 0;
  });
  $('#run-limit').value = state.meta.defaults.limit;
  $('#run-days').value = state.meta.defaults.days;
}

/* ---------- slim stat strip ---------- */
async function loadStats() {
  const s = await api(withAcct('/api/stats'));
  state.statsCache = s;
  $('#stats').innerHTML = `
    <div class="tile"><span class="value">${s.total.toLocaleString()}</span><span class="label">total</span></div>
    <div class="tile"><span class="value">${s.today.toLocaleString()}</span><span class="label">added today</span></div>
    <div class="tile"><span class="value">${s.withEmail.toLocaleString()}</span><span class="label">email-reachable</span></div>
    <div class="tile"><span class="value">${s.withPhone.toLocaleString()}</span><span class="label">have phone</span></div>
    <div class="tile hot"><span class="value">${s.noWebsite.toLocaleString()}</span><span class="label">no website yet</span></div>
    <div class="tile"><span class="value">${(s.parked || 0).toLocaleString()}</span><span class="label">parked</span></div>
    <div class="tile"><span class="value">${s.avgScore || 0}</span><span class="label">avg score</span></div>
  `;
  renderSideStats();
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
  // Work-queue modes narrow the list to "what needs me right now"
  if (state.queueMode === 'your_move') { p.set('lastDir', 'in'); p.set('sort', 'last_touch'); p.set('dir', 'asc'); }
  else if (state.queueMode === 'due') { p.set('due', '1'); p.set('sort', 'last_touch'); p.set('dir', 'asc'); }
  else if (state.queueMode === 'handoffs') { p.set('stages', 'qualified,handoff_requested,call_scheduled'); p.set('sort', 'last_touch'); p.set('dir', 'asc'); }
  else if (state.queueMode === 'fresh') { p.set('status', 'new'); p.set('minScore', '50'); }
  if (state.queueMode && repName()) p.set('assigned', repName());
  if (!p.has('sort')) { p.set('sort', state.sort); p.set('dir', state.dir); }
  p.set('page', state.page);
  if (state.account && state.account !== 'house') p.set('account', state.account);
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

/* One row template everywhere — conversation-aware. */
function threadCell(r) {
  if (r.nurture_stage === 'suppressed') return '<span class="stage-mini suppressed">suppressed</span>';
  if (!r.last_touch_at) return '<span class="muted">not started</span>';
  const stage = STAGE_SHORT[r.nurture_stage] || '';
  const move = r.last_touch_dir === 'in'
    ? '<span class="move yours">your move</span>'
    : '<span class="move theirs">waiting on them</span>';
  const due = isDue(r) ? '<span class="due-badge">DUE</span>' : '';
  return `<div class="stage-mini">${esc(stage)}</div><div class="thread-sub">${ago(r.last_touch_at)} · ${move}${due}</div>`;
}

function rowHtml(r) {
  const brandNew = r.established_date
    && (Date.now() - new Date(r.established_date + 'T00:00:00Z').getTime()) / 86400000 <= 90;
  const why = [industryLabel(r.industry), r.call_reason].filter(Boolean).join(' · ');
  return `
    <tr data-id="${r.id}">
      <td><span class="score-badge tier-${esc(r.tier || 'below')}" title="${esc(r.call_reason || '')}">${r.score}</span></td>
      <td style="overflow: hidden;">
        <div class="biz-name">${esc(r.dba_name || r.business_name)}${r.google_rating ? ` <a class="rev-chip" href="${esc(mapsUrl(r))}" target="_blank" rel="noopener" title="Open their Google reviews">★ ${r.google_rating}</a>` : ''}${brandNew ? ' <span class="new-badge">NEW</span>' : ''}</div>
        <div class="call-line" title="${esc(why)}">${esc(why || (r.legal_name || r.license_type || ''))}</div>
      </td>
      <td style="overflow: hidden;">${r.contact_name ? `<div style="font-weight: 600; font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(r.contact_name)}</div><div class="thread-sub">${esc(r.contact_title || '')}</div>` : '<span class="muted">—</span>'}</td>
      <td style="overflow: hidden;">
        ${r.email ? `<div class="reach-mail">${esc(r.email)} <span class="${['verified', 'valid_mx'].includes(r.email_status) ? 'reach-ok' : 'reach-maybe'}">${['verified', 'valid_mx'].includes(r.email_status) ? '✓' : '?'}</span></div>` : '<div class="reach-mail muted">no email</div>'}
        ${r.phone ? `<div class="thread-sub"><a href="${telHref(r.phone)}" class="tel-link" title="Call">${esc(r.phone)}</a></div>` : ''}
      </td>
      <td style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink-2);">${esc(r.city || '—')}</td>
      <td style="overflow: hidden;">${threadCell(r)}</td>
      <td><select class="status-select" data-id="${r.id}">
        ${Object.entries(STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${r.status === k ? 'selected' : ''}>${v}</option>`).join('')}
      </select></td>
    </tr>`;
}

async function loadTable() {
  if (state.dailyMode) return loadDaily();
  $('#daily-bar').classList.add('hidden');
  const data = await api('/api/prospects?' + filterParams());
  const tbody = $('#tbody');
  if (!data.rows.length) {
    const msg = state.queueMode
      ? { your_move: 'No replies waiting on you. 🎉', due: 'No follow-ups due — the pipeline is worked.', handoffs: 'No handoffs pending.', fresh: 'No untouched prospects — run the pipeline.' }[state.queueMode]
      : 'Hit <em>Run pipeline</em> to pull today\'s new Florida businesses and licensees.';
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <div class="big">${state.queueMode ? '✓' : '◆'}</div>
      <p><strong>${state.queueMode ? msg : 'No prospects yet.'}</strong></p>
      ${state.queueMode ? '' : `<p>${msg}</p>`}
    </div></td></tr>`;
  } else {
    tbody.innerHTML = data.rows.map(rowHtml).join('');
  }
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  $('#count-label').textContent = `${data.total.toLocaleString()} prospects`;
  $('#page-label').textContent = `Page ${data.page} of ${pages}`;
  $('#prev').disabled = data.page <= 1;
  $('#next').disabled = data.page >= pages;
}

/* ---------- work queue cards ---------- */
async function loadQueue() {
  const q = await api(withAcct('/api/queue?rep=' + encodeURIComponent(repName())));
  state.queueCache = q;
  const cards = [
    ['your_move', 'q-accent', 'They replied — your move', q.your_move, 'Answer within the hour wins'],
    ['due', 'q-white', 'Follow-ups due', q.due, q.due > 0 ? 'Oldest first — clear the clock' : 'Nothing overdue'],
    ['handoffs', '', 'Handoffs', q.handoffs, 'Qualified → sales call'],
    ['fresh', '', 'Untouched', q.fresh, 'Score ≥ 50 · freshest first'],
  ];
  $('#queue-chips').innerHTML = cards.map(([key, cls, title, n, hint]) => `
    <button class="queue-card ${cls}${state.queueMode === key ? ' active' : ''}" data-queue="${key}">
      <span class="qc-head"><span class="qc-title">${title}</span><span class="qc-arrow">↗</span></span>
      <span class="qc-n">${n}</span>
      <span class="qc-hint">${hint}</span>
    </button>`).join('');
  document.querySelectorAll('.queue-card').forEach((b) => {
    b.onclick = () => {
      state.queueMode = state.queueMode === b.dataset.queue ? null : b.dataset.queue;
      state.dailyMode = false;
      state.page = 1;
      loadQueue();
      loadTable();
    };
  });
  loadSideRail();
}

/* ---------- right rail: next best call · calendar · handoffs ---------- */
const initialsOf = (name) => (name || '')
  .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

function renderSideStats() {
  const el = $('#side-stats');
  const s = state.statsCache;
  if (!el || !s) return;
  el.innerHTML = `
    <div><div class="value">${s.touchesToday || 0}</div><div class="label">Touches today</div></div>
    <div><div class="value">${s.callsToday || 0}</div><div class="label">Calls today</div></div>
    <div><div class="value hot">${s.inHandoff || 0}</div><div class="label">In handoff</div></div>`;
}

async function renderNextBest() {
  const wrap = $('#nbc-wrap');
  if (!wrap) return;
  let row = null;
  let why = '';
  try {
    let d = await api(withAcct('/api/prospects?lastDir=in&sort=last_touch&dir=asc&pageSize=1'));
    if (d.rows.length) {
      row = d.rows[0];
      why = `Replied ${ago(row.last_touch_at)} · ${STAGE_SHORT[row.nurture_stage] || 'in flow'}`;
    } else {
      d = await api(withAcct('/api/prospects?due=1&sort=last_touch&dir=asc&pageSize=1'));
      if (d.rows.length) {
        row = d.rows[0];
        why = `Follow-up due · ${STAGE_SHORT[row.nurture_stage] || 'in flow'}`;
      }
    }
  } catch { /* rail is optional */ }
  wrap.innerHTML = `
    ${row ? `
    <div class="nbc" data-id="${row.id}">
      <div class="nbc-avatar">${esc(initialsOf(row.dba_name || row.business_name))}</div>
      <div style="min-width: 0;">
        <div class="nbc-name">${esc(row.dba_name || row.business_name)}</div>
        <div class="nbc-sub">Score ${row.score} · <span style="color: var(--accent);">your move</span></div>
      </div>
      <div style="margin-left: auto; color: var(--accent); font-size: 15px;">↗</div>
    </div>
    <div class="nbc-heading">Next best call</div>
    <div class="nbc-line">${esc(why)}</div>` : `
    <div class="nbc-heading">Next best call</div>
    <div class="nbc-line">Queue clear — work Today's 50 or run the pipeline.</div>`}
    <div class="side-stats" id="side-stats"></div>`;
  renderSideStats();
  const card = wrap.querySelector('.nbc');
  if (card) card.onclick = () => openDrawer(card.dataset.id);
}

async function renderCalendar() {
  const el = $('#cal');
  if (!el) return;
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  let days = {};
  try { days = (await api(withAcct(`/api/calendar?month=${month}`))).days || {}; } catch { /* optional */ }
  $('#cal-title').textContent = `Follow-up calendar — ${now.toLocaleString([], { month: 'long' })}`;
  const count = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const today = now.getDate();
  let html = '';
  for (let start = 1; start <= count; start += 7) {
    html += '<div class="cal-row">' + Array.from({ length: Math.min(7, count - start + 1) }, (_, i) => {
      const d = start + i;
      const info = days[d] || {};
      const cls = d === today ? 'today' : info.call ? 'call' : info.due ? 'due' : d > today ? 'future' : '';
      const tip = [info.due ? `${info.due} follow-up${info.due > 1 ? 's' : ''} due` : '', info.call ? `${info.call} sales call${info.call > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
      return `<div class="cal-day ${cls}" data-day="${d}" title="${esc(tip)}">${d}</div>`;
    }).join('') + '</div>';
  }
  el.innerHTML = html;
  el.querySelectorAll('.cal-day.due').forEach((d) => {
    d.onclick = () => { state.queueMode = 'due'; state.page = 1; loadQueue(); loadTable(); };
  });
}

async function renderHandoffs() {
  const el = $('#handoff-list');
  if (!el) return;
  let rows = [];
  try {
    rows = (await api(withAcct('/api/prospects?stages=qualified,handoff_requested,call_scheduled&sort=last_touch&dir=asc&pageSize=3'))).rows;
  } catch { /* optional */ }
  const palettes = [
    ['var(--purple)', '#fff'],
    ['var(--accent)', 'var(--accent-ink)'],
    ['var(--white-pill)', 'var(--accent-ink)'],
  ];
  el.innerHTML = rows.length ? rows.map((r, i) => {
    const [bg, fg] = palettes[i % palettes.length];
    const when = r.scheduled_call_at
      ? `Call ${parseDb(r.scheduled_call_at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`
      : (STAGE_SHORT[r.nurture_stage] || 'Qualified');
    const who = (r.contact_name || '').split(' ')[0];
    return `
    <div class="handoff-card" data-id="${r.id}">
      <div class="hc-notch" style="background: ${bg};"></div>
      <div class="hc-avatar" style="background: ${bg}; color: ${fg};">${esc(initialsOf(r.dba_name || r.business_name))}</div>
      <div style="min-width: 0;">
        <div class="hc-name">${esc(r.dba_name || r.business_name)}</div>
        <div class="hc-sub">${esc(when)}${who ? ` · ${esc(who)}` : ''}</div>
      </div>
      <div class="hc-arrow">↗</div>
    </div>`;
  }).join('') : '<div class="nbc-line">No handoffs in motion yet.</div>';
  el.querySelectorAll('.handoff-card').forEach((c) => { c.onclick = () => openDrawer(c.dataset.id); });
}

function loadSideRail() {
  renderNextBest();
  renderCalendar();
  renderHandoffs();
}

/* ---------- The Daily 50 ---------- */
const TIER_HEADS = { high: 'High Opportunity', strong: 'Strong Fit', explore: 'Worth Exploring' };

async function loadDaily() {
  const data = await api(withAcct('/api/daily?size=50&rep=' + encodeURIComponent(repName())));
  const bar = $('#daily-bar');
  bar.classList.remove('hidden');
  bar.innerHTML = `
    <strong>TODAY'S ${data.rows.length}</strong>
    <span class="tier-count">${data.counts.high} high opportunity</span>
    <span class="tier-count">${data.counts.strong} strong fit</span>
    <span class="tier-count">${data.counts.explore} worth exploring</span>
    <span class="muted">${data.date} · fresh unclaimed prospects, best first</span>
  `;
  const groups = { high: [], strong: [], explore: [] };
  for (const r of data.rows) (groups[r.tier] || groups.explore).push(r);
  $('#tbody').innerHTML = data.rows.length
    ? ['high', 'strong', 'explore'].filter((t) => groups[t].length).map((t) =>
        `<tr class="tier-subheader"><td colspan="7">${TIER_HEADS[t]} (${groups[t].length})</td></tr>` +
        groups[t].map(rowHtml).join('')
      ).join('')
    : `<tr><td colspan="7"><div class="empty-state"><div class="big">50</div><p><strong>No qualified prospects yet today.</strong></p><p>Run the pipeline to fill today's sheet.</p></div></td></tr>`;
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
  const offer = r.offer;
  const whyLine = [industryLabel(r.industry), r.city].filter(Boolean).join(' · ');
  drawer.innerHTML = `
    <button class="close-x" id="drawer-close">✕</button>

    <div style="display: flex; gap: 13px; align-items: center; padding-right: 40px;">
      <div style="width: 52px; height: 52px; border-radius: 50%; background: var(--accent); color: var(--accent-ink); display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 800; flex: none;">${esc(initialsOf(r.dba_name || r.business_name))}</div>
      <div style="min-width: 0;">
        <h2>${esc(r.dba_name || r.business_name)}</h2>
        <div style="font-size: 11.5px; font-weight: 500; color: var(--muted); margin-top: 2px;">${esc([r.dba_name ? r.business_name : r.legal_name, whyLine].filter(Boolean).join(' · '))}${r.google_rating ? ` · <span style="color: var(--accent); font-weight: 700;">★ ${r.google_rating} (${r.google_reviews})</span>` : ''}</div>
      </div>
      <div style="margin-left: auto; text-align: center; flex: none;">
        <span class="score-badge tier-${esc(r.tier || 'below')}" style="width: 44px; height: 44px; font-size: 15px;">${r.score}</span>
        <div style="font-size: 8.5px; font-weight: 700; letter-spacing: 0.1em; color: var(--muted); margin-top: 3px;">SCORE</div>
      </div>
    </div>

    ${r.call_reason ? `<section><div class="call-reason"><div style="font-size: 11px; font-weight: 800; letter-spacing: 0.1em; opacity: 0.6;">WHY YOU SHOULD CALL</div><div style="margin-top: 5px;">${esc(r.call_reason)}</div></div></section>` : ''}

    ${offer ? `<section>
      <div class="offer-box">
        <div class="oh"><span>${esc(offer.entry.name)} — $${offer.entry.monthly}/mo <span style="font-weight: 500; font-size: 11.5px; color: #8b8b8b;">· $${offer.entry.setup} setup</span></span><a href="/offers.html">full pricing →</a></div>
        <div style="margin-top: 5px; color: #3d3d3d;">${esc(offer.why)}</div>
        <div class="talk">${esc(offer.entry.talk_track)}</div>
        <div class="offer-path">
          ${offer.path.map((p, i) => `<span class="offer-step${i === 0 ? ' entry' : ''}">${i === 0 ? '▶ ' : ''}${esc(p.name.toUpperCase())} $${p.monthly}${p.key === 'ai' || p.key === 'growth' ? '+' : ''}</span>`).join('')}
        </div>
      </div>
    </section>` : ''}

    <section>
      <h3>Nurture flow — automation warms, humans close</h3>
      <div id="n-panel"><span class="muted">Loading…</span></div>
    </section>

    ${opportunities.length ? `<section><h3>Detected opportunities</h3>${opportunities.map((o) => `
      <div class="opp"><div class="opp-head"><span>${esc(o.label)}</span><span class="why">${esc(o.why)}</span></div><span class="lvl ${esc(o.level)}">${esc(o.level.toUpperCase())}</span></div>`).join('')}</section>` : ''}

    <section style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
      <div>
        <h3>Contact</h3>
        <div style="font-size: 12px; line-height: 1.9; color: var(--ink-3);">
          ${r.contact_name ? `${esc(r.contact_name)} <span class="muted">${r.contact_title ? `(${esc(r.contact_title)})` : ''}</span><br>` : '<span class="muted">no decision maker yet</span><br>'}
          ${r.email ? `<span style="overflow-wrap: anywhere;">${esc(r.email)}</span> <span class="reach-ok">${['verified', 'valid_mx'].includes(r.email_status) ? '✓' : ''}</span> <button class="copy-btn" data-copy="${esc(r.email)}">copy</button><br>` : '<span class="muted">no verified email</span><br>'}
          ${r.phone ? `<a href="${telHref(r.phone)}" style="color: var(--ink-3);">${esc(r.phone)}</a> <button class="copy-btn" data-copy="${esc(r.phone)}">copy</button><br>` : ''}
          <span class="muted">Website:</span> ${r.website ? `<a href="${esc(r.website)}" target="_blank" rel="noopener">${esc(r.website.replace(/^https?:\/\/(www\.)?/, ''))}</a>${signals ? ` <span class="muted">· site ${signals.quality}/100</span>` : ''}` : 'none found'}<br>
          <span class="muted">Socials:</span> ${Object.keys(socials).length ? Object.entries(socials).map(([k, v]) => `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(k)}</a>`).join(' · ') : 'none found'}
        </div>
      </div>
      <div>
        <h3>Business</h3>
        <div style="font-size: 12px; line-height: 1.9; color: var(--ink-3);">
          Est. ${esc(r.established_date || '—')} ${ageWords(r.established_date) ? `<span class="muted">(${esc(ageWords(r.established_date))})</span>` : ''}<br>
          ${[r.address, r.city, r.zip].filter(Boolean).length ? `${esc([r.address, r.city, r.zip].filter(Boolean).join(', '))} <a href="${esc(mapsUrl(r))}" target="_blank" rel="noopener" style="font-size: 10.5px;">map ↗</a><br>` : ''}
          <span class="muted">Source:</span> ${esc({ sunbiz: 'Sunbiz', dbpr: 'DBPR', nppes: 'NPPES', sam: 'SAM.gov', osm: 'OSM', google: 'Google listing' }[r.source] || r.source)} · ${esc(r.source_id)}<br>
          <span class="muted">Status:</span> ${esc(r.entity_status || '—')}<br>
          ${officers?.officers?.length ? `<span class="muted">Officers:</span> ${officers.officers.slice(0, 3).map((o) => `${esc(o.title || '')} ${esc(o.name)}`).join(' · ')}` : ''}
        </div>
      </div>
    </section>

    <section>
      <h3>Score breakdown</h3>
      <div class="breakdown">${Object.entries(breakdown).map(([k, v]) => `<span class="chip">+${v} ${esc(k.replaceAll('_', ' '))}</span>`).join('') || '<span class="muted">not scored yet</span>'}</div>
    </section>

    <section>
      <h3>Sales workflow</h3>
      <div class="form-row" style="margin-top: 0;">
        <label>Status
          <select id="d-status">${Object.entries(STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${r.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        </label>
        <label>Rep
          <input id="d-assigned" value="${esc(r.assigned_to || '')}" placeholder="rep name" />
        </label>
      </div>
      <label style="display: block; margin-top: 10px; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted);">Notes
        <textarea id="d-notes" style="width: 100%; margin-top: 5px; min-height: 60px;">${esc(r.notes || '')}</textarea>
      </label>
      <div class="drawer-actions">
        <button class="btn primary" id="d-save">Save</button>
        <button class="btn" id="d-reenrich">↻ Re-enrich</button>
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
  // nurture flow panel — remember the contact so message buttons can
  // deep-link into the rep's own Messages/Mail apps
  drawerContact = { phone: r.phone, email: r.email };
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
let drawerContact = {}; // phone/email of the prospect currently in the drawer

async function renderNurture(id) {
  const state = await api(`/api/prospects/${id}/nurture?rep=${encodeURIComponent(repName())}`);
  paintNurture(id, state, null);
}

function fmtWhen(dbTime) {
  const d = parseDb(dbTime);
  return d ? d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null;
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
  const schedulable = ['handoff_requested', 'call_scheduled', 'sales_conversation'].includes(state.stage);
  const msgIsEmail = (m) => /^Subject:/i.test(m || '');

  el.innerHTML = `
    ${repName() ? '' : `<div class="n-warn">⚠ Type your name in the top bar first — it signs every message (right now they'd say "{{your name}}") and claims prospects you touch.</div>`}
    <div class="stage-bar">${suppressed
      ? `<span class="stage-pill suppressed">Suppressed — no further outreach on this channel</span><button class="linkish" id="n-unsuppress">un-suppress (classified wrong?)</button>`
      : stages.map((s, i) => `<span class="stage-pill${i < idx ? ' done' : ''}${i === idx ? ' current' : ''} clickable" data-stage="${esc(s.key)}" title="Click to move here — fixes a mis-click or a wrongly-read reply">${i < idx ? '✓ ' : ''}${esc(s.label)}</span>`).join('')}
    </div>
    ${lastReply ? `<div class="n-cls">Reply read as <span class="cls-chip ${esc(lastReply.classification)}">${esc(lastReply.classification.replaceAll('_', ' '))}</span></div>` : ''}
    ${sug.note ? `<div class="n-note">${esc(sug.note)}${sug.branch && !suppressed ? ` <span class="muted">· Opportunity track: ${esc(state.branches[sug.branch] || sug.branch)}</span>` : ''}</div>` : ''}
    ${sug.message ? `
      <textarea id="n-msg" class="outreach-out">${esc(sug.message)}</textarea>
      <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;align-items:center">
        <button class="btn primary" id="n-copy">Copy</button>
        ${suppressed ? '' : '<button class="btn" id="n-sent">✓ I sent this</button>'}
        ${!suppressed && drawerContact.phone ? `<a class="btn ghost" id="n-open-sms" href="#">Messages ↗</a>` : ''}
        ${!suppressed && drawerContact.email ? `<a class="btn ghost" id="n-open-mail" href="#">Mail ↗</a>` : ''}
        ${state.stage === 'loaded' && sug.alt ? '<button class="btn ghost" id="n-alt">Email version</button><button class="btn ghost" id="n-ai">AI-personalize</button>' : ''}
        <span id="n-msg-note" class="muted" style="font-size:11px"></span>
      </div>` : ''}
    ${!suppressed && drawerContact.phone ? `
      <div class="call-log-row"><span class="row-label">Called them?</span> <button class="btn ghost sm" data-call="no_answer">No answer</button>
        <button class="btn ghost sm" data-call="voicemail">Left voicemail</button>
        <button class="btn ghost sm" data-call="spoke">We spoke</button></div>` : ''}
    ${!suppressed ? `
      <div class="n-followup"><span class="row-label">Next follow-up</span> <b>${fmtWhen(state.next_touch_at) || 'not set'}</b>
        <button class="btn ghost sm" data-snooze="1">+1d</button>
        <button class="btn ghost sm" data-snooze="2">+2d</button>
        <button class="btn ghost sm" data-snooze="7">+1w</button>
        <button class="btn ghost sm" data-snooze="30">+1mo</button>
        ${state.next_touch_at ? '<button class="btn ghost sm" data-snooze="clear">clear</button>' : ''}
        <span class="muted" style="font-size:11px">— resurfaces in the Due queue</span>
      </div>` : ''}
    ${schedulable ? `
      <div class="n-followup"><span class="row-label">Sales call</span> <b>${fmtWhen(state.scheduled_call_at) || 'not scheduled'}</b>
        <button class="btn ghost sm" data-sched="today-pm">Today 3pm</button>
        <button class="btn ghost sm" data-sched="tmrw-am">Tmrw 10am</button>
        <button class="btn ghost sm" data-sched="tmrw-pm">Tmrw 3pm</button>
      </div>` : ''}
    ${!suppressed ? `
      <label style="display:block;margin-top:12px;font-size:12px;color:var(--ink-2)">They replied? Paste it here — it gets read, classified, and the next move teed up
        <textarea id="n-reply" placeholder='e.g. "Thanks! Who is this?"'></textarea>
      </label>
      <button class="btn ghost" id="n-log" style="margin-top:6px">↩ Log reply</button>` : ''}
    ${handoffReady ? `
      <button class="btn" id="n-handoff" style="margin-top:10px">Build handoff package</button>
      <div id="n-handoff-wrap" class="hidden">
        <textarea id="n-handoff-out" class="outreach-out" readonly style="min-height:220px"></textarea>
        <button class="btn primary" id="n-handoff-copy" style="margin-top:6px">Copy package</button>
      </div>` : ''}
    ${state.touches.length ? `<details style="margin-top:10px"><summary class="muted" style="cursor:pointer;font-size:12px">Conversation log (${state.touches.length})</summary>
      <div class="touch-log">${state.touches.map((t) => `<div class="touch ${esc(t.direction)}"><span class="who">${t.direction === 'out' ? 'US →' : '← THEM'}</span> ${esc(t.text)}${t.classification ? ` <span class="cls-chip sm ${esc(t.classification)}">${esc(t.classification.replaceAll('_', ' '))}</span>` : ''}<span class="touch-when">${t.channel === 'call' ? 'CALL · ' : ''}${ago(t.created_at)}${t.rep ? ` · ${esc(t.rep)}` : ''}</span></div>`).join('')}</div></details>` : ''}
  `;

  // one-tap send: opens the rep's own Messages/Mail app with the text loaded
  const smsA = $('#n-open-sms');
  if (smsA) smsA.onclick = null, smsA.href = smsHref(drawerContact.phone, $('#n-msg')?.value || '');
  const mailA = $('#n-open-mail');
  if (mailA) mailA.href = mailtoHref(drawerContact.email, $('#n-msg')?.value || '');
  $('#n-msg')?.addEventListener('input', () => {
    if (smsA) smsA.href = smsHref(drawerContact.phone, $('#n-msg').value);
    if (mailA) mailA.href = mailtoHref(drawerContact.email, $('#n-msg').value);
  });

  // clickable stage pills — undo for mis-clicks and misread replies
  el.querySelectorAll('.stage-pill.clickable').forEach((pill) => {
    pill.onclick = async () => {
      if (pill.dataset.stage === state.stage) return;
      if (!confirm(`Move this prospect to "${pill.title ? pill.textContent.replace('✓ ', '') : pill.dataset.stage}"?`)) return;
      const next = await api(`/api/prospects/${id}/nurture/stage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: pill.dataset.stage, rep_name: repName() }),
      });
      paintNurture(id, next, null);
    };
  });
  const unsup = $('#n-unsuppress');
  if (unsup) unsup.onclick = async () => {
    const next = await api(`/api/prospects/${id}/nurture/stage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'engaged', rep_name: repName() }),
    });
    paintNurture(id, next, null);
  };

  // call disposition logging — two seconds, no typing
  el.querySelectorAll('[data-call]').forEach((b) => {
    b.onclick = async () => {
      const kind = b.dataset.call;
      const text = { no_answer: 'Call — no answer', voicemail: 'Call — left voicemail', spoke: 'Call — connected' }[kind];
      const next = await api(`/api/prospects/${id}/nurture/sent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, channel: 'call', rep_name: repName(), stage_to: state.stage, snooze_days: kind === 'spoke' ? 1 : 2 }),
      });
      paintNurture(id, next, null);
      if (kind === 'spoke') { $('#n-reply')?.focus(); $('#n-reply')?.setAttribute('placeholder', 'What did they say? Log it here so the flow can route it.'); }
    };
  });

  // follow-up snooze + call scheduling
  el.querySelectorAll('[data-snooze]').forEach((b) => {
    b.onclick = async () => {
      const v = b.dataset.snooze;
      await api(`/api/prospects/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ next_touch_at: v === 'clear' ? null : sqlDate(new Date(Date.now() + Number(v) * 86400000)) }),
      });
      renderNurture(id);
      loadQueue();
    };
  });
  el.querySelectorAll('[data-sched]').forEach((b) => {
    b.onclick = async () => {
      const d = new Date();
      if (b.dataset.sched.startsWith('tmrw')) d.setDate(d.getDate() + 1);
      d.setHours(b.dataset.sched.endsWith('am') ? 10 : 15, 0, 0, 0);
      await api(`/api/prospects/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_call_at: sqlDate(d) }),
      });
      renderNurture(id);
      loadStats();
    };
  });

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
      loadQueue();
    } catch (e) { alert(e.message); sent.disabled = false; }
  };

  const alt = $('#n-alt');
  if (alt) alt.onclick = () => {
    const showingEmail = alt.dataset.on === '1';
    $('#n-msg').value = showingEmail ? sug.message : `Subject: ${sug.alt.email_subject}\n\n${sug.alt.email_body}`;
    alt.dataset.on = showingEmail ? '' : '1';
    alt.textContent = showingEmail ? 'Email version' : 'Text version';
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
      ai.textContent = 'AI-personalize';
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
      loadQueue();
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

  // Daily 50 toggle (icon rail)
  $('#btn-daily').onclick = () => {
    state.dailyMode = !state.dailyMode;
    $('#btn-daily').classList.toggle('active', state.dailyMode);
    $('#filters').style.display = state.dailyMode ? 'none' : '';
    state.queueMode = null;
    loadQueue();
    loadTable();
  };

  // run modal
  $('#btn-run').onclick = () => {
    $('#modal-overlay').classList.remove('hidden');
    // Admins pick who this run is FOR; the account's niches + zips prefill
    const activeAccounts = (state.accounts || []).filter((a) => a.active);
    if (state.me?.role === 'admin' && activeAccounts.length) {
      $('#run-account-wrap').classList.remove('hidden');
      const sel = $('#run-account');
      sel.innerHTML = `<option value="">Innovat3 — our book</option>` +
        activeAccounts.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
      sel.value = state.account !== 'house' ? String(state.account) : '';
      const prefill = () => {
        const acct = activeAccounts.find((a) => String(a.id) === sel.value);
        if (!acct) return;
        if (acct.zips.length) {
          $('#run-zips').value = acct.zips.join(', ');
          $('#run-zips').dispatchEvent(new Event('input')); // auto-checks the Google source
        }
        if (acct.niches.length) {
          document.querySelectorAll('.run-ind').forEach((c) => { c.checked = acct.niches.includes(c.value); });
        }
      };
      sel.onchange = prefill;
      prefill();
    }
    // Live-check the data provider keys so a dead key is visible BEFORE the run
    $('#provider-status').innerHTML = '<span class="muted">Checking data providers…</span>';
    api('/api/providers').then((ps) => {
      $('#provider-status').innerHTML = Object.values(ps).map((p) => {
        const cls = !p.configured ? 'off' : p.ok ? 'ok' : 'fail';
        const mark = !p.configured ? '○' : p.ok ? '✓' : '✕';
        const err = p.configured && !p.ok ? ` — ${esc(p.error || 'failing')}` : !p.configured ? ' — no key' : '';
        const note = p.ok && p.note ? ` <span class="muted">(${esc(p.note)})</span>` : '';
        // key fingerprint + paste problems: exactly what to eyeball on the vendor dashboard
        const keyLine = p.configured && !p.ok && p.keyInfo
          ? `<span class="prov-key">stored key: ${esc(p.keyInfo.fingerprint)}${p.keyInfo.issues ? ` · ⚠ ${esc(p.keyInfo.issues.join('; '))}` : ''}</span>`
          : '';
        return `<span class="prov ${cls}" title="${esc(p.error || '')}">${mark} ${esc(p.label)}${err}${note}${keyLine}</span>`;
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
          account_id: $('#run-account')?.value ? Number($('#run-account').value) : undefined,
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

/* ---------- account switching (admins: whose book am I working?) ---------- */
function applyAccountUI() {
  const acct = currentAccount();
  $('#btn-export').href = withAcct('/api/export.csv');
  document.title = acct ? `${acct.name} — Innovat3 Prospect Engine` : 'Innovat3 Prospect Engine';
  const sub = document.querySelector('.subtitle');
  if (sub) sub.textContent = acct
    ? `Client book: ${acct.name} — prospects generated for their CRM`
    : 'New Florida businesses & licensees · Google-first + state registries';
}

async function initIdentity() {
  try { state.me = await api('/api/me'); } catch { state.me = { name: '', role: 'user' }; }
  // the signed-in user IS the rep — prefill once, still editable
  if (!repName() && state.me.name && !['Dev', 'Master admin'].includes(state.me.name)) {
    localStorage.setItem('rep_name', state.me.name);
  }
  if (state.me.role !== 'admin') return;
  $('#btn-settings').classList.remove('hidden');
  state.accounts = await api('/api/accounts').catch(() => []);
  const activeAccounts = state.accounts.filter((a) => a.active);
  if (!activeAccounts.length) return;

  const sw = $('#account-switch');
  sw.classList.remove('hidden');
  sw.innerHTML = `<option value="house">Innovat3 — our book</option>` +
    activeAccounts.map((a) => `<option value="${a.id}">${esc(a.name)} (${a.prospects})</option>`).join('');
  // deep link (?account=N from Settings) wins over the remembered choice
  const fromUrl = new URLSearchParams(location.search).get('account');
  state.account = fromUrl || localStorage.getItem('account') || 'house';
  if (![...sw.options].some((o) => o.value === String(state.account))) state.account = 'house';
  sw.value = String(state.account);
  sw.onchange = () => {
    state.account = sw.value;
    localStorage.setItem('account', sw.value);
    state.page = 1;
    state.queueMode = null;
    applyAccountUI();
    loadStats();
    loadQueue();
    loadTable();
  };
}

/* ---------- boot ---------- */
(async function init() {
  await initIdentity();

  // Rep identity: the avatar circle — signs messages, claims prospects,
  // scopes the queues. Click it to set your name.
  const avatar = $('#rep-avatar');
  const paintAvatar = () => { avatar.textContent = initialsOf(repName()); avatar.title = repName() ? `${repName()} — signs your outreach` : 'Click to set your name'; };
  paintAvatar();
  avatar.onclick = () => {
    const n = prompt('Your name (signs your outreach, claims prospects you touch):', repName());
    if (n === null) return;
    localStorage.setItem('rep_name', n.trim());
    paintAvatar();
    loadQueue();
    if (state.dailyMode) loadTable();
  };

  await loadMeta();
  bindEvents();
  applyAccountUI();
  loadStats();
  loadQueue();
  loadTable();
  // resume banner if a run is already in flight
  const runs = await api('/api/runs');
  const active = runs.find((r) => r.status === 'running');
  if (active) { showRunBanner(`Run #${active.id} in progress…`); pollRun(active.id); }
})();
