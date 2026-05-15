import { API_KEY_ENV_VAR, DEFAULT_API_URL } from "./constants";

export const readEnv = (): Record<string, string | undefined> =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

export const resolveApiUrl = (config: Record<string, unknown>): string => {
  const configured = config.apiUrl;
  if (typeof configured === "string" && configured.trim()) {
    return configured.trim();
  }

  const envUrl = readEnv().FIRECRAWL_API_URL;
  return envUrl?.trim() || DEFAULT_API_URL;
};

export const resolveApiKey = (config: Record<string, unknown>): string | undefined => {
  const configured = config.apiKey;
  if (typeof configured === "string" && configured.trim()) {
    return configured.trim();
  }

  const envKey = readEnv()[API_KEY_ENV_VAR];
  return envKey?.trim() || undefined;
};

export const isAuthError = (message?: string) =>
  !!message && (/unauthor/i.test(message) || /api[\s-]?key/i.test(message) || /401|403/.test(message));
