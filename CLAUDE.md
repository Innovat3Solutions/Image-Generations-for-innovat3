# Image Generations for innovat3

## Reel Legacy — standing rule

Any work involving **Reel Legacy** must follow `brand/BRAND_GUIDELINES.md` (the brand book).
Non-negotiables:

- Attach the wave-R logo refs from `generations/reel-legacy/refs/` to every generation —
  never describe the logo in words.
- Condition garment imagery on the current `_v3_` mockups in `generations/reel-legacy/`.
- Fabric must read as Lululemon / brrr° tier technical knit (prompt block in brand book §6).
- Monochrome graphics/type; color lives only in photography. Taglines verbatim from the
  copy deck. No exclamation points, no emoji, no discount-brand energy.
- Backgrounds come from the brand world: coastal city to open water — Miami skyline at
  dusk, docks and boats, boardwalk palms, sunrise runs, last casts.

## Generation workflow

Media generation routes through the fal-ai MCP server (see `.mcp.json`, `FAL_KEY` env var).
Outputs are filed per project in `generations/<project>/` with sidecar JSON logs
(model, prompt, refs, params, cost) beside every image.
