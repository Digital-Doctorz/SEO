import type { AiProviderConfig } from "../types";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 500, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(
      `Server returned ${response.status}: expected JSON response`,
      response.status,
      text.slice(0, 200)
    );
  }
}

/** Typed POST helper for /api/* routes. Always attaches aiConfig when provided. */
export async function postApi<T = unknown>(
  path: string,
  body: Record<string, unknown>,
  options?: { signal?: AbortSignal }
): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  const data = (await parseJsonResponse(response)) as T & {
    error?: string;
    errorMsg?: string;
    fallbackReason?: string;
    needsApiKey?: boolean;
    details?: string;
  };

  if (!response.ok) {
    const msg =
      data?.fallbackReason ||
      data?.errorMsg ||
      data?.error ||
      `Server responded with status ${response.status}`;
    throw new ApiError(msg, response.status, {
      details: data?.details,
      needsApiKey: data?.needsApiKey,
    });
  }

  return data as T;
}

export function withAiConfig(
  payload: Record<string, unknown>,
  aiConfig: AiProviderConfig
): Record<string, unknown> {
  return { ...payload, aiConfig };
}
