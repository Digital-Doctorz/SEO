/**
 * Canonical normalizer for /api/analyze payloads.
 * Single place so every UI tab gets a stable shape — no partial AI objects.
 */
import type {
  AnalysisResult,
  BacklinkOpportunity,
  BacklinkSource,
  ContentGap,
  DomainMetrics,
  Keyword,
  PageMetric,
  SerpFeature,
} from "../types";
import { sanitizeDeep } from "./text";

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  const s = String(v).trim();
  return s || fallback;
}

function normalizePage(p: any, domain: string, i: number): PageMetric {
  return {
    url: str(p?.url, `https://${domain}/page-${i + 1}`),
    title: str(p?.title, `Page ${i + 1}`),
    estTraffic: Math.max(0, Math.round(num(p?.estTraffic, 100))),
    keywordsCount: Math.max(0, Math.round(num(p?.keywordsCount, 5))),
  };
}

export function normalizeDomainMetrics(
  raw: any,
  fallbackDomain = "example.com"
): DomainMetrics {
  const domain = str(raw?.domain, fallbackDomain).replace(/^www\./, "");
  const topPages = Array.isArray(raw?.topPages)
    ? raw.topPages.map((p: any, i: number) => normalizePage(p, domain, i))
    : [];
  return {
    domain,
    domainRating: Math.max(0, Math.min(100, Math.round(num(raw?.domainRating, 40)))),
    backlinksCount: Math.max(0, Math.round(num(raw?.backlinksCount, 0))),
    referringDomains: Math.max(0, Math.round(num(raw?.referringDomains, 0))),
    organicTraffic: Math.max(0, Math.round(num(raw?.organicTraffic, 0))),
    organicKeywords: Math.max(0, Math.round(num(raw?.organicKeywords, 0))),
    publishingFrequency: str(raw?.publishingFrequency, "1-2 articles / week"),
    topPages,
  };
}

export function normalizeKeywords(raw: unknown): Keyword[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((k: any, i: number): Keyword | null => {
      const keyword = str(k?.keyword, "");
      if (!keyword) return null;
      const difficulty = Math.max(0, Math.min(100, Math.round(num(k?.difficulty, 40))));
      const volume = Math.max(0, Math.round(num(k?.volume, 100)));
      const intentRaw = str(k?.intent, "Informational");
      const intent = (
        ["Commercial", "Informational", "Transactional", "Navigational"].includes(intentRaw)
          ? intentRaw
          : "Informational"
      ) as Keyword["intent"];
      const typeRaw = str(k?.type, keyword.includes("?") ? "Question" : keyword.split(/\s+/).length > 2 ? "Long-tail" : "Short-tail");
      const type = (
        ["Short-tail", "Long-tail", "Question"].includes(typeRaw) ? typeRaw : "Long-tail"
      ) as Keyword["type"];
      const competitionRaw = str(k?.competition, difficulty < 30 ? "Low" : difficulty < 60 ? "Medium" : "High");
      const competition = (
        ["Low", "Medium", "High"].includes(competitionRaw) ? competitionRaw : "Medium"
      ) as Keyword["competition"];
      const trendRaw = str(k?.trend, "stable");
      const trend = (
        ["rising", "stable", "declining"].includes(trendRaw) ? trendRaw : "stable"
      ) as Keyword["trend"];
      const stageRaw = str(k?.buyerJourneyStage, i < 2 ? "Awareness" : i < 4 ? "Consideration" : "Decision");
      const buyerJourneyStage = (
        ["Awareness", "Consideration", "Decision"].includes(stageRaw) ? stageRaw : "Awareness"
      ) as Keyword["buyerJourneyStage"];

      return {
        keyword,
        volume,
        difficulty,
        cpc: Math.max(0, num(k?.cpc, 1.2)),
        intent,
        type,
        competition,
        trend,
        serpRankings: Array.isArray(k?.serpRankings)
          ? k.serpRankings.map((r: any, ri: number) => ({
              rank: Math.max(1, Math.round(num(r?.rank, ri + 1))),
              title: str(r?.title, keyword),
              url: str(r?.url, "https://example.com"),
            }))
          : [],
        relatedKeywords: Array.isArray(k?.relatedKeywords)
          ? k.relatedKeywords.map((x: unknown) => str(x)).filter(Boolean)
          : [],
        parentTopic: str(k?.parentTopic, keyword.split(/\s+/)[0] || "General"),
        buyerJourneyStage,
        opportunityScore: Math.max(0, Math.min(100, Math.round(num(k?.opportunityScore, 70 - i * 5)))),
        isPillarOpportunity: Boolean(k?.isPillarOpportunity ?? i < 3),
      };
    })
    .filter((k): k is Keyword => k != null);
}

export function normalizeContentGaps(raw: unknown): ContentGap[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((g: any, i: number): ContentGap | null => {
      const competitorKeyword = str(g?.competitorKeyword || g?.keyword || g?.query, "");
      if (!competitorKeyword) return null;
      const difficulty = Math.max(
        1,
        Math.min(100, Math.round(num(g?.competitorDifficulty ?? g?.difficulty, 30)))
      );
      let difficultyCategory = str(g?.difficultyCategory, "") as ContentGap["difficultyCategory"];
      if (difficultyCategory !== "Easy" && difficultyCategory !== "Medium" && difficultyCategory !== "Hard") {
        difficultyCategory = difficulty < 30 ? "Easy" : difficulty < 55 ? "Medium" : "Hard";
      }
      let targetRank: number | "Not Ranking" = "Not Ranking";
      if (g?.targetRank === "Not Ranking" || String(g?.targetRank).toLowerCase() === "unranked") {
        targetRank = "Not Ranking";
      } else if (g?.targetRank != null && g?.targetRank !== "") {
        const tr = Number(g.targetRank);
        targetRank = Number.isFinite(tr) ? Math.round(tr) : "Not Ranking";
      }

      return {
        competitorKeyword,
        competitorRank: Math.max(1, Math.round(num(g?.competitorRank ?? g?.rank, 5))),
        competitorVolume: Math.max(0, Math.round(num(g?.competitorVolume ?? g?.volume, 500))),
        competitorDifficulty: difficulty,
        targetRank,
        recommendedTopic: str(
          g?.recommendedTopic || g?.topic,
          `Complete Guide to ${competitorKeyword}`
        ),
        recommendedType: str(g?.recommendedType || g?.contentType, "Pillar Blog Post"),
        difficultyCategory,
        isQuickWin: Boolean(g?.isQuickWin ?? g?.quickWin ?? difficulty < 35),
      };
    })
    .filter((g): g is ContentGap => g != null);
}

const SERP_TYPES = new Set(["Featured Snippet", "People Also Ask", "Video Carousel", "Local Pack"]);

export function normalizeSerpFeatures(raw: unknown): SerpFeature[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f: any): SerpFeature | null => {
      const type = str(f?.type, "Featured Snippet");
      if (!SERP_TYPES.has(type)) {
        // Drop organic SERP rows that are not feature opportunities
        return null;
      }
      const query = str(f?.query || f?.title, "");
      if (!query) return null;
      return {
        type: type as SerpFeature["type"],
        query,
        opportunity: str(f?.opportunity, "Optimize this SERP feature with clear answer blocks."),
        actionability: str(f?.actionability, "Add structured content and FAQ schema."),
      };
    })
    .filter((f): f is SerpFeature => f != null);
}

export function normalizeBacklinkSources(raw: unknown, domain = "example.com"): BacklinkSource[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b: any): BacklinkSource | null => {
      const sourceUrl = str(b?.sourceUrl || b?.url || b?.source_url, "");
      if (!sourceUrl && !b?.source_domain && !b?.domain) return null;
      return {
        sourceUrl: sourceUrl || `https://${str(b?.source_domain || b?.domain, "referrer.com")}/`,
        domainRating: Math.max(0, Math.min(100, Math.round(num(b?.domainRating ?? b?.dr ?? b?.domain_rating, 40)))),
        targetUrl: str(b?.targetUrl || b?.target_url, `https://${domain}/`),
        anchorText: str(b?.anchorText || b?.anchor || b?.anchor_text, domain),
        linkType: (str(b?.linkType, "Follow") === "Nofollow" ? "Nofollow" : "Follow") as "Follow" | "Nofollow",
      };
    })
    .filter((b): b is BacklinkSource => b != null);
}

export function normalizeBacklinkOpportunities(raw: unknown): BacklinkOpportunity[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o: any): BacklinkOpportunity | null => {
      const typeRaw = str(o?.type, "Guest Posting");
      const type = (
        ["Guest Posting", "Unlinked Mention", "Broken Link"].includes(typeRaw)
          ? typeRaw
          : "Guest Posting"
      ) as BacklinkOpportunity["type"];
      const sourceDomain = str(o?.sourceDomain || o?.domain, "");
      if (!sourceDomain && !o?.opportunityUrl) return null;
      return {
        type,
        sourceDomain: sourceDomain || "opportunity.com",
        opportunityUrl: str(o?.opportunityUrl || o?.url, "https://example.com/write-for-us"),
        description: str(o?.description, "Link opportunity identified for outreach."),
        actionPlan: str(o?.actionPlan, "Draft outreach and pitch a resource replacement."),
      };
    })
    .filter((o): o is BacklinkOpportunity => o != null);
}

/** Full AnalysisResult normalizer — use on every successful /api/analyze response. */
export function normalizeAnalysisResult(raw: unknown, fallbackTarget = "example.com"): AnalysisResult {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const sanitized = sanitizeDeep(data) as Record<string, any>;

  const target = normalizeDomainMetrics(sanitized.target, fallbackTarget);
  const competitor =
    sanitized.competitor && typeof sanitized.competitor === "object"
      ? normalizeDomainMetrics(sanitized.competitor, str((sanitized.competitor as any).domain, "competitor.com"))
      : null;

  return {
    ...sanitized,
    target,
    competitor,
    keywords: normalizeKeywords(sanitized.keywords).slice(0, 15),
    contentGaps: normalizeContentGaps(sanitized.contentGaps),
    serpFeatures: normalizeSerpFeatures(sanitized.serpFeatures),
    backlinkSources: normalizeBacklinkSources(sanitized.backlinkSources, target.domain),
    backlinkOpportunities: normalizeBacklinkOpportunities(sanitized.backlinkOpportunities),
    discoveredCompetitors: Array.isArray(sanitized.discoveredCompetitors)
      ? sanitized.discoveredCompetitors.slice(0, 15)
      : [],
    targetAnalysis: sanitized.targetAnalysis,
    autonomousBlog: sanitized.autonomousBlog,
    localLocation: sanitized.localLocation,
    rankingBlueprint: sanitized.rankingBlueprint,
    dataSource: str(sanitized.dataSource, "simulated"),
    estimatedCost: sanitized.estimatedCost as AnalysisResult["estimatedCost"],
    pageSpeed: sanitized.pageSpeed,
  } as AnalysisResult;
}
