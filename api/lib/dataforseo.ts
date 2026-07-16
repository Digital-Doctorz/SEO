const BASE = "https://api.dataforseo.com/v3";

// Types matching frontend AnalysisResult structure
interface SerpAnalysis {
  organic: Array<{ position: number; title: string; url: string; snippet: string; domain: string }>;
  featured_snippet?: string;
  local_pack: unknown[];
  people_also_ask: unknown[];
  related_searches: unknown[];
}

interface KeywordLandscapeItem {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number;
  trend: number[];
  opportunity: "high" | "medium" | "low";
}

interface BacklinkProfile {
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
}

function auth(credentials?: { login: string; password: string }): { Authorization: string } {
  const login = credentials?.login || (process.env.DATAFORSEO_LOGIN ?? "");
  const password = credentials?.password || (process.env.DATAFORSEO_PASSWORD ?? "");
  if (!login || !password) throw new Error("DataForSEO credentials not configured");
  const token = Buffer.from(`${login}:${password}`).toString("base64");
  return { Authorization: `Basic ${token}` };
}

function headers(credentials?: { login: string; password: string }): Record<string, string> {
  return {
    ...auth(credentials),
    "Content-Type": "application/json",
  };
}

async function post<T>(endpoint: string, body: unknown[], credentials?: { login: string; password: string }): Promise<T> {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: "POST",
    headers: headers(credentials),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DataForSEO ${endpoint} failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { tasks?: Array<{ result?: T[] }>; status_code?: number; status_message?: string };
  if (json.status_code && json.status_code !== 20000) {
    throw new Error(`DataForSEO error ${json.status_code}: ${json.status_message}`);
  }
  return json.tasks?.[0]?.result?.[0] as T;
}

// ── Types ──

interface DfSerpItem {
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

interface DfSerpResult {
  keyword?: string;
  search_dataframe?: DfSerpItem[];
  items?: DfSerpItem[];
}

interface DfKeywordData {
  keyword: string;
  search_volume?: number;
  cpc?: number;
  competition?: number;
  trend?: number[];
  low_top_of_page_bid?: number;
  high_top_of_page_bid?: number;
}

interface DfKeywordsResult {
  keywords?: DfKeywordData[];
}

interface DfDomainBacklinksResult {
  domain?: string;
  backlinks?: number;
  dofollow?: number;
  referring_domains?: number;
  referring_domains_change?: number;
  backlinks_change?: number;
  domain_rank?: number;
}

interface DfDomainPageSpeedResult {
  lighthouse_result?: {
    categories?: {
      performance?: { score?: number };
      accessibility?: { score?: number };
      "best-practices"?: { score?: number };
      seo?: { score?: number };
    };
    audits?: {
      "first-contentful-paint"?: { numericValue?: number };
      "largest-contentful-paint"?: { numericValue?: number };
      "total-blocking-time"?: { numericValue?: number };
      "cumulative-layout-shift"?: { numericValue?: number };
      "speed-index"?: { numericValue?: number };
      "interactive"?: { numericValue?: number };
    };
  };
}

interface DfBacklinkItem {
  referring_domain?: string;
  referring_url?: string;
  target_url?: string;
  anchor?: string;
  domain_rank?: number;
  first_seen?: string;
  lost_date?: string;
  alt_attr?: string;
}

// ── SERP ──

export async function fetchSerp(keyword: string, locationCode = 2840, languageCode = "en", credentials?: { login: string; password: string }): Promise<DfSerpItem[]> {
  const result = await post<DfSerpResult>("/serp/google/organic/live/advanced", [
    {
      keyword,
      location_code: locationCode,
      language_code: languageCode,
      device: "desktop",
      os: "windows",
      depth: 10,
    },
  ], credentials);
  return result.items ?? result.search_dataframe ?? [];
}

// ── Keyword Volume ──

export async function fetchKeywordVolumes(keywords: string[], locationCode = 2840, languageCode = "en", credentials?: { login: string; password: string }): Promise<DfKeywordData[]> {
  if (keywords.length === 0) return [];
  const tasks = keywords.map((kw) => ({
    keyword: kw,
    location_code: locationCode,
    language_code: languageCode,
  }));
  const result = await post<DfKeywordsResult>("/keywords_data/google/keywords/search_volume", tasks, credentials);
  return result.keywords ?? [];
}

// ── Domain Overview ──

export async function fetchDomainOverview(domain: string, locationCode = 2840, languageCode = "en", credentials?: { login: string; password: string }): Promise<DfDomainBacklinksResult> {
  return post<DfDomainBacklinksResult>("/backlinks/domain/overview", [
    {
      target: domain,
      location_code: locationCode,
      language_code: languageCode,
    },
  ], credentials);
}

// ── Backlinks ──

export async function fetchBacklinks(domain: string, limit = 100, locationCode = 2840, languageCode = "en", credentials?: { login: string; password: string }): Promise<DfBacklinkItem[]> {
  const result = await post<{ backlinks?: DfBacklinkItem[] }>("/backlinks/domain/backlinks", [
    {
      target: domain,
      limit,
      location_code: locationCode,
      language_code: languageCode,
    },
  ], credentials);
  return result.backlinks ?? [];
}

// ── Lighthouse / PageSpeed ──

export async function fetchPageSpeed(url: string, credentials?: { login: string; password: string }): Promise<DfDomainPageSpeedResult["lighthouse_result"]> {
  const result = await post<DfDomainPageSpeedResult>("/page_speed/google/lighthouse/summary", [
    {
      target: url,
      settings: {
        device: "desktop",
        locale: "en",
      },
    },
  ], credentials);
  return result.lighthouse_result;
}

// ── Mapping helpers ──

function mapSerpToSerpAnalysis(items: DfSerpItem[]): SerpAnalysis {
  const organic = items
    .filter((r) => r.rank_group !== undefined)
    .map((r) => ({
      position: r.rank_group ?? 0,
      title: r.title ?? "",
      url: r.url ?? "",
      snippet: r.snippet ?? r.description ?? "",
      domain: r.domain ?? "",
    }));

  return {
    organic,
    featured_snippet: organic.length > 0 ? organic[0].title : undefined,
    local_pack: [],
    people_also_ask: [],
    related_searches: [],
  };
}

function mapBacklinksToProfile(
  overview: DfDomainBacklinksResult,
  backlinks: DfBacklinkItem[],
): BacklinkProfile {
  const linkItems = backlinks.map((b) => ({
    source_url: b.referring_url ?? "",
    source_domain: b.referring_domain ?? "",
    anchor: b.anchor ?? "",
    domain_rating: b.domain_rank ?? 0,
    first_seen: b.first_seen ?? "",
  }));

  return {
    total_backlinks: overview.backlinks ?? 0,
    referring_domains: overview.referring_domains ?? 0,
    domain_rating: overview.domain_rank ?? 0,
    dofollow_ratio: overview.dofollow ? overview.dofollow / (overview.backlinks || 1) : 0.7,
    link_growth: overview.referring_domains_change ?? 0,
    top_referring_domains: linkItems.slice(0, 20),
  };
}

function mapPageSpeed(result: DfDomainPageSpeedResult["lighthouse_result"]) {
  if (!result) return undefined;
  const audits = result.audits ?? {};
  const categories = result.categories ?? {};
  return {
    performance: Math.round((categories.performance?.score ?? 0) * 100),
    accessibility: Math.round((categories.accessibility?.score ?? 0) * 100),
    best_practices: Math.round((categories["best-practices"]?.score ?? 0) * 100),
    seo: Math.round((categories.seo?.score ?? 0) * 100),
    fcp_ms: audits["first-contentful-paint"]?.numericValue,
    lcp_ms: audits["largest-contentful-paint"]?.numericValue,
    tbt_ms: audits["total-blocking-time"]?.numericValue,
    cls: audits["cumulative-layout-shift"]?.numericValue,
    si_ms: audits["speed-index"]?.numericValue,
    tti_ms: audits["interactive"]?.numericValue,
  };
}

// ── Full fetch bundle ──

export interface DataForSeoBundle {
  serp: SerpAnalysis;
  keywordLandscape: KeywordLandscapeItem[];
  backlinks: BacklinkProfile;
  pageSpeed?: ReturnType<typeof mapPageSpeed>;
  rawSerpItems: DfSerpItem[];
  rawBacklinkItems: DfBacklinkItem[];
  rawKeywordData: DfKeywordData[];
  estimatedCost: { amount: number; currency: string };
}

export interface DataForSeoOptions {
  credentials?: { login: string; password: string };
  locationCode?: number;
  languageCode?: string;
}

// Approximate cost per DataForSEO operation (USD)
const COST = {
  serpQuery: 0.002,
  keywordLookup: 0.0006,
  domainOverview: 0.005,
  backlinksFetch: 0.005,
  pageSpeedFetch: 0.01,
} as const;

export function estimateCost(keywordCount: number): { amount: number; currency: string } {
  const amount =
    COST.serpQuery +
    keywordCount * COST.keywordLookup +
    COST.domainOverview +
    COST.backlinksFetch +
    COST.pageSpeedFetch;
  return { amount: Math.round(amount * 10000) / 10000, currency: "USD" };
}

export async function fetchFullBundle(
  domain: string,
  seedKeywords: string[],
  options?: DataForSeoOptions,
): Promise<DataForSeoBundle> {
  const creds = options?.credentials;
  const loc = options?.locationCode ?? 2840;
  const lang = options?.languageCode ?? "en";
  const primaryKeyword = seedKeywords[0] ?? domain.replace(/\.(com|in|org|net|co\.in)$/, "").replace(/-/g, " ");

  // Run independent queries in parallel
  const [serpItems, domainOverview, backlinks, pageSpeed, ...keywordResults] = await Promise.all([
    fetchSerp(primaryKeyword, loc, lang, creds).catch(() => [] as DfSerpItem[]),
    fetchDomainOverview(domain, loc, lang, creds).catch(() => ({} as DfDomainBacklinksResult)),
    fetchBacklinks(domain, 200, loc, lang, creds).catch(() => [] as DfBacklinkItem[]),
    fetchPageSpeed(`https://${domain}`, creds).catch(() => undefined),
    ...seedKeywords.slice(0, 20).map((kw) => fetchKeywordVolumes([kw], loc, lang, creds).catch(() => [] as DfKeywordData[])),
  ]);

  // Aggregate keyword data from individual calls
  const allKeywordData: DfKeywordData[] = keywordResults.flat().filter(Boolean);

  // Derive more keywords from SERP items
  const serpKeywords = [...new Set(serpItems.map((s) => s.title?.split(" - ")[0]?.trim() ?? "").filter(Boolean))];
  const extraKeywords = serpKeywords.slice(0, 15);

  let extraKeywordData: DfKeywordData[] = [];
  if (extraKeywords.length > 0) {
    extraKeywordData = await fetchKeywordVolumes(extraKeywords, loc, lang, creds).catch(() => []);
  }

  const combinedKeywordData = [...allKeywordData, ...extraKeywordData];

  // Build keyword landscape
  const keywordLandscape: KeywordLandscapeItem[] = combinedKeywordData.map((kd) => ({
    keyword: kd.keyword,
    volume: kd.search_volume ?? 0,
    difficulty: kd.competition ? Math.round(kd.competition * 100) : 50,
    cpc: kd.cpc ?? 0,
    trend: kd.trend ?? [],
    opportunity: (kd.search_volume ?? 0) > 100 && (kd.competition ?? 0) < 0.5 ? "high" as const : "medium" as const,
  }));

  const estimatedCost = estimateCost(combinedKeywordData.length);

  return {
    serp: mapSerpToSerpAnalysis(serpItems),
    keywordLandscape,
    backlinks: mapBacklinksToProfile(domainOverview, backlinks),
    pageSpeed: mapPageSpeed(pageSpeed),
    rawSerpItems: serpItems,
    rawBacklinkItems: backlinks,
    rawKeywordData: combinedKeywordData,
    estimatedCost,
  };
}
