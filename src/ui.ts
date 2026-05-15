import { uiWidget } from "@meetopenbot/plugin-sdk";
import { API_KEY_ENV_VAR } from "./constants";

export const buildApiKeyWidget = (agentId: string, threadId: string | undefined, reason?: string) =>
  uiWidget({
    agentId,
    threadId,
    widget: {
      kind: "form",
      widgetId: `firecrawl_api_key_request_${Date.now()}`,
      title: "Firecrawl API Key Required",
      description: `Firecrawl could not authenticate${reason ? ` (${reason})` : ""}. Provide a Firecrawl API key to continue. The key is stored as a workspace variable on your machine and never leaves your local runtime.`,
      fields: [
        {
          id: "apiKey",
          label: "API Key",
          type: "text",
          placeholder: "fc-...",
          required: true,
        },
      ],
      submitLabel: "Save API Key",
      metadata: {
        type: "api_key_request",
        provider: "firecrawl",
        envVar: API_KEY_ENV_VAR,
        source: "firecrawl",
      },
    },
  });
