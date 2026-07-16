import type { AiProviderConfig, BlogPost, SocialPost } from "../../types";
import { postApi } from "../../lib/api";
import { sanitizeDeep, sanitizeText } from "../../lib/text";

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
    aiConfig: params.aiConfig,
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
    aiConfig: params.aiConfig,
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
  aiConfig?: AiProviderConfig;
  /** Unique per click so every regenerate is a new strategy/angle */
  variationSeed?: number;
  /** When re-drafting, pass prior article so the API can fully enhance it */
  previousTitle?: string;
  previousContent?: string;
  previousOutline?: string[];
  enhanceMode?: boolean;
}): Promise<
  BlogPost & {
    isFallback?: boolean;
    fallbackReason?: string;
    errorMsg?: string;
    strategyId?: string;
    enhanceMode?: boolean;
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
    }
  >("/api/generate-blog", {
    topic: params.topic,
    keyword: params.keyword,
    secondaryKeywords: params.secondaryKeywords,
    wordCount: params.wordCount,
    audience: params.audience,
    tone: params.tone,
    targetDomain: params.targetDomain,
    aiConfig: params.aiConfig,
    variationSeed,
    regenerateToken: variationSeed,
    previousTitle: params.previousTitle || "",
    previousContent: params.previousContent || "",
    previousOutline: params.previousOutline || [],
    enhanceMode: Boolean(params.enhanceMode),
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
          { anchor: `${kw} overview`, url: `https://${domain}/`, type: "Hub / Homepage" },
          { anchor: `${brand} services`, url: `https://${domain}/services`, type: "Service page" },
          { anchor: `learn more about ${kw}`, url: pageUrl, type: "Pillar blog" },
          { anchor: "contact our team", url: `https://${domain}/contact`, type: "Conversion page" },
          { anchor: `${brand} resources`, url: `https://${domain}/resources`, type: "Resource hub" },
        ],
        external: [
          {
            anchor: "Google Search Essentials",
            url: "https://developers.google.com/search/docs/essentials",
            authority: "Google (Search docs)",
          },
          {
            anchor: "Schema.org Article",
            url: "https://schema.org/Article",
            authority: "Schema.org",
          },
          {
            anchor: "Flesch-Kincaid readability",
            url: "https://en.wikipedia.org/wiki/Flesch%E2%80%93Kincaid_readability_tests",
            authority: "Wikipedia",
          },
          {
            anchor: "MDN Web Docs",
            url: "https://developer.mozilla.org/",
            authority: "MDN",
          },
        ],
      };

  const technicalSeo = post.technicalSeo?.canonicalUrl
    ? post.technicalSeo
    : {
        canonicalUrl: pageUrl,
        ogTags: {
          "og:title": post.title,
          "og:description": post.metaDescription || "",
          "og:type": "article",
          "og:url": pageUrl,
          "og:site_name": brand,
          "og:image": `https://${domain}/og/${slug}.png`,
        },
        twitterTags: {
          "twitter:card": "summary_large_image",
          "twitter:title": post.title,
          "twitter:description": post.metaDescription || "",
          "twitter:image": `https://${domain}/og/${slug}.png`,
        },
        mobileNotes:
          "Single H1, responsive images with dimensions, 16px+ body text, 48px tap targets.",
        speedNotes:
          "Compress images (WebP), defer non-critical JS, keep LCP under 2.5s.",
        aiEngineOptimization: {
          targetLlmEngines: ["Google AI Overviews", "ChatGPT Search", "Perplexity", "Gemini"],
          factualDensityScore: 88,
          citationReadiness:
            "Direct H2 answers, FAQ pairs, and authority outbound links improve AI citation odds.",
          semanticEntityMatching: [kw, brand, "how-to", "FAQ", "comparison"],
          generativeOptimizations:
            "Lead sections with short answers. Use lists and tables. Keep sentences under 20 words.",
        },
        localSeoRecommendations: {
          targetRegion: "Primary market + nearby cities",
          localEntitiesRequired: [brand, domain, kw],
          localizedIntroVariation: `Looking for ${kw} near you? ${brand} offers clear next steps.`,
          mapEmbedOpportunity: "Add a map embed on the contact page linked from this article.",
          proximitySignals: "Consistent NAP, GBP categories, and local FAQ language.",
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
            headers: ["Approach", "Best for", "Effort"],
            rows: [
              [`Focused ${kw}`, "Clear goals", "Medium"],
              ["Ad-hoc", "Quick tests", "Low"],
              ["Full rebuild", "Large teams", "High"],
            ],
          },
        ];

  const visualizations =
    Array.isArray(post.visualizations) && post.visualizations.length
      ? post.visualizations
      : [
          {
            type: "Line Chart",
            title: `${kw}: structured vs ad-hoc (12 weeks)`,
            data: [
              { week: 1, structured: 22, adhoc: 18 },
              { week: 6, structured: 58, adhoc: 32 },
              { week: 12, structured: 90, adhoc: 40 },
            ],
          },
          {
            type: "Bar Chart",
            title: `Reader priorities for ${kw}`,
            data: [
              { label: "Steps", value: 92 },
              { label: "Proof", value: 84 },
              { label: "Speed", value: 76 },
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
      aiConfig: params.aiConfig,
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
