# Innovate Solutions - Media House Website

A dark, cinematic single-page website for Innovate Solutions, a media entity producing
commercial, informative and documentary film. The design takes its direction from a
starry-night travel landing page: full-viewport night-sky hero, glass panels, one ice-cyan
accent, letterspaced display type.

## What's on the page

- **Hero** with generated night-sky photography and category chips (Commercial / Informative / Documentary)
- **Featured film** in a framed glass panel
- **The work**: all 16 real productions by [Whiteline Visuals](https://ahmedrodriguez211467.myportfolio.com/work)
  (Ahmed Rodriguez), embedded live via Adobe portfolio video players:
  a horizontal reel row (10 vertical commercials), an explainer grid (4), and a full-width documentary
- **Studio** and **Whiteline Visuals spotlight** sections
- **Contact** form that opens the visitor's email app addressed to the studio

## Stack

Static site: `index.html` + `assets/css/styles.css` + `assets/js/main.js`. No build step.
Open `index.html` in a browser, or serve the folder with any static host (GitHub Pages works as-is).

- Video iframes lazy-load as they approach the viewport (IntersectionObserver)
- Scroll reveals and smooth scrolling honor `prefers-reduced-motion`
- Glass panels fall back to solid fills under `prefers-reduced-transparency`

## Imagery

The four background photographs in `assets/img/` (`hero.jpg`, `about.jpg`, `spotlight.jpg`,
`contact.jpg`) were generated with FLUX.1 [schnell] through the fal MCP server configured in
this repo. The three `cover-*.jpeg` thumbnails come from the Whiteline Visuals portfolio.

## fal MCP server

This repo is configured with the [fal MCP server](https://fal.ai/docs) via `.mcp.json`, giving
Claude Code access to fal's models (search, schemas, pricing, inference, file uploads, and docs search).

### Setup

The server authenticates with a fal API key read from the `FAL_KEY` environment variable - the
key is **not** stored in this repo.

1. Create an API key at <https://fal.ai/dashboard/keys>.
2. Make `FAL_KEY` available where Claude Code runs:
   - **Claude Code on the web:** add `FAL_KEY` as an environment variable in your environment settings (Environment -> Environment variables).
   - **Local CLI:** export it in your shell, e.g. `export FAL_KEY=your-key-here`.
3. Start a new Claude Code session in this repo and approve the `fal-ai` project MCP server when prompted.

### Available tools

- **Discovery:** `search_models`, `get_model_schema`, `get_pricing`, `search_docs`
- **Execution:** `run_model`, `submit_job`, `check_job`
- **Utility:** `upload_file`, `recommend_model`
