# Reel Legacy — Brand Guidelines

> Premium performance apparel for those who live the fishing lifestyle.
> **Built Different. Earned, Not Given.**

Source of truth for every post, ad, mockup, and campaign asset. Derived from the live site
(reel-legacy-website-store-81mm.vercel.app), the product spec sheets, and the approved
v3 mockups + campaign creatives in `generations/reel-legacy/`.

Operated by Niveles Capital LLC · support@reellegacy.com

---

## 1. Brand essence

- **Who we are:** A premium saltwater performance brand. Engineered gear for people who
  chase adventure, respect the ocean, and leave a legacy on and off the water.
- **The world:** Coastal city to open water — Miami skyline at dusk, boardwalk palms at
  golden hour, sunrise runs, last casts. Water is always near.
- **The customer:** Lives it, doesn't perform it. Values quality they can feel
  (Lululemon / brrr° / Southern Tide tier), earns their style.
- **Brand personality:** Confident, understated, durable. Says less, means more.
  Premium without being precious. Never loud, never gimmicky.

**Mission line (use verbatim):**
"Reel Legacy is for those who chase adventure, respect the ocean, and leave a legacy on and off the water."

---

## 2. Logo

The mark: a bold white (or black) **wave-R** — the letter R whose left stem is a breaking
wave curling into the bowl, with a flat-foot right leg. Vector recreations live in
`generations/reel-legacy/refs/` (`reel_legacy_r.svg`, black/white PNGs).

Rules:
- White mark on dark grounds; black mark on white/light grounds. Never gray, never colored.
- Chest print: small, left chest, ~8 cm. Silicone print, matte, 1–1.5 mm raised.
- Lockup: R above (or beside) "REEL LEGACY" in spaced caps; tagline "BUILT DIFFERENT." in
  small caps beneath. Vertical divider bar between R and wordmark in horizontal lockups.
- Never redraw, stretch, outline, or add effects to the mark. Never describe it to an AI
  model in words — always attach the reference file.

## 3. Color

Strictly monochrome. The brand has **no accent color** — restraint is the identity.

| Token | Hex | Use |
|---|---|---|
| Black | `#000000` | True black grounds, apparel |
| Ink | `#050505` | Site/section backgrounds |
| Charcoal | `#0a0a0a` | Alt dark surface |
| Panel | `#0f0f0f` | Cards, modals |
| Zinc 900 | `#18181b` | Deep surface |
| Zinc 700 | `#3f3f46` | Borders on light |
| Zinc 500 | `#71717a` | Muted text |
| Zinc 400 | `#a1a1aa` | Secondary text on dark |
| Zinc 200 | `#e4e4e7` | Body text on dark |
| White | `#ffffff` | Headlines, logo, buttons |

- Hairlines on dark: `rgba(255,255,255,0.10–0.20)`.
- The only "color" that ever appears is in photography (turquoise water, dusk sky, golden
  light) — never in graphics, type, or UI.

## 4. Typography

- **Headings / display:** Oswald (500–600). Condensed, tall, confident. Often uppercase.
- **Body:** Inter (or system sans). Light-to-regular weights, relaxed leading.
- **Labels / buttons / eyebrows:** 11px-equivalent, UPPERCASE, letter-spacing `0.15em`,
  semibold. (Site button spec: white bg, black text, square corners, no radius.)
- **Spine/sleeve print type:** spaced bold caps, generous tracking (see wordmark ref).
- Big statements are short and end with a period: "Built Different." "details matter."

## 5. Voice & copy deck

Tone: earned confidence. Short declaratives. Fragments allowed. Periods do heavy lifting.
Never exclamation points, never hype-slang, minimal emoji (none in brand posts).

**Tagline library (verbatim, reuse freely):**
- Built Different.
- Earned, Not Given.
- From sunrise to last cast.
- Designed for those who live it.
- What You Wear. It's How You Live.
- Worn On The Water
- Live The Lifestyle
- Join The Legacy
- Built To Last / Backed By Legacy
- Built for those who live it.
- Every piece, built for the water.

**Feature vocabulary (from spec sheets & site):**
UPF 50+ Sun Protection · Moisture Wicking & Quick Dry · 4-Way Stretch & Flexibility ·
Lightweight & Breathable · Anti-Odor Technology · Wash & Saltwater Resistant ·
Built For The Elements · Engineered For Comfort · Comfort That Moves With You

**Caption formula:** one short statement + one feature or story line + quiet CTA.
> Built for the water. Back on it.
> UPF 50+, quick-dry, saltwater-proof.
> Shop the collection — link in bio.

## 6. Fabric standard (how garments must look)

Lululemon / brrr° (Southern Tide) tier — this is non-negotiable in imagery:
ultra-fine-gauge smooth polyester-spandex jersey (92/8, 160 gsm), silky cool-touch surface
with a subtle satin luster along folds, fluid liquid-like drape, barely-visible knit
texture, flatlock seams. **Never** chalky heavyweight cotton, slub, or fleece.

Prompt block (paste into any generation):
> "premium technical performance knit in the style of Lululemon and brrr° cooling fabric:
> ultra-fine-gauge smooth polyester-spandex jersey, silky cool-touch surface with subtle
> satin-like luster catching soft highlights, fluid liquid-like drape, flatlock seams —
> NOT heavyweight cotton, no chalky matte, no slub, no fleece"

## 7. Imagery — three registers

**A. Catalog (product truth).** Ghost-mannequin front+back pairs on seamless light gray
`#f4f4f4`, soft even light, soft contact shadow. Print placements exactly per spec sheets.
Reference: `*_v3_*.png` mockups.

**B. Dark campaign (drops, announcements).** Deep charcoal studio `#0a0a0a`, single
spotlight or soft gradient, garments on black rail/hangers or floating, glowing white
neon headline (the only "glow" allowed), small logo lockup top-center, small spaced-caps
footer line. Reference: `reel-legacy_ad_were_back_*.png`.

**C. Coastal editorial (lifestyle, brand life).** Two moods:
- *Golden:* Miami boardwalk/dock/boat, palms, turquoise water, warm sunlight, clean
  garment as hero, real-life styling (sunglasses, watch).
- *Moody:* on-model close crops against textured dark walls, directional light, print
  detail as hero, editorial type overlay ("details matter." pattern).
Reference: `reel-legacy_post_details_matter_*.png`, site lifestyle photos.

Composition habits: lots of negative space, centered or left-locked type, hairline rules,
type never fights the garment, one hero per frame.

## 8. Post recipes (proven patterns)

1. **Catalog drop card (4:5):** front+back mockup + eyebrow "NEW DROP" + product name in
   Oswald caps + price + "PRE-ORDER — 20% OFF" ghost button line.
2. **Neon announcement (4:5):** dark studio, hanging garment(s), neon headline
   ("WE'RE BACK.", "NEW DROP.", "SOLD OUT. RESTOCKED."), logo lockup top, spec line bottom.
3. **Editorial detail (9:16):** moody on-model crop of one print detail; lowercase Oswald
   statement + thin rule + one-line sub; "BUILT FOR THE ELEMENTS" footer.
4. **Lifestyle carousel (4:5):** golden coastal shots, minimal or no type; caption carries
   the copy.
Always: wave-R ref file attached; fabric block from §6 included; garments conditioned on
the current `_v3_` mockups for consistency.

## 9. Products & pricing (current)

| Product | Color | Price |
|---|---|---|
| Legacy Performance Tee | White | $49.99 · Best Seller |
| Legacy Performance Long Sleeve | White | $54.99 · New |
| Legacy Long Sleeve | Heather Grey | $54.99 |
| Legacy Performance Shirt | White | $49.99 |
| Legacy Camo Snapback | Camo | $34.99 · Best Seller |
| Legacy Camo Hat | Field Camo | $34.99 |
| Reel Legacy Cooler | Stone White | $129.99 · New |
| Reel Legacy Tumbler | Stainless | $29.99 · New |

Long-sleeve program (spec sheets): RL-1001, RL-L1001, RL-LS1003 (white), RL-LS1002
(black navy camo / black camo). 92% poly / 8% spandex, 160 gsm, S–3XL, UPF 50+.
Current offer language: "Pre-Order — 20% Off". Ship window: ~3 weeks, up to 30 days.

## 10. Do / Don't

**Do:** monochrome graphics · one hero per frame · short statements with periods ·
spaced-caps labels · real water-world settings · technical-knit fabric look ·
attach logo refs to every generation.

**Don't:** accent colors or gradients in graphics · exclamation points, hype copy, emoji ·
busy layouts or more than two type sizes per post · cotton-looking fabric ·
redrawn/approximated logos · rounded-corner buttons · discount-brand energy (starbursts,
red SALE tags) — even sales look premium (see "Big sale" neon reference).
