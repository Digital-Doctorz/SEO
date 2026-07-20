import type { AiProviderConfig } from "../types";
import { resolveAiConfig } from "./aiConfig";

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

/**
 * Typed POST helper for /api/* routes.
 * Always attaches the latest saved AI key from Settings (localStorage) so
 * analyze, blog, social, and keyword tools all use real BYOK credentials.
 */
export async function postApi<T = unknown>(
  path: string,
  body: Record<string, unknown>,
  options?: { signal?: AbortSignal }
): Promise<T> {
  const fromBody =
    body.aiConfig && typeof body.aiConfig === "object"
      ? (body.aiConfig as Partial<AiProviderConfig>)
      : null;
  // Prefer explicit body config, else storage — never drop a valid key
  const live = resolveAiConfig(fromBody) || resolveAiConfig(null);
  // DataForSEO credentials: body → live resolve → localStorage (always pass when present)
  const storedLogin =
    typeof window !== "undefined"
      ? localStorage.getItem("seo_dataforseo_login") || undefined
      : undefined;
  const storedPassword =
    typeof window !== "undefined"
      ? localStorage.getItem("seo_dataforseo_password") || undefined
      : undefined;
  const dfsLogin =
    fromBody?.dataforseoLogin || live?.dataforseoLogin || storedLogin || undefined;
  const dfsPassword =
    fromBody?.dataforseoPassword || live?.dataforseoPassword || storedPassword || undefined;

  const payload: Record<string, unknown> = {
    ...body,
    // Keep DataForSEO / geo fields so live SEO endpoints always receive BYOK creds
    aiConfig: live
      ? {
          ...live,
          ...(dfsLogin && dfsPassword
            ? { dataforseoLogin: dfsLogin, dataforseoPassword: dfsPassword }
            : {}),
          ...(fromBody?.locationCode != null ? { locationCode: fromBody.locationCode } : {}),
          ...(fromBody?.languageCode ? { languageCode: fromBody.languageCode } : {}),
        }
      : fromBody
        ? {
            ...fromBody,
            ...(dfsLogin && dfsPassword
              ? { dataforseoLogin: dfsLogin, dataforseoPassword: dfsPassword }
              : {}),
          }
        : dfsLogin && dfsPassword
          ? { dataforseoLogin: dfsLogin, dataforseoPassword: dfsPassword }
          : undefined,
  };

  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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
  return { ...payload, aiConfig: resolveAiConfig(aiConfig) || aiConfig };
}
