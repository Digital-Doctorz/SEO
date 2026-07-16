import type { AiProviderConfig, BlogPost, SocialPost } from "../../types";
import { postApi } from "../../lib/api";
import { sanitizeDeep, sanitizeText } from "../../lib/text";
import { resolveAiConfig } from "../../lib/aiConfig";

export interface MetaSnippet {
  type: string;
  title: string;
  description: string;
}

export async function generateMetaSnippets(params: {
  keyword: string;
  content: string;
  articleTitle: string;
  targetDomain: string;
  aiConfig?: AiProviderConfig;
}): Promise<{ snippets: MetaSnippet[]; isFallback?: boolean; fallbackReason?: string; errorMsg?: string }> {
  return postApi("/api/generate-meta-snippets", {
    keyword: params.keyword,
    content: params.content,
    articleTitle: params.articleTitle,
    targetDomain: params.targetDomain,
    aiConfig: resolveAiConfig(params.aiConfig),
  });
}

export async function generateSocialPost(params: {
  platform: string;
  topic: string;
  keyword: string;
  targetDomain: string;
  audience?: string;
  contentGoal?: string;
  brandVoice?: string;
  aiConfig?: AiProviderConfig;
}): Promise<SocialPost & { isFallback?: boolean; fallbackReason?: string; errorMsg?: string }> {
  return postApi("/api/generate-social", {
    platform: params.platform,
    topic: params.topic,
    keyword: params.keyword,
    targetDomain: params.targetDomain,
    audience: params.audience,
    contentGoal: params.contentGoal,
    brandVoice: params.brandVoice,
    aiConfig: resolveAiConfig(params.aiConfig),
  });
}

export async function generateBlogPost(params: {
  topic: string;
  keyword: string;
  secondaryKeywords: string[];
  wordCount: number;
  audience: string;
  tone: string;
  targetDomain: string;
  /** Page to outrank (master prompt COMPETITOR_URL) */
  competitorUrl?: string;
  aiConfig?: AiProviderConfig;
  /** Unique per click so every regenerate is a new strategy/angle */
  variationSeed?: number;
  /** When re-drafting, pass prior article so the API can fully enhance it */
  previousTitle?: string;
  previousContent?: string;
  previousOutline?: string[];
  enhanceMode?: boolean;
  /** Live SEO analysis: keywords, gaps, competitors, niche — master prompt ground truth */
  analysisContext?: {
    keywords?: string[];
    contentGaps?: Array<{ topic?: string; keyword?: string; opportunity?: string }>;
    competitors?: string[];
    niche?: string;
    audience?: string;
    strengths?: string[];
    weaknesses?: string[];
  };
}): Promise<
  BlogPost & {
    isFallback?: boolean;
    fallbackReason?: string;
    errorMsg?: string;
    strategyId?: string;
    enhanceMode?: boolean;
    masterPromptApplied?: boolean;
  }
> {
  const variationSeed =
    params.variationSeed ??
    (Date.now() ^ Math.floor(Math.random() * 1_000_000_000));
  const data = await postApi<
    BlogPost & {
      isFallback?: boolean;
      fallbackReason?: string;
      errorMsg?: string;
      strategyId?: string;
      enhanceMode?: boolean;
      masterPromptApplied?: boolean;
    }
  >("/api/generate-blog", {
    topic: params.topic,
    keyword: params.keyword,
    secondaryKeywords: params.secondaryKeywords,
    wordCount: Math.max(2000, params.wordCount || 2000),
    audience: params.audience,
    tone: params.tone,
    targetDomain: params.targetDomain,
    competitorUrl: params.competitorUrl || "",
    // Always send the key currently saved for the active provider (OpenRouter/Gemini/Custom)
    aiConfig: resolveAiConfig(params.aiConfig),
    variationSeed,
    regenerateToken: variationSeed,
    previousTitle: params.previousTitle || "",
    previousContent: params.previousContent || "",
    previousOutline: params.previousOutline || [],
    enhanceMode: Boolean(params.enhanceMode),
    analysisContext: params.analysisContext || null,
  });
  return sanitizeDeep(data);
}

/** Ensure Links + Technical SEO panels always have data after any generation path. */
export function ensureBlogEnrichment(
  post: BlogPost,
  targetDomain: string,
  keyword: string
): BlogPost {
  const domain = (targetDomain || "example.com")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");
  const brand = (domain.split(".")[0] || "Brand").replace(/^\w/, (c) => c.toUpperCase());
  const kw = keyword || post.title || "guide";
  const slug =
    post.slugSuggestion ||
    post.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") ||
    "article";
  const pageUrl = `https://${domain}/blog/${slug}`;

  // Ensure media placeholders exist in content for draft rendering
  let content = post.content || "";
  if (content && !/\[IMAGE:/i.test(content)) {
    content = `${content}\n\n[IMAGE: Hero visual for ${kw}. Alt Text: "${kw} for ${brand}"]\n\n[IMAGE: Workflow visual for ${kw}. Alt Text: "${kw} process"]\n`;
  }
  if (content && !/\[CHART:/i.test(content)) {
    content += `\n\n[CHART:bar title="${kw} comparison" labels="Focused,Ad-hoc,Rebuild" values="88,42,65"]\n`;
  }

  const linkingRecommendations = post.linkingRecommendations?.internal?.length
    ? post.linkingRecommendations
    : {
        internal: [
          { anchor: `${kw} complete guide`, url: `https://${domain}/`, type: "Hub / Homepage" },
          { anchor: `${brand} ${kw} services`, url: `https://${domain}/services`, type: "Service page" },
          { anchor: `deep dive into ${kw}`, url: pageUrl, type: "Pillar blog" },
          { anchor: `book a ${kw} consultation`, url: `https://${domain}/contact`, type: "Conversion page" },
          { anchor: `${brand} resource library`, url: `https://${domain}/resources`, type: "Resource hub" },
          { anchor: `about ${brand}'s approach`, url: `https://${domain}/about`, type: "Trust page" },
        ],
        external: [
          {
            anchor: "Google Search Essentials documentation",
            url: "https://developers.google.com/search/docs/essentials",
            authority: "Google (official search docs)",
          },
          {
            anchor: "Google Search Central documentation",
            url: "https://developers.google.com/search/docs",
            authority: "Google (search developer hub)",
          },
          {
            anchor: "Google Analytics help center",
            url: "https://support.google.com/analytics",
            authority: "Google (analytics official docs)",
          },
          {
            anchor: "Google Business Profile support",
            url: "https://support.google.com/business",
            authority: "Google (local business docs)",
          },
          {
            anchor: "Moz SEO Learning Center",
            url: "https://moz.com/learn/seo",
            authority: "Moz (industry-standard SEO education)",
          },
          {
            anchor: "Ahrefs blog on SEO strategy",
            url: "https://ahrefs.com/blog/",
            authority: "Ahrefs (data-driven SEO research)",
          },
          {
            anchor: "Search Engine Journal",
            url: "https://www.searchenginejournal.com/",
            authority: "Search Engine Journal (industry publication)",
          },
          {
            anchor: "Search Engine Land",
            url: "https://searchengineland.com/",
            authority: "Search Engine Land (industry news)",
          },
          {
            anchor: "HubSpot content marketing",
            url: "https://blog.hubspot.com/marketing",
            authority: "HubSpot (marketing education)",
          },
          {
            anchor: "Content Marketing Institute",
            url: "https://contentmarketinginstitute.com/",
            authority: "Content Marketing Institute (industry body)",
          },
          {
            anchor: "MDN Web Docs",
            url: "https://developer.mozilla.org/",
            authority: "MDN (web standards reference)",
          },
          {
            anchor: "Schema.org structured data",
            url: "https://schema.org/",
            authority: "Schema.org (structured data standard)",
          },
          {
            anchor: "W3C web standards",
            url: "https://www.w3.org/standards/",
            authority: "W3C (web standards body)",
          },
          {
            anchor: "Statista digital marketing statistics",
            url: "https://www.statista.com/topics/1786/digital-marketing/",
            authority: "Statista (market data & statistics)",
          },
          {
            anchor: "Pew Research internet & technology",
            url: "https://www.pewresearch.org/internet/",
            authority: "Pew Research (internet usage studies)",
          },
          {
            anchor: "NCBI / NIH research library",
            url: "https://www.ncbi.nlm.nih.gov/",
            authority: "NCBI / NIH (research database)",
          },
          {
            anchor: "Google PageSpeed Insights",
            url: "https://pagespeed.web.dev/",
            authority: "Google (performance testing tool)",
          },
          {
            anchor: "Google Rich Results Test",
            url: "https://search.google.com/test/rich-results",
            authority: "Google (schema validation tool)",
          },
          {
            anchor: "Wikipedia Flesch-Kincaid readability",
            url: "https://en.wikipedia.org/wiki/Flesch%E2%80%93Kincaid_readability_tests",
            authority: "Wikipedia (readability standards)",
          },
          {
            anchor: "Semrush Academy",
            url: "https://www.semrush.com/academy/",
            authority: "Semrush (SEO training & research)",
          },
        ],
      };

  const technicalSeo = post.technicalSeo?.canonicalUrl
    ? post.technicalSeo
    : {
        canonicalUrl: pageUrl,
        ogTags: {
          "og:title": post.title.slice(0, 70),
          "og:description": (post.metaDescription || "").slice(0, 200),
          "og:type": "article",
          "og:url": pageUrl,
          "og:site_name": brand,
          "og:image": `https://${domain}/og/${slug.slice(0, 40)}.png`,
        },
        twitterTags: {
          "twitter:card": "summary_large_image",
          "twitter:title": post.title.slice(0, 70),
          "twitter:description": (post.metaDescription || "").slice(0, 200),
          "twitter:image": `https://${domain}/og/${slug.slice(0, 40)}.png`,
        },
        mobileNotes:
          "Single H1, responsive images with width/height attributes, 16px+ body text, 48px+ tap targets. Avoid horizontal scroll. Use system fonts or max 2 font weights for faster LCP.",
        speedNotes:
          "Compress hero images to WebP (target <100KB), defer non-critical JS, inline critical CSS for above-the-fold, keep LCP under 2.5s. Use lazy loading for images below the fold.",
        aiEngineOptimization: {
          targetLlmEngines: ["Google AI Overviews", "ChatGPT Search", "Perplexity", "Gemini", "Copilot"],
          factualDensityScore: 91,
          citationReadiness:
            "Lead each H2 with a direct 40-60 word answer block. Use numbered lists, comparison tables, and FAQ pairs. These formats get cited 3-5x more often in AI-generated answers than paragraph-only sections.",
          semanticEntityMatching: [kw, brand, "how-to guide", "comparison table", "decision framework", "FAQ", "search intent", "content strategy"],
          generativeOptimizations:
            "Open every H2 with a complete, standalone answer (40-60 words). Follow with evidence, examples, or steps. Use tables for comparisons. Keep sentences under 20 words for clean LLM extraction and featured-snippet eligibility.",
        },
        localSeoRecommendations: {
          targetRegion: "Primary service market + nearby cities within 50-mile radius",
          localEntitiesRequired: [brand, domain, "local service area", kw, "Google Business Profile"],
          localizedIntroVariation: `Looking for trusted ${kw} expertise near you? ${brand} serves businesses that want clear, actionable strategies — not vague advice. Start with a free audit.`,
          mapEmbedOpportunity: "Embed a Google Map on the contact page. Link to it from the article conclusion and service pages for local relevance signals.",
          proximitySignals: "Consistent NAP across GBP, Apple Business, and Bing Places. Use location-specific FAQ language and schema markup for each service area.",
        },
      };

  const preWritingAnalysis = post.preWritingAnalysis || {
    avgLength: 1400,
    optimalStructure: "Intro -> Key takeaways -> H2 QAE sections -> Table -> FAQ -> CTA",
    subtopics: [
      `What is ${kw}`,
      `How to start ${kw}`,
      `Common mistakes`,
      `Tools and metrics`,
      `${kw} vs alternatives`,
    ],
    contentGaps: [
      "Missing step checklist",
      "No comparison table",
      "Weak FAQ coverage",
      "Few internal links",
    ],
    topRankingPages: [
      {
        rank: 1,
        title: `Guide to ${kw}`,
        url: `https://www.example.com/${slug}`,
        wordCount: 2000,
        dr: 75,
      },
      {
        rank: 2,
        title: `${kw} tips`,
        url: `https://blog.authority.com/${slug}`,
        wordCount: 1600,
        dr: 70,
      },
      {
        rank: 3,
        title: `How ${kw} works`,
        url: `https://learn.industry.org/${slug}`,
        wordCount: 1400,
        dr: 68,
      },
    ],
  };

  const tables =
    Array.isArray(post.tables) && post.tables.length
      ? post.tables
      : [
          {
            title: `${kw} approach comparison`,
            type: "Decision table",
            headers: ["Approach", "Best for", "Effort", "Time to results", "ROI potential"],
            rows: [
              [`Focused ${kw} plan`, "Teams with clear weekly goals and 1 person dedicated", "Medium", "4-8 weeks", "High (compounding)"],
              ["Ad-hoc experiments", "Quick hypothesis tests, limited bandwidth", "Low", "Unclear", "Low (no compounding)"],
              ["Full pillar/cluster rebuild", "Established brands with 3+ person content team", "High", "8-16 weeks", "Very high (long-term)"],
              [`${brand}-aligned rollout`, "Buyers already evaluating ${niche} solutions", "Medium", "3-6 weeks", "High (intent-matched)"],
            ],
          },
        ];

  const visualizations =
    Array.isArray(post.visualizations) && post.visualizations.length
      ? post.visualizations
      : [
          {
            type: "Line Chart",
            title: `${kw}: structured content vs ad-hoc publishing (12-week trajectory)`,
            data: [
              { week: 1, structured: 12, adhoc: 10 },
              { week: 3, structured: 28, adhoc: 16 },
              { week: 6, structured: 52, adhoc: 24 },
              { week: 9, structured: 74, adhoc: 30 },
              { week: 12, structured: 95, adhoc: 36 },
            ],
          },
          {
            type: "Bar Chart",
            title: `What readers evaluate when choosing a ${kw} guide`,
            data: [
              { label: "Specific steps", value: 94 },
              { label: "Data & benchmarks", value: 88 },
              { label: "Comparison tables", value: 82 },
              { label: "Real examples", value: 86 },
              { label: "FAQ coverage", value: 78 },
            ],
          },
        ];

  return {
    ...post,
    content,
    linkingRecommendations,
    technicalSeo,
    preWritingAnalysis,
    tables,
    visualizations,
  };
}

export async function analyzeKeywordDeep(params: {
  keyword: string;
  targetDomain: string;
  aiConfig?: AiProviderConfig;
  signal?: AbortSignal;
}): Promise<unknown> {
  return postApi(
    "/api/analyze-keyword-deep",
    {
      keyword: params.keyword,
      targetDomain: params.targetDomain,
      targetUrl: params.targetDomain,
      aiConfig: resolveAiConfig(params.aiConfig),
    },
    { signal: params.signal }
  );
}

/** Normalize schemaMarkup to a JSON string the client can validate. */
export function ensureSchemaString(data: BlogPost & { schemaMarkup?: unknown }): BlogPost {
  if (data.schemaMarkup && typeof data.schemaMarkup === "object") {
    return {
      ...data,
      schemaMarkup: JSON.stringify(data.schemaMarkup, null, 2),
    };
  }
  return data;
}

export function validateBlogResponse(data: BlogPost): void {
  if (!data) throw new Error("Server returned an empty response.");
  data.title = sanitizeText(data.title);
  data.content = sanitizeText(data.content);
  data.metaDescription = sanitizeText(data.metaDescription);
  if (typeof data.title !== "string" || !data.title.trim()) {
    throw new Error("Invalid article response: Title is missing or blank.");
  }
  if (typeof data.content !== "string" || !data.content.trim()) {
    throw new Error("Invalid article response: Article content is missing or blank.");
  }
  // Server now normalizes short content; allow shorter drafts after recovery
  if (data.content.trim().length < 120) {
    throw new Error(
      `Invalid article response: Article content is too short (${data.content.trim().length} chars).`
    );
  }
  if (data.schemaMarkup && typeof data.schemaMarkup === "object") {
    data.schemaMarkup = JSON.stringify(data.schemaMarkup, null, 2);
  }
  if (typeof data.schemaMarkup !== "string" || !data.schemaMarkup.trim()) {
    // Non-fatal: client can still show the article
    data.schemaMarkup = JSON.stringify(
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: data.title,
        description: data.metaDescription || "",
      },
      null,
      2
    );
  } else {
    try {
      const parsedSchema = JSON.parse(data.schemaMarkup);
      if (typeof parsedSchema !== "object" || parsedSchema === null) {
        throw new Error("not object");
      }
    } catch {
      data.schemaMarkup = JSON.stringify(
        {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: data.title,
          description: data.metaDescription || "",
        },
        null,
        2
      );
    }
  }
}
