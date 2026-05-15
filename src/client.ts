export async function firecrawlRequest<T>(
  apiKey: string,
  apiUrl: string,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" }
): Promise<T> {
  const res = await fetch(`${apiUrl.replace(/\/$/, "")}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const errorPayload = payload as { error?: string; message?: string } | null;
    const message =
      errorPayload?.error ||
      errorPayload?.message ||
      `Firecrawl request failed (${res.status} ${res.statusText})`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  return payload as T;
}
