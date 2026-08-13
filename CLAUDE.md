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

## Generation workflow
- All media is filed in `generations/innovat3/` as `innovat3_{description}_{unix_ts}.jpg` with a sidecar `.json` log (model, prompt, refs, params, cost) beside it.
- Provider: fal.ai via the fal MCP server (this repo's `.mcp.json`).
- People in ads: generic AI people are fine to commit. Images with the founder's real likeness require his explicit approval to generate (granted in-session) and are currently blocked from git commits by the permission classifier; deliver them in chat.
- Anatomy check before delivering: hands, fingers, limbs. Fix or re-roll if wrong.
