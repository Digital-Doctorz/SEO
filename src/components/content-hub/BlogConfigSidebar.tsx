import type { MouseEvent } from "react";
import {
 Cpu, Plus, X, Trash2, History, Settings, RefreshCw, PenTool,
 User, Volume2, ChevronRight, Bookmark, Save,
} from "lucide-react";
import type { BlogPost } from "../../types";
import type { SavedArticle } from "./types";

export interface BlogConfigSidebarProps {
 showConfigForm: boolean;
 onShowConfigForm: (v: boolean) => void;
 blogTopic: string;
 onBlogTopic: (v: string) => void;
 blogKeyword: string;
 onBlogKeyword: (v: string) => void;
 secondaryKeywords: string[];
 secKeywordInput: string;
 onSecKeywordInput: (v: string) => void;
 onAddSecondaryKeyword: () => void;
 onRemoveSecondaryKeyword: (kw: string) => void;
 wordCount: number;
 onWordCount: (v: number) => void;
 targetAudience: string;
 onTargetAudience: (v: string) => void;
 toneOfVoice: string;
 onToneOfVoice: (v: string) => void;
 audienceOptions: string[];
 toneOptions: string[];
 isBlogGenerating: boolean;
 onGenerate: () => void;
 savedArticles: SavedArticle[];
 blogPost: BlogPost | null;
 onLoadSaved: (art: SavedArticle) => void;
 onDeleteSaved: (id: string, e: MouseEvent) => void;
 onUpdateLabel: (id: string, label: string) => void;
 onSaveVersion: () => void;
}

export default function BlogConfigSidebar(props: BlogConfigSidebarProps) {
 const {
 showConfigForm, onShowConfigForm,
 blogTopic, onBlogTopic,
 blogKeyword, onBlogKeyword,
 secondaryKeywords, secKeywordInput, onSecKeywordInput,
 onAddSecondaryKeyword, onRemoveSecondaryKeyword,
 wordCount, onWordCount,
 targetAudience, onTargetAudience,
 toneOfVoice, onToneOfVoice,
 audienceOptions, toneOptions,
 isBlogGenerating, onGenerate,
 savedArticles, blogPost,
 onLoadSaved, onDeleteSaved, onUpdateLabel, onSaveVersion,
 } = props;

 return (
 <div className="lg:col-span-5 space-y-6 self-start">
 <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
 {!showConfigForm && blogTopic ? (
 <div className="space-y-6">
 <div className="border-b border-slate-100 pb-4">
 <div className="flex items-center justify-between">
 <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
 <Cpu className="h-4.5 w-4.5 text-emerald-600 animate-pulse shrink-0" />
 <span>Automated SEO Active</span>
 </h3>
 <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
 Synced
 </span>
 </div>
 <p className="text-[11px] text-slate-400 mt-1">
 Ideal parameters have been automatically mapped and configured based on content gap and competitor metrics.
 </p>
 </div>

 <div className="space-y-4 bg-slate-50/60 p-4 rounded-xl border border-slate-100 text-xs">
 <div className="space-y-1">
 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Topic</span>
 <span className="font-bold text-slate-800 text-sm block leading-tight">{blogTopic}</span>
 </div>

 <div className="grid grid-cols-2 gap-4 pt-2">
 <div className="space-y-1">
 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Focus Keyword</span>
 <span className="font-bold text-blue-700 bg-blue-50/50 px-2 py-0.5 rounded-md border border-blue-100 inline-block truncate max-w-full">{blogKeyword || "None"}</span>
 </div>
 <div className="space-y-1">
 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Word Count</span>
 <span className="font-mono font-bold text-slate-700 block">{wordCount} words</span>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4 pt-1">
 <div className="space-y-1">
 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Audience</span>
 <span className="font-medium text-slate-700 block truncate" title={targetAudience}>{targetAudience}</span>
 </div>
 <div className="space-y-1">
 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Brand Tone</span>
 <span className="font-medium text-slate-700 block">{toneOfVoice}</span>
 </div>
 </div>

 {secondaryKeywords.length > 0 && (
 <div className="space-y-1 pt-2 border-t border-slate-100">
 <span className="text-[10px] font-bold text-slate-400 tracking-wider block uppercase">Secondary Keywords</span>
 <div className="flex flex-wrap gap-1 mt-1">
 {secondaryKeywords.map((kw, i) => (
 <span key={i} className="bg-white text-slate-600 px-2 py-0.5 rounded-md text-[10px] border border-slate-200">
 {kw}
 </span>
 ))}
 </div>
 </div>
 )}
 </div>

 <div className="space-y-3 pt-2">
 <button
 onClick={() => onShowConfigForm(true)}
 className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
 >
 <Settings className="h-4 w-4 text-slate-500" />
 <span>Regenerate Configuration</span>
 </button>
 
 {isBlogGenerating ? (
 <div className="w-full bg-blue-50 text-blue-700 border border-blue-100 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold">
 <span className="h-3.5 w-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
 <span>Gemini is drafting your article...</span>
 </div>
 ) : (
 <button
 onClick={() => onGenerate()}
 className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-xs shadow-sm shadow-blue-600/10"
 >
 <RefreshCw className="h-4 w-4" />
 <span>Re-draft &amp; Enhance Full Article</span>
 </button>
 )}
 </div>
 </div>
 ) : (
 <>
 <div className="border-b border-slate-100 pb-4">
 <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
 <PenTool className="h-4 w-4 text-blue-600" />
 <span>Article Configuration</span>
 </h3>
 <p className="text-[11px] text-slate-400 mt-1">Specify detailed keywords, target length, persona, and tone to generate highly optimized posts.</p>
 </div>

 <div className="space-y-4">
 {/* Target Topic */}
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Topic / Working Title</label>
 <input
 type="text"
 placeholder="e.g., How to build a successful backlink strategy"
 value={blogTopic}
 onChange={(e) => onBlogTopic(e.target.value)}
 className="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
 />
 </div>

 {/* Focus Keyword (Primary) */}
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Primary Keyword (Anchor Term)</label>
 <input
 type="text"
 placeholder="e.g., backlink strategy"
 value={blogKeyword}
 onChange={(e) => onBlogKeyword(e.target.value)}
 className="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-blue-900 bg-blue-50/20"
 />
 </div>

 {/* Secondary Keywords Array */}
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Secondary Keywords (3-5 items)</label>
 <div className="flex gap-2">
 <input
 type="text"
 placeholder="Type keyword and press add..."
 value={secKeywordInput}
 onChange={(e) => onSecKeywordInput(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === "Enter") {
 e.preventDefault();
 onAddSecondaryKeyword();
 }
 }}
 className="flex-1 text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
 />
 <button
 onClick={onAddSecondaryKeyword}
 className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 cursor-pointer flex items-center gap-1 shrink-0"
 >
 <Plus className="h-3.5 w-3.5" />
 <span>Add</span>
 </button>
 </div>

 {/* Secondary Keywords tags list */}
 <div className="flex flex-wrap gap-1.5 pt-2">
 {secondaryKeywords.length > 0 ? (
 secondaryKeywords.map((kw, i) => (
 <span 
 key={i}
 className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg pl-2.5 pr-1.5 py-1 text-xs font-medium flex items-center gap-1"
 >
 <span>{kw}</span>
 <button 
 onClick={() => onRemoveSecondaryKeyword(kw)}
 className="hover:text-rose-600 p-0.5 rounded-full hover:bg-slate-100 cursor-pointer"
 >
 <X className="h-3 w-3" />
 </button>
 </span>
 ))
 ) : (
 <span className="text-[11px] text-slate-400 italic">No secondary keywords added yet.</span>
 )}
 </div>
 </div>

 {/* Target Word Count */}
 <div className="space-y-1.5">
 <div className="flex justify-between items-center text-xs font-bold text-slate-700 uppercase tracking-wider">
 <span>Target Word Count</span>
 <span className="font-mono text-blue-600">{wordCount} words</span>
 </div>
 <input
 type="range"
 min={400}
 max={1400}
 step={100}
 value={wordCount}
 onChange={(e) => onWordCount(Number(e.target.value))}
 className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
 />
 <div className="flex justify-between text-[10px] text-slate-400 font-bold">
 <span>400w (Short Post)</span>
 <span>1,200w (Standard)</span>
 <span>2,500w (Authority Pillar)</span>
 </div>
 </div>

 {/* Target Audience Selector */}
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block flex items-center gap-1">
 <User className="h-3.5 w-3.5 text-slate-400" />
 <span>Target Audience</span>
 </label>
 <select
 value={targetAudience}
 onChange={(e) => onTargetAudience(e.target.value)}
 className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
 >
 {audienceOptions.map((opt) => (
 <option key={opt} value={opt}>{opt}</option>
 ))}
 </select>
 </div>

 {/* Tone of Voice Selector */}
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block flex items-center gap-1">
 <Volume2 className="h-3.5 w-3.5 text-slate-400" />
 <span>Tone of Voice</span>
 </label>
 <select
 value={toneOfVoice}
 onChange={(e) => onToneOfVoice(e.target.value)}
 className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
 >
 {toneOptions.map((opt) => (
 <option key={opt} value={opt}>{opt}</option>
 ))}
 </select>
 </div>

 {/* Action Button */}
 <button
 onClick={() => onGenerate()}
 disabled={!blogTopic || isBlogGenerating}
 className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-600/15 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
 >
 {isBlogGenerating ? (
 <>
 <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
 <span>Gemini is drafting your article...</span>
 </>
 ) : (
 <>
 <span>Generate Complete Article</span>
 <ChevronRight className="h-4 w-4" />
 </>
 )}
 </button>

 {/* Back button to return to automated overview */}
 {blogTopic && (
 <button
 type="button"
 onClick={() => onShowConfigForm(false)}
 className="w-full text-slate-500 hover:text-slate-800 text-xs font-semibold py-1.5 block text-center cursor-pointer transition-all"
 >
  Back to Automated View
 </button>
 )}
 </div>
 </>
 )}
 </div>

 {/* SAVED ARTICLES CARD */}
 <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
 <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Bookmark className="h-4 w-4 text-blue-600 animate-pulse" />
 <h3 className="font-extrabold text-slate-900 text-sm">Saved Article Versions</h3>
 </div>
 <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono">
 {savedArticles.length} {savedArticles.length === 1 ? "version" : "versions"}
 </span>
 </div>

 {blogPost && (
 <button
 onClick={() => onSaveVersion()}
 className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
 >
 <Save className="h-3.5 w-3.5" />
 <span>Save Current Workspace State</span>
 </button>
 )}

 {savedArticles.length === 0 ? (
 <div className="text-center py-6 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
 <History className="h-8 w-8 text-slate-300 mx-auto mb-2" />
 <p className="text-xs font-bold text-slate-600">No versions saved yet</p>
 <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
 Successfully generated articles are auto-saved here. You can also manually commit your link modifications.
 </p>
 </div>
 ) : (
 <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
 {savedArticles.map((art) => {
 const isActive = blogPost && blogPost.title === art.title && blogPost.content === art.blogPost.content;
 return (
 <div
 key={art.id}
 onClick={() => onLoadSaved(art)}
 className={`p-3 rounded-xl border transition-all text-left cursor-pointer group space-y-2 ${
 isActive
 ? "bg-blue-50/70 border-blue-200 shadow-xs"
 : "bg-slate-50/50 hover:bg-slate-50 border-slate-100 hover:border-slate-200"
 }`}
 >
 <div className="flex items-start justify-between gap-2">
 <div className="space-y-0.5 min-w-0 flex-1">
 {/* Version Label / Editable Label */}
 <div className="flex items-center gap-1.5">
 <input
 type="text"
 value={art.customLabel || ""}
 onClick={(e) => e.stopPropagation()}
 onChange={(e) => onUpdateLabel(art.id, e.target.value)}
 placeholder="Add version label..."
 className={`text-[11px] font-bold tracking-tight rounded px-1 -mx-1 py-0.5 w-full bg-transparent border-0 focus:bg-white focus:ring-1 focus:ring-blue-300 focus:outline-none focus:border-slate-300 transition-all ${
 isActive ? "text-blue-800" : "text-slate-700"
 }`}
 />
 </div>
 <span className="text-[9px] text-slate-400 block font-mono">
 {art.timestamp}
 </span>
 </div>

 <div className="flex items-center gap-1 shrink-0">
 <button
 onClick={(e) => onDeleteSaved(art.id, e)}
 className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-slate-100/80 transition-all cursor-pointer"
 title="Delete version"
 >
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </div>
 </div>

 <div className="space-y-1">
 <p className="text-[11px] font-bold text-slate-800 line-clamp-1">
 {art.title}
 </p>
 <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-500">
 <span className="bg-white/85 px-1.5 py-0.5 rounded border border-slate-200 font-medium text-[9px]">
 {art.tone.split(" ")[0]}
 </span>
 <span className="bg-white/85 px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[9px]">
 {art.wordCount}w
 </span>
 {art.keyword && (
 <span className="bg-blue-50/50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 truncate max-w-[120px] text-[9px]">
 {art.keyword}
 </span>
 )}
 </div>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 </div>

 );
}
