# openbot-plugin-firecrawl

Firecrawl agent plugin for OpenBot.

## What is included

- A plugin registry export (`plugin`) compatible with OpenBot
- `agent:invoke` handler that calls Firecrawl's autonomous agent API to gather data from the web
- `client:ui:widget:response` handler that captures an API key from the UI and persists it via OpenBot storage

This plugin has **zero runtime dependencies** — it talks to Firecrawl directly via `fetch` (Node 18+).

## Local usage

1. Install dev dependencies:

   `npm install`

2. Build:

   `npm run build`

3. Load `dist/index.js` from your OpenBot plugin registry/runtime.

## Runtime config

Set an API key using one of the following:

- `FIRECRAWL_API_KEY` environment variable
- `apiKey` in plugin options
- Provide the key through the in-app API key form (auto-shown when missing)

Optional:

- `FIRECRAWL_API_URL` to override the API base URL (defaults to `https://api.firecrawl.dev`)
