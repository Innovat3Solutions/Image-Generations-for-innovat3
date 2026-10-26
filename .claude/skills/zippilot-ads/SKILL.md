---
name: zippilot-ads
description: Create ZipPilot ad creatives (advertiser-facing and consumer-facing) using the hybrid pipeline in this repo - AI-generated text-free scenes plus live-text HTML templates rendered with Chromium. Use whenever asked to make, extend, restyle, or fix ZipPilot ads, ad series, posters, or the mailer card mockup. Covers brand tokens, honesty rules, scene-generation recipes, the template system in ad-templates/, and the render pipeline.
---

# ZipPilot Ad Factory

Everything lives in the `Innovat3Solutions/Image-Generations-for-innovat3` repo,
branch `claude/zip-pilot-marketing-strategy-l9p5o1`. Templates in `ad-templates/`,
finished PNGs + generation logs in `generations/zippilot/`. Read `ad-templates/README.md`
first - it documents every existing series (ads 01-63) and the design system.

## The method (why these ads look right)

Never let an image model render the brand or the copy. Split every ad in two:

1. **Scene** - AI-generated image, strictly TEXT-FREE (no letters, numbers, logos,
   signage), with a reserved clean zone (flat color, sky, wall, or shadow) where copy
   will go. Generated on fal.ai `fal-ai/nano-banana-2` (2K) via the queue API or the
   fal-ai MCP server; `fal-ai/nano-banana-2/edit` for fixes.
2. **Chrome** - an HTML template (`ad-templates/adNN_*.html` + shared `base.css`)
   that overlays the real logo file, live Poppins text, real QR, and CTA, then is
   screenshotted with the preinstalled Chromium via `render.js` (playwright-core,
   executablePath `/opt/pw-browsers/chromium`).

Result: pixel-perfect type, a never-redrawn logo, and ads that are editable with a
one-line text change plus `node render.js out/`.

## Brand tokens

Navy `#0A1E3C` / navy-2 `#10294E` / blue `#2F80ED` / green `#5BC236`
(bright-green-on-dark `#8FE07C`) / ice `#9DC3F5` / slate `#5B7194`.
Font: Poppins 500-800 (woff2 in `ad-templates/assets/`). Logo mark:
`ad-templates/assets/logo-mark.png` - always place the real file, never describe the
logo to an image model. Wordmark is live text: "Zip" + "Pilot" (Pilot in blue, or
`#7FB5FF` on photos). Sizes: 1080x1080 feed, 1080x1350 portrait.

## Honesty rules (non-negotiable)

- The mailer card may only appear two ways: the real template render
  (`ad-templates/card_front.html` -> `assets/card_front.png`, composited into scenes
  via nano-banana-2/edit at true postcard size) or a completely plain navy card.
  Never an AI-invented card design.
- No fabricated metrics, scan counts, or scarcity ("5 spots left" only when true).
- Claims must match the product: $350/$600/$999 per month tiers, $1,050 3-month
  campaign, 5,000-10,000 homes, 16 spots, one business per industry, extra ZIPs 50% off.
  Reach homes, not "customers".
- QR codes must really scan (assets/qr-thezippilot.com -> TheZipPilot.com).
- No real-organization trademarks in scenes (edit-pass away USPS-style insignia;
  uniforms stay plain navy). Strip any stray AI lettering with an edit pass.
- No em dashes in ad copy.

## Pipeline for a new ad

1. Write the scene prompt: subject + built-in visual gag, position the subject away
   from a named clean zone, append the text-free clause and "the postcard is
   completely plain navy blue with no writing".
2. Generate: POST to `https://queue.fal.run/fal-ai/nano-banana-2` (Authorization:
   `Key $FAL_KEY`, body `{prompt, aspect_ratio, resolution:"2K", output_format:"png"}`),
   poll `/requests/{id}/status`, download `images[0].url`. Save into
   `ad-templates/assets/`.
3. Copy the closest existing template, swap the image, headline, sub, CTA. Keep copy
   short; headline in the clean zone; never cover the subject.
4. Add the file to `render.js`, render, and LOOK at the output. Fix collisions,
   contrast, and overflow before shipping. Spot-check every image for stray AI text.
5. File the final PNG into `generations/zippilot/` with a sidecar JSON (model,
   provider, prompt, refs, params, project, created). Commit and push.

## Series map (copy the right pattern)

ads 01-10 mood-board system (chip header, 3D heroes, light/navy) · 11-16 niche
personality posters · 21-30 flat-color animal posters (plain logo, unique layout each)
· 31-34 card + opt-in loop (uses card_front render + phone UI mock) · 41-44 cinematic
doorstep consumer scenes · 51-60 gag-in-scene consumer set (text tiny, in dead space)
· 61-62 folded-map concept (portrait) · 63 spotlight "busted" homage (portrait,
real card composited).
