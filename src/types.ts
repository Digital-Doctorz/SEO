// ─── AI Provider ──────────────────────────────────────────────────────────────

export interface AiProviderConfig {
  provider: "gemini" | "openrouter" | "nvidia" | "custom";
  apiKey: string;
  apiModel: string;
  apiEndpoint: string;
  customFormat: "openai" | "anthropic" | "gemini" | "nvidia";
  dataforseoLogin?: string;
  dataforseoPassword?: string;
  locationCode?: number;
  languageCode?: string;
}

export type ProviderConfig = AiProviderConfig;

// ─── Domain Metrics ───────────────────────────────────────────────────────────

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

// ─── Keywords ─────────────────────────────────────────────────────────────────

export interface Keyword {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number;
  intent: "Commercial" | "Informational" | "Transactional" | "Navigational";
  type: "Short-tail" | "Long-tail" | "Question";
  competition: "Low" | "Medium" | "High";
  trend: "rising" | "stable" | "declining";
  serpRankings: Array<{
    rank: number;
    title: string;
    url: string;
  }>;
  relatedKeywords: string[];
  parentTopic: string;
  buyerJourneyStage: "Awareness" | "Consideration" | "Decision";
  opportunityScore: number;
  isPillarOpportunity: boolean;
}

// ─── Content Gaps (with Kolkata local SEO fields) ─────────────────────────────

export interface ContentGap {
  competitorKeyword: string;
  competitorRank: number;
  competitorVolume: number;
  competitorDifficulty: number;
  targetRank: number | "Not Ranking";
  /** High-CTR, keyword-first, localised article / H1 title */
  recommendedTopic: string;
  recommendedType: string;
  difficultyCategory: "Easy" | "Medium" | "Hard";
  isQuickWin: boolean;
  /** City this gap targets — e.g. "Kolkata" */
  cityMention?: string;
  /** Local search intent classification */
  localIntent?: "local_direct" | "local_aware" | "national" | "mixed";
  /** Neighborhoods / localities this gap can reference */
  neighborhoods?: string[];
  /** Whether this keyword has meaningful local search volume */
  localSearchVolume?: boolean;
  /** Whether directory listings (Google Business, Justdial, etc.) help rank */
  localDirectoryRelevant?: boolean;
  /** Suggested Google Business Profile category */
  gbpCategory?: string;
  /** ~50–60 char SERP-style title preview */
  serpTitlePreview?: string;
  /** Why this title formula was chosen */
  titleAngle?: string;
  /** near_me | cost | how_to | best_list | … */
  titleFormula?: string;
  /** 0–100 estimated traffic / CTR potential */
  trafficPotentialScore?: number;
}

// ─── SERP Features ────────────────────────────────────────────────────────────

export interface SerpFeature {
  type: "Featured Snippet" | "People Also Ask" | "Video Carousel" | "Local Pack";
  query: string;
  opportunity: string;
  actionability: string;
}

// ─── Backlinks ────────────────────────────────────────────────────────────────

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

// ─── Discovered Competitors ───────────────────────────────────────────────────

export interface DiscoveredCompetitor {
  domain: string;
  nicheSimilarity: number;
  nicheFocus: string;
  estimatedMonthlyTraffic: number;
  popularBlogUrl: string;
  latestArticleTitle: string;
  latestArticleUrl: string;
  analyzedTakeaway: string;
  targetKeywords: string[];
  seoStrategy: string;
  aiRankStrategy: string;
  schemaRecommendation: string;
  threatLevel: "High" | "Medium" | "Low";
  domainRating: number;
  backlinksCount: number;
  referringDomains: number;
  organicKeywords: number;
  isSerpDiscovered: boolean;
  contentCadence: string;
  strengths: string[];
  weaknesses: string[];
  contentAngles: string[];
  counterMove: string;
}

// ─── Local SEO ────────────────────────────────────────────────────────────────

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
    effort: "High" | "Medium" | "Low";
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
  serviceAreas: string[];
  primaryLocalCompetitors: Array<{
    name: string;
    domain: string;
    localRank: number;
    mapDistance: string;
  }>;
  localCompetitors: LocalCompetitor[];
  rankingBlueprint: RankingBlueprint;
  localKeywordOpportunities: Array<{
    keyword: string;
    searchVolume: number;
    intent: string;
  }>;
  localOptimizationsNeeded: string[];
  localSeoVerdict: string;
}

// ─── Market Research ──────────────────────────────────────────────────────────

export interface MarketResearchReport {
  executiveSummary: string;
  marketOverview: string;
  demandDrivers: string[];
  buyerSegments: Array<{
    segment: string;
    intent: string;
    priority: "Primary" | "Secondary" | "Emerging";
  }>;
  competitiveIntensity: "Low" | "Moderate" | "High" | "Very High";
  intensityRationale: string;
  categoryLeaders: string[];
  whitespaceOpportunities: string[];
  positioningRecommendation: string;
  channelMix: Array<{
    channel: string;
    role: string;
    priority: "High" | "Medium" | "Low";
  }>;
  ninetyDayPlays: Array<{
    play: string;
    why: string;
    effort: "Low" | "Medium" | "High";
  }>;
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
}

// ─── Target Analysis ──────────────────────────────────────────────────────────

export interface TargetAnalysis {
  coreNiche: string;
  audiencePersona: string;
  contentStrengths: string[];
  contentWeaknesses: string[];
  detailedBreakdown: string;
  socialPresenceSummary: string;
  socialMentionKeywords: string[];
  competitorSocialInsights: string;
  marketResearch: MarketResearchReport;
}

// ─── Blog Post ────────────────────────────────────────────────────────────────

export interface SeoMasterChecklistItem {
  score: number;
  passed: number;
  total: number;
  source: string;
  status: "pass" | "warn" | "fail";
  items: Array<{
    id: string;
    label: string;
    detail: string;
    recommendation: string;
    status: "pass" | "warn" | "fail";
  }>;
}

export interface BlogPost {
  title: string;
  metaDescription: string;
  slugSuggestion: string;
  content: string;
  outline: string[];
  schemaMarkup: string;
  faqSection: Array<{
    question: string;
    answer: string;
  }>;
  targetKeywords?: string[];
  seoMasterChecklist?: SeoMasterChecklistItem;
  seoAnalysis?: {
    targetNiche?: string;
    targetAudience?: string;
  };
  imageAssets?: Array<{
    placement?: string;
    alt?: string;
  }>;
  linkingRecommendations?: {
    internal: Array<{
      anchor: string;
      url: string;
      type: string;
    }>;
    external: Array<{
      anchor: string;
      url: string;
      authority: string;
    }>;
  };
  technicalSeo?: {
    canonicalUrl?: string;
    robots?: string;
    ogTags?: Record<string, string>;
    twitterTags?: Record<string, string>;
    mobileNotes?: string;
    speedNotes?: string;
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
  preWritingAnalysis?: {
    avgLength: number;
    optimalStructure: string;
    subtopics: string[];
    contentGaps: string[];
    topRankingPages: Array<{
      rank: number;
      title: string;
      url: string;
      wordCount: number;
      dr: number;
    }>;
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
    data: Array<Record<string, unknown>>;
  }>;
  seoAuditorReport?: {
    seoScoreBreakdown?: Record<string, number>;
    contentQualityMetrics?: Record<string, number>;
    keywordDensityReport?: Record<string, unknown>;
    competitiveComparison?: Record<string, unknown>;
  };
  isFallback?: boolean;
  fallbackReason?: string;
  errorMsg?: string;
  keywordStrategy?: {
    secondary?: string[];
  };
}

// ─── Social Post ──────────────────────────────────────────────────────────────

export interface SocialPost {
  platform: "Twitter/X" | "LinkedIn" | "Newsletter" | "Reddit" | "Quora" | "Google Business";
  content: string;
  hashtags: string[];
  optimalPostingTime: string;
  engagementStrategy: string;
  seoNotes: string;
  visualRecommendations?: string;
  complianceCheck?: string;
  schemaMarkup?: string;
  isFallback?: boolean;
  fallbackReason?: string;
}

// ─── Deep Keyword Audit ───────────────────────────────────────────────────────

export interface DeepKeywordAudit {
  averageContentLength: number;
  freshnessRequirements: {
    level: "High" | "Medium" | "Low";
    recommendedUpdateFrequency: string;
    explanation: string;
  };
  contentTypeAnalysis: {
    dominantType: string;
    percentageBreakdown: Array<{
      type: string;
      percentage: number;
    }>;
  };
  featuredSnippet: {
    format: string;
    extractedText: string;
    optimizedOpportunity: string;
  };
  topResults: Array<{
    rank: number;
    title: string;
    url: string;
    contentType: string;
    contentLength: number;
    domainRating: number;
    freshnessScore: "Fresh" | "Stable" | "Stale";
  }>;
  commonSubtopics: Array<{
    subtopic: string;
    relevance: number;
    description: string;
  }>;
  peopleAlsoAsk: Array<{
    question: string;
    answer: string;
    sourceUrl?: string;
  }>;
  relatedSearches: string[];
  isFallback?: boolean;
}

// ─── Analysis Result (top-level) ──────────────────────────────────────────────

export interface AnalysisResult {
  [key: string]: unknown;
  target: DomainMetrics;
  competitor: DomainMetrics | null;
  keywords: Keyword[];
  contentGaps: ContentGap[];
  serpFeatures: SerpFeature[];
  backlinkSources: BacklinkSource[];
  backlinkOpportunities: BacklinkOpportunity[];
  discoveredCompetitors: DiscoveredCompetitor[];
  targetAnalysis: TargetAnalysis;
  marketResearch: MarketResearchReport;
  autonomousBlog?: BlogPost;
  localLocation: LocalLocation;
  rankingBlueprint?: RankingBlueprint;
  dataSource: string;
  estimatedCost?: { amount: number; currency: string };
  pageSpeed?: {
    performance: number;
    accessibility: number;
    best_practices: number;
    seo: number;
  };
}

// ─── DataForSEO raw interfaces (kept for API layer) ──────────────────────────

export interface DfSerpItem {
  se_domain?: string;
  rank_group?: number;
  rank_absolute?: number;
  domain?: string;
  title?: string;
  description?: string;
  url?: string;
  snippet?: string;
  breadcrumb?: string;
}

export interface DfKeywordData {
  keyword: string;
  search_volume?: number;
  cpc?: number;
  competition?: string | number;
  competition_index?: number;
  trend?: number[];
  monthly_searches?: Array<{ year?: number; month?: number; search_volume?: number }>;
}

export interface DfDomainBacklinksResult {
  target?: string;
  domain?: string;
  backlinks?: number;
  dofollow?: number;
  referring_domains?: number;
  referring_domains_change?: number;
  rank?: number;
  domain_rank?: number;
}

export interface DfBacklinkItem {
  domain_from?: string;
  url_from?: string;
  url_to?: string;
  anchor?: string;
  domain_from_rank?: number;
  page_from_authority_score?: number;
  domain_to?: string;
  target_url?: string;
  first_seen?: string;
  rank?: number;
  domain_rank?: number;
  platform_type?: string;
  page_authority_score?: number;
  domain_authority_score?: number;
  text_pre?: string;
  text_post?: string;
  dominant_platform_type?: string;
  firstly_found?: string;
  lost?: string;
  status_code?: number;
  status_text?: string;
  spider?: string;
  crawl_depth?: number;
}

export interface DataForSeoBundle {
  serp: {
    organic: Array<{ position: number; title: string; url: string; snippet: string; domain: string }>;
    featured_snippet?: string;
    local_pack: unknown[];
    people_also_ask: unknown[];
    related_searches: unknown[];
  };
  keywordLandscape: Array<{
    keyword: string;
    volume: number;
    difficulty: number;
    cpc: number;
    trend: number[];
    opportunity: "high" | "medium" | "low";
    intent?: string;
  }>;
  backlinks: {
    total_backlinks: number;
    referring_domains: number;
    domain_rating: number;
    dofollow_ratio: number;
    link_growth: number;
    top_referring_domains: Array<{
      source_url: string;
      source_domain: string;
      anchor: string;
      domain_rating: number;
      first_seen: string;
    }>;
  };
  pageSpeed?: {
    performance: number;
    accessibility: number;
    best_practices: number;
    seo: number;
  };
  rawSerpItems?: DfSerpItem[];
  rawBacklinkItems?: DfBacklinkItem[];
  rawKeywordData?: DfKeywordData[];
  estimatedCost?: { amount: number; currency: string };
}

export interface DfsCredentials {
  login: string;
  password: string;
}
