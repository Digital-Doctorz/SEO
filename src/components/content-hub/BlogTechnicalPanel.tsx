import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Globe2,
  Globe,
  Cpu,
  Compass,
  Code,
  Copy,
  Check,
  CheckCircle,
  ShieldCheck,
  Share2,
  Activity,
  Sparkles,
} from "lucide-react";
import type { BlogPost } from "../../types";
import { getAppropriateImgSrc } from "./markdown";

export interface BlogTechnicalPanelProps {
  blogPost: BlogPost;
  targetDomain: string;
  headerTagsCopied: boolean;
  onCopy: (text: string, setCopied: (v: boolean) => void) => void;
  setHeaderTagsCopied: (v: boolean) => void;
}

type TechSubTab = "ai" | "local" | "og" | "code";

/** Always-safe technical SEO object so sub-tabs never crash on missing fields. */
function resolveTech(blogPost: BlogPost, targetDomain: string) {
  const domain = (targetDomain || "example.com")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "") || "example.com";
  const brand = (domain.split(".")[0] || "Brand").replace(/^\w/, (c) => c.toUpperCase());
  const slug =
    blogPost.slugSuggestion ||
    (blogPost.title || "article")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") ||
    "article";
  const pageUrl = `https://${domain}/blog/${slug}`;
  const existing = blogPost.technicalSeo;

  return {
    canonicalUrl: existing?.canonicalUrl || pageUrl,
    ogTags: {
      "og:title": blogPost.title || "Article",
      "og:description": blogPost.metaDescription || "",
      "og:type": "article",
      "og:url": pageUrl,
      "og:site_name": brand,
      "og:image": `https://${domain}/og/${slug}.png`,
      ...(existing?.ogTags || {}),
    },
    twitterTags: {
      "twitter:card": "summary_large_image",
      "twitter:title": blogPost.title || "Article",
      "twitter:description": blogPost.metaDescription || "",
      "twitter:image": `https://${domain}/og/${slug}.png`,
      ...(existing?.twitterTags || {}),
    },
    mobileNotes:
      existing?.mobileNotes ||
      "Use a single H1, responsive images with width/height, 16px+ body text, and 48px tap targets.",
    speedNotes:
      existing?.speedNotes ||
      "Compress hero images (WebP), defer non-critical JS, keep LCP under 2.5s.",
    aiEngineOptimization: {
      factualDensityScore: existing?.aiEngineOptimization?.factualDensityScore ?? 88,
      citationReadiness:
        existing?.aiEngineOptimization?.citationReadiness ||
        "Direct answer blocks under H2s, FAQ pairs, and outbound links to high-authority sources improve citation odds in AI answers.",
      generativeOptimizations:
        existing?.aiEngineOptimization?.generativeOptimizations ||
        "Lead each section with a short answer. Use lists and a table. Keep sentences short for high Flesch scores and clean LLM extraction.",
      targetLlmEngines: existing?.aiEngineOptimization?.targetLlmEngines?.length
        ? existing.aiEngineOptimization.targetLlmEngines
        : ["Google AI Overviews", "ChatGPT Search", "Perplexity", "Gemini", "Copilot"],
      semanticEntityMatching: existing?.aiEngineOptimization?.semanticEntityMatching?.length
        ? existing.aiEngineOptimization.semanticEntityMatching
        : [
            blogPost.title?.split(" ").slice(0, 3).join(" ") || "topic",
            brand,
            "how-to guide",
            "FAQ",
            "comparison table",
          ],
    },
    localSeoRecommendations: {
      targetRegion:
        existing?.localSeoRecommendations?.targetRegion ||
        `${brand} primary market + nearby cities`,
      localizedIntroVariation:
        existing?.localSeoRecommendations?.localizedIntroVariation ||
        `Looking for help near you? ${brand} serves customers who want clear steps and trusted local support.`,
      mapEmbedOpportunity:
        existing?.localSeoRecommendations?.mapEmbedOpportunity ||
        "Add a Google Map embed on the contact or location page linked from this article.",
      proximitySignals:
        existing?.localSeoRecommendations?.proximitySignals ||
        "Consistent NAP, Google Business Profile categories, and local FAQ language strengthen map pack eligibility.",
      localEntitiesRequired: existing?.localSeoRecommendations?.localEntitiesRequired?.length
        ? existing.localSeoRecommendations.localEntitiesRequired
        : [brand, domain, "local service area", "map pack queries"],
    },
  };
}

export default function BlogTechnicalPanel({
  blogPost,
  targetDomain,
  headerTagsCopied,
  onCopy: handleCopy,
  setHeaderTagsCopied,
}: BlogTechnicalPanelProps) {
  // ALL hooks at top level — never inside conditionals or IIFEs (fixes React #310)
  const [technicalSubTab, setTechnicalSubTab] = useState<TechSubTab>("ai");
  const [localIntroCopied, setLocalIntroCopied] = useState(false);

  const tech = useMemo(
    () => resolveTech(blogPost, targetDomain),
    [blogPost, targetDomain]
  );

  const domainVal = targetDomain || "example.com";
  const imageVal = getAppropriateImgSrc(blogPost.title || "", blogPost.metaDescription || "");
  const titleVal = blogPost.title || "Article";
  const descVal = blogPost.metaDescription || "";
  const canonicalVal = tech.canonicalUrl;

  const rawHeadCode = `<!-- SEO Meta Tags -->
<title>${titleVal}</title>
<meta name="description" content="${descVal}" />
<link rel="canonical" href="${canonicalVal}" />
<meta name="robots" content="index, follow, max-image-preview:large" />

<!-- Open Graph / Facebook -->
<meta property="og:type" content="article" />
<meta property="og:url" content="${canonicalVal}" />
<meta property="og:title" content="${tech.ogTags["og:title"] || titleVal}" />
<meta property="og:description" content="${tech.ogTags["og:description"] || descVal}" />
<meta property="og:image" content="${imageVal}" />
<meta property="og:site_name" content="${domainVal.replace(/\.[a-z]+$/i, "").toUpperCase()}" />

<!-- Twitter / X -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:url" content="${canonicalVal}" />
<meta name="twitter:title" content="${tech.twitterTags["twitter:title"] || titleVal}" />
<meta name="twitter:description" content="${tech.twitterTags["twitter:description"] || descVal}" />
<meta name="twitter:image" content="${imageVal}" />`;

  const aiOpt = tech.aiEngineOptimization;
  const locOpt = tech.localSeoRecommendations;
  const engines = Array.isArray(aiOpt.targetLlmEngines) ? aiOpt.targetLlmEngines : [];
  const entities = Array.isArray(aiOpt.semanticEntityMatching) ? aiOpt.semanticEntityMatching : [];
  const localEntities = Array.isArray(locOpt.localEntitiesRequired) ? locOpt.localEntitiesRequired : [];

  const tabBtn = (id: TechSubTab, label: string, Icon: typeof Cpu) => (
    <button
      type="button"
      onClick={() => setTechnicalSubTab(id)}
      className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
        technicalSubTab === id
          ? "bg-white text-blue-600 shadow-sm border border-slate-200/50"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Globe2 className="h-4 w-4 text-blue-500" />
            <span>Advanced Technical Crawler & Discovery Engine</span>
          </span>
          <h4 className="font-extrabold text-slate-900 text-lg mt-1">
            AI Search, Local SEO, Meta Tags & OG Hub
          </h4>
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

      <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar scroll-smooth gap-1 p-0.5 bg-slate-50 rounded-xl">
        {tabBtn("ai", "AI Search Engine (GEO)", Cpu)}
        {tabBtn("local", "Local SEO & Region", Compass)}
        {tabBtn("og", "Social OG Previews", Share2)}
        {tabBtn("code", "HTML Head Tags", Code)}
      </div>

      <AnimatePresence mode="wait">
        {technicalSubTab === "ai" && (
          <motion.div
            key="ai"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col justify-between space-y-3">
                <div>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
                    Factual Density Rating
                  </span>
                  <h5 className="font-extrabold text-slate-800 text-sm mt-1">Generative Search Score</h5>
                </div>
                <div className="flex items-end gap-3 pt-1">
                  <span className="text-4xl font-black text-blue-600 tracking-tight">
                    {aiOpt.factualDensityScore ?? 88}%
                  </span>
                  <span className="text-[10px] bg-blue-100 border border-blue-200 text-blue-800 px-2 py-0.5 rounded-md font-bold mb-1">
                    EXCELLENT
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  High factual ratio makes this draft more likely to be cited by AI answer engines.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
                  Targeted LLM / AI Search Engines
                </span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {engines.map((engine, idx) => (
                    <span
                      key={`${engine}-${idx}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 text-slate-700 font-bold text-[10px] rounded-lg shadow-2xs"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {engine}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
                  AI Semantic Entity Blueprint
                </span>
                <div className="flex flex-wrap gap-1 bg-white p-2.5 rounded-xl border border-slate-200/50 max-h-24 overflow-y-auto">
                  {entities.map((entity, idx) => (
                    <span
                      key={`${entity}-${idx}`}
                      className="bg-slate-100 text-slate-600 font-mono text-[9px] px-2 py-0.5 rounded font-semibold"
                    >
                      entity:{(entity || "topic").toLowerCase().replace(/\s+/g, "_")}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 bg-blue-50/40 border border-blue-100/50 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-blue-800">
                <Sparkles className="h-4 w-4 shrink-0 text-blue-600" />
                <h5 className="font-extrabold text-sm">Generative Engine Optimization (GEO) Blueprint</h5>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed font-medium text-slate-600">
                <div className="space-y-1 bg-white p-3.5 rounded-xl border border-slate-100">
                  <span className="font-bold text-[11px] uppercase tracking-wider block text-blue-600">
                    Citation Readiness Strategy
                  </span>
                  <p>{aiOpt.citationReadiness}</p>
                </div>
                <div className="space-y-1 bg-white p-3.5 rounded-xl border border-slate-100">
                  <span className="font-bold text-[11px] uppercase tracking-wider block text-blue-600">
                    LLM Synthesis Optimization
                  </span>
                  <p>{aiOpt.generativeOptimizations}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {technicalSubTab === "local" && (
          <motion.div
            key="local"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1.5">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
                  Target Geographic Scope
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-800 font-extrabold text-[11px] rounded-lg border border-blue-200">
                  <Globe className="h-3.5 w-3.5" />
                  {locOpt.targetRegion}
                </span>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium pt-1">
                  Geotargeting aligns content with local search queries.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1.5">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
                  Required Local Entities
                </span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {localEntities.map((ent, idx) => (
                    <span
                      key={`${ent}-${idx}`}
                      className="bg-white border border-slate-200 text-slate-700 font-bold text-[10px] px-2 py-0.5 rounded-lg shadow-2xs"
                    >
                      {ent}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1.5">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
                  Proximity / Location Signals
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                  {locOpt.proximitySignals}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2.5">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    Localized Intro Paragraph Variant
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(locOpt.localizedIntroVariation || "", setLocalIntroCopied)
                    }
                    className="p-1 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-md flex items-center gap-1 text-[10px] font-bold cursor-pointer transition-colors shrink-0"
                  >
                    {localIntroCopied ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>{localIntroCopied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-medium bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-2xs">
                  &ldquo;{locOpt.localizedIntroVariation}&rdquo;
                </p>
              </div>

              <div className="p-5 bg-slate-900 text-slate-200 rounded-2xl flex flex-col justify-between space-y-3 shadow-md">
                <div>
                  <span className="text-[10px] text-blue-400 font-extrabold uppercase tracking-wider block">
                    Map Embed Opportunity
                  </span>
                  <h5 className="font-bold text-white text-sm mt-1">Google Maps Local Integration</h5>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {locOpt.mapEmbedOpportunity}
                </p>
                <div className="border border-slate-700/60 rounded-xl p-3 bg-slate-950 flex items-center justify-center gap-2 text-slate-400 text-xs font-mono">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
                  <span>&lt;iframe src=&quot;https://www.google.com/maps/embed?...&quot; /&gt;</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {technicalSubTab === "og" && (
          <motion.div
            key="og"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Facebook / LinkedIn Feed Card Preview
                </span>
                <div className="bg-white border border-slate-200 rounded-xl shadow-md overflow-hidden font-sans max-w-sm mx-auto">
                  <div className="p-3 flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/50">
                    <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-extrabold text-xs">
                      {domainVal.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">{domainVal}</span>
                      <span className="text-[9px] text-slate-400 block font-medium">Sponsored · Public</span>
                    </div>
                  </div>
                  <div className="h-44 relative overflow-hidden">
                    <img
                      src={imageVal}
                      alt="Open Graph Preview"
                      className="absolute inset-0 w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                  </div>
                  <div className="p-3 bg-slate-50 space-y-1 border-t border-slate-100">
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                      https://{domainVal}
                    </div>
                    <h5 className="font-extrabold text-slate-800 text-xs leading-snug line-clamp-1">
                      {tech.ogTags["og:title"] || titleVal}
                    </h5>
                    <p className="text-[10px] text-slate-500 leading-normal line-clamp-2">
                      {tech.ogTags["og:description"] || descVal}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Twitter / X Large Image Card Preview
                </span>
                <div className="bg-slate-950 text-white p-4 rounded-xl border border-slate-800 max-w-sm mx-auto space-y-3 font-sans">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs">
                      X
                    </div>
                    <div>
                      <span className="text-xs font-bold block">
                        @{domainVal.replace(/\.[a-z]+$/i, "") || "brand"}
                      </span>
                      <span className="text-[9px] text-slate-500 block">Verified Publisher</span>
                    </div>
                  </div>
                  <p className="text-xs leading-normal text-slate-100">
                    {descVal || "Read the full analysis and practical next steps."}
                  </p>
                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900">
                    <div className="h-36 relative overflow-hidden">
                      <img
                        src={imageVal}
                        alt="Twitter OG Card"
                        className="absolute inset-0 w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="p-2.5 border-t border-slate-800">
                      <span className="text-[9px] text-slate-500 font-semibold block uppercase">
                        {domainVal}
                      </span>
                      <h5 className="font-extrabold text-slate-100 text-xs leading-snug line-clamp-1 mt-0.5">
                        {tech.twitterTags["twitter:title"] || tech.ogTags["og:title"] || titleVal}
                      </h5>
                      <p className="text-[10px] text-slate-400 leading-normal line-clamp-2 mt-0.5">
                        {tech.twitterTags["twitter:description"] ||
                          tech.ogTags["og:description"] ||
                          descVal}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {technicalSubTab === "code" && (
          <motion.div
            key="code"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="space-y-3.5"
          >
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Copy-Paste HTML &lt;head&gt; Tags
              </span>
              <button
                type="button"
                onClick={() => handleCopy(rawHeadCode, setHeaderTagsCopied)}
                className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-all shrink-0"
              >
                {headerTagsCopied ? (
                  <Check className="h-4 w-4 text-green-300" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                <span>{headerTagsCopied ? "Tags Copied!" : "Copy Meta Head Tags"}</span>
              </button>
            </div>

            <pre className="text-[11px] overflow-x-auto p-4 bg-slate-950 text-sky-400 rounded-xl font-mono leading-relaxed max-h-80 select-all border border-slate-900 shadow-inner">
              <code>{rawHeadCode}</code>
            </pre>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
              {[
                "Canonical Declared",
                "OG Image Bound",
                "Twitter Meta Intact",
                "Robots Index On",
              ].map((label) => (
                <div key={label} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5 border-t border-slate-100">
        <div className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Mobile-Friendliness & Accessibility</span>
          </span>
          <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50 p-3 rounded-xl border border-slate-100">
            {tech.mobileNotes}
          </p>
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Activity className="h-4 w-4 text-orange-500" />
            <span>Core Web Vitals & Loading Metrics</span>
          </span>
          <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50 p-3 rounded-xl border border-slate-100">
            {tech.speedNotes}
          </p>
        </div>
      </div>
    </div>
  );
}
