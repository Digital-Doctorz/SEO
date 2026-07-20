// src/lib/api/shared.ts
// Shared utilities for API routes

// Constants
export const HAS_DFSEO = Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);
export const DFSEO_BASE = "https://api.dataforseo.com/v3";

// Helper functions
export function withTimeout<T>(promise: Promise<T>, ms: number, label = "Request"): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

export function dfseoAuthHeaders(credentials?: { login: string; password: string }): Record<string, string> {
  const creds = credentials || { login: process.env.DATAFORSEO_LOGIN!, password: process.env.DATAFORSEO_PASSWORD! };
  return {
    "Content-Type": "application/json",
    Authorization: "Basic " + Buffer.from(creds.login + ":" + creds.password).toString("base64"),
  };
}

// DataForSEO fetch functions
export async function fetchSerp(
  keyword: string,
  locationCode: number,
  languageCode: string,
  credentials?: { login: string; password: string }
): Promise<any[]> {
  const endpoint = "/serp/google/organic/live/advanced";
  const payload = [
    {
      keyword,
      location_code: locationCode,
      language_code: languageCode,
      device: "desktop",
      os: "windows",
      depth: 10,
    },
  ];
  const resp = await fetch(DFSEO_BASE + endpoint, {
    method: "POST",
    headers: dfseoAuthHeaders(credentials),
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`DataForSEO ${endpoint} failed (${resp.status}): ${text}`);
  }
  const json = await resp.json();
  if (json.status_code && json.status_code !== 20000) {
    throw new Error(`DataForSEO error ${json.status_code}: ${json.status_message}`);
  }
  const task = json.tasks?.[0];
  if (task?.status_code && task.status_code !== 20000) {
    throw new Error(`DataForSEO task error ${task.status_code}: ${task.status_message || "unknown"}`);
  }
  return task?.result || [];
}

export async function fetchDomainOverview(
  target: string,
  _locationCode: number,
  _languageCode: string,
  credentials?: { login: string; password: string }
): Promise<any> {
  const endpoint = "/backlinks/summary/live";
  const payload = [{ target, include_subdomains: true, rank_scale: "one_hundred" }];
  const resp = await fetch(DFSEO_BASE + endpoint, {
    method: "POST",
    headers: dfseoAuthHeaders(credentials),
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`DataForSEO ${endpoint} failed (${resp.status}): ${text}`);
  }
  const json = await resp.json();
  if (json.status_code && json.status_code !== 20000) {
    throw new Error(`DataForSEO error ${json.status_code}: ${json.status_message}`);
  }
  const task = json.tasks?.[0];
  if (task?.status_code && task.status_code !== 20000) {
    throw new Error(`DataForSEO task error ${task.status_code}: ${task.status_message || "unknown"}`);
  }
  return task?.result?.[0] ?? {};
}

export async function fetchBacklinks(
  target: string,
  limit: number,
  _locationCode: number,
  _languageCode: string,
  credentials?: { login: string; password: string }
): Promise<any[]> {
  const endpoint = "/backlinks/backlinks/live";
  const payload = [{ target, limit: Math.min(Math.max(limit, 1), 200), order_by: ["rank,desc"], rank_scale: "one_hundred" }];
  const resp = await fetch(DFSEO_BASE + endpoint, {
    method: "POST",
    headers: dfseoAuthHeaders(credentials),
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`DataForSEO ${endpoint} failed (${resp.status}): ${text}`);
  }
  const json = await resp.json();
  if (json.status_code && json.status_code !== 20000) {
    throw new Error(`DataForSEO error ${json.status_code}: ${json.status_message}`);
  }
  const task = json.tasks?.[0];
  if (task?.status_code && task.status_code !== 20000) {
    throw new Error(`DataForSEO task error ${task.status_code}: ${task.status_message || "unknown"}`);
  }
  return task?.result || [];
}

export async function fetchPageSpeed(
  url: string,
  credentials?: { login: string; password: string }
): Promise<any> {
  const endpoint = "/on_page/lighthouse/live/json";
  const payload = [{ url, for_mobile: false, categories: ["performance", "accessibility", "best-practices", "seo"] }];
  const resp = await fetch(DFSEO_BASE + endpoint, {
    method: "POST",
    headers: dfseoAuthHeaders(credentials),
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`DataForSEO ${endpoint} failed (${resp.status}): ${text}`);
  }
  const json = await resp.json();
  if (json.status_code && json.status_code !== 20000) {
    throw new Error(`DataForSEO error ${json.status_code}: ${json.status_message}`);
  }
  const task = json.tasks?.[0];
  if (task?.status_code && task.status_code !== 20000) {
    throw new Error(`DataForSEO task error ${task.status_code}: ${task.status_message || "unknown"}`);
  }
  return task?.result?.[0] ?? null;
}

export async function fetchKeywordVolumes(
  keywords: string[],
  locationCode: number,
  languageCode: string,
  credentials?: { login: string; password: string }
): Promise<any[]> {
  const endpoint = "/keywords_data/google_ads/search_volume/live";
  const payload = [{ keywords, location_code: locationCode, language_code: languageCode }];
  const resp = await fetch(DFSEO_BASE + endpoint, {
    method: "POST",
    headers: dfseoAuthHeaders(credentials),
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`DataForSEO ${endpoint} failed (${resp.status}): ${text}`);
  }
  const json = await resp.json();
  if (json.status_code && json.status_code !== 20000) {
    throw new Error(`DataForSEO error ${json.status_code}: ${json.status_message}`);
  }
  const task = json.tasks?.[0];
  if (task?.status_code && task.status_code !== 20000) {
    throw new Error(`DataForSEO task error ${task.status_code}: ${task.status_message || "unknown"}`);
  }
  const result = Array.isArray(task?.result) ? task.result : [];
  // DataForSEO wraps each keyword under a `keyword_data` sub-object; unwrap so
  // downstream code can read root-level keyword/search_volume/competition.
  return result
    .map((r: any) => (r && r.keyword_data ? r.keyword_data : r))
    .filter((k: any) => k && typeof k.keyword === "string" && k.keyword);
}

// Helper functions for data processing
export function mapCompetitionToDifficulty(
  competition: string | number | undefined,
  competitionIndex: number | undefined
): number {
  if (typeof competition === "string") {
    switch (competition.toLowerCase()) {
      case "high": return 75;
      case "medium": return 50;
      case "low": return 25;
      default: return 50;
    }
  }
  if (typeof competition === "number") {
    return Math.round(competition * 100);
  }
  if (typeof competitionIndex === "number") {
    return Math.min(100, Math.round(competitionIndex));
  }
  return 50;
}

export function monthlyToTrend(monthly: { search_volume?: number }[] | undefined): number[] {
  return (monthly || []).map((m) => m.search_volume ?? 0);
}

// Fallback data generation — returns the same nested shape as the full
// generateFallbackData() in api/index.ts so normalizeAnalysisResult() can
// consume it without crashing.
export async function generateFallbackData(targetRaw: string, competitorRaw?: string): Promise<any> {
  const domain = targetRaw.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split(":")[0];
  const brand = domain.split(".")[0].replace(/-/g, " ");
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // High-traffic Kolkata keywords covering all intent types
  const nicheKeywords = [
    `${brand} services Kolkata`,              // Head term — high volume
    `${brand} near me`,                       // Transactional — high intent
    `best ${brand} in Kolkata`,               // Commercial — comparison
    `${brand} cost Kolkata`,                  // Transactional — pricing
    `${brand} reviews Kolkata`,               // Commercial — social proof
    `top ${brand} Kolkata`,                   // Commercial — ranking
    `${brand} Salt Lake Kolkata`,             // Local — neighborhood
    `${brand} New Town Kolkata`,              // Local — neighborhood
    `affordable ${brand} Kolkata`,            // Transactional — budget
    `how to choose ${brand} Kolkata`,         // Informational — guide
    `${brand} vs alternatives Kolkata`,       // Commercial — comparison
    `${brand} for families Kolkata`,          // Long-tail — persona
    `${brand} appointment Kolkata`,           // Transactional — booking
    `${brand} Park Street Kolkata`,           // Local — neighborhood
    `${brand} West Bengal`,                   // State-level — broader reach
  ];

  const targetMetrics = {
    domain,
    domainRating: Math.min(85, 30 + (domain.length * 3) % 55),
    backlinksCount: 1500 + (domain.length * 423) % 25000,
    referringDomains: 250 + (domain.length * 89) % 4500,
    organicTraffic: 12000 + (domain.length * 3120) % 350000,
    organicKeywords: 1800 + (domain.length * 450) % 25000,
    publishingFrequency: "1-2 articles / week",
    topPages: [
      { url: `https://${domain}/`, title: `${capitalize(brand)} Home`, estTraffic: 3500, keywordsCount: 320 },
      { url: `https://${domain}/services`, title: `${capitalize(brand)} Services`, estTraffic: 2100, keywordsCount: 180 },
      { url: `https://${domain}/about`, title: `About ${capitalize(brand)}`, estTraffic: 900, keywordsCount: 60 },
    ],
  };

  const competitorMetrics = competitorRaw
    ? {
        domain: competitorRaw.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split(":")[0],
        domainRating: Math.min(92, 35 + (competitorRaw.length * 4) % 55),
        backlinksCount: 3000 + (competitorRaw.length * 650) % 45000,
        referringDomains: 450 + (competitorRaw.length * 120) % 8500,
        organicTraffic: 25000 + (competitorRaw.length * 5430) % 650000,
        organicKeywords: 3500 + (competitorRaw.length * 850) % 45000,
        publishingFrequency: "2-3 articles / week",
        topPages: [],
      }
    : null;

  const keywords = nicheKeywords.map((kw, i) => ({
    keyword: kw,
    volume: Math.max(80, 1600 - i * 110 + (kw.includes("near me") ? 200 : 0)),
    difficulty: Math.min(85, 18 + i * 3),
    cpc: parseFloat((1.8 + i * 0.15).toFixed(2)),
    intent: (/near me|book|cost|price/i.test(kw) ? "Transactional" : i < 4 ? "Commercial" : "Informational") as string,
    type: (kw.split(/\s+/).length >= 3 ? "Long-tail" : "Short-tail") as string,
    competition: (i < 4 ? "High" : i < 10 ? "Medium" : "Low") as string,
    trend: (i < 8 ? "rising" : "stable") as string,
    relatedKeywords: nicheKeywords.filter((_, j) => j !== i).slice(0, 4),
    parentTopic: `${brand} · Kolkata`,
    buyerJourneyStage: (i < 5 ? "Awareness" : i < 11 ? "Consideration" : "Decision") as string,
    opportunityScore: Math.max(12, 96 - i * 4),
    isPillarOpportunity: i < 5,
    serpRankings: [{ rank: 1, title: `${kw} | ${capitalize(brand)}`, url: `https://${domain}` }],
  }));

  const contentGaps = nicheKeywords.slice(0, 10).map((kw, i) => {
    const titleCase = kw.replace(/\b\w/g, (c) => c.toUpperCase());
    const difficulty = Math.min(75, (kw.includes("near me") ? 12 : 16) + i * 4);
    // Intent-matched titles — each keyword gets a title that matches its search intent
    const isTransactional = /near me|cost|price|book|appointment|affordable/i.test(kw);
    const isComparison = /vs|alternative|compare|best|top|review/i.test(kw);
    const isInformational = /how to|guide|what|why|tips|mistakes/i.test(kw);
    const isLocal = /kolkata|salt lake|new town|park street|west bengal/i.test(kw);

    let recommendedTopic: string;
    if (isTransactional) {
      recommendedTopic = `${titleCase} — Pricing, Reviews & How to Book in 2026`;
    } else if (isComparison) {
      recommendedTopic = `${titleCase}: Honest Comparison With Top Alternatives`;
    } else if (isInformational) {
      recommendedTopic = `The Complete Guide to ${titleCase} (What Actually Works)`;
    } else if (isLocal) {
      recommendedTopic = `${titleCase} — Local Expert Guide With Real Reviews`;
    } else {
      recommendedTopic = `${titleCase}: What Kolkata Customers Need to Know Before Choosing`;
    }

    return {
      competitorKeyword: kw,
      competitorRank: 2 + (i % 8),
      competitorVolume: Math.max(90, 1800 - i * 110),
      competitorDifficulty: difficulty,
      targetRank: i % 3 === 0 ? "Not Ranking" : 12 + i * 3,
      recommendedTopic,
      recommendedType: i % 2 === 0 ? "Local Pillar / Service Page" : "Geo Comparison Guide",
      difficultyCategory: difficulty < 30 ? "Easy" : difficulty < 55 ? "Medium" : "Hard",
      isQuickWin: difficulty < 38 && i < 6,
      cityMention: "Kolkata",
      localIntent: (i % 3 === 0 ? "local_direct" : i % 3 === 1 ? "local_aware" : "mixed") as string,
      neighborhoods: i < 3 ? ["Salt Lake", "New Town", "Park Street"] : [],
      localSearchVolume: true,
      localDirectoryRelevant: /clinic|store|agency|company|hospital|restaurant|salon/i.test(kw),
      gbpCategory: undefined as string | undefined,
    };
  });

  return {
    target: targetMetrics,
    competitor: competitorMetrics,
    discoveredCompetitors: [
      { domain: `${brand}-clinic.com`, nicheFocus: `${brand} clinic · Kolkata`, analyzedTakeaway: "Strong local presence in Kolkata with optimized GBP and 200+ reviews" },
      { domain: `best${brand}.com`, nicheFocus: `${brand} services · Kolkata`, analyzedTakeaway: "Good review velocity and local citation consistency across Salt Lake and New Town" },
    ],
    targetAnalysis: {
      coreNiche: `${brand} services · Kolkata, India`,
      audiencePersona: `Local buyers in Kolkata searching for ${brand} services — typically age 25-55, mobile-first, comparing 2-3 providers before enquiring, influenced by Google reviews and local directory listings`,
      contentStrengths: ["Domain has service pages", "Basic keyword targeting present", "Domain age provides baseline trust"],
      contentWeaknesses: ["Limited long-tail blog coverage", "Missing FAQ depth", "Internal linking needs improvement", "No neighborhood-specific landing pages", "No case studies or customer stories for Kolkata market"],
      detailedBreakdown: `${capitalize(brand)} (${domain}) is a Local SEO target in Kolkata, West Bengal, India. The business operates in a competitive local market where Google Business Profile optimization, review management, and local citation consistency are the primary ranking drivers. The site has basic service pages but lacks the geo-targeted content, FAQ depth, and local link signals needed to compete in Kolkata's Map Pack.`,
      socialPresenceSummary: "No active social media presence detected. Competitors leverage Facebook and Instagram for local engagement.",
      socialMentionKeywords: [],
      competitorSocialInsights: "Kolkata competitors use Facebook for service promotion and customer reviews. Instagram used for visual before/after content.",
      marketResearch: {
        marketSize: "Kolkata metro population ~15M; local services market estimated at INR 500-800 crore annually for the ${brand} niche",
        topNeighborhoods: [
          { name: "Salt Lake", estimatedSearchVolume: "High", dominatedBy: "Established clinics with 5+ years presence" },
          { name: "New Town", estimatedSearchVolume: "High", dominatedBy: "Newer digital-first providers with strong GBP" },
          { name: "Park Street", estimatedSearchVolume: "Medium", dominatedBy: "Legacy brands with foot traffic advantage" },
          { name: "Ballygunge", estimatedSearchVolume: "Medium", dominatedBy: "Premium-tier providers" },
          { name: "Howrah", estimatedSearchVolume: "Growing", dominatedBy: "Value-focused providers, less digital competition" },
        ],
        seasonalTrends: [
          { period: "Oct-Nov (Durga Puja)", searchTrend: "Spike (+40%)", notes: "Pre-festival bookings peak; promotional content and offers drive high-intent traffic" },
          { period: "Jun-Sep (Monsoon)", searchTrend: "Dip (-15%)", notes: "Reduced foot traffic; focus on online consultations and emergency queries" },
          { period: "Jan-Feb (Winter)", searchTrend: "Stable (+5%)", notes: "Steady demand; health/wellness content performs well" },
        ],
        growthDrivers: [
          "Increasing smartphone penetration in Kolkata suburbs",
          "Google Business Profile adoption among local competitors rising fast",
          "Post-COVID shift to online research before local service visits",
          "Voice search in Bengali/English mix growing for local queries",
        ],
        competitiveLandscape: "Moderate competition — most Kolkata competitors have weak technical SEO and inconsistent NAP across directories. Gap exists for structured local content.",
        customerPersona: {
          demographics: "Age 25-55, household income INR 4-12 LPA, mobile-first user, bilingual (Bengali/English)",
          searchBehavior: "Searches '[service] near me in Kolkata', reads 3-5 Google reviews before calling, checks directory listings for phone number and address",
          decisionDrivers: ["Google rating (4.0+)", "Proximity to neighborhood", "Transparent pricing", "Online booking availability"],
          objections: ["Hidden costs", "Long wait times", "Uncertain quality without reviews"],
        },
      },
    },
    keywords,
    contentGaps,
    localLocation: {
      city: "Kolkata",
      state: "West Bengal",
      country: "India",
      confidenceScore: 55,
      googleMapPackScore: 45,
      citationConsistency: 50,
      serviceAreas: ["Kolkata", "Salt Lake", "New Town", "Park Street", "Ballygunge", "Howrah"],
      localCompetitors: [
        { name: `${capitalize(brand)} Center`, domain: `${brand}-center.com`, address: "Kolkata, West Bengal", rating: 4.5, reviewCount: 120 },
      ],
      localOptimizationsNeeded: [
        "Publish full NAP on contact page",
        "Geo page: services in Kolkata neighborhoods",
        "Embed Google Map + LocalBusiness schema",
        "Build citations on JustDial, Sulekha, IndiaMART for Kolkata",
        "Collect and respond to Google reviews weekly",
      ],
      localSeoVerdict: `${capitalize(brand)} can capture more high-intent local traffic in Kolkata by fixing NAP consistency, adding neighborhood landing pages, and implementing LocalBusiness schema.`,
      localKeywordOpportunities: keywords.slice(0, 5).map((k) => ({
        keyword: k.keyword,
        searchVolume: k.volume,
        currentRank: "Not ranking / untracked",
        intent: k.intent || (/near me|book|cost|price/i.test(k.keyword) ? "Transactional" : "Commercial"),
      })),
    },
    serpFeatures: [
      { type: "Featured Snippet" as const, query: nicheKeywords[0], opportunity: "Add definition block + FAQ schema", actionability: "High" },
      { type: "People Also Ask" as const, query: `what is ${brand}`, opportunity: "Create FAQ page with 10+ questions targeting Kolkata-specific queries", actionability: "Medium" },
      { type: "Local Pack" as const, query: `${brand} near me Kolkata`, opportunity: "Optimize GBP with Kolkata neighborhood mentions, photos, and weekly posts", actionability: "High" },
      { type: "Map Pack" as const, query: `${brand} Salt Lake Kolkata`, opportunity: "Build neighborhood-specific service pages with embedded GBP reviews", actionability: "High" },
    ],
    backlinkSources: [
      { domain: "justdial.com", authority: "High", relevance: "Local directory — Kolkata listings indexed by Google", linkType: "Directory", opportunity: "List with exact NAP matching GBP" },
      { domain: "sulekha.com", authority: "High", relevance: "Service directory with Kolkata category pages", linkType: "Directory", opportunity: "Create detailed service profile with photos" },
      { domain: "indiamart.com", authority: "High", relevance: "B2B directory with strong Kolkata local presence", linkType: "Directory", opportunity: "Free listing with service description" },
      { domain: "kolkatadiary.com", authority: "Medium", relevance: "Kolkata local news and business directory", linkType: "Editorial", opportunity: "Sponsor or guest post on local events" },
      { domain: "topranker.in", authority: "Medium", relevance: "Kolkata business listing and reviews", linkType: "Directory", opportunity: "Claim and optimize business profile" },
    ],
    backlinkOpportunities: [
      { domain: "kolkatabusiness.com", authority: "Medium", relevance: "Kolkata business directory with dofollow links", estimatedEffort: "Low — submit listing with NAP + GBP link" },
      { domain: "timesofindia.com/kolkata", authority: "High", relevance: "Times of India Kolkata section — editorial backlinks possible via local story pitching", estimatedEffort: "High — PR pitch required" },
      { domain: "bengalchamber.com", authority: "Medium", relevance: "Bengal Chamber of Commerce member directory", estimatedEffort: "Medium — membership application required" },
    ],
    siteProfile: { source: "fallback", scrapedPages: 0, brand: capitalize(brand), niche: `${brand} services`, city: "Kolkata", state: "West Bengal", country: "India" },
    rankingBlueprint: {
      currentPosition: "Not in top 30 for primary local keywords",
      targetPosition: "Top 3 Map Pack + top 10 organic for Kolkata service terms within 90 days",
      summary: `${capitalize(brand)} (${domain}) in Kolkata: prioritize Local SEO (GBP, NAP, geo pages).`,
      technicalSeo: ["Improve LCP below 2.5s", "Add LocalBusiness + FAQPage schema", "Ensure mobile responsiveness"],
      localSeo: [
        "Claim and verify Google Business Profile for Kolkata",
        "Build local citations with identical NAP across JustDial, Sulekha, IndiaMART",
        "Collect and respond to customer reviews weekly",
        "Add neighborhood pages for Salt Lake, New Town, Park Street",
        "Embed Google Map on contact page with LocalBusiness JSON-LD",
      ],
      contentStrategy: [
        "Geo pillar: services in Kolkata with neighborhood sub-sections",
        "Near-me FAQ clusters and neighborhood comparison pages",
        "Customer case studies from Kolkata neighborhoods",
        "Blog series: 'Best [service] in [neighborhood]' targeting local long-tail",
      ],
      linkBuilding: [
        "Local directories: JustDial, Sulekha, IndiaMART with exact NAP",
        "Community / chamber sponsorships (Bengal Chamber of Commerce)",
        "Partner local businesses for cross-links and referrals",
        "Kolkata event sponsorships for editorial mentions",
      ],
      timelineEstimate: "6-12 weeks for measurable local pack improvements",
      priorityActions: [
        { action: "Optimize GBP for Kolkata with full NAP, photos, weekly posts", impact: "High", effort: "Low", timeframe: "1 week" },
        { action: "Fix NAP consistency across top 5 Kolkata directories", impact: "High", effort: "Medium", timeframe: "2 weeks" },
        { action: "Add LocalBusiness schema to all service pages", impact: "Medium", effort: "Low", timeframe: "3 days" },
      ],
      localKeywordsToTarget: keywords.slice(0, 5).map((k) => ({ keyword: k.keyword, searchVolume: k.volume, currentRank: "Not ranking / untracked" })),
    },
    autonomousBlog: {
      title: `Best ${capitalize(brand)} Services in Kolkata — Honest Guide With Local Reviews (2026)`,
      metaDescription: `Looking for ${brand} services in Kolkata? Compare top providers in Salt Lake, New Town, and Park Street with real pricing, reviews, and neighborhood tips.`,
      slug: `best-${brand}-services-kolkata-honest-guide-2026`,
      content: `## ${capitalize(brand)} Services in Kolkata — What Actually Matters\n\nFinding the right ${brand} service in Kolkata means looking past flashy websites and focusing on three things: verified Google reviews, transparent pricing, and a location convenient to your neighborhood.\n\n### How Kolkata ${brand} Providers Compare\n\n| Area | Typical Price Range | Review Rating | Online Booking | Best For |\n|------|-------------------|---------------|----------------|----------|\n| Salt Lake | Mid-range | 4.2–4.6 | Yes | Established providers with track record |\n| New Town | Competitive | 4.0–4.4 | Yes | Digital-first, quick turnaround |\n| Park Street | Premium | 4.3–4.7 | Limited | Brand reputation, walk-in |\n| Ballygunge | Premium | 4.4–4.8 | Limited | Specialized, personalized service |\n| Howrah | Budget-friendly | 3.9–4.3 | Growing | Value without sacrificing quality |\n\n### Red Flags When Choosing a ${capitalize(brand)} in Kolkata\n\n1. **No Google Business Profile** — If they can't be found on Google Maps, they're not investing in their online presence\n2. **Fewer than 20 reviews** — In Kolkata's competitive market, established providers have 50+ reviews\n3. **Vague pricing** — Legitimate providers give you a clear breakdown before you commit\n4. **Address mismatch** — Check that the address on Google matches JustDial and their website exactly\n\n### What Kolkata Customers Actually Search For\n\nMost people in Kolkata search for "${brand} near me" or "best ${brand} in [neighborhood]" — the same keywords you'd use on Google. The difference is that local intent matters more here: someone in Salt Lake wants a provider in Salt Lake, not one 45 minutes away in Howrah.\n\n### ${capitalize(brand)} Kolkata — What to Expect in 2026\n\nKolkata's ${brand} market has grown 18% year-over-year as more providers invest in online presence. Salt Lake and New Town lead in digital adoption, while Park Street and Ballygunge rely on word-of-mouth and legacy reputation.\n\n### Frequently Asked Questions\n\n**Q: How do I find the best ${brand} near me in Kolkata?**\nA: Search on Google Maps, filter by 4+ star ratings with 50+ reviews, and verify the address matches across Google, JustDial, and Sulekha.\n\n**Q: What is the average cost of ${brand} services in Kolkata?**\nA: Prices range from INR 500–5,000 depending on service type and neighborhood. Salt Lake and New Town offer the best value; Park Street charges a premium.\n\n**Q: Which Kolkata neighborhood has the most ${brand} options?**\nA: Salt Lake and New Town have the highest concentration of providers with strong online presence and modern facilities.\n\n**Q: How do I know if a ${brand} provider is legitimate?**\nA: Check Google Business Profile verification, look for consistent NAP (name, address, phone) across directories, and read recent reviews from verified customers.`,
      publishDate: new Date().toISOString(),
      status: "draft" as const,
      source: "autonomous" as const,
    },
    dataSource: "simulated",
  };
}

// Domain and provider utilities
export function cleanDomain(url: string): string {
  const raw = url.trim();
  if (!raw) return "";
  let domain = raw.replace(/^https?:\/\//, "").replace(/^www\./, "");
  domain = domain.split("/")[0];
  return domain.split(":")[0];
}

export function resolveDomain(
  body: { targetUrl?: string; targetDomain?: string } | undefined
): string {
  const raw = body?.targetUrl || body?.targetDomain || "";
  return cleanDomain(raw);
}

export function getProviderConfig(
  req: { body?: { aiConfig?: any } }
): any | null {
  const cfg = req.body?.aiConfig;
  if (!cfg || typeof cfg !== "object") return null;
  const rawKey = typeof cfg.apiKey === "string" ? cfg.apiKey.trim() : "";
  if (!rawKey || rawKey.length < 8) return null;
  const lower = rawKey.toLowerCase();
  if (
    lower.includes("placeholder") ||
    lower === "my_gemini_api_key" ||
    lower === "xxx" ||
    lower === "paste_key_here" ||
    lower.includes("your_")
  ) {
    return null;
  }

  let provider = String(cfg.provider || "gemini").toLowerCase().trim();
  if (provider === "nvidia" || provider === "nim") provider = "nvidia";
  if (/^sk-or/i.test(rawKey)) provider = "openrouter";
  if (/^nvapi-/i.test(rawKey)) provider = "nvidia";
  if (/^AIza/i.test(rawKey) && provider !== "gemini") provider = "gemini";

  let customFormat = cfg.customFormat || "openai";
  if (provider === "nvidia") customFormat = "nvidia";

  let apiEndpoint = String(cfg.apiEndpoint || "").trim();
  let apiModel = String(cfg.apiModel || "").trim();

  if (provider === "openrouter") {
    if (!apiModel || /gemini|^models\//i.test(apiModel)) {
      apiModel = "meta-llama/llama-3.3-70b-instruct:free";
    }
    if (!apiEndpoint || !apiEndpoint.includes("openrouter.ai")) {
      apiEndpoint = "https://openrouter.ai/api/v1";
    }
    apiEndpoint = apiEndpoint.replace(/\/+$/, "");
    if (apiEndpoint.includes("openrouter.ai") && !apiEndpoint.endsWith("/api/v1")) {
      apiEndpoint = "https://openrouter.ai/api/v1";
    }
  }
  if (provider === "nvidia") {
    if (!apiModel || /gemini|^models\//i.test(apiModel)) {
      apiModel = "nvidia/llama-3.1-nemotron-70b-instruct";
    }
    if (!apiEndpoint || /openrouter|googleapis/i.test(apiEndpoint)) {
      apiEndpoint = "https://integrate.api.nvidia.com/v1";
    }
  }
  if (provider === "gemini") {
    if (!apiModel || /llama|claude|openrouter|mistral|nemotron|nvidia/i.test(apiModel)) {
      apiModel = "gemini-2.5-flash";
    }
    apiEndpoint = "";
  }
  if (provider === "custom") {
    if (!apiModel) apiModel = "gpt-4o-mini";
    if (customFormat === "nvidia" && !apiEndpoint) {
      apiEndpoint = "https://integrate.api.nvidia.com/v1";
    }
  }

  return { apiKey: rawKey, provider, apiEndpoint, apiModel, customFormat };
}

export function humanizeProviderError(raw: unknown): string {
  const msg = String(raw instanceof Error ? raw.message : raw || "");
  if (/DataForSEO|dataforseo/i.test(msg)) {
    if (/401|not authorized|unauthorized/i.test(msg)) {
      return "DataForSEO rejected your login/password. Open Settings → paste the API password from app.dataforseo.com/api-access (not your account password).";
    }
    if (/402|insufficient|balance|credits/i.test(msg)) {
      return "DataForSEO account has insufficient balance. Add credits at app.dataforseo.com/billing.";
    }
    if (/404|not found/i.test(msg)) {
      return "DataForSEO endpoint not found — this may be a temporary API issue. Retry in a moment.";
    }
    if (/429|rate.?limit/i.test(msg)) {
      return "DataForSEO rate limit hit. Wait a minute and retry.";
    }
    if (/timeout|timed out/i.test(msg)) {
      return "DataForSEO request timed out. The API may be slow — retry shortly.";
    }
  }
  if (/OpenRouter/i.test(msg)) {
    if (/401|403|Unauthorized|invalid.*key|user not found/i.test(msg)) {
      return "OpenRouter API key was rejected. Open Settings → select OpenRouter → paste a key from https://openrouter.ai/keys → Save.";
    }
    if (/402|credits|can only afford|insufficient/i.test(msg)) {
      return "OpenRouter has no credits for this model. Add credits at openrouter.ai or switch to a free model (e.g. meta-llama/llama-3.3-70b-instruct:free).";
    }
    if (/429|rate.?limit/i.test(msg)) {
      return "OpenRouter rate limit hit. Wait a minute, try a different model in Settings, or add credits for higher limits.";
    }
    if (/model|not found|no endpoints/i.test(msg)) {
      return "OpenRouter model unavailable. In Settings set Model to meta-llama/llama-3.3-70b-instruct:free (or another model you can access).";
    }
  }
  if (/Gemini/i.test(msg)) {
    if (/401|403|Unauthorized|invalid.*key/i.test(msg)) {
      return "Gemini API key was rejected. Open Settings → select Gemini → paste a key from https://aistudio.google.com/apikey → Save.";
    }
    if (/429|resource has been exhausted|quota exceeded/i.test(msg)) {
      return "Gemini quota exhausted. Wait or add billing at https://aistudio.google.com/.";
    }
    if (/400|invalid.*argument/i.test(msg)) {
      return "Gemini rejected the request (invalid model or parameters). Check your model name in Settings.";
    }
  }
  if (/Custom|Custom Endpoint/i.test(msg)) {
    if (/401|403|Unauthorized|invalid.*key/i.test(msg)) {
      return "Custom endpoint rejected the request (invalid key or credentials). Check your endpoint and key in Settings.";
    }
    if (/404|not found/i.test(msg)) {
      return "Custom endpoint not found (404). Check the URL in Settings.";
    }
    if (/500|server error/i.test(msg)) {
      return "Custom endpoint returned a server error (500). Check the endpoint status.";
    }
    if (/408|timeout/i.test(msg)) {
      return "Custom endpoint request timed out. Check the endpoint URL and try again.";
    }
  }
  return String(msg);
}

// JSON parsing utilities
export function parseJsonWithTrailingRecovery(text: string): any {
  try {
    return JSON.parse(text);
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
    try {
      const match = text.match(/^[\s\n]*({[\s\S]*})[\s\n]*$/);
      if (match) {
        const jsonStr = match[1];
        const lastBrace = jsonStr.lastIndexOf("}");
        const validJson = jsonStr.substring(0, lastBrace + 1);
        return JSON.parse(validJson);
      }
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;
    }
    throw new Error(`Failed to parse JSON: ${err.message}`);
  }
}

export function extractAndParseJSON(rawResponse: unknown): any {
  if (typeof rawResponse === "string") {
    const match = rawResponse.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // ignore
      }
    }
    return parseJsonWithTrailingRecovery(String(rawResponse));
  }
  if (Array.isArray(rawResponse)) {
    return rawResponse;
  }
  if (rawResponse && typeof rawResponse === "object") {
    return rawResponse;
  }
  return {};
}

export function cleanAndParseJSON(text: string): any {
  try {
    return JSON.parse(text);
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
    try {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start >= 0 && end > start) {
        const jsonStr = text.substring(start, end + 1);
        return JSON.parse(jsonStr);
      }
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;
    }
    throw new Error(`Failed to parse JSON: ${err.message}`);
  }
}

export function sanitizeAndParseJSON(rawResponse: unknown): any {
  if (typeof rawResponse === "string") {
    return cleanAndParseJSON(rawResponse);
  }
  if (Array.isArray(rawResponse)) {
    return rawResponse;
  }
  if (rawResponse && typeof rawResponse === "object") {
    return rawResponse;
  }
  return {};
}

export function tryParseJsonLoose(text: unknown): any | null {
  if (typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}