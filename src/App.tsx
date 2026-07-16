import { useState, useEffect, FormEvent, lazy, Suspense } from "react";
import { motion } from "motion/react";
import { 
  Search, Globe, TrendingUp, Link, BarChart2, Calendar, 
  Sparkles, ArrowRight, AlertCircle, 
  ChevronRight, Zap, RefreshCw, Menu, X,
  Stethoscope, Settings
} from "lucide-react";

import { AnalysisResult, AiProviderConfig } from "./types";
import SettingsModal from "./components/SettingsModal";
import ErrorBoundary from "./components/ErrorBoundary";
const DashboardOverview = lazy(() => import("./components/DashboardOverview"));
const KeywordLandscape = lazy(() => import("./components/KeywordLandscape"));
const ContentGapAnalysis = lazy(() => import("./components/ContentGapAnalysis"));
const SerpBacklinks = lazy(() => import("./components/SerpBacklinks"));
const ContentHub = lazy(() => import("./components/ContentHub"));

export default function App() {
  // Domain Inputs
  const [targetUrl, setTargetUrl] = useState("");
  const [competitorUrl, setCompetitorUrl] = useState("");
  
  // App States
  const [activeTab, setActiveTab] = useState<"overview" | "keywords" | "gaps" | "serp" | "hub">("overview");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Settings / API Key state (persisted to localStorage)
  const DEFAULT_PROVIDER: AiProviderConfig["provider"] = "gemini";
  const PROVIDER_DEFAULTS: Record<AiProviderConfig["provider"], { model: string; endpoint: string }> = {
    gemini: { model: "gemini-2.5-flash", endpoint: "" },
    openrouter: { model: "meta-llama/llama-3.3-70b-instruct:free", endpoint: "https://openrouter.ai/api/v1" },
    custom: { model: "gpt-4o-mini", endpoint: "" }
  };
  const STATIC_DEFAULT_CONFIG: AiProviderConfig = {
    apiKey: "",
    provider: "gemini",
    apiEndpoint: "",
    apiModel: "gemini-2.5-flash",
    customFormat: "openai",
  };
  const [aiConfig, setAiConfig] = useState<AiProviderConfig>(STATIC_DEFAULT_CONFIG);
  const [aiConfigLoaded, setAiConfigLoaded] = useState(false);

  useEffect(() => {
    const storedProvider = (localStorage.getItem("seo_api_provider") as AiProviderConfig["provider"]) || DEFAULT_PROVIDER;
    const defaults = PROVIDER_DEFAULTS[storedProvider];
    let storedKey = localStorage.getItem(`seo_api_key_${storedProvider}`) || localStorage.getItem("seo_api_key") || "";
    if (storedKey && !localStorage.getItem(`seo_api_key_${storedProvider}`)) {
      localStorage.setItem(`seo_api_key_${storedProvider}`, storedKey);
    }
    setAiConfig({
      apiKey: storedKey,
      provider: storedProvider,
      apiEndpoint: localStorage.getItem("seo_api_endpoint") || defaults.endpoint,
      apiModel: localStorage.getItem("seo_api_model") || defaults.model,
      customFormat: (localStorage.getItem("seo_api_custom_format") as AiProviderConfig["customFormat"]) || "openai",
    });
    setAiConfigLoaded(true);
  }, []);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  const handleSaveAiConfig = (config: AiProviderConfig) => {
    setAiConfig(config);
    localStorage.setItem(`seo_api_key_${config.provider}`, config.apiKey);
    localStorage.setItem("seo_api_provider", config.provider);
    localStorage.setItem("seo_api_endpoint", config.apiEndpoint);
    localStorage.setItem("seo_api_model", config.apiModel);
    localStorage.setItem("seo_api_custom_format", config.customFormat);
  };

  // Content Hub Inter-tab Communication state
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedKeyword, setSelectedKeyword] = useState("");

  // Quick Load Presets
  const presets = [
    { name: "OPTM Healthcare vs Naturoveda", target: "optmhealthcare.com", competitor: "clinic.naturoveda.com", niche: "Phytomedicine & Pain Relief" },
    { name: "Stripe vs PayPal", target: "stripe.com", competitor: "paypal.com", niche: "Online Payments & APIs" },
    { name: "Notion vs Obsidian", target: "notion.so", competitor: "obsidian.md", niche: "Knowledge Management & Notes" }
  ];

  // Run SEO Analysis Request
  const runAnalysis = async (target: string, competitor: string) => {
    if (!target) return;
    setIsAnalyzing(true);
    setErrorMsg("");
    setAnalysisResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl: target,
          competitorUrl: competitor || undefined,
          aiConfig
        })
      });
      
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error(`Server returned ${response.status}: Expected JSON response`);
      }
      // If fallback data, always display it (even with errors)
      if (data.isFallback) {
        setAnalysisResult(data);
        const fallbackMsg = data.needsApiKey
          ? "No API key configured. Open Settings to enter your key or see pre-compiled fallback analysis."
          : data.errorMsg || data.fallbackReason || "";
        setErrorMsg(fallbackMsg);
        setActiveTab("overview");
        return;
      }

      if (data.error) throw new Error(data.error);
      if (data.errorMsg) throw new Error(data.errorMsg);
      
      setAnalysisResult(data);
      setActiveTab("overview");
    } catch (err: unknown) {
      console.error("Analysis request failed:", err);
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong during domain parsing.");
    } finally {
      setIsAnalyzing(false);
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
            </div>
          ) : (
            /* Main Landing Page */
            <div className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-12 flex flex-col justify-center space-y-12">
              <div className="text-center space-y-4">
                <span className="px-3.5 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-full border border-blue-100 uppercase tracking-wider inline-block">
                  ⚡ Powered by Gemini & Search Grounding
                </span>
                <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl leading-tight">
                  Competitive Intelligence & <span className="text-blue-600">Content Strategy</span>
                </h2>
                <p className="text-slate-500 text-base max-w-2xl mx-auto">
                  Audit any website's search engine authority, discover high-converting long-tail keywords, map content gaps, and write SEO-First blog articles instantly.
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
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs flex gap-2.5 items-start">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <strong className="font-bold block mb-0.5">Analysis failed</strong>
                      {errorMsg}
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
              <button
                onClick={() => { setActiveTab("overview"); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === "overview"
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <BarChart2 className="h-4 w-4" />
                <span>Overview</span>
              </button>

              <button
                onClick={() => { setActiveTab("keywords"); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === "keywords"
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <Globe className="h-4 w-4" />
                <span>Keyword Map</span>
              </button>

              <button
                onClick={() => { setActiveTab("gaps"); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === "gaps"
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <Zap className="h-4 w-4" />
                <span>Content Gaps</span>
              </button>

              <button
                onClick={() => { setActiveTab("serp"); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === "serp"
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <Search className="h-4 w-4" />
                <span>SERP & Links</span>
              </button>

              <button
                onClick={() => { setActiveTab("hub"); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === "hub"
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span>AI Content Hub</span>
              </button>
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
                <span>API Settings — {aiConfig.provider} {aiConfig.apiKey ? <span className="text-emerald-500 ml-1">●</span> : <span className="text-amber-400 ml-1">○</span>}</span>
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
                  <div className={activeTab === "overview" ? "block" : "hidden"}>
                    <ErrorBoundary>
                    <Suspense fallback={<div className="text-center py-16 text-slate-400 font-semibold">Loading...</div>}>
                    <DashboardOverview 
                      target={analysisResult.target} 
                      competitor={analysisResult.competitor} 
                      discoveredCompetitors={analysisResult.discoveredCompetitors}
                      targetAnalysis={analysisResult.targetAnalysis}
                      autonomousBlog={analysisResult.autonomousBlog}
                      contentGaps={analysisResult.contentGaps}
                      serpFeatures={analysisResult.serpFeatures}
                      localLocation={analysisResult.localLocation}
                      rankingBlueprint={analysisResult.rankingBlueprint}
                      aiConfig={aiConfig}
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
                      gaps={analysisResult.contentGaps} 
                      targetDomain={analysisResult.target.domain}
                      competitorDomain={analysisResult.competitor?.domain || "Competitor"}
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
