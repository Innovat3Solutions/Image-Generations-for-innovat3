---
name: ad-factory
description: Create professional-grade static ad creatives for any brand using a hybrid pipeline - AI-generated text-free scenes composited with live-text HTML templates rendered in a headless browser. Use whenever asked to make ad creatives, social ads, poster ads, campaign series, product-shot ads, or to translate an ad mood board or reference ad into a brand's own campaign. Covers the method, truth-in-advertising rules, scene prompting recipes, the template system, and the render-and-review loop.
---

# Ad Factory

The core insight: image models produce beautiful scenes but unreliable text and fake
logos. Professional results come from splitting every ad into two layers and never
letting the model touch the brand.

## The two-layer method

1. **Scene layer (AI).** Generate the visual with an image model (e.g. nano-banana-2
   at 2K via fal.ai, or whatever /generate routes to). The prompt must demand:
   absolutely no text, letters, numbers, logos, or signage anywhere; any product
   stand-in rendered as a plain blank object; and a named CLEAN ZONE (flat color
   field, open sky, plain wall, deep shadow) where copy will later sit, with the
   subject positioned away from it.
2. **Chrome layer (HTML).** An HTML template per ad plus one shared CSS design
   system: the brand's REAL logo file placed as an image (never described to a
   model), headlines and CTAs as live text in the brand font (self-hosted woff2),
   real scannable QR codes (generated with a QR library, pointing at a real URL).
   Screenshot at final resolution with headless Chromium (playwright-core).

Benefits: pixel-perfect typography, a logo that is identical in every ad, per-market
variants by editing one line of text, and a re-render instead of a re-generation.

## Brand setup (once per client)

Collect into an assets folder: logo file(s), exact hex tokens, font files, canvas
sizes (1080x1080 feed, 1080x1350 portrait). Define a locked design system in CSS:
type scale, accent colors, CTA pill geometry, logo placement rules. If the product
has a physical design (card, label, packaging), build it as its own HTML template and
render it - then it can be composited into scenes honestly via an image-edit model
("place this exact image, same size and perspective, keep everything else the same").

## Creative method

- **The gag lives in the image, not the caption.** Build a double-take into the scene
  (animal caught in the act, absurd scale, before/after split). Copy is a short
  punchline set in the clean zone, never covering the subject.
- **Mood-board translation, not copying.** Take the reference's structure (color
  worlds, headline rhythm, logo placement, single surreal metaphor) and rebuild it
  with the brand's palette, subjects, and an original line.
- **Series thinking.** One persuasion angle per ad (price math, exclusivity, social
  proof, product reveal, how-it-works, niche-specific identification). Vary layout
  per ad when the style calls for it; keep the logo treatment consistent.
- **Audience split.** Make separate series for buyers of the product and for its
  end consumers; same system, different scenes and claims.

## Truth-in-advertising rules (non-negotiable)

- Never depict a fake version of the client's product; show the real design
  (rendered from its own template or photographed) or a deliberately blank stand-in.
- No fabricated metrics, testimonials, or scarcity counts; every number in copy must
  match the client's real pricing and reach, scoped so the math survives scrutiny.
- No real-organization trademarks in scenes (uniforms, logos, insignia): edit-pass
  them away. Strip any stray AI-generated lettering the same way.
- QR codes shown must actually scan to the claimed destination.
- Mark illustrative UI numbers or offers as samples.

## Pipeline per ad

1. Write the scene prompt: subject + built-in gag + clean-zone placement + the
   no-text clause. Generate at 2K, correct aspect for the canvas.
2. Build or copy an HTML template; drop in the scene, headline, sub, CTA, logo.
3. Render with the headless-browser script; then LOOK at the PNG. Check: text
   collisions, contrast, overflow, stray AI text, trademark leaks, claim accuracy.
   Fix and re-render until clean - never ship unreviewed.
4. File the final PNG with a sidecar JSON log (model, provider, full prompt, refs,
   params, date) so any ad can be traced and re-run. Commit everything - templates
   are the deliverable as much as the PNGs.

## Reference implementation

See the ZipPilot build in Innovat3Solutions/Image-Generations-for-innovat3
(branch claude/zip-pilot-marketing-strategy-l9p5o1): ad-templates/ holds the design
system, 60+ templates across 8 series, render.js, and a README mapping every series
to the technique it demonstrates.
