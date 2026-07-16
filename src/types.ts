export interface AiProviderConfig {
  apiKey: string;
  provider: "gemini" | "openrouter" | "custom";
  apiEndpoint: string;
  apiModel: string;
  customFormat: "openai" | "anthropic" | "gemini";
  /** DataForSEO API login (optional — enables live SEO data when both are set) */
  dataforseoLogin?: string;
  /** DataForSEO API password (auto-generated, different from account password) */
  dataforseoPassword?: string;
  /** Auto-detected location code from target domain TLD (e.g. 2840 = US, 2356 = India) */
  locationCode?: number;
  /** Auto-detected language code from target domain TLD (e.g. "en", "de", "fr") */
  languageCode?: string;
}

export interface PageMetric {
  url: string;
  title: string;
  estTraffic: number;
  keywordsCount: number;
}

export interface DomainMetrics {
  domain: string;
  domainRating: number;
  backlinksCount: number;
  referringDomains: number;
  organicTraffic: number;
  organicKeywords: number;
  publishingFrequency: string;
  topPages: PageMetric[];
}

export interface Keyword {
  keyword: string;
  volume: number;
  difficulty: number; // 0 to 100
  cpc: number;
  intent: "Commercial" | "Informational" | "Transactional" | "Navigational";
  type: "Short-tail" | "Long-tail" | "Question";
  competition: "Low" | "Medium" | "High";
  trend: "rising" | "stable" | "declining";
  serpRankings: Array<{ rank: number; title: string; url: string }>;
  relatedKeywords: string[];
  parentTopic: string;
  buyerJourneyStage: "Awareness" | "Consideration" | "Decision";
  opportunityScore: number; // 0-100 calculated score
  isPillarOpportunity: boolean;
}

export interface ContentGap {
  competitorKeyword: string;
  competitorRank: number;
  competitorVolume: number;
  competitorDifficulty: number;
  targetRank: number | "Not Ranking";
  recommendedTopic: string;
  recommendedType: string;
  difficultyCategory: "Easy" | "Medium" | "Hard";
  isQuickWin: boolean;
}

export interface SerpFeature {
  type: "Featured Snippet" | "People Also Ask" | "Video Carousel" | "Local Pack";
  query: string;
  opportunity: string;
  actionability: string;
}

export interface BacklinkSource {
  sourceUrl: string;
  domainRating: number;
  targetUrl: string;
  anchorText: string;
  linkType: "Follow" | "Nofollow";
}

export interface BacklinkOpportunity {
  type: "Guest Posting" | "Unlinked Mention" | "Broken Link";
  sourceDomain: string;
  opportunityUrl: string;
  description: string;
  actionPlan: string;
}

export interface LocalCompetitor {
  name: string;
  domain: string;
  address: string;
  distance: string;
  phone: string;
  rating: number;
  reviewCount: number;
  localRank: number;
  services: string[];
  domainRating: number;
  estimatedMonthlyTraffic: number;
  googleMapsUrl: string;
}

export interface RankingBlueprint {
  currentPosition: string;
  targetPosition: string;
  summary: string;
  technicalSeo: string[];
  localSeo: string[];
  contentStrategy: string[];
  linkBuilding: string[];
  timelineEstimate: string;
  priorityActions: Array<{
    action: string;
    impact: "High" | "Medium" | "Low";
    effort: "Low" | "Medium" | "High";
    timeframe: string;
  }>;
  localKeywordsToTarget: Array<{
    keyword: string;
    searchVolume: number;
    currentRank: string;
  }>;
}

export interface LocalLocation {
  detectedAddress: string;
  city: string;
  state: string;
  country: string;
  confidenceScore: number;
  googleMapPackScore: number;
  citationConsistency: number;
  primaryLocalCompetitors: Array<{ name: string; domain: string; localRank: number; mapDistance: string }>;
  localCompetitors: LocalCompetitor[];
  rankingBlueprint: RankingBlueprint;
  localKeywordOpportunities: Array<{ keyword: string; searchVolume: number; intent: string }>;
  localOptimizationsNeeded: string[];
  localSeoVerdict: string;
}

export interface AnalysisResult {
  target: DomainMetrics;
  competitor: DomainMetrics | null;
  keywords: Keyword[];
  contentGaps: ContentGap[];
  serpFeatures: SerpFeature[];
  backlinkSources: BacklinkSource[];
  backlinkOpportunities: BacklinkOpportunity[];
  discoveredCompetitors?: DiscoveredCompetitor[];
  targetAnalysis?: TargetAnalysis;
  autonomousBlog?: BlogPost;
  localLocation?: LocalLocation;
  rankingBlueprint?: RankingBlueprint;
  /** "dataforseo" | "dataforseo+ai" | "ai" | "simulated" */
  dataSource?: string;
  /** Estimated cost of the DataForSEO query (USD) */
  estimatedCost?: { amount: number; currency: string };
  pageSpeed?: {
    performance: number;
    accessibility: number;
    best_practices: number;
    seo: number;
    fcp_ms?: number;
    lcp_ms?: number;
    tbt_ms?: number;
    cls?: number;
    si_ms?: number;
    tti_ms?: number;
  };
}

export interface DiscoveredCompetitor {
  domain: string;
  nicheSimilarity: number; // 0 to 100 percentage
  nicheFocus: string; // e.g. "Technical Documentation, API integrations"
  estimatedMonthlyTraffic: number;
  popularBlogUrl: string;
  latestArticleTitle: string;
  latestArticleUrl: string;
  analyzedTakeaway: string; // analysis of their content/blog strategy
  targetKeywords?: string[]; // Specific search terms targeted
  seoStrategy?: string; // SEO optimization approach
  aiRankStrategy?: string; // Actionable playbook to rank #1 in AI Search engines
  schemaRecommendation?: string; // Recommended structured data/schemas (JSON-LD)
}

export interface TargetAnalysis {
  coreNiche: string;
  audiencePersona: string;
  contentStrengths: string[];
  contentWeaknesses: string[];
  detailedBreakdown: string; // detailed qualitative summary of their content
  socialPresenceSummary?: string;
  socialMentionKeywords?: string[];
  competitorSocialInsights?: string;
}

export interface SocialPost {
  platform: "Twitter/X" | "LinkedIn" | "Newsletter" | "Reddit" | "Quora" | "Google Business";
  content: string;
  hashtags?: string[];
  visualRecommendations?: string;
  schemaMarkup?: string;
  optimalPostingTime?: string;
  engagementStrategy?: string;
  seoNotes?: string;
  complianceCheck?: string;
}

export interface BlogPost {
  title: string;
  metaDescription: string;
  slugSuggestion?: string;
  outline: string[];
  content: string;
  schemaMarkup: string; // JSON-LD
  /** Present when server/client recovered from AI failure */
  isFallback?: boolean;
  fallbackReason?: string;
  errorMsg?: string;
  preWritingAnalysis?: {
    avgLength: number;
    optimalStructure: string;
    subtopics: string[];
    contentGaps: string[];
    topRankingPages: Array<{ rank: number; title: string; url: string; wordCount: number; dr: number }>;
  };
  linkingRecommendations?: {
    internal: Array<{ anchor: string; url: string; type: string }>;
    external: Array<{ anchor: string; url: string; authority: string }>;
  };
  tables?: Array<{
    title: string;
    type: string;
    headers: string[];
    rows: string[][];
  }>;
  visualizations?: Array<{
    type: string;
    title: string;
    data: any[];
  }>;
  technicalSeo?: {
    canonicalUrl: string;
    ogTags: Record<string, string>;
    twitterTags: Record<string, string>;
    mobileNotes: string;
    speedNotes: string;
    aiEngineOptimization?: {
      targetLlmEngines: string[];
      factualDensityScore: number;
      citationReadiness: string;
      semanticEntityMatching: string[];
      generativeOptimizations: string;
    };
    localSeoRecommendations?: {
      targetRegion: string;
      localEntitiesRequired: string[];
      localizedIntroVariation: string;
      mapEmbedOpportunity: string;
      proximitySignals: string;
    };
  };
  faqSection?: Array<{ question: string; answer: string }>;
  seoAuditorReport?: {
    seoScoreBreakdown: {
      keywordOptimization: number;
      contentStructure: number;
      readability: number;
      technicalSeo: number;
      multimediaUsage: number;
      internalLinking: number;
      schemaMarkup: number;
      mobileOptimization: number;
      total: number;
    };
    contentQualityMetrics: {
      wordCount: number;
      readingTime: number;
      fleschReadingEase: number;
      gradeLevel: number;
      passiveVoicePercent: number;
      transitionWordsPercent: number;
      sentenceVarietyScore: number;
    };
    keywordDensityReport: {
      primaryKeywordDensity: number;
      secondaryKeywords: Array<{ keyword: string; density: number }>;
      lsiKeywordsCount: number;
      longTailKeywordsCount: number;
    };
    competitiveComparison: {
      contentLengthComparison: string;
      keywordCoverageAnalysis: string;
      uniqueValuePropositions: string[];
      contentGapsFilled: string[];
    };
  };
}

export interface DeepKeywordAudit {
  keyword: string;
  topResults: Array<{
    rank: number;
    title: string;
    url: string;
    contentLength: number;
    contentType: "Blog Post" | "YouTube Video" | "Interactive Tool" | "Product Page" | "Comparison Guide" | "Documentation" | "Forum Thread" | "News/PR";
    freshnessScore: "Fresh" | "Stable" | "Legacy";
    domainRating: number;
  }>;
  averageContentLength: number;
  commonSubtopics: Array<{ subtopic: string; relevance: number; description: string }>;
  featuredSnippet: {
    format: "Paragraph" | "List" | "Table" | "None";
    extractedText: string;
    optimizedOpportunity: string;
  };
  peopleAlsoAsk: Array<{ question: string; answer: string; sourceUrl?: string }>;
  relatedSearches: string[];
  contentTypeAnalysis: {
    dominantType: string;
    percentageBreakdown: Array<{ type: string; percentage: number }>;
  };
  freshnessRequirements: {
    level: "High" | "Medium" | "Low";
    explanation: string;
    recommendedUpdateFrequency: string;
  };
}
