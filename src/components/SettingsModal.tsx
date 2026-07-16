import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Key, Shield, CheckCircle2, ExternalLink, Network, Puzzle, Cpu, Database } from "lucide-react";
import { AiProviderConfig } from "../types";

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
    defaultModel: "gemini-2.5-flash",
    defaultEndpoint: "",
    keyPlaceholder: "AIzaSy...",
    keyUrl: "https://aistudio.google.com/apikey",
    keyUrlLabel: "Get Gemini API Key"
  },
  openrouter: {
    label: "OpenRouter",
    desc: "Multi-model gateway",
    icon: Network,
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
    defaultEndpoint: "https://openrouter.ai/api/v1",
    keyPlaceholder: "sk-or-v1-...",
    keyUrl: "https://openrouter.ai/keys",
    keyUrlLabel: "Get OpenRouter API Key"
  },
  custom: {
    label: "Custom",
    desc: "Your own endpoint",
    icon: Puzzle,
    defaultModel: "gpt-4o-mini",
    defaultEndpoint: "",
    keyPlaceholder: "Enter your API key",
    keyUrl: "",
    keyUrlLabel: ""
  }
};

export default function SettingsModal({ open, onClose, onSave, currentConfig }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState(currentConfig.apiKey);
  const [provider, setProvider] = useState(currentConfig.provider);
  const [apiEndpoint, setApiEndpoint] = useState(currentConfig.apiEndpoint);
  const [apiModel, setApiModel] = useState(currentConfig.apiModel);
  const [customFormat, setCustomFormat] = useState(currentConfig.customFormat);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [dataforseoLogin, setDataforseoLogin] = useState(currentConfig.dataforseoLogin ?? "");
  const [dataforseoPassword, setDataforseoPassword] = useState(currentConfig.dataforseoPassword ?? "");
  const [showDfsKey, setShowDfsKey] = useState(false);

  useEffect(() => {
    setApiKey(currentConfig.apiKey);
    setProvider(currentConfig.provider);
    setApiEndpoint(currentConfig.apiEndpoint);
    setApiModel(currentConfig.apiModel);
    setCustomFormat(currentConfig.customFormat);
    setDataforseoLogin(currentConfig.dataforseoLogin ?? "");
    setDataforseoPassword(currentConfig.dataforseoPassword ?? "");
  }, [currentConfig, open]);

  const handleProviderChange = (newProvider: "gemini" | "openrouter" | "custom") => {
    localStorage.setItem(`seo_api_key_${provider}`, apiKey);
    setProvider(newProvider);
    const meta = PROVIDER_META[newProvider];
    setApiEndpoint(meta.defaultEndpoint);
    setApiModel(meta.defaultModel);
    const savedKey = localStorage.getItem(`seo_api_key_${newProvider}`) || "";
    setApiKey(savedKey);
  };

  const handleSave = () => {
    localStorage.setItem(`seo_api_key_${provider}`, apiKey.trim());
    if (dataforseoLogin.trim()) localStorage.setItem("seo_dataforseo_login", dataforseoLogin.trim());
    if (dataforseoPassword.trim()) localStorage.setItem("seo_dataforseo_password", dataforseoPassword.trim());
    onSave({
      apiKey: apiKey.trim(),
      provider,
      apiEndpoint: apiEndpoint.trim(),
      apiModel: apiModel.trim(),
      customFormat,
      dataforseoLogin: dataforseoLogin.trim() || undefined,
      dataforseoPassword: dataforseoPassword.trim() || undefined,
    });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1200);
  };

  const handleClear = () => {
    localStorage.setItem(`seo_api_key_${provider}`, "");
    localStorage.removeItem("seo_dataforseo_login");
    localStorage.removeItem("seo_dataforseo_password");
    setApiKey("");
    setDataforseoLogin("");
    setDataforseoPassword("");
    onSave({
      apiKey: "",
      provider,
      apiEndpoint: PROVIDER_META[provider].defaultEndpoint,
      apiModel: PROVIDER_META[provider].defaultModel,
      customFormat,
      dataforseoLogin: undefined,
      dataforseoPassword: undefined,
    });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1200);
  };

  const meta = PROVIDER_META[provider];
  const Icon = meta.icon;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg mx-4 overflow-hidden"
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Key className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">API Configuration</h2>
                  <p className="text-xs text-slate-400 font-medium">Connect your AI provider to run live analysis</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Info box */}
              <div className="bg-blue-50/60 rounded-xl p-4 border border-blue-100 flex items-start gap-3">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-xs text-slate-600 leading-relaxed">
                  <strong className="text-slate-800 block mb-1">Bring your own key (required)</strong>
                  Every user must use their own API key. It is saved only in <em>your</em> browser (localStorage) and sent with each analysis request to call the AI provider. We never store keys on the server, in the database, or in env files — and we never share a platform-wide key.
                </div>
              </div>

              {/* Provider selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">AI Provider</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(PROVIDER_META) as [keyof typeof PROVIDER_META, typeof PROVIDER_META.gemini][]).map(([id, p]) => {
                    const PIcon = p.icon;
                    return (
                      <button
                        key={id}
                        onClick={() => handleProviderChange(id)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          provider === id
                            ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500/30"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <PIcon className={`h-4 w-4 mb-1 ${
                          provider === id ? "text-blue-600" : "text-slate-400"
                        }`} />
                        <div className={`text-sm font-bold ${provider === id ? "text-blue-700" : "text-slate-700"}`}>
                          {p.label}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">{p.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* API Key input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">API Key</label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={meta.keyPlaceholder}
                    className="w-full px-4 py-2.5 pr-20 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-mono transition-all"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showKey ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Model name - always shown */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Model</label>
                <input
                  type="text"
                  value={apiModel}
                  onChange={(e) => setApiModel(e.target.value)}
                  placeholder={meta.defaultModel || "e.g. gpt-4o"}
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-mono transition-all"
                />
              </div>

              {/* Endpoint URL - shown for OpenRouter and Custom */}
              {(provider === "openrouter" || provider === "custom") && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">API Endpoint URL</label>
                  <input
                    type="text"
                    value={apiEndpoint}
                    onChange={(e) => setApiEndpoint(e.target.value)}
                    placeholder={provider === "openrouter" ? "https://openrouter.ai/api/v1" : "https://your-api-endpoint.com/v1"}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-mono transition-all"
                  />
                </div>
              )}

              {/* API Format selector - shown only for Custom */}
              {provider === "custom" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">API Format</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["openai", "anthropic", "gemini"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setCustomFormat(fmt)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          customFormat === fmt
                            ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500/30"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className={`text-xs font-bold ${customFormat === fmt ? "text-blue-700" : "text-slate-700"}`}>
                          {fmt === "openai" ? "OpenAI" : fmt === "anthropic" ? "Anthropic" : "Gemini"}
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium mt-0.5">
                          {fmt === "openai" ? "/v1/chat/completions" : fmt === "anthropic" ? "/v1/messages" : "SDK"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Help links per provider */}
              <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1 flex-wrap">
                <span>Need a key?</span>
                {meta.keyUrl && (
                  <a href={meta.keyUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">
                    {meta.keyUrlLabel} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-slate-100" />

              {/* DataForSEO Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                    <Database className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Live SEO Data</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Optional — for real search volumes &amp; backlinks</p>
                  </div>
                </div>

                <div className="bg-emerald-50/60 rounded-xl p-3 border border-emerald-100 flex items-start gap-2.5">
                  <Shield className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="text-[11px] text-slate-600 leading-relaxed">
                    <strong className="text-slate-800">Free signup, no credit card.</strong> Get real search volumes, backlink data, and rankings. Free $1 test credit included (~500 queries). After that, ~$0.03 per analysis.
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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">DataForSEO Password</label>
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
                        onClick={() => setShowDfsKey(!showDfsKey)}
                        className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showDfsKey ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1 flex-wrap">
                  <span>Don't have an account?</span>
                  <a href="https://app.dataforseo.com/register" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline inline-flex items-center gap-0.5">
                    Sign up free at DataForSEO <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                onClick={handleClear}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
              >
                Clear Key
              </button>

              <div className="flex items-center gap-2">
                {saved && (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Saved
                  </span>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!apiKey.trim()}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    apiKey.trim()
                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                      : "bg-slate-100 text-slate-300 cursor-not-allowed"
                  }`}
                >
                  {saved ? "Saved!" : "Save & Close"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
