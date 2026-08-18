/* Invite accept flow — token in the URL is the auth. */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const token = location.pathname.split('/').pop();

const DEAD = {
  invalid: 'This invite link is not valid. Double-check the link, or ask your admin to send a fresh one.',
  revoked: 'This invite was revoked. Ask your admin for a new one.',
  used: 'This invite was already used. If that was you, just head to the dashboard and sign in.',
  expired: 'This invite has expired — they last 7 days. Ask your admin for a fresh link.',
};

function showForm(inv) {
  $('#invite-body').innerHTML = `
    <h2 style="font-size: 19px; font-weight: 800;">You're invited to the Prospect Engine</h2>
    <p class="muted" style="margin: 6px 0 18px;">Create your login — pick your own username and password.
      You're joining with <span class="chip verified">${inv.role === 'admin' ? 'admin' : 'sales rep'} access</span></p>
    <label class="invite-label">Your name <span class="muted">(signs your outreach)</span>
      <input id="i-name" value="${esc(inv.display_name)}" placeholder="Maria Lopez" autocomplete="name" /></label>
    <label class="invite-label">Username
      <input id="i-user" placeholder="maria" autocomplete="username" /></label>
    <label class="invite-label">Password <span class="muted">(min 8 characters)</span>
      <input id="i-pass" type="password" autocomplete="new-password" /></label>
    <div id="i-error" class="form-error hidden"></div>
    <button class="btn primary" id="i-go" style="margin-top: 14px; width: 100%; justify-content: center;">Create my login</button>
    <p class="muted" style="font-size: 11px; margin-top: 12px;">Invite expires ${esc(inv.expires_at)} UTC · single use</p>`;
  $('#i-go').onclick = accept;
  $('#i-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') accept(); });
}

async function accept() {
  const btn = $('#i-go');
  btn.disabled = true;
  btn.textContent = 'Creating…';
  try {
    const res = await fetch(`/api/invite/${token}/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: $('#i-name').value, username: $('#i-user').value, password: $('#i-pass').value }),
    });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error || res.statusText);
    showDone(out);
  } catch (e) {
    const err = $('#i-error');
    err.textContent = e.message;
    err.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Create my login';
  }
}

function showDone(u) {
  $('#invite-body').innerHTML = `
    <h2 style="font-size: 19px; font-weight: 800;">Welcome aboard, ${esc(u.display_name.split(' ')[0])}.</h2>
    <p class="muted" style="margin: 6px 0 16px;">Your login is ready — username <strong style="color: var(--ink);">${esc(u.username)}</strong>.
      When the dashboard asks, sign in with it and the password you just set.</p>
    <div class="invite-cal">
      <div style="font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent-ink); opacity: 0.65;">Your calendar feed — set it up once</div>
      <div class="invite-cal-url" id="cal-url">${esc(u.calendar_url)}</div>
      <button class="btn" id="cal-copy" style="margin-top: 8px;">Copy feed URL</button>
      <div style="font-size: 11.5px; margin-top: 8px; color: var(--accent-ink);">Google Calendar: <b>Other calendars → + → From URL</b> → paste.
        Your follow-ups and sales calls will appear automatically and stay in sync. Treat this link like a password.</div>
    </div>
    <a class="btn primary" href="/" style="margin-top: 16px; width: 100%; justify-content: center;">Open the dashboard →</a>`;
  $('#cal-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(u.calendar_url); } catch { /* blocked */ }
    $('#cal-copy').textContent = '✓ Copied';
  };
}

(async function init() {
  try {
    const res = await fetch(`/api/invite/${token}`);
    const out = await res.json();
    if (!res.ok) {
      $('#invite-body').innerHTML = `<h2 style="font-size: 17px; font-weight: 800;">This link won't work</h2>
        <p class="muted" style="margin-top: 8px;">${esc(DEAD[out.state] || DEAD.invalid)}</p>
        ${out.state === 'used' ? '<a class="btn primary" href="/" style="margin-top: 14px;">Go to the dashboard →</a>' : ''}`;
      return;
    }
    showForm(out);
  } catch {
    $('#invite-body').innerHTML = '<p class="muted">Could not reach the server — try again in a minute.</p>';
  }
})();
