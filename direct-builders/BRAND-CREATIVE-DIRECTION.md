# Direct Builders — Brand & Creative Direction (B2B Campaign)

Extracted from [directbuilders.net](https://www.directbuilders.net/) and the current logo. This file is the source of truth for every asset produced under the B2B strategy, and the base layer for AI image generation in this repo (fal MCP) — mood-board references can be layered on top of these tokens.

---

## 1. Logo

- Two-panel horizontal lockup: **DIRECT** in heavy white condensed caps on a **black** panel; **BUILDERS** in white caps on a **brushed-silver/gradient gray** panel; thin black keyline around the whole mark.
- Reads as: industrial, no-nonsense, machined. Like a steel nameplate.
- Usage: never recolor the panels; on dark backgrounds use the existing white-outline version or place on a white card. Give it clear space equal to the height of the letter "D."

## 2. Color system (from site CSS)

| Token | Hex | Role |
|---|---|---|
| Ink | `#0a0a0a` | Primary dark — headlines, dark sections, logo panel |
| Charcoal | `#111111` / `#161616` | Dark section alternates |
| Steel | `#5a5a5a` | Secondary text |
| Silver | `#999999` | Muted text, the "BUILDERS" panel family |
| Fog | `#d8d8d8` | Borders, rules |
| Paper | `#f5f5f3` | Light backgrounds (warm off-white, not pure white) |
| White | `#ffffff` | Cards, reversed type |

**The brand is deliberately monochrome.** For B2B materials, allow **one** optional accent used sparingly (CTA buttons, a single highlight rule): a **safety/high-vis construction orange** (`#ff5c1f` range) *or* stay fully monochrome and let photography carry the color. Decide once after mood-board review; never mix multiple accents.

## 3. Typography

| Role | Face | Notes |
|---|---|---|
| Headlines | **Space Grotesk** (500–700) | Tight, technical, slightly condensed feel — matches the logo's engineering tone |
| Body | **Plus Jakarta Sans** (300–700) | Clean, humanist, highly legible |
| Data / labels / numbers | **JetBrains Mono** (400–500) | Used on the site for stats and index numbers ("01–05") — keep this convention; it's a distinctive signature |

Conventions from the site to carry into all assets:
- Numbered sections in mono type (`01`, `02` …)
- Big stat blocks (`25+ Years`, `100% Licensed & Insured`)
- 3px corner radius max — essentially squared-off; no pills, no soft rounded cards
- Generous whitespace, editorial layouts, thin hairline rules

## 4. Photography & imagery style

The site's signature is **drone/aerial project photography** (DJI shots of completed work) plus clean interior finish photography.

- **Do:** aerial obliques of commercial roofs/sites, symmetrical interior shots of finished buildouts, real crew at work (hard hats, branded shirts), before/after pairs, golden-hour South Florida light.
- **Don't:** generic stock handshakes, blueprints-and-hardhat clichés, over-saturated HDR real estate looks, watermarked stock.
- Treatment: true-to-life color, slightly lifted blacks, no heavy filters. B&W conversion is on-brand for texture/detail shots.

## 5. Voice & tone

- **Plainspoken, confident, specific.** Site copy says "On time, on budget, perfect the first time — guaranteed." — short declaratives, concrete promises, zero fluff.
- B2B register: speak operator-to-operator. Use their vocabulary (COI, unit turn, TI, punch list, milestone inspection, reserve study). Never "we're passionate about..."
- Numbers over adjectives: "48-hour written estimates," "25 years," "2 counties," "since 2000."

## 6. AI image-generation prompt kit (fal MCP)

Base style suffix to append to campaign image prompts:

> ...photorealistic, aerial drone photography perspective, South Florida golden-hour light, clean modern commercial architecture, true-to-life color grading with slightly lifted blacks, editorial composition with generous negative space for typography, no text, no watermarks

Starter prompts (layer mood-board direction on top when provided):

1. **Hero — PM/portfolio audience:** "Aerial oblique drone shot of a modern mid-rise condominium community in Miami with pool deck and palm trees, construction crew staging visible near service entrance, golden hour, [base suffix]"
2. **HOA/recertification:** "Low-angle photograph of a concrete balcony restoration in progress on a South Florida condo building, scaffolding with orange safety netting, workers in hard hats, dramatic clean composition, [base suffix]"
3. **Tenant improvement:** "Symmetrical interior photo of a freshly completed modern office buildout, polished concrete floors, glass partition walls, black metal fixtures, warm wood accents, empty and pristine, [base suffix]"
4. **Developer/pre-con:** "Overhead drone shot straight down of a commercial construction site in Miami with organized material staging and foundation work, geometric composition, [base suffix]"
5. **Texture/detail library (for backgrounds):** "Extreme close-up of brushed steel plate / raw concrete formwork / architectural blueprint linework, monochrome, high detail, [base suffix]"

Post-processing rule: desaturate toward the monochrome palette or convert to duotone (Ink `#0a0a0a` / Paper `#f5f5f3`) when imagery sits behind type.

## 7. Asset templates — layout DNA

Every one-pager / case study / deck slide follows the site's grammar:

```
[mono label]  01 / CASE STUDY            ← JetBrains Mono, uppercase, letterspaced
[headline]    Goldberg & Rosen           ← Space Grotesk 600, large
[hairline rule #d8d8d8]
[body 2-col]  Plus Jakarta Sans          ← problem / approach / result
[stat row]    8,400 SF · 14 weeks · on budget   ← mono, oversized numerals
[footer]      logo + license # + 305-232-2329
```

Dark variant: Ink background, Paper type, Silver labels — mirrors the site's alternating dark/light sections.

---

*When mood-board examples arrive: log them in this file with a one-line takeaway each, decide the accent-color question (Section 2), and update the prompt kit's style suffix accordingly.*
