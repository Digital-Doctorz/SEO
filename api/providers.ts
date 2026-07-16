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
  provider: "gemini" | "openrouter" | "custom";
  apiEndpoint: string;
  apiModel: string;
  customFormat: "openai" | "anthropic" | "gemini";
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
    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });
    const body: any = {
      model: apiModel || "meta-llama/llama-3.3-70b-instruct:free",
      messages,
      temperature: options?.temperature ?? 0.1,
    };
    if (options?.responseMimeType === "application/json") body.response_format = { type: "json_object" };
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}`, "HTTP-Referer": "http://localhost:3000", "X-Title": "Local SEO App" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`OpenRouter error ${response.status}: ${data.error?.message || JSON.stringify(data)}`);
    const text = data.choices?.[0]?.message?.content || "";
    return { text };
  }

  if (provider === "custom") {
    const format = customFormat || "openai";
    const endpoint = (apiEndpoint || "").replace(/\/+$/, "");
    if (format === "openai") {
      const messages: any[] = [];
      if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
      messages.push({ role: "user", content: prompt });
      const body: any = { model: apiModel, messages, temperature: options?.temperature ?? 0.1 };
      if (options?.responseMimeType === "application/json") body.response_format = { type: "json_object" };
      const response = await fetch(`${endpoint}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(`Custom API error ${response.status}: ${data.error?.message || JSON.stringify(data)}`);
      const text = data.choices?.[0]?.message?.content || "";
      return { text };
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
  return {
    apiKey: rawKey,
    provider: cfg?.provider || "gemini",
    apiEndpoint: (cfg?.apiEndpoint || "").trim(),
    apiModel: (cfg?.apiModel || "").trim(),
    customFormat: cfg?.customFormat || "openai",
  };
}

