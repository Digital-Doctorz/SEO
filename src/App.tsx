import { useState, useEffect, useRef, FormEvent, lazy, Suspense } from "react";
import { motion } from "motion/react";
import { 
  Search, Globe, TrendingUp, Link, BarChart2, Calendar, 
  Sparkles, ArrowRight, AlertCircle, 
  ChevronRight, Zap, RefreshCw, Menu, X,
  Stethoscope, Settings, Database, ExternalLink
} from "lucide-react";

import { AnalysisResult, AiProviderConfig } from "./types";
import SettingsModal from "./components/SettingsModal";
import ErrorBoundary from "./components/ErrorBoundary";
import { postApi, ApiError } from "./lib/api";
import { normalizeAnalysisResult } from "./lib/normalizeAnalysis";
import { detectLocationFromDomain, KOLKATA_CITY } from "./lib/geo";
import {
  loadAiConfigFromStorage,
  saveAiConfigToStorage,
  resolveAiConfig,
  AI_PROVIDER_DEFAULTS,
  normalizeAiConfig,
} from "./lib/aiConfig";
const DashboardOverview = lazy(() => import("./components/DashboardOverview"));
const KeywordLandscape = lazy(() => import("./components/KeywordLandscape"));
const ContentGapAnalysis = lazy(() => import("./components/ContentGapAnalysis"));
const SerpBacklinks = lazy(() => import("./components/SerpBacklinks"));
const ContentHub = lazy(() => import("./components/ContentHub"));

type AppTab = "overview" | "keywords" | "gaps" | "serp" | "hub";
type ErrorInfo = { message: string; severity: "error" | "warning" | "info" } | null;

const NAV_ITEMS: Array<{ id: AppTab; label: string; icon: typeof BarChart2 }> = [
  { id: "overview", label: "Overview", icon: BarChart2 },
  { id: "keywords", label: "Keyword Map", icon: Globe },
  { id: "gaps", label: "Content Gaps", icon: Zap },
  { id: "serp", label: "SERP & Links", icon: Search },
  { id: "hub", label: "AI Content Hub", icon: Sparkles },
];

export default function App() {
  // Domain Inputs
  const [targetUrl, setTargetUrl] = useState("");
  const [competitorUrl, setCompetitorUrl] = useState("");
  
  // App States
  const [activeTab, setActiveTab] = useState<AppTab>("overview");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<ErrorInfo>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Settings / API Key state (persisted to localStorage — provider-specific keys)
  const STATIC_DEFAULT_CONFIG: AiProviderConfig = normalizeAiConfig({
    apiKey: "",
    provider: "gemini",
    apiEndpoint: AI_PROVIDER_DEFAULTS.gemini.endpoint,
    apiModel: AI_PROVIDER_DEFAULTS.gemini.model,
    customFormat: "openai",
  });
  const [aiConfig, setAiConfig] = useState<AiProviderConfig>(STATIC_DEFAULT_CONFIG);
  const [aiConfigLoaded, setAiConfigLoaded] = useState(false);

  useEffect(() => {
    const loaded = loadAiConfigFromStorage();
    setAiConfig(loaded);
    setAiConfigLoaded(true);
  }, []);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  const handleSaveAiConfig = (config: AiProviderConfig) => {
    const saved = saveAiConfigToStorage(config);
    setAiConfig(saved);
  };

  // Content Hub Inter-tab Communication state
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedKeyword, setSelectedKeyword] = useState("");
  const isSubmittingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Quick Load Presets
  const presets = [
    { name: "OPTM Healthcare vs Naturoveda", target: "optmhealthcare.com", competitor: "clinic.naturoveda.com", niche: "Phytomedicine & Pain Relief" },
    { name: "Stripe vs PayPal", target: "stripe.com", competitor: "paypal.com", niche: "Online Payments & APIs" },
    { name: "Notion vs Obsidian", target: "notion.so", competitor: "obsidian.md", niche: "Knowledge Management & Notes" }
  ];

  // Run SEO Analysis Request — always uses saved BYOK key for live AI + crawl
  const runAnalysis = async (target: string, competitor: string) => {
    if (!target || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsAnalyzing(true);
    setErrorMsg(null);
    setAnalysisResult(null);

    try {
      // Always resolve latest key from storage so OpenRouter/Gemini match what user saved
      const geo = detectLocationFromDomain(target);
      const liveConfig = resolveAiConfig(aiConfig) || resolveAiConfig(null);
      if (!liveConfig?.apiKey) {
        setErrorMsg({
          message: "Add your AI API key in Settings (OpenRouter or Gemini) to run live analysis and blog generation. Demo mode is disabled for full real-time data.",
          severity: "warning",
        });
        setSettingsModalOpen(true);
        return;
      }
      const configWithGeo: AiProviderConfig = {
        ...liveConfig,
        locationCode: geo.locationCode,
        languageCode: geo.languageCode,
      };

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const data = await postApi<AnalysisResult & {
        isFallback?: boolean;
        needsApiKey?: boolean;
        error?: string;
        errorMsg?: string;
        fallbackReason?: string;
        estimatedCost?: { amount: number; currency: string };
        dataSource?: string;
      }>("/api/analyze", {
        targetUrl: target,
        competitorUrl: competitor || undefined,
        aiConfig: configWithGeo,
        requireAi: true,
      }, { signal: controller.signal });

      clearTimeout(timeoutId);

      const meta = data as AnalysisResult & {
        isFallback?: boolean;
        needsApiKey?: boolean;
        error?: string;
        errorMsg?: string;
        fallbackReason?: string;
        dataSource?: string;
      };
      // Canonical normalize: stable shapes for every tab (gaps, keywords, SERP, links)
      const safeResult = normalizeAnalysisResult(meta, target);

      if (meta.needsApiKey) {
        setAnalysisResult(null);
        setErrorMsg({
          message: "API key was not accepted. Open Settings, re-save your OpenRouter or Gemini key, then analyze again.",
          severity: "error",
        });
        setSettingsModalOpen(true);
        return;
      }

      // Surface DataForSEO auth failures as warnings (non-blocking)
      if ((meta as any).dfsAuthFailed) {
        setErrorMsg({
          message: (meta as any).dfsAuthHint ||
            "DataForSEO credentials rejected. Analysis ran with AI fallback data. Update your DataForSEO login in Settings for live search volumes and backlinks.",
          severity: "warning",
        });
      }

      if (meta.isFallback) {
        // Still show crawl-based result but warn — AI enrichment may have failed
        setAnalysisResult(safeResult);
        setErrorMsg({
          message: meta.errorMsg ||
            meta.fallbackReason ||
            "Partial analysis: live crawl ran, but AI enrichment failed (quota or timeout). Check Settings model/billing and retry for full AI keywords & gaps.",
          severity: "warning",
        });
        setActiveTab("overview");
        return;
      }

      if (meta.error) throw new Error(String(meta.error));
      if (meta.errorMsg) setErrorMsg({ message: String(meta.errorMsg), severity: "warning" });
      else setErrorMsg(null);

      setAnalysisResult(safeResult);
      setActiveTab("overview");
    } catch (err: unknown) {
      console.error("Analysis request failed:", err);
      if (err instanceof ApiError && err.status === 401 && (err.details as any)?.needsApiKey) {
        setErrorMsg({ message: "API key was not accepted. Open Settings, re-save your OpenRouter or Gemini key, then try again.", severity: "error" });
        setSettingsModalOpen(true);
      } else {
        const msg = err instanceof Error ? err.message : "Something went wrong during domain parsing.";
        setErrorMsg({
          message: /abort|timeout/i.test(msg)
            ? "Analysis timed out after 2 minutes. The server may be overloaded or the domain may be slow to crawl. Try a simpler URL or try again."
            : msg,
          severity: "error",
        });
      }
    } finally {
      // Always unlock submit — including early returns (missing key, auth, fallback)
      setIsAnalyzing(false);
      isSubmittingRef.current = false;
      abortControllerRef.current = null;
    }
  };

  const handlePresetClick = (target: string, competitor: string) => {
    setTargetUrl(target);
    setCompetitorUrl(competitor);
    runAnalysis(target, competitor);
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    runAnalysis(targetUrl, competitorUrl);
  };

  // Switch to Content Hub with preset topics
  const handleSelectTopicForBlog = (topic: string, keyword: string) => {
    setSelectedTopic(topic);
    setSelectedKeyword(keyword);
    setActiveTab("hub");
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col antialiased text-slate-800 font-sans">
      {!analysisResult ? (
        /* Landing Page / Loading view */
        <div className="flex-1 flex flex-col">
          {/* Landing Header */}
          <header className="bg-white border-b border-slate-200 px-6 py-4">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-md">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-md font-extrabold text-slate-900 tracking-tight leading-none">
                    Local SEO
                  </span>
                  <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mt-0.5">
                    by Digital Doctors
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold rounded uppercase">Professional Suite</span>
                <button
                  onClick={() => setSettingsModalOpen(true)}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                  title="API Settings"
                >
                  <Settings className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>
          </header>

          {isAnalyzing ? (
            /* Sleek Professional Loader */
            <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto text-center space-y-6">
              <div className="relative h-16 w-16">
                <span className="absolute inset-0 rounded-full border-4 border-slate-200/60" />
                <span className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900">Parsing Domain SEO Landscapes</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Executing real-time search grounding queries to analyze Domain Authority, top ranking paths, and backlink distributions...
                </p>
              </div>
              <button
                onClick={() => {
                  abortControllerRef.current?.abort();
                  setIsAnalyzing(false);
                  isSubmittingRef.current = false;
                  setErrorMsg({ message: "Analysis cancelled.", severity: "info" });
                }}
                className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-300 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            /* Main Landing Page */
            <div className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-12 flex flex-col justify-center space-y-12">
              <div className="text-center space-y-4">
                <span className="px-3.5 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-full border border-blue-100 uppercase tracking-wider inline-block">
                  ⚡ Kolkata-first Local SEO · Gemini &amp; BYOK AI
                </span>
                <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl leading-tight">
                  Competitive Intelligence & <span className="text-blue-600">Content Strategy</span>
                </h2>
                <p className="text-slate-500 text-base max-w-2xl mx-auto">
                  Audit search authority, win high-intent Kolkata / West Bengal keywords, map content gaps, and write SEO-first blog articles. Open Settings and add <strong>your own</strong> AI API key — no shared keys; every user brings their own.
                </p>
              </div>

              {/* Input Form Card */}
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Target URL */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Target Website</label>
                      <div className="relative">
                        <Globe className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                        <input
                          type="text"
                          required
                          placeholder="e.g. mybusiness.com"
                          value={targetUrl}
                          onChange={(e) => setTargetUrl(e.target.value)}
                          className="pl-11 pr-4 py-3 w-full text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 focus:bg-white transition-all font-medium"
                        />
                      </div>
                    </div>

                    {/* Competitor URL */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Competitor Website (Optional)</label>
                      <div className="relative">
                        <Globe className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="e.g. competitor.com"
                          value={competitorUrl}
                          onChange={(e) => setCompetitorUrl(e.target.value)}
                          className="pl-11 pr-4 py-3 w-full text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 focus:bg-white transition-all font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!targetUrl}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  >
                    <span>Launch SEO Niche Analysis</span>
                    <ArrowRight className="h-4.5 w-4.5" />
                  </button>
                </form>

                {/* Error Alert Box */}
                {errorMsg && (
                  <div className={`p-4 rounded-xl text-xs flex gap-2.5 items-start ${
                    errorMsg.severity === "warning"
                      ? "bg-amber-50 border border-amber-100 text-amber-700"
                      : errorMsg.severity === "info"
                        ? "bg-blue-50 border border-blue-100 text-blue-700"
                        : "bg-rose-50 border border-rose-100 text-rose-700"
                  }`}>
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <strong className="font-bold block mb-0.5">
                        {errorMsg.severity === "warning" ? "Warning" : errorMsg.severity === "info" ? "Notice" : "Analysis failed"}
                      </strong>
                      {errorMsg.message}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Presets Section */}
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest text-center">
                  Explore Top Marketing Presets
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {presets.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => handlePresetClick(preset.target, preset.competitor)}
                      className="p-5 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-xs transition-all text-left space-y-2 group"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600">
                          {preset.name}
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-600 transition-all group-hover:translate-x-0.5" />
                      </div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Niche: {preset.niche}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <footer className="bg-white border-t border-slate-200 py-6 px-6 text-center text-xs text-slate-400 font-medium mt-auto">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
              <p>© 2026 Local SEO. All rights reserved.</p>
              <p className="flex flex-col sm:flex-row items-center gap-1 sm:gap-4 text-slate-500">
                <span>Designed & built by <strong className="font-semibold text-slate-700">Digital Doctors</strong></span>
                <span className="hidden sm:inline text-slate-300">|</span>
                <span>Contact: <a href="tel:+919555955595" className="hover:text-blue-600 font-bold text-blue-600">+91-9555955595</a></span>
              </p>
            </div>
          </footer>
        </div>
      ) : (
        /* Unified SaaS Multi-Panel Workspace with Sidebar */
        <div className="flex h-screen w-full bg-slate-50 text-slate-800 font-sans overflow-hidden">
          
          {/* Mobile Sidebar overlay backdrop */}
          {mobileMenuOpen && (
            <div 
              className="md:hidden fixed inset-0 bg-slate-900/40 z-40 backdrop-blur-xs" 
              onClick={() => setMobileMenuOpen(false)}
            />
          )}

          {/* Sidebar Left Navigation Panel */}
          <aside className={`w-64 border-r border-slate-200 bg-white flex flex-col h-full z-50 fixed md:static transition-transform duration-300 ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}>
            {/* Sidebar Logo */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-sm">
                  <Stethoscope className="h-4.5 w-4.5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-extrabold text-slate-900 tracking-tight leading-none">
                    Local SEO
                  </span>
                  <span className="text-[9px] text-blue-600 font-bold uppercase tracking-wider mt-0.5">
                    by Digital Doctors
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)} 
                className="md:hidden text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Nav Menu Links */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {/* Mobile: Re-analyze form */}
              <form onSubmit={handleFormSubmit} className="lg:hidden space-y-2 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="text"
                  placeholder="Target domain"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
                <input
                  type="text"
                  placeholder="Competitor (optional)"
                  value={competitorUrl}
                  onChange={(e) => setCompetitorUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
                <button
                  type="submit"
                  disabled={isAnalyzing || !targetUrl.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-bold px-3 py-2 rounded-lg transition-all flex items-center justify-center gap-1"
                >
                  {isAnalyzing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                  <span>{isAnalyzing ? "Analyzing..." : "Re-Analyze"}</span>
                </button>
              </form>

              {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { setActiveTab(id); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === id
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${id === "hub" ? "text-blue-600" : ""}`} />
                  <span>{label}</span>
                </button>
              ))}
            </nav>

            {/* Sidebar Footer Asset Box */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2">
              <div className="text-xs font-bold uppercase text-slate-400 mb-2">Target Asset</div>
              <div className="text-sm font-bold text-slate-800 truncate flex items-center gap-2">
                <Globe className="h-4 w-4 text-slate-400" />
                <span>{analysisResult.target.domain}</span>
              </div>
              <div className="text-xs text-slate-400 mt-1 italic">Analysis Grounded</div>
              <button
                onClick={() => setSettingsModalOpen(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>
                  API Settings —{" "}
                  <span className="capitalize font-bold">{aiConfig.provider}</span>
                  {aiConfig.apiKey ? (
                    <span className="text-emerald-500 ml-1" title="Key saved for live AI">
                      ● live AI ready ({aiConfig.apiModel || "default model"})
                    </span>
                  ) : (
                    <span className="text-amber-400 ml-1">○ add key for live analysis</span>
                  )}
                </span>
              </button>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 flex flex-col h-full overflow-hidden">
            
            {/* Top Workspace Header Bar */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setMobileMenuOpen(true)} 
                  className="md:hidden text-slate-500 hover:text-slate-800 p-1"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <h1 className="text-md md:text-lg font-bold text-slate-800 hidden sm:block">
                  Competitive Intelligence Dashboard
                </h1>
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded uppercase">
                  Live Project
                </span>
              </div>

              {/* Header Actions - Search Form */}
              <div className="flex items-center gap-4">
                <form onSubmit={handleFormSubmit} className="hidden lg:flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Target domain"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium w-36"
                  />
                  <input
                    type="text"
                    placeholder="Competitor"
                    value={competitorUrl}
                    onChange={(e) => setCompetitorUrl(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium w-36"
                  />
                  <button
                    type="submit"
                    disabled={isAnalyzing}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                  >
                    {isAnalyzing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                    <span>Re-Analyze</span>
                  </button>
                </form>

                {/* Mobile: compact re-analyze button */}
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="lg:hidden text-slate-500 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-all"
                  title="Re-analyze domain"
                >
                  <Search className="h-4 w-4" />
                </button>

                {/* Profile Avatars Cluster */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSettingsModalOpen(true)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                    title="API Settings"
                  >
                    <Settings className="h-4.5 w-4.5" />
                  </button>
                  <div className="flex -space-x-1.5">
                    <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[11px] font-bold text-slate-600">JD</div>
                    <div className="w-8 h-8 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[11px] font-bold text-blue-600">+2</div>
                  </div>
                </div>
              </div>
            </header>

            {/* Scrollable Viewport Wrapper */}
            <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-slate-50 space-y-6 flex flex-col justify-between">
              
              <div className="space-y-6 flex-1">
                {/* Top Banner Alert / Domain Comparison titles */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Active workspace comparison
                    </span>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mt-0.5">
                      <span className="text-blue-600">{analysisResult.target.domain}</span>
                      {analysisResult.competitor && (
                        <>
                          <span className="text-xs font-normal text-slate-400">vs</span>
                          <span className="text-slate-500">{analysisResult.competitor.domain}</span>
                        </>
                      )}
                    </h2>
                  </div>
                  
                  {/* Mobile/Tablet fallback search form */}
                  <form onSubmit={handleFormSubmit} className="lg:hidden flex items-center gap-1">
                    <input
                      type="text"
                      placeholder="Compare competitor..."
                      value={competitorUrl}
                      onChange={(e) => setCompetitorUrl(e.target.value)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium w-36 bg-slate-50"
                    />
                    <button
                      type="submit"
                      className="bg-blue-600 text-white text-xs font-bold p-1.5 rounded-lg"
                    >
                      <Search className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>

                {/* Component Workspace Switchboard */}
                <div className="min-h-[500px]">
                  {/* Data source indicator */}
                  {analysisResult.dataSource && (
                    <div className="mb-3 flex items-center gap-2 text-xs">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold border ${
                        analysisResult.dataSource === "dataforseo" || analysisResult.dataSource === "dataforseo+ai"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : analysisResult.dataSource === "ai"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>
                        {analysisResult.dataSource === "dataforseo" || analysisResult.dataSource === "dataforseo+ai" ? (
                          <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Live SEO Data</>
                        ) : analysisResult.dataSource === "ai" ? (
                          <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> AI Analysis</>
                        ) : (
                          <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> Demo / Crawl Data</>
                        )}
                      </span>
                      {analysisResult.dataSource === "dataforseo+ai" && (
                        <span className="text-slate-500">+ AI enrichment</span>
                      )}
                      {analysisResult.estimatedCost && (
                        <span className="text-slate-500 ml-1">~${analysisResult.estimatedCost.amount.toFixed(4)} query cost</span>
                      )}
                    </div>
                  )}

                  {/* Connect DataForSEO nudge banner */}
                  {analysisResult.dataSource !== "dataforseo" && analysisResult.dataSource !== "dataforseo+ai" && !aiConfig.dataforseoLogin && (
                    <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <Database className="h-4 w-4 text-emerald-600 shrink-0" />
                        <div className="text-xs">
                          <strong className="text-emerald-800">Get real search data.</strong>{" "}
                          <span className="text-emerald-700">Connect DataForSEO in Settings for live search volumes, backlinks &amp; rankings. Free signup, no card needed.</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSettingsModalOpen(true)}
                        className="shrink-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap"
                      >
                        Connect
                      </button>
                    </div>
                  )}
                  <div className={activeTab === "overview" ? "block" : "hidden"}>
                    <ErrorBoundary>
                    <Suspense fallback={<div className="text-center py-16 text-slate-400 font-semibold">Loading...</div>}>
                    <DashboardOverview 
                      target={analysisResult.target} 
                      competitor={analysisResult.competitor} 
                      discoveredCompetitors={analysisResult.discoveredCompetitors}
                      targetAnalysis={analysisResult.targetAnalysis}
                      marketResearch={analysisResult.marketResearch || analysisResult.targetAnalysis?.marketResearch}
                      autonomousBlog={analysisResult.autonomousBlog}
                      contentGaps={analysisResult.contentGaps}
                      serpFeatures={analysisResult.serpFeatures}
                      localLocation={analysisResult.localLocation}
                      rankingBlueprint={analysisResult.rankingBlueprint}
                      aiConfig={aiConfig}
                      pageSpeed={analysisResult.pageSpeed}
                      onViewAutonomousBlog={() => setActiveTab("hub")}
                      onSelectCompetitor={(domain) => {
                        setCompetitorUrl(domain);
                        runAnalysis(analysisResult.target.domain, domain);
                      }}
                    />
                    </Suspense>
                    </ErrorBoundary>
                  </div>
                  <div className={activeTab === "keywords" ? "block" : "hidden"}>
                    <ErrorBoundary>
                    <Suspense fallback={<div className="text-center py-16 text-slate-400 font-semibold">Loading...</div>}>
                    <KeywordLandscape 
                      keywords={analysisResult.keywords} 
                      targetDomain={analysisResult.target.domain}
                      aiConfig={aiConfig}
                      onSelectKeyword={(kw) => {
                        setSelectedKeyword(kw);
                        const capitalizedKw = kw
                          .split(' ')
                          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(' ');
                        setSelectedTopic(capitalizedKw);
                        setActiveTab("hub");
                      }}
                    />
                    </Suspense>
                    </ErrorBoundary>
                  </div>
                  <div className={activeTab === "gaps" ? "block" : "hidden"}>
                    <ErrorBoundary>
                    <Suspense fallback={<div className="text-center py-16 text-slate-400 font-semibold">Loading...</div>}>
                    <ContentGapAnalysis 
                      gaps={analysisResult.contentGaps || []} 
                      targetDomain={analysisResult.target?.domain || targetUrl || "your-site.com"}
                      competitorDomain={analysisResult.competitor?.domain || competitorUrl || "Competitor"}
                      city={analysisResult.localLocation?.city || KOLKATA_CITY}
                      brandName={
                        (analysisResult as { siteProfile?: { brand?: string } }).siteProfile?.brand ||
                        analysisResult.target?.domain?.split(".")[0] ||
                        undefined
                      }
                      onSelectTopic={handleSelectTopicForBlog}
                    />
                    </Suspense>
                    </ErrorBoundary>
                  </div>
                  <div className={activeTab === "serp" ? "block" : "hidden"}>
                    <ErrorBoundary>
                    <Suspense fallback={<div className="text-center py-16 text-slate-400 font-semibold">Loading...</div>}>
                    <SerpBacklinks 
                      serpFeatures={analysisResult.serpFeatures}
                      backlinkSources={analysisResult.backlinkSources}
                      backlinkOpportunities={analysisResult.backlinkOpportunities}
                      targetDomain={analysisResult.target.domain}
                      targetRating={analysisResult.target.domainRating}
                      competitorDomain={analysisResult.competitor?.domain}
                      competitorRating={analysisResult.competitor?.domainRating}
                      discoveredCompetitors={analysisResult.discoveredCompetitors}
                    />
                    </Suspense>
                    </ErrorBoundary>
                  </div>
                  <div className={activeTab === "hub" ? "block" : "hidden"}>
                    <ErrorBoundary>
                    <Suspense fallback={<div className="text-center py-16 text-slate-400 font-semibold">Loading...</div>}>
                    <ContentHub 
                      initialKeyword={selectedKeyword}
                      initialTopic={selectedTopic}
                      targetDomain={analysisResult.target.domain}
                      autonomousBlog={analysisResult.autonomousBlog}
                      targetPages={analysisResult.target.topPages}
                      aiConfig={aiConfig}
                      analysisContext={{
                        keywords: (analysisResult.keywords || [])
                          .slice(0, 20)
                          .map((k) => ({
                            keyword: k.keyword,
                            volume: k.volume,
                            difficulty: k.difficulty,
                            intent: k.intent,
                          })),
                        contentGaps: (analysisResult.contentGaps || [])
                          .slice(0, 10)
                          .map((g) => ({
                            topic: g.recommendedTopic,
                            keyword: g.competitorKeyword,
                            opportunity: g.isQuickWin
                              ? "Quick win content gap"
                              : `${g.recommendedType || "content"} opportunity`,
                            competitorKeyword: g.competitorKeyword,
                            competitorRank: g.competitorRank,
                            competitorVolume: g.competitorVolume,
                            difficultyCategory: g.difficultyCategory,
                            isQuickWin: g.isQuickWin,
                            recommendedType: g.recommendedType,
                            localIntent: g.localIntent,
                            neighborhoods: g.neighborhoods,
                          })),
                        competitors: [
                          analysisResult.competitor?.domain,
                          ...((analysisResult.discoveredCompetitors || []).map((c) => c.domain) ||
                            []),
                        ]
                          .filter(Boolean)
                          .slice(0, 15) as string[],
                        niche: analysisResult.targetAnalysis?.coreNiche,
                        audience: analysisResult.targetAnalysis?.audiencePersona,
                        strengths: analysisResult.targetAnalysis?.contentStrengths,
                        weaknesses: analysisResult.targetAnalysis?.contentWeaknesses,
                        localLocation: analysisResult.localLocation
                          ? {
                              city: analysisResult.localLocation.city,
                              state: analysisResult.localLocation.state,
                              country: analysisResult.localLocation.country,
                              detectedAddress: analysisResult.localLocation.detectedAddress,
                              serviceAreas: (analysisResult.localLocation as { serviceAreas?: string[] })
                                .serviceAreas,
                              localSeoVerdict: analysisResult.localLocation.localSeoVerdict,
                            }
                          : undefined,
                      }}
                    />
                    </Suspense>
                    </ErrorBoundary>
                  </div>
                </div>
              </div>

              {/* Workspace footer on the very bottom */}
              <footer className="bg-white border border-slate-200 rounded-xl py-4 px-6 text-center text-xs text-slate-400 font-medium mt-12 shadow-xs flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                <p>© 2026 Local SEO. All rights reserved.</p>
                <p className="flex flex-col sm:flex-row items-center gap-1 sm:gap-4 text-slate-500">
                  <span>Designed & built by <strong className="font-semibold text-slate-700">Digital Doctors</strong></span>
                  <span className="hidden sm:inline text-slate-300">|</span>
                  <span>Contact: <a href="tel:+919555955595" className="hover:text-blue-600 font-bold text-blue-600">+91-9555955595</a></span>
                </p>
              </footer>
            </div>
          </main>
        </div>
      )}

      {/* Settings Modal – always rendered at root level */}
      <SettingsModal
        open={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        onSave={handleSaveAiConfig}
        currentConfig={aiConfig}
      />
    </div>
  );
}
