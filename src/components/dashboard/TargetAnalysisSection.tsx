import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  FileText,
  Zap,
  MessageSquare,
  Hash,
  Share2,
  Award,
  Compass,
  Lightbulb,
  ShieldCheck,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Globe,
  ArrowRight,
  TrendingUp,
  Swords,
  Target,
  Users,
  BarChart3,
  Map,
  Rocket,
  ExternalLink,
  Crosshair,
  Layers,
} from "lucide-react";
import type {
  TargetAnalysis,
  ContentGap,
  SerpFeature,
  DomainMetrics,
  BlogPost,
  DiscoveredCompetitor,
  MarketResearchReport,
  RankingBlueprint,
} from "../../types";
import { formatNum } from "./utils";

export interface TargetAnalysisSectionProps {
  target: DomainMetrics;
  targetAnalysis: TargetAnalysis;
  contentGaps?: ContentGap[];
  serpFeatures?: SerpFeature[];
  autonomousBlog?: BlogPost;
  discoveredCompetitors?: DiscoveredCompetitor[];
  competitor?: DomainMetrics | null;
  rankingBlueprint?: RankingBlueprint;
  marketResearch?: MarketResearchReport;
  onViewAutonomousBlog?: () => void;
  onSelectCompetitor?: (domain: string) => void;
}

function ThreatBadge({ level }: { level?: string }) {
  const l = (level || "Medium").toLowerCase();
  const cls =
    l === "high"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : l === "low"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-amber-50 text-amber-700 border-amber-200";
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cls}`}>
      {level || "Medium"} threat
    </span>
  );
}

function IntensityBadge({ level }: { level?: string }) {
  const l = level || "Moderate";
  const cls =
    l === "Very High" || l === "High"
      ? "bg-rose-50 text-rose-800 border-rose-200"
      : l === "Low"
        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
        : "bg-amber-50 text-amber-800 border-amber-200";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${cls}`}>
      <Swords className="h-3.5 w-3.5" />
      {l} competition
    </span>
  );
}

export default function TargetAnalysisSection({
  target,
  targetAnalysis,
  contentGaps = [],
  serpFeatures = [],
  autonomousBlog,
  discoveredCompetitors = [],
  competitor = null,
  rankingBlueprint,
  marketResearch: marketResearchProp,
  onViewAutonomousBlog,
  onSelectCompetitor,
}: TargetAnalysisSectionProps) {
  const [activePhase, setActivePhase] = useState<"phase1" | "phase2" | "phase3">("phase1");
  const [expandedComp, setExpandedComp] = useState<number | null>(0);
  const [compFilter, setCompFilter] = useState<"all" | "High" | "Medium" | "Low">("all");

  const market: MarketResearchReport | undefined = useMemo(() => {
    return marketResearchProp || targetAnalysis.marketResearch;
  }, [marketResearchProp, targetAnalysis.marketResearch]);

  const comps = useMemo(() => {
    const list = [...(discoveredCompetitors || [])].sort(
      (a, b) => (b.nicheSimilarity || 0) - (a.nicheSimilarity || 0)
    );
    if (compFilter === "all") return list;
    return list.filter((c) => (c.threatLevel || "Medium") === compFilter);
  }, [discoveredCompetitors, compFilter]);

  const highThreat = discoveredCompetitors.filter((c) => c.threatLevel === "High").length;
  const avgSim = discoveredCompetitors.length
    ? Math.round(
        discoveredCompetitors.reduce((s, c) => s + (c.nicheSimilarity || 0), 0) /
          discoveredCompetitors.length
      )
    : 0;
  const totalCompTraffic = discoveredCompetitors.reduce(
    (s, c) => s + (c.estimatedMonthlyTraffic || 0),
    0
  );
  const quickWins = contentGaps.filter((g) => g.isQuickWin).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6"
      id="strategic-research-report"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <span className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Compass className="h-6 w-6 text-blue-600" />
          </span>
          <div>
            <h3 className="text-lg md:text-xl font-bold text-slate-900 flex items-center gap-2">
              Website Content Intelligence & Strategic Research Report
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Fully automated audit of{" "}
              <span className="text-blue-600 font-semibold">{target.domain}</span> — content, competitors,
              market demand, and opportunities
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wider self-start md:self-center">
          <ShieldCheck className="h-4 w-4" />
          <span>Audit Complete</span>
        </div>
      </div>

      {/* Phase tabs */}
      <div className="flex flex-col sm:flex-row gap-2.5 p-1.5 bg-slate-100 rounded-xl border border-slate-200">
        <button
          onClick={() => setActivePhase("phase1")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-xs font-bold tracking-wider uppercase transition-all duration-150 cursor-pointer ${
            activePhase === "phase1"
              ? "bg-white text-blue-700 shadow-xs"
              : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          <span>Phase 1: Content Audit</span>
        </button>
        <button
          onClick={() => setActivePhase("phase2")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-xs font-bold tracking-wider uppercase transition-all duration-150 cursor-pointer ${
            activePhase === "phase2"
              ? "bg-white text-blue-700 shadow-xs"
              : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
          }`}
        >
          <Globe className="h-4 w-4" />
          <span>Phase 2: Competitor & Market Research</span>
        </button>
        <button
          onClick={() => setActivePhase("phase3")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-xs font-bold tracking-wider uppercase transition-all duration-150 cursor-pointer ${
            activePhase === "phase3"
              ? "bg-white text-blue-700 shadow-xs"
              : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
          }`}
        >
          <Lightbulb className="h-4 w-4" />
          <span>Phase 3: Opportunity Identification</span>
        </button>
      </div>

      <div className="min-h-[400px] pt-2">
        {/* PHASE 1 */}
        {activePhase === "phase1" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2.5 p-5 rounded-2xl bg-slate-50/70 border border-slate-200/50">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Compass className="h-4 w-4 text-slate-400" />
                  <span>Target Core Niche</span>
                </h4>
                <p className="text-base font-bold text-slate-800">{targetAnalysis.coreNiche}</p>
              </div>
              <div className="space-y-2.5 p-5 rounded-2xl bg-slate-50/70 border border-slate-200/50">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-slate-400" />
                  <span>Audience Persona Focus</span>
                </h4>
                <p className="text-base font-bold text-slate-800">{targetAnalysis.audiencePersona}</p>
              </div>
            </div>

            <div className="p-5 bg-blue-50/40 rounded-2xl border border-blue-100/40 space-y-2.5">
              <h4 className="text-xs font-extrabold text-blue-800 uppercase tracking-widest flex items-center gap-1.5">
                <Award className="h-4 w-4 text-blue-600" />
                <span>Executive Strategic Assessment</span>
              </h4>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">
                {targetAnalysis.detailedBreakdown}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="p-5 rounded-2xl border border-slate-200/70 space-y-4">
                <h4 className="text-xs font-extrabold text-green-700 uppercase tracking-widest flex items-center gap-1.5">
                  <CheckCircle2 className="h-4.5 w-4.5 text-green-600" />
                  <span>Content Strengths Inventory</span>
                </h4>
                <ul className="space-y-3">
                  {(targetAnalysis.contentStrengths || []).map((strength, i) => (
                    <li key={i} className="text-sm text-slate-600 flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0 mt-2" />
                      <span className="font-medium">{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-5 rounded-2xl border border-slate-200/70 space-y-4">
                <h4 className="text-xs font-extrabold text-amber-700 uppercase tracking-widest flex items-center gap-1.5">
                  <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
                  <span>Content Defects & Gaps Identified</span>
                </h4>
                <ul className="space-y-3">
                  {(targetAnalysis.contentWeaknesses || []).map((weakness, i) => (
                    <li key={i} className="text-sm text-slate-600 flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-2" />
                      <span className="font-medium">{weakness}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-slate-400" />
                <span>Technical SEO & Structural Schema Validation</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    t: "Title & Meta Length",
                    d: "Verified target headers. Clean lengths (50-60 chars) compliant with Google display truncations.",
                  },
                  {
                    t: "Structured FAQ JSON-LD",
                    d: "Ready. Structured schema automatically injected into generated SEO articles to claim rich search cards.",
                  },
                  {
                    t: "Article Graph Schema",
                    d: "Validated. Automated Article schema constructed with author entities to secure crawling credentials.",
                  },
                  {
                    t: "Mobile Responsive Structure",
                    d: "Responsive layouts matched. CSS fluidities conform to dynamic viewport resizing without overflow defect.",
                  },
                ].map((item) => (
                  <div
                    key={item.t}
                    className="bg-white p-4 rounded-xl border border-slate-200 flex items-start gap-3"
                  >
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <h6 className="text-sm font-bold text-slate-800">{item.t}</h6>
                      <p className="text-xs text-slate-500 mt-1">{item.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PHASE 2: COMPETITOR & MARKET RESEARCH — full report */}
        {activePhase === "phase2" && (
          <div className="space-y-8">
            {/* Report hero */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-white p-6 md:p-8">
              <div className="absolute -right-8 -top-8 opacity-10 pointer-events-none">
                <BarChart3 className="h-48 w-48 text-blue-300" />
              </div>
              <div className="relative z-10 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300">
                    <Map className="h-3 w-3" />
                    Market research dossier
                  </span>
                  {market && <IntensityBadge level={market.competitiveIntensity} />}
                </div>
                <h4 className="text-xl md:text-2xl font-bold tracking-tight max-w-3xl">
                  Competitive landscape for {target.domain}
                </h4>
                <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
                  {market?.executiveSummary ||
                    targetAnalysis.detailedBreakdown ||
                    "Market research summary will appear after analysis."}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                  {[
                    {
                      label: "Peers tracked",
                      value: String(discoveredCompetitors.length),
                      icon: Globe,
                    },
                    {
                      label: "High-threat rivals",
                      value: String(highThreat),
                      icon: Swords,
                    },
                    {
                      label: "Avg. niche overlap",
                      value: `${avgSim}%`,
                      icon: Crosshair,
                    },
                    {
                      label: "Peer traffic (est.)",
                      value: formatNum(totalCompTraffic),
                      icon: TrendingUp,
                    },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      className="rounded-xl bg-white/5 border border-white/10 p-3.5 space-y-1"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        <kpi.icon className="h-3 w-3" />
                        {kpi.label}
                      </div>
                      <div className="text-xl font-bold text-white font-mono">{kpi.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Market overview + demand */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 p-5 rounded-2xl border border-slate-200 bg-slate-50/40 space-y-3">
                <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-blue-600" />
                  Market overview
                </h4>
                <p className="text-sm text-slate-700 leading-relaxed font-medium">
                  {market?.marketOverview ||
                    `The ${targetAnalysis.coreNiche} category rewards specialists who educate early and convert with trust.`}
                </p>
                {market?.intensityRationale && (
                  <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-200 pt-3">
                    <strong className="text-slate-700">Competitive intensity: </strong>
                    {market.intensityRationale}
                  </p>
                )}
              </div>
              <div className="lg:col-span-2 p-5 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  Demand drivers
                </h4>
                <ul className="space-y-2.5">
                  {(market?.demandDrivers || []).map((d, i) => (
                    <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-[10px] font-bold text-emerald-700 border border-emerald-100">
                        {i + 1}
                      </span>
                      <span className="font-medium leading-snug">{d}</span>
                    </li>
                  ))}
                  {!(market?.demandDrivers || []).length && (
                    <li className="text-xs text-slate-400">Demand drivers will populate after analysis.</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Buyer segments + head-to-head */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl border border-slate-200 space-y-4">
                <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-violet-600" />
                  Buyer segments
                </h4>
                <div className="space-y-3">
                  {(market?.buyerSegments || []).map((seg, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-800">{seg.segment}</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{seg.intent}</p>
                      </div>
                      <span
                        className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          seg.priority === "Primary"
                            ? "bg-blue-50 text-blue-700 border-blue-100"
                            : seg.priority === "Secondary"
                              ? "bg-slate-100 text-slate-600 border-slate-200"
                              : "bg-violet-50 text-violet-700 border-violet-100"
                        }`}
                      >
                        {seg.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-slate-200 space-y-4">
                <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Target className="h-4 w-4 text-blue-600" />
                  Head-to-head snapshot
                </h4>
                {competitor ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <span>Metric</span>
                      <span className="text-blue-600 truncate">{target.domain}</span>
                      <span className="text-slate-600 truncate">{competitor.domain}</span>
                    </div>
                    {[
                      {
                        label: "Domain rating",
                        a: target.domainRating,
                        b: competitor.domainRating,
                      },
                      {
                        label: "Org. traffic",
                        a: target.organicTraffic,
                        b: competitor.organicTraffic,
                        fmt: true,
                      },
                      {
                        label: "Keywords",
                        a: target.organicKeywords,
                        b: competitor.organicKeywords,
                        fmt: true,
                      },
                      {
                        label: "Backlinks",
                        a: target.backlinksCount,
                        b: competitor.backlinksCount,
                        fmt: true,
                      },
                    ].map((row) => {
                      const leadA = row.a >= row.b;
                      return (
                        <div
                          key={row.label}
                          className="grid grid-cols-3 gap-2 items-center py-2 border-t border-slate-100 text-sm"
                        >
                          <span className="text-xs font-semibold text-slate-500">{row.label}</span>
                          <span
                            className={`font-mono font-bold text-center ${leadA ? "text-blue-700" : "text-slate-700"}`}
                          >
                            {row.fmt ? formatNum(row.a) : row.a}
                          </span>
                          <span
                            className={`font-mono font-bold text-center ${!leadA ? "text-rose-600" : "text-slate-600"}`}
                          >
                            {row.fmt ? formatNum(row.b) : row.b}
                          </span>
                        </div>
                      );
                    })}
                    <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                      Publishing: <strong className="text-slate-700">{target.publishingFrequency}</strong> vs{" "}
                      <strong className="text-slate-700">{competitor.publishingFrequency}</strong>
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 p-5 text-center space-y-2">
                    <p className="text-sm font-semibold text-slate-700">No primary competitor selected</p>
                    <p className="text-xs text-slate-500">
                      Pick a peer below (Compare) or enter a competitor URL and re-run analysis for a full
                      head-to-head.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* SWOT */}
            {market?.swot && (
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-slate-500" />
                  Competitive SWOT
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {(
                    [
                      {
                        key: "strengths",
                        title: "Strengths",
                        items: market.swot.strengths,
                        color: "emerald",
                      },
                      {
                        key: "weaknesses",
                        title: "Weaknesses",
                        items: market.swot.weaknesses,
                        color: "amber",
                      },
                      {
                        key: "opportunities",
                        title: "Opportunities",
                        items: market.swot.opportunities,
                        color: "blue",
                      },
                      {
                        key: "threats",
                        title: "Threats",
                        items: market.swot.threats,
                        color: "rose",
                      },
                    ] as const
                  ).map((box) => (
                    <div
                      key={box.key}
                      className={`p-4 rounded-2xl border space-y-3 ${
                        box.color === "emerald"
                          ? "bg-emerald-50/40 border-emerald-100"
                          : box.color === "amber"
                            ? "bg-amber-50/40 border-amber-100"
                            : box.color === "blue"
                              ? "bg-blue-50/40 border-blue-100"
                              : "bg-rose-50/40 border-rose-100"
                      }`}
                    >
                      <h5
                        className={`text-xs font-extrabold uppercase tracking-wider ${
                          box.color === "emerald"
                            ? "text-emerald-800"
                            : box.color === "amber"
                              ? "text-amber-800"
                              : box.color === "blue"
                                ? "text-blue-800"
                                : "text-rose-800"
                        }`}
                      >
                        {box.title}
                      </h5>
                      <ul className="space-y-2">
                        {box.items.map((item, i) => (
                          <li key={i} className="text-xs text-slate-700 font-medium leading-snug flex gap-2">
                            <span className="text-slate-400">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Positioning + whitespace */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/50 to-white space-y-3">
                <h4 className="text-xs font-extrabold text-blue-800 uppercase tracking-widest flex items-center gap-1.5">
                  <Crosshair className="h-4 w-4" />
                  Positioning recommendation
                </h4>
                <p className="text-sm text-slate-700 leading-relaxed font-medium">
                  {market?.positioningRecommendation ||
                    `Position as a practical specialist in ${targetAnalysis.coreNiche} with clearer proof and deeper long-tail content.`}
                </p>
              </div>
              <div className="p-5 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-violet-600" />
                  Whitespace opportunities
                </h4>
                <ul className="space-y-2">
                  {(market?.whitespaceOpportunities || []).map((w, i) => (
                    <li
                      key={i}
                      className="text-sm text-slate-700 font-medium flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100"
                    >
                      <CheckCircle2 className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Channel mix + 90-day plays */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">
                  Channel mix
                </h4>
                <div className="space-y-2">
                  {(market?.channelMix || []).map((ch, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 bg-white"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-800">{ch.channel}</p>
                        <p className="text-[11px] text-slate-500">{ch.role}</p>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          ch.priority === "High"
                            ? "bg-blue-50 text-blue-700 border-blue-100"
                            : ch.priority === "Medium"
                              ? "bg-slate-50 text-slate-600 border-slate-200"
                              : "bg-slate-50 text-slate-400 border-slate-100"
                        }`}
                      >
                        {ch.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-5 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Rocket className="h-4 w-4 text-blue-600" />
                  90-day competitive plays
                </h4>
                <div className="space-y-2.5">
                  {(market?.ninetyDayPlays || []).map((play, i) => (
                    <div key={i} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/80 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-slate-800">
                          {i + 1}. {play.play}
                        </p>
                        <span className="shrink-0 text-[10px] font-bold text-slate-500 uppercase">
                          {play.effort} effort
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{play.why}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Social / listening */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-indigo-50/40 to-purple-50/30 p-5 rounded-2xl border border-indigo-100/40 space-y-3">
                <h4 className="text-xs font-extrabold text-indigo-800 uppercase tracking-widest flex items-center gap-1.5">
                  <MessageSquare className="h-4.5 w-4.5 text-indigo-600" />
                  Web & social listening
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed font-medium">
                  {targetAnalysis.socialPresenceSummary ||
                    "Social and community conversation signals will appear after a full AI analysis."}
                </p>
                {(targetAnalysis.socialMentionKeywords || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(targetAnalysis.socialMentionKeywords || []).map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-white border border-indigo-100 text-indigo-700 rounded-lg"
                      >
                        <Hash className="h-3 w-3 text-indigo-400" />
                        {tag.replace(/^#/, "")}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-gradient-to-br from-amber-50/40 to-orange-50/30 p-5 rounded-2xl border border-amber-100/40 space-y-3">
                <h4 className="text-xs font-extrabold text-amber-800 uppercase tracking-widest flex items-center gap-1.5">
                  <Share2 className="h-4.5 w-4.5 text-amber-600" />
                  Competitor brand listening
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed font-medium">
                  {targetAnalysis.competitorSocialInsights ||
                    "Competitor conversation patterns will appear after a full AI analysis."}
                </p>
              </div>
            </div>

            {/* Competitor intelligence cards */}
            <div className="space-y-4" id="phase2-competitor-cards">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Swords className="h-4 w-4 text-blue-600" />
                    Competitor intelligence dossier
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {discoveredCompetitors.length} peers researched — ranked by niche overlap
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(["all", "High", "Medium", "Low"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setCompFilter(f)}
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border cursor-pointer transition-all ${
                        compFilter === f
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {f === "all" ? "All" : `${f} threat`}
                    </button>
                  ))}
                </div>
              </div>

              {comps.length === 0 ? (
                <div className="text-center py-10 text-sm text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                  No competitors matched this filter. Try “All” or re-run analysis.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {comps.map((comp, idx) => {
                    const isExpanded = expandedComp === idx;
                    return (
                      <div
                        key={`${comp.domain}-${idx}`}
                        className={`rounded-2xl border bg-white transition-all ${
                          isExpanded
                            ? "border-blue-300 shadow-md ring-1 ring-blue-100"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="p-5 flex flex-col lg:flex-row lg:items-start gap-4">
                          <div className="flex-1 space-y-3 min-w-0">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <h5 className="text-base font-bold text-slate-900 flex items-center gap-2 break-all">
                                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-[11px] font-bold text-blue-700 shrink-0">
                                    {idx + 1}
                                  </span>
                                  {comp.domain}
                                </h5>
                                <p className="text-xs text-slate-500 mt-1 font-medium">{comp.nicheFocus}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <ThreatBadge level={comp.threatLevel} />
                                <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
                                  {comp.nicheSimilarity}% match
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2">
                                <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                                  Est. traffic
                                </p>
                                <p className="text-sm font-bold font-mono text-slate-800">
                                  {formatNum(comp.estimatedMonthlyTraffic)}/mo
                                </p>
                              </div>
                              <div className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2">
                                <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                                  Est. DR
                                </p>
                                <p className="text-sm font-bold font-mono text-slate-800">
                                  {comp.domainRating ?? "—"}
                                </p>
                              </div>
                              <div className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2">
                                <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                                  Cadence
                                </p>
                                <p className="text-xs font-bold text-slate-800">
                                  {comp.contentCadence || "—"}
                                </p>
                              </div>
                              <div className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2">
                                <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                                  Keywords
                                </p>
                                <p className="text-xs font-bold text-slate-800 truncate">
                                  {(comp.targetKeywords || []).slice(0, 2).join(", ") || "—"}
                                </p>
                              </div>
                            </div>

                            <p className="text-sm text-slate-600 leading-relaxed">
                              {comp.analyzedTakeaway}
                            </p>

                            {(comp.targetKeywords || []).length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {(comp.targetKeywords || []).slice(0, 6).map((kw, k) => (
                                  <span
                                    key={k}
                                    className="text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200"
                                  >
                                    {kw}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex lg:flex-col gap-2 shrink-0">
                            <button
                              onClick={() => setExpandedComp(isExpanded ? null : idx)}
                              className="px-3 py-2 rounded-xl text-xs font-bold border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer transition-all"
                            >
                              {isExpanded ? "Hide playbook" : "Full playbook"}
                            </button>
                            {onSelectCompetitor && (
                              <button
                                onClick={() => onSelectCompetitor(comp.domain)}
                                className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-900 hover:text-white hover:border-slate-900 cursor-pointer transition-all flex items-center justify-center gap-1"
                              >
                                <Zap className="h-3.5 w-3.5" />
                                Compare
                              </button>
                            )}
                            <a
                              href={comp.popularBlogUrl || `https://${comp.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:text-blue-700 hover:border-blue-200 flex items-center justify-center gap-1"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Visit
                            </a>
                          </div>
                        </div>

                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="px-5 pb-5 border-t border-slate-100 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4"
                          >
                            <div className="space-y-2 p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                                Where they win
                              </p>
                              <ul className="space-y-1.5">
                                {(comp.strengths || []).map((s, i) => (
                                  <li key={i} className="text-xs text-slate-700 flex gap-1.5">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                    {s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="space-y-2 p-3.5 rounded-xl bg-amber-50/50 border border-amber-100">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                                Where you can beat them
                              </p>
                              <ul className="space-y-1.5">
                                {(comp.weaknesses || []).map((s, i) => (
                                  <li key={i} className="text-xs text-slate-700 flex gap-1.5">
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                                    {s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="md:col-span-2 p-3.5 rounded-xl bg-blue-50/50 border border-blue-100 space-y-1.5">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1">
                                <Rocket className="h-3.5 w-3.5" />
                                Recommended counter-move
                              </p>
                              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                                {comp.counterMove || comp.seoStrategy}
                              </p>
                            </div>
                            {comp.seoStrategy && (
                              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                  SEO rank playbook
                                </p>
                                <p className="text-xs text-slate-600 leading-relaxed">{comp.seoStrategy}</p>
                              </div>
                            )}
                            {comp.aiRankStrategy && (
                              <div className="p-3.5 rounded-xl border border-violet-100 bg-violet-50/40 space-y-1">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-800">
                                  AI search (GEO) playbook
                                </p>
                                <p className="text-xs text-slate-600 leading-relaxed">{comp.aiRankStrategy}</p>
                              </div>
                            )}
                            {comp.latestArticleTitle && (
                              <div className="md:col-span-2 flex items-start gap-2 text-xs text-slate-600">
                                <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                                <div>
                                  <span className="text-[9px] uppercase font-bold text-slate-400 block">
                                    Sample content signal
                                  </span>
                                  <a
                                    href={comp.latestArticleUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-blue-700 hover:underline"
                                  >
                                    {comp.latestArticleTitle}
                                  </a>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Blueprint strip */}
            {rankingBlueprint?.summary && (
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
                <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Map className="h-4 w-4 text-blue-600" />
                  Ranking blueprint (from research)
                </h4>
                <p className="text-sm text-slate-700 leading-relaxed font-medium">
                  {rankingBlueprint.summary}
                </p>
                {rankingBlueprint.timelineEstimate && (
                  <p className="text-xs text-slate-500">
                    Timeline: <strong className="text-slate-700">{rankingBlueprint.timelineEstimate}</strong>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* PHASE 3 */}
        {activePhase === "phase3" && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div>
                  <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                    High-Impact Keyword Content Gaps
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Keywords competitors rank for that you can still capture
                    {quickWins > 0 ? ` · ${quickWins} quick wins` : ""}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full uppercase">
                  Action Required
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(contentGaps || []).length > 0 ? (
                  (contentGaps || []).slice(0, 8).map((gap, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-slate-200 bg-white shadow-3xs space-y-3 hover:border-blue-400 transition-all"
                    >
                       <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-extrabold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg truncate max-w-[70%]">
                          {gap?.competitorKeyword || "keyword"}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {gap?.isQuickWin && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                              Quick win
                            </span>
                          )}
                          {gap?.localIntent === "local_direct" && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                              Local SEO
                            </span>
                          )}
                          {gap?.localIntent === "local_aware" && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                              Geo-Aware
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              gap?.difficultyCategory === "Easy"
                                ? "bg-green-50 text-green-700 border border-green-100"
                                : gap?.difficultyCategory === "Medium"
                                  ? "bg-amber-50 text-amber-700 border border-amber-100"
                                  : "bg-rose-50 text-rose-700 border border-rose-100"
                            }`}
                          >
                            {gap?.difficultyCategory || "Medium"} Diff
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">
                          Recommended Topic Target
                        </span>
                        <p className="text-sm font-bold text-slate-800 line-clamp-2 mt-0.5">
                          {gap?.recommendedTopic || "Topic opportunity"}
                        </p>
                        {gap?.neighborhoods && gap.neighborhoods.length > 0 && (
                          <p className="text-[10px] text-indigo-600 mt-0.5">
                            Areas: {gap.neighborhoods.join(", ")}
                          </p>
                        )}
                        {gap?.gbpCategory && (
                          <p className="text-[10px] text-teal-600 mt-0.5">
                            GBP: {gap.gbpCategory}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                        <span>
                          Vol:{" "}
                          <strong className="text-slate-700">
                            {formatNum(gap?.competitorVolume || 0)}/mo
                          </strong>
                        </span>
                        <span>
                          Competitor:{" "}
                          <strong className="text-rose-500 font-bold">
                            Rank #{gap?.competitorRank || "—"}
                          </strong>
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 text-center py-6 text-xs text-slate-400">
                    No Content Gaps generated. Re-run analysis.
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                Google SERP Feature Opportunities & Target Actions
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {serpFeatures.length > 0 ? (
                  serpFeatures.map((feat, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-150 px-2 py-1 rounded-lg">
                          {feat.type}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-0.5">
                          <CheckCircle2 className="h-3 w-3" /> Ready to Claim
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">
                          Audited Search Query
                        </span>
                        <p className="text-sm font-bold text-slate-800 italic mt-0.5">"{feat.query}"</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">
                          Strategic Action Plan
                        </span>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                          {feat.actionability}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 text-center py-6 text-xs text-slate-400">
                    No SERP Features analyzed. Re-run analysis.
                  </div>
                )}
              </div>
            </div>

            {autonomousBlog && (
              <div className="p-5 bg-slate-900 text-white rounded-2xl border border-slate-800 relative overflow-hidden space-y-4">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Sparkles className="h-32 w-32 text-blue-400" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="space-y-2 max-w-xl">
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-500/15 border border-blue-500/30 text-[10px] font-bold text-blue-400 rounded-full uppercase tracking-wider">
                      <Zap className="h-3 w-3 animate-bounce" /> Recommended First Step Action
                    </div>
                    <h5 className="text-lg font-bold text-white leading-tight">
                      Autonomously Pre-written Optimized Blog Article
                    </h5>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Our pipeline has pre-calculated your highest-impact easy win Content Gap, structured
                      an expert-grade outline, and drafted a publication-ready blog post for:{" "}
                      <strong className="text-white font-mono block mt-1">"{autonomousBlog.title}"</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => onViewAutonomousBlog?.()}
                    className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-3 px-5 rounded-xl transition-all flex items-center gap-2 border border-blue-500/30 hover:scale-101 cursor-pointer"
                  >
                    <span>Examine Publication-Ready Article</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
