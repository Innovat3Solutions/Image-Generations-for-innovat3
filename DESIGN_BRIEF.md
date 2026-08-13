# INNOVAT3 Prospect Engine — Functional Synopsis for Design

A B2B prospecting and sales-conversation tool used daily by a small Florida
sales team (Innovat3 Solutions — sells websites, reviews, CRM, AI
receptionists, and marketing to local businesses, $99–$2,495/mo). Web app,
no build step: vanilla JS + one stylesheet, desktop-first but reps use
phones in the field. Everything below exists and works — the ask is a
front-end design, not new features.

## Who uses it

- **User (sales rep):** works the prospect dashboard — finds businesses,
  sends nurture messages, logs replies and calls, hands warm leads to a
  closer.
- **Admin:** everything a rep has, plus a Settings area (team management,
  client accounts) and the ability to run prospecting *for clients* and
  switch the whole dashboard between "books."

Each person signs in with their own credentials (HTTP Basic — browser
prompt, no login page to design).

## Pages

### 1. Dashboard (main page, `/`)

The workhorse. Top to bottom:

- **Top bar:** brand, account switcher (admins — "🏠 Innovat3 — our book"
  vs client accounts), "Your name" rep field, links: Settings (admin),
  Offers, Practice, Today's 50 toggle, Re-enrich, Export CSV, Run pipeline
  (primary CTA).
- **Stat tiles (10):** total prospects, added today, reachable by email,
  have phone, no website yet, touches sent today, in handoff, calls today,
  parked (no contact info), avg score.
- **Work queue chips** — the heart of a rep's day, in priority order:
  🟢 They replied — your move (N) · ⏰ Follow-ups due (N) · 🤝 Handoffs (N)
  · 🆕 Untouched leads (N). Clicking filters the table to that work.
- **Filter row:** search, industry select, source select, zip codes,
  status, min score, has-email / has-phone / no-website checkboxes.
- **Prospect table.** Columns: Score (0–100 badge, tiered color:
  high/strong/explore/below) · Business (brand name, ★4.8 (37) review chip
  linking to Google reviews, legal entity subline, one-line "why you should
  call" reason) · Industry · Established ("3 wk old" + 🆕 badge) · Contact
  (name + title) · Email (+ verified/MX chip) · Phone (tap-to-call) · Web
  (site/social icons) · City · Thread (nurture stage, "3d ago · your move /
  waiting on them", ⏰ due badge) · Status select.
- **Today's 50 mode:** same table grouped under tier subheaders
  (🔥 High Opportunity / 🟢 Strong Fit / 🟡 Worth Exploring).
- **Run pipeline modal:** provider status lights, limit/days, "Prospecting
  for" client selector (admin), zips, source checkboxes, industry
  checkboxes. A progress banner shows during runs.

### 2. Prospect drawer (slide-over on row click) — the most-used surface

Order matters; this is a rep's 30-second call prep:

1. Brand name + legal entity + score badge
2. **Why you should call** callout
3. **Recommended offer** box: entry package + price, reasoning, italic
   talk track, upsell ladder (Launch $99 → Local $199 → Connect $399 →
   AI $699+)
4. **Nurture flow** panel (see flow below)
5. Detected opportunities (label + high/medium chips + reasoning)
6. Contact block (decision maker, email, phone, website + site-quality
   line, socials — all with copy buttons / links)
7. Business block (established + age, address → Google Maps, source,
   Google reviews link)
8. Officers (when present), score breakdown chips
9. Sales workflow: status select, assigned-to, notes, Save / Re-enrich

### 3. Nurture flow panel (inside drawer) — the signature interaction

A guided text/email conversation engine: automation warms, humans close.

- **Stage tracker pills:** Prospect Loaded → Outreach Sent → Engaged →
  Permission to Share → Opportunity Identified → Qualified/Warm → Handoff
  Requested → Call Scheduled → Sales Conversation (or ⛔ Suppressed with an
  un-suppress link). Pills are clickable (undo/correct).
- **Coaching note** (blue callout): what this step is, e.g. "Cold opener —
  kudos only. NO pitch, NO $99. Goal: any genuine response." Shows the
  chosen opportunity track (Missed Calls / Lead Follow-Up / After-Hours /
  Online Presence / Reactivation).
- **Suggested message** textarea (editable) with: 📋 Copy · ✓ I sent this ·
  📱 Open in Messages (sms: with body preloaded) · ✉️ Open in Mail ·
  ✉️ Email version · ✨ AI-personalize.
- **📞 Called them?** row: No answer / Left voicemail / We spoke.
- **⏰ Next follow-up** row: current due time + snooze buttons
  (+1d/+2d/+1w/+1mo/clear).
- **📅 Sales call** row (late stages): Today 3pm / Tmrw 10am / Tmrw 3pm.
- **Reply logger:** paste what the prospect wrote → it's classified
  (INTERESTED / CURIOUS / BUSY / WRONG PERSON / NOT INTERESTED / OPT-OUT
  chip) and the stage + next message update. High intent jumps straight to
  handoff; opt-out suppresses.
- **📄 Build sales handoff package:** generates a copyable brief for the
  closer (contact, opportunity, the gap in their own words, pricing
  signals, appointment, full conversation).
- **Conversation log:** collapsible; US → / ← THEM bubbles with
  classification chips, channel icon, time-ago, rep name.
- Warning banner when no rep name is set.

### 4. Settings (`/settings.html`, admin only)

- **Team:** add teammate (name, username, password, role), table of users
  with role select, active/disabled chip, disable + reset-password actions.
- **Client accounts:** create account (name, territory zips, notes, niche
  checkboxes across ~26 industries); table of accounts with niche chips,
  zips, prospect count, Open book / CSV / Archive actions.

### 5. Offers (`/offers.html`)

Pricing knowledge base for reps: qualification checklist, upsell ladder
visual, package cards (accordion: price, setup, talk track, includes /
doesn't include), add-ons, project pricing, rules of engagement.

### 6. Practice (`/practice.html`)

AI sales-training: pick a scenario (persona cards, difficulty), run a
timed roleplay chat against an AI prospect, get a 6-category 1–10 scorecard
with feedback + rebuttals, PDF report download, per-rep progress trend,
objection library that grows over time. Also a "grade a real call"
transcript mode.

## Key flows to design around

1. **Rep's morning:** open dashboard → queue chips → work green (replies),
   then due follow-ups, then Today's 50 for fresh outreach. Each prospect =
   open drawer → copy/send message → "I sent this" → next.
2. **Reply handling:** paste reply → see classification → send suggested
   response → stage advances toward handoff.
3. **Admin for a client:** Settings → create client account with niches +
   zips → switch account in top bar → Run pipeline (prefilled) → work/QA the
   book → Export CSV for the client's CRM.

## Design notes & constraints

- Deliverable that fits: single `style.css` (design tokens in `:root`,
  light + dark via `prefers-color-scheme`), semantic-ish HTML strings
  rendered from JS — component classes, no framework, no build step.
- Current look: neutral paper background, blue accent, tier colors
  (red/high-value ↔ green), pill/chip-heavy. Free to reinvent.
- Personality: confident, energetic sales floor — but information-dense
  and fast to scan beats pretty. Reps live in the table + drawer.
- Density matters: 11-column table, 10 stat tiles, long drawer. Design the
  hierarchy, don't hide the data.
- Mobile: reps use the drawer + queues from phones in the field; table can
  degrade gracefully.
- Brand: INNOVAT3 Solutions. 🎯 is the current mark; logo/wordmark open.
