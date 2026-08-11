# Innovat3 Prospect Engine

A prospect-generation platform for the Innovat3 sales team. It finds Florida
businesses **as their customers see them** — the Google Business listing —
figures out **who to call and how to reach them**, cross-references the state
registries for the **legal entity, filing date, and decision-maker** behind
each storefront, checks their **digital presence**, scores every prospect,
and serves it all in a dashboard your reps work from daily.

## The Google-first flow

```
Google Business listings (the storefront: brand, phone, website, reviews — one listing per location)
        │
        ▼
registry cross-reference (Sunbiz / DBPR / NPPES / SAM: legal entity, filing date, officers, decision-maker)
        │
        ▼
contact enrichment (their website → Apollo → Hunter: verified email, direct phone, socials)
        │
        ▼
score → nurture → human handoff
```

The **listing is the seed** — it's the real business identity: the brand
customers search for, not the legal shell. That also solves franchises and
holding companies ("TOP NOTCH CARE, LLC" operating five locations): each
listing is its own prospect with its own phone, reviews, and conversation,
while they share the cross-referenced legal entity. Registries then act as
the **lookup layer**: a Sunbiz/DBPR record matching a listing (by phone,
website domain, or name + area) is absorbed into it — never a duplicate row
— contributing the filing date (recency scoring), officers, and the person
to ask for. Healthcare listings are additionally checked against the free
**NPPES API live**.

Registry sources still work standalone for "brand-new businesses this week"
prospecting (many are too new to have listings yet) — and when a later
Google run finds the listing for one of them, the two are linked
automatically.

## Data sources

| Source | What it gives us | How | Key needed |
|---|---|---|---|
| **Sunbiz** (FL Division of Corporations) | Every new LLC / corporation filed — all industries — with **filing date, officers, registered agent** | Daily files over the state's public SFTP | no |
| **DBPR** (FL professional licensing) | Newly **licensed** businesses across 9 boards: construction, electrical, cosmetology, barbers, **restaurants (new license approvals, with phone numbers)**, real estate agents + companies, veterinarians, home inspectors | Free extract CSVs, refreshed daily | no |
| **NPPES** (national provider registry) | New **healthcare providers & clinics** with practice address, **phone**, and — for organizations — the **authorized official's name and title** | CMS weekly new-enumeration files | no |
| **SAM.gov** | Newly registered **federal contractors** with a named Government Business **POC (often with email)** | Entity Management API | free key (`SAM_API_KEY`) |
| **OpenStreetMap** | **Territory prospecting** — existing businesses by category within chosen zip codes, with self-published phones/websites | Overpass API | no |
| **Google Business listings** | The **storefront view**: the brand name customers actually see (their DBA), plus listing **phone, website, and star-rating/review counts** by zip + vertical | Serper places API | `SERPER_API_KEY` |

State registries know the *legal entity* ("SMITH HOLDINGS OF FLORIDA, LLC");
Google knows the *brand*. When a listing matches a prospect we already track
(same phone or website domain), it is **cross-linked instead of duplicated**:
the listing name becomes the prospect's DBA, missing phone/website get filled
in, and the review data is attached. Every generated message then uses the
brand name — and prospects with real Google reviews unlock the review-based
nurture opener.

"New" means established/licensed within the window you choose (default **180 days**).
Adding another DBPR board is one config entry — grab the extract URL from that
board's "Public Records" page (they share one layout).

### Zip-code targeting

Everywhere, optionally: pass zips (full `33130` or prefixes like `334` for a
whole area) in the **Run pipeline** modal to ingest only those areas, filter
the prospect table by zip in the dashboard, or use
`npm run pipeline -- --zips 33101,334`. OpenStreetMap territory pulls require
zips; everything else treats them as an optional refinement.

## What enrichment does per prospect

1. **Decision maker** — Sunbiz officers ranked by title (CEO → President → Managing
   Member → …), falling back to a human registered agent; DBPR license holders
   parsed into first/last name. Company names are never mistaken for people.
2. **Website** — Google search via [serper.dev](https://serper.dev) when a key is
   set (best), otherwise smart domain guessing + DNS + homepage fetch, with the
   business name/city/phone verified on the page before a site is accepted.
   Confidence (`high`/`medium`) is stored and shown.
3. **Social media** — Facebook / Instagram / LinkedIn / X / TikTok / YouTube / Yelp
   links extracted from their site (and from search results with a serper key).
4. **Email** — best-first: scraped from their own site → Hunter.io domain search →
   pattern guessing (`info@`, `{first}@`, …). Every email is verified:
   `verified` (provider-confirmed) → `valid_mx` (domain accepts mail) → `guessed`.
5. **Phone** — from the state record when present, else `tel:` links / patterns on
   their website.

## Target verticals

Prospects are classified into INNOVAT3's priority verticals — the industries
where a new client is valuable and operational inefficiency costs money:
roofing, HVAC, plumbing, electrical (split automatically from DBPR
construction license codes: CCC→roofing, CAC→HVAC, CFC→plumbing…), general
contractors, law firms, med spas, dental, real estate, property management,
accounting, insurance, auto repair, fitness, home services, healthcare,
restaurants. Sunbiz filings (no industry field) are classified by business
name; NPPES records by taxonomy code. The registry lives in
`src/verticals.js` with per-vertical commercial-value and automation weights.

## The INNOVAT3 Opportunity Score (0–100)

Five buckets, tuned so a rep gets a *reason to call*, not a row:

| Bucket | Pts | Reads |
|---|---|---|
| Business Quality | 20 | active, real company, officer structure, established date |
| Digital Opportunity | 25 | no website = max; else what their site is missing (mobile, booking, chat, freshness) |
| Automation Opportunity | 25 | vertical's lead/schedule-intensity + gaps on their own site (form with no follow-up, phone-centric with no intake) |
| Commercial Value | 20 | per-vertical typical client value |
| Contactability | 10 | email quality, phone, named decision maker |

Tiers: **80+ 🔥 High Opportunity · 65–79 🟢 Strong Fit · 50–64 🟡 Worth
Exploring** (below 50 stays out of the daily pool).

### Website signal analysis

When a website is found, the homepage is analyzed for what a modern
lead-generating site should have: online booking (Calendly, Housecall Pro,
ServiceTitan…), live/AI chat (Podium, Intercom, Tawk…), lead forms, mobile
viewport, CRM pixels (HubSpot, GoHighLevel…), analytics, platform, and stale
copyright years — producing a 0–100 site quality score.

### Detected opportunities + "why you should call"

Every prospect card carries pitch-ready findings (Website redesign — HIGH,
Lead-response automation — HIGH, AI receptionist — HIGH, CRM — MEDIUM …)
and a one-line call reason, e.g.:

> *ABC Roofing just launched (Roofing); their site exists but conversion
> infrastructure is weak — lead with missed-call capture and AI intake.
> Ask for John Smith (owner).*

## The contactability guarantee

**Every prospect a rep sees has an email or a phone number.** Runs promise
"N contactable prospects", not "N rows": the pipeline ingests a batch,
enriches it, and anything that ends up with no contact channel is **parked**
(`no_contact` status — hidden from the table, the Daily 50, stats, and
exports of the working book) — then it pulls more until the target is met,
sources run dry, or the 4× safety cap hits. Parked prospects are kept for
dedupe and retried first by every **↻ Re-enrich missing** sweep; the moment
one yields an email or phone it is revived onto the board automatically.
(Disable per-run with the checkbox, or globally via
`pipeline.requireContact: false`.)

The **Run pipeline** modal live-checks every configured API key
(`/api/providers`) before you launch — a dead Apollo key shows as
"✕ Apollo — Forbidden (403)…" instead of silently producing zero emails.

## The Daily 50

**🔥 Today's 50** in the dashboard (and `GET /api/daily`) hands each rep the
freshest unworked prospects above the pool threshold, grouped
🔥 High / 🟢 Strong / 🟡 Explore — "50 businesses worth calling, and why."

## Offers & Pricing knowledge base (📖)

`/offers.html` — the INNOVAT3 Company Pricing Standard as a working tool:
the Sales Ladder (Launch $99 → Local $199 → Connect $399 → AI $699 →
Growth $999 → Marketing tiers $1,675–$2,495), every package with included /
not-included / talk track, the qualification questions ("diagnose before you
quote"), upgrade triggers, the add-on menu with the bundling rule, one-time
project pricing, and the company rules. `src/offers.js` is the single source
of truth — it also powers the recommendations and the Practice tab's
grading materials, so updating pricing updates everywhere at once.

### Per-prospect recommended offer

Every prospect card shows which rung of the ladder to enter on — the
**$99 Launch plan for the vast majority** (per the standard: lowest package
that solves the immediate problem), stepping up only when signals prove
they already own that layer — plus the upsell ladder with each step tied to
that prospect's detected gaps ("their form has no follow-up behind it →
Connect", "phone-centric, no after-hours → AI").

### Nurture flow (Prospect Nurture & Human Handoff Playbook)

Every prospect drawer carries a guided conversation engine built on the
INNOVAT3 Conversation Standard: **earn the response → build rapport → ask
permission → identify ONE real opportunity → let the prospect acknowledge
the gap → bring in a human.** Automation warms the relationship; humans
monetize it.

- **Stage tracker** — Loaded → Outreach Sent → Engaged → Permission →
  Opportunity → Qualified → Handoff Requested → Call Scheduled → Sales
  Conversation (plus Suppressed for opt-outs).
- **Suggested next message** at every stage, verbatim from the playbook with
  merge fields filled from *real* prospect data only — the review-based
  opener is used only when we actually hold Google review data; the cold
  opener is kudos-only: no pitch, no $99, no meeting ask.
- **Reply classifier** — paste what they wrote back; it's read and labeled
  (interested / curious / busy / wrong person / not interested / opt-out)
  and the stage advances. High-intent replies ("how much?") **bypass**
  the remaining steps straight to handoff; opt-outs suppress the prospect
  immediately and block further sends; "not interested" gets a polite
  close, never an argument.
- **One opportunity branch** per prospect (missed calls, lead follow-up,
  after-hours/AI receptionist, online presence, reactivation), chosen from
  their actual signals and mapped to the pricing ladder.
- **Sales handoff package** — one click builds the §04 salesperson brief:
  contact, opportunity, the gap in the prospect's own words, pricing
  questions asked, likely starting offer, and the full conversation.

### First-touchpoint generator

**AI-personalize** on the nurture opener (plus email/text variants) — a
copy-paste-ready first touch that introduces Innovat3 and pays a specific,
honest compliment (new-launch congrats, their trade, their city, what
they've built). Kudos only, per the playbook: no pitch, no prices, no
business-problem questions — the goal is a response. AI-written with
`ANTHROPIC_API_KEY` (facts-only, CAN-SPAM-conscious); a solid template
fallback otherwise. All messages address the prospect by their **brand
name** (DBA first, legal suffixes stripped) — "Longboat Key Builders",
never "LONGBOAT KEY BUILDERS, INC."

## Sales Practice tab (🎧)

`/practice.html` — a flight simulator for the sales team. Reps pick a
scenario (a skeptical roofer, a busy med spa owner, a cautious law-firm
partner…), get a **3-minute simulated phone call** where Claude plays the
prospect and naturally raises the FAQs/objections from the library — price,
"why so cheap?", "why so expensive?", "how do you do this?", "I already have
a guy", "send me an email" — then get **scored 0–100** across discovery /
objection handling / value communication / rapport / closing, with per-objection
verdicts, strengths, focus areas, and model rebuttals to steal. Scores are
tracked per rep with a team board.

**New product or promo?** Paste the brief and the tab generates **10 fresh
scenarios** for it, so every rep faces it from every angle before selling it.

The FAQ/objection library (with the rebuttal points grading is anchored to)
lives in the database — seeded with Innovat3's ten core objections, add more
via `POST /api/training/faqs`.

Requires `ANTHROPIC_API_KEY` (platform.claude.com). Runs on Claude Opus 5
with server-side refusal fallbacks enabled; expect roughly $0.10–0.25 per
practice call in API usage.

## Market intelligence (Census CBP)

`GET /api/markets/hvac` (or any vertical) ranks Florida counties by
establishment density for that vertical's NAICS codes — answering *"where
should we prospect HVAC?"* before a run, instead of picking cities at
random. Needs a free instant `CENSUS_API_KEY`
(https://api.census.gov/data/key_signup.html).

## Quick start

```bash
npm install
npm run pipeline -- --limit 100        # pull + enrich + score 100 prospects
npm start                              # dashboard at http://localhost:3000
```

Or run it entirely from the dashboard: **Run pipeline** button → set limit (100/day
is the intended cadence), window, sources and industries → watch progress live.

### Daily automation

```cron
0 7 * * 1-5  cd /path/to/app && npm run pipeline -- --limit 100
```

Every run only ingests prospects it hasn't seen before (deduped by license /
document number), so a daily 100-limit run gives your reps a fresh sheet each
morning.

## The dashboard

- **Stat tiles** — total prospects, added today, reachable by email, phones,
  no-website count (your best digital-services targets), average score.
- **Filter bar** — search, industry, source, sales status, min score,
  has-email / has-phone / no-website toggles; sortable columns.
- **Prospect table** — score badge, business, contact + title, email with
  verification chip, phone, website/social icons, city, and an inline
  **sales status** dropdown (New → Contacted → Interested → Not interested →
  Customer / Disqualified).
- **Detail drawer** — click any row: full contact block with copy buttons,
  Sunbiz officer list, score breakdown, assign-to-rep, notes, and a
  **Re-enrich** button.
- **Export CSV** — the whole book, ready for your CRM.

## Deploying for the whole team

The app is stateful (SQLite + multi-minute scrape jobs), so it wants an
**always-on host with a persistent disk** — not serverless.

### Render (recommended, ~$8/mo, one click)

1. Push/keep this repo on GitHub.
2. Go to [dashboard.render.com/blueprints](https://dashboard.render.com/blueprints)
   → **New Blueprint Instance** → connect this repo + branch. Render reads
   `render.yaml` and provisions the service, disk, and daily 7am ET auto-run.
3. Set a team `DASHBOARD_PASSWORD` when prompted. Done — share the URL +
   password with your reps.

### Any VPS with Docker

```bash
DASHBOARD_PASSWORD=yourteampassword docker compose up -d --build
```

### Deployment behaviors

- `DASHBOARD_PASSWORD` — when set, everything sits behind a sign-in
  (user `innovat3` by default). **Always set this on a public URL.**
- `DAILY_RUN_HOUR=7` — the server runs the pipeline itself every day at
  7am ET (`DAILY_RUN_LIMIT` prospects), so reps wake up to a fresh sheet.
  No external cron needed.
- `DATA_DIR` — point at the mounted disk (the Docker image defaults to
  `/app/data`).
- Bonus: hosted platforms don't block SFTP, so the Sunbiz new-LLC feed
  works out of the box.

## Configuration

### API keys (`.env`, all optional)

Copy `.env.example` → `.env`. The engine works with **zero keys** (MX-level email
checks, domain-guess website discovery). Add keys to level it up:

| Key | Unlocks |
|---|---|
| `APOLLO_API_KEY` | **Direct decision-maker contact data** — Apollo matches the officer/licensee name + business against their B2B database and returns verified work email, phone, and LinkedIn. The biggest upgrade for "give me an email or phone for every prospect." |
| `SERPER_API_KEY` | Google-quality website + social discovery |
| `HUNTER_API_KEY` | Email finding via domain search + deliverability verification |
| `ZEROBOUNCE_API_KEY` | Alternative email verifier |

With Apollo enabled the contact waterfall becomes: Apollo verified email →
email on their own website → Hunter → Apollo unverified → MX-checked pattern
guess; phones: state record → Apollo (person, then company) → their website.
Apollo is only queried when a prospect is still missing an email or phone,
so credits aren't spent where the free stack already delivered.

### Industries

`config/default.json → dbpr.boards` — enable/disable boards or add new ones.
Any board's licensee file from a myfloridalicense.com "Public Records" page works
(they share one layout). Currently wired: construction, electrical, cosmetology,
barbers, real-estate agents + companies.

Create `config/local.json` to override anything without touching defaults.

### Sunbiz note

The state's SFTP (port 22) must be reachable from wherever you run the pipeline.
On a network that blocks it, download daily files yourself from the
[Sunbiz data downloads page](https://dos.fl.gov/sunbiz/other-services/data-downloads/)
and feed them in:

```bash
npm run import -- --source sunbiz --file ~/Downloads/20260805c.txt
npm run pipeline
```

`npm run sunbiz:inspect -- <file>` pretty-prints parsed records if you ever want
to verify field alignment.

## Architecture

```
src/
  server.js            Express API + serves the dashboard
  db.js                SQLite (Node's built-in node:sqlite) — prospects, runs
  config.js            config/default.json + config/local.json + .env
  sources/
    dbpr.js            DBPR licensee extracts (CSV)
    sunbiz.js          Sunbiz daily filings (SFTP, fixed-width) + import fallback
    sunbiz-layout.js   Official 1440-char COR record layout
  enrich/
    website.js         Domain discovery, page-match verification, socials
    email.js           Find + verify (website → Hunter → patterns; MX fallback)
    index.js           Per-prospect enrichment orchestrator
  pipeline/
    run.js             Ingest → enrich → score, CLI + API entry, run tracking
    score.js           Weighted scoring engine
    import-file.js     Manual data-file import
public/                Dashboard (vanilla JS, no build step)
data/                  SQLite DB + downloaded extracts (gitignored)
```

Node ≥ 22.13 required (built-in SQLite). The `data/` directory is created on
first run.

## Compliance notes

- Both sources are **public records** published by the State of Florida for
  download; the published Sunbiz SFTP credentials are the state's own public
  access mechanism.
- Email/phone discovery targets **business** contact points. For cold email,
  follow CAN-SPAM (identify yourself, honor opt-outs); for calls/texts, scrub
  against the DNC registry where applicable.

---

## Legacy: fal MCP server

This repo also carries a `.mcp.json` configuring the [fal MCP server](https://fal.ai/docs)
for Claude Code sessions (image-generation tooling). It authenticates via a
`FAL_KEY` environment variable — create a key at <https://fal.ai/dashboard/keys>
and expose it in your environment. Unrelated to the prospect engine.
