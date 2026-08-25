# 10-Model Identity-Consistency Bake-off — Natalie Ruiz / Real Trust Law

**Goal (per client direction):** these are not ads — they are clean photographic **scenes for the website**, with no baked-in typography. The critical requirement is **facial consistency**: every image must read as the same real person as the reference photos, never an invented lookalike.

**References used** (in `refs/`): `natalie_ruiz_closeup.jpg` (primary identity ref), `natalie_ruiz_portrait.jpg`, `natalie_ruiz_office.jpg`, `natalie_ruiz_selfie.jpg`. Every model got the close-up as its first/primary reference; models that accept more refs also got the others.

Each of the 10 scenes was generated on a **different model** (9 vendors) so the client can pick the model that holds Natalie's likeness best and standardize on it for future website imagery.

## Scorecard — clean scene files (`*_scene_*.jpg`)

Likeness: 1–5 (5 = instantly the same person; freckles, brows, eye shape, jaw all match). Scene: editorial quality / brief adherence.

| # | Scene file | Model (vendor) | Refs accepted | Likeness | Scene | Notes |
|---|---|---|---|---|---|---|
| 01 | `01_founder_scene` | Nano Banana Pro (Google) | 4 | 5 | 5 | Freckles, brows, even her coral manicure carried over. Benchmark result. |
| 02 | `02_legacy_scene` | Ideogram V3 Character (Ideogram) | 1 | 4 | 3.5 | Face very close; invented a crossbody strap; slightly phone-photo look rather than editorial. |
| 03 | `03_home_scene` | Seedream 5.0 Pro (ByteDance) | 3 | 4 | 5 | Gorgeous architecture; face good now that she's larger in frame, slightly aged/softened. |
| 04 | `04_will_scene` | Hunyuan Image 3.0 (Tencent) | 3 | 4 | 4.5 | Strong scene and freckle detail; face at three-quarter downward angle reads right. |
| 05 | `05_realestate_scene` | FLUX.1 Kontext Max (BFL) | 2 | – | – | pending |
| 06 | `06_conversation_scene` | MAI Image 2.5 Pro (Microsoft) | 1 | – | – | pending |
| 07 | `07_waterfront_scene` | Nano Banana 2 (Google) | 4 | – | – | pending |
| 08 | `08_studio_scene` | GPT Image 2 (OpenAI) | 4 | – | – | pending |
| 09 | `09_meeting_scene` | Qwen Image 3 (Alibaba) | 3 | – | – | pending |
| 10 | `10_courtyard_scene` | MiniMax Image-01 (MiniMax) | 1 | – | – | pending |

## Earlier ad-style pass (kept for reference, `*_ad_*.jpg`)
Before the direction changed to clean scenes, six concepts were generated as full ad layouts with typography. Additional finding from that pass: **only Google Nano Banana Pro and ByteDance Seedream 5.0 Pro rendered ad copy correctly**; Ideogram (character mode), FLUX Kontext, and others garbled long text. If ads are needed later, generate the clean plate with the winning likeness model and set type in Figma/Canva — don't bake copy in.

## Recommendation (updated as results land)
- **Google Nano Banana Pro** is the current leader for likeness and overall editorial quality, and it accepts all four reference photos at once.
- Final call after all 10 scenes land.
