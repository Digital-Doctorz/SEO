import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Key, Shield, CheckCircle2, ExternalLink, Network, Puzzle, Cpu, Database, AlertTriangle } from "lucide-react";
import { AiProviderConfig } from "../types";
import {
  AI_PROVIDER_DEFAULTS,
  detectProviderFromKey,
  keyProviderMismatch,
  normalizeAiConfig,
  saveAiConfigToStorage,
  maskApiKey,
  validateCustomProviderConfig,
} from "../lib/aiConfig";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (config: AiProviderConfig) => void;
  currentConfig: AiProviderConfig;
}

const PROVIDER_META = {
  gemini: {
    label: "Gemini",
    desc: "Google AI",
    icon: Cpu,
    defaultModel: AI_PROVIDER_DEFAULTS.gemini.model,
    defaultEndpoint: AI_PROVIDER_DEFAULTS.gemini.endpoint,
    keyPlaceholder: "AIzaSy...",
    keyUrl: "https://aistudio.google.com/apikey",
    keyUrlLabel: "Get Gemini API Key",
  },
  openrouter: {
    label: "OpenRouter",
    desc: "Multi-model gateway",
    icon: Network,
    defaultModel: AI_PROVIDER_DEFAULTS.openrouter.model,
    defaultEndpoint: AI_PROVIDER_DEFAULTS.openrouter.endpoint,
    keyPlaceholder: "sk-or-v1-...",
    keyUrl: "https://openrouter.ai/keys",
    keyUrlLabel: "Get OpenRouter API Key",
  },
  nvidia: {
    label: "NVIDIA",
    desc: "NIM / build.nvidia.com",
    icon: Cpu,
    defaultModel: AI_PROVIDER_DEFAULTS.nvidia.model,
    defaultEndpoint: AI_PROVIDER_DEFAULTS.nvidia.endpoint,
    keyPlaceholder: "nvapi-... or NGC key",
    keyUrl: "https://build.nvidia.com/",
    keyUrlLabel: "Get NVIDIA API Key",
  },
  custom: {
    label: "Custom",
    desc: "OpenAI / Anthropic / NVIDIA / proxy",
    icon: Puzzle,
    defaultModel: AI_PROVIDER_DEFAULTS.custom.model,
    defaultEndpoint: AI_PROVIDER_DEFAULTS.custom.endpoint,
    keyPlaceholder: "Enter your API key",
    keyUrl: "",
    keyUrlLabel: "",
  },
};

export default function SettingsModal({ open, onClose, onSave, currentConfig }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState(currentConfig.apiKey);
  const [provider, setProvider] = useState(currentConfig.provider);
  const [apiEndpoint, setApiEndpoint] = useState(currentConfig.apiEndpoint);
  const [apiModel, setApiModel] = useState(currentConfig.apiModel);
  const [customFormat, setCustomFormat] = useState(currentConfig.customFormat);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dataforseoLogin, setDataforseoLogin] = useState(currentConfig.dataforseoLogin ?? "");
  const [dataforseoPassword, setDataforseoPassword] = useState(currentConfig.dataforseoPassword ?? "");
  const [showDfsKey, setShowDfsKey] = useState(false);

  useEffect(() => {
    if (!open) return;
    setApiKey(currentConfig.apiKey);
    setProvider(currentConfig.provider);
    setApiEndpoint(currentConfig.apiEndpoint);
    setApiModel(currentConfig.apiModel);
    setCustomFormat(currentConfig.customFormat);
    setDataforseoLogin(currentConfig.dataforseoLogin ?? "");
    setDataforseoPassword(currentConfig.dataforseoPassword ?? "");
    setSaveError(null);
    setSaved(false);
  }, [currentConfig, open]);

  const handleProviderChange = (newProvider: AiProviderConfig["provider"]) => {
    // Stash current provider's key in its own slot so switching never loses it
    if (apiKey.trim()) {
      localStorage.setItem(`seo_api_key_${provider}`, apiKey.trim());
      localStorage.setItem(`seo_api_model_${provider}`, apiModel.trim());
      localStorage.setItem(`seo_api_endpoint_${provider}`, apiEndpoint.trim());
    }
    setProvider(newProvider);
    const meta = PROVIDER_META[newProvider];
    const savedKey = localStorage.getItem(`seo_api_key_${newProvider}`) || "";
    const savedModel =
      localStorage.getItem(`seo_api_model_${newProvider}`) || meta.defaultModel;
    const savedEndpoint =
      localStorage.getItem(`seo_api_endpoint_${newProvider}`) || meta.defaultEndpoint;
    setApiKey(savedKey);
    setApiModel(savedModel);
    setApiEndpoint(savedEndpoint);
    if (newProvider === "nvidia") {
      setCustomFormat("nvidia");
    }
    setSaveError(null);
  };

  const handleKeyChange = (value: string) => {
    setApiKey(value);
    setSaveError(null);
    // Auto-switch only when NOT on Custom (custom keys can look like OpenAI sk-...)
    if (provider === "custom") return;
    const detected = detectProviderFromKey(value);
    if (detected && detected !== provider) {
      if (apiKey.trim()) {
        localStorage.setItem(`seo_api_key_${provider}`, apiKey.trim());
      }
      setProvider(detected);
      const meta = PROVIDER_META[detected];
      setApiModel(
        localStorage.getItem(`seo_api_model_${detected}`) || meta.defaultModel
      );
      setApiEndpoint(
        localStorage.getItem(`seo_api_endpoint_${detected}`) || meta.defaultEndpoint
      );
    }
  };

  const handleSave = () => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      setSaveError("Paste your API key before saving.");
      return;
    }

    // Never force Custom → Gemini/OpenRouter; only warn on obvious wrong-key pairs
    let activeProvider = provider;
    const detected = detectProviderFromKey(trimmedKey);
    if (provider !== "custom") {
      if (detected && detected !== provider && provider !== "nvidia") {
        // Auto-switch for Gemini/OpenRouter/NVIDIA key shapes when not on Custom
        if (detected === "gemini" || detected === "openrouter" || detected === "nvidia") {
          activeProvider = detected;
        }
      }
      const mismatch = keyProviderMismatch(activeProvider, trimmedKey);
      if (mismatch && activeProvider === "openrouter" && /^AIza/i.test(trimmedKey)) {
        setSaveError(mismatch);
        return;
      }
      if (mismatch && activeProvider === "gemini" && (/^sk-or/i.test(trimmedKey) || /^nvapi-/i.test(trimmedKey))) {
        setSaveError(mismatch);
        return;
      }
      if (mismatch && activeProvider === "nvidia" && (/^AIza/i.test(trimmedKey) || /^sk-or/i.test(trimmedKey))) {
        setSaveError(mismatch);
        return;
      }
    } else {
      const customErr = validateCustomProviderConfig({
        apiKey: trimmedKey,
        apiEndpoint:
          customFormat === "nvidia" && !apiEndpoint.trim()
            ? AI_PROVIDER_DEFAULTS.nvidia.endpoint
            : apiEndpoint,
        apiModel:
          customFormat === "nvidia" && !apiModel.trim()
            ? AI_PROVIDER_DEFAULTS.nvidia.model
            : apiModel,
        customFormat,
      });
      if (customErr) {
        setSaveError(customErr);
        return;
      }
    }

    const meta = PROVIDER_META[activeProvider];
    let model = apiModel.trim() || meta.defaultModel;
    let endpoint = apiEndpoint.trim() || meta.defaultEndpoint;
    let format: AiProviderConfig["customFormat"] =
      activeProvider === "custom"
        ? customFormat
        : activeProvider === "nvidia"
          ? "nvidia"
          : "openai";

    if (activeProvider === "openrouter") {
      if (!model || /gemini|^models\//i.test(model)) model = meta.defaultModel;
      if (!endpoint || /googleapis|generativelanguage/i.test(endpoint)) {
        endpoint = meta.defaultEndpoint;
      }
      endpoint = endpoint.replace(/\/+$/, "") || meta.defaultEndpoint;
    }
    if (activeProvider === "gemini") {
      if (!model || /llama|claude|openrouter|mistral|nemotron|nvidia/i.test(model))
        model = meta.defaultModel;
      endpoint = "";
    }
    if (activeProvider === "nvidia") {
      if (!model || /gemini|^models\//i.test(model)) model = meta.defaultModel;
      if (!endpoint || /openrouter|googleapis|generativelanguage/i.test(endpoint)) {
        endpoint = meta.defaultEndpoint;
      }
      endpoint = endpoint.replace(/\/+$/, "") || meta.defaultEndpoint;
      format = "nvidia";
    }
    if (activeProvider === "custom") {
      if (customFormat === "nvidia") {
        endpoint =
          apiEndpoint.trim().replace(/\/+$/, "") || AI_PROVIDER_DEFAULTS.nvidia.endpoint;
        model = apiModel.trim() || AI_PROVIDER_DEFAULTS.nvidia.model;
        format = "nvidia";
      } else {
        endpoint = apiEndpoint.trim().replace(/\/+$/, "");
        model = apiModel.trim() || "gpt-4o-mini";
      }
    }

    const config = normalizeAiConfig({
      apiKey: trimmedKey,
      provider: activeProvider,
      apiEndpoint: endpoint,
      apiModel: model,
      customFormat: format,
      dataforseoLogin: dataforseoLogin.trim() || undefined,
      dataforseoPassword: dataforseoPassword.trim() || undefined,
    });

    // Persist immediately so concurrent API calls pick up the right key
    const savedConfig = saveAiConfigToStorage(config);
    onSave(savedConfig);
    setProvider(savedConfig.provider);
    setApiModel(savedConfig.apiModel);
    setApiEndpoint(savedConfig.apiEndpoint);
    setSaveError(null);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1200);
  };

  const handleClear = () => {
    localStorage.setItem(`seo_api_key_${provider}`, "");
    localStorage.removeItem("seo_api_key");
    localStorage.removeItem("seo_dataforseo_login");
    localStorage.removeItem("seo_dataforseo_password");
    setApiKey("");
    setDataforseoLogin("");
    setDataforseoPassword("");
    const cleared = normalizeAiConfig({
      apiKey: "",
      provider,
      apiEndpoint: PROVIDER_META[provider].defaultEndpoint,
      apiModel: PROVIDER_META[provider].defaultModel,
      customFormat,
      dataforseoLogin: undefined,
      dataforseoPassword: undefined,
    });
    saveAiConfigToStorage(cleared);
    onSave(cleared);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1200);
  };

  const meta = PROVIDER_META[provider];
  const Icon = meta.icon;
  const liveMismatch = apiKey.trim() ? keyProviderMismatch(provider, apiKey) : null;
  const detected = detectProviderFromKey(apiKey);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg mx-4 overflow-hidden max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Key className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">API Configuration</h2>
                  <p className="text-xs text-slate-400 font-medium">
                    Active: <span className="text-slate-600 font-bold capitalize">{provider}</span>
                    {currentConfig.apiKey ? (
                      <span className="text-emerald-600 ml-1">· {maskApiKey(currentConfig.apiKey)}</span>
                    ) : (
                      <span className="text-amber-500 ml-1">· no key</span>
                    )}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="bg-blue-50/60 rounded-xl p-4 border border-blue-100 flex items-start gap-3">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-xs text-slate-600 leading-relaxed">
                  <strong className="text-slate-800 block mb-1">Bring your own key (required)</strong>
                  Choose <strong>Gemini</strong>, <strong>OpenRouter</strong>, <strong>NVIDIA</strong> (NIM), or{" "}
                  <strong>Custom</strong> (OpenAI / Anthropic / NVIDIA / proxy). Paste that provider&apos;s API key
                  (and Base URL when needed), then <strong>Save</strong>. Keys stay in your browser only.
                  <span className="block mt-1.5 text-slate-500">
                    <strong className="text-slate-700">Auto-fallback:</strong> save keys for multiple providers —
                    if the active one fails (quota, timeout, invalid), the engine tries your other saved keys automatically.
                  </span>
                </div>
              </div>

              {/* Provider selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">AI Provider</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.entries(PROVIDER_META) as [keyof typeof PROVIDER_META, typeof PROVIDER_META.gemini][]).map(
                    ([id, p]) => {
                      const PIcon = p.icon;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => handleProviderChange(id)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            provider === id
                              ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500/30"
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          }`}
                        >
                          <PIcon
                            className={`h-4 w-4 mb-1 ${provider === id ? "text-blue-600" : "text-slate-400"}`}
                          />
                          <div
                            className={`text-sm font-bold ${provider === id ? "text-blue-700" : "text-slate-700"}`}
                          >
                            {p.label}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5">{p.desc}</div>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* API Key input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {meta.label} API Key
                </label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => handleKeyChange(e.target.value)}
                    placeholder={meta.keyPlaceholder}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full px-4 py-2.5 pr-20 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-mono transition-all"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showKey ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                {detected && detected !== provider && provider !== "custom" && (
                  <p className="text-[11px] text-blue-600 font-medium flex items-start gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    Key looks like{" "}
                    {detected === "openrouter"
                      ? "OpenRouter"
                      : detected === "nvidia"
                        ? "NVIDIA"
                        : "Gemini"}{" "}
                    — provider will auto-switch on save.
                  </p>
                )}
                {liveMismatch && !detected && provider !== "custom" && (
                  <p className="text-[11px] text-amber-600 font-medium flex items-start gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    {liveMismatch}
                  </p>
                )}
              </div>

              {/* Model name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Model</label>
                <input
                  type="text"
                  value={apiModel}
                  onChange={(e) => setApiModel(e.target.value)}
                  placeholder={meta.defaultModel || "e.g. gpt-4o"}
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-mono transition-all"
                />
                {provider === "openrouter" && (
                  <p className="text-[10px] text-slate-400">
                    Free example:{" "}
                    <code className="bg-slate-100 px-1 rounded">meta-llama/llama-3.3-70b-instruct:free</code>. Paid
                    models need OpenRouter credits.
                  </p>
                )}
                {(provider === "nvidia" || (provider === "custom" && customFormat === "nvidia")) && (
                  <p className="text-[10px] text-slate-400">
                    Examples:{" "}
                    <code className="bg-slate-100 px-1 rounded">meta/llama-3.1-70b-instruct</code>,{" "}
                    <code className="bg-slate-100 px-1 rounded">nvidia/llama-3.1-nemotron-70b-instruct</code>,{" "}
                    <code className="bg-slate-100 px-1 rounded">meta/llama-3.3-70b-instruct</code>. Browse models at{" "}
                    <a
                      href="https://build.nvidia.com/models"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      build.nvidia.com
                    </a>
                    .
                  </p>
                )}
              </div>

              {(provider === "openrouter" || provider === "nvidia" || provider === "custom") && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {provider === "custom"
                      ? customFormat === "nvidia"
                        ? "Base URL (defaults to NVIDIA NIM)"
                        : customFormat === "gemini"
                          ? "Base URL (optional for Gemini)"
                          : "Base URL (required)"
                      : "API Endpoint URL"}
                  </label>
                  <input
                    type="text"
                    value={apiEndpoint}
                    onChange={(e) => setApiEndpoint(e.target.value)}
                    placeholder={
                      provider === "openrouter"
                        ? "https://openrouter.ai/api/v1"
                        : provider === "nvidia"
                          ? "https://integrate.api.nvidia.com/v1"
                          : customFormat === "anthropic"
                            ? "https://api.anthropic.com/v1"
                            : customFormat === "gemini"
                              ? "optional custom Gemini base URL"
                              : customFormat === "nvidia"
                                ? "https://integrate.api.nvidia.com/v1"
                                : "https://api.openai.com/v1"
                    }
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-mono transition-all"
                  />
                  {provider === "custom" && (
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      OpenAI / NVIDIA-compatible: base ending in{" "}
                      <code className="bg-slate-100 px-1 rounded">/v1</code> (we call{" "}
                      <code className="bg-slate-100 px-1 rounded">/chat/completions</code>). Anthropic:{" "}
                      <code className="bg-slate-100 px-1 rounded">https://api.anthropic.com/v1</code>. NVIDIA:{" "}
                      <code className="bg-slate-100 px-1 rounded">https://integrate.api.nvidia.com/v1</code>. Also works
                      with Groq, Together, Fireworks, Azure proxies, Ollama/vLLM, etc.
                    </p>
                  )}
                  {provider === "nvidia" && (
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Default NIM endpoint is prefilled. Leave as-is unless you use a private NVIDIA deploy or proxy.
                    </p>
                  )}
                </div>
              )}

              {provider === "custom" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">API Format</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(["openai", "anthropic", "gemini", "nvidia"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => {
                          setCustomFormat(fmt);
                          if (fmt === "nvidia") {
                            if (!apiEndpoint.trim() || /openai\.com|anthropic|openrouter/i.test(apiEndpoint)) {
                              setApiEndpoint(AI_PROVIDER_DEFAULTS.nvidia.endpoint);
                            }
                            if (!apiModel.trim() || /gpt-|claude|gemini/i.test(apiModel)) {
                              setApiModel(AI_PROVIDER_DEFAULTS.nvidia.model);
                            }
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          customFormat === fmt
                            ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500/30"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div
                          className={`text-xs font-bold ${customFormat === fmt ? "text-blue-700" : "text-slate-700"}`}
                        >
                          {fmt === "openai"
                            ? "OpenAI"
                            : fmt === "anthropic"
                              ? "Anthropic"
                              : fmt === "gemini"
                                ? "Gemini"
                                : "NVIDIA"}
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium mt-0.5">
                          {fmt === "openai"
                            ? "/chat/completions"
                            : fmt === "anthropic"
                              ? "/messages"
                              : fmt === "gemini"
                                ? "Gemini SDK"
                                : "NIM /v1"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {saveError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 font-medium flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  {saveError}
                </div>
              )}

              <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1 flex-wrap">
                <span>Need a key?</span>
                {meta.keyUrl && (
                  <a
                    href={meta.keyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
                  >
                    {meta.keyUrlLabel} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              <div className="border-t border-slate-100" />

              {/* DataForSEO Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                    <Database className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Live SEO Data</h3>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Optional — for real search volumes &amp; backlinks
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">DataForSEO Login</label>
                  <input
                    type="text"
                    value={dataforseoLogin}
                    onChange={(e) => setDataforseoLogin(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-mono transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    DataForSEO Password
                  </label>
                  <div className="relative">
                    <input
                      type={showDfsKey ? "text" : "password"}
                      value={dataforseoPassword}
                      onChange={(e) => setDataforseoPassword(e.target.value)}
                      placeholder="Auto-generated API password"
                      className="w-full px-4 py-2.5 pr-20 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-mono transition-all"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => setShowDfsKey(!showDfsKey)}
                        className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showDfsKey ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex items-center justify-between gap-3 sticky bottom-0 bg-white">
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
              >
                Clear Key
              </button>

              <div className="flex items-center gap-2">
                {saved && (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Saved ({provider})
                  </span>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!apiKey.trim()}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    apiKey.trim()
                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                      : "bg-slate-100 text-slate-300 cursor-not-allowed"
                  }`}
                >
                  {saved ? "Saved!" : `Save ${meta.label} Key`}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
