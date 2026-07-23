/**
 * Canonical normalizer for /api/analyze payloads.
 * Single place so every UI tab gets a stable shape — no partial AI objects.
 */
import { KOLKATA_CITY } from "./geo";
import type {
  AnalysisResult,
  BacklinkOpportunity,
  BacklinkSource,
  ContentGap,
  DiscoveredCompetitor,
  DomainMetrics,
  Keyword,
  LocalCompetitor,
  LocalLocation,
  MarketResearchReport,
  PageMetric,
  RankingBlueprint,
  SerpFeature,
  TargetAnalysis,
} from "../types";
import { sanitizeDeep } from "./text";
import { ensureOptimizedGapTitle, keywordHasGeo } from "./contentGapTitles";
import type {
  RawPageData,
  RawDomainMetricsData,
  RawKeywordData,
  RawContentGapData,
  RawSerpFeatureData,
  RawBacklinkSourceData,
  RawBacklinkOpportunityData,
  RawDiscoveredCompetitorData,
  RawLocalCompetitorData,
  RawPrimaryLocalCompetitorData,
  RawLocalKeywordData,
  RawPriorityActionData,
  RawBuyerSegmentData,
  RawChannelData,
  RawNinetyDayPlayData,
  RawMarketResearchData,
  RawTargetAnalysisData,
  RawLocalLocationData,
  RawRecord,
} from "./raw-types";

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  const s = String(v).trim();
  return s || fallback;
}

function normalizePage(p: unknown, domain: string, i: number): PageMetric {
  const pg = (p && typeof p === "object" ? p : {}) as RawPageData;
  return {
    url: str(pg.url, `https://${domain}/page-${i + 1}`),
    title: str(pg.title, `Page ${i + 1}`),
    estTraffic: Math.max(0, Math.round(num(pg.estTraffic, 100))),
    keywordsCount: Math.max(0, Math.round(num(pg.keywordsCount, 5))),
  };
}

export function normalizeDomainMetrics(
  raw: unknown,
  fallbackDomain = "example.com"
): DomainMetrics {
  const dm = (raw && typeof raw === "object" ? raw : {}) as RawDomainMetricsData;
  const domain = str(dm.domain, fallbackDomain).replace(/^www\./, "");
  const topPages = Array.isArray(dm.topPages)
    ? dm.topPages.map((p, i) => normalizePage(p, domain, i))
    : [];
  return {
    domain,
    domainRating: Math.max(0, Math.min(100, Math.round(num(dm.domainRating, 40)))),
    backlinksCount: Math.max(0, Math.round(num(dm.backlinksCount, 0))),
    referringDomains: Math.max(0, Math.round(num(dm.referringDomains, 0))),
    organicTraffic: Math.max(0, Math.round(num(dm.organicTraffic, 0))),
    organicKeywords: Math.max(0, Math.round(num(dm.organicKeywords, 0))),
    publishingFrequency: str(dm.publishingFrequency, "1-2 articles / week"),
    topPages,
  };
}

function normalizeTrend(raw: unknown): Keyword["trend"] {
  // Live DataForSEO often sends monthly volume arrays; map to rising/stable/declining
  if (Array.isArray(raw) && raw.length >= 2) {
    const vols = raw.map((v) => Number(v) || 0);
    const recent = vols.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, vols.length);
    const older = vols.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, vols.length);
    if (older <= 0) return recent > 0 ? "rising" : "stable";
    if (recent > older * 1.15) return "rising";
    if (recent < older * 0.85) return "declining";
    return "stable";
  }
  const trendRaw = str(raw, "stable").toLowerCase();
  if (trendRaw === "rising" || trendRaw === "up" || trendRaw === "growing") return "rising";
  if (trendRaw === "declining" || trendRaw === "down" || trendRaw === "falling") return "declining";
  return "stable";
}

function normalizeIntent(raw: unknown): Keyword["intent"] {
  const intentRaw = str(raw, "Informational");
  const cap =
    intentRaw.charAt(0).toUpperCase() + intentRaw.slice(1).toLowerCase();
  // Handle full lowercase payloads from partial API merges ("informational")
  const map: Record<string, Keyword["intent"]> = {
    commercial: "Commercial",
    informational: "Informational",
    transactional: "Transactional",
    navigational: "Navigational",
    Commercial: "Commercial",
    Informational: "Informational",
    Transactional: "Transactional",
    Navigational: "Navigational",
  };
  return map[intentRaw] || map[cap] || "Informational";
}

export function normalizeKeywords(raw: unknown): Keyword[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((k, i): Keyword | null => {
      const kw = (k && typeof k === "object" ? k : {}) as RawKeywordData;
      const keyword = str(kw.keyword, "");
      if (!keyword) return null;
      const difficulty = Math.max(0, Math.min(100, Math.round(num(kw.difficulty, 40))));
      const volume = Math.max(0, Math.round(num(kw.volume, 100)));
      const intent = normalizeIntent(kw.intent);
      const typeRaw = str(
        kw.type,
        keyword.includes("?") ? "Question" : keyword.split(/\s+/).length > 2 ? "Long-tail" : "Short-tail"
      );
      // Map invalid types like "organic" to real taxonomy
      const type = (
        ["Short-tail", "Long-tail", "Question"].includes(typeRaw)
          ? typeRaw
          : keyword.includes("?")
            ? "Question"
            : keyword.split(/\s+/).length > 2
              ? "Long-tail"
              : "Short-tail"
      ) as Keyword["type"];
      const competitionRaw = str(kw.competition, difficulty < 30 ? "Low" : difficulty < 60 ? "Medium" : "High");
      const competitionCap =
        competitionRaw.charAt(0).toUpperCase() + competitionRaw.slice(1).toLowerCase();
      const competition = (
        ["Low", "Medium", "High"].includes(competitionCap) ? competitionCap : "Medium"
      ) as Keyword["competition"];
      const trend = normalizeTrend(kw.trend);
      const stageRaw = str(kw.buyerJourneyStage, i < 2 ? "Awareness" : i < 4 ? "Consideration" : "Decision");
      const buyerJourneyStage = (
        ["Awareness", "Consideration", "Decision"].includes(stageRaw) ? stageRaw : "Awareness"
      ) as Keyword["buyerJourneyStage"];

      // Ensure clusters always have a parent topic (never blank → "Unassigned" junk pile)
      const parentTopic = str(
        kw.parentTopic,
        keyword.split(/\s+/).slice(0, 2).join(" ") || keyword.split(/\s+/)[0] || "General"
      );

      return {
        keyword,
        volume,
        difficulty,
        cpc: Math.max(0, num(kw.cpc, 1.2)),
        intent,
        type,
        competition,
        trend,
        serpRankings: Array.isArray(kw.serpRankings)
          ? kw.serpRankings.map((r, ri) => ({
              rank: Math.max(1, Math.round(num(r?.rank, ri + 1))),
              title: str(r?.title, keyword),
              url: str(r?.url, "https://example.com"),
            }))
          : [],
        relatedKeywords: Array.isArray(kw.relatedKeywords)
          ? kw.relatedKeywords.map((x) => str(x)).filter(Boolean)
          : [],
        parentTopic,
        buyerJourneyStage,
        opportunityScore: Math.max(0, Math.min(100, Math.round(num(kw.opportunityScore, 70 - i * 5)))),
        isPillarOpportunity: Boolean(kw.isPillarOpportunity ?? i < 3),
      };
    })
    .filter((k): k is Keyword => k != null);
}

export function normalizeContentGaps(
  raw: unknown,
  opts: { city?: string; brand?: string } = {}
): ContentGap[] {
  if (!Array.isArray(raw)) return [];
  const defaultCity = str(opts.city, KOLKATA_CITY);
  const brand = str(opts.brand, "");
  return raw
    .map((g, i): ContentGap | null => {
      const gap = (g && typeof g === "object" ? g : {}) as RawContentGapData;
      const competitorKeyword = str(gap.competitorKeyword || gap.keyword || gap.query, "");
      if (!competitorKeyword) return null;
      const difficulty = Math.max(
        1,
        Math.min(100, Math.round(num(gap.competitorDifficulty ?? gap.difficulty, 30)))
      );
      let difficultyCategory = str(gap.difficultyCategory, "") as ContentGap["difficultyCategory"];
      if (difficultyCategory !== "Easy" && difficultyCategory !== "Medium" && difficultyCategory !== "Hard") {
        difficultyCategory = difficulty < 30 ? "Easy" : difficulty < 55 ? "Medium" : "Hard";
      }
      let targetRank: number | "Not Ranking" = "Not Ranking";
      if (gap.targetRank === "Not Ranking" || String(gap.targetRank).toLowerCase() === "unranked") {
        targetRank = "Not Ranking";
      } else if (gap.targetRank != null && gap.targetRank !== "") {
        const tr = Number(gap.targetRank);
        targetRank = Number.isFinite(tr) ? Math.round(tr) : "Not Ranking";
      }

      const volume = Math.max(0, Math.round(num(gap.competitorVolume ?? gap.volume, 500)));
      const cityMention = str(gap.cityMention, defaultCity) || defaultCity;
      const optimized = ensureOptimizedGapTitle(competitorKeyword, str(gap.recommendedTopic || gap.topic, ""), {
        city: cityMention,
        brand,
        volume,
        difficulty,
        index: i,
      });

      const hasGeo = keywordHasGeo(competitorKeyword, cityMention);
      let localIntent = (
        ["local_direct", "local_aware", "national", "mixed"].includes(gap.localIntent ?? "")
          ? gap.localIntent
          : undefined
      ) as ContentGap["localIntent"];
      if (!localIntent) {
        if (/\bnear me\b/i.test(competitorKeyword) || hasGeo) localIntent = "local_direct";
        else if (optimized.title.toLowerCase().includes(cityMention.toLowerCase())) localIntent = "local_aware";
        else localIntent = "mixed";
      }

      return {
        competitorKeyword,
        competitorRank: Math.max(1, Math.round(num(gap.competitorRank ?? gap.rank, 5))),
        competitorVolume: volume,
        competitorDifficulty: difficulty,
        targetRank,
        recommendedTopic: optimized.title,
        recommendedType: str(
          gap.recommendedType || gap.contentType,
          localIntent === "local_direct" ? "Local Pillar / Service Page" : "Pillar Blog Post"
        ),
        difficultyCategory,
        isQuickWin: Boolean(gap.isQuickWin ?? gap.quickWin ?? difficulty < 35),
        cityMention,
        localIntent,
        neighborhoods: Array.isArray(gap.neighborhoods)
          ? gap.neighborhoods.map((n) => str(n)).filter(Boolean).slice(0, 10)
          : [],
        localSearchVolume: Boolean(
          gap.localSearchVolume ?? (hasGeo || localIntent === "local_direct" || localIntent === "local_aware")
        ),
        localDirectoryRelevant: Boolean(
          gap.localDirectoryRelevant ?? (/\bnear me\b|doctor|clinic|hospital|dentist|lawyer/i.test(competitorKeyword))
        ),
        gbpCategory: str(gap.gbpCategory, ""),
        serpTitlePreview: str(gap.serpTitlePreview, optimized.serpTitle),
        titleAngle: str(gap.titleAngle, optimized.angle),
        titleFormula: str(gap.titleFormula, optimized.formula),
        trafficPotentialScore: Math.max(
          1,
          Math.min(100, Math.round(num(gap.trafficPotentialScore, optimized.trafficPotentialScore)))
        ),
      };
    })
    .filter((g): g is ContentGap => g != null)
    // Highest traffic opportunity first for the audit board
    .sort((a, b) => (b.trafficPotentialScore || 0) - (a.trafficPotentialScore || 0));
}

const SERP_TYPES = new Set(["Featured Snippet", "People Also Ask", "Video Carousel", "Local Pack"]);

export function normalizeSerpFeatures(raw: unknown): SerpFeature[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f): SerpFeature | null => {
      const feat = (f && typeof f === "object" ? f : {}) as RawSerpFeatureData;
      const type = str(feat.type, "Featured Snippet");
      if (!SERP_TYPES.has(type)) {
        // Drop organic SERP rows that are not feature opportunities
        return null;
      }
      const query = str(feat.query || feat.title, "");
      if (!query) return null;
      return {
        type: type as SerpFeature["type"],
        query,
        opportunity: str(feat.opportunity, "Optimize this SERP feature with clear answer blocks."),
        actionability: str(feat.actionability, "Add structured content and FAQ schema."),
      };
    })
    .filter((f): f is SerpFeature => f != null);
}

export function normalizeBacklinkSources(raw: unknown, domain = "example.com"): BacklinkSource[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b): BacklinkSource | null => {
      const bl = (b && typeof b === "object" ? b : {}) as RawBacklinkSourceData;
      const sourceUrl = str(bl.sourceUrl || bl.url || bl.source_url, "");
      if (!sourceUrl && !bl.source_domain && !bl.domain) return null;
      const sourceDomain = str(bl.sourceDomain || bl.source_domain || bl.domain, "");
      const dr = Math.max(0, Math.min(100, Math.round(num(bl.domainRating ?? bl.dr ?? bl.domain_rank ?? bl.domain_rating, 40))));
      const isFollow = str(bl.linkType, "Follow") === "Nofollow" ? "Nofollow" : "Follow";
      return {
        sourceUrl: sourceUrl || `https://${sourceDomain}/`,
        sourceDomain,
        domainRating: dr,
        pageAuthority: bl.pageAuthority ?? bl.page_authority ?? dr,
        targetUrl: str(bl.targetUrl || bl.target_url, `https://${domain}/`),
        anchorText: str(bl.anchorText || bl.anchor || bl.anchor_text, domain),
        linkType: isFollow as "Follow" | "Nofollow",
        relevanceScore: num(bl.relevanceScore, undefined),
        trafficPotential: num(bl.trafficPotential, undefined),
        qualityGrade: str(bl.qualityGrade, undefined) as BacklinkSource["qualityGrade"],
        recommendation: str(bl.recommendation, undefined) as BacklinkSource["recommendation"],
        contextMatch: str(bl.contextMatch, undefined),
        firstSeen: str(bl.firstSeen || bl.first_seen, undefined),
        isLost: bl.isLost ?? bl.is_lost ?? undefined,
        spamScore: num(bl.spamScore, undefined),
        textPre: str(bl.textPre || bl.text_pre, undefined),
        textPost: str(bl.textPost || bl.text_post, undefined),
        platformType: str(bl.platformType || bl.platform_type, undefined),
      };
    })
    .filter((b): b is BacklinkSource => b != null);
}

export function normalizeBacklinkOpportunities(raw: unknown): BacklinkOpportunity[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o): BacklinkOpportunity | null => {
      const opp = (o && typeof o === "object" ? o : {}) as RawBacklinkOpportunityData;
      const typeRaw = str(opp.type, "Guest Posting");
      const type = (
        ["Guest Posting", "Unlinked Mention", "Broken Link"].includes(typeRaw)
          ? typeRaw
          : "Guest Posting"
      ) as BacklinkOpportunity["type"];
      const sourceDomain = str(opp.sourceDomain || opp.domain, "");
      if (!sourceDomain && !opp.opportunityUrl) return null;
      return {
        type,
        sourceDomain: sourceDomain || "opportunity.com",
        opportunityUrl: str(opp.opportunityUrl || opp.url, "https://example.com/write-for-us"),
        description: str(opp.description, "Link opportunity identified for outreach."),
        actionPlan: str(opp.actionPlan, "Draft outreach and pitch a resource replacement."),
      };
    })
    .filter((o): o is BacklinkOpportunity => o != null);
}

function strList(raw: unknown, max = 8): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => str(x, "")).filter(Boolean).slice(0, max);
}

export function normalizeDiscoveredCompetitors(
  raw: unknown,
  niche = "this category",
  brand = "your brand"
): DiscoveredCompetitor[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c, i): DiscoveredCompetitor | null => {
      const comp = (c && typeof c === "object" ? c : {}) as RawDiscoveredCompetitorData;
      const domain = str(comp.domain || comp.url || comp.host, "")
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/.*$/, "")
        .toLowerCase();
      if (!domain || domain.length < 3) return null;

      const sim = Math.max(
        1,
        Math.min(100, Math.round(num(comp.nicheSimilarity ?? comp.overlapScore ?? comp.similarity, 70 - (i % 20))))
      );
      const threatRaw = str(comp.threatLevel || comp.threat, sim >= 85 ? "High" : sim >= 70 ? "Medium" : "Low");
      const threatLevel = (
        ["High", "Medium", "Low"].includes(threatRaw) ? threatRaw : "Medium"
      ) as DiscoveredCompetitor["threatLevel"];

      const focus = str(comp.nicheFocus || comp.focus || comp.positioning, `Competitor in ${niche}`);
      const traffic = Math.max(
        100,
        Math.round(num(comp.estimatedMonthlyTraffic ?? comp.traffic ?? comp.organicTraffic, 8000 + i * 1500))
      );
      const takeaway = str(
        comp.analyzedTakeaway || comp.takeaway || comp.summary,
        `${domain} competes in ${niche}. Study their content clusters and outrank them with deeper FAQs, comparison pages, and clearer proof points for ${brand}.`
      );

      const kws = strList(comp.targetKeywords || comp.keywords, 8);
      if (kws.length < 2) {
        kws.push(`${niche.split(/[&,]/)[0]?.trim() || "services"} guide`, `best ${domain.split(".")[0]} alternative`);
      }

      return {
        domain,
        nicheSimilarity: sim,
        nicheFocus: focus,
        estimatedMonthlyTraffic: traffic,
        popularBlogUrl: str(comp.popularBlogUrl || comp.blogUrl, `https://${domain}/blog`),
        latestArticleTitle: str(
          comp.latestArticleTitle || comp.articleTitle,
          `How ${focus.split(",")[0]} teams are winning in 2026`
        ),
        latestArticleUrl: str(
          comp.latestArticleUrl || comp.articleUrl,
          `https://${domain}/blog/strategy-${i + 1}`
        ),
        analyzedTakeaway: takeaway,
        targetKeywords: kws.slice(0, 6),
        seoStrategy: str(
          comp.seoStrategy,
          "Topical authority clusters, commercial comparison pages, FAQ schema, and consistent internal linking from money pages."
        ),
        aiRankStrategy: str(
          comp.aiRankStrategy,
          "Answer-first H2s, entity-rich definitions, cited sources, and clear step lists so AI Overviews and chat engines can cite the page."
        ),
        schemaRecommendation: str(
          comp.schemaRecommendation,
          "Article + FAQPage + Organization (and Service/Product where relevant) JSON-LD on hub and service templates."
        ),
        threatLevel,
        domainRating: Math.max(1, Math.min(100, Math.round(num(comp.domainRating ?? comp.dr, 45 + ((sim / 2) | 0) - i)))),
        backlinksCount: Math.max(0, Math.round(num(comp.backlinksCount, 0))),
        referringDomains: Math.max(0, Math.round(num(comp.referringDomains, 0))),
        organicKeywords: Math.max(0, Math.round(num(comp.organicKeywords, 0))),
        isSerpDiscovered: Boolean(comp.isSerpDiscovered),
        contentCadence: str(comp.contentCadence || comp.publishingFrequency, i % 2 === 0 ? "2–4 posts / week" : "1–2 posts / week"),
        strengths: strList(comp.strengths, 4).length
          ? strList(comp.strengths, 4)
          : ["Strong category presence", "Established content footprint", "Clear commercial intent coverage"],
        weaknesses: strList(comp.weaknesses, 4).length
          ? strList(comp.weaknesses, 4)
          : ["Generic long-tail depth", "Thin local/niche proof", "Weak comparison content"],
        contentAngles: strList(comp.contentAngles, 4).length
          ? strList(comp.contentAngles, 4)
          : ["How-to guides", "Comparison pages", "Use-case stories"],
        counterMove: str(
          comp.counterMove,
          `Publish a deeper "${kws[0]}" pillar with tables, FAQs, and brand-specific proof that ${domain} does not cover.`
        ),
      };
    })
    .filter((c): c is DiscoveredCompetitor => c != null)
    .slice(0, 15);
}

export function normalizeMarketResearch(
  raw: unknown,
  opts: {
    niche?: string;
    brand?: string;
    domain?: string;
    strengths?: string[];
    weaknesses?: string[];
    competitors?: DiscoveredCompetitor[];
  } = {}
): MarketResearchReport {
  const r = (raw && typeof raw === "object" ? raw : {}) as RawMarketResearchData;
  const niche = str(opts.niche, "this market");
  const brand = str(opts.brand, "Your brand");
  const domain = str(opts.domain, "your site");
  const topComps = (opts.competitors || []).slice(0, 5).map((c) => c.domain);

  const intensityRaw = str(r.competitiveIntensity || r.intensity, topComps.length >= 8 ? "High" : "Moderate");
  const competitiveIntensity = (
    ["Low", "Moderate", "High", "Very High"].includes(intensityRaw) ? intensityRaw : "Moderate"
  ) as MarketResearchReport["competitiveIntensity"];

  const swotIn = (r.swot && typeof r.swot === "object" ? r.swot : {}) as Record<string, unknown>;
  const buyerIn = Array.isArray(r.buyerSegments) ? r.buyerSegments : [];
  const channelIn = Array.isArray(r.channelMix) ? r.channelMix : [];
  const playsIn = Array.isArray(r.ninetyDayPlays) ? r.ninetyDayPlays : [];

  return {
    executiveSummary: str(
      r.executiveSummary || r.summary,
      `${brand} (${domain}) competes in ${niche}. Market demand is driven by buyers comparing solutions, seeking proof, and searching long-tail how-to and commercial queries. Winning requires topical authority, differentiated proof, and content that closes gaps competitors leave open.`
    ),
    marketOverview: str(
      r.marketOverview || r.overview,
      `The ${niche} category rewards brands that educate early (awareness), compare clearly (consideration), and convert with trust signals (decision). Searchers mix informational guides with commercial "best / vs / pricing" queries. Authority sites and focused specialists both rank — specialists win when they go deeper on niche problems.`
    ),
    demandDrivers: strList(r.demandDrivers, 6).length
      ? strList(r.demandDrivers, 6)
      : [
          `Rising search for practical ${niche} how-to and comparison content`,
          "Buyers research online before contacting sales or booking",
          "Trust, proof, and specificity beat generic category pages",
          "AI answers surface sites with clear definitions and cited structure",
        ],
    buyerSegments:
      buyerIn.length > 0
        ? buyerIn.slice(0, 5).map((b, i) => {
            const seg = (b && typeof b === "object" ? b : {}) as RawBuyerSegmentData;
            return {
              segment: str(seg.segment || seg.name, `Segment ${i + 1}`),
              intent: str(seg.intent || seg.need, "Research and evaluate options"),
              priority: (["Primary", "Secondary", "Emerging"].includes(str(seg.priority))
                ? str(seg.priority)
                : i === 0
                  ? "Primary"
                  : i === 1
                    ? "Secondary"
                    : "Emerging") as "Primary" | "Secondary" | "Emerging",
            };
          })
        : [
            {
              segment: "Problem-aware researchers",
              intent: `Learn how ${niche} works and what good looks like`,
              priority: "Primary" as const,
            },
            {
              segment: "Solution comparers",
              intent: "Evaluate vendors, pricing, approaches, and alternatives",
              priority: "Primary" as const,
            },
            {
              segment: "Ready-to-act buyers",
              intent: "Find trusted local/specialist providers and next steps",
              priority: "Secondary" as const,
            },
          ],
    competitiveIntensity,
    intensityRationale: str(
      r.intensityRationale || r.intensityReason,
      topComps.length
        ? `Tracked peers include ${topComps.slice(0, 4).join(", ")}. Overlap on commercial and educational queries keeps competition ${competitiveIntensity.toLowerCase()}.`
        : `Multiple publishers and specialists contest the same ${niche} SERPs, so differentiation and depth matter more than volume alone.`
    ),
    categoryLeaders: strList(r.categoryLeaders, 8).length
      ? strList(r.categoryLeaders, 8)
      : topComps.length
        ? topComps
        : ["Category education hubs", "Specialist practitioners", "Comparison/review sites"],
    whitespaceOpportunities: strList(r.whitespaceOpportunities || r.whitespace, 8).length
      ? strList(r.whitespaceOpportunities || r.whitespace, 8)
      : [
          "Long-tail problem + solution guides competitors leave thin",
          "Brand-specific comparison and alternatives pages",
          "FAQ/PAA clusters with schema for rich results and AI citations",
          "Proof-led case narratives with metrics and process steps",
        ],
    positioningRecommendation: str(
      r.positioningRecommendation || r.positioning,
      `Position ${brand} as the practical specialist in ${niche}: clearer process, stronger proof, and content that answers commercial questions competitors skim. Own 2–3 pillar topics and support each with cluster pages + internal links.`
    ),
    channelMix:
      channelIn.length > 0
        ? channelIn.slice(0, 6).map((ch) => {
            const chData = (ch && typeof ch === "object" ? ch : {}) as RawChannelData;
            return {
              channel: str(chData.channel || chData.name, "Organic search"),
              role: str(chData.role || chData.purpose, "Demand capture"),
              priority: (["High", "Medium", "Low"].includes(str(chData.priority))
                ? str(chData.priority)
                : "High") as "High" | "Medium" | "Low",
            };
          })
        : [
            { channel: "Organic search (SEO)", role: "Primary demand capture & trust", priority: "High" as const },
            { channel: "Content / blog clusters", role: "Topical authority & nurture", priority: "High" as const },
            { channel: "Comparison & alternatives pages", role: "Steal competitor demand", priority: "High" as const },
            { channel: "AI search / GEO", role: "Citations in ChatGPT, Perplexity, AI Overviews", priority: "Medium" as const },
            { channel: "Social proof & community", role: "Trust and distribution", priority: "Medium" as const },
          ],
    ninetyDayPlays:
      playsIn.length > 0
        ? playsIn.slice(0, 6).map((p) => {
            const play = (p && typeof p === "object" ? p : {}) as RawNinetyDayPlayData;
            return {
              play: str(play.play || play.action, "Publish a pillar + cluster set"),
              why: str(play.why || play.reason, "Closes a visible content gap"),
              effort: (["Low", "Medium", "High"].includes(str(play.effort))
                ? str(play.effort)
                : "Medium") as "Low" | "Medium" | "High",
            };
          })
        : [
            {
              play: "Ship 1 pillar + 3 cluster articles on top content gaps",
              why: "Builds topical authority where competitors rank and you do not",
              effort: "Medium" as const,
            },
            {
              play: "Add FAQ schema + answer blocks to top 5 service pages",
              why: "Wins PAA / featured snippet / AI citation eligibility",
              effort: "Low" as const,
            },
            {
              play: "Publish 2 comparison pages vs nearest peers",
              why: "Captures high-intent commercial searchers mid-funnel",
              effort: "Medium" as const,
            },
          ],
    swot: {
      strengths: strList((swotIn as Record<string, unknown>).strengths as unknown, 5).length
        ? strList((swotIn as Record<string, unknown>).strengths as unknown, 5)
        : strList(opts.strengths, 5).length
          ? strList(opts.strengths, 5)
          : [`Live brand presence on ${domain}`, `On-niche focus in ${niche}`, "Room to own long-tail depth"],
      weaknesses: strList((swotIn as Record<string, unknown>).weaknesses as unknown, 5).length
        ? strList((swotIn as Record<string, unknown>).weaknesses as unknown, 5)
        : strList(opts.weaknesses, 5).length
          ? strList(opts.weaknesses, 5)
          : ["Incomplete long-tail coverage", "Fewer comparison assets than peers", "Limited SERP feature ownership"],
      opportunities: strList((swotIn as Record<string, unknown>).opportunities as unknown, 5).length
        ? strList((swotIn as Record<string, unknown>).opportunities as unknown, 5)
        : [
            "Content gap keywords with Easy/Medium difficulty",
            "AI Overview / GEO answer formatting",
            "Internal linking from services → education hubs",
          ],
      threats: strList((swotIn as Record<string, unknown>).threats as unknown, 5).length
        ? strList((swotIn as Record<string, unknown>).threats as unknown, 5)
        : [
            topComps[0] ? `${topComps[0]} and peers publishing faster` : "Authority publishers outranking thin pages",
            "Generic AI content flooding the SERP",
            "Paid competitors bidding on brand/category terms",
          ],
    },
  };
}

export function normalizeTargetAnalysis(
  raw: unknown,
  opts: {
    domain?: string;
    niche?: string;
    brand?: string;
    competitors?: DiscoveredCompetitor[];
  } = {}
): TargetAnalysis {
  const t = (raw && typeof raw === "object" ? raw : {}) as RawTargetAnalysisData;
  const domain = str(opts.domain, "your-site.com");
  const brand = str(opts.brand, domain.split(".")[0] || "Brand");
  const niche = str(t.coreNiche || opts.niche, "Core business services");
  const strengths = strList(t.contentStrengths, 8);
  const weaknesses = strList(t.contentWeaknesses, 8);
  const competitors = opts.competitors || [];

  const marketResearch = normalizeMarketResearch(t.marketResearch || t.market, {
    niche,
    brand,
    domain,
    strengths,
    weaknesses,
    competitors,
  });

  return {
    coreNiche: niche,
    audiencePersona: str(
      t.audiencePersona,
      `People actively researching and buying ${niche} solutions related to ${brand}`
    ),
    contentStrengths: strengths.length
      ? strengths
      : ["On-niche brand messaging", "Service pages present", "Crawlable site structure"],
    contentWeaknesses: weaknesses.length
      ? weaknesses
      : ["Limited long-tail educational depth", "Missing comparison content", "Thin FAQ coverage"],
    detailedBreakdown: str(
      t.detailedBreakdown,
      `${brand} (${domain}) operates in ${niche}. Competitive pressure comes from ${
        competitors.slice(0, 3).map((c) => c.domain).join(", ") || "category peers"
      }. Priority is to close content gaps with pillar+cluster pages and strengthen commercial proof.`
    ),
    socialPresenceSummary: str(
      t.socialPresenceSummary,
      `Conversations around ${niche} cluster on practical how-tos, before/after proof, pricing clarity, and peer recommendations. Brands that publish specific answers and case detail earn more share of voice than generic slogans.`
    ),
    socialMentionKeywords: strList(t.socialMentionKeywords, 10).length
      ? strList(t.socialMentionKeywords, 10)
      : [
          niche.split(/[&,]/)[0]?.trim() || "services",
          "how it works",
          "pricing",
          "reviews",
          "alternatives",
          "near me",
        ],
    competitorSocialInsights: str(
      t.competitorSocialInsights,
      competitors.length
        ? `Peers such as ${competitors
            .slice(0, 4)
            .map((c) => c.domain)
            .join(
              ", "
            )} win attention with educational threads, comparison posts, and proof snippets. Counter with original data, process transparency, and answer-first posts tied back to your service pages.`
        : `Competitors lean on educational content and social proof. Match frequency only where it supports SEO pillars; prioritize distinctive proof over volume posting.`
    ),
    marketResearch,
  };
}

export function normalizeLocalLocation(
  raw: unknown,
  opts: { domain?: string; niche?: string; brand?: string } = {}
): LocalLocation {
  const l = (raw && typeof raw === "object" ? raw : {}) as RawLocalLocationData;
  const domain = str(opts.domain, "example.com");
  const brand = str(opts.brand, domain.split(".")[0] || "Brand");
  const niche = str(opts.niche, "local services");
 const city = str(l.city, KOLKATA_CITY);
 const state = str(l.state, "");
 const country = str(l.country, "India");
  const primaryService = niche.split(/[&,|·]/)[0]?.trim() || "services";

  const localCompetitors: LocalCompetitor[] = Array.isArray(l.localCompetitors)
    ? l.localCompetitors.slice(0, 8).map((c, i) => {
        const lc = (c && typeof c === "object" ? c : {}) as RawLocalCompetitorData;
        return {
          name: str(lc.name, `${city} ${primaryService} #${i + 1}`),
          domain: str(lc.domain, `local-competitor-${i + 1}.com`),
          address: str(lc.address, `${city}${state ? `, ${state}` : ""}`),
          distance: str(lc.distance, `${(i + 1) * 1.1} mi`),
          phone: str(lc.phone, ""),
          rating: Math.min(5, Math.max(1, num(lc.rating, 4.2))),
          reviewCount: Math.max(0, Math.round(num(lc.reviewCount, 40 + i * 20))),
          localRank: Math.max(1, Math.round(num(lc.localRank, i + 2))),
          services: strList(lc.services, 4).length
            ? strList(lc.services, 4)
            : [primaryService],
          domainRating: Math.max(1, Math.min(100, Math.round(num(lc.domainRating, 35 + i * 3)))),
          estimatedMonthlyTraffic: Math.max(100, Math.round(num(lc.estimatedMonthlyTraffic, 1200 + i * 400))),
          googleMapsUrl: str(
            lc.googleMapsUrl,
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(primaryService + " " + city)}`
          ),
        };
      })
    : [];

  const primaryLocalCompetitors = Array.isArray(l.primaryLocalCompetitors)
    ? l.primaryLocalCompetitors.slice(0, 5).map((c, i) => {
        const pc = (c && typeof c === "object" ? c : {}) as RawPrimaryLocalCompetitorData;
        return {
          name: str(pc.name, localCompetitors[i]?.name || `Local peer ${i + 1}`),
          domain: str(pc.domain, localCompetitors[i]?.domain || `peer${i + 1}.com`),
          localRank: Math.max(1, Math.round(num(pc.localRank, i + 2))),
          mapDistance: str(pc.mapDistance || pc.distance, `${i + 1}.2 mi`),
        };
      })
    : localCompetitors.slice(0, 3).map((c) => ({
        name: c.name,
        domain: c.domain,
        localRank: c.localRank,
        mapDistance: c.distance,
      }));

  const localKeywordOpportunities = Array.isArray(l.localKeywordOpportunities)
    ? l.localKeywordOpportunities.slice(0, 12).map((k) => {
        const lk = (k && typeof k === "object" ? k : {}) as RawLocalKeywordData;
        return {
          keyword: str(lk.keyword, `${primaryService} near me`),
          searchVolume: Math.max(10, Math.round(num(lk.searchVolume, 200))),
          intent: str(lk.intent, "Transactional"),
        };
      })
    : [
        { keyword: `${primaryService} near me`, searchVolume: 720, intent: "Transactional" },
        { keyword: `${primaryService} in ${city}`, searchVolume: 540, intent: "Commercial" },
        { keyword: `best ${primaryService} ${city}`, searchVolume: 310, intent: "Commercial" },
      ];

  const rbIn = (l.rankingBlueprint && typeof l.rankingBlueprint === "object" ? l.rankingBlueprint : {}) as Record<string, unknown>;
  const rankingBlueprint: RankingBlueprint = {
    currentPosition: str(rbIn.currentPosition, "Not consistently in local pack"),
    targetPosition: str(
      rbIn.targetPosition,
      `Top 3 Map Pack for ${primaryService} near me / in ${city}`
    ),
    summary: str(
      rbIn.summary,
      `${brand} in ${city}: prioritize GBP, NAP consistency, reviews, and geo landing pages for high-intent local traffic.`
    ),
    technicalSeo: strList(rbIn.technicalSeo, 6).length
      ? strList(rbIn.technicalSeo, 6)
      : ["LocalBusiness JSON-LD", "Mobile-fast contact page", "Unique geo title/meta"],
    localSeo: strList(rbIn.localSeo, 6).length
      ? strList(rbIn.localSeo, 6)
      : [
          `Verify Google Business Profile for ${city}`,
          "Identical NAP across citations",
          "Review response cadence <48h",
        ],
    contentStrategy: strList(rbIn.contentStrategy, 6).length
      ? strList(rbIn.contentStrategy, 6)
      : [`${primaryService} in ${city} pillar`, "Near-me FAQ cluster", "Local comparison pages"],
    linkBuilding: strList(rbIn.linkBuilding, 6).length
      ? strList(rbIn.linkBuilding, 6)
      : ["Local directories", "Chamber / community pages", "Partner local businesses"],
    timelineEstimate: str(rbIn.timelineEstimate, "6–12 weeks for Map Pack gains"),
    priorityActions: Array.isArray(rbIn.priorityActions)
      ? rbIn.priorityActions.slice(0, 8).map((a) => {
          const act = (a && typeof a === "object" ? a : {}) as RawPriorityActionData;
          return {
            action: str(act.action, "Improve local signals"),
            impact: (["High", "Medium", "Low"].includes(str(act.impact))
              ? str(act.impact)
              : "High") as "High" | "Medium" | "Low",
            effort: (["High", "Medium", "Low"].includes(str(act.effort))
              ? str(act.effort)
              : "Medium") as "High" | "Medium" | "Low",
            timeframe: str(act.timeframe, "2–4 weeks"),
          };
        })
      : [
          {
            action: `Optimize GBP for ${primaryService} in ${city}`,
            impact: "High" as const,
            effort: "Low" as const,
            timeframe: "1 week",
          },
        ],
    localKeywordsToTarget: Array.isArray(rbIn.localKeywordsToTarget)
      ? rbIn.localKeywordsToTarget.slice(0, 8).map((k) => {
          const lk = (k && typeof k === "object" ? k : {}) as RawLocalKeywordData;
          return {
            keyword: str(lk.keyword, `${primaryService} near me`),
            searchVolume: Math.max(10, Math.round(num(lk.searchVolume, 200))),
            currentRank: str((lk as Record<string, unknown>).currentRank, "Not ranking / untracked"),
          };
        })
      : localKeywordOpportunities.slice(0, 5).map((k) => ({
          keyword: k.keyword,
          searchVolume: k.searchVolume,
          currentRank: "Not ranking / untracked",
        })),
  };

  return {
    detectedAddress: str(l.detectedAddress, `${city}${state ? `, ${state}` : ""}, ${country}`),
    city,
    state,
    country,
    confidenceScore: Math.max(1, Math.min(100, Math.round(num(l.confidenceScore, 55)))),
    googleMapPackScore: Math.max(1, Math.min(100, Math.round(num(l.googleMapPackScore, 52)))),
    citationConsistency: Math.max(1, Math.min(100, Math.round(num(l.citationConsistency, 58)))),
    serviceAreas: strList(l.serviceAreas, 8).length ? strList(l.serviceAreas, 8) : [city],
    primaryLocalCompetitors,
    localCompetitors,
    rankingBlueprint,
    localKeywordOpportunities,
    localOptimizationsNeeded: strList(l.localOptimizationsNeeded, 8).length
      ? strList(l.localOptimizationsNeeded, 8)
      : [
          "Publish full NAP on contact page",
          `Geo page: ${primaryService} in ${city}`,
          "Embed Google Map + LocalBusiness schema",
        ],
    localSeoVerdict: str(
      l.localSeoVerdict,
      `${brand} can capture more high-intent local traffic in ${city} with GBP optimization, geo-modified keywords, and location-specific content.`
    ),
  };
}

/** Full AnalysisResult normalizer — use on every successful /api/analyze response. */
export function normalizeAnalysisResult(raw: unknown, fallbackTarget = "example.com"): AnalysisResult {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const sanitized = sanitizeDeep(data) as Record<string, unknown>;

  const target = normalizeDomainMetrics(sanitized.target, fallbackTarget);
  const competitor =
    sanitized.competitor && typeof sanitized.competitor === "object"
      ? normalizeDomainMetrics(sanitized.competitor, str((sanitized.competitor as Record<string, unknown>).domain, "competitor.com"))
      : null;

  const siteProfile = (sanitized.siteProfile && typeof sanitized.siteProfile === "object"
    ? sanitized.siteProfile
    : {}) as Record<string, unknown>;
  const targetAnalysisRaw = (sanitized.targetAnalysis && typeof sanitized.targetAnalysis === "object"
    ? sanitized.targetAnalysis
    : {}) as Record<string, unknown>;

  const brandHint =
    str(siteProfile.brand, "") ||
    str(targetAnalysisRaw.coreNiche, "").split(" ")[0] ||
    target.domain.split(".")[0] ||
    "Brand";
  const nicheHint = str(
    targetAnalysisRaw.coreNiche || siteProfile.niche,
    "business services"
  );

  const discoveredCompetitors = normalizeDiscoveredCompetitors(
    sanitized.discoveredCompetitors,
    nicheHint,
    brandHint
  );

  const targetAnalysis = normalizeTargetAnalysis(sanitized.targetAnalysis, {
    domain: target.domain,
    niche: nicheHint,
    brand: brandHint,
    competitors: discoveredCompetitors,
  });

  const marketResearch =
    normalizeMarketResearch(sanitized.marketResearch || targetAnalysis.marketResearch, {
      niche: nicheHint,
      brand: brandHint,
      domain: target.domain,
      strengths: targetAnalysis.contentStrengths,
      weaknesses: targetAnalysis.contentWeaknesses,
      competitors: discoveredCompetitors,
    });
  targetAnalysis.marketResearch = marketResearch;

  const localLocationRaw = (sanitized.localLocation && typeof sanitized.localLocation === "object"
    ? sanitized.localLocation
    : {}) as Record<string, unknown>;

  return {
    ...sanitized,
    target,
    competitor,
    keywords: normalizeKeywords(sanitized.keywords).slice(0, 15),
    contentGaps: normalizeContentGaps(sanitized.contentGaps, {
      city: str(localLocationRaw.city, KOLKATA_CITY),
      brand: brandHint,
    }),
    serpFeatures: normalizeSerpFeatures(sanitized.serpFeatures),
    backlinkSources: normalizeBacklinkSources(sanitized.backlinkSources, target.domain),
    backlinkOpportunities: normalizeBacklinkOpportunities(sanitized.backlinkOpportunities),
    discoveredCompetitors,
    targetAnalysis,
    marketResearch,
    autonomousBlog: sanitized.autonomousBlog,
    localLocation: normalizeLocalLocation(sanitized.localLocation, {
      domain: target.domain,
      niche: nicheHint,
      brand: brandHint,
    }),
    rankingBlueprint: sanitized.rankingBlueprint || localLocationRaw.rankingBlueprint,
    dataSource: str(sanitized.dataSource, "simulated"),
    estimatedCost: sanitized.estimatedCost as AnalysisResult["estimatedCost"],
    pageSpeed: sanitized.pageSpeed,
  } as AnalysisResult;
}
