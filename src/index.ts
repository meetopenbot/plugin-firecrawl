import {
  agentOutput,
  definePlugin,
  shouldHandleInvoke,
  uiWidget,
  type AgentInvokeEvent,
  type PluginHandlerContext,
  type UIWidgetResponseEvent,
} from "@meetopenbot/plugin-sdk";
import {
  DEFAULT_API_URL,
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MS,
  API_KEY_ENV_VAR,
} from "./constants";
import type { StartAgentResponse, AgentStatusResponse } from "./types";
import {
  resolveApiUrl,
  resolveApiKey,
  isAuthError,
  readEnv,
} from "./utils";
import { firecrawlRequest } from "./client";
import { buildApiKeyWidget } from "./ui";

const plugin = definePlugin({
  name: "Firecrawl",
  description: "Firecrawl agent for web data gathering",
  configSchema: {
    type: "object",
    properties: {
      apiKey: {
        type: "string",
        description: "Firecrawl API key. Falls back to the FIRECRAWL_API_KEY workspace variable.",
        format: "password",
      },
      apiUrl: {
        type: "string",
        description: "Firecrawl API base URL.",
        format: "url",
        default: DEFAULT_API_URL,
      },
    },
  },
  factory: (context) => (builder) => {
    const apiUrl = resolveApiUrl(context.config);
    const getApiKey = () => resolveApiKey(context.config);

    builder.on("agent:invoke", async function* (event: AgentInvokeEvent, ctx: PluginHandlerContext) {
      if (!shouldHandleInvoke(event, context.agentId)) {
        return;
      }

      const { content } = event.data;
      const threadId = event.meta?.threadId ?? ctx.state.threadId;

      if (!content) {
        yield agentOutput({
          agentId: context.agentId,
          content: "No prompt provided.",
          threadId,
        });
        return;
      }

      const apiKey = getApiKey();
      if (!apiKey) {
        yield buildApiKeyWidget(context.agentId, threadId);
        yield agentOutput({
          agentId: context.agentId,
          content: "API key required. Please provide it in the widget.",
          threadId,
        });
        return;
      }

      try {
        yield agentOutput({
          agentId: context.agentId,
          content: "Starting Firecrawl agent...",
          threadId,
        });

        const started = await firecrawlRequest<StartAgentResponse>(apiKey, apiUrl, "/v2/agent", {
          method: "POST",
          body: { prompt: content },
        });

        if (!started?.success || !started.id) {
          const errMsg = started?.error || "Unknown error";
          if (isAuthError(errMsg)) {
            yield buildApiKeyWidget(context.agentId, threadId, errMsg);
            yield agentOutput({
              agentId: context.agentId,
              content: `Authentication failed: ${errMsg}. Please update the API key in the widget.`,
              threadId,
            });
          } else {
            yield agentOutput({
              agentId: context.agentId,
              content: `Error starting Firecrawl agent: ${errMsg}`,
              threadId,
            });
          }
          return;
        }

        yield agentOutput({
          agentId: context.agentId,
          content: `Task created (id: ${started.id}). Waiting for results...`,
          threadId,
        });

        const startTime = Date.now();
        let lastStatus = "";

        while (true) {
          if (Date.now() - startTime > POLL_TIMEOUT_MS) {
            yield agentOutput({
              agentId: context.agentId,
              content: `Timed out after ${Math.round(POLL_TIMEOUT_MS / 1000)}s.`,
              threadId,
            });
            return;
          }

          const status = await firecrawlRequest<AgentStatusResponse>(
            apiKey,
            apiUrl,
            `/v2/agent/${started.id}`
          );

          if (status.status === "completed") {
            yield agentOutput({
              agentId: context.agentId,
              content: "Completed successfully.",
              threadId,
            });
            yield agentOutput({
              agentId: context.agentId,
              content: "```json\n" + JSON.stringify(status.data ?? {}, null, 2) + "\n```",
              threadId,
            });
            return;
          }

          if (status.status === "failed" || status.status === "cancelled") {
            yield agentOutput({
              agentId: context.agentId,
              content: `Agent ${status.status}: ${status.error || "no details provided"}`,
              threadId,
            });
            return;
          }

          if (status.status && status.status !== lastStatus) {
            yield agentOutput({
              agentId: context.agentId,
              content: `Status: ${status.status}...`,
              threadId,
            });
            lastStatus = status.status;
          }

          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Firecrawl request failed.";
        if (isAuthError(message)) {
          yield buildApiKeyWidget(context.agentId, threadId, message);
          yield agentOutput({
            agentId: context.agentId,
            content: `Authentication failed: ${message}. Please update the API key in the widget.`,
            threadId,
          });
        } else {
          yield agentOutput({
            agentId: context.agentId,
            content: `Error: ${message}`,
            threadId,
          });
        }
      }
    });

    builder.on(
      "client:ui:widget:response",
      async function* (event: UIWidgetResponseEvent, handlerCtx: PluginHandlerContext) {
        const { metadata, values, widgetId } = event.data;
        if (!metadata || metadata.type !== "api_key_request" || metadata.source !== "firecrawl") {
          return;
        }

        const apiKey = values?.apiKey;
        if (typeof apiKey !== "string" || !apiKey) {
          return;
        }

        const envVar =
          typeof metadata.envVar === "string" && metadata.envVar.trim()
            ? metadata.envVar
            : API_KEY_ENV_VAR;

        try {
          await context.storage.createVariable({ key: envVar, value: apiKey, secret: true });
          readEnv()[envVar] = apiKey;

          yield uiWidget({
            agentId: context.agentId,
            widget: {
              widgetId,
              kind: "message",
              title: "API Key Saved",
              body: `Saved ${envVar} as a workspace variable. You can now continue the conversation.`,
              state: "submitted",
              actions: [{ id: "ok", label: "Got it", variant: "primary" }],
            },
            meta: { agentId: handlerCtx.state.agentId },
          });

          yield agentOutput({
            agentId: context.agentId,
            content:
              "API key saved to workspace variables. Re-send your last message to retry.",
            meta: { agentId: handlerCtx.state.agentId },
          });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          yield agentOutput({
            agentId: context.agentId,
            content: `Failed to save API key: ${errorMessage}`,
            meta: { agentId: handlerCtx.state.agentId },
          });
        }
      }
    );
  },
});

export default plugin;
