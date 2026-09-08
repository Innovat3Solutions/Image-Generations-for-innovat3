# Innovat3 Solutions — Brand & Generation Rules

Standing rules for all ad creative generated in this repo.

## Copy rules
- **Never use em dashes (—) in any ad copy.** No en dashes as substitutes either. Rewrite the sentence or use a period, comma, or colon instead. This applies to headlines, subtext, chips, CTAs, footers, everything.
- Voice: direct, results-oriented, problem/solution. Short sentences.
- Standard footer: `www.innovat3solutions.com` (email when relevant: `hello@innovat3solutions.com`). Miami, FL.

## Brand
- Colors: chartreuse lime green #B9D93C, black, white/cream, grey. One accent color only (the lime).
- Typography in generated ads: heavy condensed grotesk sans for headlines (tight tracking, editorial hierarchy), clean neutral grotesk for body. No script, rounded, or playful fonts unless explicitly requested.
- Logo: ALWAYS pass the real logo file as a native reference image to an edit-capable model (Seedream, Nano Banana, GPT Image, Qwen) with "preserve exact geometry, letterforms and colors, do not redraw" instructions. Black logo on light backgrounds, white logo on dark. Uniform placement per set (top-left on dark cards, top-center on light). Never describe the logo in words; never let a text-to-image-only model invent it.
- Logo files: `generations/refs/innovat3-logo-black-transparent.png` and `innovat3-logo-white-transparent.png`.

## Services to represent (not just voice AI)
Websites (offer: as low as $99/mo), Voice AI agents, Workflow Automation, Custom Apps, CRM / client tracking, Review Management, Lead Capture, Data Intelligence, Growth Consulting, Private AI Infrastructure.

## FRAM3 (media & creative division)
FRAM3 is the media and creative division of Innovat3, built to be marketed independently and feed clients into the Innovat3 ecosystem (websites, CRM, AI, automation).

- Sub-brands, always written with the slash system: FRAM3 / STUDIOS (videography, photography, commercial production, event coverage, drone, editing, post), FRAM3 / SOCIAL (full social media management, planning, posting, community, reporting), FRAM3 / ADS (Meta, Instagram, TikTok, YouTube paid campaigns, creative testing, optimization, reporting), FRAM3 / CREATIVE (creative direction, campaign concepts, branding, graphic design, content strategy).
- Brand story: "We frame the story. We create the content. We put it in front of the right audience."
- Lockup: FRAM3 large, "by INNOVAT3" small beneath. Same palette as Innovat3 (lime #B9D93C, black, white, grey) but a more cinematic and editorial personality: lime viewfinder corner brackets as the signature motif, cinema letterbox bars, film-set imagery (cinema cameras, softboxes, monitors, slates), film grain, wide-tracked caps, slate-style micro labels, restrained single lime accents. Premium means quiet: less copy, more atmosphere than the Innovat3 ad system.
- FRAM3 lockup: provisional wordmark files exist at `generations/refs/fram3-lockup-black-transparent.png` and `fram3-lockup-white-transparent.png` (FRAM3 in Anton with lime 3, BY INNOVAT3 in Archivo Black tracked out; rendered deterministically by `make_fram3_lockup.py`, not AI-generated). Treat them with the same exact-geometry rules as the Innovat3 logo. They are provisional: if a designed wordmark replaces them, swap the files and keep the names.
- FRAM3 card style (from the approved mood board): black and white Miami photography (skyline, palms, street/skate energy, film sets), solid lime panels, off-white panels, heavy condensed caps with ONE handwritten brush-script accent word (brush script is approved for FRAM3 only), tiny tracked-out kickers like 'FRAM3 / STUDIOS', lime viewfinder corner brackets, film grain.

## Generation workflow
- All media is filed in `generations/innovat3/` as `innovat3_{description}_{unix_ts}.jpg` with a sidecar `.json` log (model, prompt, refs, params, cost) beside it.
- Provider: fal.ai via the fal MCP server (this repo's `.mcp.json`).
- People in ads: generic AI people are fine to commit. Images with the founder's real likeness require his explicit approval to generate (granted in-session) and are currently blocked from git commits by the permission classifier; deliver them in chat.
- Anatomy check before delivering: hands, fingers, limbs. Fix or re-roll if wrong.
