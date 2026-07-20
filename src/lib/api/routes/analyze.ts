// src/lib/api/routes/analyze.ts
import type { Request, Response } from "express";
import {
  withTimeout,
  fetchSerp,
  fetchDomainOverview,
  fetchBacklinks,
  fetchPageSpeed,
  fetchKeywordVolumes,
  mapCompetitionToDifficulty,
  monthlyToTrend,
  generateFallbackData,
  resolveDomain,
  getProviderConfig,
  humanizeProviderError,
  HAS_DFSEO,
  dfseoAuthHeaders
} from "../shared";
import { sanitizeDeep } from "../../../lib/text";
import type { DataForSeoBundle, DfsCredentials, ProviderConfig } from "../../../types";

// Helper function to normalize content gaps (placeholder, we'll implement a simple version)
function normalizeContentGaps(gaps: any[]): any[] {
  // In the original code, this function might do more, but for now we'll just return the array.
  return gaps;
}

// Handler for the /api/analyze endpoint
export const analyzeHandler = async (req: Request, res: Response) => {
  const domain = resolveDomain(req.body);
  const competitorUrl = req.body?.competitorUrl as string | undefined;
  if (!domain || domain === "target-website.com") {
    return res.status(400).json({ error: "Target URL is required." });
  }

  let base: any;
  try {
    // Fast path: always build structured baseline immediately (no network AI)
    base = await generateFallbackData(domain, competitorUrl);
  } catch (bootErr: unknown) {
    console.error("Baseline generation failed:", bootErr);
    return res.status(500).json({
      error: "Failed to build analysis baseline",
      isFallback: true,
      fallbackReason: "Internal baseline error. Please retry.",
    });
  }

  try {
    // --- analysis body (dfseo + AI) ---

    // DataForSEO real data enrichment (BYOK from user or server-side env)
    let dfseoData: DataForSeoBundle | null = null;
    const aiCfg = req.body.aiConfig as { dataforseoLogin?: string; dataforseoPassword?: string; locationCode?: number; languageCode?: string } | undefined;
    const byokCreds: DfsCredentials | undefined =
      aiCfg?.dataforseoLogin && aiCfg?.dataforseoPassword
        ? { login: aiCfg.dataforseoLogin, password: aiCfg.dataforseoPassword }
        : undefined;
    const hasDfsCreds = Boolean(byokCreds || HAS_DFSEO);
    if (hasDfsCreds) {
      try {
        const seedKws = (base.keywords ?? []).slice(0, 12).map((k: { keyword: string }) => k.keyword);
        if (seedKws.length === 0) seedKws.push(domain.split(".")[0].replace(/-/g, " "));
        const bundle = await withTimeout(
          fetchFullBundle(domain, seedKws, {
            credentials: byokCreds,
            locationCode: aiCfg?.locationCode,
            languageCode: aiCfg?.languageCode,
          }),
          45000,
          "DataForSEO bundle"
        );
        // Only treat as live if at least one channel returned real data
        const hasLiveSignal =
          (bundle.keywordLandscape?.length ?? 0) > 0 ||
          (bundle.serp?.organic?.length ?? 0) > 0 ||
          (bundle.backlinks?.total_backlinks ?? 0) > 0 ||
          (bundle.backlinks?.referring_domains ?? 0) > 0 ||
          Boolean(bundle.pageSpeed);
        if (hasLiveSignal) {
          dfseoData = bundle;
          console.log(
            `[DataForSEO] Live data for ${domain}: ${dfseoData.serp?.organic?.length ?? 0} SERP, ${dfseoData.keywordLandscape?.length ?? 0} keywords, ${dfseoData.backlinks?.total_backlinks ?? 0} backlinks`
          );
        } else {
          console.debug("[DataForSEO] Bundle returned empty for", domain, "-- using AI/crawl path");
          dfseoData = null;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[DataForSEO] Bundle fetch failed, falling back to AI/simulated data:", msg);
        dfseoData = null;
        if (/401|not authorized|unauthorized/i.test(msg)) {
          (req as any).__dfsAuthFailed = true;
        }
      }
    }
    const dfsAuthFailed = Boolean((req as any).__dfsAuthFailed);
    const dfsAuthHint = dfsAuthFailed
      ? " DataForSEO rejected your login/password (401). In Settings, paste the API password from app.dataforseo.com/api-access (not your account password)."
      : "";

    const providerConfig = getProviderConfig(req);
    const requireAi = Boolean(req.body?.requireAi);

    // No AI key AND no DataForSEO => demo fallback (blocked when client requires live AI)
    if (!providerConfig && !dfseoData) {
      return res.status(requireAi ? 401 : 200).json(
        sanitizeDeep({
          ...base,
          contentGaps: normalizeContentGaps(base.contentGaps),
          isFallback: true,
          needsApiKey: true,
          dataSource: "simulated",
          dfsAuthFailed: dfsAuthFailed || undefined,
          fallbackReason:
            "Live analysis requires your AI API key. Open Settings, add OpenRouter or Gemini, Save, then run analysis again." +
            dfsAuthHint,
        })
      );
    }

    if (requireAi && !providerConfig) {
      return res.status(401).json({
        error: "API key required",
        needsApiKey: true,
        isFallback: true,
        dfsAuthFailed: dfsAuthFailed || undefined,
        fallbackReason:
          "Add your AI API key in Settings to run real-time analysis and blog generation." + dfsAuthHint,
      });
    }

    // --- DataForSEO available (with or without AI key) ---
    if (dfseoData) {
      // Merge live volumes INTO baseline keywords so parentTopic / journey / pillar
      // fields stay intact for Topic Clusters & Keyword Map UI.
      const baseKeywords: any[] = Array.isArray(base.keywords) ? base.keywords : [];
      const liveByKw = new Map<string, any>(
        (dfseoData.keywordLandscape || []).map((kw) => [String(kw.keyword || "").toLowerCase(), kw])
      );
      const trendDirection = (vols: number[]): "rising" | "stable" | "declining" => {
        if (!Array.isArray(vols) || vols.length < 3) return "stable";
        const recent = vols.slice(-3).reduce((a, b) => a + b, 0) / 3;
        const older = vols.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        if (older <= 0) return recent > 0 ? "rising" : "stable";
        if (recent > older * 1.15) return "rising";
        if (recent < older * 0.85) return "declining";
        return "stable";
      };
      const wordType = (kw: string): "Short-tail" | "Long-tail" | "Question" => {
        if (/\?|how |what |why |when |where |which |who /i.test(kw)) return "Question";
        return kw.trim().split(/\s+/).length > 2 ? "Long-tail" : "Short-tail";
      };
      const intentFromKw = (kw: string, volume: number): string => {
        if (/\b(buy|price|cost|near me|book|hire|order)\b/i.test(kw)) return "Transactional";
        if (/\b(best|vs|review|compare|top)\b/i.test(kw)) return "Commercial";
        if (volume > 5000 && kw.split(/\s+/).length <= 2) return "Navigational";
        return "Informational";
      };
      const journeyFromIntent = (intent: string, i: number): string => {
        if (intent === "Transactional") return "Decision";
        if (intent === "Commercial") return "Consideration";
        return i < 3 ? "Awareness" : i < 7 ? "Consideration" : "Decision";
      };

      let mergedKeywords = baseKeywords.map((bk, i) => {
        const key = String(bk?.keyword || "").toLowerCase();
        const live = liveByKw.get(key);
        if (!live) return bk;
        liveByKw.delete(key);
        const vols = Array.isArray(live.trend) ? live.trend : [];
        return {
          ...bk,
          volume: live.volume || bk.volume,
          difficulty: live.difficulty ?? bk.difficulty,
          cpc: live.cpc ?? bk.cpc,
          trend: trendDirection(vols),
          opportunityScore:
            live.opportunity === "high"
              ? Math.max(Number(bk.opportunityScore) || 0, 85)
              : live.opportunity === "low"
                ? Math.min(Number(bk.opportunityScore) || 50, 45)
                : bk.opportunityScore ?? 62,
          parentTopic: bk.parentTopic || String(bk.keyword || "").split(/\s+/)[0] || "General",
          isPillarOpportunity: Boolean(bk.isPillarOpportunity ?? i < 3),
          buyerJourneyStage: bk.buyerJourneyStage || journeyFromIntent(String(bk.intent || "Informational"), i),
        };
      });
      // Append any live-only keywords (still full UI shape for clusters)
      let extraIdx = mergedKeywords.length;
      for (const live of liveByKw.values()) {
        const kw = live.keyword;
        if (!kw) continue;
        const vols = Array.isArray(live.trend) ? live.trend : [];
        mergedKeywords.push({
          keyword: kw,
          volume: live.volume,
          difficulty: live.difficulty,
          cpc: live.cpc,
          trend: trendDirection(vols),
          opportunityScore:
            live.opportunity === "high"
              ? 85
              : live.opportunity === "low"
                ? 45
                : 62,
          parentTopic: kw.split(/\s+/)[0] || "General",
          isPillarOpportunity: false,
          buyerJourneyStage: journeyFromIntent(String(live.intent || "Informational"), extraIdx),
        });
        extraIdx++;
      }

      // Merge ALL live DFS data into response
      const primaryKeyword = mergedKeywords[0]?.keyword || base.keywords?.[0]?.keyword || domain.replace(/\.(com|in|org|net)$/i, "").replace(/-/g, " ");
      const result: any = {
        ...base,
        keywords: mergedKeywords,
        dataSource: "live",
        isFallback: false,
      };

      // Merge live SERP data
      if (dfseoData.serp?.organic?.length) {
        result.serp = dfseoData.serp;
        result.organicResults = dfseoData.serp.organic;
        result.featuredSnippet = dfseoData.serp.featured_snippet || result.featuredSnippet;
        result.localPack = dfseoData.serp.local_pack || result.localPack;
      }

      // Merge live backlinks data
      if (dfseoData.backlinks) {
        result.backlinks = dfseoData.backlinks;
        result.backlinkProfile = {
          totalBacklinks: dfseoData.backlinks.total_backlinks ?? result.backlinkProfile?.totalBacklinks ?? 0,
          referringDomains: dfseoData.backlinks.referring_domains ?? result.backlinkProfile?.referringDomains ?? 0,
          domainRating: dfseoData.backlinks.domain_rating ?? result.backlinkProfile?.domainRating,
        };
      }

      // Merge live page speed data
      if (dfseoData.pageSpeed) {
        result.pageSpeed = dfseoData.pageSpeed;
        result.performanceScore = dfseoData.pageSpeed.performance ?? result.performanceScore;
      }

      // Merge live SERP features from organic results
      if (dfseoData.serp?.organic?.length) {
        const liveFeatures: any[] = [];
        if (dfseoData.serp.featured_snippet) {
          liveFeatures.push({ type: "Featured Snippet", query: primaryKeyword, opportunity: "Claim featured snippet with structured content", actionability: "High" });
        }
        if (dfseoData.serp.local_pack?.length) {
          liveFeatures.push({ type: "Local Pack", query: primaryKeyword, opportunity: "Optimize GBP to appear in local pack", actionability: "High" });
        }
        if (dfseoData.serp.people_also_ask?.length) {
          liveFeatures.push({ type: "People Also Ask", query: primaryKeyword, opportunity: "Create FAQ content targeting PAA questions", actionability: "Medium" });
        }
        result.serpFeatures = [...(result.serpFeatures || []), ...liveFeatures];
      }

      // Merge discovered competitors from live SERP
      if (dfseoData.serp?.organic?.length) {
        const liveCompetitors = dfseoData.serp.organic
          .filter((r: any) => r.url && !r.url.includes(domain))
          .slice(0, 5)
          .map((r: any) => ({
            domain: r.url?.split("/")[2] || r.domain || "unknown",
            nicheFocus: r.title?.substring(0, 60) || "Competitor",
            analyzedTakeaway: `Ranks #${r.position ?? "?"} for "${primaryKeyword}" — ${r.snippet?.substring(0, 80) || "no snippet available"}`,
          }));
        if (liveCompetitors.length) {
          result.discoveredCompetitors = [...(result.discoveredCompetitors || []), ...liveCompetitors];
        }
      }

      return res.status(200).json(sanitizeDeep(result));
    }

    // AI key available but no DataForSEO data — return crawl-based baseline
    return res.status(200).json(
      sanitizeDeep({
        ...base,
        contentGaps: normalizeContentGaps(base.contentGaps),
        dataSource: base.dataSource || "crawl",
        isFallback: false,
        dfsAuthFailed: dfsAuthFailed || undefined,
        dfsAuthHint: dfsAuthHint || undefined,
      })
    );
  } catch (err) {
    const humanMsg = humanizeProviderError(err);
    console.error("Analysis failed:", err);
    return res.status(500).json({ error: humanMsg });
  }
};

// We need to define fetchFullBundle here, using the shared fetch* functions.
async function fetchFullBundle(
  domain: string,
  seedKeywords: string[],
  options?: { credentials?: DfsCredentials; locationCode?: number; languageCode?: string }
): Promise<DataForSeoBundle> {
  const creds = options?.credentials;
  const parsedLoc = Number(options?.locationCode);
  // DataForSEO requires a valid numeric location code; a missing/NaN/string value
  // would fail the live call and silently fall back to simulated data.
  const loc = Number.isFinite(parsedLoc) && parsedLoc > 0 ? parsedLoc : 1007810;
  const lang = options?.languageCode ?? "en";
  const primaryKeyword =
    seedKeywords[0] ?? domain.replace(/\.(com|in|org|net|co\.in|co\.uk|io|ai)$/i, "").replace(/-/g, " ");
  const seeds = seedKeywords.filter(Boolean).slice(0, 20);
  if (!seeds.length) seeds.push(primaryKeyword);

  const failedEndpoints: string[] = [];
  const [serpItems, domainOverview, backlinks, pageSpeedResult, keywordData] = await Promise.all([
    fetchSerp(primaryKeyword, loc, lang, creds).catch((e) => {
      failedEndpoints.push("SERP");
      return [] as any[];
    }),
    fetchDomainOverview(domain, loc, lang, creds).catch((e) => {
      failedEndpoints.push("DomainOverview");
      return {} as any;
    }),
    fetchBacklinks(domain, 100, loc, lang, creds).catch((e) => {
      failedEndpoints.push("Backlinks");
      return [] as any[];
    }),
    fetchPageSpeed(`https://${domain}`, creds).catch((e) => {
      failedEndpoints.push("Lighthouse");
      return undefined;
    }),
    // Single batch request for all seed keywords (cheaper + correct API shape)
    fetchKeywordVolumes(seeds, loc, lang, creds).catch((e) => {
      failedEndpoints.push("KeywordVolumes");
      return [] as any[];
    }),
  ]);
  if (failedEndpoints.length > 0) {
    console.warn(`[DataForSEO] ${failedEndpoints.length}/5 endpoints failed (${failedEndpoints.join(", ")}); continuing with partial data`);
  }

  const allKeywordData: any[] = (keywordData || []).filter((k) => k && k.keyword);
  const organic = (serpItems || [])
    .filter((r) => r.rank_group !== undefined || r.rank_absolute !== undefined)
    .map((r) => ({
      position: r.rank_group ?? r.rank_absolute ?? 0,
      title: r.title ?? "",
      url: r.url ?? "",
      snippet: r.snippet ?? r.description ?? "",
      domain: r.domain ?? "",
    }));
  const keywordLandscape = allKeywordData.map((kd) => {
    const difficulty = mapCompetitionToDifficulty(kd.competition, kd.competition_index);
    const volume = kd.search_volume ?? 0;
    const trend = kd.trend?.length ? kd.trend : monthlyToTrend(kd.monthly_searches);
    return {
      keyword: kd.keyword,
      volume,
      difficulty,
      cpc: kd.cpc ?? 0,
      trend,
      opportunity: (volume > 100 && difficulty < 50
        ? "high"
        : volume > 50
          ? "medium"
          : "low") as "high" | "medium" | "low",
    };
  });
  const cats = pageSpeedResult?.categories ?? {};
  const domainRating = Math.max(
    0,
    Math.min(100, Math.round(domainOverview.rank ?? domainOverview.domain_rank ?? 0))
  );
  return {
    serp: {
      organic,
      featured_snippet: organic[0]?.title,
      local_pack: [],
      people_also_ask: [],
      related_searches: [],
    },
    keywordLandscape,
    backlinks: {
      total_backlinks: domainOverview.backlinks ?? 0,
      referring_domains: domainOverview.referring_domains ?? 0,
      domain_rating: domainRating,
      dofollow_ratio: domainOverview.dofollow
        ? domainOverview.dofollow / (domainOverview.backlinks || 1)
        : 0.7,
      link_growth: domainOverview.referring_domains_change ?? 0,
      top_referring_domains: (backlinks || []).slice(0, 20).map((b) => ({
        source_url: b.url_from || b.referring_url || "",
        source_domain: b.domain_from || b.referring_domain || "",
        anchor: b.anchor ?? "",
        domain_rating: Math.max(0, Math.min(100, Math.round(b.domain_from_rank ?? b.rank ?? b.domain_rank ?? 0))),
        first_seen: b.first_seen ?? "",
      })),
    },
    pageSpeed: pageSpeedResult
      ? {
          performance: Math.round((pageSpeedResult.categories?.performance?.score ?? 0) * 100),
          accessibility: Math.round((pageSpeedResult.categories?.accessibility?.score ?? 0) * 100),
          best_practices: Math.round((pageSpeedResult.categories?.["best-practices"]?.score ?? 0) * 100),
          seo: Math.round((pageSpeedResult.categories?.seo?.score ?? 0) * 100),
        }
      : null,
  };
};

// Export the handler
export default analyzeHandler;