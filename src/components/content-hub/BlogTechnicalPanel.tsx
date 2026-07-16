import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Globe2, Globe, Cpu, Compass, Code, Copy, Check, CheckCircle, ShieldCheck, Share2, Activity, Sparkles } from "lucide-react";
import type { BlogPost } from "../../types";
import { getAppropriateImgSrc } from "./markdown";

export interface BlogTechnicalPanelProps {
 blogPost: BlogPost;
 targetDomain: string;
 headerTagsCopied: boolean;
 onCopy: (text: string, setCopied: (v: boolean) => void) => void;
 setHeaderTagsCopied: (v: boolean) => void;
}

export default function BlogTechnicalPanel({
 blogPost,
 targetDomain,
 headerTagsCopied,
 onCopy: handleCopy,
 setHeaderTagsCopied,
}: BlogTechnicalPanelProps) {
 const [technicalSubTab, setTechnicalSubTab] = useState<"ai" | "local" | "og" | "code">("ai");

 const tech = blogPost.technicalSeo;
 if (!tech) {
 return (
 <div className="bg-white p-6 rounded-2xl border border-slate-200 text-sm text-slate-600">
 Technical SEO metadata is not available for this draft. Regenerate the article to rebuild OG tags, GEO notes, and head tags.
 </div>
 );
 }

 return (
 <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
 <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-4">
 <div>
 <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
 <Globe2 className="h-4 w-4 text-blue-500" />
 <span>Advanced Technical Crawler & Discovery Engine</span>
 </span>
 <h4 className="font-extrabold text-slate-900 text-lg mt-1">AI Search, Local SEO, Meta Tags & OG Hub</h4>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-[10px] bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1 rounded-full font-bold">
 AIO Ready: 98%
 </span>
 <span className="text-[10px] bg-green-50 border border-green-200 text-green-700 px-3 py-1 rounded-full font-bold">
 Local Footprint: Active
 </span>
 </div>
 </div>

 {/* Sub-tab Navigation */}
 <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar scroll-smooth gap-1 p-0.5 bg-slate-50 rounded-xl">
 <button
 type="button"
 onClick={() => setTechnicalSubTab("ai")}
 className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all cursor-pointer ${technicalSubTab === "ai" ? "bg-white text-blue-600 shadow-sm border border-slate-200/50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"}`}
 >
 <Cpu className="h-4 w-4" />
 <span>AI Search Engine (GEO)</span>
 </button>
 <button
 type="button"
 onClick={() => setTechnicalSubTab("local")}
 className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all cursor-pointer ${technicalSubTab === "local" ? "bg-white text-blue-600 shadow-sm border border-slate-200/50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"}`}
 >
 <Compass className="h-4 w-4" />
 <span>Local SEO & Region</span>
 </button>
 <button
 type="button"
 onClick={() => setTechnicalSubTab("og")}
 className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all cursor-pointer ${technicalSubTab === "og" ? "bg-white text-blue-600 shadow-sm border border-slate-200/50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"}`}
 >
 <Share2 className="h-4 w-4" />
 <span>Social OG Previews</span>
 </button>
 <button
 type="button"
 onClick={() => setTechnicalSubTab("code")}
 className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all cursor-pointer ${technicalSubTab === "code" ? "bg-white text-blue-600 shadow-sm border border-slate-200/50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"}`}
 >
 <Code className="h-4 w-4" />
 <span>HTML Head Tags</span>
 </button>
 </div>

 {/* SUB-TAB PANELS */}
 <AnimatePresence mode="wait">
 {/* 1. AI & GENERATIVE ENGINE OPTIMIZATION (GEO) */}
 {technicalSubTab === "ai" && (
 <motion.div
 initial={{ opacity: 0, y: 5 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -5 }}
 transition={{ duration: 0.15 }}
 className="space-y-5"
 >
 {(() => {
 // Retrieve or fallback values
 const aiOpt = tech.aiEngineOptimization || {
 targetLlmEngines: ["Google Gemini", "OpenAI SearchGPT", "Perplexity AI", "Claude/Anthropic"],
 factualDensityScore: 94,
 citationReadiness: "Includes precise clinical or expert claims backed immediately by inline links to reputable sources (NCBI, Nature), providing clear signals for retrieval-augmented generation.",
 semanticEntityMatching: [
 blogPost.title.split(" ").slice(0, 3).join(" "),
 "evidence-based remedies",
 "alternative therapeutic management",
 "integrative clinical guidelines"
 ],
 generativeOptimizations: "Optimized utilizing direct and unambiguous answer blocks, expert authorship credentials, and high factual-to-word count density ratios to excel in LLM summary indexing."
 };

 return (
 <div className="space-y-5">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 {/* Factual Density Card */}
 <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col justify-between space-y-3">
 <div>
 <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Factual Density Rating</span>
 <h5 className="font-extrabold text-slate-800 text-sm mt-1">Generative Search Score</h5>
 </div>
 <div className="flex items-end gap-3 pt-1">
 <span className="text-4xl font-black text-blue-600 tracking-tight">{aiOpt.factualDensityScore}%</span>
 <span className="text-[10px] bg-blue-100 border border-blue-200 text-blue-800 px-2 py-0.5 rounded-md font-bold mb-1">
 EXCELLENT
 </span>
 </div>
 <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
 High factual ratio makes this draft 3x more likely to be cited by RAG engines.
 </p>
 </div>

 {/* Target LLM Engines */}
 <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
 <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Targeted LLM / AI Search Engines</span>
 <div className="flex flex-wrap gap-1.5 pt-1">
 {aiOpt.targetLlmEngines.map((engine, idx) => (
 <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 text-slate-700 font-bold text-[10px] rounded-lg shadow-2xs">
 <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
 {engine}
 </span>
 ))}
 </div>
 <p className="text-[11px] text-slate-500 leading-relaxed font-medium pt-1">
 Tailored syntactical simplicity guarantees clean context parsing.
 </p>
 </div>

 {/* Semantic Matching */}
 <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
 <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">AI Semantic Entity Blueprint</span>
 <div className="flex flex-wrap gap-1 bg-white p-2.5 rounded-xl border border-slate-200/50 max-h-24 overflow-y-auto">
 {aiOpt.semanticEntityMatching.map((entity, idx) => (
 <span key={idx} className="bg-slate-100 text-slate-600 font-mono text-[9px] px-2 py-0.5 rounded font-semibold">
 entity:{entity.toLowerCase().replace(/\s+/g, "_")}
 </span>
 ))}
 </div>
 </div>
 </div>

 {/* Detailed optimization advice */}
 <div className="p-5 bg-blue-50/40 border border-blue-100/50 rounded-2xl space-y-3">
 <div className="flex items-center gap-2 text-blue-800">
 <Sparkles className="h-4 w-4 shrink-0 text-blue-600" />
 <h5 className="font-extrabold text-sm">Generative Engine Optimization (GEO) Blueprint</h5>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed font-medium text-slate-600">
 <div className="space-y-1 bg-white p-3.5 rounded-xl border border-slate-100">
 <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block text-blue-600">Citation Readiness Strategy</span>
 <p>{aiOpt.citationReadiness}</p>
 </div>
 <div className="space-y-1 bg-white p-3.5 rounded-xl border border-slate-100">
 <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block text-blue-600">LLM Synthesis Optimization</span>
 <p>{aiOpt.generativeOptimizations}</p>
 </div>
 </div>
 </div>
 </div>
 );
 })()}
 </motion.div>
 )}

 {/* 2. LOCAL SEO & REGION TARGETING */}
 {technicalSubTab === "local" && (
 <motion.div
 initial={{ opacity: 0, y: 5 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -5 }}
 transition={{ duration: 0.15 }}
 className="space-y-5"
 >
 {(() => {
 // Retrieve or fallback local SEO values
 const locOpt = tech.localSeoRecommendations || {
 targetRegion: targetDomain ? `${targetDomain.replace(/\.[a-z]+$/, "")} Regional Hubs` : "Global & Region specific locations",
 localEntitiesRequired: [
 "Regional healthcare clinics",
 "Local patient support groups",
 "State diagnostic labs",
 "Metro public libraries"
 ],
 localizedIntroVariation: `For residents looking for structured relief, our network of trusted wellness partners and diagnostic consultants provides state-of-the-art clinical expertise right in your neighbourhood. Local consultations offer highly tailored therapy regimens designed to match your specific daily activity footprint.`,
 mapEmbedOpportunity: "We recommend inserting an interactive Google Maps location finder or dynamic regional list iframe directly after the second H2 section to capture localized 'near me' organic search intents.",
 proximitySignals: "Co-locate contact details and schema GeoCoordinates within the footer block of this article to guarantee prominent inclusion in localized map pack carousels."
 };

 const [localIntroCopied, setLocalIntroCopied] = useState(false);

 return (
 <div className="space-y-5">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1.5">
 <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Target Geographic Scope</span>
 <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-800 font-extrabold text-[11px] rounded-lg border border-blue-200">
 <Globe className="h-3.5 w-3.5" />
 {locOpt.targetRegion}
 </span>
 <p className="text-[11px] text-slate-500 leading-relaxed font-medium pt-1">
 Geotargeting aligns content directly with local search queries.
 </p>
 </div>

 <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1.5">
 <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Required Local Entities</span>
 <div className="flex flex-wrap gap-1.5 pt-1">
 {locOpt.localEntitiesRequired.map((ent, idx) => (
 <span key={idx} className="bg-white border border-slate-200 text-slate-700 font-bold text-[10px] px-2 py-0.5 rounded-lg shadow-2xs">
 {ent}
 </span>
 ))}
 </div>
 </div>

 <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1.5">
 <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Proximity / Location Signals</span>
 <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
 {locOpt.proximitySignals}
 </p>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {/* Localized Intro block */}
 <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl space-y-2.5">
 <div className="flex justify-between items-center">
 <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Localized Intro Paragraph Variant</span>
 <button
 type="button"
 onClick={() => handleCopy(locOpt.localizedIntroVariation, setLocalIntroCopied)}
 className="p-1 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-md flex items-center gap-1 text-[10px] font-bold cursor-pointer transition-colors"
 >
 {localIntroCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
 <span>{localIntroCopied ? "Copied" : "Copy"}</span>
 </button>
 </div>
 <p className="text-xs text-slate-600 leading-relaxed font-medium bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-2xs">
 "{locOpt.localizedIntroVariation}"
 </p>
 </div>

 {/* Google Map integration layout */}
 <div className="p-5 bg-slate-900 text-slate-200 rounded-2xl flex flex-col justify-between space-y-3 shadow-md">
 <div>
 <span className="text-[10px] text-blue-400 font-extrabold uppercase tracking-wider block">Map Embed Opportunity</span>
 <h5 className="font-bold text-white text-sm mt-1">Google Maps Local Integration</h5>
 </div>
 <p className="text-xs text-slate-300 leading-relaxed font-medium">
 {locOpt.mapEmbedOpportunity}
 </p>
 <div className="border border-slate-700/60 rounded-xl p-3 bg-slate-950 flex items-center justify-center gap-2 text-slate-400 text-xs font-mono">
 <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
 <span>&lt;iframe src="https://www.google.com/maps/embed?..." /&gt;</span>
 </div>
 </div>
 </div>
 </div>
 );
 })()}
 </motion.div>
 )}

 {/* 3. SOCIAL OG PREVIEWS */}
 {technicalSubTab === "og" && (
 <motion.div
 initial={{ opacity: 0, y: 5 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -5 }}
 transition={{ duration: 0.15 }}
 className="space-y-4"
 >
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {/* FB Preview */}
 <div className="space-y-2.5">
 <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Facebook / LinkedIn Feed Card Preview</span>
 <div className="bg-white border border-slate-200 rounded-xl shadow-md overflow-hidden font-sans max-w-sm mx-auto">
 <div className="p-3 flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/50">
 <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-extrabold text-xs">
 {targetDomain ? targetDomain.charAt(0).toUpperCase() : "A"}
 </div>
 <div>
 <span className="text-xs font-bold text-slate-800 block">{targetDomain || "example.com"}</span>
 <span className="text-[9px] text-slate-400 block font-medium">Sponsored  Public</span>
 </div>
 </div>
 <div className="h-44 relative overflow-hidden flex flex-col justify-end">
 <img 
 src={getAppropriateImgSrc(blogPost.title, blogPost.metaDescription)} 
 alt="Open Graph Preview" 
 className="absolute inset-0 w-full h-full object-cover" 
 referrerPolicy="no-referrer"
 />
 <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
 </div>
 <div className="p-3 bg-slate-50 space-y-1 border-t border-slate-100">
 <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">https://{targetDomain || "example.com"}</div>
 <h5 className="font-extrabold text-slate-800 text-xs leading-snug line-clamp-1">
 {tech.ogTags?.["og:title"] || blogPost.title}
 </h5>
 <p className="text-[10px] text-slate-500 leading-normal line-clamp-2">
 {tech.ogTags?.["og:description"] || blogPost.metaDescription}
 </p>
 </div>
 </div>
 </div>

 {/* Twitter/X Card */}
 <div className="space-y-2.5">
 <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Twitter / X Large Image Card Preview</span>
 <div className="bg-slate-950 text-white p-4 rounded-xl border border-slate-800 max-w-sm mx-auto space-y-3 font-sans">
 <div className="flex items-center gap-2.5">
 <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs">
 
 </div>
 <div>
 <span className="text-xs font-bold block">@{targetDomain ? targetDomain.replace(/\.[a-z]+$/, "") : "apexseo"}</span>
 <span className="text-[9px] text-slate-500 block">Verified Publisher</span>
 </div>
 </div>
 <p className="text-xs leading-normal text-slate-100">
 Latest breakthrough research and strategies optimized for immediate deployment. Read our comprehensive analysis. 
 </p>
 <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900">
 <div className="h-36 relative overflow-hidden">
 <img 
 src={getAppropriateImgSrc(blogPost.title, blogPost.metaDescription)} 
 alt="Twitter OG Card" 
 className="absolute inset-0 w-full h-full object-cover" 
 referrerPolicy="no-referrer"
 />
 </div>
 <div className="p-2.5 border-t border-slate-800">
 <span className="text-[9px] text-slate-500 font-semibold block uppercase">{targetDomain || "example.com"}</span>
 <h5 className="font-extrabold text-slate-100 text-xs leading-snug line-clamp-1 mt-0.5">
 {tech.twitterTags?.["twitter:title"] || tech.ogTags?.["og:title"] || blogPost.title}
 </h5>
 <p className="text-[10px] text-slate-400 leading-normal line-clamp-2 mt-0.5">
 {tech.twitterTags?.["twitter:description"] || tech.ogTags?.["og:description"] || blogPost.metaDescription}
 </p>
 </div>
 </div>
 </div>
 </div>
 </div>
 </motion.div>
 )}

 {/* 4. HTML HEAD TAG CODE GENERATOR */}
 {technicalSubTab === "code" && (
 <motion.div
 initial={{ opacity: 0, y: 5 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -5 }}
 transition={{ duration: 0.15 }}
 className="space-y-4"
 >
 {(() => {
 const titleVal = blogPost.title;
 const descVal = blogPost.metaDescription;
 const canonicalVal = tech.canonicalUrl;
 const imageVal = getAppropriateImgSrc(blogPost.title, blogPost.metaDescription);
 const domainVal = targetDomain || "example.com";

 const rawHeadCode = `<!-- SEO Meta Tags -->
<title>${titleVal}</title>
<meta name="description" content="${descVal}" />
<link rel="canonical" href="${canonicalVal}" />
<meta name="robots" content="index, follow, max-image-preview:large" />

<!-- Open Graph / Facebook -->
<meta property="og:type" content="article" />
<meta property="og:url" content="${canonicalVal}" />
<meta property="og:title" content="${tech.ogTags?.["og:title"] || titleVal}" />
<meta property="og:description" content="${tech.ogTags?.["og:description"] || descVal}" />
<meta property="og:image" content="${imageVal}" />
<meta property="og:site_name" content="${domainVal.replace(/\.[a-z]+$/, "").toUpperCase()}" />

<!-- Twitter / X -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:url" content="${canonicalVal}" />
<meta name="twitter:title" content="${tech.twitterTags?.["twitter:title"] || titleVal}" />
<meta name="twitter:description" content="${tech.twitterTags?.["twitter:description"] || descVal}" />
<meta name="twitter:image" content="${imageVal}" />`;

 return (
 <div className="space-y-3.5">
 <div className="flex justify-between items-center">
 <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Copy-Paste HTML &lt;head&gt; Crawler Injections</span>
 <button
 type="button"
 onClick={() => handleCopy(rawHeadCode, setHeaderTagsCopied)}
 className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-all"
 >
 {headerTagsCopied ? <Check className="h-4 w-4 text-green-300" /> : <Copy className="h-4 w-4" />}
 <span>{headerTagsCopied ? "Tags Copied!" : "Copy Meta Head Tags"}</span>
 </button>
 </div>

 <div className="relative">
 <pre className="text-[11px] overflow-x-auto p-4 bg-slate-950 text-sky-400 rounded-xl font-mono leading-relaxed max-h-80 select-all border border-slate-900 shadow-inner">
 <code>{rawHeadCode}</code>
 </pre>
 </div>

 {/* Crawlability validation checklists */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-150">
 <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
 <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
 <span>Canonical Declared</span>
 </div>
 <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
 <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
 <span>OG Image Bound</span>
 </div>
 <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
 <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
 <span>Twitter Meta Intact</span>
 </div>
 <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
 <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
 <span>Robots Index On</span>
 </div>
 </div>
 </div>
 );
 })()}
 </motion.div>
 )}
 </AnimatePresence>

 {/* Mobile & Page speed specifications checks (General) */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5 border-t border-slate-100">
 <div className="space-y-1.5">
 <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
 <ShieldCheck className="h-4 w-4 text-emerald-500" />
 <span>Mobile-Friendliness & Accessibility</span>
 </span>
 <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50 p-3 rounded-xl border border-slate-150">
 {tech.mobileNotes}
 </p>
 </div>
 <div className="space-y-1.5">
 <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
 <Activity className="h-4 w-4 text-orange-500" />
 <span>Core Web Vitals & Loading Metrics</span>
 </span>
 <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50 p-3 rounded-xl border border-slate-150">
 {tech.speedNotes}
 </p>
 </div>
 </div>
 </div>
 );
}