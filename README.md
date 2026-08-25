# Image Generations for innovat3

## FLN clickable prototype

`index.html` is a self-contained, dependency-free implementation of the FLN legal-network wireframe prototype (imported from the Claude Design project `Prototype.dc.html`). Open it directly in a browser — no build step or server required.

It covers the full flow: Home feed → Search results (Attorneys/Firms tabs) → Attorney profile → Firm profile, the Find Legal Help guided chat, Discover, Resources, and the Unclaimed firm → Claim flow → Firm dashboard journey, plus the contact-inquiry modal. The flow map at the top jumps to any screen, and `?screen=<name>` (e.g. `index.html?screen=dash`) deep-links to a screen — names: `home`, `search`, `attorney`, `firm`, `help`, `discover`, `resources`, `unclaimed`, `claim`, `dash`.

## fal MCP server

This repo is configured with the [fal MCP server](https://fal.ai/docs) via `.mcp.json`, giving Claude Code access to fal's 1,000+ models (search, schemas, pricing, inference, file uploads, and docs search).

### Setup

The server authenticates with a fal API key read from the `FAL_KEY` environment variable — the key is **not** stored in this repo.

1. Create an API key at <https://fal.ai/dashboard/keys>.
2. Make `FAL_KEY` available where Claude Code runs:
   - **Claude Code on the web:** add `FAL_KEY` as an environment variable in your environment settings (Environment → Environment variables).
   - **Local CLI:** export it in your shell, e.g. `export FAL_KEY=your-key-here`.
3. Start a new Claude Code session in this repo and approve the `fal-ai` project MCP server when prompted.

### Available tools

- **Discovery:** `search_models`, `get_model_schema`, `get_pricing`, `search_docs`
- **Execution:** `run_model`, `submit_job`, `check_job`
- **Utility:** `upload_file`, `recommend_model`
