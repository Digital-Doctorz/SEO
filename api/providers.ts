import { GoogleGenAI } from "@google/genai";
async function generateContentWithFallback(
  ai: GoogleGenAI,
  contents: string | any[],
  config: any,
  defaultModel: string = "gemini-2.5-flash"
): Promise<any> {
  const modelsToTry = Array.from(new Set([
    defaultModel, "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"
  ]));
  let lastError: any = null;
  for (const model of modelsToTry) {
    let retries = 2;
    let delay = 1000;
    while (retries >= 0) {
      try {
        console.log(`[Gemini] Attempting model: "${model}"`);
        const response = await ai.models.generateContent({ model, contents, config });
        if (response && response.text) {
          console.log(`[Gemini] Success with model: "${model}"`);
          return response;
        }
        throw new Error(`Empty response from model ${model}`);
      } catch (err: any) {
        lastError = err;
        const isQuota = err.message && (
          err.message.toLowerCase().includes("quota") ||
          err.message.toLowerCase().includes("resource_exhausted") ||
          err.message.toLowerCase().includes("billing") ||
          err.message.toLowerCase().includes("exceeded") ||
          err.message.toLowerCase().includes("limit")
        ) && !err.message.toLowerCase().includes("rate limit exceeded");
        if (retries > 0 && !isQuota && (err.status === 503 || err.status === 429 || err.message?.includes("experiencing high demand") || err.message?.includes("Spikes in demand"))) {
          console.log(`[Gemini] Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
          retries--;
        } else {
          console.log(`[Gemini] Hard error for "${model}", trying next model`);
          break;
        }
      }
    }
  }
  throw lastError || new Error("All fallback models failed.");
}

// ============================================================
// AI Provider Abstraction
// ============================================================
export interface ProviderConfig {
  apiKey: string;
  provider: "gemini" | "openrouter" | "nvidia" | "custom";
  apiEndpoint: string;
  apiModel: string;
  customFormat: "openai" | "anthropic" | "gemini" | "nvidia";
}

const NVIDIA_ENDPOINT = "https://integrate.api.nvidia.com/v1";
const NVIDIA_MODEL = "meta/llama-3.1-70b-instruct";

async function callOpenAiCompatible(
  apiKey: string,
  endpoint: string,
  model: string,
  prompt: string,
  systemPrompt: string | undefined,
  options?: { responseMimeType?: string; temperature?: number },
  label = "API"
): Promise<{ text: string }> {
  const base = (endpoint || "").replace(/\/+$/, "");
  const chatUrl = /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  const wantJson = options?.responseMimeType === "application/json";
  messages.push({
    role: "user",
    content: wantJson
      ? `${prompt}\n\nIMPORTANT: Respond with ONLY a valid JSON object. No markdown fences.`
      : prompt,
  });
  const body: any = {
    model,
    messages,
    temperature: options?.temperature ?? 0.1,
    max_tokens: 8192,
    stream: false,
  };
  if (wantJson && !label.includes("NVIDIA")) {
    try {
      body.response_format = { type: "json_object" };
    } catch {
      /* ignore */
    }
  }
  const response = await fetch(chatUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `${label} error ${response.status}: ${data?.error?.message || JSON.stringify(data).slice(0, 280)}`
    );
  }
  const text = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || "";
  return { text: String(text) };
}

export async function callAI(
  config: ProviderConfig,
  prompt: string,
  systemPrompt?: string,
  options?: { responseMimeType?: string; temperature?: number; tools?: any[] }
): Promise<any> {
  const { apiKey, provider, apiEndpoint, apiModel, customFormat } = config;

  if (provider === "gemini") {
    const client = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
    const model = apiModel || "gemini-2.5-flash";
    const genConfig: any = { ...options };
    if (systemPrompt) genConfig.systemInstruction = { parts: [{ text: systemPrompt }] };
    return generateContentWithFallback(client, prompt, genConfig, model);
  }

  if (provider === "openrouter") {
    const endpoint = (apiEndpoint || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
    return callOpenAiCompatible(
      apiKey,
      endpoint,
      apiModel || "meta-llama/llama-3.3-70b-instruct:free",
      prompt,
      systemPrompt,
      options,
      "OpenRouter"
    );
  }

  if (provider === "nvidia" || customFormat === "nvidia") {
    let endpoint = (apiEndpoint || NVIDIA_ENDPOINT).replace(/\/+$/, "");
    if (/integrate\.api\.nvidia\.com$/i.test(endpoint)) endpoint = `${endpoint}/v1`;
    return callOpenAiCompatible(
      apiKey,
      endpoint,
      apiModel || NVIDIA_MODEL,
      prompt,
      systemPrompt,
      options,
      "NVIDIA"
    );
  }

  if (provider === "custom") {
    const format = customFormat || "openai";
    const endpoint = (apiEndpoint || "").replace(/\/+$/, "");
    if (format === "openai" || format === "nvidia") {
      const ep =
        format === "nvidia"
          ? endpoint || NVIDIA_ENDPOINT
          : endpoint;
      return callOpenAiCompatible(
        apiKey,
        ep,
        apiModel || (format === "nvidia" ? NVIDIA_MODEL : "gpt-4o-mini"),
        prompt,
        systemPrompt,
        options,
        format === "nvidia" ? "NVIDIA" : "Custom API"
      );
    }
    if (format === "anthropic") {
      const body: any = { model: apiModel, messages: [{ role: "user", content: prompt }], max_tokens: 4096, temperature: options?.temperature ?? 0.1 };
      const headers: Record<string, string> = { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
      const response = await fetch(`${endpoint}/messages`, { method: "POST", headers, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(`Anthropic API error ${response.status}: ${data.error?.message || JSON.stringify(data)}`);
      const text = data.content?.[0]?.text || "";
      return { text };
    }
    if (format === "gemini") {
      const client = new GoogleGenAI({ apiKey, ...(endpoint ? { baseUrl: endpoint } : {}), httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
      const model = apiModel || "gemini-2.5-flash";
      const genConfig: any = { ...options };
      if (systemPrompt) genConfig.systemInstruction = { parts: [{ text: systemPrompt }] };
      const response = await client.models.generateContent({ model, contents: prompt, config: genConfig });
      return response;
    }
  }
  throw new Error(`Unknown provider: ${provider}`);
}

/** BYOK only — never read process.env for AI keys. */
export function getProviderConfig(req: { body?: { aiConfig?: Partial<ProviderConfig> } }): ProviderConfig | null {
  const cfg = req.body?.aiConfig;
  const rawKey = typeof cfg?.apiKey === "string" ? cfg.apiKey.trim() : "";
  if (!rawKey || rawKey.length < 8) return null;
  const lower = rawKey.toLowerCase();
  if (lower.includes("placeholder") || lower === "my_gemini_api_key") return null;
  let provider = (cfg?.provider || "gemini") as ProviderConfig["provider"];
  if (provider === "nvidia" || /^nvapi-/i.test(rawKey)) provider = "nvidia";
  let customFormat = (cfg?.customFormat || "openai") as ProviderConfig["customFormat"];
  if (provider === "nvidia") customFormat = "nvidia";
  let apiEndpoint = (cfg?.apiEndpoint || "").trim();
  let apiModel = (cfg?.apiModel || "").trim();
  if (provider === "nvidia") {
    if (!apiEndpoint) apiEndpoint = NVIDIA_ENDPOINT;
    if (!apiModel) apiModel = NVIDIA_MODEL;
  }
  if (customFormat === "nvidia" && !apiEndpoint) apiEndpoint = NVIDIA_ENDPOINT;
  return {
    apiKey: rawKey,
    provider,
    apiEndpoint,
    apiModel,
    customFormat,
  };
}

