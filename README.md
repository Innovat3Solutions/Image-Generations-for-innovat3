# Innovat3 Prospect Engine

A prospect-generation platform for the Innovat3 sales team. It finds **brand-new
Florida businesses** the moment they appear in state records, figures out **who
to call and how to reach them**, checks their **digital presence**, scores every
prospect, and serves it all in a dashboard your reps work from daily.

![Pipeline] Sunbiz + DBPR → dedupe → find contact → find website & socials → find/verify email → find phone → score → dashboard

## Data sources

| Source | What it gives us | How |
|---|---|---|
| **Sunbiz** (FL Division of Corporations) | Every new LLC / corporation filed, with **filing date, officers, registered agent** — your decision makers | Daily data files over the state's public SFTP (`sftp.floridados.gov`, published credentials) |
| **DBPR** (FL Dept. of Business & Professional Regulation) | Newly **licensed** contractors, electricians, cosmetologists, barbers, realtors — with **original licensure date**, name and address | Free licensee extract CSVs from myfloridalicense.com, refreshed daily |

"New" means established/licensed within the window you choose (default **180 days**).

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

## Scoring (0–100)

Configurable weights in `config/default.json`. Default mode is
**`digital_services`** — tuned for selling websites/branding/marketing, so a
brand-new business with *no website yet* scores as an opportunity. Flip
`scoring.mode` to `reachability` for classic lead scoring. Components:
decision maker (+15), phone (+15), email quality (up to +20), recency of
establishment (up to +20, linear decay over 180 days), active status (+5),
web-presence signal (±). Every prospect stores its full score breakdown.

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

## Configuration

### API keys (`.env`, all optional)

Copy `.env.example` → `.env`. The engine works with **zero keys** (MX-level email
checks, domain-guess website discovery). Add keys to level it up:

| Key | Unlocks |
|---|---|
| `SERPER_API_KEY` | Google-quality website + social discovery (biggest single upgrade) |
| `HUNTER_API_KEY` | Real email finding (domain search) + true deliverability verification |
| `ZEROBOUNCE_API_KEY` | Alternative email verifier |

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
