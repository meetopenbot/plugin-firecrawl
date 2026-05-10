# openbot-plugin-firecrawl

Firecrawl agent plugin for OpenBot.

## What is included

- A plugin registry export (`plugin`) compatible with OpenBot
- `agent:invoke` handler that uses Firecrawl's autonomous agent API to gather data from the web.

## Local usage

1. Install dependencies:

   `npm install`

2. Build:

   `npm run build`

3. Load `dist/index.js` from your OpenBot plugin registry/runtime.

## Runtime config

Set an API key using one of the following:

- `FIRECRAWL_API_KEY` environment variable
- `apiKey` in plugin options
