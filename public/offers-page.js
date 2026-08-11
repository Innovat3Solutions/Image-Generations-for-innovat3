/* Offers & Pricing knowledge base */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s) => document.querySelector(s);
const money = (n) => '$' + n.toLocaleString();

(async function init() {
  const d = await (await fetch('/api/offers')).json();

  $('#ladder').innerHTML = d.packages.filter((p) => !p.key.startsWith('marketing_') || p.key === 'marketing_team').map((p, i, arr) => `
    <div class="ladder-step${p.key === 'launch' ? ' entry' : ''}">
      <div class="ls-name">${esc(p.name)}</div>
      <div class="ls-price">${money(p.monthly)}<span class="muted">/mo</span>${p.usage ? '<span class="muted">+use</span>' : ''}</div>
      <div class="ls-stage">${esc(p.stage)}</div>
    </div>${i < arr.length - 1 ? '<div class="ladder-arrow">→</div>' : ''}`).join('');

  $('#packages').innerHTML = d.packages.map((p) => `
    <details class="pkg-card${p.key === 'launch' ? ' entry' : ''}">
      <summary>
        <span class="pkg-head">
          <strong>${esc(p.name)}</strong>
          <span class="muted">· ${esc(p.promise)}</span>
        </span>
        <span class="pkg-price">${money(p.monthly)}/mo${p.usage ? ' + usage' : ''} <span class="muted">· ${money(p.setup)} setup</span></span>
      </summary>
      <div class="pkg-body">
        <p class="talk-track">${esc(p.talk_track)}</p>
        <div class="pkg-cols">
          <div><h4>Included</h4><ul>${p.included.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
          <div><h4>Not included → upgrade triggers</h4><ul>${p.not_included.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
        </div>
      </div>
    </details>`).join('');

  $('#qualification').innerHTML = d.qualification.map((q) => `
    <div class="faq-row">
      <div style="display:flex;justify-content:space-between;gap:10px">
        <span><strong>${esc(q.area)}:</strong> ${esc(q.question)}</span>
        <span class="chip" style="white-space:nowrap">→ ${esc(q.points_to.replace(/_/g, ' ').toUpperCase())}</span>
      </div>
    </div>`).join('');

  $('#upgrades').innerHTML = d.upgradeTriggers.map((u) => `
    <tr><td style="white-space:nowrap"><strong>${esc(u.from)}</strong> → ${esc(u.to)}</td><td>${esc(u.trigger)}</td></tr>`).join('');

  $('#addons').innerHTML = d.addOns.map((a) => `
    <tr><td><strong>${esc(a.name)}</strong></td><td style="white-space:nowrap">${esc(a.price)}</td><td class="muted">${esc(a.note)}</td></tr>`).join('');

  $('#projects').innerHTML = d.projects.map((p) => `
    <tr><td>${esc(p.name)}</td><td style="white-space:nowrap">${esc(p.price)}</td></tr>`).join('');

  $('#rules').innerHTML = d.rules.map((r) => `<li>${esc(r)}</li>`).join('');
})();
