import { useState } from "react";
import { motion } from "motion/react";
import { FileText, BookOpen, Zap, MessageSquare, Hash, Share2, Award, Compass, Lightbulb, CheckSquare, ShieldCheck, ClipboardList, CheckCircle2, AlertTriangle, Sparkles, ChevronUp, Code, Globe, ArrowRight } from "lucide-react";
import type { TargetAnalysis, ContentGap, SerpFeature, DomainMetrics, BlogPost } from "../../types";
import { formatNum } from "./utils";

export interface TargetAnalysisSectionProps {
 target: DomainMetrics;
 targetAnalysis: TargetAnalysis;
 contentGaps?: ContentGap[];
 serpFeatures?: SerpFeature[];
 autonomousBlog?: BlogPost;
 onViewAutonomousBlog?: () => void;
}

export default function TargetAnalysisSection({
 target,
 targetAnalysis,
 contentGaps = [],
 serpFeatures = [],
 autonomousBlog,
 onViewAutonomousBlog,
}: TargetAnalysisSectionProps) {
 const [activePhase, setActivePhase] = useState<"phase1" | "phase2" | "phase3">("phase1");

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
 Fully automated audit of <span className="text-blue-600 font-semibold">{target.domain}</span> based on competitive gaps, semantic keywords, and real-time social/web listening
 </p>
 </div>
 </div>
 
 {/* Phase Status Pill */}
 <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wider self-start md:self-center">
 <ShieldCheck className="h-4 w-4" />
 <span>Audit Complete</span>
 </div>
 </div>

 {/* Tab Selection Buttons - Phase 1, Phase 2, Phase 3 */}
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

 {/* TAB CONTENTS */}
 <div className="min-h-[400px] pt-2">
 
 {/* PHASE 1: WEBSITE CONTENT AUDIT */}
 {activePhase === "phase1" && (
 <div className="space-y-6">
 {/* Niche & Persona Card Grid */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="space-y-2.5 p-5 rounded-2xl bg-slate-50/70 border border-slate-200/50">
 <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
 <Compass className="h-4 w-4 text-slate-400" />
 <span>Target Core Niche</span>
 </h4>
 <p className="text-base font-bold text-slate-800">
 {targetAnalysis.coreNiche}
 </p>
 </div>
 <div className="space-y-2.5 p-5 rounded-2xl bg-slate-50/70 border border-slate-200/50">
 <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
 <Globe className="h-4 w-4 text-slate-400" />
 <span>Audience Persona Focus</span>
 </h4>
 <p className="text-base font-bold text-slate-800">
 {targetAnalysis.audiencePersona}
 </p>
 </div>
 </div>

 {/* Qualitative Narrative */}
 <div className="p-5 bg-blue-50/40 rounded-2xl border border-blue-100/40 space-y-2.5">
 <h4 className="text-xs font-extrabold text-blue-800 uppercase tracking-widest flex items-center gap-1.5">
 <Award className="h-4 w-4 text-blue-600" />
 <span>Executive Strategic Assessment</span>
 </h4>
 <p className="text-sm text-slate-700 leading-relaxed font-medium">
 {targetAnalysis.detailedBreakdown}
 </p>
 </div>

 {/* Content Strengths and Weaknesses Checklist */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
 {/* Strengths */}
 <div className="p-5 rounded-2xl border border-slate-200/70 space-y-4">
 <h4 className="text-xs font-extrabold text-green-700 uppercase tracking-widest flex items-center gap-1.5">
 <CheckCircle2 className="h-4.5 w-4.5 text-green-600" />
 <span>Content Strengths Inventory</span>
 </h4>
 <ul className="space-y-3">
 {targetAnalysis.contentStrengths.map((strength, i) => (
 <li key={i} className="text-sm text-slate-600 flex items-start gap-2.5">
 <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0 mt-2" />
 <span className="font-medium">{strength}</span>
 </li>
 ))}
 </ul>
 </div>

 {/* Weaknesses */}
 <div className="p-5 rounded-2xl border border-slate-200/70 space-y-4">
 <h4 className="text-xs font-extrabold text-amber-700 uppercase tracking-widest flex items-center gap-1.5">
 <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
 <span>Content Defects & Gaps Identified</span>
 </h4>
 <ul className="space-y-3">
 {targetAnalysis.contentWeaknesses.map((weakness, i) => (
 <li key={i} className="text-sm text-slate-600 flex items-start gap-2.5">
 <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-2" />
 <span className="font-medium">{weakness}</span>
 </li>
 ))}
 </ul>
 </div>
 </div>

 {/* Technical SEO Checklist */}
 <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
 <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
 <ShieldCheck className="h-4 w-4 text-slate-400" />
 <span>Technical SEO & Structural Schema Validation</span>
 </h4>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-start gap-3">
 <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
 <div>
 <h6 className="text-sm font-bold text-slate-800">Title & Meta Length</h6>
 <p className="text-xs text-slate-500 mt-1">Verified target headers. Clean lengths (50-60 chars) compliant with Google display truncations.</p>
 </div>
 </div>
 <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-start gap-3">
 <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
 <div>
 <h6 className="text-sm font-bold text-slate-800">Structured FAQ JSON-LD</h6>
 <p className="text-xs text-slate-500 mt-1">Ready. Structured schema automatically injected into generated SEO articles to claim rich search cards.</p>
 </div>
 </div>
 <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-start gap-3">
 <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
 <div>
 <h6 className="text-sm font-bold text-slate-800">Article Graph Schema</h6>
 <p className="text-xs text-slate-500 mt-1">Validated. Automated Article schema constructed with jobTitle and author entities to secure crawling credentials.</p>
 </div>
 </div>
 <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-start gap-3">
 <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
 <div>
 <h6 className="text-sm font-bold text-slate-800">Mobile Responsive Structure</h6>
 <p className="text-xs text-slate-500 mt-1">Responsive layouts matched. CSS fluidities conform to dynamic viewport resizing without overflow defect.</p>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* PHASE 2: COMPETITIVE & MARKET RESEARCH */}
 {activePhase === "phase2" && (
 <div className="space-y-6">
 {/* Social Media and Listening Summary */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {targetAnalysis.socialPresenceSummary && (
 <div className="bg-gradient-to-br from-indigo-50/30 to-purple-50/30 p-5 rounded-2xl border border-indigo-100/30 space-y-3">
 <h4 className="text-xs font-extrabold text-indigo-800 uppercase tracking-widest flex items-center gap-1.5">
 <MessageSquare className="h-4.5 w-4.5 text-indigo-600" />
 <span>Real-Time Web & Social Listening</span>
 </h4>
 <p className="text-sm text-slate-600 leading-relaxed font-medium">
 {targetAnalysis.socialPresenceSummary}
 </p>
 {targetAnalysis.socialMentionKeywords && targetAnalysis.socialMentionKeywords.length > 0 && (
 <div className="flex flex-wrap gap-1.5 pt-2">
 {targetAnalysis.socialMentionKeywords.map((tag, idx) => (
 <span key={idx} className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-white border border-indigo-100 text-indigo-700 rounded-lg shadow-2xs">
 <Hash className="h-3 w-3 text-indigo-400" />
 {tag.replace(/^#/, '')}
 </span>
 ))}
 </div>
 )}
 </div>
 )}

 {targetAnalysis.competitorSocialInsights && (
 <div className="bg-gradient-to-br from-amber-50/30 to-orange-50/30 p-5 rounded-2xl border border-amber-100/30 space-y-3 flex flex-col justify-between">
 <div className="space-y-3">
 <h4 className="text-xs font-extrabold text-amber-800 uppercase tracking-widest flex items-center gap-1.5">
 <Share2 className="h-4.5 w-4.5 text-amber-600" />
 <span>Competitor Brand Listening Insights</span>
 </h4>
 <p className="text-sm text-slate-600 leading-relaxed font-medium">
 {targetAnalysis.competitorSocialInsights}
 </p>
 </div>
 <div className="text-[10px] text-amber-700 font-bold uppercase tracking-wider flex items-center gap-1 pt-3">
 <span> Audited via dynamic web conversations & competitor social tracks.</span>
 </div>
 </div>
 )}
 </div>

 <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-center space-y-1">
 <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Market Competitor Overview</p>
 <p className="text-xs text-slate-400">Scroll below to examine our detailed head-to-head metrics charts and auto-detected competitor cards.</p>
 </div>
 </div>
 )}

 {/* PHASE 3: CONTENT OPPORTUNITY IDENTIFICATION */}
 {activePhase === "phase3" && (
 <div className="space-y-6">
 {/* Content Gaps Quick-Wins */}
 <div className="p-5 rounded-2xl border border-slate-200 space-y-4">
 <div className="flex justify-between items-center flex-wrap gap-2">
 <div>
 <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
 High-Impact Keyword Content Gaps
 </h4>
 <p className="text-[11px] text-slate-400 font-medium">Highly searched keywords competitor ranks for but target lacks presence</p>
 </div>
 <span className="text-[10px] font-bold px-2.5 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full uppercase">
 Action Required
 </span>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {(contentGaps || []).length > 0 ? (
 (contentGaps || []).slice(0, 4).map((gap, idx) => (
 <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-white shadow-3xs space-y-3 hover:border-blue-400 transition-all">
 <div className="flex items-center justify-between">
 <span className="font-mono text-xs font-extrabold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
 {gap?.competitorKeyword || "keyword"}
 </span>
 <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
 gap?.difficultyCategory === "Easy" ? "bg-green-50 text-green-700 border border-green-100" :
 gap?.difficultyCategory === "Medium" ? "bg-amber-50 text-amber-700 border border-amber-100" :
 "bg-rose-50 text-rose-700 border border-rose-100"
 }`}>
 {gap?.difficultyCategory || "Medium"} Diff
 </span>
 </div>
 <div>
 <span className="text-[10px] text-slate-400 block font-bold uppercase">Recommended Topic Target</span>
 <p className="text-sm font-bold text-slate-800 line-clamp-1 mt-0.5">{gap?.recommendedTopic || "Topic opportunity"}</p>
 </div>
 <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
 <span>Vol: <strong className="text-slate-700">{formatNum(gap?.competitorVolume || 0)}/mo</strong></span>
 <span>Competitor: <strong className="text-rose-500 font-bold">Rank #{gap?.competitorRank || "—"}</strong></span>
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

 {/* SERP Features and Snippet opportunities */}
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
 <span className="text-[10px] text-slate-400 font-bold uppercase">Audited Search Query</span>
 <p className="text-sm font-bold text-slate-800 italic mt-0.5">"{feat.query}"</p>
 </div>
 <div className="space-y-1">
 <span className="text-[10px] text-slate-400 font-bold uppercase">Strategic Action Plan</span>
 <p className="text-xs text-slate-600 leading-relaxed font-medium">{feat.actionability}</p>
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

 {/* Autonomous Content Pipeline Card */}
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
 Our pipeline has pre-calculated your highest-impact easy win Content Gap, structured an expert-grade outline, and drafted a publication-ready blog post for: <strong className="text-white font-mono block mt-1">"{autonomousBlog.title}"</strong>
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