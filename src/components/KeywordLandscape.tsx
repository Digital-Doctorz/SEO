import { useState, useMemo, useRef, Fragment } from "react";
import { Keyword, DeepKeywordAudit, AiProviderConfig } from "../types";
import { 
  Search, HelpCircle, ArrowUp, ArrowDown,
  TrendingUp, Layers, Compass, Award,
  Zap, ChevronDown, ChevronUp, ExternalLink,
  Workflow, RefreshCw, BarChart2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from "recharts";

interface KeywordLandscapeProps {
  keywords: Keyword[];
  targetDomain?: string;
  aiConfig?: AiProviderConfig;
  onSelectKeyword?: (keyword: string) => void;
}

type TabType = "explorer" | "clustering";
type SortField = "volume" | "difficulty" | "cpc" | "keyword" | "opportunityScore";
type SortOrder = "asc" | "desc";

export default function KeywordLandscape({ keywords, targetDomain, aiConfig, onSelectKeyword }: KeywordLandscapeProps) {
  const [activeTab, setActiveTab] = useState<TabType>("explorer");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | "Short-tail" | "Long-tail" | "Question">("All");
  const [intentFilter, setIntentFilter] = useState<"All" | "Commercial" | "Informational" | "Transactional" | "Navigational">("All");
  const [journeyFilter, setJourneyFilter] = useState<"All" | "Awareness" | "Consideration" | "Decision">("All");
  const [parentTopicFilter, setParentTopicFilter] = useState<string>("All");
  const [onlyPillars, setOnlyPillars] = useState(false);
  
  const [sortField, setSortField] = useState<SortField>("opportunityScore");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [expandedKeyword, setExpandedKeyword] = useState<string | null>(null);

  const [deepAudits, setDeepAudits] = useState<Record<string, DeepKeywordAudit>>({});
  const [loadingAudits, setLoadingAudits] = useState<Record<string, boolean>>({});
  const [showVolumeChart, setShowVolumeChart] = useState(true);

  // Compute top 10 keywords by search volume
  const topTenKeywords = useMemo(() => {
    return [...keywords]
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);
  }, [keywords]);

  // Compute stats for top 10 keywords
  const topTenStats = useMemo(() => {
    if (topTenKeywords.length === 0) return { avgVolume: 0, avgDifficulty: 0, risingCount: 0, highOppCount: 0 };
    const totalVolume = topTenKeywords.reduce((sum, k) => sum + k.volume, 0);
    const totalDiff = topTenKeywords.reduce((sum, k) => sum + k.difficulty, 0);
    const rising = topTenKeywords.filter(k => k.trend === "rising").length;
    const highOpp = topTenKeywords.filter(k => k.opportunityScore >= 70).length;
    return {
      avgVolume: Math.round(totalVolume / topTenKeywords.length),
      avgDifficulty: Math.round(totalDiff / topTenKeywords.length),
      risingCount: rising,
      highOppCount: highOpp
    };
  }, [topTenKeywords]);

  const auditAbortControllers = useRef<Record<string, AbortController>>({});

  const triggerDeepAudit = async (keyword: string) => {
    if (deepAudits[keyword] || loadingAudits[keyword]) return;

    if (auditAbortControllers.current[keyword]) {
      auditAbortControllers.current[keyword].abort();
    }

    const controller = new AbortController();
    auditAbortControllers.current[keyword] = controller;

    setLoadingAudits(prev => ({ ...prev, [keyword]: true }));
    try {
      const res = await fetch("/api/analyze-keyword-deep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, targetDomain: targetDomain || "", aiConfig }),
        signal: controller.signal
      });
      if (res.ok) {
        const data = await res.json();
        if (data.isFallback) {
          console.warn("Deep audit fallback — no AI result for:", keyword);
        }
        setDeepAudits(prev => ({ ...prev, [keyword]: data }));
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Error triggering deep keyword audit:", err);
      }
    } finally {
      setLoadingAudits(prev => ({ ...prev, [keyword]: false }));
      delete auditAbortControllers.current[keyword];
    }
  };

  // Get list of parent topics
  const parentTopics = useMemo(() => {
    const topics = new Set<string>();
    keywords.forEach(k => {
      if (k.parentTopic) topics.add(k.parentTopic);
    });
    return Array.from(topics);
  }, [keywords]);

  // Handle Sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const toggleExpandKeyword = (keyword: string) => {
    const isExpanding = expandedKeyword !== keyword;
    setExpandedKeyword(isExpanding ? keyword : null);
    if (isExpanding) {
      triggerDeepAudit(keyword);
    }
  };

  // Filter and sort keywords
  const filteredKeywords = useMemo(() => {
    return keywords
      .filter((kw) => {
        const matchesSearch = kw.keyword.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === "All" ? true : kw.type === typeFilter;
        const matchesIntent = intentFilter === "All" ? true : kw.intent === intentFilter;
        const matchesJourney = journeyFilter === "All" ? true : kw.buyerJourneyStage === journeyFilter;
        const matchesTopic = parentTopicFilter === "All" ? true : kw.parentTopic === parentTopicFilter;
        const matchesPillars = onlyPillars ? kw.isPillarOpportunity : true;
        return matchesSearch && matchesType && matchesIntent && matchesJourney && matchesTopic && matchesPillars;
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortField === "keyword") {
          comparison = a.keyword.localeCompare(b.keyword);
        } else {
          comparison = (a[sortField] || 0) - (b[sortField] || 0);
        }
        return sortOrder === "asc" ? comparison : -comparison;
      });
  }, [keywords, searchTerm, typeFilter, intentFilter, journeyFilter, parentTopicFilter, onlyPillars, sortField, sortOrder]);

  // Cluster calculations
  const clusters = useMemo(() => {
    const map = new Map<string, {
      keywords: Keyword[];
      totalVolume: number;
      avgDifficulty: number;
      avgCpc: number;
      pillarOpportunity: Keyword | null;
    }>();

    keywords.forEach(kw => {
      const topic = kw.parentTopic || "Unassigned";
      if (!map.has(topic)) {
        map.set(topic, {
          keywords: [],
          totalVolume: 0,
          avgDifficulty: 0,
          avgCpc: 0,
          pillarOpportunity: null
        });
      }
      const cluster = map.get(topic)!;
      cluster.keywords.push(kw);
      cluster.totalVolume += kw.volume;
      cluster.avgDifficulty += kw.difficulty;
      cluster.avgCpc += kw.cpc;

      // Find the best pillar content opportunity (highest volume long-tail/short-tail or designated)
      if (kw.isPillarOpportunity) {
        if (!cluster.pillarOpportunity || kw.volume > cluster.pillarOpportunity.volume) {
          cluster.pillarOpportunity = kw;
        }
      }
    });

    // Finalize averages and select default pillar if none designated
    map.forEach((value, key) => {
      if (value.keywords.length > 0) {
        value.avgDifficulty = Math.round(value.avgDifficulty / value.keywords.length);
        value.avgCpc = Number((value.avgCpc / value.keywords.length).toFixed(2));
      }
      if (!value.pillarOpportunity && value.keywords.length > 0) {
        // Fallback to highest volume keyword
        value.pillarOpportunity = [...value.keywords].sort((a, b) => b.volume - a.volume)[0];
      }
    });

    return Array.from(map.entries()).map(([name, data]) => ({ name, ...data }));
  }, [keywords]);

  // Buyer Journey Map
  const journeyStages = useMemo(() => {
    return {
      Awareness: keywords.filter(k => k.buyerJourneyStage === "Awareness"),
      Consideration: keywords.filter(k => k.buyerJourneyStage === "Consideration"),
      Decision: keywords.filter(k => k.buyerJourneyStage === "Decision")
    };
  }, [keywords]);

  // Difficulty color indicator
  const getDifficultyColor = (score: number) => {
    if (score < 30) return { text: "text-green-700 bg-green-50 border-green-100", label: "Easy", bar: "bg-green-500" };
    if (score < 65) return { text: "text-amber-700 bg-amber-50 border-amber-100", label: "Medium", bar: "bg-amber-500" };
    return { text: "text-rose-700 bg-rose-50 border-rose-100", label: "Hard", bar: "bg-rose-500" };
  };

  const getIntentBadge = (intent: string) => {
    switch (intent) {
      case "Transactional":
        return "bg-green-50 text-green-700 border-green-150";
      case "Commercial":
        return "bg-purple-50 text-purple-700 border-purple-150";
      case "Navigational":
        return "bg-amber-50 text-amber-700 border-amber-150";
      default:
        return "bg-blue-50 text-blue-700 border-blue-150";
    }
  };

  const getJourneyBadge = (stage: string) => {
    switch (stage) {
      case "Decision":
        return "bg-rose-50 text-rose-700 border-rose-150";
      case "Consideration":
        return "bg-amber-50 text-amber-700 border-amber-150";
      default:
        return "bg-blue-50 text-blue-700 border-blue-150";
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("explorer")}
          className={`pb-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "explorer" 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <Compass className="h-4 w-4" />
          <span>Keyword Explorer</span>
        </button>
        <button
          onClick={() => setActiveTab("clustering")}
          className={`pb-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "clustering" 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Topic Clusters & Journey Mapping</span>
        </button>
      </div>

      {activeTab === "explorer" ? (
        <div className="space-y-6">
          {/* Top 10 Search Volume Analytics Chart */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-blue-600" />
                <h3 className="font-extrabold text-slate-800 text-base">Search Volume & Trend Trends (Top 10 Keywords)</h3>
              </div>
              <button 
                onClick={() => setShowVolumeChart(!showVolumeChart)}
                className="text-xs bg-slate-150 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1 font-bold transition-all cursor-pointer"
              >
                {showVolumeChart ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                <span>{showVolumeChart ? "Hide Visualization" : "Show Volume Trends"}</span>
              </button>
            </div>

            <AnimatePresence>
              {showVolumeChart && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden"
                >
                  {/* Recharts Bar Chart Container */}
                  <div className="lg:col-span-8 bg-slate-50/50 p-4 rounded-xl border border-slate-100 min-h-[340px]">
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart
                        data={topTenKeywords}
                        layout="vertical"
                        margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} stroke="#f1f5f9" />
                        <XAxis type="number" stroke="#94a3b8" fontSize={10} fontStyle="italic" />
                        <YAxis 
                          dataKey="keyword" 
                          type="category" 
                          stroke="#475569" 
                          fontSize={11} 
                          fontWeight="bold"
                          width={140}
                          tickFormatter={(val) => val.length > 20 ? val.substring(0, 18) + "..." : val}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload as Keyword;
                              const diffInfo = getDifficultyColor(data.difficulty);
                              return (
                                <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-lg border border-slate-800 space-y-1.5 text-xs max-w-sm">
                                  <p className="font-extrabold text-slate-100 border-b border-slate-800 pb-1">{data.keyword}</p>
                                  <div className="flex justify-between gap-6">
                                    <span className="text-slate-400">Search Volume:</span>
                                    <span className="font-bold text-blue-400 font-mono">{data.volume.toLocaleString()}</span>
                                  </div>
                                  <div className="flex justify-between gap-6">
                                    <span className="text-slate-400">Keyword Difficulty:</span>
                                    <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] uppercase font-mono ${diffInfo.text}`}>
                                      {data.difficulty} ({diffInfo.label})
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-6">
                                    <span className="text-slate-400">Cost Per Click:</span>
                                    <span className="font-bold text-green-400 font-mono">${data.cpc.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between gap-6">
                                    <span className="text-slate-400">Trend Direction:</span>
                                    <span className={`font-bold capitalize flex items-center gap-1 ${
                                      data.trend === "rising" ? "text-green-400" : data.trend === "declining" ? "text-rose-400" : "text-slate-300"
                                    }`}>
                                      {data.trend === "rising" && "▲"}
                                      {data.trend === "declining" && "▼"}
                                      {data.trend}
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="volume" radius={[0, 4, 4, 0]}>
                          {topTenKeywords.map((entry, index) => {
                            let barColor = "#22c55e"; // Easy
                            if (entry.difficulty >= 65) barColor = "#ef4444"; // Hard
                            else if (entry.difficulty >= 30) barColor = "#f59e0b"; // Medium
                            return <Cell key={`cell-${index}`} fill={barColor} fillOpacity={0.85} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Summary Metrics & Color Legend (4 Columns) */}
                  <div className="lg:col-span-4 flex flex-col justify-between space-y-4">
                    {/* Visual Difficulty Color Legend */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-3">
                      <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Difficulty Levels</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded bg-green-500 shrink-0" />
                          <div className="text-xs">
                            <span className="font-bold text-slate-800">Easy Keywords</span>
                            <span className="text-slate-400 block text-[10px]">Difficulty score &lt; 30 (high priority low-hanging fruit)</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded bg-amber-500 shrink-0" />
                          <div className="text-xs">
                            <span className="font-bold text-slate-800">Medium Keywords</span>
                            <span className="text-slate-400 block text-[10px]">Difficulty score 30 - 64 (requires stable organic content support)</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded bg-rose-500 shrink-0" />
                          <div className="text-xs">
                            <span className="font-bold text-slate-800">Hard Keywords</span>
                            <span className="text-slate-400 block text-[10px]">Difficulty score &ge; 65 (demands multi-tier backlink authority clusters)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stats summary list */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-150 text-center">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Average Volume</span>
                        <span className="text-base font-extrabold text-slate-800 font-mono">{(topTenStats.avgVolume).toLocaleString()}</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-150 text-center">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Avg Difficulty</span>
                        <span className="text-base font-extrabold text-slate-800 font-mono">{topTenStats.avgDifficulty}/100</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-150 text-center">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Rising Trends</span>
                        <span className="text-base font-extrabold text-emerald-600 font-mono">+{topTenStats.risingCount} kw</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-150 text-center">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">High Opp (70+)</span>
                        <span className="text-base font-extrabold text-blue-600 font-mono">{topTenStats.highOppCount} opportunities</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 italic bg-blue-50/40 p-3 rounded-xl border border-blue-100/60 leading-snug">
                      <strong>AI Strategic Tip:</strong> Focus on green-coded <strong>Easy</strong> keywords with rising trend indicators to secure rapid rankings before entering high-competition spaces.
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Table Controls & Filters */}
          <div className="p-6 border-b border-slate-200 bg-slate-50/50 space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Ranking Keyword Landscape</span>
                  <span className="text-xs font-normal text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                    {filteredKeywords.length} terms discovered
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">Explore search volumes, CPC, keyword difficulty, trends, and intent types.</p>
              </div>
              
              {/* Search Input */}
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search keyword..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            {/* Filter Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              {/* Keyword Type Filters */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Format Type</span>
                <select 
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All">All Formats</option>
                  <option value="Short-tail">Short-tail</option>
                  <option value="Long-tail">Long-tail</option>
                  <option value="Question">Question</option>
                </select>
              </div>

              {/* Search Intent Filters */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Search Intent</span>
                <select 
                  value={intentFilter}
                  onChange={(e) => setIntentFilter(e.target.value as any)}
                  className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All">All Intents</option>
                  <option value="Informational">Informational</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Transactional">Transactional</option>
                  <option value="Navigational">Navigational</option>
                </select>
              </div>

              {/* Buyer Journey Stage Filter */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Buyer Journey Stage</span>
                <select 
                  value={journeyFilter}
                  onChange={(e) => setJourneyFilter(e.target.value as any)}
                  className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All">All Journey Stages</option>
                  <option value="Awareness">Awareness (TOFU)</option>
                  <option value="Consideration">Consideration (MOFU)</option>
                  <option value="Decision">Decision (BOFU)</option>
                </select>
              </div>

              {/* Topic Filter */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Topic Cluster</span>
                <select 
                  value={parentTopicFilter}
                  onChange={(e) => setParentTopicFilter(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All">All Clusters</option>
                  {parentTopics.map(topic => (
                    <option key={topic} value={topic}>{topic}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-150">
              <input
                type="checkbox"
                id="onlyPillars"
                checked={onlyPillars}
                onChange={(e) => setOnlyPillars(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="onlyPillars" className="text-xs font-semibold text-slate-600 cursor-pointer flex items-center gap-1">
                <Award className="h-3.5 w-3.5 text-amber-500" />
                <span>Show Only Pillar Content Opportunities</span>
              </label>
            </div>
          </div>

          {/* Keywords Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/20 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6 w-8"></th>
                  <th className="py-4 px-6 cursor-pointer hover:bg-slate-50" onClick={() => handleSort("keyword")}>
                    <div className="flex items-center gap-1">
                      <span>Keyword</span>
                      {sortField === "keyword" && (sortOrder === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}
                    </div>
                  </th>
                  <th className="py-4 px-6 cursor-pointer hover:bg-slate-50 text-right" onClick={() => handleSort("volume")}>
                    <div className="flex items-center gap-1 justify-end">
                      <span>Search Volume</span>
                      {sortField === "volume" && (sortOrder === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}
                    </div>
                  </th>
                  <th className="py-4 px-6 cursor-pointer hover:bg-slate-50" onClick={() => handleSort("difficulty")}>
                    <div className="flex items-center gap-1">
                      <span>Difficulty</span>
                      {sortField === "difficulty" && (sortOrder === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}
                    </div>
                  </th>
                  <th className="py-4 px-6 cursor-pointer hover:bg-slate-50" onClick={() => handleSort("opportunityScore")}>
                    <div className="flex items-center gap-1 text-blue-600">
                      <span>Opp. Score</span>
                      {sortField === "opportunityScore" && (sortOrder === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}
                    </div>
                  </th>
                  <th className="py-4 px-6">Intent & Funnel</th>
                  <th className="py-4 px-6">Topic Cluster</th>
                  <th className="py-4 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filteredKeywords.length > 0 ? (
                  filteredKeywords.map((kw, idx) => {
                    const diffColor = getDifficultyColor(kw.difficulty);
                    const isExpanded = expandedKeyword === kw.keyword;
                    return (
                      <Fragment key={kw.keyword}>
                        <tr
                          className={`hover:bg-slate-50/60 transition-colors cursor-pointer ${isExpanded ? "bg-blue-50/20" : ""}`}
                          onClick={() => toggleExpandKeyword(kw.keyword)}
                        >
                          {/* Expansion arrow */}
                          <td className="py-4 px-6 text-slate-400">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </td>

                          {/* Keyword Name */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{kw.keyword}</span>
                              {kw.isPillarOpportunity && (
                                <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-0.5 border border-amber-200">
                                  <Award className="h-3 w-3" />
                                  <span>Pillar</span>
                                </span>
                              )}
                              {kw.trend === "rising" && (
                                <span className="text-green-600 bg-green-50 border border-green-100 rounded p-0.5 flex items-center justify-center" title="Rising trend">
                                  <TrendingUp className="h-3 w-3" />
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Volume */}
                          <td className="py-4 px-6 font-mono font-medium text-right text-slate-900">
                            {kw.volume.toLocaleString()}
                          </td>

                          {/* Difficulty */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${diffColor.text}`}>
                                {kw.difficulty} • {diffColor.label}
                              </span>
                              <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                <div className={`h-full ${diffColor.bar}`} style={{ width: `${kw.difficulty}%` }} />
                              </div>
                            </div>
                          </td>

                          {/* Opportunity Score */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-blue-600 font-mono text-base">{kw.opportunityScore}</span>
                              <span className="text-[10px] font-bold text-slate-400">/100</span>
                            </div>
                          </td>

                          {/* Intent & Journey badgess */}
                          <td className="py-4 px-6 space-y-1">
                            <div className="flex flex-wrap gap-1">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getIntentBadge(kw.intent)}`}>
                                {kw.intent}
                              </span>
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getJourneyBadge(kw.buyerJourneyStage)}`}>
                                {kw.buyerJourneyStage}
                              </span>
                            </div>
                          </td>

                          {/* Parent Topic Cluster */}
                          <td className="py-4 px-6">
                            <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium border border-slate-200">
                              {kw.parentTopic || "General"}
                            </span>
                          </td>

                          {/* Actions button */}
                          <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                            {onSelectKeyword && (
                              <button
                                onClick={() => onSelectKeyword(kw.keyword)}
                                className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg transition-all shadow-xs"
                              >
                                Create Content
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* Collapsible Enriched Keyword Intelligence details panel */}
                        <AnimatePresence>
                          {isExpanded && (
                            <tr key={`expand-${kw.keyword}`}>
                              <td colSpan={8} className="bg-slate-50/50 p-6 border-b border-slate-200">
                                <motion.div 
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="space-y-6 overflow-hidden"
                                >
                                  {loadingAudits[kw.keyword] ? (
                                    <div className="py-12 flex flex-col items-center justify-center space-y-4">
                                      <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                                        className="text-blue-600"
                                      >
                                        <RefreshCw className="h-10 w-10" />
                                      </motion.div>
                                      <div className="text-center space-y-3 max-w-md">
                                        <h4 className="font-extrabold text-slate-800 text-sm">Deep AI SEO Keyword Audit in progress...</h4>
                                        <p className="text-xs text-slate-500">
                                          Gemini is performing real-time search engine result (SERP) grounding, analyzing competitor word counts, extracting Featured Snippets, and compiling People Also Ask questions.
                                        </p>
                                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                          <motion.div 
                                            className="bg-blue-600 h-full rounded-full" 
                                            initial={{ width: "0%" }}
                                            animate={{ width: "100%" }}
                                            transition={{ duration: 4 }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  ) : deepAudits[kw.keyword] ? (
                                    (() => {
                                      const audit = deepAudits[kw.keyword];
                                      return (
                                        <div className="space-y-6 text-slate-700">
                                          {/* Top Stats and Indicators */}
                                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            {/* Average Word Count */}
                                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                                              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Avg Content Length</span>
                                              <span className="text-2xl font-extrabold text-slate-900 font-mono">{audit.averageContentLength.toLocaleString()}</span>
                                              <span className="text-xs text-slate-500 block">words recommended</span>
                                            </div>

                                            {/* Freshness Requirement */}
                                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                                              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Content Freshness</span>
                                              <div className="flex items-center gap-1.5">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                                  audit.freshnessRequirements.level === "High" 
                                                    ? "text-rose-700 bg-rose-50 border border-rose-100" 
                                                    : audit.freshnessRequirements.level === "Medium"
                                                      ? "text-amber-700 bg-amber-50 border border-amber-100"
                                                      : "text-green-700 bg-green-50 border border-green-100"
                                                }`}>
                                                  {audit.freshnessRequirements.level}
                                                </span>
                                                <span className="text-xs font-mono font-bold text-slate-600">({audit.freshnessRequirements.recommendedUpdateFrequency})</span>
                                              </div>
                                              <span className="text-[10px] text-slate-500 block leading-tight pt-1">{audit.freshnessRequirements.explanation}</span>
                                            </div>

                                            {/* Dominant Content Type */}
                                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                                              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Dominant Format</span>
                                              <span className="text-base font-extrabold text-slate-800 block">{audit.contentTypeAnalysis.dominantType}</span>
                                              <div className="space-y-1.5 pt-1">
                                                {audit.contentTypeAnalysis.percentageBreakdown.slice(0, 2).map((item, iIdx) => (
                                                  <div key={iIdx} className="text-[10px] flex justify-between items-center text-slate-500">
                                                    <span>{item.type}</span>
                                                    <span className="font-mono font-bold text-slate-700">{item.percentage}%</span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>

                                            {/* Snippet Format */}
                                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                                              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Featured Snippet Opportunity</span>
                                              <div className="flex items-center gap-1.5">
                                                <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded text-xs font-bold uppercase">
                                                  {audit.featuredSnippet.format}
                                                </span>
                                              </div>
                                              <p className="text-[10px] text-slate-500 leading-tight block pt-1">{audit.featuredSnippet.optimizedOpportunity}</p>
                                            </div>
                                          </div>

                                          {/* Two Column Section */}
                                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                            {/* Left Column: Top 10 SERP (7 Columns) */}
                                            <div className="lg:col-span-7 space-y-3">
                                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <BarChart2 className="h-4 w-4 text-blue-600" />
                                                <span>Google SERP Top 10 Competitors & Word Count</span>
                                              </h4>
                                              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                                                <div className="overflow-x-auto">
                                                  <table className="w-full text-left text-xs divide-y divide-slate-100">
                                                    <thead>
                                                      <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                        <th className="py-2.5 px-4 w-10">Pos</th>
                                                        <th className="py-2.5 px-4">Title & URL</th>
                                                        <th className="py-2.5 px-4 text-center">Type</th>
                                                        <th className="py-2.5 px-4 text-right">Length</th>
                                                        <th className="py-2.5 px-4 text-center">DR</th>
                                                        <th className="py-2.5 px-4 text-center">Age</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 font-medium">
                                                      {audit.topResults.map((res, rIdx) => (
                                                        <tr key={rIdx} className="hover:bg-slate-50/50">
                                                          <td className="py-2.5 px-4 font-mono font-bold text-blue-600 font-extrabold">
                                                            #{res.rank}
                                                          </td>
                                                          <td className="py-2.5 px-4 max-w-xs md:max-w-md truncate">
                                                            <div className="truncate">
                                                              <a href={res.url} target="_blank" rel="noopener noreferrer" className="font-bold text-slate-800 hover:text-blue-600 flex items-center gap-1">
                                                                <span className="truncate">{res.title}</span>
                                                                <ExternalLink className="h-3 w-3 inline shrink-0 text-slate-400" />
                                                              </a>
                                                              <span className="text-[9px] text-slate-400 font-mono block truncate">{res.url}</span>
                                                            </div>
                                                          </td>
                                                          <td className="py-2.5 px-4 text-center text-slate-500 whitespace-nowrap">
                                                            {res.contentType}
                                                          </td>
                                                          <td className="py-2.5 px-4 text-right font-mono text-slate-900 font-bold">
                                                            {res.contentLength.toLocaleString()}
                                                          </td>
                                                          <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-500">
                                                            {res.domainRating}
                                                          </td>
                                                          <td className="py-2.5 px-4 text-center">
                                                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                                              res.freshnessScore === "Fresh" 
                                                                ? "text-green-700 bg-green-50" 
                                                                : res.freshnessScore === "Stable"
                                                                  ? "text-slate-600 bg-slate-100"
                                                                  : "text-amber-700 bg-amber-50"
                                                            }`}>
                                                              {res.freshnessScore}
                                                            </span>
                                                          </td>
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Right Column: Featured Snippet & Subtopics (5 Columns) */}
                                            <div className="lg:col-span-5 space-y-4">
                                              {/* Position Zero Snippet Details */}
                                              <div className="space-y-2">
                                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                  <Award className="h-4 w-4 text-blue-600" />
                                                  <span>Featured Snippet Breakdown</span>
                                                </h4>
                                                <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200/60 space-y-3">
                                                  <div className="flex justify-between items-center text-[10px]">
                                                    <span className="text-amber-800 font-bold uppercase tracking-wider">Position Zero Content ({audit.featuredSnippet.format})</span>
                                                    <span className="bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded text-[9px]">Live format</span>
                                                  </div>
                                                  <div className="bg-white p-3 rounded-lg border border-amber-200/50 text-xs italic text-slate-600 font-mono whitespace-pre-line leading-relaxed shadow-3xs">
                                                    "{audit.featuredSnippet.extractedText}"
                                                  </div>
                                                  <div className="text-xs space-y-1">
                                                    <span className="font-extrabold text-slate-800 block">How to Capture Position 0:</span>
                                                    <p className="text-slate-600 leading-tight">{audit.featuredSnippet.optimizedOpportunity}</p>
                                                  </div>
                                                </div>
                                              </div>

                                              {/* Common Subtopics */}
                                              <div className="space-y-2">
                                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                  <Layers className="h-4 w-4 text-blue-600" />
                                                  <span>Key Common Subtopics Required</span>
                                                </h4>
                                                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-2xs font-medium">
                                                  {audit.commonSubtopics.map((sub, sIdx) => (
                                                    <div key={sIdx} className="space-y-1">
                                                      <div className="flex justify-between text-xs font-bold">
                                                        <span className="text-slate-800">{sub.subtopic}</span>
                                                        <span className="text-blue-600 font-mono text-[10px]">{sub.relevance}% relevance</span>
                                                      </div>
                                                      <p className="text-[11px] text-slate-500 leading-tight font-medium">{sub.description}</p>
                                                      <div className="w-full bg-slate-100 rounded-full h-1">
                                                        <div className="bg-blue-600 h-full rounded-full" style={{ width: `${sub.relevance}%` }} />
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            </div>
                                          </div>

                                          {/* Bottom Row: People Also Ask & Related Searches */}
                                          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                            {/* PAA Questions (7 Columns) */}
                                            <div className="md:col-span-7 space-y-3">
                                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <HelpCircle className="h-4 w-4 text-blue-600" />
                                                <span>"People Also Ask" (PAA) Intent Structure</span>
                                              </h4>
                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {audit.peopleAlsoAsk.map((paa, pIdx) => (
                                                  <div key={pIdx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1.5 hover:border-blue-300 transition-colors">
                                                    <div className="flex items-start gap-2">
                                                      <span className="text-blue-600 font-bold text-sm shrink-0 font-extrabold">Q:</span>
                                                      <span className="font-extrabold text-slate-900 text-xs leading-snug">{paa.question}</span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium pl-4">{paa.answer}</p>
                                                    {paa.sourceUrl && (
                                                      <a href={paa.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[9.5px] text-blue-600 hover:underline block font-mono pl-4 truncate">
                                                        Source: {paa.sourceUrl}
                                                      </a>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>

                                            {/* Related Searches (5 Columns) */}
                                            <div className="md:col-span-5 space-y-3">
                                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <Search className="h-4 w-4 text-blue-600" />
                                                <span>Related Long-Tail Searches</span>
                                              </h4>
                                              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                                                <div className="flex flex-wrap gap-1.5">
                                                  {audit.relatedSearches.map((term, tIdx) => (
                                                    <button
                                                      key={tIdx}
                                                      onClick={() => setSearchTerm(term)}
                                                      className="text-[11px] bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 hover:text-blue-700 px-3 py-1.5 rounded-lg text-slate-700 transition-all font-semibold cursor-pointer"
                                                    >
                                                      {term}
                                                    </button>
                                                  ))}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    <div className="py-8 text-center text-slate-400 text-xs">
                                      <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-slate-300" />
                                      Initiating Audit...
                                    </div>
                                  )}
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
                      <HelpCircle className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                      No keywords match your current search and filter settings.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      ) : (
        /* Rich Keyword Clustering Views */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left panel: Semantic Clusters list (7 Columns) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-blue-600" />
                  <span>Semantic Keyword Clustering</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">We grouped keywords with similar intent into semantic parent topics to design a perfect Hub & Spoke Content Model.</p>
              </div>

              <div className="space-y-4 pt-2">
                {clusters.map((cluster, idx) => (
                  <div 
                    key={idx} 
                    className="p-5 rounded-2xl border border-slate-200 hover:border-blue-300 transition-all space-y-4 bg-white shadow-2xs"
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="text-[9px] font-extrabold uppercase bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                          Topic Cluster {idx + 1}
                        </span>
                        <h4 className="font-extrabold text-slate-900 text-base mt-1">{cluster.name}</h4>
                      </div>
                      
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-tight block">Combined Vol</span>
                        <span className="text-base font-extrabold text-slate-900 font-mono">{cluster.totalVolume.toLocaleString()} / mo</span>
                      </div>
                    </div>

                    {/* Stats strip */}
                    <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-center text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Keywords</span>
                        <span className="font-bold text-slate-800 text-sm mt-0.5 block">{cluster.keywords.length} terms</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Avg Difficulty</span>
                        <span className={`font-bold text-sm mt-0.5 block ${
                          cluster.avgDifficulty < 35 ? "text-green-600" : cluster.avgDifficulty < 65 ? "text-amber-600" : "text-rose-600"
                        }`}>{cluster.avgDifficulty}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Avg CPC</span>
                        <span className="font-bold text-slate-800 text-sm mt-0.5 block font-mono">${cluster.avgCpc}</span>
                      </div>
                    </div>

                    {/* Keywords tags inside */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Discovered Keywords in Cluster:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {cluster.keywords.map((k, kIdx) => (
                          <span 
                            key={kIdx} 
                            className="text-xs bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg text-slate-700 flex items-center gap-1.5 font-medium"
                          >
                            <span>{k.keyword}</span>
                            <span className="font-mono text-[10px] text-slate-400 font-semibold">({k.volume})</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Pillar Content Opportunity */}
                    {cluster.pillarOpportunity && (
                      <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100/50 flex flex-col sm:flex-row gap-3 items-start justify-between">
                        <div className="space-y-1">
                          <span className="text-[9.5px] font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                            <Award className="h-3.5 w-3.5" />
                            <span>Recommended Pillar Cornerstone Content</span>
                          </span>
                          <p className="text-sm font-bold text-slate-800">"{cluster.pillarOpportunity.keyword}"</p>
                          <p className="text-[11px] text-slate-500 font-medium">Create an exhaustive 2,500+ word ultimate guide to anchor this cluster.</p>
                        </div>
                        {onSelectKeyword && (
                          <button
                            onClick={() => onSelectKeyword(cluster.pillarOpportunity!.keyword)}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-all shadow-xs shrink-0 cursor-pointer"
                          >
                            Write Article Outline
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel: Funnel Stages & Opportunity Scores (5 Columns) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Opportunity Scores Prioritized */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-600" />
                  <span>Opportunity Priority Index</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">High-ROI target queries ranked by search volume, low keyword difficulty, and CPC monetization potential.</p>
              </div>

              <div className="space-y-2 pt-2">
                {[...keywords]
                  .sort((a, b) => b.opportunityScore - a.opportunityScore)
                  .slice(0, 5)
                  .map((k, idx) => (
                    <div 
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-100 hover:border-blue-200 bg-slate-50/50 hover:bg-white transition-all flex items-center justify-between"
                    >
                      <div className="space-y-0.5 truncate">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-xs font-bold text-slate-400 font-mono">#{idx + 1}</span>
                          <span className="text-sm font-bold text-slate-800 truncate">{k.keyword}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium block">
                          Vol: {k.volume} • Diff: {k.difficulty} • CPC: ${k.cpc}
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="bg-blue-50 text-blue-700 font-black text-sm px-2 py-1 rounded border border-blue-100 font-mono">
                          {k.opportunityScore} Opp
                        </div>
                      </div>
                    </div>
                ))}
              </div>
            </div>

            {/* Buyer Journey Stage columns */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Workflow className="h-5 w-5 text-blue-600" />
                  <span>Buyer Journey Mapping</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">Aligning search queries with your marketing funnel to drive structured traffic conversion.</p>
              </div>

              <div className="space-y-4 pt-2">
                {/* Awareness */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-blue-50/50 p-2.5 rounded-xl border border-blue-100">
                    <span className="text-xs font-extrabold text-blue-700 uppercase tracking-widest block">1. Awareness (TOFU)</span>
                    <span className="text-[10.5px] font-bold text-blue-600 bg-white border border-blue-100 px-1.5 py-0.5 rounded-md">
                      {journeyStages.Awareness.length} terms
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Captures cold users looking for educational guides, solutions, and tutorials.</p>
                  <div className="flex flex-wrap gap-1">
                    {journeyStages.Awareness.slice(0, 4).map((k, i) => (
                      <span key={i} className="text-[10px] font-medium bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg text-slate-600">
                        {k.keyword}
                      </span>
                    ))}
                    {journeyStages.Awareness.length > 4 && (
                      <span className="text-[10px] font-bold text-slate-400 px-1.5 mt-0.5">+{journeyStages.Awareness.length - 4} more</span>
                    )}
                  </div>
                </div>

                {/* Consideration */}
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="flex justify-between items-center bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                    <span className="text-xs font-extrabold text-amber-700 uppercase tracking-widest block">2. Consideration (MOFU)</span>
                    <span className="text-[10.5px] font-bold text-amber-600 bg-white border border-amber-100 px-1.5 py-0.5 rounded-md">
                      {journeyStages.Consideration.length} terms
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Captures warm prospects comparing tools, checking reviews, and sizing alternatives.</p>
                  <div className="flex flex-wrap gap-1">
                    {journeyStages.Consideration.slice(0, 4).map((k, i) => (
                      <span key={i} className="text-[10px] font-medium bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg text-slate-600">
                        {k.keyword}
                      </span>
                    ))}
                    {journeyStages.Consideration.length > 4 && (
                      <span className="text-[10px] font-bold text-slate-400 px-1.5 mt-0.5">+{journeyStages.Consideration.length - 4} more</span>
                    )}
                  </div>
                </div>

                {/* Decision */}
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="flex justify-between items-center bg-rose-50/50 p-2.5 rounded-xl border border-rose-100">
                    <span className="text-xs font-extrabold text-rose-700 uppercase tracking-widest block">3. Decision (BOFU)</span>
                    <span className="text-[10.5px] font-bold text-rose-600 bg-white border border-rose-100 px-1.5 py-0.5 rounded-md">
                      {journeyStages.Decision.length} terms
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Captures ready-to-buy users looking for pricing pages, templates, or calculators.</p>
                  <div className="flex flex-wrap gap-1">
                    {journeyStages.Decision.slice(0, 4).map((k, i) => (
                      <span key={i} className="text-[10px] font-medium bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg text-slate-600">
                        {k.keyword}
                      </span>
                    ))}
                    {journeyStages.Decision.length > 4 && (
                      <span className="text-[10px] font-bold text-slate-400 px-1.5 mt-0.5">+{journeyStages.Decision.length - 4} more</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
