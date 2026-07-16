import { Layers, Workflow, Compass, Award, TrendingUp, Zap } from "lucide-react";
import type { Keyword } from "../../types";

export type KeywordCluster = {
  name: string;
  keywords: Keyword[];
  totalVolume: number;
  avgDifficulty: number;
  avgCpc: number;
  pillarOpportunity: Keyword | null;
};

export interface KeywordClusteringViewProps {
  clusters: KeywordCluster[];
  journeyStages: {
    Awareness: Keyword[];
    Consideration: Keyword[];
    Decision: Keyword[];
  };
  keywords: Keyword[];
  onSelectKeyword?: (keyword: string) => void;
}

export default function KeywordClusteringView({
  clusters,
  journeyStages,
  keywords,
  onSelectKeyword,
}: KeywordClusteringViewProps) {
  return (
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
                          Vol: {k.volume} Ã¢â‚¬Â¢ Diff: {k.difficulty} Ã¢â‚¬Â¢ CPC: ${k.cpc}
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
  );
}