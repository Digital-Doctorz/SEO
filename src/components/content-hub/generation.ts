import type { AiProviderConfig, BlogPost, SocialPost } from "../../types";
import { postApi } from "../../lib/api";

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
  return postApi("/api/generate-blog", {
    topic: params.topic,
    keyword: params.keyword,
    secondaryKeywords: params.secondaryKeywords,
    wordCount: params.wordCount,
    audience: params.audience,
    tone: params.tone,
    targetDomain: params.targetDomain,
    aiConfig: params.aiConfig,
  });
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
  if (typeof data.title !== "string" || !data.title.trim()) {
    throw new Error("Invalid article response: Title is missing or blank.");
  }
  if (typeof data.content !== "string" || !data.content.trim()) {
    throw new Error("Invalid article response: Article content is missing or blank.");
  }
  if (data.content.trim().length < 200) {
    throw new Error(
      `Invalid article response: Article content is too short (${data.content.trim().length} chars).`
    );
  }
  if (typeof data.schemaMarkup !== "string" || !data.schemaMarkup.trim()) {
    throw new Error(
      "Invalid article response: Schema.org structured data (JSON-LD) is missing or blank."
    );
  }
  try {
    const parsedSchema = JSON.parse(data.schemaMarkup);
    if (typeof parsedSchema !== "object" || parsedSchema === null) {
      throw new Error("Schema markup parsed value is not an object.");
    }
  } catch (schemaErr: unknown) {
    const schemaMsg = schemaErr instanceof Error ? schemaErr.message : String(schemaErr);
    if (schemaMsg.startsWith("Invalid article")) throw schemaErr;
    throw new Error(
      `Invalid article response: Schema.org structured data contains invalid JSON-LD markup: ${schemaMsg}`
    );
  }
}
