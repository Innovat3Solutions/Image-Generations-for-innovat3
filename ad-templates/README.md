# ZipPilot Ad Templates

Editable HTML ad templates for the advertiser-recruitment campaign. Every ad shares one
locked design system (`base.css`) — real logo file, live text, accurate claims — so you can
change a headline, price, niche, or ZIP count by editing text, not regenerating images.

## The 10 ads

| File | Angle | Format |
|---|---|---|
| `ad01_what_is_zippilot.html` | What ZipPilot is — 3-step explainer | 1080×1080 |
| `ad02_cost_split.html` | $4,000+ solo mail vs from $350/mo | 1080×1080 |
| `ad03_exclusivity.html` | Only ONE plumber per ZIP (swap niche per campaign) | 1080×1080 |
| `ad04_spot_board.html` | 16 exclusive spots, one per industry | 1080×1080 |
| `ad05_qr_tracking.html` | Trackable mail — QR is real and scannable → TheZipPilot.com | 1080×1080 |
| `ad06_ltv_math.html` | One $2,500/yr client vs $1,050 3-month campaign | 1080×1080 |
| `ad07_community.html` | Support Local / community angle | 1080×1080 |
| `ad08_own_your_zip.html` | Market Leader $999/mo + multi-ZIP 50% off | 1080×1080 |
| `ad09_reach.html` | 10,000 neighbors (Stories/Reels portrait) | 1080×1350 |
| `ad10_pricing.html` | Three pricing tiers ($350/$600/$999) | 1080×1080 |

## Rendering PNGs

```bash
npm i playwright-core        # once
node render.js out/          # renders every template to out/*.png
```

Uses the system Chromium at `/opt/pw-browsers/chromium` (edit `render.js` for a local
`npx playwright install chromium` path instead).

## Making variants

- **Per-niche** (ad03): change "plumber" and the background image — generate a new
  text-free background scene and drop it in `assets/`.
- **Per-ZIP**: add the ZIP code to any headline, e.g. "Only ONE plumber gets 33101."
- **Scarcity counts** (ad04): only add "X spots left" claims when a real card is filling —
  keep ads truthful.

## Assets

- `assets/logo-mark.png` — the real ZipPilot mark (from the site favicon, 500px). Replace
  with a higher-res export when available; the wordmark is live text (Poppins 800).
- `assets/qr-thezippilot.png` — a real QR code that resolves to TheZipPilot.com. Regenerate
  per campaign with any QR tool if you want per-ad tracking URLs.
- `assets/bg_*.png` — AI-generated background scenes (fal.ai nano-banana-2, 2K), generated
  with strict no-text prompts. They contain no product imagery — the mailer card itself is
  deliberately never depicted, because the real card design doesn't exist yet.
- `assets/poppins-*.woff2` — Poppins 500/600/700/800 subsets.

## Design system (base.css) — v3, mood-board structure

Structure follows the approved mood board: white logo chip top-left, color-mixed
Poppins-800 headlines, glossy 3D hero objects (assets/hero_*.png, generated text-free
in brand palette), circular feature-icon rows, pill CTA. Light (white) and brand (navy)
background modes alternate across the set via body.light.

### Original tokens

Navy `#0A1E3C` · blue `#2F80ED` · green `#5BC236` · ice `#9DC3F5`. Locked header (logo +
wordmark), locked footer (green pill CTA + TheZipPilot.com). Ads vary only the middle
content. When the real card design is finalized, add a photographed/composited card ad —
never an AI-invented one.
