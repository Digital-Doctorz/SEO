/**
 * Canonical normalizer for /api/analyze payloads.
 * Single place so every UI tab gets a stable shape — no partial AI objects.
 */
import type {
  AnalysisResult,
  BacklinkOpportunity,
  BacklinkSource,
  ContentGap,
  DiscoveredCompetitor,
  DomainMetrics,
  Keyword,
  MarketResearchReport,
  PageMetric,
  SerpFeature,
  TargetAnalysis,
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
    .map((c: any, i: number): DiscoveredCompetitor | null => {
      const domain = str(c?.domain || c?.url || c?.host, "")
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/.*$/, "")
        .toLowerCase();
      if (!domain || domain.length < 3) return null;

      const sim = Math.max(
        1,
        Math.min(100, Math.round(num(c?.nicheSimilarity ?? c?.overlapScore ?? c?.similarity, 70 - (i % 20))))
      );
      const threatRaw = str(c?.threatLevel || c?.threat, sim >= 85 ? "High" : sim >= 70 ? "Medium" : "Low");
      const threatLevel = (
        ["High", "Medium", "Low"].includes(threatRaw) ? threatRaw : "Medium"
      ) as DiscoveredCompetitor["threatLevel"];

      const focus = str(c?.nicheFocus || c?.focus || c?.positioning, `Competitor in ${niche}`);
      const traffic = Math.max(
        100,
        Math.round(num(c?.estimatedMonthlyTraffic ?? c?.traffic ?? c?.organicTraffic, 8000 + i * 1500))
      );
      const takeaway = str(
        c?.analyzedTakeaway || c?.takeaway || c?.summary,
        `${domain} competes in ${niche}. Study their content clusters and outrank them with deeper FAQs, comparison pages, and clearer proof points for ${brand}.`
      );

      const kws = strList(c?.targetKeywords || c?.keywords, 8);
      if (kws.length < 2) {
        kws.push(`${niche.split(/[&,]/)[0]?.trim() || "services"} guide`, `best ${domain.split(".")[0]} alternative`);
      }

      return {
        domain,
        nicheSimilarity: sim,
        nicheFocus: focus,
        estimatedMonthlyTraffic: traffic,
        popularBlogUrl: str(c?.popularBlogUrl || c?.blogUrl, `https://${domain}/blog`),
        latestArticleTitle: str(
          c?.latestArticleTitle || c?.articleTitle,
          `How ${focus.split(",")[0]} teams are winning in 2026`
        ),
        latestArticleUrl: str(
          c?.latestArticleUrl || c?.articleUrl,
          `https://${domain}/blog/strategy-${i + 1}`
        ),
        analyzedTakeaway: takeaway,
        targetKeywords: kws.slice(0, 6),
        seoStrategy: str(
          c?.seoStrategy,
          "Topical authority clusters, commercial comparison pages, FAQ schema, and consistent internal linking from money pages."
        ),
        aiRankStrategy: str(
          c?.aiRankStrategy,
          "Answer-first H2s, entity-rich definitions, cited sources, and clear step lists so AI Overviews and chat engines can cite the page."
        ),
        schemaRecommendation: str(
          c?.schemaRecommendation,
          "Article + FAQPage + Organization (and Service/Product where relevant) JSON-LD on hub and service templates."
        ),
        threatLevel,
        domainRating: Math.max(1, Math.min(100, Math.round(num(c?.domainRating ?? c?.dr, 45 + ((sim / 2) | 0) - i)))),
        contentCadence: str(c?.contentCadence || c?.publishingFrequency, i % 2 === 0 ? "2–4 posts / week" : "1–2 posts / week"),
        strengths: strList(c?.strengths, 4).length
          ? strList(c?.strengths, 4)
          : ["Strong category presence", "Established content footprint", "Clear commercial intent coverage"],
        weaknesses: strList(c?.weaknesses, 4).length
          ? strList(c?.weaknesses, 4)
          : ["Generic long-tail depth", "Thin local/niche proof", "Weak comparison content"],
        contentAngles: strList(c?.contentAngles, 4).length
          ? strList(c?.contentAngles, 4)
          : ["How-to guides", "Comparison pages", "Use-case stories"],
        counterMove: str(
          c?.counterMove,
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
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const niche = str(opts.niche, "this market");
  const brand = str(opts.brand, "Your brand");
  const domain = str(opts.domain, "your site");
  const topComps = (opts.competitors || []).slice(0, 5).map((c) => c.domain);

  const intensityRaw = str(r.competitiveIntensity || r.intensity, topComps.length >= 8 ? "High" : "Moderate");
  const competitiveIntensity = (
    ["Low", "Moderate", "High", "Very High"].includes(intensityRaw) ? intensityRaw : "Moderate"
  ) as MarketResearchReport["competitiveIntensity"];

  const swotIn = r.swot && typeof r.swot === "object" ? r.swot : {};
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
        ? buyerIn.slice(0, 5).map((b: any, i: number) => ({
            segment: str(b?.segment || b?.name, `Segment ${i + 1}`),
            intent: str(b?.intent || b?.need, "Research and evaluate options"),
            priority: (["Primary", "Secondary", "Emerging"].includes(str(b?.priority))
              ? str(b?.priority)
              : i === 0
                ? "Primary"
                : i === 1
                  ? "Secondary"
                  : "Emerging") as "Primary" | "Secondary" | "Emerging",
          }))
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
        ? channelIn.slice(0, 6).map((ch: any) => ({
            channel: str(ch?.channel || ch?.name, "Organic search"),
            role: str(ch?.role || ch?.purpose, "Demand capture"),
            priority: (["High", "Medium", "Low"].includes(str(ch?.priority))
              ? str(ch?.priority)
              : "High") as "High" | "Medium" | "Low",
          }))
        : [
            { channel: "Organic search (SEO)", role: "Primary demand capture & trust", priority: "High" as const },
            { channel: "Content / blog clusters", role: "Topical authority & nurture", priority: "High" as const },
            { channel: "Comparison & alternatives pages", role: "Steal competitor demand", priority: "High" as const },
            { channel: "AI search / GEO", role: "Citations in ChatGPT, Perplexity, AI Overviews", priority: "Medium" as const },
            { channel: "Social proof & community", role: "Trust and distribution", priority: "Medium" as const },
          ],
    ninetyDayPlays:
      playsIn.length > 0
        ? playsIn.slice(0, 6).map((p: any) => ({
            play: str(p?.play || p?.action, "Publish a pillar + cluster set"),
            why: str(p?.why || p?.reason, "Closes a visible content gap"),
            effort: (["Low", "Medium", "High"].includes(str(p?.effort))
              ? str(p?.effort)
              : "Medium") as "Low" | "Medium" | "High",
          }))
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
      strengths: strList(swotIn.strengths, 5).length
        ? strList(swotIn.strengths, 5)
        : strList(opts.strengths, 5).length
          ? strList(opts.strengths, 5)
          : [`Live brand presence on ${domain}`, `On-niche focus in ${niche}`, "Room to own long-tail depth"],
      weaknesses: strList(swotIn.weaknesses, 5).length
        ? strList(swotIn.weaknesses, 5)
        : strList(opts.weaknesses, 5).length
          ? strList(opts.weaknesses, 5)
          : ["Incomplete long-tail coverage", "Fewer comparison assets than peers", "Limited SERP feature ownership"],
      opportunities: strList(swotIn.opportunities, 5).length
        ? strList(swotIn.opportunities, 5)
        : [
            "Content gap keywords with Easy/Medium difficulty",
            "AI Overview / GEO answer formatting",
            "Internal linking from services → education hubs",
          ],
      threats: strList(swotIn.threats, 5).length
        ? strList(swotIn.threats, 5)
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
  const t = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
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

/** Full AnalysisResult normalizer — use on every successful /api/analyze response. */
export function normalizeAnalysisResult(raw: unknown, fallbackTarget = "example.com"): AnalysisResult {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const sanitized = sanitizeDeep(data) as Record<string, any>;

  const target = normalizeDomainMetrics(sanitized.target, fallbackTarget);
  const competitor =
    sanitized.competitor && typeof sanitized.competitor === "object"
      ? normalizeDomainMetrics(sanitized.competitor, str((sanitized.competitor as any).domain, "competitor.com"))
      : null;

  const brandHint =
    str(sanitized?.siteProfile?.brand, "") ||
    str(sanitized?.targetAnalysis?.coreNiche, "").split(" ")[0] ||
    target.domain.split(".")[0] ||
    "Brand";
  const nicheHint = str(
    sanitized?.targetAnalysis?.coreNiche || sanitized?.siteProfile?.niche,
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

  return {
    ...sanitized,
    target,
    competitor,
    keywords: normalizeKeywords(sanitized.keywords).slice(0, 15),
    contentGaps: normalizeContentGaps(sanitized.contentGaps),
    serpFeatures: normalizeSerpFeatures(sanitized.serpFeatures),
    backlinkSources: normalizeBacklinkSources(sanitized.backlinkSources, target.domain),
    backlinkOpportunities: normalizeBacklinkOpportunities(sanitized.backlinkOpportunities),
    discoveredCompetitors,
    targetAnalysis,
    marketResearch,
    autonomousBlog: sanitized.autonomousBlog,
    localLocation: sanitized.localLocation,
    rankingBlueprint: sanitized.rankingBlueprint,
    dataSource: str(sanitized.dataSource, "simulated"),
    estimatedCost: sanitized.estimatedCost as AnalysisResult["estimatedCost"],
    pageSpeed: sanitized.pageSpeed,
  } as AnalysisResult;
}
