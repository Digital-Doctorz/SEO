import { useState } from "react";
import { motion } from "motion/react";
import { Globe, TrendingUp, ChevronUp, Sparkles, Zap, ExternalLink, CheckCircle2, BookOpen, FileText, Code, Link2, Search } from "lucide-react";
import type { DiscoveredCompetitor } from "../../types";
import { formatNum } from "./utils";

export default function CompetitorDiscovery({
 discoveredCompetitors,
 onSelectCompetitor,
}: {
 discoveredCompetitors: DiscoveredCompetitor[];
 onSelectCompetitor?: (domain: string) => void;
}) {
 const [expandedComp, setExpandedComp] = useState<number | null>(null);
 return (
 <motion.div
 initial={{ opacity: 0, y: 15 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.4 }}
 className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6"
 id="discovered-competitors-landscape"
 >
 <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-4">
  <div className="flex items-center gap-2">
   <span className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
    <Globe className="h-5 w-5" />
   </span>
   <div>
    <h3 className="text-lg font-bold text-slate-900">
     Competitor Deep-Dive Cards
    </h3>
    <p className="text-xs text-slate-500">
     Local competitors discovered from Google SERP + industry analysis — expand for SEO & AI rank playbooks
    </p>
   </div>
  </div>
  <span className="text-xs bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
   {(discoveredCompetitors || []).length} Competitors Tracked
   {(discoveredCompetitors || []).some(c => c.isSerpDiscovered) && (
    <span className="ml-1 text-emerald-600">· {(discoveredCompetitors || []).filter(c => c.isSerpDiscovered).length} from SERP</span>
   )}
  </span>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {(discoveredCompetitors || []).map((comp, idx) => {
 const isExpanded = expandedComp === idx;
 return (
 <div 
 key={idx} 
 className={`p-5 rounded-xl border transition-all duration-300 bg-white relative overflow-hidden flex flex-col justify-between space-y-4 ${
 isExpanded ? 'border-blue-400 shadow-md lg:col-span-3' : 'border-slate-200 hover:border-blue-300 hover:shadow-xs'
 }`}
 >
 {/* Visual indicator corner */}
 <div className="absolute top-0 right-0 h-1 w-24 bg-gradient-to-r from-blue-400 to-blue-600" />
 
 <div className="space-y-3">
 <div className="flex items-start justify-between gap-2">
  <div>
   <h4 className="font-bold text-slate-900 text-base break-all flex items-center gap-1.5">
    <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
    {comp.domain}
    {comp.isSerpDiscovered && (
     <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full border border-emerald-100 uppercase tracking-wider ml-1">
      Live SERP
     </span>
    )}
   </h4>
   <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
    Est. Traffic: {formatNum(comp.estimatedMonthlyTraffic)} / mo
    {comp.domainRating != null ? ` · DR ${comp.domainRating}` : ""}
   </p>
   {/* Real DataForSEO metrics row */}
   {(comp.backlinksCount != null && comp.backlinksCount > 0) || (comp.referringDomains != null && comp.referringDomains > 0) ? (
    <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 font-medium">
     {comp.backlinksCount != null && comp.backlinksCount > 0 && (
      <span className="flex items-center gap-1">
       <Link2 className="h-3 w-3 text-slate-400" />
       {formatNum(comp.backlinksCount)} backlinks
      </span>
     )}
     {comp.referringDomains != null && comp.referringDomains > 0 && (
      <span className="flex items-center gap-1">
       <Globe className="h-3 w-3 text-slate-400" />
       {formatNum(comp.referringDomains)} referring domains
      </span>
     )}
    </div>
   ) : null}
  </div>
 <div className="flex flex-col items-end gap-1 shrink-0">
 <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
 {comp.nicheSimilarity}% Match
 </span>
 {comp.threatLevel && (
 <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
  comp.threatLevel === "High" ? "bg-rose-50 text-rose-700 border-rose-100" :
  comp.threatLevel === "Low" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
  "bg-amber-50 text-amber-700 border-amber-100"
 }`}>
  {comp.threatLevel} threat
 </span>
 )}
 </div>
 </div>

 <p className="text-xs text-slate-500 font-medium">
 <strong className="text-slate-700">Focus:</strong> {comp.nicheFocus}
 </p>
 </div>

 {/* Blog and Article links */}
 <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
 {comp.popularBlogUrl && (
 <a 
 href={comp.popularBlogUrl} 
 target="_blank" 
 rel="noopener noreferrer" 
 className="flex items-center gap-2 text-slate-600 hover:text-blue-600 font-semibold"
 >
 <BookOpen className="h-3.5 w-3.5 text-blue-500 shrink-0" />
 <span className="truncate">Blog: {comp.popularBlogUrl}</span>
 </a>
 )}
 {comp.latestArticleTitle && (
 <a 
 href={comp.latestArticleUrl} 
 target="_blank" 
 rel="noopener noreferrer" 
 className="flex items-start gap-2 text-slate-600 hover:text-blue-600 font-semibold"
 >
 <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
 <div className="truncate">
 <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-tight">Latest Article</span>
 <span className="italic block truncate font-medium text-slate-600">{comp.latestArticleTitle}</span>
 </div>
 </a>
 )}
 </div>

 {/* Analyzed Takeaway */}
 <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-100 text-[11px] text-slate-600 leading-relaxed font-medium">
 <strong className="text-slate-800 block text-[9.5px] uppercase font-bold tracking-wider mb-0.5">Content Positioning Strategy</strong>
 {comp.analyzedTakeaway}
 </div>

 {/* Expanded SEO & AI Search Rank #1 Blueprint */}
 {isExpanded && (
 <motion.div 
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height: "auto" }}
 transition={{ duration: 0.3 }}
 className="space-y-4 pt-3 border-t border-slate-200 text-xs"
 >
 {comp.counterMove && (
 <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 text-[11px] text-slate-700">
  <strong className="text-blue-800 block text-[9.5px] uppercase font-bold tracking-wider mb-1">Counter-move</strong>
  <p className="leading-relaxed">{comp.counterMove}</p>
 </div>
 )}
 {(comp.strengths?.length || comp.weaknesses?.length) ? (
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
  {!!comp.strengths?.length && (
   <div className="bg-emerald-50/40 p-2.5 rounded-lg border border-emerald-100">
    <strong className="text-emerald-800 block text-[9.5px] uppercase font-bold tracking-wider mb-1">They win on</strong>
    <ul className="space-y-1 text-[11px] text-slate-600">
     {comp.strengths.map((s, i) => <li key={i}>• {s}</li>)}
    </ul>
   </div>
  )}
  {!!comp.weaknesses?.length && (
   <div className="bg-amber-50/40 p-2.5 rounded-lg border border-amber-100">
    <strong className="text-amber-800 block text-[9.5px] uppercase font-bold tracking-wider mb-1">Exploitable gaps</strong>
    <ul className="space-y-1 text-[11px] text-slate-600">
     {comp.weaknesses.map((s, i) => <li key={i}>• {s}</li>)}
    </ul>
   </div>
  )}
 </div>
 ) : null}
 {/* Targeted Keywords */}
 {comp.targetKeywords && comp.targetKeywords.length > 0 && (
 <div className="space-y-1">
 <strong className="text-slate-800 block text-[9.5px] uppercase font-bold tracking-wider">Targeted High-Value Keywords</strong>
 <div className="flex flex-wrap gap-1.5">
 {comp.targetKeywords.map((kw, kIdx) => (
 <span key={kIdx} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
  {kw}
 </span>
 ))}
 </div>
 </div>
 )}

 {/* SEO Strategy to Rank #1 */}
 {comp.seoStrategy && (
 <div className="bg-emerald-50/40 p-3 rounded-lg border border-emerald-100 text-[11px] text-slate-700 space-y-1">
 <strong className="text-emerald-800 flex items-center gap-1.5 text-[9.5px] uppercase font-bold tracking-wider">
 <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
 Search Engine Rank #1 Blueprint (Google, Bing)
 </strong>
 <p className="leading-relaxed">{comp.seoStrategy}</p>
 </div>
 )}

 {/* AI Search Rank Strategy */}
 {comp.aiRankStrategy && (
 <div className="bg-violet-50/40 p-3 rounded-lg border border-violet-100 text-[11px] text-slate-700 space-y-1">
 <strong className="text-violet-800 flex items-center gap-1.5 text-[9.5px] uppercase font-bold tracking-wider">
 <Sparkles className="h-3.5 w-3.5 text-violet-600" />
 AI Search Optimization Playbook (Gemini, ChatGPT, Perplexity)
 </strong>
 <p className="leading-relaxed">{comp.aiRankStrategy}</p>
 </div>
 )}

 {/* Schema Recommendations */}
 {comp.schemaRecommendation && (
 <div className="bg-blue-50/40 p-3 rounded-lg border border-blue-100 text-[11px] text-slate-700 space-y-1.5 font-sans">
 <strong className="text-blue-800 flex items-center gap-1.5 text-[9.5px] uppercase font-bold tracking-wider">
 <Code className="h-3.5 w-3.5 text-blue-600" />
 Required Schema.org JSON-LD Specifications
 </strong>
 <p className="leading-relaxed whitespace-pre-line bg-slate-50 p-2.5 rounded border border-slate-100 font-mono text-[10px] text-slate-600 overflow-x-auto">{comp.schemaRecommendation}</p>
 </div>
 )}
 </motion.div>
 )}

 {/* Action row */}
 <div className="flex gap-2 pt-2 border-t border-slate-50">
 <button
 onClick={() => setExpandedComp(isExpanded ? null : idx)}
 className={`flex-1 py-2 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-all border cursor-pointer ${
 isExpanded 
 ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200' 
 : 'bg-blue-50/50 hover:bg-blue-100 text-blue-700 border-blue-100'
 }`}
 >
 {isExpanded ? (
 <>
 <ChevronUp className="h-3.5 w-3.5" />
 <span>Hide Strategy Details</span>
 </>
 ) : (
 <>
 <Sparkles className="h-3.5 w-3.5 text-blue-600" />
 <span>Reveal Rank #1 Blueprint</span>
 </>
 )}
 </button>

 {onSelectCompetitor && (
 <button
 onClick={() => onSelectCompetitor(comp.domain)}
 className="py-2 px-3 rounded-lg bg-slate-50 hover:bg-slate-900 hover:text-white text-slate-700 font-semibold border border-slate-200 hover:border-slate-900 transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
 title="Compare Head-to-Head"
 >
 <Zap className="h-3.5 w-3.5" />
 <span className="hidden sm:inline">Compare</span>
 </button>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </motion.div>
 );
}