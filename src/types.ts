export type StartAgentResponse = {
  success?: boolean;
  id?: string;
  error?: string;
};

export type AgentStatusResponse = {
  status?: "pending" | "running" | "completed" | "failed" | "cancelled" | string;
  data?: unknown;
  error?: string;
};
