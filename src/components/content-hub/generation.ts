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
}): Promise<BlogPost & { isFallback?: boolean; fallbackReason?: string; errorMsg?: string }> {
  const data = await postApi<BlogPost & { isFallback?: boolean; fallbackReason?: string; errorMsg?: string }>(
    "/api/generate-blog",
    {
      topic: params.topic,
      keyword: params.keyword,
      secondaryKeywords: params.secondaryKeywords,
      wordCount: params.wordCount,
      audience: params.audience,
      tone: params.tone,
      targetDomain: params.targetDomain,
      aiConfig: params.aiConfig,
    }
  );
  return sanitizeDeep(data);
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
