import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Eye, Globe2, Copy, Check, CheckCircle, Sparkles, Activity, Smile, List, ChevronDown, HelpCircle, AlertCircle, RefreshCw, PenTool } from "lucide-react";
import type { BlogPost, AiProviderConfig } from "../../types";
import type { KeywordDensityMetrics } from "./keywordDensity";
import { formatMarkdownToHtml, highlightKeywordsInHtml } from "./markdown";
import { generateMetaSnippets } from "./generation";
import BlogSerpPreview from "./BlogSerpPreview";
import BlogSeoCompleteness from "./BlogSeoCompleteness";

export interface BlogDraftPanelProps {
 blogPost: BlogPost;
 setBlogPost: (post: BlogPost) => void;
 blogKeyword: string;
 secondaryKeywords: string[];
 targetDomain: string;
 aiConfig?: AiProviderConfig;
 keywordDensityMetrics: KeywordDensityMetrics;
 blogLinguisticStats: ReturnType<typeof import("./linguistics").analyzeTextLinguistics>;
 getCounterColor: (current: number, min: number, max: number) => string;
 onCopy: (text: string, setCopied: (v: boolean) => void) => void;
}

export default function BlogDraftPanel({
 blogPost,
 setBlogPost,
 blogKeyword,
 secondaryKeywords,
 targetDomain,
 aiConfig,
 keywordDensityMetrics,
 blogLinguisticStats,
 getCounterColor,
 onCopy: handleCopy,
}: BlogDraftPanelProps) {
 const [highlightKeywords, setHighlightKeywords] = useState(true);
 const [hoveredHeatmapIndex, setHoveredHeatmapIndex] = useState<number | null>(null);
 const [activeFaq, setActiveFaq] = useState<number | null>(null);
 const [blogCopied, setBlogCopied] = useState(false);
 const [isEditingMeta, setIsEditingMeta] = useState(false);
 const [metaSuggestions, setMetaSuggestions] = useState<Array<{ type: string; title: string; description: string }>>([]);
 const [isMetaGenerating, setIsMetaGenerating] = useState(false);
 const [metaGenError, setMetaGenError] = useState<string | null>(null);

 const handleGenerateMetaSnippets = async () => {
 setIsMetaGenerating(true);
 setMetaGenError(null);
 try {
 const data = await generateMetaSnippets({
 keyword: blogKeyword,
 content: blogPost.content,
 articleTitle: blogPost.title,
 targetDomain,
 aiConfig,
 });
 if (data.isFallback) {
 setMetaSuggestions([]);
 setMetaGenError(data.fallbackReason || data.errorMsg || "AI engine unavailable.");
 return;
 }
 if (Array.isArray(data.snippets)) setMetaSuggestions(data.snippets);
 else throw new Error("Invalid response received from server.");
 } catch (err: unknown) {
 setMetaGenError(err instanceof Error ? err.message : "Failed to generate meta snippets.");
 } finally {
 setIsMetaGenerating(false);
 }
 };

 const handleUpdateMetaTitle = (newTitle: string) => {
 setBlogPost({ ...blogPost, title: newTitle });
 };
 const handleUpdateMetaDescription = (newDescription: string) => {
 setBlogPost({ ...blogPost, metaDescription: newDescription });
 };

 return (
 <div className="space-y-6">
 <BlogSeoCompleteness blogPost={blogPost} />

 {/* Modular SERP preview (wraps existing meta tools as children) */}
 <BlogSerpPreview
  blogPost={blogPost}
  targetDomain={targetDomain}
  getCounterColor={getCounterColor}
 >
 {/* Interactive Edit / AI Suggest Section — preserved */}
 <div className="pt-4 border-t border-slate-100 space-y-4">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <span className="text-xs font-bold text-slate-600">Optimize Snippets</span>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setIsEditingMeta(!isEditingMeta)}
 className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
 isEditingMeta 
 ? "bg-slate-100 text-slate-800 border-slate-300"
 : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
 }`}
 >
 <PenTool className="h-3 w-3" />
 <span>{isEditingMeta ? "Hide Editor" : "Manual Edit"}</span>
 </button>
 <button
 onClick={handleGenerateMetaSnippets}
 disabled={isMetaGenerating}
 className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
 >
 <Sparkles className="h-3 w-3 animate-pulse" />
 <span>{isMetaGenerating ? "Generating..." : "AI Suggestions"}</span>
 </button>
 </div>
 </div>

 {isEditingMeta && (
 <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3 animate-fadeIn">
 <div className="space-y-1">
 <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Meta Title</label>
 <input
 type="text"
 value={blogPost.title}
 onChange={(e) => handleUpdateMetaTitle(e.target.value)}
 className="w-full text-xs font-medium px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all text-slate-800"
 placeholder="Type SEO optimized title..."
 />
 <div className="flex justify-between items-center text-[9px] text-slate-400">
 <span>Optimal length: 55-60 chars</span>
 <span className={`font-semibold ${blogPost.title.length >= 55 && blogPost.title.length <= 60 ? 'text-green-600' : 'text-amber-600'}`}>
 {blogPost.title.length} chars
 </span>
 </div>
 </div>

 <div className="space-y-1">
 <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Meta Description</label>
 <textarea
 value={blogPost.metaDescription}
 onChange={(e) => handleUpdateMetaDescription(e.target.value)}
 rows={2}
 className="w-full text-xs font-medium px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all text-slate-800 resize-none"
 placeholder="Type compelling meta description..."
 />
 <div className="flex justify-between items-center text-[9px] text-slate-400">
 <span>Optimal length: 150-160 chars</span>
 <span className={`font-semibold ${blogPost.metaDescription.length >= 150 && blogPost.metaDescription.length <= 160 ? 'text-green-600' : 'text-amber-600'}`}>
 {blogPost.metaDescription.length} chars
 </span>
 </div>
 </div>
 </div>
 )}

 {isMetaGenerating && (
 <div className="p-6 bg-blue-50/50 rounded-xl border border-blue-100 text-center space-y-2 animate-pulse">
 <Sparkles className="h-5 w-5 text-blue-500 mx-auto animate-bounce" />
 <p className="text-[11px] font-semibold text-blue-700">Gemini is analyzing article content and keyword density to suggest optimized metadata...</p>
 </div>
 )}

 {metaGenError && (
 <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-[11px] flex gap-2 items-start">
 <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
 <span>{metaGenError}</span>
 </div>
 )}

 {!isMetaGenerating && metaSuggestions.length > 0 && (
 <div className="space-y-2.5 animate-fadeIn">
 <div className="flex justify-between items-center">
 <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">AI Suggested Variations ({blogKeyword})</span>
 <button 
 onClick={() => setMetaSuggestions([])}
 className="text-[10px] text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
 >
 Clear Suggestions
 </button>
 </div>
 <div className="grid grid-cols-1 gap-2.5">
 {metaSuggestions.map((suggestion, idx) => (
 <div 
 key={idx}
 className="p-3.5 bg-slate-50/60 hover:bg-blue-50/20 border border-slate-100 hover:border-blue-200 rounded-xl transition-all space-y-2 group text-left relative"
 >
 <div className="flex justify-between items-start">
 <span className="text-[9px] font-extrabold uppercase bg-blue-100/50 text-blue-700 px-2 py-0.5 rounded-full tracking-wider">
 {suggestion.type}
 </span>
 <button
 onClick={() => {
 handleUpdateMetaTitle(suggestion.title);
 handleUpdateMetaDescription(suggestion.description);
 }}
 className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-white group-hover:bg-blue-50 border border-slate-200 hover:border-blue-300 px-2.5 py-1 rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-1 shrink-0"
 >
 <CheckCircle className="h-3 w-3" />
 <span>Apply Snippet</span>
 </button>
 </div>
 <div className="space-y-1">
 <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
 <span className="truncate pr-4">{suggestion.title}</span>
 <span className={`text-[9px] font-mono shrink-0 px-1 rounded ${suggestion.title.length >= 55 && suggestion.title.length <= 60 ? 'text-green-600 bg-green-50' : 'text-slate-400 bg-slate-100'}`}>
 {suggestion.title.length}ch
 </span>
 </div>
 <div className="text-[11px] text-slate-500 leading-normal flex items-start justify-between gap-4">
 <span className="flex-1">{suggestion.description}</span>
 <span className={`text-[9px] font-mono shrink-0 px-1 rounded mt-0.5 ${suggestion.description.length >= 150 && suggestion.description.length <= 160 ? 'text-green-600 bg-green-50' : 'text-slate-400 bg-slate-100'}`}>
 {suggestion.description.length}ch
 </span>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </BlogSerpPreview>

 {/* Content Table of Contents */}
 <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
 <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
 <List className="h-4 w-4 text-blue-500" />
 <span>Table of Contents</span>
 </div>
 <div className="space-y-1.5 pl-1.5">
 {blogPost.outline.map((heading, index) => (
 <div key={index} className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer pl-2 border-l border-slate-100 hover:border-blue-400 py-0.5">
 <span className="text-blue-500 font-bold">{index + 1}.</span>
 <span>{heading}</span>
 </div>
 ))}
 </div>
 </div>

 {/* Key Takeaways Highlight Card */}
 <div className="bg-amber-50/70 border border-amber-200 p-6 rounded-2xl space-y-3 shadow-xs">
 <div className="flex items-center gap-2 text-amber-800">
 <Sparkles className="h-5 w-5 text-amber-600 shrink-0" />
 <span className="font-extrabold text-sm tracking-tight">KEY TAKEAWAYS & EXECUTIVE SUMMARY</span>
 </div>
 <p className="text-xs text-amber-900 leading-relaxed">
 A successful approach targeting <strong>{blogKeyword || "primary keyword"}</strong> requires implementing a comprehensive, structured cluster model. This article provides highly actionable takeouts, structured comparison lists, schema integrations, and visual graphs to capture top SERP positions.
 </p>
 </div>

 {/* REAL-TIME SENTIMENT & READABILITY ANALYSIS WIDGET */}
 <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
 <div>
 <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
 <Activity className="h-4 w-4 text-blue-500 animate-pulse" />
 <span>Linguistic Intelligence Engine</span>
 </span>
 <h4 className="font-extrabold text-slate-900 text-sm mt-0.5">Real-time Sentiment & Readability Metrics</h4>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full font-bold">
 Linguistic Core V2
 </span>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
 {/* 1. READABILITY CARD */}
 <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 space-y-3.5">
 <div className="flex items-center justify-between">
 <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Readability Matrix</span>
 <span className="text-[10px] font-mono font-bold text-blue-600 bg-white border border-slate-200 px-2 py-0.5 rounded font-mono">Flesch Scale</span>
 </div>
 
 <div className="flex items-baseline gap-2">
 <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">
 {blogLinguisticStats.readingEase}
 </span>
 <span className="text-slate-400 text-xs font-bold">/ 100</span>
 </div>

 <div className="space-y-1.5">
 <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
 <div 
 className={`h-full rounded-full transition-all duration-500 ${
 blogLinguisticStats.readingEase > 60 
 ? "bg-emerald-500" 
 : blogLinguisticStats.readingEase > 40 
 ? "bg-amber-500" 
 : "bg-rose-500"
 }`}
 style={{ width: `${blogLinguisticStats.readingEase}%` }}
 />
 </div>
 <div className="flex justify-between text-[10px] font-bold text-slate-500">
 <span>Complexity:</span>
 <span className={
 blogLinguisticStats.readingEase > 60 
 ? "text-emerald-700" 
 : blogLinguisticStats.readingEase > 40 
 ? "text-amber-700" 
 : "text-rose-700"
 }>
 {blogLinguisticStats.readingEase > 60 ? "Easy to Read" : blogLinguisticStats.readingEase > 40 ? "Moderate Complexity" : "Highly Complex"}
 </span>
 </div>
 </div>

 <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
 <span className="text-slate-500 font-medium">Estimated Grade Level:</span>
 <span className="font-extrabold text-slate-800 bg-white border border-slate-100 px-2 py-0.5 rounded font-mono">
 Grade {blogLinguisticStats.gradeLevel} {blogLinguisticStats.gradeLevel <= 8 ? "(General)" : blogLinguisticStats.gradeLevel <= 12 ? "(Professional)" : "(Academic)"}
 </span>
 </div>
 </div>

 {/* 2. SENTIMENT & TONE CARD */}
 <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 space-y-3.5">
 <div className="flex items-center justify-between">
 <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Sentiment & Tone</span>
 <Smile className="h-4 w-4 text-amber-500" />
 </div>

 <div className="space-y-0.5">
 <span className="text-xs font-extrabold text-slate-800 block line-clamp-1">
 {blogLinguisticStats.sentimentLabel}
 </span>
 <span className="text-[10px] text-slate-400 font-bold block">
 Dominant: <strong className="text-slate-600 font-extrabold">{blogLinguisticStats.sentimentTone}</strong>
 </span>
 </div>

 {/* Sentiment slider gauge */}
 <div className="space-y-1.5">
 <div className="relative w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
 <div 
 className={`absolute top-0 bottom-0 rounded-full transition-all duration-500 ${
 blogLinguisticStats.sentimentScore >= 0 ? "bg-emerald-500" : "bg-rose-500"
 }`}
 style={{
 left: blogLinguisticStats.sentimentScore >= 0 ? "50%" : `${50 + (blogLinguisticStats.sentimentScore / 2)}%`,
 right: blogLinguisticStats.sentimentScore >= 0 ? `${50 - (blogLinguisticStats.sentimentScore / 2)}%` : "50%"
 }}
 />
 <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-400" />
 </div>
 <div className="flex justify-between text-[9px] font-mono font-bold text-slate-400">
 <span>Critical</span>
 <span>Neutral</span>
 <span>Positive</span>
 </div>
 </div>

 {/* Mini tone Breakdown percentages */}
 <div className="pt-2 border-t border-slate-100 grid grid-cols-4 gap-1 text-center text-[9px]">
 <div className="bg-white py-1 rounded border border-slate-100">
 <span className="block text-slate-400 font-medium">Pos</span>
 <span className="font-bold text-slate-700 font-mono">{blogLinguisticStats.toneBreakdown.positive}%</span>
 </div>
 <div className="bg-white py-1 rounded border border-slate-100">
 <span className="block text-slate-400 font-medium">Neg</span>
 <span className="font-bold text-slate-700 font-mono">{blogLinguisticStats.toneBreakdown.negative}%</span>
 </div>
 <div className="bg-white py-1 rounded border border-slate-100">
 <span className="block text-slate-400 font-medium">Anal</span>
 <span className="font-bold text-slate-700 font-mono">{blogLinguisticStats.toneBreakdown.analytical}%</span>
 </div>
 <div className="bg-white py-1 rounded border border-slate-100">
 <span className="block text-slate-400 font-medium">Vis</span>
 <span className="font-bold text-slate-700 font-mono">{blogLinguisticStats.toneBreakdown.visionary}%</span>
 </div>
 </div>
 </div>

 {/* 3. LINGUISTIC STYLE & METRICS CARD */}
 <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 space-y-3.5">
 <div className="flex items-center justify-between">
 <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Linguistic Flow</span>
 <span className="text-[10px] font-mono font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded font-mono">Ratios</span>
 </div>

 <div className="space-y-2">
 {/* Passive Voice ratio */}
 <div className="space-y-1">
 <div className="flex justify-between text-[10px] font-bold text-slate-600">
 <span>Passive Voice Density</span>
 <span className="font-mono text-slate-800">{blogLinguisticStats.passiveVoicePercent}%</span>
 </div>
 <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
 <div 
 className={`h-full rounded-full ${
 blogLinguisticStats.passiveVoicePercent <= 15 ? "bg-emerald-500" : "bg-amber-500"
 }`} 
 style={{ width: `${blogLinguisticStats.passiveVoicePercent}%` }}
 />
 </div>
 </div>

 {/* Transition words density */}
 <div className="space-y-1">
 <div className="flex justify-between text-[10px] font-bold text-slate-600">
 <span>Transition Words Flow</span>
 <span className="font-mono text-slate-800">{blogLinguisticStats.transitionPercent}%</span>
 </div>
 <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
 <div 
 className={`h-full rounded-full ${
 blogLinguisticStats.transitionPercent >= 20 ? "bg-emerald-500" : "bg-amber-500"
 }`} 
 style={{ width: `${blogLinguisticStats.transitionPercent}%` }}
 />
 </div>
 </div>
 </div>

 <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
 <span className="text-slate-500 font-medium">Passive Voice status:</span>
 <span className={`font-bold ${blogLinguisticStats.passiveVoicePercent <= 10 ? "text-emerald-600" : "text-amber-600"}`}>
 {blogLinguisticStats.passiveVoicePercent <= 10 ? "Excellent (Active)" : "Moderate"}
 </span>
 </div>
 </div>
 </div>

 {/* SENTENCE LENGTH DISTRIBUTION & BUZZWORD SCAN */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-slate-100">
 {/* Sentence length distribution */}
 <div className="space-y-2">
 <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">Sentence Variety & Structure</span>
 <div className="space-y-1.5">
 <div className="flex h-3.5 rounded-full overflow-hidden text-[9px] font-bold text-white">
 <div 
 className="bg-sky-400 hover:bg-sky-500 transition-all flex items-center justify-center"
 style={{ width: `${blogLinguisticStats.sentenceDistribution.short}%` }}
 title={`Short sentences (<12 words): ${blogLinguisticStats.sentenceDistribution.short}%`}
 >
 {blogLinguisticStats.sentenceDistribution.short > 15 && `${blogLinguisticStats.sentenceDistribution.short}%`}
 </div>
 <div 
 className="bg-emerald-400 hover:bg-emerald-500 transition-all flex items-center justify-center"
 style={{ width: `${blogLinguisticStats.sentenceDistribution.medium}%` }}
 title={`Medium sentences (12-25 words): ${blogLinguisticStats.sentenceDistribution.medium}%`}
 >
 {blogLinguisticStats.sentenceDistribution.medium > 15 && `${blogLinguisticStats.sentenceDistribution.medium}%`}
 </div>
 <div 
 className="bg-purple-400 hover:bg-purple-500 transition-all flex items-center justify-center"
 style={{ width: `${blogLinguisticStats.sentenceDistribution.long}%` }}
 title={`Long sentences (>25 words): ${blogLinguisticStats.sentenceDistribution.long}%`}
 >
 {blogLinguisticStats.sentenceDistribution.long > 15 && `${blogLinguisticStats.sentenceDistribution.long}%`}
 </div>
 </div>
 <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
 <div className="flex items-center gap-1">
 <span className="w-2 h-2 rounded-full bg-sky-400" />
 <span>Short (&lt;12w)</span>
 </div>
 <div className="flex items-center gap-1">
 <span className="w-2 h-2 rounded-full bg-emerald-400" />
 <span>Medium (12-25w)</span>
 </div>
 <div className="flex items-center gap-1">
 <span className="w-2 h-2 rounded-full bg-purple-400" />
 <span>Long (&gt;25w)</span>
 </div>
 </div>
 </div>
 </div>

 {/* Clich / Buzzword Tracker */}
 <div className="space-y-1.5">
 <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">Buzzword & Clich Audit</span>
 {blogLinguisticStats.buzzwordsCount === 0 ? (
 <div className="p-2 bg-emerald-50/50 border border-emerald-100 rounded-xl text-emerald-700 text-[11px] flex items-center gap-1.5 font-semibold">
 <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
 <span>Zero fluff or corporate buzzwords detected. Text is highly clear and natural.</span>
 </div>
 ) : (
 <div className="space-y-1.5">
 <div className="flex flex-wrap gap-1.5">
 {blogLinguisticStats.buzzwordsFound.map((bw, i) => (
 <span key={i} className="bg-amber-50 text-amber-800 border border-amber-200 rounded-lg px-2 py-0.5 text-[10px] font-bold font-mono">
 {bw}
 </span>
 ))}
 </div>
 <span className="text-[10px] text-amber-600 font-bold block">
  Overusing generic marketing expressions can reduce authority. Consider replacement.
 </span>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Generated Prose Article Panel with Keyword Density Heatmap */}
 <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6 relative">
 {/* Title bar */}
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 gap-3">
 <div>
 <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
 Optimization Hub
 </span>
 <h3 className="text-sm font-extrabold text-slate-800 mt-1">Generated Article Copy & Interactive Keyword Audit</h3>
 </div>
 <button
 onClick={() => handleCopy(blogPost.content, setBlogCopied)}
 className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3.5 py-2 rounded-xl border border-blue-100 flex items-center gap-1.5 font-bold cursor-pointer transition-colors shrink-0"
 >
 {blogCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
 <span>{blogCopied ? "Markdown Copied!" : "Copy Full Article"}</span>
 </button>
 </div>

 {/* Interactive Heatmap & Density Tracker */}
 <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200/60 space-y-5">
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
 <div className="space-y-0.5">
 <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
 <Activity className="h-4 w-4 text-emerald-600" />
 <span>Paragraph Keyword Distribution Heatmap</span>
 </h4>
 <p className="text-[10px] text-slate-500 font-medium">
 Visual representation of keyword density across article paragraphs. Hover over any block to preview optimization.
 </p>
 </div>

 {/* Highlight toggle control */}
 <label className="flex items-center gap-2 cursor-pointer select-none shrink-0 bg-white border border-slate-200 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-colors">
 <input
 type="checkbox"
 checked={highlightKeywords}
 onChange={(e) => setHighlightKeywords(e.target.checked)}
 className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 border-slate-300"
 />
 <span className="text-[11px] font-extrabold text-slate-700">Highlight Keywords</span>
 </label>
 </div>

 {/* Density metrics summary row */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {/* Primary Keyword Status */}
 <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
 <div className="space-y-1 min-w-0">
 <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Primary Keyword Density</span>
 <span className="font-extrabold text-xs text-slate-800 block truncate" title={blogKeyword || "None"}>
 "{blogKeyword || "None"}"
 </span>
 <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md border ${keywordDensityMetrics.primaryMetrics.color}`}>
 {keywordDensityMetrics.primaryMetrics.status}
 </span>
 </div>
 <div className="text-right shrink-0">
 <span className="text-base font-extrabold text-slate-800 block font-mono">
 {keywordDensityMetrics.primaryMetrics.density.toFixed(1)}%
 </span>
 <span className="text-[9px] font-bold text-slate-400 uppercase block font-mono">
 {keywordDensityMetrics.primaryMetrics.count} Occurrences
 </span>
 </div>
 </div>

 {/* Secondary Keywords density stats */}
 <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2 max-h-[140px] overflow-y-auto">
 <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Secondary Keywords Density</span>
 {keywordDensityMetrics.secondaryMetrics.length === 0 ? (
 <span className="text-[10px] font-bold text-slate-400 italic block">No secondary keywords configured.</span>
 ) : (
 <div className="space-y-1.5">
 {keywordDensityMetrics.secondaryMetrics.map((sm, i) => (
 <div key={i} className="flex justify-between items-center text-[11px] font-medium border-b border-slate-50 pb-1.5 last:border-0 last:pb-0">
 <span className="text-slate-700 font-bold truncate max-w-[150px]" title={sm.keyword}>
 {sm.keyword}
 </span>
 <div className="flex items-center gap-2">
 <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${sm.color}`}>
 {sm.count}x ({sm.density.toFixed(1)}%)
 </span>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>

 {/* Heatmap Grid */}
 <div className="space-y-3">
 <div className="flex flex-wrap gap-2">
 {keywordDensityMetrics.paragraphs.length === 0 ? (
 <div className="text-center py-4 text-[11px] font-medium text-slate-400 w-full">
 Generating structured paragraphs for density analyzer...
 </div>
 ) : (
 keywordDensityMetrics.paragraphs.map((p, idx) => {
 // Color code by heatLevel
 let bgClass = "bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200";
 if (p.heatLevel === 1) bgClass = "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200";
 else if (p.heatLevel === 2) bgClass = "bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300";
 else if (p.heatLevel === 3) bgClass = "bg-rose-100 hover:bg-rose-200 text-rose-900 border-rose-300 ring-2 ring-rose-300/30";

 const isCurrent = hoveredHeatmapIndex === idx;

 return (
 <div
 key={p.index}
 className={`w-9 h-9 flex items-center justify-center rounded-lg text-[11px] font-extrabold border cursor-pointer select-none transition-all duration-150 ${bgClass} ${isCurrent ? "scale-110 shadow-xs border-slate-800 ring-2 ring-slate-800/20" : ""}`}
 onMouseEnter={() => setHoveredHeatmapIndex(idx)}
 onMouseLeave={() => setHoveredHeatmapIndex(null)}
 title={`Paragraph ${p.index + 1}: ${p.totalKeywordsCount} keyword(s)`}
 >
 P{p.index + 1}
 </div>
 );
 })
 )}
 </div>

 {/* Heatmap Legend */}
 <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-bold text-slate-500 pt-2 border-t border-slate-100">
 <span className="flex items-center gap-1">
 <span className="w-3 h-3 bg-slate-100 border border-slate-200 rounded" />
 <span>No Keywords</span>
 </span>
 <span className="flex items-center gap-1">
 <span className="w-3 h-3 bg-emerald-50 border border-emerald-200 rounded" />
 <span>Optimal (1 keyword)</span>
 </span>
 <span className="flex items-center gap-1">
 <span className="w-3 h-3 bg-amber-100 border border-amber-300 rounded" />
 <span>High (2 keywords)</span>
 </span>
 <span className="flex items-center gap-1">
 <span className="w-3 h-3 bg-rose-100 border border-rose-300 rounded" />
 <span>Over-saturated (3+ keywords)</span>
 </span>
 </div>
 </div>

 {/* Hover tooltip detail card */}
 <AnimatePresence mode="wait">
 {hoveredHeatmapIndex !== null && keywordDensityMetrics.paragraphs[hoveredHeatmapIndex] && (() => {
 const p = keywordDensityMetrics.paragraphs[hoveredHeatmapIndex];
 return (
 <motion.div
 initial={{ opacity: 0, y: 5 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: 5 }}
 transition={{ duration: 0.15 }}
 className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800 shadow-lg text-[11px] space-y-1.5"
 >
 <div className="flex justify-between items-center font-bold">
 <span className="text-blue-400">PARAGRAPH {p.index + 1} DETAILS</span>
 <span className="text-slate-400 font-mono">{p.wordCount} words</span>
 </div>
 <p className="text-slate-300 italic leading-relaxed">
 "{p.preview}"
 </p>
 <div className="flex flex-wrap gap-1.5 pt-1">
 {p.keywordsFound.length === 0 ? (
 <span className="text-slate-400 font-semibold">No target keywords in this block.</span>
 ) : (
 p.keywordsFound.map((f, i) => (
 <span key={i} className="bg-slate-800 text-blue-300 border border-slate-700 rounded px-2 py-0.5 font-bold font-mono text-[9px]">
 {f}
 </span>
 ))
 )}
 </div>
 </motion.div>
 );
 })()}
 </AnimatePresence>
 </div>

 {/* Rendered markdown style blocks with custom keyword highlighting */}
 <div 
 className="markdown-body text-slate-800 space-y-4" 
 dangerouslySetInnerHTML={{ 
 __html: highlightKeywords 
 ? highlightKeywordsInHtml(formatMarkdownToHtml(blogPost.content), blogKeyword, secondaryKeywords) 
 : formatMarkdownToHtml(blogPost.content) 
 }} 
 />
 </div>

 {/* Accordion FAQs Section (Engagement Element) */}
 {blogPost.faqSection && (
 <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
 <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-3">
 <HelpCircle className="h-4 w-4 text-blue-500" />
 <span>Frequently Asked Questions (Engagement Accordions)</span>
 </div>
 <div className="space-y-2">
 {blogPost.faqSection.map((faq, i) => (
 <div key={i} className="border border-slate-100 rounded-xl overflow-hidden">
 <button
 onClick={() => setActiveFaq(activeFaq === i ? null : i)}
 className="w-full flex justify-between items-center p-4 bg-slate-50/50 hover:bg-slate-50 text-left font-bold text-slate-800 text-xs cursor-pointer transition-colors"
 >
 <span>{faq.question}</span>
 <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${activeFaq === i ? "rotate-180" : ""}`} />
 </button>
 {activeFaq === i && (
 <div className="p-4 bg-white border-t border-slate-100 text-xs text-slate-600 leading-relaxed">
 {faq.answer}
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 );
}