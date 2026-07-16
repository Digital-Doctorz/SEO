import { useState } from "react";
import { motion } from "motion/react";
import { 
  Globe, TrendingUp, Link, Calendar, FileText, ArrowRight, 
  Sparkles, CheckCircle2, Zap, Lightbulb, CheckSquare
} from "lucide-react";
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts";
import type { DomainMetrics, DiscoveredCompetitor, TargetAnalysis, ContentGap, SerpFeature, LocalLocation, RankingBlueprint, AiProviderConfig, BlogPost } from "../types";
import { formatNum, getComparePercent, buildTrendData } from "./dashboard/utils";
import TargetAnalysisSection from "./dashboard/TargetAnalysisSection";
import LocalSeoSection from "./dashboard/LocalSeoSection";
import CompetitorDiscovery from "./dashboard/CompetitorDiscovery";
import TopPagesSection from "./dashboard/TopPagesSection";

interface DashboardOverviewProps {
  target: DomainMetrics;
  competitor: DomainMetrics | null;
  discoveredCompetitors?: DiscoveredCompetitor[];
  targetAnalysis?: TargetAnalysis;
  autonomousBlog?: BlogPost;
  contentGaps?: ContentGap[];
  serpFeatures?: SerpFeature[];
  localLocation?: LocalLocation;
  rankingBlueprint?: RankingBlueprint;
  aiConfig: AiProviderConfig;
  onViewAutonomousBlog?: () => void;
  onSelectCompetitor?: (domain: string) => void;
}

export default function DashboardOverview({ 
  target, 
  competitor, 
  discoveredCompetitors, 
  targetAnalysis,
  autonomousBlog,
  contentGaps = [],
  serpFeatures = [],
  localLocation,
  rankingBlueprint,
  aiConfig,
  onViewAutonomousBlog,
  onSelectCompetitor 
}: DashboardOverviewProps) {
  const [selectedMetric, setSelectedMetric] = useState<"dr" | "traffic" | "backlinks" | "frequency">("dr");

  if (!target?.domain) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500 text-sm">
        No analysis target loaded. Run an analysis from the home screen first.
      </div>
    );
  }

  const trendData = buildTrendData(target.organicTraffic || 0, competitor?.organicTraffic);

  return (
    <div className="space-y-8">
      {autonomousBlog && (
        <motion.div 
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md relative overflow-hidden"
          id="autonomous-pipeline-banner"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Zap className="h-40 w-40 text-blue-400" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-xs font-semibold text-blue-400">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                Autonomous SEO Engine Active
              </div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white animate-fade-in">
                Complete Content Pipeline Executed for {target.domain}
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                Our autonomous agent has fully mapped your website's search authority, dissected top competitor content strategies, identified core semantic keywords, and generated a publication-ready pillar article optimized with structured FAQ JSON-LD schemas.
              </p>
              
              {/* Process Checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-xs font-medium text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Target Niche: <span className="text-white">{targetAnalysis?.coreNiche || 'Inferred Business'}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Selected Keyword: <span className="text-white font-mono">{autonomousBlog.slugSuggestion}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Competitive Analysis Completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Dual JSON-LD Article/FAQ Schema Built</span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => onViewAutonomousBlog?.()}
              className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-5 py-3 rounded-xl shadow-lg transition-all duration-200 flex items-center gap-2 group border border-blue-500/20 active:scale-95 cursor-pointer"
              id="view-article-btn"
            >
              View Publication-Ready Article
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Top Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Domain Rating */}
        <motion.div 
          whileHover={{ y: -6, scale: 1.02, boxShadow: "0 12px 24px -4px rgba(59, 130, 246, 0.12)" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSelectedMetric("dr")}
          className={`bg-white p-6 rounded-2xl border transition-all duration-200 relative overflow-hidden cursor-pointer ${
            selectedMetric === "dr" 
              ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md shadow-blue-50/50" 
              : "border-slate-200 shadow-xs hover:border-blue-300"
          }`}
          id="dr-card"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Authority Metric</span>
              <span className="text-sm font-extrabold text-slate-800 mt-1 block">Domain Rating</span>
            </div>
            <span className={`p-2 rounded-lg transition-colors ${
              selectedMetric === "dr" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"
            }`}>
              <Globe className="h-5 w-5" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{target.domainRating}</span>
            <span className="text-xs text-slate-400 font-bold">/ 100</span>
          </div>
          {competitor && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs font-semibold">
              <span className="text-slate-400">vs {competitor.domain}</span>
              <span className={`px-2 py-0.5 rounded ${
                target.domainRating >= competitor.domainRating 
                  ? 'text-emerald-700 bg-emerald-50' 
                  : 'text-rose-700 bg-rose-50'
              }`}>
                {competitor.domainRating} DR
              </span>
            </div>
          )}
          
          {/* Bottom active accent line */}
          <div className={`absolute bottom-0 left-0 right-0 h-1 transition-colors ${
            selectedMetric === "dr" ? "bg-blue-600" : "bg-slate-200"
          }`} />
          {/* Quick info tooltip badge on hover */}
          <div className="absolute top-2 right-12 opacity-0 hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none">
            Click for Analysis
          </div>
        </motion.div>

        {/* Monthly Organic Traffic */}
        <motion.div 
          whileHover={{ y: -6, scale: 1.02, boxShadow: "0 12px 24px -4px rgba(59, 130, 246, 0.12)" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSelectedMetric("traffic")}
          className={`bg-white p-6 rounded-2xl border transition-all duration-200 relative overflow-hidden cursor-pointer ${
            selectedMetric === "traffic" 
              ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md shadow-blue-50/50" 
              : "border-slate-200 shadow-xs hover:border-blue-300"
          }`}
          id="traffic-card"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Acquisition Metric</span>
              <span className="text-sm font-extrabold text-slate-800 mt-1 block">Monthly Est. Traffic</span>
            </div>
            <span className={`p-2 rounded-lg transition-colors ${
              selectedMetric === "traffic" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"
            }`}>
              <TrendingUp className="h-5 w-5" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{formatNum(target.organicTraffic)}</span>
            <span className="text-xs text-slate-400 font-bold">visits</span>
          </div>
          {competitor && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs font-semibold">
              <span className="text-slate-400">vs {competitor.domain}</span>
              <span className={`px-2 py-0.5 rounded ${
                target.organicTraffic >= competitor.organicTraffic 
                  ? 'text-emerald-700 bg-emerald-50' 
                  : 'text-rose-700 bg-rose-50'
              }`}>
                {formatNum(competitor.organicTraffic)}
              </span>
            </div>
          )}
          
          <div className={`absolute bottom-0 left-0 right-0 h-1 transition-colors ${
            selectedMetric === "traffic" ? "bg-blue-600" : "bg-slate-200"
          }`} />
        </motion.div>

        {/* Backlinks */}
        <motion.div 
          whileHover={{ y: -6, scale: 1.02, boxShadow: "0 12px 24px -4px rgba(59, 130, 246, 0.12)" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSelectedMetric("backlinks")}
          className={`bg-white p-6 rounded-2xl border transition-all duration-200 relative overflow-hidden cursor-pointer ${
            selectedMetric === "backlinks" 
              ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md shadow-blue-50/50" 
              : "border-slate-200 shadow-xs hover:border-blue-300"
          }`}
          id="backlinks-card"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Trust Metric</span>
              <span className="text-sm font-extrabold text-slate-800 mt-1 block">Total Backlinks</span>
            </div>
            <span className={`p-2 rounded-lg transition-colors ${
              selectedMetric === "backlinks" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"
            }`}>
              <Link className="h-5 w-5" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{formatNum(target.backlinksCount)}</span>
            <span className="text-xs text-slate-400 font-bold">links</span>
          </div>
          {competitor && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs font-semibold">
              <span className="text-slate-400">vs {competitor.domain}</span>
              <span className={`px-2 py-0.5 rounded ${
                target.backlinksCount >= competitor.backlinksCount 
                  ? 'text-emerald-700 bg-emerald-50' 
                  : 'text-rose-700 bg-rose-50'
              }`}>
                {formatNum(competitor.backlinksCount)}
              </span>
            </div>
          )}
          
          <div className={`absolute bottom-0 left-0 right-0 h-1 transition-colors ${
            selectedMetric === "backlinks" ? "bg-blue-600" : "bg-slate-200"
          }`} />
        </motion.div>

        {/* Publishing Frequency */}
        <motion.div 
          whileHover={{ y: -6, scale: 1.02, boxShadow: "0 12px 24px -4px rgba(59, 130, 246, 0.12)" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSelectedMetric("frequency")}
          className={`bg-white p-6 rounded-2xl border transition-all duration-200 relative overflow-hidden cursor-pointer ${
            selectedMetric === "frequency" 
              ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md shadow-blue-50/50" 
              : "border-slate-200 shadow-xs hover:border-blue-300"
          }`}
          id="frequency-card"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Consistency Metric</span>
              <span className="text-sm font-extrabold text-slate-800 mt-1 block">Publishing Speed</span>
            </div>
            <span className={`p-2 rounded-lg transition-colors ${
              selectedMetric === "frequency" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"
            }`}>
              <Calendar className="h-5 w-5" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-extrabold text-slate-900 line-clamp-1">{target.publishingFrequency}</span>
          </div>
          {competitor && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs font-semibold">
              <span className="text-slate-400">vs {competitor.domain}</span>
              <span className="px-2 py-0.5 rounded text-slate-700 bg-slate-100 truncate max-w-[120px]">
                {competitor.publishingFrequency}
              </span>
            </div>
          )}
          
          <div className={`absolute bottom-0 left-0 right-0 h-1 transition-colors ${
            selectedMetric === "frequency" ? "bg-blue-600" : "bg-slate-200"
          }`} />
        </motion.div>
      </div>

      {/* Interactive Metric Breakdown & Tactical Playbook Panel */}
      {selectedMetric && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 md:p-8 rounded-2xl border border-slate-800 shadow-xl space-y-6"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-700/50 pb-5">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-400 bg-blue-950/80 px-2.5 py-1 rounded-md border border-blue-800/40">
                Competitive Intelligence Playbook
              </span>
              <h3 className="text-base font-extrabold mt-2 flex items-center gap-2">
                {selectedMetric === "dr" && (
                  <>
                    <Globe className="h-5 w-5 text-blue-400" />
                    <span>Domain Rating (DR) Authority Diagnostic</span>
                  </>
                )}
                {selectedMetric === "traffic" && (
                  <>
                    <TrendingUp className="h-5 w-5 text-blue-400" />
                    <span>Monthly Traffic Acquisition Diagnostic</span>
                  </>
                )}
                {selectedMetric === "backlinks" && (
                  <>
                    <Link className="h-5 w-5 text-blue-400" />
                    <span>Backlink Citation Portfolio Diagnostic</span>
                  </>
                )}
                {selectedMetric === "frequency" && (
                  <>
                    <Calendar className="h-5 w-5 text-blue-400" />
                    <span>Publishing Velocity & Consistency Diagnostic</span>
                  </>
                )}
              </h3>
            </div>
            
            <div className="text-xs text-slate-400 font-medium">
              Click any other top card above to switch diagnostic analysis views.
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Visual head-to-head comparison stats */}
            <div className="lg:col-span-4 space-y-4 bg-slate-950/40 p-5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Core Market Metrics Compare</span>
              
              <div className="space-y-4">
                {/* Target Score block */}
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-slate-300 font-bold block truncate text-xs">{target.domain}</span>
                    <span className="text-[10px] text-blue-400 font-bold uppercase">Our Domain (Target)</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xl font-extrabold font-mono text-emerald-400 block">
                      {selectedMetric === "dr" && `${target.domainRating}/100`}
                      {selectedMetric === "traffic" && formatNum(target.organicTraffic)}
                      {selectedMetric === "backlinks" && formatNum(target.backlinksCount)}
                      {selectedMetric === "frequency" && target.publishingFrequency}
                    </span>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-slate-800/60" />

                {/* Competitor Score block */}
                {competitor ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-slate-400 font-bold block truncate text-xs">{competitor.domain}</span>
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Main Competitor</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xl font-extrabold font-mono text-slate-300 block">
                        {selectedMetric === "dr" && `${competitor.domainRating}/100`}
                        {selectedMetric === "traffic" && formatNum(competitor.organicTraffic)}
                        {selectedMetric === "backlinks" && formatNum(competitor.backlinksCount)}
                        {selectedMetric === "frequency" && competitor.publishingFrequency}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 font-medium italic">
                    Add a competitor above to display comparison.
                  </div>
                )}
              </div>
            </div>

            {/* Strategic Analysis Paragraph and Action steps */}
            <div className="lg:col-span-8 space-y-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                  <Lightbulb className="h-4 w-4 text-amber-400" />
                  <span>Strategic Assessment</span>
                </span>
                <p className="text-slate-300 text-xs md:text-sm leading-relaxed">
                  {selectedMetric === "dr" && (
                    (competitor && target.domainRating >= competitor.domainRating)
                      ? `Your site commands a higher domain authority rating (${target.domainRating} vs ${competitor.domainRating} DR). Capitalize on this trust index by writing deep content for high-difficulty keywords that competitors cannot rank for.`
                      : `Your competitor holds the authority index advantage (${competitor ? competitor.domainRating : 0} vs ${target.domainRating} DR). Implement a themed Content Hub immediately targeting low-competition, long-tail key terms to construct a solid SEO base without direct friction.`
                  )}
                  {selectedMetric === "traffic" && (
                    (competitor && target.organicTraffic >= competitor.organicTraffic)
                      ? `Outstanding! Your search engine reach captures higher monthly search volume. Focus on user engagement metrics (increasing dwell time) and introducing targeted Calls to Action to convert this traffic.`
                      : `The competitor attracts larger query volumes. Your strategic play is Content Gap Arbitrage: target valuable keywords they rank for but cover them with 2x more thorough, schema-optimized guides to gain market share.`
                  )}
                  {selectedMetric === "backlinks" && (
                    (competitor && target.backlinksCount >= competitor.backlinksCount)
                      ? `Your backlinks profile holds numerical superiority. Review the referring domains list to make sure you keep links fresh, and build out deep, data-rich infographics to spark organic, naturally earned links.`
                      : `The competitor is leading in backlink count. Build out highly linkable content assets (ultimate comparison blueprints, proprietary data studies) and execute contextual resource-page outreach to narrow this trust gap.`
                  )}
                  {selectedMetric === "frequency" && (
                    `Consistency is the ultimate competitive advantage. Establish a tight publication pipeline. Maintain the pace of structural updates (e.g. updating old posts with new schema and insights) to keep search crawl bots visiting regularly.`
                  )}
                </p>
              </div>

              {/* Step Checklist */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Recommended Action Checklist</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                  {selectedMetric === "dr" && (
                    <>
                      <div className="bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/40 flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-blue-400 shrink-0" />
                        <span className="text-slate-300">Target authoritative guest posts in relevant niches</span>
                      </div>
                      <div className="bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/40 flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-blue-400 shrink-0" />
                        <span className="text-slate-300">Audit broken internal redirects to maximize link juice</span>
                      </div>
                    </>
                  )}
                  {selectedMetric === "traffic" && (
                    <>
                      <div className="bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/40 flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-blue-400 shrink-0" />
                        <span className="text-slate-300">Map missing high-traffic terms using Gap Analyzer</span>
                      </div>
                      <div className="bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/40 flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-blue-400 shrink-0" />
                        <span className="text-slate-300">Optimize meta CTR by leveraging dynamic title generators</span>
                      </div>
                    </>
                  )}
                  {selectedMetric === "backlinks" && (
                    <>
                      <div className="bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/40 flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-blue-400 shrink-0" />
                        <span className="text-slate-300">Identify and reclaim lost referrers with proactive outreach</span>
                      </div>
                      <div className="bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/40 flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-blue-400 shrink-0" />
                        <span className="text-slate-300">Produce unique research surveys to capture citation links</span>
                      </div>
                    </>
                  )}
                  {selectedMetric === "frequency" && (
                    <>
                      <div className="bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/40 flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-blue-400 shrink-0" />
                        <span className="text-slate-300">Schedule 1 cluster-supporting article per week</span>
                      </div>
                      <div className="bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/40 flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-blue-400 shrink-0" />
                        <span className="text-slate-300">Use AI Assistant to batch outlines and structural pillars</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

            </div>
          </div>
        </motion.div>
      )}

      {/* 6-Month Organic Traffic Trend Section with Recharts Line Chart */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6"
        id="organic-traffic-trend-card"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <TrendingUp className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">6-Month Organic Traffic Trend</h3>
              <p className="text-xs text-slate-400 font-medium">Estimated monthly search visits from Google Organic indexes</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
              <span className="text-slate-700">{target.domain} (Target)</span>
            </span>
            {competitor && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-slate-400 inline-block" />
                <span className="text-slate-500">{competitor.domain} (Competitor)</span>
              </span>
            )}
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={trendData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                stroke="#94a3b8" 
                fontSize={11}
                tickLine={false}
                axisLine={false}
                dy={10}
                className="font-medium"
              />
              <YAxis 
                stroke="#94a3b8" 
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => formatNum(val)}
                dx={-5}
                className="font-medium"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#ffffff', 
                  borderRadius: '12px', 
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  padding: '10px 14px'
                }}
                labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px', fontSize: '12px' }}
                itemStyle={{ fontSize: '12px', padding: '2px 0' }}
                formatter={(value: any, name: any) => [
                  <span key={name} className="font-bold text-slate-800 font-mono">{formatNum(Number(value))} visits</span>,
                  <span className="text-xs text-slate-500 font-medium capitalize">{name}</span>
                ]}
              />
              <Legend 
                verticalAlign="top" 
                height={36} 
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}
              />
              <Line 
                type="monotone" 
                dataKey="targetValue"
                stroke="#2563eb" 
                strokeWidth={3}
                activeDot={{ r: 6, strokeWidth: 0 }}
                dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }}
                name={`${target.domain} (Target)`}
              />
              {competitor && (
                <Line 
                  type="monotone" 
                  dataKey="competitorValue"
                  stroke="#94a3b8" 
                  strokeWidth={2.5}
                  strokeDasharray="4 4"
                  activeDot={{ r: 5 }}
                  dot={{ r: 3, fill: '#ffffff' }}
                  name={`${competitor.domain} (Competitor)`}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {targetAnalysis && (
                <TargetAnalysisSection
          target={target}
          targetAnalysis={targetAnalysis}
          contentGaps={contentGaps}
          serpFeatures={serpFeatures}
          autonomousBlog={autonomousBlog}
          onViewAutonomousBlog={onViewAutonomousBlog}
        />
      )}

      {localLocation && <LocalSeoSection localLocation={localLocation} target={target} competitor={competitor} />}

      {discoveredCompetitors && discoveredCompetitors.length > 0 && (
        <CompetitorDiscovery
          discoveredCompetitors={discoveredCompetitors}
          onSelectCompetitor={onSelectCompetitor}
        />
      )}

      <TopPagesSection target={target} competitor={competitor} />
    </div>
  );
}