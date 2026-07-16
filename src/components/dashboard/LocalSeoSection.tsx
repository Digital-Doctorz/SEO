import { motion } from "motion/react";
import { MapPin, Navigation, CheckCircle2, AlertTriangle, Compass, Award, Lightbulb, ClipboardList, Globe, TrendingUp, Sparkles, CheckSquare } from "lucide-react";
import type { LocalLocation, DomainMetrics } from "../../types";
import { formatNum, getComparePercent } from "./utils";

export default function LocalSeoSection({
  localLocation,
  target,
  competitor,
}: {
  localLocation: LocalLocation;
  target: DomainMetrics;
  competitor: DomainMetrics | null;
}) {
  return (
    <>
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8"
          id="local-seo-intelligence-card"
        >
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <span className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <MapPin className="h-6 w-6 text-blue-600 animate-pulse" />
              </span>
              <div>
                <h3 className="text-lg md:text-xl font-bold text-slate-900 flex items-center gap-2">
                  Local SEO & Geographic Search Intelligence
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Dynamically parsed address, localized Map Pack visibility, and geo-targeted competitor analysis for <span className="text-blue-600 font-semibold">{target.domain}</span>
                </p>
              </div>
            </div>
            
            {/* Status Pill */}
            <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-150 rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wider self-start md:self-center shadow-2xs">
              <Navigation className="h-3.5 w-3.5" />
              <span>Location-Aware Target: {localLocation.city}, {localLocation.state}</span>
            </div>
          </div>

          {/* Core Address & Confidence Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Location Extraction Panel */}
            <div className="lg:col-span-2 bg-slate-50/70 rounded-2xl p-5 border border-slate-200/60 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Extracted Corporate / Clinic Address</span>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-blue-600 mt-1 shrink-0" />
                  <div>
                    <p className="text-base font-bold text-slate-800 leading-snug">{localLocation.detectedAddress}</p>
                    <p className="text-xs font-semibold text-slate-500 mt-1.5">
                      Detected Region: <span className="text-slate-700 font-bold">{localLocation.city}</span>, {localLocation.state}, {localLocation.country}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4 pt-3 border-t border-slate-200/50">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-semibold">Address Confidence Score:</span>
                  <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono font-bold rounded-lg text-xs">
                    {localLocation.confidenceScore}% Accuracy
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-medium italic">
                  * Extracted via real-time website and local business directory crawl.
                </div>
              </div>
            </div>

            {/* Local Pack & Citation consistency */}
            <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-200/60 space-y-4 flex flex-col justify-center">
              {/* Google Map Pack Score */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                  <span className="uppercase tracking-wider">Local Map Pack Score</span>
                  <span className="text-blue-600 font-mono text-sm">{localLocation.googleMapPackScore} / 100</span>
                </div>
                <div className="w-full bg-slate-200/60 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${localLocation.googleMapPackScore}%` }} />
                </div>
              </div>

              {/* Citation Consistency */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                  <span className="uppercase tracking-wider">Citation Consistency (NAP)</span>
                  <span className="text-emerald-600 font-mono text-sm">{localLocation.citationConsistency}%</span>
                </div>
                <div className="w-full bg-slate-200/60 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${localLocation.citationConsistency}%` }} />
                </div>
              </div>
              
              <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                NAP consistency rates how accurately name, address, and phone details match across Yelp, Justdial, YellowPages, etc.
              </p>
            </div>

          </div>

          {/* Local Competitors & Keywords Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Local Geographic Competitors */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                  <Globe className="h-4 w-4" />
                </span>
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Primary Regional Competitors ({localLocation.city})
                </h4>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/20">
                {(localLocation.primaryLocalCompetitors || []).map((comp, idx) => (
                  <div key={idx} className="p-4 bg-white hover:bg-slate-50/50 transition-all flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-bold text-slate-800 text-sm">{comp.name}</p>
                      <p className="text-xs text-slate-400 font-medium font-mono">{comp.domain}</p>
                    </div>
                    
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-400">Local Position</span>
                      <strong className="text-slate-800 font-mono text-xs block mt-0.5">Rank #{comp.localRank}</strong>
                      <span className="text-[10px] text-blue-600 font-semibold block">{comp.mapDistance} away</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Local Geo-Targeted Keywords */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                  <TrendingUp className="h-4 w-4" />
                </span>
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Enhanced Geo-Targeted Keywords
                </h4>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/20">
                {(localLocation.localKeywordOpportunities || []).map((kw, idx) => (
                  <div key={idx} className="p-4 bg-white hover:bg-slate-50/50 transition-all flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-bold text-slate-800 text-xs font-mono bg-slate-100 px-2 py-0.5 rounded-md inline-block">
                        {kw.keyword}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">Search Intent: <strong className="text-slate-600">{kw.intent}</strong></p>
                    </div>
                    
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-400">Local Vol</span>
                      <strong className="text-slate-700 font-mono text-sm block mt-0.5">{kw.searchVolume}/mo</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* AI Local SEO Verdict */}
          <div className="p-5 bg-blue-50/30 rounded-2xl border border-blue-100/30 space-y-3">
            <h4 className="text-xs font-extrabold text-blue-800 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span>AI Local Search Positioning Assessment</span>
            </h4>
            <p className="text-sm text-slate-700 leading-relaxed font-medium">
              {localLocation.localSeoVerdict}
            </p>
          </div>

          {/* Recommendations/Playbook checklist */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/40 space-y-4">
            <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <CheckSquare className="h-4 w-4 text-slate-400" />
              <span>Location-Based Optimization Blueprint</span>
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(localLocation.localOptimizationsNeeded || []).map((opt, i) => (
                <div key={i} className="bg-white p-4 rounded-xl border border-slate-200/80 flex items-start gap-3 shadow-3xs">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">{opt}</p>
                </div>
              ))}
            </div>
          </div>

        </motion.div>

      {/* Visual Competitive Comparison Charts */}
      {competitor && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs"
          id="competitive-charts-block"
        >
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <span>Competitive Core Comparison</span>
            <span className="text-xs font-normal text-slate-400">Share of Authority & Presence</span>
          </h3>

          <div className="space-y-6">
            {/* Domain Rating Comparison Bar */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-2 text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600 inline-block" />
                  {target.domain} ({target.domainRating} DR)
                </span>
                <span className="flex items-center gap-1.5 text-right">
                  {competitor.domain} ({competitor.domainRating} DR)
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300 inline-block" />
                </span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
                <div 
                  className="bg-blue-600 h-full transition-all duration-500" 
                  style={{ width: `${getComparePercent(target.domainRating, competitor.domainRating)}%` }} 
                />
                <div className="bg-slate-200 h-full flex-1" />
              </div>
            </div>

            {/* Organic Traffic Comparison Bar */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-2 text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600 inline-block" />
                  {target.domain} ({formatNum(target.organicTraffic)} visits)
                </span>
                <span className="flex items-center gap-1.5 text-right">
                  {competitor.domain} ({formatNum(competitor.organicTraffic)} visits)
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300 inline-block" />
                </span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
                <div 
                  className="bg-blue-600 h-full transition-all duration-500" 
                  style={{ width: `${getComparePercent(target.organicTraffic, competitor.organicTraffic)}%` }} 
                />
                <div className="bg-slate-200 h-full flex-1" />
              </div>
            </div>

            {/* Backlink Count Comparison Bar */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-2 text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600 inline-block" />
                  {target.domain} ({formatNum(target.backlinksCount)} links)
                </span>
                <span className="flex items-center gap-1.5 text-right">
                  {competitor.domain} ({formatNum(competitor.backlinksCount)} links)
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300 inline-block" />
                </span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
                <div 
                  className="bg-blue-600 h-full transition-all duration-500" 
                  style={{ width: `${getComparePercent(target.backlinksCount, competitor.backlinksCount)}%` }} 
                />
                <div className="bg-slate-200 h-full flex-1" />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </>
  );
}