import type { AiProviderConfig } from "../types";

export const AI_PROVIDER_DEFAULTS: Record<
  AiProviderConfig["provider"],
  { model: string; endpoint: string }
> = {
  gemini: { model: "gemini-2.5-flash", endpoint: "" },
  openrouter: {
    model: "meta-llama/llama-3.3-70b-instruct:free",
    endpoint: "https://openrouter.ai/api/v1",
  },
  /** NVIDIA NIM / build.nvidia.com — OpenAI-compatible */
  nvidia: {
    model: "meta/llama-3.3-70b-instruct",
    endpoint: "https://integrate.api.nvidia.com/v1",
  },
  custom: { model: "gpt-4o-mini", endpoint: "" },
};

const PROVIDERS: AiProviderConfig["provider"][] = [
  "gemini",
  "openrouter",
  "nvidia",
  "custom",
];

/** Infer provider from API key shape when user pastes a key without switching tabs. */
export function detectProviderFromKey(apiKey: string): AiProviderConfig["provider"] | null {
  const k = (apiKey || "").trim();
  if (!k) return null;
  if (/^sk-or-v1-/i.test(k) || /^sk-or-/i.test(k)) return "openrouter";
  if (/^AIza[0-9A-Za-z_\-]{10,}/.test(k)) return "gemini";
  // NVIDIA NGC / NIM keys often look like nvapi-...
  if (/^nvapi-/i.test(k)) return "nvidia";
  // OpenAI-style keys used with OpenRouter or custom OpenAI-compatible endpoints
  if (/^sk-[A-Za-z0-9]{20,}/.test(k) && !/^sk-or/i.test(k)) return null;
  return null;
}

export function normalizeProvider(
  raw: unknown,
  apiKey = ""
): AiProviderConfig["provider"] {
  const p = String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "");
  if (p === "openrouter" || p === "open-router" || p === "or") return "openrouter";
  if (p === "nvidia" || p === "nim" || p === "nvidianim" || p === "ngc") return "nvidia";
  if (p === "custom" || p === "openai" || p === "anthropic") return "custom";
  if (p === "gemini" || p === "google" || p === "googleai") return "gemini";
  const detected = detectProviderFromKey(apiKey);
  if (detected) return detected;
  return "gemini";
}

export function normalizeCustomFormat(
  raw: unknown
): AiProviderConfig["customFormat"] {
  const f = String(raw || "")
    .toLowerCase()
    .trim();
  if (f === "anthropic" || f === "claude") return "anthropic";
  if (f === "gemini" || f === "google") return "gemini";
  if (f === "nvidia" || f === "nim" || f === "ngc") return "nvidia";
  return "openai";
}

/** True when key shape clearly does not match the selected provider. */
export function keyProviderMismatch(
  provider: AiProviderConfig["provider"],
  apiKey: string
): string | null {
  const k = (apiKey || "").trim();
  if (!k) return "API key is empty.";
  if (provider === "openrouter") {
    if (/^AIza/i.test(k)) {
      return "This looks like a Gemini key (starts with AIza). Switch provider to Gemini, or paste an OpenRouter key (sk-or-v1-...).";
    }
    if (/^nvapi-/i.test(k)) {
      return "This looks like an NVIDIA key (nvapi-...). Switch provider to NVIDIA, or paste an OpenRouter key.";
    }
    if (!/^sk-/i.test(k) && k.length < 20) {
      return "OpenRouter keys usually start with sk-or-v1-. Check that you copied the full key.";
    }
  }
  if (provider === "gemini") {
    if (/^sk-or/i.test(k)) {
      return "This looks like an OpenRouter key. Switch provider to OpenRouter, or paste a Gemini key from Google AI Studio.";
    }
    if (/^nvapi-/i.test(k)) {
      return "This looks like an NVIDIA key. Switch provider to NVIDIA, or paste a Gemini key.";
    }
  }
  if (provider === "nvidia") {
    if (/^AIza/i.test(k)) {
      return "This looks like a Gemini key. Switch provider to Gemini, or paste an NVIDIA key from build.nvidia.com.";
    }
    if (/^sk-or/i.test(k)) {
      return "This looks like an OpenRouter key. Switch provider to OpenRouter, or paste an NVIDIA API key.";
    }
  }
  return null;
}

export function isValidApiKeyShape(apiKey: string): boolean {
  const k = (apiKey || "").trim();
  if (k.length < 12) return false;
  const lower = k.toLowerCase();
  if (
    lower.includes("your") ||
    lower.includes("placeholder") ||
    lower === "xxx" ||
    lower === "my_gemini_api_key" ||
    lower === "paste_key_here"
  ) {
    return false;
  }
  return true;
}

export function normalizeAiConfig(
  partial: Partial<AiProviderConfig> | null | undefined
): AiProviderConfig {
  const apiKey = typeof partial?.apiKey === "string" ? partial.apiKey.trim() : "";
  // Explicit "custom" / "nvidia" always wins — never re-route by key shape
  const rawProvider = String(partial?.provider || "")
    .toLowerCase()
    .trim();
  let provider = normalizeProvider(partial?.provider, apiKey);
  if (rawProvider === "custom") {
    provider = "custom";
  } else if (rawProvider === "nvidia" || rawProvider === "nim") {
    provider = "nvidia";
  } else {
    const detected = detectProviderFromKey(apiKey);
    if (
      detected &&
      detected !== provider &&
      (detected === "openrouter" || detected === "gemini" || detected === "nvidia")
    ) {
      provider = detected;
    }
  }

  const defaults = AI_PROVIDER_DEFAULTS[provider];
  let apiModel = (partial?.apiModel || "").trim();
  let apiEndpoint = (partial?.apiEndpoint || "").trim();

  let customFormat = normalizeCustomFormat(partial?.customFormat);
  // First-class NVIDIA provider uses nvidia format under the hood
  if (provider === "nvidia") {
    customFormat = "nvidia";
  }

  if (provider === "openrouter") {
    if (!apiModel || /gemini|^models\//i.test(apiModel)) {
      apiModel = defaults.model;
    }
    if (!apiEndpoint || /generativelanguage|googleapis/i.test(apiEndpoint)) {
      apiEndpoint = defaults.endpoint;
    }
    apiEndpoint = apiEndpoint.replace(/\/+$/, "");
    if (!apiEndpoint.endsWith("/api/v1") && apiEndpoint.includes("openrouter.ai")) {
      apiEndpoint = "https://openrouter.ai/api/v1";
    }
  }
  if (provider === "gemini") {
    if (!apiModel || /llama|claude|openrouter|mistral|nemotron|nvidia/i.test(apiModel)) {
      apiModel = defaults.model;
    }
    apiEndpoint = "";
  }
  if (provider === "nvidia") {
    if (!apiModel || /gemini|^models\//i.test(apiModel)) {
      apiModel = defaults.model;
    }
    if (!apiEndpoint || /openrouter|googleapis|generativelanguage/i.test(apiEndpoint)) {
      apiEndpoint = defaults.endpoint;
    }
    apiEndpoint = apiEndpoint
      .replace(/\/+$/, "")
      .replace(/\/chat\/completions$/i, "");
    // Ensure /v1 suffix for integrate.api.nvidia.com
    if (/integrate\.api\.nvidia\.com$/i.test(apiEndpoint)) {
      apiEndpoint = `${apiEndpoint}/v1`;
    }
    if (
      /nvidia\.com/i.test(apiEndpoint) &&
      !/\/v1$/i.test(apiEndpoint) &&
      !/\/v1\//i.test(apiEndpoint)
    ) {
      apiEndpoint = `${apiEndpoint.replace(/\/+$/, "")}/v1`;
    }
  }
  if (provider === "custom") {
    if (!apiModel) {
      apiModel =
        customFormat === "nvidia"
          ? AI_PROVIDER_DEFAULTS.nvidia.model
          : defaults.model;
    }
    apiEndpoint = apiEndpoint
      .replace(/\/+$/, "")
      .replace(/\/chat\/completions$/i, "")
      .replace(/\/messages$/i, "");
    if (customFormat === "openai" && apiEndpoint && /openai\.com$/i.test(apiEndpoint)) {
      apiEndpoint = `${apiEndpoint}/v1`;
    }
    if (customFormat === "nvidia") {
      if (!apiEndpoint) {
        apiEndpoint = AI_PROVIDER_DEFAULTS.nvidia.endpoint;
      }
      apiEndpoint = apiEndpoint.replace(/\/+$/, "");
      if (/integrate\.api\.nvidia\.com$/i.test(apiEndpoint)) {
        apiEndpoint = `${apiEndpoint}/v1`;
      }
      if (
        /nvidia\.com/i.test(apiEndpoint) &&
        !/\/v1$/i.test(apiEndpoint) &&
        !/\/v1\//i.test(apiEndpoint)
      ) {
        apiEndpoint = `${apiEndpoint}/v1`;
      }
    }
  }

  // Prefer explicit partial credentials; never silently drop a login that was set
  const dataforseoLogin =
    (typeof partial?.dataforseoLogin === "string" && partial.dataforseoLogin.trim()) ||
    undefined;
  const dataforseoPassword =
    (typeof partial?.dataforseoPassword === "string" && partial.dataforseoPassword.trim()) ||
    undefined;

  return {
    apiKey,
    provider,
    apiEndpoint,
    apiModel,
    customFormat,
    dataforseoLogin,
    dataforseoPassword,
    locationCode: partial?.locationCode,
    languageCode: partial?.languageCode,
  };
}

export function loadAiConfigFromStorage(): AiProviderConfig {
  if (typeof window === "undefined" || !window.localStorage) {
    return normalizeAiConfig({ provider: "gemini", apiKey: "" });
  }
  try {
    const rawProvider = localStorage.getItem("seo_api_provider") || "gemini";
    const provider = normalizeProvider(rawProvider);
    const defaults = AI_PROVIDER_DEFAULTS[provider];

    let apiKey =
      localStorage.getItem(`seo_api_key_${provider}`) ||
      localStorage.getItem("seo_api_key") ||
      "";

    let apiModel =
      localStorage.getItem(`seo_api_model_${provider}`) ||
      localStorage.getItem("seo_api_model") ||
      defaults.model;
    let apiEndpoint =
      localStorage.getItem(`seo_api_endpoint_${provider}`) ||
      localStorage.getItem("seo_api_endpoint") ||
      defaults.endpoint;

    const customFormat = normalizeCustomFormat(
      localStorage.getItem("seo_api_custom_format") || "openai"
    );

    return normalizeAiConfig({
      apiKey,
      provider,
      apiModel,
      apiEndpoint,
      customFormat,
      dataforseoLogin: localStorage.getItem("seo_dataforseo_login") || undefined,
      dataforseoPassword: localStorage.getItem("seo_dataforseo_password") || undefined,
    });
  } catch {
    return normalizeAiConfig({ provider: "gemini", apiKey: "" });
  }
}

export function loadAllAiConfigsFromStorage(): AiProviderConfig[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }
  const allConfigs: AiProviderConfig[] = [];
  try {
    for (const provider of PROVIDERS) {
      let apiKey =
        localStorage.getItem(`seo_api_key_${provider}`) ||
        (provider === "gemini" ? localStorage.getItem("seo_api_key") : "");
      
      if (!apiKey) continue;

      const defaults = AI_PROVIDER_DEFAULTS[provider];
      let apiModel = localStorage.getItem(`seo_api_model_${provider}`) || defaults.model;
      let apiEndpoint = localStorage.getItem(`seo_api_endpoint_${provider}`) || defaults.endpoint;
      
      let customFormat = "openai";
      if (provider === "custom") {
        customFormat = localStorage.getItem("seo_api_custom_format") || "openai";
      }

      allConfigs.push(normalizeAiConfig({
        apiKey,
        provider,
        apiModel,
        apiEndpoint,
        customFormat: normalizeCustomFormat(customFormat),
      }));
    }
    return allConfigs.filter(c => c.apiKey && isValidApiKeyShape(c.apiKey));
  } catch {
    return [];
  }
}

export function saveAiConfigToStorage(config: AiProviderConfig): AiProviderConfig {
  const normalized = normalizeAiConfig(config);
  if (typeof window === "undefined" || !window.localStorage) return normalized;

  localStorage.setItem("seo_api_provider", normalized.provider);
  localStorage.setItem(`seo_api_key_${normalized.provider}`, normalized.apiKey);
  localStorage.setItem("seo_api_key", normalized.apiKey);
  localStorage.setItem(`seo_api_model_${normalized.provider}`, normalized.apiModel);
  localStorage.setItem("seo_api_model", normalized.apiModel);
  localStorage.setItem(`seo_api_endpoint_${normalized.provider}`, normalized.apiEndpoint);
  localStorage.setItem("seo_api_endpoint", normalized.apiEndpoint);
  localStorage.setItem("seo_api_custom_format", normalized.customFormat);

  if (normalized.dataforseoLogin) {
    localStorage.setItem("seo_dataforseo_login", normalized.dataforseoLogin);
  } else {
    localStorage.removeItem("seo_dataforseo_login");
  }
  if (normalized.dataforseoPassword) {
    localStorage.setItem("seo_dataforseo_password", normalized.dataforseoPassword);
  } else {
    localStorage.removeItem("seo_dataforseo_password");
  }

  return normalized;
}

/**
 * Prefer live React state, fall back to localStorage so blog/analyze always
 * send the key the user last saved — even if a component has a stale prop.
 */
export function resolveAiConfig(
  override?: Partial<AiProviderConfig> | null
): AiProviderConfig | undefined {
  const stored = loadAiConfigFromStorage();
  const explicitProvider =
    override?.provider !== undefined && String(override.provider).trim()
      ? override.provider
      : stored.provider;
  const merged = normalizeAiConfig({
    ...stored,
    ...(override || {}),
    apiKey:
      override?.apiKey !== undefined && String(override.apiKey).trim()
        ? String(override.apiKey).trim()
        : stored.apiKey,
    provider: explicitProvider,
    apiEndpoint:
      override?.apiEndpoint !== undefined
        ? String(override.apiEndpoint).trim()
        : stored.apiEndpoint,
    apiModel:
      override?.apiModel !== undefined && String(override.apiModel).trim()
        ? String(override.apiModel).trim()
        : stored.apiModel,
    customFormat: override?.customFormat || stored.customFormat,
    // Always keep DataForSEO BYOK from override or storage so live SEO stays synced
    dataforseoLogin:
      (override?.dataforseoLogin !== undefined && String(override.dataforseoLogin).trim()) ||
      stored.dataforseoLogin,
    dataforseoPassword:
      (override?.dataforseoPassword !== undefined && String(override.dataforseoPassword).trim()) ||
      stored.dataforseoPassword,
    locationCode:
      override?.locationCode !== undefined ? override.locationCode : stored.locationCode,
    languageCode:
      override?.languageCode !== undefined ? override.languageCode : stored.languageCode,
  });

  if (!merged.apiKey || !isValidApiKeyShape(merged.apiKey)) {
    return undefined;
  }
  // Custom OpenAI/Anthropic/NVIDIA-compatible providers MUST have a base URL
  // (NVIDIA first-class always has a default endpoint after normalize)
  if (merged.provider === "custom") {
    if (merged.customFormat !== "gemini" && !merged.apiEndpoint.trim()) {
      return undefined;
    }
  }
  if (merged.provider === "nvidia" && !merged.apiEndpoint.trim()) {
    return undefined;
  }
  return merged;
}

/** Validate custom provider fields for Settings UI. */
export function validateCustomProviderConfig(cfg: {
  apiKey: string;
  apiEndpoint: string;
  apiModel: string;
  customFormat: AiProviderConfig["customFormat"];
}): string | null {
  if (!cfg.apiKey.trim() || !isValidApiKeyShape(cfg.apiKey)) {
    return "Paste a valid API key for your custom provider.";
  }
  if (!cfg.apiModel.trim()) {
    return "Enter a model id (e.g. gpt-4o-mini, meta/llama-3.1-70b-instruct, claude-3-5-sonnet-latest).";
  }
  // NVIDIA format can omit Base URL — we default to integrate.api.nvidia.com/v1
  if (cfg.customFormat !== "gemini" && cfg.customFormat !== "nvidia" && !cfg.apiEndpoint.trim()) {
    return "Custom providers need a Base URL (e.g. https://api.openai.com/v1, https://integrate.api.nvidia.com/v1, or your proxy /v1).";
  }
  if (cfg.apiEndpoint.trim() && !/^https?:\/\//i.test(cfg.apiEndpoint.trim())) {
    return "Base URL must start with https:// (or http:// for local).";
  }
  return null;
}

export function maskApiKey(apiKey: string): string {
  const k = (apiKey || "").trim();
  if (k.length < 12) return k ? "••••" : "";
  return `${k.slice(0, 6)}…${k.slice(-4)}`;
}
