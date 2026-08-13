# Reel Legacy — Professional Apparel Mockups

Draft mockups (front + back catalog views, ghost-mannequin studio style) generated with
`fal-ai/nano-banana-2/edit`, one per style from the catalog & spec sheets. Each image has a
sidecar `.json` with the exact prompt, refs, params, and cost.

| Style # | Product | File prefix |
|---|---|---|
| RL-1001 | Performance Long Sleeve, White — chest R + back spine fade | `reel-legacy_rl1001_white_front_back_` |
| RL-L1001 | Active Wear Performance LS, White — chest R + full sleeve print | `reel-legacy_rll1001_white_sleeve_print_` |
| RL-LS1003 | Performance LS, White minimal — light-gray hem print + back circle badge | `reel-legacy_rlls1003_white_minimal_` |
| RL-LS1002 | Lifestyle LS, Black Navy Camo — white chest R + white spine fade | `reel-legacy_rlls1002_navycamo_spine_` |
| RL-LS1002 | Lifestyle LS, Black Camo — white chest R + white sleeve print | `reel-legacy_rlls1002_blackcamo_sleeve_` |

## Campaign creatives

Built from the v2 mockups (passed as reference images for garment/print consistency):

| Creative | Format | File prefix |
|---|---|---|
| "Sorry for the delay… but we're back" — rail trio | 4:5 | `reel-legacy_ad_were_back_rail_trio_` |
| "We're back. Sorry for the delay" — camo spotlight | 4:5 | `reel-legacy_ad_were_back_camo_spotlight_` |
| "details matter." — faded spine hero, white | 9:16 | `reel-legacy_post_details_matter_faded_back_` |
| "details matter." — faded spine hero, navy camo | 9:16 | `reel-legacy_post_details_matter_camo_back_` |

## Versions

`_v2_` files are the current drafts: their logo refs were rebuilt to match the client's
actual wave-R lockup (R whose left leg is a breaking wave curling into the bowl), and the
v1 flaws (ghosted back-sleeve lettering on RL-L1001) are fixed. The v1 files used an
earlier, incorrect logo recreation and are kept only for history.

## refs/

`reel_legacy_r_black.png` / `reel_legacy_r_white.png` — vector recreation (SVG sources
included) traced from the client's logo lockup. `reel_legacy_wordmark_black.png` —
spaced-caps wordmark. For pixel-perfect production finals, drop the official vector logo
exports (black + white PNG, 1024px+) into this folder and re-run the prompts from the
sidecar JSONs.

## Known draft notes

- Spine prints render with rotated (book-spine) letters; the spec sheets show upright
  stacked letters. Fixable in a re-roll if the stacked style is required.
