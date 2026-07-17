import type { SocialPost, BlogPost, PageMetric, AiProviderConfig } from "../../types";

export interface LinkSuggestion {
  id: string;
  anchorText: string;
  targetUrl: string;
  pageTitle: string;
  contextBefore: string;
  contextAfter: string;
  relevance: number;
  status: "pending" | "inserted" | "ignored";
  startIndex: number;
  endIndex: number;
}

export interface SavedArticle {
  id: string;
  timestamp: string;
  title: string;
  topic: string;
  keyword: string;
  secondaryKeywords: string[];
  wordCount: number;
  tone: string;
  audience: string;
  blogPost: BlogPost;
  customLabel?: string;
}

/** Live SEO analysis snapshot passed into blog generation so articles stay on-niche + local. */
export interface BlogAnalysisContext {
  keywords?: string[];
  contentGaps?: Array<{ topic?: string; keyword?: string; opportunity?: string }>;
  competitors?: string[];
  niche?: string;
  audience?: string;
  strengths?: string[];
  weaknesses?: string[];
  /** Local SEO location from analyze (city, NAP, service areas) */
  localLocation?: {
    city?: string;
    state?: string;
    country?: string;
    detectedAddress?: string;
    serviceAreas?: string[];
    localSeoVerdict?: string;
  };
}

export interface ContentHubProps {
  initialKeyword?: string;
  initialTopic?: string;
  targetDomain: string;
  autonomousBlog?: BlogPost;
  targetPages?: PageMetric[];
  aiConfig?: AiProviderConfig;
  /** Real-time analysis (keywords, gaps, competitors, niche) for master-prompt blog gen */
  analysisContext?: BlogAnalysisContext;
}

export type { SocialPost, BlogPost, PageMetric, AiProviderConfig };