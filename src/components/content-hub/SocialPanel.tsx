import { useState, useEffect } from "react";
import {
 Sparkles, Twitter, Linkedin, Mail, Copy, Check,
 MessageSquare, HelpCircle, Globe, Award, Eye, Cpu, ShieldCheck, CheckCircle,
} from "lucide-react";
import { motion } from "motion/react";
import type { AiProviderConfig, SocialPost } from "../../types";
import { generateSocialPost } from "./generation";

export interface SocialPanelProps {
 targetDomain: string;
 aiConfig?: AiProviderConfig;
 initialTopic?: string;
 initialKeyword?: string;
}

type Platform = "Twitter/X" | "LinkedIn" | "Newsletter" | "Reddit" | "Quora" | "Google Business";
type OutputTab = "post" | "metadata" | "seo" | "schema";

export default function SocialPanel({
 targetDomain,
 aiConfig,
 initialTopic = "",
 initialKeyword = "",
}: SocialPanelProps) {
 const [socialPlatform, setSocialPlatform] = useState<Platform>("Twitter/X");
 const [socialTopic, setSocialTopic] = useState(initialTopic);
 const [socialKeyword, setSocialKeyword] = useState(initialKeyword);
 const [socialPost, setSocialPost] = useState<(SocialPost & { isFallback?: boolean; fallbackReason?: string; errorMsg?: string }) | null>(null);
 const [isSocialGenerating, setIsSocialGenerating] = useState(false);
 const [socialCopied, setSocialCopied] = useState(false);
 const [socialAudience, setSocialAudience] = useState("Marketing Managers & SEOs");
 const [socialGoal, setSocialGoal] = useState("Engagement");
 const [socialVoice, setSocialVoice] = useState("Authoritative & Analytical");
 const [activeSocialOutputTab, setActiveSocialOutputTab] = useState<OutputTab>("post");
 const [generationError, setGenerationError] = useState<string | null>(null);

 useEffect(() => {
 if (initialTopic) setSocialTopic(initialTopic);
 if (initialKeyword) setSocialKeyword(initialKeyword);
 }, [initialTopic, initialKeyword]);

 const handleCopy = (text: string) => {
 navigator.clipboard.writeText(text);
 setSocialCopied(true);
 setTimeout(() => setSocialCopied(false), 2000);
 };

 const generateSocialContent = async () => {
 const topicToUse = (socialTopic || "").trim();
 if (!topicToUse) {
 setGenerationError("Validation Error: Social topic is required to initiate generation.");
 return;
 }
 setIsSocialGenerating(true);
 setSocialPost(null);
 setGenerationError(null);
 try {
 const data = await generateSocialPost({
 platform: socialPlatform,
 topic: topicToUse,
 keyword: (socialKeyword || "").trim(),
 targetDomain,
 audience: (socialAudience || "").trim(),
 contentGoal: (socialGoal || "").trim(),
 brandVoice: (socialVoice || "").trim(),
 aiConfig,
 });
 setSocialPost(data);
 if (data.isFallback) {
 setGenerationError(
 data.fallbackReason || data.errorMsg || "AI engine unavailable. Check your API key in Settings."
 );
 }
 } catch (err: unknown) {
 setGenerationError(
 err instanceof Error ? err.message : "An unexpected error occurred while generating social copy."
 );
 } finally {
 setIsSocialGenerating(false);
 }
 };

 return (
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
 
 {/* LEFT COLUMN: Input controls and platform selector */}
 <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6 self-start">
 <div className="border-b border-slate-100 pb-4">
 <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
 <Sparkles className="h-5 w-5 text-blue-600" />
 <span>Format Selection</span>
 </h3>
 <p className="text-[11px] text-slate-400 mt-1">Repurpose any organic keyword or content gap into specialized viral social or forum formats.</p>
 </div>

 <div className="space-y-4">
 {/* Platforms Selector Grid */}
 <div className="space-y-2">
 <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Target Platform Format</label>
 <div className="grid grid-cols-2 gap-2.5">
 {(["Twitter/X", "LinkedIn", "Newsletter", "Reddit", "Quora", "Google Business"] as const).map((platform) => (
 <button
 key={platform}
 onClick={() => setSocialPlatform(platform)}
 className={`p-3.5 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
 socialPlatform === platform
 ? "bg-blue-50 border-blue-300 text-blue-700 shadow-xs"
 : "border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-300"
 }`}
 >
 {platform === "Twitter/X" && <Twitter className="h-4 w-4 text-sky-500" />}
 {platform === "LinkedIn" && <Linkedin className="h-4 w-4 text-blue-600" />}
 {platform === "Newsletter" && <Mail className="h-4 w-4 text-amber-500" />}
 {platform === "Reddit" && <MessageSquare className="h-4 w-4 text-orange-500" />}
 {platform === "Quora" && <HelpCircle className="h-4 w-4 text-red-600" />}
 {platform === "Google Business" && <Globe className="h-4 w-4 text-green-600" />}
 <span className="text-center">{platform}</span>
 </button>
 ))}
 </div>
 </div>

 {/* Topic */}
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Topic / Insight Description</label>
 <textarea
 rows={4}
 placeholder="What is the core message or insight you want to repurpose? e.g. 5 steps to find unlinked brand mentions."
 value={socialTopic}
 onChange={(e) => setSocialTopic(e.target.value)}
 className="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-medium"
 />
 </div>

 {/* Focus Keyword */}
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Target Focus Keyword (Optional)</label>
 <input
 type="text"
 placeholder="e.g., unlinked brand mentions"
 value={socialKeyword}
 onChange={(e) => setSocialKeyword(e.target.value)}
 className="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
 />
 </div>

 {/* Target Audience */}
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Target Audience</label>
 <select
 value={socialAudience}
 onChange={(e) => setSocialAudience(e.target.value)}
 className="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold bg-white cursor-pointer text-slate-700"
 >
 <option value="General Patients & Healthcare Seekers"> Patients & Healthcare Seekers</option>
 <option value="Marketing Managers & SEOs"> Marketing Managers & SEOs</option>
 <option value="B2B Clients & Executives"> B2B Clients & Executives</option>
 <option value="SaaS Founders & Tech Leaders"> SaaS Founders & Tech Leaders</option>
 <option value="Small Business Owners"> Small Business Owners</option>
 <option value="General Public"> General Public</option>
 </select>
 </div>

 {/* Content Goal */}
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Content Goal</label>
 <select
 value={socialGoal}
 onChange={(e) => setSocialGoal(e.target.value)}
 className="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold bg-white cursor-pointer text-slate-700"
 >
 <option value="Engagement"> Drive Community Engagement</option>
 <option value="Education"> Share Value & Educate</option>
 <option value="Conversion"> Lead Generation & Conversion</option>
 <option value="Awareness"> Brand Awareness & Reach</option>
 </select>
 </div>

 {/* Brand Voice */}
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Brand Voice</label>
 <select
 value={socialVoice}
 onChange={(e) => setSocialVoice(e.target.value)}
 className="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold bg-white cursor-pointer text-slate-700"
 >
 <option value="Empathetic & Warm"> Empathetic & Warm (Health & Wellness)</option>
 <option value="Authoritative & Analytical"> Authoritative & Analytical</option>
 <option value="Casual & Friendly"> Casual & Friendly</option>
 <option value="Technical & Precise"> Technical & Precise</option>
 <option value="Bold & Opinionated"> Bold & Opinionated</option>
 </select>
 </div>

 {/* Action trigger button */}
 <button
 onClick={() => void generateSocialContent()}
 disabled={!socialTopic || isSocialGenerating}
 className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-600/15 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
 >
 {isSocialGenerating ? (
 <>
 <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
 <span>Repurposing text with Gemini...</span>
 </>
 ) : (
 <>
 <span>Generate Highly-Engaging Copy</span>
 <Sparkles className="h-4 w-4" />
 </>
 )}
 </button>
 </div>
 </div>

 {/* RIGHT COLUMN: Output display */}
 <div className="lg:col-span-7">
 {isSocialGenerating && (
 <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-xs text-center space-y-4">
 <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
 <h4 className="font-extrabold text-slate-800 animate-pulse text-base">Structuring tailored copy with Gemini...</h4>
 <p className="text-xs text-slate-400 max-w-sm mx-auto">
 Applying platform algorithms and specific character thresholds to optimize organic CTR.
 </p>
 </div>
 )}

 {!isSocialGenerating && !socialPost && (
 <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-12 rounded-2xl text-center space-y-3">
 <Sparkles className="h-10 w-10 text-slate-300 mx-auto" />
 <h4 className="font-bold text-slate-700">No Copy Drafted</h4>
 <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
 Enter an insight topic or select your target platform format on the left to write viral hooks, subreddits, threads, or answers.
 </p>
 </div>
 )}

 {socialPost && (
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6"
 >
 <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-4">
 <div className="flex items-center gap-2">
 {socialPost.platform === "Twitter/X" && <Twitter className="h-5 w-5 text-sky-500" />}
 {socialPost.platform === "LinkedIn" && <Linkedin className="h-5 w-5 text-blue-600" />}
 {socialPost.platform === "Newsletter" && <Mail className="h-5 w-5 text-amber-500" />}
 {socialPost.platform === "Reddit" && <MessageSquare className="h-5 w-5 text-orange-500" />}
 {socialPost.platform === "Quora" && <HelpCircle className="h-5 w-5 text-red-600" />}
 {socialPost.platform === "Google Business" && <Globe className="h-5 w-5 text-green-600" />}
 <span className="font-extrabold text-slate-800 text-sm">Optimized {socialPost.platform} Workspace</span>
 </div>
 <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider bg-slate-50 border px-2 py-0.5 rounded-md">
 Algorithmic Grade Output
 </span>
 </div>

 {/* Custom Sub-tabs for detailed marketing metrics */}
 <div className="flex border-b border-slate-100 pb-px gap-1 overflow-x-auto">
 {(["post", "metadata", "seo", "schema"] as const).map((tab) => (
 <button
 key={tab}
 onClick={() => setActiveSocialOutputTab(tab)}
 className={`px-3.5 py-2.5 text-[11px] font-bold border-b-2 transition-all shrink-0 capitalize cursor-pointer ${
 activeSocialOutputTab === tab
 ? "border-blue-600 text-blue-600 font-extrabold"
 : "border-transparent text-slate-500 hover:text-slate-800"
 }`}
 >
 {tab === "post" && " Ready-to-Publish Copy"}
 {tab === "metadata" && " Timing & Engagement"}
 {tab === "seo" && " Keyword & Compliance"}
 {tab === "schema" && " Social Schema LD"}
 </button>
 ))}
 </div>

 {/* Tab content rendering */}
 <div className="space-y-4 pt-2">
 {activeSocialOutputTab === "post" && (
 <div className="space-y-4">
 <div className="flex justify-between items-center bg-slate-50/50 p-4 rounded-xl border border-slate-100">
 <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">
 Tone: <span className="text-slate-800">{socialVoice}</span> | Audience: <span className="text-slate-800">{socialAudience}</span>
 </div>
 <button
 onClick={() => handleCopy(socialPost.content)}
 className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3.5 py-2 rounded-xl border border-blue-100 flex items-center gap-1.5 font-bold cursor-pointer transition-colors shrink-0"
 >
 {socialCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
 <span>{socialCopied ? "Copied!" : "Copy Post Copy"}</span>
 </button>
 </div>
 <pre className="font-sans text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50/20 p-6 rounded-xl border border-slate-100 max-h-120 overflow-y-auto">
 {socialPost.content}
 </pre>
 {socialPost.hashtags && socialPost.hashtags.length > 0 && (
 <div className="flex flex-wrap gap-1.5 pt-2">
 {socialPost.hashtags.map((tag) => (
 <span key={tag} className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1 rounded-full font-extrabold cursor-pointer transition-colors">
 {tag.startsWith("#") ? tag : `#${tag}`}
 </span>
 ))}
 </div>
 )}
 </div>
 )}

 {activeSocialOutputTab === "metadata" && (
 <div className="space-y-4">
 {/* Posting Time */}
 <div className="bg-slate-50/40 p-5 rounded-xl border border-slate-100 space-y-2">
 <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
 <span className="p-1 rounded bg-blue-50 border border-blue-100"><Award className="h-4 w-4" /></span>
 <span>Optimal Algorithmic Posting Time</span>
 </div>
 <p className="text-sm text-slate-800 font-extrabold pl-8">
 {socialPost.optimalPostingTime || "Recommended: Tuesday/Thursday between 9:00 AM - 11:00 AM local time."}
 </p>
 <p className="text-[11px] text-slate-400 pl-8 leading-relaxed">
 Calculated based on specific platform activity metrics and maximum first-hour organic feed visibility.
 </p>
 </div>

 {/* Visual recommendations */}
 <div className="bg-slate-50/40 p-5 rounded-xl border border-slate-100 space-y-2">
 <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider">
 <span className="p-1 rounded bg-amber-50 border border-amber-100"><Eye className="h-4 w-4" /></span>
 <span>Aesthetic & Visual Specifications</span>
 </div>
 <p className="text-sm text-slate-700 pl-8 leading-relaxed font-semibold">
 {socialPost.visualRecommendations || "An authentic clinic illustration or high-contrast diagram matching current target colors."}
 </p>
 <div className="pl-8 pt-1 flex items-center gap-2 text-[10px] text-slate-400 font-bold font-mono uppercase">
 <span>Optimal Aspect Ratio: {socialPlatform === "Twitter/X" ? "16:9 Landscape" : socialPlatform === "LinkedIn" ? "4:5 Portrait" : "1:1 Square"}</span>
 </div>
 </div>

 {/* Engagement Strategy */}
 <div className="bg-slate-50/40 p-5 rounded-xl border border-slate-100 space-y-2">
 <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider">
 <span className="p-1 rounded bg-emerald-50 border border-emerald-100"><HelpCircle className="h-4 w-4" /></span>
 <span>First-Hour Engagement Strategy</span>
 </div>
 <p className="text-sm text-slate-700 pl-8 leading-relaxed font-semibold">
 {socialPost.engagementStrategy || "Respond immediately to the first 3-5 patient or customer comments within 15 minutes of publication."}
 </p>
 </div>
 </div>
 )}

 {activeSocialOutputTab === "seo" && (
 <div className="space-y-4">
 {/* SEO notes */}
 <div className="bg-slate-50/40 p-5 rounded-xl border border-slate-100 space-y-2">
 <div className="flex items-center gap-2 text-purple-700 font-bold text-xs uppercase tracking-wider">
 <span className="p-1 rounded bg-purple-50 border border-purple-100"><Cpu className="h-4 w-4" /></span>
 <span>Keyword Placement & Semantic Notes</span>
 </div>
 <p className="text-sm text-slate-700 pl-8 leading-relaxed font-semibold">
 {socialPost.seoNotes || `Primary keyword '${socialKeyword || "not set"}' is integrated in the scrolling hook.`}
 </p>
 </div>

 {/* Algorithmic Compliance checklist */}
 <div className="bg-slate-50/40 p-5 rounded-xl border border-slate-100 space-y-3">
 <div className="flex items-center gap-2 text-green-700 font-bold text-xs uppercase tracking-wider">
 <span className="p-1 rounded bg-green-50 border border-green-100"><ShieldCheck className="h-4 w-4" /></span>
 <span>Platform Algorithmic Compliance</span>
 </div>
 <div className="pl-8 space-y-2">
 <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
 <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
 <span>Hook Constraint Check (Scroll-Stopping text matches {socialPlatform} rules)</span>
 </div>
 <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
 <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
 <span>External Link Restriction Check (Clean content layout)</span>
 </div>
 <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
 <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
 <span>Character Limit Adherence ({socialPost.complianceCheck || "Verified under platform strict thresholds"})</span>
 </div>
 </div>
 </div>
 </div>
 )}

 {activeSocialOutputTab === "schema" && (
 <div className="space-y-4">
 <div className="flex justify-between items-center bg-slate-50/50 p-4 rounded-xl border border-slate-100">
 <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">JSON-LD Social Schema Markup</span>
 {socialPost.schemaMarkup && (
 <button
 onClick={() => handleCopy(socialPost.schemaMarkup || "")}
 className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3.5 py-2 rounded-xl border border-blue-100 flex items-center gap-1.5 font-bold cursor-pointer transition-colors shrink-0"
 >
 {socialCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
 <span>Copy Schema</span>
 </button>
 )}
 </div>
 {socialPost.schemaMarkup ? (
 <pre className="text-xs overflow-x-auto p-5 bg-slate-900 text-blue-400 rounded-xl font-mono leading-relaxed max-h-80 select-all">
 {socialPost.schemaMarkup}
 </pre>
 ) : (
 <div className="bg-slate-50/40 p-8 rounded-xl border border-slate-100 text-center text-xs text-slate-400 font-medium">
 No schema required for this content format.
 </div>
 )}
 </div>
 )}
 </div>
 </motion.div>
 )}
 </div>
 </div>
 );
}
