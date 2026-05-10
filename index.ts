import Firecrawl from '@mendable/firecrawl-js';

const buildApiKeyWidget = (agentId: string, threadId: string, reason?: string) => ({
  type: "client:ui:widget",
  data: {
    kind: "form",
    widgetId: `firecrawl_api_key_request_${Date.now()}`,
    title: "Firecrawl API Key Required",
    description: `Firecrawl could not authenticate${reason ? ` (${reason})` : ''}. Provide a Firecrawl API key to continue. The key is stored as a workspace variable on your machine and never leaves your local runtime.`,
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        type: "text",
        placeholder: "fc-...",
        required: true
      }
    ],
    submitLabel: "Save API Key",
    metadata: {
      type: "api_key_request",
      provider: "firecrawl",
      envVar: "FIRECRAWL_API_KEY",
      source: "firecrawl"
    }
  },
  meta: { agentId, threadId }
});

export const firecrawlPlugin = (options: any = {}) => (builder: any) => {
  const { storage } = options;
  const env = globalThis?.process?.env || {};
  
  const getApiKey = () => options.apiKey ?? env.FIRECRAWL_API_KEY;

  let client: Firecrawl | null = null;
  let lastApiKey: string | null = null;
  const getClient = () => {
    const apiKey = getApiKey();
    if (!apiKey) return null;
    if (!client || apiKey !== lastApiKey) {
      client = new Firecrawl({ apiKey });
      lastApiKey = apiKey;
    }
    return client;
  };

  builder.on("agent:invoke", async function* (event: any, ctx: any) {
    const { content } = event.data;
    const threadId = event.meta?.threadId || ctx.state.threadId;

    if (!content) {
      yield { type: "agent:output", data: { content: "No prompt provided." } };
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      yield buildApiKeyWidget(ctx.state.agentId, threadId);
      return;
    }

    try {
      const app = getClient();
      if (!app) {
        yield buildApiKeyWidget(ctx.state.agentId, threadId, "Failed to initialize client");
        return;
      }
      
      yield { type: "agent:output", data: { content: "Starting Firecrawl Agent..." } };

      const result = await app.startAgent({
        prompt: content,
      });

      if (result.success && result.id) {
        yield { type: "agent:output", data: { content: `Firecrawl Agent task created. ID: ${result.id}. Waiting for results...` } };
        
        let status;
        let lastStatus = '';
        
        while (true) {
          status = await app.getAgentStatus(result.id);

          if (status.status === 'completed') {
            yield { type: "agent:output", data: { content: "Firecrawl Agent completed successfully!" } };
            yield { type: "agent:output", data: { content: JSON.stringify(status.data, null, 2) } };
            break;
          } else if (status.status === 'failed') {
            yield { type: "agent:output", data: { content: `Firecrawl Agent failed: ${status.error || 'Unknown error'}` } };
            break;
          } else {
            if (status.status !== lastStatus) {
              yield { type: "agent:output", data: { content: `Status: ${status.status}...` } };
              lastStatus = status.status;
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } else {
        if (result.error?.includes('Unauthorized') || result.error?.includes('API key')) {
          yield buildApiKeyWidget(ctx.state.agentId, threadId, result.error);
        } else {
          yield { type: "agent:output", data: { content: `Error starting Firecrawl Agent: ${result.error || 'Unknown error'}` } };
        }
      }
    } catch (error: any) {
      if (error?.message?.includes('Unauthorized') || error?.message?.includes('API key')) {
        yield buildApiKeyWidget(ctx.state.agentId, threadId, error.message);
      } else {
        yield {
          type: "agent:output",
          data: { content: `Error: ${error?.message || "Firecrawl request failed."}` }
        };
      }
    }
  });

  builder.on("client:ui:widget:response", async function* (event: any, context: any) {
    const { metadata, values, widgetId } = event.data ?? {};
    if (!metadata || metadata.type !== "api_key_request") return;
    if (metadata.source !== "firecrawl") return;

    const apiKey = values?.apiKey;
    if (typeof apiKey !== "string" || !apiKey) return;

    const envVar = typeof metadata.envVar === "string" ? metadata.envVar : "FIRECRAWL_API_KEY";

    if (!storage) {
      yield {
        type: "agent:output",
        data: { content: "[firecrawl] no storage available; cannot persist API key." },
        meta: { agentId: context.state.agentId }
      };
      return;
    }

    try {
      await storage.createVariable({ key: envVar, value: apiKey, secret: true });
      env[envVar] = apiKey;
      
      yield {
        type: "client:ui:widget",
        data: {
          widgetId,
          kind: "message",
          title: "API Key Saved",
          body: `Saved ${envVar} as a workspace variable. You can now continue the conversation.`,
          state: "submitted",
          actions: [{ id: "ok", label: "Got it", variant: "primary" }]
        },
        meta: { agentId: context.state.agentId }
      };

      yield {
        type: "agent:output",
        data: {
          content: `Saved Firecrawl API key to workspace variables. Re-send your last message to retry.`
        },
        meta: { agentId: context.state.agentId }
      };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      yield {
        type: "agent:output",
        data: { content: `[firecrawl] failed to save API key: ${errorMessage}` },
        meta: { agentId: context.state.agentId }
      };
    }
  });
};

export const plugin = {
  id: "firecrawl",
  name: "Firecrawl",
  description: "Firecrawl agent for web data gathering",
  kind: "runtime",
  factory: (options: any) => firecrawlPlugin(options)
};
