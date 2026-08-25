# 10-Model Identity-Consistency Bake-off — Natalie Ruiz / Real Trust Law

**Goal (per client direction):** these are not ads — they are clean photographic **scenes for the website**, with no baked-in typography. The critical requirement is **facial consistency**: every image must read as the same real person as the reference photos, never an invented lookalike.

**References used** (in `refs/`): `natalie_ruiz_closeup.jpg` (primary identity ref), `natalie_ruiz_portrait.jpg`, `natalie_ruiz_office.jpg`, `natalie_ruiz_selfie.jpg`. Every model got the close-up as its first/primary reference; models that accept more refs also got the others.

Each of the 10 scenes was generated on a **different model** so the client can pick the model that holds Natalie's likeness best and standardize on it for future website imagery.

## Final scorecard — clean scene files (`*_scene_*.jpg`)

Likeness: 1–5 (5 = instantly the same person — freckles, brows, eye shape, jaw, jewelry all match). Scene: editorial quality / brief adherence.

| # | Scene | Model (vendor) | Refs | Likeness | Scene | Notes |
|---|---|---|---|---|---|---|
| 01 | Founder, private office | **Nano Banana Pro** (Google) | 4 | **5** | 5 | Benchmark. Freckles, brows, even her coral manicure carried over. |
| 08 | Studio portrait, black suit | **GPT Image 2** (OpenAI) | 3 | **5** | 5 | Co-winner. Carried her cross necklace unprompted; flawless studio look. |
| 09 | Private meeting room | **Qwen Image 3** (Alibaba) | 3 | **4.5** | 5 | Excellent; also reproduced the cross necklace; softest-touch retouch feel. |
| 05 | Modern residence, charcoal suit | **FLUX.1 Kontext Max** (BFL) | 2 | **4.5** | 4.5 | Very close; slight smoothing; natural candid angle. |
| 02 | Family loggia | **Ideogram V3 Character** (Ideogram) | 1 | 4 | 3.5 | Face close; invented a crossbody strap; phone-photo feel rather than editorial. |
| 04 | Signing documents, study | **Hunyuan Image 3.0** (Tencent) | 3 | 4 | 4.5 | Good freckle detail at three-quarter downward angle. |
| 07 | Waterfront path, golden hour | **Nano Banana 2** (Google) | 4 | 4 | 5 | Cinematic; face small in frame but reads correctly. |
| 03 | Coral Gables residence | **Seedream 5.0 Pro** (ByteDance) | 3 | 4 | 5 | Superb architecture; face slightly aged/softened. |
| 10 | Limestone courtyard | **MiniMax Image-01** (MiniMax) | 1 | 3 | 3.5 | Recognizable family resemblance but heavier features, different lips — drifts toward "a new person." |
| 06 | Client conversation | **Luma Photon modify** (Luma) | 1 | **1** | 2 | Identity lost entirely (different woman). Do not use for likeness work. |
| — | (attempted for 06) | **MAI Image 2.5 Pro** (Microsoft) | 1 | n/a | n/a | Refused: content checker blocked identity-preserving edits on 3 attempts (one earlier attempt did pass, so enforcement is inconsistent). Luma Photon substituted. |

## Recommendation
1. **Standardize on Google Nano Banana Pro** (`fal-ai/nano-banana-pro/edit`) for all future Natalie imagery — best likeness, accepts all four refs at once, $0.15/image, and (from the earlier ad-style pass) it is also one of only two models that render ad typography correctly if that's ever needed.
2. **GPT Image 2** and **Qwen Image 3** are strong backups when a second opinion or different look is wanted.
3. Avoid **Luma Photon** for identity work; treat **MiniMax Image-01** as marginal; **MAI 2.5 Pro** is unreliable due to content-policy refusals on real-person edits.

## Earlier ad-style pass (kept for reference, `*_ad_*.jpg`)
Before the direction changed to clean scenes, six concepts were generated as full ad layouts with typography. Finding: **only Nano Banana Pro and Seedream 5.0 Pro rendered ad copy correctly**; Ideogram (character mode) and FLUX Kontext garbled long text. If ads are needed later: generate the clean plate with Nano Banana Pro and set type in Figma/Canva rather than baking copy in.

## Production series (post-bake-off)
Per client decision, **Qwen Image 3** (`alibaba/qwen-image-3/edit`) is the standing model for all Natalie imagery. Scenes 11–15 (`*_qwen_*.jpg`) are the first production batch: every generation references the same photos in `refs/` (close-up first), is directed with explicit photographer language (lens, aperture, lighting plan), and finished to an editor spec (critical sharpness on the eyes, natural skin texture and freckles preserved, no plastic smoothing, clean color grade).
