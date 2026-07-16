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

export interface ContentHubProps {
  initialKeyword?: string;
  initialTopic?: string;
  targetDomain: string;
  autonomousBlog?: BlogPost;
  targetPages?: PageMetric[];
  aiConfig?: AiProviderConfig;
}

export type { SocialPost, BlogPost, PageMetric, AiProviderConfig };