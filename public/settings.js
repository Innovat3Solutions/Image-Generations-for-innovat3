/* Settings — team access & client accounts (admin only) */
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
}
const post = (url, body) => api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const patch = (url, body) => api(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

function showErr(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

/* ---------- team ---------- */
async function loadUsers() {
  const users = await api('/api/users');
  $('#users-body').innerHTML = users.length ? users.map((u) => `
    <tr class="${u.active ? '' : 'inactive-row'}">
      <td>${esc(u.display_name)}</td>
      <td class="muted">${esc(u.username)}</td>
      <td><select class="u-role-sel" data-id="${u.id}">
        <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
      </select></td>
      <td>${u.active ? '<span class="chip verified">active</span>' : '<span class="chip invalid">disabled</span>'}</td>
      <td><button class="btn ghost sm u-cal" data-url="${esc(u.calendar_url || '')}">Copy feed URL</button></td>
      <td>
        <button class="btn ghost sm u-toggle" data-id="${u.id}" data-active="${u.active}">${u.active ? 'Disable' : 'Re-enable'}</button>
        <button class="btn ghost sm u-pw" data-id="${u.id}">Reset password</button>
      </td>
    </tr>`).join('')
    : '<tr><td colspan="6" class="muted">No teammates yet — add the first one above. (Until then, only the master admin login works.)</td></tr>';

  document.querySelectorAll('.u-role-sel').forEach((sel) => {
    sel.onchange = () => patch(`/api/users/${sel.dataset.id}`, { role: sel.value }).catch((e) => alert(e.message));
  });
  document.querySelectorAll('.u-toggle').forEach((b) => {
    b.onclick = () => patch(`/api/users/${b.dataset.id}`, { active: b.dataset.active !== '1' }).then(loadUsers).catch((e) => alert(e.message));
  });
  document.querySelectorAll('.u-cal').forEach((b) => {
    b.onclick = async () => {
      if (!b.dataset.url) return;
      try { await navigator.clipboard.writeText(b.dataset.url); } catch { /* blocked */ }
      alert(`Calendar feed URL copied:\n\n${b.dataset.url}\n\nHand it to that rep — they add it once in Google Calendar (Other calendars → + → From URL) and their follow-ups + sales calls stay in sync.`);
    };
  });
  document.querySelectorAll('.u-pw').forEach((b) => {
    b.onclick = () => {
      const pw = prompt('New password (min 8 characters):');
      if (!pw) return;
      patch(`/api/users/${b.dataset.id}`, { password: pw }).then(() => alert('Password updated.')).catch((e) => alert(e.message));
    };
  });
}

$('#u-add').onclick = async () => {
  try {
    await post('/api/users', {
      display_name: $('#u-name').value,
      username: $('#u-username').value,
      password: $('#u-password').value,
      role: $('#u-role').value,
    });
    $('#u-name').value = $('#u-username').value = $('#u-password').value = '';
    loadUsers();
  } catch (e) { showErr($('#u-error'), e.message); }
};

/* ---------- client accounts ---------- */
let industries = [];

async function loadNicheGrid() {
  const meta = await api('/api/meta');
  industries = meta.industries;
  $('#a-niches').innerHTML = industries
    .map((i) => `<label class="chk"><input type="checkbox" class="a-niche" value="${esc(i.key)}" /> ${esc(i.label)}</label>`).join('');
}

const nicheLabel = (key) => (industries.find((i) => i.key === key)?.label || key);

async function loadAccounts() {
  const accounts = await api('/api/accounts');
  $('#accounts-body').innerHTML = accounts.length ? accounts.map((a) => `
    <tr class="${a.active ? '' : 'inactive-row'}">
      <td><strong>${esc(a.name)}</strong>${a.notes ? `<div class="muted" style="font-size:11px">${esc(a.notes)}</div>` : ''}</td>
      <td style="font-size:12px">${a.niches.map((n) => `<span class="chip">${esc(nicheLabel(n))}</span>`).join(' ') || '<span class="muted">—</span>'}</td>
      <td class="muted">${a.zips.join(', ') || '—'}</td>
      <td>${a.prospects}</td>
      <td>${a.active ? '<span class="chip verified">active</span>' : '<span class="chip invalid">archived</span>'}</td>
      <td>
        <a class="btn ghost sm" href="/?account=${a.id}">Open book →</a>
        <a class="btn ghost sm" href="/api/export.csv?account=${a.id}" download>CSV</a>
        <button class="btn ghost sm a-toggle" data-id="${a.id}" data-active="${a.active}">${a.active ? 'Archive' : 'Restore'}</button>
      </td>
    </tr>`).join('')
    : '<tr><td colspan="6" class="muted">No client accounts yet — create the first one above.</td></tr>';

  document.querySelectorAll('.a-toggle').forEach((b) => {
    b.onclick = () => patch(`/api/accounts/${b.dataset.id}`, { active: b.dataset.active !== '1' }).then(loadAccounts).catch((e) => alert(e.message));
  });
}

$('#a-add').onclick = async () => {
  try {
    const niches = [...document.querySelectorAll('.a-niche:checked')].map((c) => c.value);
    await post('/api/accounts', {
      name: $('#a-name').value,
      notes: $('#a-notes').value,
      zips: $('#a-zips').value,
      niches,
    });
    $('#a-name').value = $('#a-zips').value = $('#a-notes').value = '';
    document.querySelectorAll('.a-niche:checked').forEach((c) => { c.checked = false; });
    loadAccounts();
  } catch (e) { showErr($('#a-error'), e.message); }
};

/* ---------- assignment mode + automation ---------- */
function paintSenders(s) {
  $('#s-senders').innerHTML = [
    s.email_sender
      ? '✓ Automatic email delivery is ON (Resend)'
      : 'Email sends queue for manual one-tap delivery — set RESEND_API_KEY + MAIL_FROM env vars to automate.',
    s.sms_sender
      ? '✓ Automatic text delivery is ON (Twilio)'
      : 'Text sends queue for manual one-tap delivery — set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM to automate.',
  ].map(esc).join('<br>');
}

async function loadAssignment() {
  try {
    const s = await api('/api/settings');
    const radio = document.querySelector(`input[name="amode"][value="${s.assignment_mode}"]`);
    if (radio) radio.checked = true;
    $('#s-fb').value = s.fb_group_url || '';
    $('#s-docs').value = s.docs_url || '';
    paintSenders(s);
  } catch { /* non-admin */ }
  $('#s-save').onclick = async () => {
    try {
      const out = await patch('/api/settings', { fb_group_url: $('#s-fb').value.trim(), docs_url: $('#s-docs').value.trim() });
      $('#s-note').textContent = 'Saved. New close-sequences will use these links.';
      paintSenders(out);
    } catch (e) { $('#s-note').textContent = e.message; }
  };
  document.querySelectorAll('input[name="amode"]').forEach((r) => {
    r.onchange = async () => {
      try {
        await patch('/api/settings', { assignment_mode: r.value });
        $('#assign-note').textContent = r.value === 'auto'
          ? 'Auto-assign is on — new prospects are dealt out after every run.'
          : 'Claim mode — reps take their own from the board.';
      } catch (e) { alert(e.message); }
    };
  });
  $('#assign-distribute').onclick = async () => {
    $('#assign-distribute').disabled = true;
    try {
      const out = await api('/api/assign/distribute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      $('#assign-note').textContent = out.assigned
        ? `Dealt ${out.assigned} unassigned prospects across ${out.reps.length} teammates.`
        : (out.reps && !out.reps.length ? 'No active teammates to assign to — add them above first.' : 'Nothing unassigned to distribute.');
    } catch (e) { alert(e.message); } finally { $('#assign-distribute').disabled = false; }
  };
}

/* ---------- boot ---------- */
(async function init() {
  try {
    const me = await api('/api/me');
    if (me.role !== 'admin') {
      document.querySelector('main').innerHTML = '<section class="settings-card"><h2>Admins only</h2><p class="muted">Ask an admin for access.</p></section>';
      return;
    }
  } catch { /* auth handled by the browser prompt */ }
  await loadNicheGrid();
  loadUsers();
  loadAccounts();
  loadAssignment();
})();
