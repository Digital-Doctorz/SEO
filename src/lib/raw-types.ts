/**
 * Raw API response types for /api/analyze.
 * Used by normalizeAnalysis.ts to replace `any` with proper types.
 */

/** Generic record from API — all fields optional, values unknown */
export type RawRecord = Record<string, unknown>;

/** Raw page metric from API */
export interface RawPageData {
  url?: string;
  title?: string;
  estTraffic?: number;
  keywordsCount?: number;
}

/** Raw keyword from API */
export interface RawKeywordData {
  keyword?: string;
  volume?: number;
  difficulty?: number;
  cpc?: number;
  intent?: string;
  type?: string;
  competition?: string;
  trend?: unknown;
  buyerJourneyStage?: string;
  parentTopic?: string;
  opportunityScore?: number;
  isPillarOpportunity?: boolean;
  serpRankings?: Array<{ rank?: number; title?: string; url?: string }>;
  relatedKeywords?: unknown[];
}

/** Raw content gap from API */
export interface RawContentGapData {
  competitorKeyword?: string;
  keyword?: string;
  query?: string;
  competitorRank?: number;
  rank?: number;
  competitorVolume?: number;
  volume?: number;
  competitorDifficulty?: number;
  difficulty?: number;
  difficultyCategory?: string;
  targetRank?: number | string;
  recommendedTopic?: string;
  topic?: string;
  recommendedType?: string;
  contentType?: string;
  isQuickWin?: boolean;
  quickWin?: boolean;
  cityMention?: string;
  localIntent?: string;
  neighborhoods?: unknown[];
  localSearchVolume?: boolean;
  localDirectoryRelevant?: boolean;
  gbpCategory?: string;
  serpTitlePreview?: string;
  titleAngle?: string;
  titleFormula?: string;
  trafficPotentialScore?: number;
}

/** Raw SERP feature from API */
export interface RawSerpFeatureData {
  type?: string;
  query?: string;
  title?: string;
  opportunity?: string;
  actionability?: string;
}

/** Raw backlink source from API */
export interface RawBacklinkSourceData {
  sourceUrl?: string;
  url?: string;
  source_url?: string;
  sourceDomain?: string;
  source_domain?: string;
  domain?: string;
  domainRating?: number;
  dr?: number;
  domain_rating?: number;
  domain_rank?: number;
  pageAuthority?: number;
  page_authority?: number;
  targetUrl?: string;
  target_url?: string;
  anchorText?: string;
  anchor?: string;
  anchor_text?: string;
  linkType?: string;
  is_dofollow?: boolean;
  isLost?: boolean;
  is_lost?: boolean;
  textPre?: string;
  text_pre?: string;
  textPost?: string;
  text_post?: string;
  platformType?: string;
  platform_type?: string;
  relevanceScore?: number;
  trafficPotential?: number;
  qualityGrade?: string;
  recommendation?: string;
  contextMatch?: string;
  firstSeen?: string;
  first_seen?: string;
  spamScore?: number;
}

/** Raw backlink opportunity from API */
export interface RawBacklinkOpportunityData {
  type?: string;
  sourceDomain?: string;
  domain?: string;
  opportunityUrl?: string;
  url?: string;
  description?: string;
  actionPlan?: string;
}

/** Raw discovered competitor from API */
export interface RawDiscoveredCompetitorData {
  domain?: string;
  url?: string;
  host?: string;
  nicheSimilarity?: number;
  overlapScore?: number;
  similarity?: number;
  nicheFocus?: string;
  focus?: string;
  positioning?: string;
  estimatedMonthlyTraffic?: number;
  traffic?: number;
  organicTraffic?: number;
  analyzedTakeaway?: string;
  takeaway?: string;
  summary?: string;
  targetKeywords?: unknown[];
  keywords?: unknown[];
  popularBlogUrl?: string;
  blogUrl?: string;
  latestArticleTitle?: string;
  articleTitle?: string;
  latestArticleUrl?: string;
  articleUrl?: string;
  seoStrategy?: string;
  aiRankStrategy?: string;
  schemaRecommendation?: string;
  threatLevel?: string;
  threat?: string;
  domainRating?: number;
  dr?: number;
  backlinksCount?: number;
  referringDomains?: number;
  organicKeywords?: number;
  isSerpDiscovered?: boolean;
  contentCadence?: string;
  publishingFrequency?: string;
  strengths?: unknown[];
  weaknesses?: unknown[];
  contentAngles?: unknown[];
  counterMove?: string;
}

/** Raw local competitor from API */
export interface RawLocalCompetitorData {
  name?: string;
  domain?: string;
  address?: string;
  distance?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
  localRank?: number;
  services?: unknown[];
  domainRating?: number;
  estimatedMonthlyTraffic?: number;
  googleMapsUrl?: string;
}

/** Raw primary local competitor from API */
export interface RawPrimaryLocalCompetitorData {
  name?: string;
  domain?: string;
  localRank?: number;
  mapDistance?: string;
  distance?: string;
}

/** Raw local keyword from API */
export interface RawLocalKeywordData {
  keyword?: string;
  searchVolume?: number;
  intent?: string;
}

/** Raw priority action from API */
export interface RawPriorityActionData {
  action?: string;
  impact?: string;
  effort?: string;
  timeframe?: string;
}

/** Raw buyer segment from API */
export interface RawBuyerSegmentData {
  segment?: string;
  name?: string;
  intent?: string;
  need?: string;
  priority?: string;
}

/** Raw channel from API */
export interface RawChannelData {
  channel?: string;
  name?: string;
  role?: string;
  purpose?: string;
  priority?: string;
}

/** Raw 90-day play from API */
export interface RawNinetyDayPlayData {
  play?: string;
  action?: string;
  why?: string;
  reason?: string;
  effort?: string;
}

/** Raw ranking blueprint from API */
export interface RawRankingBlueprintData {
  currentPosition?: string;
  targetPosition?: string;
  summary?: string;
  technicalSeo?: unknown[];
  localSeo?: unknown[];
  contentStrategy?: unknown[];
  linkBuilding?: unknown[];
  timelineEstimate?: string;
  priorityActions?: unknown[];
  localKeywordsToTarget?: unknown[];
}

/** Raw local location from API */
export interface RawLocalLocationData {
  detectedAddress?: string;
  city?: string;
  state?: string;
  country?: string;
  confidenceScore?: number;
  googleMapPackScore?: number;
  citationConsistency?: number;
  serviceAreas?: unknown[];
  localCompetitors?: unknown[];
  primaryLocalCompetitors?: unknown[];
  rankingBlueprint?: unknown;
  localKeywordOpportunities?: unknown[];
  localOptimizationsNeeded?: unknown[];
  localSeoVerdict?: string;
}

/** Raw domain metrics from API */
export interface RawDomainMetricsData {
  domain?: string;
  domainRating?: number;
  backlinksCount?: number;
  referringDomains?: number;
  organicTraffic?: number;
  organicKeywords?: number;
  publishingFrequency?: string;
  topPages?: unknown[];
}

/** Raw target analysis from API */
export interface RawTargetAnalysisData {
  coreNiche?: string;
  audiencePersona?: string;
  contentStrengths?: unknown[];
  contentWeaknesses?: unknown[];
  detailedBreakdown?: string;
  socialPresenceSummary?: string;
  socialMentionKeywords?: unknown[];
  competitorSocialInsights?: string;
  marketResearch?: unknown;
  market?: unknown;
}

/** Raw market research from API */
export interface RawMarketResearchData {
  executiveSummary?: string;
  summary?: string;
  marketOverview?: string;
  overview?: string;
  demandDrivers?: unknown[];
  buyerSegments?: unknown[];
  competitiveIntensity?: string;
  intensity?: string;
  intensityRationale?: string;
  intensityReason?: string;
  categoryLeaders?: unknown[];
  whitespaceOpportunities?: unknown[];
  whitespace?: unknown[];
  positioningRecommendation?: string;
  positioning?: string;
  channelMix?: unknown[];
  ninetyDayPlays?: unknown[];
  swot?: {
    strengths?: unknown[];
    weaknesses?: unknown[];
    opportunities?: unknown[];
    threats?: unknown[];
  };
}

/** Raw full analysis response from /api/analyze */
export interface RawAnalysisResponse {
  target?: unknown;
  competitor?: unknown;
  keywords?: unknown;
  contentGaps?: unknown;
  serpFeatures?: unknown;
  backlinkSources?: unknown;
  backlinkOpportunities?: unknown;
  discoveredCompetitors?: unknown;
  targetAnalysis?: unknown;
  marketResearch?: unknown;
  localLocation?: unknown;
  rankingBlueprint?: unknown;
  autonomousBlog?: unknown;
  dataSource?: string;
  estimatedCost?: unknown;
  pageSpeed?: unknown;
  siteProfile?: {
    brand?: string;
    niche?: string;
  };
  isFallback?: boolean;
  needsApiKey?: boolean;
  fallbackReason?: string;
  aiWarning?: string;
  aiProvider?: string;
  aiModel?: string;
  backlinkSummary?: unknown;
}
