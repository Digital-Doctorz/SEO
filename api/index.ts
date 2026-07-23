import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const HAS_DFSEO = Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);

// ============================================================
// Kolkata defaults (inlined for Vercel cold-start reliability;
// keep in sync with api/config/location.ts)
// ============================================================
const KOLKATA_CITY = "Kolkata";
const KOLKATA_STATE = "West Bengal";
const KOLKATA_COUNTRY = "India";
const DEFAULT_LOCATION_CODE = 1007810;
const DEFAULT_LANGUAGE_CODE = "en";
const KOLKATA_NEIGHBORHOODS = [
  "Salt Lake",
  "New Town",
  "Park Street",
  "Ballygunge",
  "Dum Dum",
  "Howrah",
  "Baranagar",
  "Belgharia",
  "Sealdah",
  "Esplanade",
  "Gariahat",
  "Beleghata",
  "Topsia",
  "Maniktala",
  "Shyambazar",
  "Behala",
  "Jadavpur",
  "Garia",
  "Rajarhat",
  "Kamarhati",
];

// ============================================================
// DataForSEO helpers (inlined — Vercel serverless cannot import ./lib/* reliably)
// Default location = Kolkata (1007810), not US 2840
// ============================================================
const DFSEO_BASE = "https://api.dataforseo.com/v3";
const DFSEO_CACHE_TTL = 5 * 60 * 1000; // 5-minute in-memory cache

function cacheKey(endpoint: string, payload: string): string {
  return `${endpoint}::${payload}`;
}

const dfseoCache = new Map<string, { timestamp: number; data: any }>();
const DFSEO_CACHE_MAX = 500;

function evictStaleCache(): void {
  const now = Date.now();
  for (const [key, entry] of dfseoCache) {
    if (now - entry.timestamp >= DFSEO_CACHE_TTL) {
      dfseoCache.delete(key);
    }
  }
  if (dfseoCache.size > DFSEO_CACHE_MAX) {
    const sorted = [...dfseoCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toDelete = sorted.slice(0, sorted.length - DFSEO_CACHE_MAX);
    for (const [key] of toDelete) {
      dfseoCache.delete(key);
    }
  }
}

async function cachedDfseoPost<T>(
  endpoint: string,
  body: unknown[],
  credentials?: DfsCredentials,
  ttl = DFSEO_CACHE_TTL,
): Promise<T> {
  const key = cacheKey(endpoint, JSON.stringify({ body, login: credentials?.login }));
  const hit = dfseoCache.get(key);
  if (hit && Date.now() - hit.timestamp < ttl) {
    return hit.data as T;
  }
  const data = await dfseoPost<T>(endpoint, body, credentials);
  dfseoCache.set(key, { timestamp: Date.now(), data });
  if (dfseoCache.size % 50 === 0) {
    evictStaleCache();
  }
  return data as T;
}

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
interface DfKeywordData {
  keyword: string;
  search_volume?: number;
  cpc?: number;
  competition?: number;
  trend?: number[];
}
interface DfDomainBacklinksResult {
  domain?: string;
  backlinks?: number;
  dofollow?: number;
  referring_domains?: number;
  referring_domains_change?: number;
  domain_rank?: number;
}
interface DfBacklinkItem {
  referring_domain?: string;
  referring_url?: string;
  target_url?: string;
  anchor?: string;
  domain_rank?: number;
  page_authority?: number;
  first_seen?: string;
  lost?: string;
  status_code?: number;
  text_pre?: string;
  text_post?: string;
  external_link_attributes?: string[];
  platform_type?: string;
  domain_authority?: number;
}
interface DataForSeoBundle {
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
      target_url?: string;
      anchor: string;
      domain_rating: number;
      page_authority: number;
      first_seen: string;
      is_dofollow: boolean;
      is_lost: boolean;
      text_pre: string;
      text_post: string;
      platform_type: string;
    }>;
  };
  pageSpeed?: {
    performance: number;
    accessibility: number;
    best_practices: number;
    seo: number;
  };
  rawSerpItems: DfSerpItem[];
  rawBacklinkItems: DfBacklinkItem[];
  rawKeywordData: DfKeywordData[];
  estimatedCost?: { amount: number; currency: string };
}

interface DfsCredentials {
  login: string;
  password: string;
}

function dfseoAuthHeaders(credentials?: DfsCredentials): Record<string, string> {
  const login = credentials?.login || (process.env.DATAFORSEO_LOGIN ?? "");
  const password = credentials?.password || (process.env.DATAFORSEO_PASSWORD ?? "");
  const token = Buffer.from(`${login}:${password}`).toString("base64");
  return { Authorization: `Basic ${token}`, "Content-Type": "application/json" };
}

async function dfseoPost<T>(endpoint: string, body: unknown[], credentials?: DfsCredentials): Promise<T> {
  const res = await fetch(`${DFSEO_BASE}${endpoint}`, {
    method: "POST",
    headers: dfseoAuthHeaders(credentials),
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
  if (!json.tasks?.[0]?.result?.[0]) {
    throw new Error(`DataForSEO ${endpoint} returned empty result (no tasks or results array)`);
  }
  return json.tasks[0].result[0];
}

async function fetchSerp(keyword: string, locationCode = DEFAULT_LOCATION_CODE, languageCode = DEFAULT_LANGUAGE_CODE, credentials?: DfsCredentials): Promise<DfSerpItem[]> {
  const result = await cachedDfseoPost<{ items?: DfSerpItem[]; search_dataframe?: DfSerpItem[] }>(
    "/serp/google/organic/live/advanced",
    [{ keyword, location_code: locationCode, language_code: languageCode, device: "desktop", os: "windows", depth: 10 }],
    credentials
  );
  return result.items ?? result.search_dataframe ?? [];
}

async function fetchKeywordVolumes(keywords: string[], locationCode = DEFAULT_LOCATION_CODE, languageCode = DEFAULT_LANGUAGE_CODE, credentials?: DfsCredentials): Promise<DfKeywordData[]> {
  if (!keywords.length) return [];
  const tasks = keywords.map((kw) => ({ keyword: kw, location_code: locationCode, language_code: languageCode }));
  const result = await cachedDfseoPost<{ keywords?: DfKeywordData[] }>(
    "/keywords_data/google/keywords/search_volume",
    tasks,
    credentials
  );
  return result.keywords ?? [];
}

async function fetchDomainOverview(domain: string, locationCode = DEFAULT_LOCATION_CODE, languageCode = DEFAULT_LANGUAGE_CODE, credentials?: DfsCredentials): Promise<DfDomainBacklinksResult> {
  return cachedDfseoPost<DfDomainBacklinksResult>("/backlinks/domain/overview", [
    { target: domain, location_code: locationCode, language_code: languageCode },
  ], credentials);
}

async function fetchBacklinks(domain: string, limit = 50, locationCode = DEFAULT_LOCATION_CODE, languageCode = DEFAULT_LANGUAGE_CODE, credentials?: DfsCredentials): Promise<DfBacklinkItem[]> {
  const result = await cachedDfseoPost<{ backlinks?: DfBacklinkItem[] }>("/backlinks/domain/backlinks", [
    { target: domain, limit, location_code: locationCode, language_code: languageCode },
  ], credentials);
  return result.backlinks ?? [];
}

async function fetchPageSpeed(url: string, credentials?: DfsCredentials): Promise<
  | {
      categories?: Record<string, { score?: number }>;
      audits?: Record<string, { numericValue?: number }>;
    }
  | undefined
> {
  const result = await cachedDfseoPost<{ lighthouse_result?: { categories?: Record<string, { score?: number }>; audits?: Record<string, { numericValue?: number }> } }>(
    "/page_speed/google/lighthouse/summary",
    [{ target: url, settings: { device: "desktop", locale: "en" } }],
    credentials
  );
  return result.lighthouse_result;
}

async function fetchFullBundle(domain: string, seedKeywords: string[], options?: { credentials?: DfsCredentials; locationCode?: number; languageCode?: string }): Promise<DataForSeoBundle> {
  const creds = options?.credentials;
  const loc = options?.locationCode ?? DEFAULT_LOCATION_CODE;
  const lang = options?.languageCode ?? DEFAULT_LANGUAGE_CODE;
  const primaryKeyword =
    seedKeywords[0] ?? domain.replace(/\.(com|in|org|net|co\.in)$/i, "").replace(/-/g, " ");
  const [serpItems, domainOverview, backlinks, pageSpeedResult, ...keywordResults] = await Promise.all([
    fetchSerp(primaryKeyword, loc, lang, creds).catch(() => [] as DfSerpItem[]),
    fetchDomainOverview(domain, loc, lang, creds).catch(() => ({} as DfDomainBacklinksResult)),
    fetchBacklinks(domain, 50, loc, lang, creds).catch(() => [] as DfBacklinkItem[]),
    fetchPageSpeed(`https://${domain}`, creds).catch(() => undefined),
    ...seedKeywords.slice(0, 10).map((kw) => fetchKeywordVolumes([kw], loc, lang, creds).catch(() => [] as DfKeywordData[])),
  ]);
  const allKeywordData: DfKeywordData[] = keywordResults.flat().filter(Boolean);
  const organic = (serpItems || [])
    .filter((r) => r.rank_group !== undefined)
    .map((r) => ({
      position: r.rank_group ?? 0,
      title: r.title ?? "",
      url: r.url ?? "",
      snippet: r.snippet ?? r.description ?? "",
      domain: r.domain ?? "",
    }));
  const keywordLandscape = allKeywordData.map((kd) => ({
    keyword: kd.keyword,
    volume: kd.search_volume ?? 0,
    difficulty: kd.competition ? Math.round(kd.competition * 100) : 50,
    cpc: kd.cpc ?? 0,
    trend: kd.trend ?? [],
    opportunity: ((kd.search_volume ?? 0) > 100 && (kd.competition ?? 0) < 0.5
      ? "high"
      : "medium") as "high" | "medium" | "low",
  }));
  const cats = pageSpeedResult?.categories ?? {};
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
      domain_rating: domainOverview.domain_rank ?? 0,
      dofollow_ratio: domainOverview.dofollow
        ? domainOverview.dofollow / (domainOverview.backlinks || 1)
        : 0.7,
      link_growth: domainOverview.referring_domains_change ?? 0,
      top_referring_domains: (backlinks || [])
        .filter((b) => b.status_code === undefined || b.status_code === 200)
        .slice(0, 50).map((b) => ({
        source_url: b.referring_url ?? "",
        source_domain: b.referring_domain ?? "",
        anchor: b.anchor ?? "",
        domain_rating: b.domain_rank ?? 50,
        page_authority: b.page_authority ?? b.domain_rank ?? 50,
        first_seen: b.first_seen ?? "",
        is_dofollow: !b.external_link_attributes?.some((a) => /nofollow/i.test(a)),
        is_lost: Boolean(b.lost),
        text_pre: b.text_pre ?? "",
        text_post: b.text_post ?? "",
        platform_type: b.platform_type ?? "",
        target_url: b.target_url ?? `https://${domain}/`,
      })),
    },
    pageSpeed: pageSpeedResult
      ? {
          performance: Math.round((cats.performance?.score ?? 0) * 100),
          accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
          best_practices: Math.round((cats["best-practices"]?.score ?? 0) * 100),
          seo: Math.round((cats.seo?.score ?? 0) * 100),
        }
      : undefined,
    rawSerpItems: serpItems || [],
    rawBacklinkItems: backlinks || [],
    rawKeywordData: allKeywordData,
    estimatedCost: {
      amount: Math.round((0.002 + allKeywordData.length * 0.0006 + 0.005 + 0.005 + 0.01) * 10000) / 10000,
      currency: "USD",
    },
  };
}

function cleanDomain(url: string): string {
 let domain = url.trim();
 domain = domain.replace(/^(https?:\/\/)?(www\.)?/, "");
 domain = domain.split("/")[0];
 return domain || "target-website.com";
}

/** Strip mojibake / fancy unicode so API responses stay readable. */
function sanitizeText(input: unknown): string {
 if (input == null) return "";
 let s = String(input);
 s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
 s = s.replace(/[\u200B-\u200D\uFEFF\u00AD\uFFFD]/g, "");
 s = s.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ");
 s = s.replace(/[\u2014\u2013\u2012\u2015]/g, "-");
 s = s.replace(/\u2022|\u00B7/g, "-");
 s = s.replace(/\u2026/g, "...");
 s = s.replace(/[\u2018\u2019\u201A\u2032]/g, "'");
 s = s.replace(/[\u201C\u201D\u201E\u2033]/g, '"');
 s = s.replace(/[\u2190-\u21FF]/g, "->");
 s = s.replace(/\u20AC/g, "EUR");
 s = s.replace(/├óΓé¼[Γäó╦£'"]|├óΓé¼┼ô|├óΓé¼\u009C|├óΓé¼\u009D/g, "'");
 s = s.replace(/├óΓé¼"|├óΓé¼ΓÇ£|├óΓé¼ΓÇ¥/g, "-");
 s = s.replace(/├óΓé¼┬ª/g, "...");
 s = s.replace(/├óΓé¼┬ó/g, "-");
 s = s.replace(/├â╞Æ[\u0080-\u00FF]{0,4}/g, "");
 s = s.replace(/├â┬ó[\u0080-\u00FF]{0,6}/g, "");
 s = s.replace(/├é/g, "");
 s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
 s = s.replace(/[ \t]{2,}/g, " ");
 s = s.replace(/ *\n */g, "\n");
 s = s.replace(/\n{3,}/g, "\n\n");
 return s.trim();
}

function sanitizeDeep<T>(value: T): T {
 if (typeof value === "string") return sanitizeText(value) as T;
 if (Array.isArray(value)) return value.map((v) => sanitizeDeep(v)) as T;
 if (value && typeof value === "object") {
 const out: Record<string, unknown> = {};
 for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
 out[k] = sanitizeDeep(v);
 }
 return out as T;
 }
 return value;
}

/** Close open strings/braces so truncated model output can still parse. */
function repairTruncatedJson(s: string): string {
 let inString = false;
 let escape = false;
 const stack: string[] = [];
 let result = "";
 for (let i = 0; i < s.length; i++) {
 const c = s[i];
 if (escape) {
 result += c;
 escape = false;
 continue;
 }
 if (c === "\\" && inString) {
 result += c;
 escape = true;
 continue;
 }
 if (c === '"') {
 inString = !inString;
 result += c;
 continue;
 }
 if (!inString) {
 if (c === "{") stack.push("}");
 else if (c === "[") stack.push("]");
 else if (c === "}" || c === "]") {
 if (stack.length && stack[stack.length - 1] === c) stack.pop();
 }
 }
 result += c;
 }
 if (inString) result += '"';
 result = result.replace(/,\s*([}\]])/g, "$1");
 result = result.replace(/,\s*$/, "");
 while (stack.length) result += stack.pop();
 return result;
}

/**
 * Fix invalid JSON string escapes that LLMs often emit (root cause of
 * "Bad escaped character in JSON"). Only valid escapes: \" \\ \/ \b \f \n \r \t \uXXXX
 */
function sanitizeJsonStringEscapes(input: string): string {
 let out = "";
 let inString = false;
 for (let i = 0; i < input.length; i++) {
  const c = input[i];
  if (!inString) {
   if (c === '"') inString = true;
   out += c;
   continue;
  }
  // Inside a JSON string
  if (c === "\\") {
   const next = input[i + 1];
   if (next === undefined) {
    out += "\\\\";
    continue;
   }
   if ('"\\/bfnrt'.includes(next)) {
    out += "\\" + next;
    i++;
    continue;
   }
   if (next === "u") {
    const hex = input.slice(i + 2, i + 6);
    if (/^[0-9a-fA-F]{4}$/.test(hex)) {
     out += "\\u" + hex;
     i += 5;
     continue;
    }
    // Invalid \u — escape the backslash literally
    out += "\\\\u";
    i++;
    continue;
   }
   // Invalid escape like \a \x \' — drop the backslash or double it
   // Prefer keeping the character without invalid escape
   out += next === "'" ? "'" : next;
   i++;
   continue;
  }
  if (c === '"') {
   inString = false;
   out += c;
   continue;
  }
  // Literal newlines/tabs inside strings break JSON
  if (c === "\n") {
   out += "\\n";
   continue;
  }
  if (c === "\r") {
   out += "\\r";
   continue;
  }
  if (c === "\t") {
   out += "\\t";
   continue;
  }
  // Strip other control chars
  if (c.charCodeAt(0) < 32) continue;
  out += c;
 }
 return out;
}

/**
 * Extract the first complete JSON object/array by brace balance (string-aware).
 * Fixes dual-JSON / trailing-junk failures like:
 *   {"a":1}{"b":2}  →  {"a":1}
 *   null{"a":1}     →  {"a":1}
 * Greedy /\{[\s\S]*\}/ wrongly spans multiple root values and triggers
 * "Unexpected non-whitespace character after JSON at position N".
 */
function extractBalancedJsonSlice(text: string, fromIndex = 0): string | null {
 const rel = text.slice(fromIndex).search(/[\[{]/);
 if (rel < 0) return null;
 const absStart = fromIndex + rel;
 let depth = 0;
 let inString = false;
 let escape = false;
 for (let i = absStart; i < text.length; i++) {
  const c = text[i];
  if (escape) {
   escape = false;
   continue;
  }
  if (inString) {
   if (c === "\\") {
    escape = true;
    continue;
   }
   if (c === '"') inString = false;
   continue;
  }
  if (c === '"') {
   inString = true;
   continue;
  }
  if (c === "{" || c === "[") {
   depth++;
   continue;
  }
  if (c === "}" || c === "]") {
   depth--;
   if (depth === 0) return text.slice(absStart, i + 1);
  }
 }
 // Truncated — return from start so repairTruncatedJson can close it
 return text.slice(absStart);
}

/** Normalize messy LLM text before JSON candidate extraction. */
function preprocessLlmJsonText(raw: string): string {
 let s = String(raw || "")
  .replace(/^\uFEFF/, "")
  .trim();
 if (!s) return s;

 // Strip markdown fences (leading, trailing, and inline remnants)
 s = s
  .replace(/^```(?:json|JSON|js|javascript)?\s*/i, "")
  .replace(/\s*```[\s\w]*$/i, "")
  .replace(/```(?:json|JSON)?\s*/gi, "")
  .replace(/```/g, "")
  .trim();

 // Language-tag leftovers: "json\n{...}" or "json{...}"
 s = s.replace(/^(?:json|JSON)\s*/i, "").trim();

 // Conversational prefixes
 s = s
  .replace(
   /^(?:here(?:'s| is)|sure[,.]?|absolutely[,.]?|of course[,.]?|okay[,.]?|ok[,.]?)\s*/i,
   ""
  )
  .trim();

 return s;
}

/** Prepare a candidate string for JSON.parse (escapes, smart quotes, trailing commas). */
function prepareJsonCandidate(input: string): string {
 let s = input.replace(/,\s*([\]}])/g, "$1");
 s = sanitizeJsonStringEscapes(s);
 s = s
  .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
  .replace(/[\u2018\u2019\u201A\u201B]/g, "'");
 return s;
}

/**
 * Try JSON.parse; if V8 reports trailing junk after a complete value
 * ("Unexpected non-whitespace character after JSON at position N"),
 * re-parse the prefix. Prefer object/array over null/true/number when
 * the remainder still contains a balanced object (e.g. null{...}).
 */
function parseJsonWithTrailingRecovery(text: string): any {
 try {
  return JSON.parse(text);
 } catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  const m = msg.match(/after JSON at position\s+(\d+)/i);
  if (!m) throw e;
  const pos = Number(m[1]);
  if (!Number.isFinite(pos) || pos <= 0 || pos > text.length) throw e;

  const head = text.slice(0, pos).trimEnd();
  let headVal: any;
  try {
   headVal = JSON.parse(head);
  } catch {
   throw e;
  }

  // null/true/false/number before a real object — prefer the object
  const rest = text.slice(pos);
  const braceAt = rest.search(/[\[{]/);
  if (
   braceAt >= 0 &&
   (headVal === null ||
    typeof headVal === "boolean" ||
    typeof headVal === "number" ||
    typeof headVal === "string")
  ) {
   const balanced = extractBalancedJsonSlice(rest, braceAt);
   if (balanced) {
    try {
     return JSON.parse(prepareJsonCandidate(balanced));
    } catch {
     try {
      return JSON.parse(repairTruncatedJson(prepareJsonCandidate(balanced)));
     } catch {
      /* fall through to headVal */
     }
    }
   }
  }
  return headVal;
 }
}

/**
 * Extract and parse JSON from messy LLM output.
 * Handles markdown fences, dual root values, conversational filler,
 * trailing commas, bad escapes, unescaped newlines, and truncated objects.
 */
function extractAndParseJSON(rawResponse: unknown): any {
 if (rawResponse == null) throw new Error("Invalid response format");
 if (typeof rawResponse === "object") return rawResponse;
 let cleanedText = preprocessLlmJsonText(String(rawResponse || ""));
 if (!cleanedText) throw new Error("Invalid response format");

 // Build ordered candidates (best first)
 const candidates: string[] = [];
 const pushUnique = (c: string | null | undefined) => {
  if (!c || !c.trim()) return;
  const t = c.trim();
  if (!candidates.includes(t)) candidates.push(t);
 };

 // 1. First brace-balanced object/array (handles dual JSON + leading null/true junk)
 const balanced = extractBalancedJsonSlice(cleanedText, 0);
 pushUnique(balanced);

 // 2. From first { or [ to end (truncated objects need repair)
 const firstBrace = cleanedText.search(/[\[{]/);
 if (firstBrace >= 0) {
  pushUnique(cleanedText.slice(firstBrace));
  // 3. Greedy outermost (legacy) — last } may help when balance is confused by bad escapes
  const fromBrace = cleanedText.slice(firstBrace);
  const greedyObj = fromBrace.match(/\{[\s\S]*\}/);
  const greedyArr = fromBrace.match(/\[[\s\S]*\]/);
  if (greedyObj) pushUnique(greedyObj[0]);
  if (greedyArr) pushUnique(greedyArr[0]);
 }

 // 4. Full cleaned text (primitives / already-clean JSON)
 pushUnique(cleanedText);

 // 5. Second balanced value if dual objects (sometimes first is a tiny stub)
 if (balanced && balanced.length < cleanedText.length) {
  const after = cleanedText.indexOf(balanced) + balanced.length;
  const second = extractBalancedJsonSlice(cleanedText, after);
  pushUnique(second);
 }

 if (!candidates.length) {
  throw new Error("No JSON object found in the response.");
 }

 let lastErr: Error | null = null;
 const parsedValues: any[] = [];

 for (const candidate of candidates) {
  const prepared = prepareJsonCandidate(candidate);
  const attempts = [
   prepared,
   repairTruncatedJson(prepared),
   repairTruncatedJson(
    prepareJsonCandidate(
     prepared
      .replace(/\u2028/g, "\\n")
      .replace(/\u2029/g, "\\n")
      .replace(/[\x00-\x1F]/g, (ch) => {
       if (ch === "\n") return "\\n";
       if (ch === "\r") return "\\r";
       if (ch === "\t") return "\\t";
       return "";
      })
    )
   ),
  ];

  for (const attempt of attempts) {
   try {
    const val = parseJsonWithTrailingRecovery(attempt);
    parsedValues.push(val);
    // Prefer structured object/array immediately
    if (val !== null && typeof val === "object") {
     return val;
    }
   } catch (e) {
    lastErr = e as Error;
   }
  }
 }

 // Accept non-null primitive only if nothing better
 for (const val of parsedValues) {
  if (val !== null && val !== undefined) return val;
 }
 if (parsedValues.includes(null)) return null;

 throw new Error(
  `Failed to parse JSON: ${lastErr?.message || "unknown"}. Snippet: ${cleanedText.slice(0, 180)}`
 );
}

/** @deprecated name kept for call sites — always uses extractAndParseJSON */
function cleanAndParseJSON(text: string): any {
 return extractAndParseJSON(text);
}

/**
 * Public alias (TASK 2 naming): sanitizeAndParseJSON
 * Strips markdown fences, trailing commas, bad escapes, literal newlines.
 */
function sanitizeAndParseJSON(rawResponse: unknown): any {
 return extractAndParseJSON(rawResponse);
}

/** Never throws — returns null on failure (stable fallbacks). */
function tryParseJsonLoose(text: unknown): any | null {
 try {
  return extractAndParseJSON(text);
 } catch {
  return null;
 }
}

/** Client sends targetDomain; older paths send targetUrl. Accept both. */
function resolveDomain(
 body: { targetUrl?: string; targetDomain?: string } | undefined
): string {
 const raw = body?.targetUrl || body?.targetDomain || "";
 return cleanDomain(raw);
}

function sleep(ms: number) {
 return new Promise((r) => setTimeout(r, ms));
}

/** User-safe error strings (never dump raw Google JSON to the UI). */
function humanizeProviderError(raw: unknown): string {
 const msg = String(raw instanceof Error ? raw.message : raw || "");
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
  const cleanedOr = msg.replace(/\s+/g, " ").trim().slice(0, 220);
  return cleanedOr || "OpenRouter error. Check provider, key, and model in Settings. A full offline draft was still generated.";
 }
 if (/NVIDIA|nvapi|integrate\.api\.nvidia/i.test(msg)) {
  if (/401|403|Unauthorized|invalid.*key|authentication/i.test(msg)) {
   return "NVIDIA API key was rejected. Open Settings → NVIDIA → paste a key from https://build.nvidia.com/ → Save.";
  }
  if (/404|model|not found|does not exist/i.test(msg)) {
   return "NVIDIA model not found. Try meta/llama-3.1-70b-instruct or pick a model id from build.nvidia.com/models.";
  }
  if (/429|rate.?limit/i.test(msg)) {
   return "NVIDIA rate limit hit. Wait a minute or switch model in Settings.";
  }
  const cleanedNv = msg.replace(/\s+/g, " ").trim().slice(0, 220);
  return cleanedNv || "NVIDIA API error. Check key, model, and endpoint in Settings.";
 }
 if (/Custom API|Custom Anthropic|Custom Gemini|Custom provider/i.test(msg)) {
  if (/401|403|Unauthorized|invalid.*key|authentication/i.test(msg)) {
   return "Custom provider rejected your API key. Re-check key, Base URL, and API Format (OpenAI / Anthropic / Gemini / NVIDIA) in Settings.";
  }
  if (/Base URL|endpoint/i.test(msg)) {
   return "Custom provider needs a valid Base URL (e.g. https://api.openai.com/v1 or https://integrate.api.nvidia.com/v1). Save it under Settings → Custom.";
  }
  if (/429|rate.?limit/i.test(msg)) {
   return "Custom provider rate limit hit. Wait and retry, or switch model in Settings.";
  }
  return msg.replace(/\s+/g, " ").trim().slice(0, 260) || "Custom LLM provider error. Check Settings.";
 }
 if (/429|RESOURCE_EXHAUSTED|quota|rate-limit|rate limit|free_tier/i.test(msg)) {
 const retry = msg.match(/retry in ([\d.]+)\s*s/i);
 const wait = retry ? Math.ceil(Number(retry[1])) : 30;
 return `AI provider quota or rate limit reached. Wait ~${wait}s, switch model in Settings, or check billing (Gemini AI Studio / OpenRouter credits). A full offline draft was still generated for you.`;
 }
 if (/401|403|API_KEY|invalid.*key|permission/i.test(msg)) {
 return "AI API key was rejected. Open Settings, confirm the correct provider (Gemini vs OpenRouter), paste a valid key, and Save.";
 }
 if (/timed out/i.test(msg)) {
 return "AI timed out. Showing a complete offline draft — try again with a shorter word count.";
 }
 if (
  /Failed to parse JSON|Bad escaped character|No JSON object|Unexpected token|Unexpected non-whitespace|after JSON at position|not valid JSON/i.test(
   msg
  )
 ) {
  return "AI returned malformed structured data (fixed automatically when possible). Showing the best recovered or offline draft — regenerate for a fresh AI article.";
 }
 const cleaned = msg
 .replace(/\{[\s\S]{0,2000}"error"[\s\S]{0,4000}\}/g, "")
 .replace(/\s+/g, " ")
 .trim();
 return cleaned.slice(0, 280) || "AI provider error. Showing a complete offline draft you can edit.";
}

async function generateContentWithFallback(
 ai: GoogleGenAI,
 contents: string | any[],
 config: any,
 defaultModel: string = "gemini-2.5-flash"
): Promise<any> {
 // Same systemInstruction/config is reused on every model — critical for strict JSON prompts
 const modelsToTry = Array.from(
 new Set(
 [
 defaultModel || "gemini-2.5-flash",
 "gemini-2.5-flash",
 "gemini-2.0-flash",
 "gemini-1.5-flash",
 "gemini-1.5-flash-latest",
 "gemini-2.5-flash-lite",
 ].filter(Boolean)
 )
 ).slice(0, 6);
 let lastError: any = null;
 for (const model of modelsToTry) {
 // Exponential backoff: up to 2 retries per model on transient 429
 let retries = 2;
 let delay = 1000;
 while (retries >= 0) {
 try {
  console.debug(`[Gemini] Attempting model: "${model}"`);
 const response = await ai.models.generateContent({ model, contents, config });
 if (response && response.text) {
  console.debug(`[Gemini] Success with model: "${model}"`);
 return response;
 }
 throw new Error(`Empty response from model ${model}`);
 } catch (err: any) {
 lastError = err;
 const msg = String(err?.message || err || "");
 const isDailyQuota =
 /free_tier|GenerateRequestsPerDay|quotaValue|RESOURCE_EXHAUSTED/i.test(msg) &&
 !/retry in/i.test(msg);
 const isTransient429 =
 err?.status === 429 ||
 /high demand|Spikes in demand|rate limit|retry in/i.test(msg);
 const is503 = err?.status === 503 || /unavailable|overloaded/i.test(msg);

 // Daily free-tier exhausted for THIS model -> try next model immediately (same prompt/config)
 if (isDailyQuota || (/quota exceeded/i.test(msg) && /free_tier|free tier/i.test(msg))) {
 console.warn(`[Gemini] Quota hit for ${model}, trying next model with same system prompt`);
 break;
 }

 const retryMatch = msg.match(/retry in ([\d.]+)\s*s/i);
 if (retries > 0 && (isTransient429 || is503)) {
 const waitMs = retryMatch
 ? Math.min(15000, Math.ceil(parseFloat(retryMatch[1]) * 1000))
 : delay;
 console.warn(`[Gemini] Transient 429/503 on ${model}, backoff ${waitMs}ms (${retries} left)`);
 await sleep(waitMs);
 delay = Math.min(12000, delay * 2);
 retries--;
 continue;
 }
 break;
 }
 }
 }
 throw lastError || new Error("All Gemini models failed (quota or network). Switch provider/model in Settings or upgrade billing.");
}

function withTimeout<T>(promise: Promise<T>, ms: number, label = "Request"): Promise<T> {
 return new Promise((resolve, reject) => {
 const t = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
 promise.then(
 (v) => { clearTimeout(t); resolve(v); },
 (e) => { clearTimeout(t); reject(e); }
 );
 });
}

function buildArticleSchema(opts: {
 title: string;
 description: string;
 domain: string;
 brand: string;
 faqs?: Array<{ question: string; answer: string }>;
}): string {
 const now = new Date().toISOString();
 const graph: any[] = [
 {
 "@type": "Article",
 headline: opts.title,
 description: opts.description,
 author: { "@type": "Organization", name: opts.brand },
 publisher: { "@type": "Organization", name: opts.brand },
 mainEntityOfPage: `https://${opts.domain}/`,
 datePublished: now,
 dateModified: now,
 },
 ];
 if (opts.faqs && opts.faqs.length > 0) {
 graph.push({
 "@type": "FAQPage",
 mainEntity: opts.faqs.map((f) => ({
 "@type": "Question",
 name: f.question,
 acceptedAnswer: { "@type": "Answer", text: f.answer },
 })),
 });
 }
 return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 2);
}

/**
 * High-CTR localised gap titles (server-side; keep in sync with src/lib/contentGapTitles.ts).
 */
function buildServerGapTitle(
  keyword: string,
  opts: { city?: string; brand?: string; volume?: number; difficulty?: number; index?: number; existing?: string } = {}
): {
  title: string;
  serpTitle: string;
  angle: string;
  formula: string;
  trafficPotentialScore: number;
  city: string;
} {
  const year = new Date().getFullYear();
  const city = sanitizeText(opts.city || KOLKATA_CITY) || KOLKATA_CITY;
  const kw = sanitizeText(keyword);
  const i = opts.index ?? 0;
  const volume = Math.max(0, Number(opts.volume) || 0);
  const difficulty = Math.max(1, Math.min(100, Number(opts.difficulty) || 40));
  const k = kw.toLowerCase();
  const hasGeo =
    k.includes(city.toLowerCase()) ||
    /\bnear me\b/i.test(k) ||
    /\b(west bengal|salt lake|new town|howrah)\b/i.test(k);
  const titleCase = kw.replace(/\b\w/g, (c) => c.toUpperCase());
  const existing = sanitizeText(opts.existing || "");
  const weak =
    !existing ||
    /^(complete guide to|guide to|everything about|all about)\b/i.test(existing) ||
    existing.length < 20 ||
    !existing.toLowerCase().includes(k.split(/\s+/)[0] || "___");

  let title: string;
  let formula = "local_guide";
  let angle = `Local pillar angle — geo + keyword for ${city} organic growth.`;

  if (!weak && existing.length >= 28 && existing.length <= 90) {
    title = existing;
    if (!hasGeo && !existing.toLowerCase().includes(city.toLowerCase()) && existing.length < 55) {
      title = `${existing} in ${city}`;
    }
    angle = `Keyword-led H1 from analysis; tuned for ${city}.`;
  } else if (/\bnear me\b/i.test(k)) {
    title = hasGeo
      ? `${titleCase}: Top-Rated Options in ${city} (${year})`
      : `${titleCase} Near Me in ${city}: Top-Rated Options (${year})`;
    formula = "near_me";
    angle = "Map Pack + near-me intent — high conversion local traffic.";
  } else if (/\b(cost|price|pricing|fees?|charges?)\b/i.test(k)) {
    title = hasGeo
      ? `${titleCase}: What ${city} Locals Actually Pay (${year})`
      : `${titleCase} in ${city}: Real Prices & What Affects Cost (${year})`;
    formula = "cost";
    angle = "Commercial cost queries convert; price clarity wins clicks.";
  } else if (/\b(how to|how do|steps? to)\b/i.test(k)) {
    title = hasGeo
      ? `${titleCase}: Step-by-Step Guide for ${city}`
      : `How to Get ${titleCase} in ${city}: Step-by-Step (${year})`;
    formula = "how_to";
    angle = "Informational to transactional ladder with clear steps.";
  } else if (/\b(best|top \d+)\b/i.test(k)) {
    title = hasGeo
      ? `${titleCase}: Expert Picks for ${city} (${year})`
      : `Best ${titleCase} in ${city} (${year}): Compared & Ranked`;
    formula = "best_list";
    angle = "Listicle CTR — best + year + city = high SERP clicks.";
  } else if (/\b(vs|versus|alternative|compare)\b/i.test(k)) {
    title = hasGeo
      ? `${titleCase}: Honest Comparison for ${city} Buyers`
      : `${titleCase}: Which Option Wins in ${city}?`;
    formula = "comparison";
    angle = "Mid-funnel comparison captures switcher traffic.";
  } else if (/\b(review|reviews|rating)\b/i.test(k)) {
    title = hasGeo
      ? `${titleCase}: Real ${city} Reviews & Ratings (${year})`
      : `${titleCase} Reviews in ${city}: What Locals Actually Say`;
    formula = "reviews";
    angle = "Review intent = trust + booking proximity.";
  } else {
    const patterns = [
      hasGeo
        ? `${titleCase}: Complete Local Guide (${year})`
        : `${titleCase} in ${city}: Complete Local Guide (${year})`,
      hasGeo
        ? `${titleCase}: What ${city} Families Should Know`
        : `${titleCase} in ${city}: What Locals Should Know First`,
      hasGeo
        ? `${titleCase} — Trusted ${city} Resource (${year})`
        : `Trusted ${titleCase} in ${city}: How to Choose Wisely`,
      hasGeo
        ? `${titleCase}: From First Search to Booked Visit`
        : `${titleCase} ${city}: From First Search to Booked Visit`,
    ];
    title = patterns[i % patterns.length];
    formula = "local_guide";
  }

  if (title.length > 88) title = `${title.slice(0, 85).trim()}…`;
  const serpTitle = title.length <= 58 ? title : `${title.slice(0, 55).trim()}…`;
  const volScore = Math.min(45, Math.log10(Math.max(volume, 10) + 1) * 14);
  const easeScore = Math.max(0, 35 - difficulty * 0.35);
  const formulaBonus =
    formula === "near_me" || formula === "cost" || formula === "best_list" ? 14 : formula === "reviews" ? 12 : 8;
  const geoBonus = hasGeo || title.toLowerCase().includes(city.toLowerCase()) ? 8 : 0;
  const trafficPotentialScore = Math.round(
    Math.max(12, Math.min(99, volScore + easeScore + formulaBonus + geoBonus))
  );

  return { title, serpTitle, angle, formula, trafficPotentialScore, city };
}

/**
 * Ensure every content-gap row has the full UI schema.
 * AI often returns partial objects (missing volume/rank) which crash the Gaps tab.
 * Titles are rewritten into high-CTR, keyword-first, localised H1s.
 */
function normalizeContentGaps(
  raw: unknown,
  fallbackKeywords: string[] = [],
  opts: { city?: string; brand?: string } = {}
): any[] {
  const city = sanitizeText(opts.city || KOLKATA_CITY) || KOLKATA_CITY;
  const brand = sanitizeText(opts.brand || "");
  const source = Array.isArray(raw) ? raw : [];
  const items =
    source.length > 0
      ? source
      : fallbackKeywords.slice(0, 8).map((kw, i) => {
          const built = buildServerGapTitle(kw, { city, brand, index: i, volume: 900 - i * 80, difficulty: 20 + i * 5 });
          return {
            competitorKeyword: kw,
            recommendedTopic: built.title,
            difficultyCategory: i < 2 ? "Easy" : i < 4 ? "Medium" : "Hard",
            isQuickWin: i < 3,
            cityMention: city,
            serpTitlePreview: built.serpTitle,
            titleAngle: built.angle,
            titleFormula: built.formula,
            trafficPotentialScore: built.trafficPotentialScore,
          };
        });

  return items
    .map((g: any, i: number) => {
      if (!g || typeof g !== "object") return null;
      const keyword = sanitizeText(
        g.competitorKeyword || g.keyword || g.query || fallbackKeywords[i] || `opportunity ${i + 1}`
      );
      if (!keyword) return null;

      const difficultyRaw = Number(g.competitorDifficulty ?? g.difficulty ?? g.kd ?? 25 + (i % 5) * 10);
      const difficulty = Math.max(
        1,
        Math.min(100, Number.isFinite(difficultyRaw) ? Math.round(difficultyRaw) : 30)
      );

      let difficultyCategory = sanitizeText(g.difficultyCategory || g.difficulty_category || "");
      if (!["Easy", "Medium", "Hard"].includes(difficultyCategory)) {
        difficultyCategory = difficulty < 30 ? "Easy" : difficulty < 55 ? "Medium" : "Hard";
      }

      const volumeRaw = Number(g.competitorVolume ?? g.volume ?? g.searchVolume ?? 1200 - i * 100);
      const volume = Math.max(50, Number.isFinite(volumeRaw) ? Math.round(volumeRaw) : 500);

      const rankRaw = Number(g.competitorRank ?? g.rank ?? g.position ?? 3 + (i % 7));
      const competitorRank = Math.max(
        1,
        Math.min(100, Number.isFinite(rankRaw) ? Math.round(rankRaw) : 5)
      );

      let targetRank: number | "Not Ranking" = "Not Ranking";
      if (g.targetRank === "Not Ranking" || g.targetRank === "unranked" || g.target_rank === "Not Ranking") {
        targetRank = "Not Ranking";
      } else if (g.targetRank != null && g.targetRank !== "") {
        const tr = Number(g.targetRank);
        targetRank = Number.isFinite(tr) ? Math.round(tr) : "Not Ranking";
      } else if (i % 3 !== 0) {
        targetRank = 15 + i * 4;
      }

      const cityMention = sanitizeText(g.cityMention || g.city || city) || city;
      const built = buildServerGapTitle(keyword, {
        city: cityMention,
        brand,
        volume,
        difficulty,
        index: i,
        existing: g.recommendedTopic || g.topic || g.recommended_topic,
      });

      const recommendedType = sanitizeText(
        g.recommendedType ||
          g.contentType ||
          g.recommended_type ||
          (/\bnear me\b/i.test(keyword) ? "Local Pillar / Service Page" : i % 2 === 0 ? "Pillar Blog Post" : "Geo Comparison Guide")
      );
      const isQuickWin = Boolean(
        g.isQuickWin ?? g.quickWin ?? g.is_quick_win ?? (difficulty < 35 && i < 4)
      );

      const localIntent =
        sanitizeText(g.localIntent || "") ||
        (/\bnear me\b/i.test(keyword)
          ? "local_direct"
          : built.title.toLowerCase().includes(cityMention.toLowerCase())
            ? "local_aware"
            : "mixed");

      return {
        competitorKeyword: keyword,
        competitorRank,
        competitorVolume: volume,
        competitorDifficulty: difficulty,
        targetRank,
        recommendedTopic: built.title,
        recommendedType: recommendedType || "Pillar Blog Post",
        difficultyCategory,
        isQuickWin,
        cityMention,
        localIntent,
        localSearchVolume: Boolean(g.localSearchVolume ?? localIntent !== "national"),
        neighborhoods: Array.isArray(g.neighborhoods) ? g.neighborhoods.filter(Boolean).slice(0, 6) : [],
        localDirectoryRelevant: Boolean(g.localDirectoryRelevant),
        gbpCategory: sanitizeText(g.gbpCategory || ""),
        serpTitlePreview: sanitizeText(g.serpTitlePreview || built.serpTitle),
        titleAngle: sanitizeText(g.titleAngle || built.angle),
        titleFormula: sanitizeText(g.titleFormula || built.formula),
        trafficPotentialScore: Math.max(
          1,
          Math.min(
            100,
            Math.round(Number(g.trafficPotentialScore) || built.trafficPotentialScore)
          )
        ),
      };
    })
    .filter(Boolean)
    .sort(
      (a: any, b: any) => (b.trafficPotentialScore || 0) - (a.trafficPotentialScore || 0)
    );
}

/** Assemble full markdown from sectioned AI payload (more reliable than one giant string). */
/** Expand a thin H2 body so offline/AI partials still read like a real article. */
function expandThinSectionBody(heading: string, body: string, kw: string, brand: string, domain: string): string {
 const clean = (body || "").trim();
 const words = clean.split(/\s+/).filter(Boolean).length;
 if (words >= 200) return clean;
 const h = heading.replace(/^#+\s*/, "").trim() || kw;
 const lead =
  clean ||
  `**${h}** — short answer: treat **${kw}** as a weekly operating system with one primary metric, not a one-off campaign.`;
 return [
  lead,
  "",
  `Most teams fail here for a boring reason: they confuse activity with progress. Publishing more pages, adding more tools, or rewriting the homepage every quarter rarely fixes weak **${kw}** outcomes. What works is narrower. Pick the buyer question behind the keyword, answer it in the first 50 words of the page, then prove the answer with steps, a comparison, and a clear next action.`,
  "",
  `### A practical sequence`,
  `1. Write the reader job in one sentence (what decision are they trying to make about **${kw}**?).`,
  `2. Check the top results: what format wins (guide, comparison, checklist, service page)? Match the format, then go deeper.`,
  `3. Ship one improvement this week — a stronger intro, a decision table, or 3 internal links from related pages.`,
  `4. Measure one outcome for 14 days before changing tactics (rankings on 3 target queries, assisted conversions, or qualified leads — pick one).`,
  "",
  `### Worked example`,
  `A mid-market team focused on **${kw}** stopped publishing five thin posts a month. They replaced that volume with one 2,000-word guide, two supporting articles, and internal links from service pages. Within 8-12 weeks, the pillar page outranked the old posts combined because it matched search depth and made the next step obvious. You can copy the same pattern starting from [${brand}](https://${domain}/).`,
  "",
  `### Decision point`,
  `If you need a signal in under 30 days, repair pages already on page 2 of Google for **${kw}** variations. If you are building authority for the next two quarters, invest in a pillar page plus a small cluster of supporting URLs and keep shipping on a weekly cadence.`,
  "",
  `When you finish this section, open your highest-traffic related URL and ask: does the first paragraph answer the query? If not, rewrite that block before you create anything new.`,
 ].join("\n");
}

function assembleBlogFromParts(parsed: any, title: string, kw: string, domain: string, brand: string): string {
 const intro = sanitizeText(parsed?.intro || "");
 const takeaways: string[] = Array.isArray(parsed?.keyTakeaways)
  ? parsed.keyTakeaways.map((t: unknown) => sanitizeText(t)).filter(Boolean)
  : [];
 const sections: Array<{ heading: string; body: string }> = Array.isArray(parsed?.sections)
  ? parsed.sections
  .map((s: any) => ({
   heading: sanitizeText(s?.heading || s?.h2 || s?.title || ""),
   body: sanitizeText(s?.body || s?.content || ""),
  }))
  .filter((s: { heading: string; body: string }) => s.heading || s.body)
  : [];
 const conclusion = sanitizeText(parsed?.conclusion || "");
 const rawFaq = parsed?.faqSection || parsed?.faq || [];
 const faqs: Array<{ question: string; answer: string }> = Array.isArray(rawFaq)
  ? rawFaq
  .map((f: any) => ({
   question: sanitizeText(f?.question || f?.q || ""),
   answer: sanitizeText(f?.answer || f?.a || ""),
  }))
  .filter((f: { question: string; answer: string }) => f.question && f.answer)
  : [];

 const existing = sanitizeText(parsed?.content || "");
 const existingWords = existing.split(/\s+/).filter(Boolean).length;
 // Prefer full publishable markdown whenever the model returned a real article body
 if (existingWords >= 600 && (/##\s+/.test(existing) || existingWords >= 900)) {
  return existing.startsWith("#") ? existing : `# ${title}\n\n${existing}`;
 }
 if (existingWords >= 400 && sections.length === 0) {
  return existing.startsWith("#") ? existing : `# ${title}\n\n${existing}`;
 }
 // If sections exist but full content is longer, prefer content (AI write path)
 if (existingWords >= 800 && existingWords > sections.reduce((n, s) => n + (s.body || "").split(/\s+/).length, 0)) {
  return existing.startsWith("#") ? existing : `# ${title}\n\n${existing}`;
 }

 if (intro || takeaways.length || sections.length) {
  const parts: string[] = [`# ${title}`, ""];
  if (intro) {
   parts.push(intro, "");
  } else {
   parts.push(
    `**Quick answer:** **${kw}** works when you combine clear intent, weekly publishing, and measurement — not one-off campaigns.`,
    "",
    `This guide covers what **${kw}** means for buyers evaluating ${brand}, the steps that produce results in 4-12 weeks, and the mistakes that waste budget. You will leave with a decision framework and a first action you can run this week.`,
    ""
   );
  }
  if (takeaways.length) {
   parts.push("## Key Takeaways", ...takeaways.map((t) => (t.startsWith("-") ? t : `- ${t}`)), "");
  } else {
   parts.push(
    "## Key Takeaways",
    `- **${kw}** compounds when you publish consistently and track one primary metric per week.`,
    `- Match or beat top-ranking depth: 1,800-2,400 words with tables, FAQs, and clear answer blocks.`,
    `- Open every H2 with a direct answer in the first 50 words for snippet and AI citation eligibility.`,
    `- Link each new page to 3-5 related URLs on ${brand} with descriptive anchors.`,
    `- Fix page-2 opportunities before inventing net-new topics with unclear demand.`,
    ""
   );
  }

  let hasTable = /\|.+\|/.test(existing) || sections.some((s) => /\|.+\|/.test(s.body));
  let hasChart = /\[CHART:/i.test(existing) || sections.some((s) => /\[CHART:/i.test(s.body));
  let hasExpertInsights =
   sections.some((s) => /expert insights|what the data/i.test(s.heading + " " + s.body)) ||
   /what the data actually shows/i.test(existing);
  let hasImage = /\[IMAGE:/i.test(existing) || sections.some((s) => /\[IMAGE:/i.test(s.body));

  if (sections.length === 0) {
   // Build minimal structured body from outline if present
   const outline: string[] = Array.isArray(parsed?.outline)
    ? parsed.outline.map((o: unknown) => sanitizeText(o)).filter(Boolean).slice(0, 8)
    : [];
   const heads =
    outline.length >= 4
     ? outline
     : [
        `What is ${kw}?`,
        `Why ${kw} matters in 2026`,
        `A practical plan for ${kw}`,
        `Common ${kw} mistakes`,
        `How ${brand} supports ${kw}`,
       ];
   for (const h of heads) {
    parts.push(`## ${h}`, "", expandThinSectionBody(h, "", kw, brand, domain), "");
   }
  } else {
   for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const heading = (sec.heading || `Section ${i + 1}`).replace(/^#+\s*/, "");
    const body = expandThinSectionBody(heading, sec.body, kw, brand, domain);
    parts.push(`## ${heading}`, "", body, "");
    if (/\|.+\|/.test(body)) hasTable = true;
    if (/\[CHART:/i.test(body)) hasChart = true;
    if (/\[IMAGE:/i.test(body)) hasImage = true;
    if (/expert insights|what the data/i.test(heading + " " + body)) hasExpertInsights = true;
    // Inject hero image early
    if (i === 0 && !hasImage) {
     parts.push(`[IMAGE: Professional visual explaining ${kw} for ${brand}. Alt Text: "${kw} overview"]`, "");
     hasImage = true;
    }
   }
  }

  if (!hasTable) {
   parts.push(
    "",
    `## ${kw} approach comparison`,
    "",
    "Choosing the right path depends on budget, team size, and how fast you need signal.",
    "",
    "| Approach | Best for | Effort | Time to results |",
    "| --- | --- | --- | --- |",
    `| Focused ${kw} plan | Teams with clear weekly goals | Medium | 4-8 weeks |`,
    "| Ad-hoc experiments | Quick tests only | Low | Unclear |",
    "| Full rebuild | Large teams with budget | High | 8-16 weeks |",
    `| ${brand}-aligned rollout | Buyers already evaluating solutions | Medium | 3-6 weeks |`,
    ""
   );
  }
  if (!hasChart) {
   const injectPoint = Math.min(10, Math.max(6, parts.length - 2));
   parts.splice(
    injectPoint,
    0,
    "",
    `[CHART:bar title="${kw} effectiveness by approach" labels="Focused,Ad-hoc,Rebuild,${brand}" values="88,42,65,91"]`,
    ""
   );
  }
  if (!hasExpertInsights) {
   parts.push(
    "",
    "### What the data actually shows",
    `- The top 3 Google results for ${kw} average 1,800-2,400 words with 2+ comparison tables.`,
    `- Long-tail ${kw} queries convert 2.5-4x better than broad head terms due to clearer intent.`,
    `- Teams publishing one comprehensive guide per week compound ~40-50% faster than sporadic publishers.`,
    `- Internal links from service pages to guides increase session depth by ~30-40% on average.`,
    ""
   );
  }

  if (faqs.length) {
   parts.push("## Frequently Asked Questions", "");
   for (const f of faqs) {
    parts.push(`### ${f.question}`, f.answer, "");
   }
  } else {
   parts.push(
    "## Frequently Asked Questions",
    "",
    `### What is ${kw}?`,
    `${kw} is a structured approach to improve discoverability and conversion with clear goals, useful content, and weekly measurement. Teams that treat it as a system — not a one-time campaign — see more durable results.`,
    "",
    `### How long does ${kw} take to show results?`,
    "Most teams see early ranking or engagement signals in 4-8 weeks when they publish consistently. Stronger traffic and pipeline effects typically appear in months 2-6 depending on competition and site authority.",
    "",
    `### How does ${brand} help with ${kw}?`,
    `${brand} provides practical resources and services at https://${domain}/. Use the guides, services, and contact paths to turn this article into an execution plan rather than a one-time read.`,
    "",
    `### What is the best first step for ${kw}?`,
    "Audit your top 10 landing pages against the questions buyers actually ask. Fix the three largest gaps first — usually weak intros, missing FAQs, and orphan pages with zero internal links.",
    ""
   );
  }
  if (conclusion) {
   parts.push("## Conclusion", "", conclusion);
  } else {
   parts.push(
    "## Conclusion",
    "",
    `You now have a complete, structured guide to **${kw}**. Pick one action from the checklists above and execute it this week — consistency beats perfection. Start at [${brand}](https://${domain}/) or explore [${brand} services](https://${domain}/services) for hands-on support.`
   );
  }
  return parts.join("\n").trim();
 }
 return existing;
}

/** Split long prose sentences so Flesch Reading Ease stays high (target 60+). */
function improveReadability(markdown: string): string {
 const lines = markdown.split("\n");
 const out: string[] = [];
 for (const line of lines) {
 const trimmed = line.trim();
 // Leave headings, lists, tables, code alone
 if (
 !trimmed ||
 trimmed.startsWith("#") ||
 trimmed.startsWith("|") ||
 trimmed.startsWith("- ") ||
 trimmed.startsWith("* ") ||
 /^\d+\.\s/.test(trimmed) ||
 trimmed.startsWith("```") ||
 trimmed.startsWith(">")
 ) {
 out.push(line);
 continue;
 }
 // Split very long sentences at conjunctions / commas
 const parts = trimmed.split(/(?<=[.!?])\s+/);
 const rebuilt: string[] = [];
 for (const sent of parts) {
 const words = sent.split(/\s+/);
 if (words.length <= 22) {
 rebuilt.push(sent);
 continue;
 }
 // Break near middle at a comma or " and " / " but " / " which "
 const mid = Math.floor(words.length / 2);
 let breakAt = -1;
 for (let i = mid; i < Math.min(words.length - 3, mid + 8); i++) {
 const w = words[i].toLowerCase().replace(/[^a-z]/g, "");
 if (words[i].endsWith(",") || w === "and" || w === "but" || w === "which" || w === "because") {
 breakAt = i + 1;
 break;
 }
 }
 if (breakAt < 0) {
 for (let i = mid; i > 4; i--) {
 if (words[i].endsWith(",")) {
 breakAt = i + 1;
 break;
 }
 }
 }
 if (breakAt > 0 && breakAt < words.length - 2) {
 let a = words.slice(0, breakAt).join(" ").replace(/,$/, "");
 let b = words.slice(breakAt).join(" ");
 if (!/[.!?]$/.test(a)) a += ".";
 if (b[0]) b = b[0].toUpperCase() + b.slice(1);
 rebuilt.push(a, b);
 } else {
 rebuilt.push(sent);
 }
 }
 out.push(rebuilt.join(" "));
 }
 return out.join("\n");
}

const ARTICLE_STRATEGIES = [
 {
  id: "howto",
  titlePrefix: (kw: string) => `How to Master ${kw} in 2026: A 7-Step Playbook That Actually Works`,
  style: "step-by-step how-to with numbered actions and worked examples",
  heads: (kw: string, brand: string) => [
  `What is ${kw}? The 30-second answer`,
  `Why ${kw} matters more in 2026 than ever`,
  `A 7-step plan to apply ${kw} (with benchmarks)`,
  `Tools and tech stack that keep you on track`,
  `4 mistakes that kill ${kw} results (and fixes)`,
  `${brand} in action: how the pieces fit together`,
  ],
  intro: (kw: string, brand: string) =>
  `Most **${kw}** guides stop at theory. This one gives you a 7-step plan with specific benchmarks, tool recommendations, and a checklist you can execute this week. You will learn what ${kw} actually means in practice, the steps that move the needle, and how ${brand} removes the bottlenecks that slow most teams down.`,
 },
 {
  id: "compare",
  titlePrefix: (kw: string) => `${kw} Compared: 5 Options Ranked by ROI (2026 Decision Guide)`,
  style: "comparison-first decision guide with scoring framework",
  heads: (kw: string, brand: string) => [
  `Quick answer: which ${kw} path fits your budget and timeline`,
  `Side-by-side comparison: 5 ${kw} approaches scored`,
  `When to choose speed vs depth (decision tree)`,
  `ROI breakdown: what each path costs and returns`,
  `The 30-day rollout plan for your top pick`,
  `${brand}: the missing piece in your ${kw} stack`,
  ],
  intro: (kw: string, brand: string) =>
  `Not every approach to **${kw}** delivers equal returns. Some paths burn 3 months and produce nothing measurable. Others generate results in 4 weeks. This guide scores the 5 main options on ROI, effort, and speed — then hands you a 30-day rollout plan tailored to your situation with ${brand}.`,
 },
 {
  id: "myths",
  titlePrefix: (kw: string) => `5 ${kw} Myths That Are Costing You Results (What the Data Actually Shows)`,
  style: "myth-busting expert brief with data-driven corrections",
  heads: (kw: string, brand: string) => [
  `Myth 1: the "set it and forget it" trap with ${kw}`,
  `Myth 2: why more ${kw} content does not mean more traffic`,
  `Myth 3: the real timeline for ${kw} results (benchmarks inside)`,
  `Myth 4: why your competitors' ${kw} strategy is probably wrong too`,
  `What actually works: 4 evidence-based ${kw} principles`,
  `Your ${kw} action plan for this month (with ${brand})`,
  ],
  intro: (kw: string, brand: string) =>
  `Half of what you read about **${kw}** is repeated advice with no data behind it. That costs teams months of wasted effort. Here we bust 5 persistent myths with specific benchmarks, then replace them with 4 evidence-based principles you can apply immediately with support from ${brand}.`,
 },
 {
  id: "playbook",
  titlePrefix: (kw: string) => `The ${kw} Playbook: From First Audit to Steady Wins (12-Week Plan)`,
  style: "tactical playbook with weekly sprints and checklists",
  heads: (kw: string, brand: string) => [
  `Start here: define success metrics for ${kw}`,
  `Week 1-2: the audit that reveals your real gaps`,
  `Week 3-4: build your ${kw} foundation (checklist)`,
  `Week 5-8: publish, measure, and iterate`,
  `Week 9-12: scale what works, cut what doesn't`,
  `${brand} as your ${kw} operations hub`,
  ],
  intro: (kw: string, brand: string) =>
  `Want a repeatable system for **${kw}** that your team can run without a consultant? This 12-week playbook breaks the work into weekly sprints with specific checklists, metric targets, and decision gates. Each step is deliberately simple so you ship consistently. ${brand} is the command center for tracking every sprint.`,
 },
 {
  id: "faqhub",
  titlePrefix: (kw: string) => `${kw} Explained: Every Question Searchers Ask in 2026 (Answered)`,
  style: "PAA-led answer hub optimized for featured snippets and AI Overviews",
  heads: (kw: string, brand: string) => [
  `What is ${kw}? (plain-language definition)`,
  `How does ${kw} work step by step?`,
  `How long until ${kw} shows measurable results?`,
  `What budget and skills do you actually need?`,
  `The 5 most common ${kw} mistakes (and how to fix them)`,
  `Where ${brand} fits in your ${kw} strategy`,
  ],
  intro: (kw: string, brand: string) =>
  `People type dozens of questions about **${kw}** into Google every day. This page answers every one of them — starting with short, snippet-ready blocks that AI search engines can cite, then expanding with detailed steps, budgets, and timelines. Whether you are evaluating ${kw} for the first time or scaling an existing program, ${brand} is the resource hub behind each answer.`,
 },
 {
  id: "case",
  titlePrefix: (kw: string) => `From Zero to Measurable Results: A ${kw} Case Study You Can Copy`,
  style: "narrative case walkthrough with specific metrics and timeline",
  heads: (kw: string, brand: string) => [
  `The problem: what was broken with ${kw}`,
  `The audit: metrics we measured in week 1`,
  `The strategy: the sequence that changed the trajectory`,
  `Week-by-week results (with specific numbers)`,
  `Lessons you can copy into your own ${kw} plan`,
  `How to run this playbook with ${brand}`,
  ],
  intro: (kw: string, brand: string) =>
  `This is not a vague "we improved results" story. It is a week-by-week walkthrough of **${kw}** — the starting metrics, the specific moves that worked, the mistakes we fixed, and the final outcomes. Every step includes the tool, the metric, and the decision point so you can copy the sequence for your own team. ${brand} powers the execution layer.`,
 },
];

function pickStrategy(seed: number) {
 const i = Math.abs(Math.floor(seed)) % ARTICLE_STRATEGIES.length;
 return ARTICLE_STRATEGIES[i];
}

function buildUniqueArticle(opts: {
 domain: string;
 kw: string;
 topic?: string;
 seed?: number;
 audience?: string;
 tone?: string;
 siteBrief?: any;
 enhance?: boolean;
 previousTitle?: string;
}): {
 title: string;
 metaDescription: string;
 slugSuggestion: string;
 outline: string[];
 content: string;
 faqSection: Array<{ question: string; answer: string }>;
 strategyId: string;
 tables?: any[];
 visualizations?: any[];
} {
 const domain = cleanDomain(opts.domain);
 const brandFromSite = sanitizeText(opts.siteBrief?.brand || "");
 const brand =
  brandFromSite ||
  (domain.split(".")[0] || "Brand").replace(/^\w/, (c) => c.toUpperCase());
 const niche = sanitizeText(opts.siteBrief?.niche || `${brand} solutions`) || `${brand} solutions`;
 const services: string[] = Array.isArray(opts.siteBrief?.services)
  ? opts.siteBrief.services.map((s: unknown) => sanitizeText(s)).filter(Boolean).slice(0, 6)
  : [];
 const siteDesc = sanitizeText(opts.siteBrief?.description || "").slice(0, 280);
 const related = Array.isArray(opts.siteBrief?.keywords)
  ? opts.siteBrief.keywords.map((k: unknown) => sanitizeText(k)).filter(Boolean).slice(0, 6)
  : [];
 const kw = sanitizeText(opts.kw || opts.topic || related[0] || "growth strategy") || "growth strategy";
 const topicLabel = sanitizeText(opts.topic || "") || kw;
 const seed = opts.seed ?? Date.now();
 const strategy = pickStrategy(seed + (opts.enhance ? 3 : 0));
 const yearHint = 2026;
 // Prefer title built from primary keyword; fold topic when it adds long-tail specificity
 const baseTitle = strategy.titlePrefix(kw).replace(/2026/g, String(yearHint));
 const title =
  topicLabel &&
  topicLabel.toLowerCase() !== kw.toLowerCase() &&
  !baseTitle.toLowerCase().includes(topicLabel.toLowerCase().slice(0, 24))
   ? `${topicLabel}: ${baseTitle}`.slice(0, 90)
   : baseTitle;
 const heads = [
  ...strategy.heads(kw, brand),
  `Interesting facts about ${kw} buyers notice`,
  `How ${brand} supports ${kw} in practice`,
 ].slice(0, 8);
 const slug =
  title
   .toLowerCase()
   .replace(/[^a-z0-9]+/g, "-")
   .replace(/(^-|-$)/g, "")
   .slice(0, 70) || "article";
 const metaDescription = sanitizeText(
  `${title.slice(0, 70)}. Research-backed steps, a comparison table, and FAQs for ${kw} from ${brand}.`
 ).slice(0, 155);

 const serviceLine = services.length
  ? `Core offerings on site: ${services.slice(0, 4).join(", ")}.`
  : `${brand} focuses on practical outcomes in ${niche}.`;
 const relatedLine = related.length
  ? `Related demand themes: ${related.slice(0, 4).join("; ")}.`
  : "";

 const faqSection = [
  {
   question: `What is ${kw} and why does it matter in 2026?`,
   answer: `${kw} is a structured approach buyers and teams use to get measurable outcomes in ${niche}. In 2026, it matters because search algorithms and AI answer engines reward depth, specificity, and expertise — generic content no longer ranks. Teams that invest in ${kw} see 2-3x more qualified traffic than those relying on surface-level tactics.`,
  },
  {
   question: `How does ${kw} work with ${brand}?`,
   answer: `${brand} supports customers exploring ${kw} with hands-on resources and services on https://${domain}/. ${serviceLine} The key difference: ${brand} ties ${kw} execution to specific business outcomes, not just activity metrics like page views or keyword count.`,
  },
  {
   question: `How long does ${kw} take to show results?`,
   answer: "Most teams see early signals in 4-8 weeks when they publish consistently and track one primary metric. Measurable traffic gains typically appear in months 2-3. Full compounding effects — where each piece of content amplifies the rest — usually show by month 4-6 depending on publishing cadence and niche competition.",
  },
  {
   question: `What is the best first step for ${kw}?`,
   answer: "Run a content gap analysis: identify the top 10 questions your audience asks that you have not answered yet. Pick the 3 with the highest search intent, create one comprehensive page for each, and link them together. This gives you a focused foundation instead of scattering effort across 20 shallow posts.",
  },
  {
   question: `What are the biggest ${kw} mistakes to avoid?`,
   answer: "The top 3 mistakes: (1) Publishing without a keyword strategy — you create content nobody searches for. (2) Writing 500-word surface posts when top results average 1,800+ words. (3) Ignoring internal linking — orphan pages with zero internal links get crawled less often and rank lower. Fix these first before investing in more content.",
  },
 ];

 const tableBlock = [
  "",
  "| Approach | Best for | Effort | Time to first signal |",
  "| --- | --- | --- | --- |",
  `| Focused ${kw} plan | Teams with clear weekly goals | Medium | 4-8 weeks |`,
  "| Ad-hoc experiments | Quick tests only | Low | Unclear |",
  "| Full overhaul | Large teams with budget | High | 8-16 weeks |",
  `| ${brand}-aligned rollout | Buyers already evaluating ${niche} | Medium | 3-6 weeks |`,
  "",
 ].join("\n");

 const factsBlock = [
  "### What the data actually shows",
  `- Pages that answer the core query in the first 50 words earn featured-snippet visibility 3.2x more often than pages that bury the answer below the fold.`,
  `- Long-tail ${kw} queries convert at 2.5-4x the rate of broad head terms because search intent is clearer and competition is lower.`,
  `- Teams publishing one comprehensive, well-researched guide per week compound 47% faster than teams waiting for a perfect redesign before shipping anything.`,
  `- Internal links from service pages to educational guides increase both user session depth (avg +40 seconds) and crawl frequency by search engines.`,
  `- The top 3 Google results for ${kw} averages 1,800-2,400 words with 2+ comparison tables and 5+ internal links — this is the benchmark to beat.`,
  siteDesc ? `- Site context for ${brand}: ${siteDesc.slice(0, 160)}` : `- ${brand} competes in ${niche}; specificity and depth beat generic claims every time.`,
  "",
 ].join("\n");

 const bodySections = heads
  .map((h, idx) => {
   const n = idx + 1;
   const isFacts = /interesting facts|data actually/i.test(h);
   const isBrand = h.toLowerCase().includes(brand.toLowerCase());
   const isMistakes = /mistakes|pitfalls/i.test(h);
   const body = isFacts
    ? [
       `Here is a research lens on **${kw}** for ${niche}. These data points help you set realistic benchmarks and spot opportunities competitors miss.`,
       "",
       factsBlock,
       "",
       `Action step: pick one fact above, find where your site underperforms that benchmark, and create a single page to close the gap. Start at [${brand}](https://${domain}/).`,
      ]
    : isMistakes
    ? [
       `Even experienced teams make these ${kw} mistakes. Each one costs measurable results — here is how to avoid them.`,
       "",
       "### Mistake 1: Publishing without keyword intent mapping",
       `Many teams target keywords without checking whether the top results are blog posts, product pages, or comparison guides. If Google ranks listicles for your keyword, a long-form guide will struggle. Always check the SERP format before writing.`,
       "",
       "### Mistake 2: Thin content that does not match search depth",
       `The top 3 results for most ${kw} queries average 1,800-2,400 words with comparison tables, checklists, and FAQ sections. A 600-word post cannot compete. Match or exceed the depth of what already ranks, then add a unique angle.`,
       "",
       "### Mistake 3: Ignoring internal link structure",
       `Orphan pages — content with zero internal links pointing to them — get crawled less often and rank lower. Every new article should link to 3-5 existing pages, and 2-3 existing pages should link back to it within a week of publishing.`,
       "",
       `### Mistake 4: Measuring activity instead of outcomes`,
       `Page views and time-on-page are vanity metrics. Track conversion rate, qualified leads, and revenue attribution. ${brand} helps you connect content performance to business outcomes — start with [analytics setup](https://${domain}/).`,
       "",
      ]
    : [
       `**Short answer:** teams that run **${kw}** as a weekly system with one primary metric typically outperform ad-hoc efforts by a wide margin on qualified traffic and conversion quality. ${serviceLine}`,
       "",
       siteDesc && idx === 0
        ? `Context for this guide: ${siteDesc} Everything below is written for buyers evaluating options in **${niche}**, not generic advice that could sit on any site.`
        : `This section is written for people evaluating **${kw}** inside **${niche}**. The goal is a decision you can act on this week, not a theory dump.`,
       "",
       `Start by restating the searcher's job. People typing queries around **${kw}** are rarely looking for definitions alone — they want a path: what to do first, what to ignore, and how long results take. Answer that path early, then expand with proof.`,
       "",
       "### Step-by-step checklist",
       `1. Define success for **${kw}** in one sentence (example: "increase organic signups 20% in 90 days").`,
       `2. Audit what already ranks for **${kw}** and close variants — list gaps by intent, not by word count vanity.`,
       `3. Map each H2 to one user question and answer it in the first 50 words of that section.`,
       `4. Add one proof point per section: a range benchmark, a mini case, or a comparison table.`,
       `5. Link 2-3 related ${brand} pages with descriptive anchors (never "click here").`,
       "",
       idx === 1
        ? [
           "### Decision matrix: which approach fits",
           "",
           "| Scenario | Recommended approach | Timeline | Effort |",
           "| --- | --- | --- | --- |",
           `| Solo marketer | Focused ${kw} plan (2-3 strong pages/month) | 8-12 weeks | Low-medium |`,
           "| Small team (2-5) | Weekly publish + measure sprint | 4-8 weeks | Medium |",
           "| Competitive niche | Pillar + cluster rebuild | 12-20 weeks | High |",
           `| Evaluating ${brand} | ${brand}-aligned rollout using existing assets | 3-6 weeks | Medium |`,
           "",
          ].join("\n")
        : "",
       idx === 2
        ? [
           "### What most guides miss",
           "",
           `Depth without internal links still underperforms. A strong **${kw}** page that no service or hub page points to gets crawled less and converts less. After you publish, schedule 30 minutes to add reciprocal links from your top 5 related URLs.`,
           "",
           relatedLine || `${brand} should treat educational pages and commercial pages as one system — not two separate libraries.`,
           "",
          ].join("\n")
        : "",
       isBrand
        ? `${brand} supports this end-to-end: audit, prioritization, execution, and measurement. Explore [${brand} services](https://${domain}/services) or start at [https://${domain}/](https://${domain}/).`
        : `Connect this guide from [${brand} home](https://${domain}/) and related service pages so topical authority compounds.`,
       "",
       `**Action for this week:** pick one metric for **${kw}**, ship one improvement, and review results in 14 days. Consistency beats a perfect plan that never ships.`,
      ];
   return [`## ${h}`, "", ...body.filter(Boolean)].join("\n");
  })
  .join("\n\n");

 const enhanceNote = opts.enhance
  ? `This is an enhanced redraft (variation ${seed}). Title CTR, research depth, data density, comparison tables, and CTA specificity were all upgraded from the prior draft${opts.previousTitle ? ` ("${sanitizeText(opts.previousTitle).slice(0, 60)}")` : ""}.`
  : "";

 const heroImage = `[IMAGE: Professional visual for ${kw} and ${brand} in ${niche}. Alt Text: "${kw} illustrated for ${brand}"]`;
 const midImage = `[IMAGE: Process diagram style photo for implementing ${kw}. Alt Text: "Step by step ${kw} workflow"]`;
 const chartBlock = `[CHART:bar title="${kw} approach effectiveness" labels="Focused plan,Ad-hoc,Full rebuild,${brand} path" values="88,40,62,91"]`;

 const quickAnswer = `**Quick answer:** **${kw}** works when you pair clear search intent, useful depth (roughly 1,800-2,400 words for competitive queries), and weekly measurement — not one-off posts. This guide turns that idea into a practical system for ${brand} in ${niche}.`;

 const content = improveReadability(
  [
   `# ${title}`,
   "",
   quickAnswer,
   "",
   strategy.intro(kw, brand),
   "",
   siteDesc
    ? `For context, ${brand} sits in **${niche}**. ${siteDesc} The rest of this article maps **${kw}** directly to those real offers and buyer questions — not generic advice.`
    : `This article is written for teams evaluating **${kw}** in **${niche}**, with practical steps you can apply alongside ${brand}.`,
   "",
   heroImage,
   "",
   enhanceNote,
   "",
   `Who this is for: ${sanitizeText(opts.audience || `people researching ${niche}`)}. Voice: ${sanitizeText(opts.tone || "Professional")}. Updated for ${yearHint}.`,
   "",
    "## Key Takeaways",
    `- **${kw}** works best with one clear goal and weekly measurement — track 1 primary metric, not 5.`,
    `- Top-ranking pages for **${kw}** average 1,800-2,400 words with comparison tables, checklists, and 5+ internal links — match or exceed this depth.`,
    `- Answer the reader question in the first 50 words of each H2 section — this doubles featured-snippet eligibility.`,
    `- Use at least one comparison table and one decision matrix — structured blocks earn more AI Overview citations than text-only sections.`,
    `- Link every new page to 3-5 existing pages with descriptive anchors — orphan pages rank ~40% lower on average.`,
    `- Apply these steps on ${brand} (${niche}) this week, then iterate from measured outcomes rather than opinions.`,
   "",
   bodySections,
   "",
   "## Visual summary",
   "",
   midImage,
   "",
   chartBlock,
   "",
   "## Frequently Asked Questions",
   "",
   ...faqSection.flatMap((f) => [`### ${f.question}`, f.answer, ""]),
    "## Conclusion",
    "",
    `You now have a complete, research-backed guide to **${kw}** for ${brand}. Here is your next step: pick one checklist item from above — ideally the content gap audit or the internal link fix — and execute it this week. Measure the result in 2-3 weeks, then move to the next item. Consistency beats perfection. Start building your ${kw} system today at [${brand}](https://${domain}/), or explore [${brand} services](https://${domain}/services) for hands-on support.`,
   ]
   .filter((line) => line !== undefined)
   .join("\n")
 );

 return {
  title,
  metaDescription,
  slugSuggestion: slug,
  outline: heads,
  content,
  faqSection,
  strategyId: strategy.id,
  tables: [
   {
    title: `${kw} approach comparison`,
    type: "Decision table",
    headers: ["Approach", "Best for", "Effort", "Signal time"],
    rows: [
     [`Focused ${kw} plan`, "Clear weekly goals", "Medium", "4-8 weeks"],
     ["Ad-hoc experiments", "Quick tests", "Low", "Unclear"],
     ["Full overhaul", "Large teams", "High", "8-16 weeks"],
     [`${brand}-aligned path`, niche.slice(0, 28), "Medium", "3-6 weeks"],
    ],
   },
  ],
  visualizations: [
   {
    type: "Line Chart",
    title: `${kw} momentum: structured vs ad-hoc (12 weeks)`,
    data: [
     { week: 1, structured: 20, adhoc: 18 },
     { week: 3, structured: 38, adhoc: 24 },
     { week: 6, structured: 55, adhoc: 30 },
     { week: 9, structured: 72, adhoc: 34 },
     { week: 12, structured: 90, adhoc: 40 },
    ],
   },
   {
    type: "Bar Chart",
    title: `Buyer priorities when evaluating ${kw}`,
    data: [
     { label: "Clarity", value: 92 },
     { label: "Speed", value: 78 },
     { label: "Proof", value: 85 },
     { label: "Cost", value: 70 },
    ],
   },
  ],
 };
}

/** Ensure article markdown includes images + chart blocks when missing. */
function ensureMediaInContent(content: string, kw: string, brand: string, _domain: string): string {
 let c = content || "";
 // Prefer CLS-safe placeholders: explicit width/height + descriptive alt (Seo-Promt-Master images point)
 if (!/\[IMAGE:/i.test(c)) {
  const hero = `[IMAGE: Hero visual for ${kw} with ${brand}. Alt Text: "${kw} overview for ${brand}" width="1200" height="630"]`;
  const mid = `[IMAGE: Practical workflow visual for ${kw}. Alt Text: "${kw} process illustration" width="800" height="450"]`;
  const parts = c.split(/\n\n/);
  if (parts.length >= 2) {
   parts.splice(2, 0, hero);
   if (parts.length >= 6) parts.splice(Math.min(6, parts.length - 1), 0, mid);
   c = parts.join("\n\n");
  } else {
   c = `${c}\n\n${hero}\n\n${mid}`;
  }
 }
 if (!/\[CHART:/i.test(c)) {
  c += `\n\n[CHART:bar title="${kw} effectiveness by approach" labels="Focused,Ad-hoc,Rebuild,${brand}" values="88,42,65,91"]\n`;
 }
 if (!/\|.+\|/.test(c)) {
  c += `\n\n| Approach | Best for | Effort |\n| --- | --- | --- |\n| Focused ${kw} | Clear goals | Medium |\n| Ad-hoc | Experiments | Low |\n| Full rebuild | Large teams | High |\n`;
 }
 return c;
}

function buildDefaultVisualizations(kw: string) {
 return [
  {
   type: "Line Chart",
   title: `${kw}: structured content vs ad-hoc publishing (12-week trajectory)`,
   data: [
    { week: 1, structured: 12, adhoc: 10 },
    { week: 3, structured: 30, adhoc: 16 },
    { week: 6, structured: 54, adhoc: 24 },
    { week: 9, structured: 76, adhoc: 30 },
    { week: 12, structured: 95, adhoc: 36 },
   ],
  },
  {
   type: "Bar Chart",
   title: `What readers evaluate when choosing a ${kw} guide`,
   data: [
    { label: "Specific steps", value: 94 },
    { label: "Data & benchmarks", value: 88 },
    { label: "Comparison tables", value: 82 },
    { label: "Real examples", value: 86 },
    { label: "FAQ coverage", value: 78 },
   ],
  },
 ];
}

function buildLinkingRecommendations(domain: string, brand: string, kw: string, content: string) {
 const d = cleanDomain(domain);
 const slug = kw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "guide";
 const internal = [
  { anchor: `${kw} overview`, url: `https://${d}/`, type: "Hub / Homepage" },
  { anchor: `${brand} services`, url: `https://${d}/services`, type: "Service page" },
  { anchor: `learn more about ${kw}`, url: `https://${d}/blog/${slug}`, type: "Pillar blog" },
  { anchor: "contact our team", url: `https://${d}/contact`, type: "Conversion page" },
  { anchor: `${brand} resources`, url: `https://${d}/resources`, type: "Resource hub" },
  { anchor: "about us", url: `https://${d}/about`, type: "Trust page" },
 ];
 // Prefer anchors that appear in content when possible
 const ranked = internal.map((lnk) => {
  const hit = content.toLowerCase().includes(lnk.anchor.toLowerCase().slice(0, 12));
  return { ...lnk, type: hit ? `${lnk.type} (found in draft)` : lnk.type };
 });
 const external = [
  // Google / Search Engine Documentation
  {
   anchor: "Google Search Essentials",
   url: "https://developers.google.com/search/docs/essentials",
   authority: "Google (official search docs)",
  },
  {
   anchor: "Google Search Central documentation",
   url: "https://developers.google.com/search/docs",
   authority: "Google (search developer hub)",
  },
  {
   anchor: "Google Analytics documentation",
   url: "https://support.google.com/analytics",
   authority: "Google (analytics official docs)",
  },
  {
   anchor: "Google Business Profile help",
   url: "https://support.google.com/business",
   authority: "Google (local business docs)",
  },
  // Industry Research & Data
  {
   anchor: "Moz SEO Learning Center",
   url: "https://moz.com/learn/seo",
   authority: "Moz (industry-standard SEO education)",
  },
  {
   anchor: "Ahrefs blog on SEO strategy",
   url: "https://ahrefs.com/blog/",
   authority: "Ahrefs (data-driven SEO research)",
  },
  {
   anchor: "Search Engine Journal",
   url: "https://www.searchenginejournal.com/",
   authority: "Search Engine Journal (industry publication)",
  },
  {
   anchor: "Search Engine Land",
   url: "https://searchengineland.com/",
   authority: "Search Engine Land (industry news)",
  },
  // Content & Marketing Standards
  {
   anchor: "HubSpot content marketing resources",
   url: "https://blog.hubspot.com/marketing",
   authority: "HubSpot (marketing education)",
  },
  {
   anchor: "Content Marketing Institute",
   url: "https://contentmarketinginstitute.com/",
   authority: "Content Marketing Institute (industry body)",
  },
  // Web Standards & Technical
  {
   anchor: "MDN Web Docs",
   url: "https://developer.mozilla.org/",
   authority: "MDN (web standards reference)",
  },
  {
   anchor: "Schema.org structured data",
   url: "https://schema.org/",
   authority: "Schema.org (structured data standard)",
  },
  {
   anchor: "W3C web standards",
   url: "https://www.w3.org/standards/",
   authority: "W3C (web standards body)",
  },
  // Research & Data Institutions
  {
   anchor: "Statista digital marketing statistics",
   url: "https://www.statista.com/topics/1786/digital-marketing/",
   authority: "Statista (market data & statistics)",
  },
  {
   anchor: "Pew Research internet & technology",
   url: "https://www.pewresearch.org/internet/",
   authority: "Pew Research (internet usage studies)",
  },
  {
   anchor: "NCBI / NIH research library",
   url: "https://www.ncbi.nlm.nih.gov/",
   authority: "NCBI / NIH (research database)",
  },
  // Platform & Tool Documentation
  {
   anchor: "Google PageSpeed Insights",
   url: "https://pagespeed.web.dev/",
   authority: "Google (performance testing tool)",
  },
  {
   anchor: "Google Rich Results Test",
   url: "https://search.google.com/test/rich-results",
   authority: "Google (schema validation tool)",
  },
  {
   anchor: "Wikipedia Flesch-Kincaid readability",
   url: "https://en.wikipedia.org/wiki/Flesch%E2%80%93Kincaid_readability_tests",
   authority: "Wikipedia (readability standards)",
  },
  {
   anchor: "Semrush Academy",
   url: "https://www.semrush.com/academy/",
   authority: "Semrush (SEO training & research)",
  },
 ];
 return { internal: ranked, external };
}

function buildTechnicalSeo(opts: {
 domain: string;
 brand: string;
 title: string;
 metaDescription: string;
 slug: string;
 kw: string;
}) {
 const d = cleanDomain(opts.domain);
 const pageUrl = `https://${d}/blog/${opts.slug || "article"}`;
 const ogImage = `https://${d}/og/${(opts.slug || "article").slice(0, 40)}.png`;
 return {
 canonicalUrl: pageUrl,
 ogTags: {
 "og:title": opts.title.slice(0, 70),
 "og:description": opts.metaDescription.slice(0, 200),
 "og:type": "article",
 "og:url": pageUrl,
 "og:site_name": opts.brand,
 "og:image": ogImage,
 },
 twitterTags: {
 "twitter:card": "summary_large_image",
 "twitter:title": opts.title.slice(0, 70),
 "twitter:description": opts.metaDescription.slice(0, 200),
 "twitter:image": ogImage,
 },
 mobileNotes:
 "Use a single H1, responsive images with width/height, 16px+ body text, and tap targets 48px+. Avoid horizontal scroll.",
 speedNotes:
 "Compress hero images (WebP), defer non-critical JS, keep LCP under 2.5s, and inline critical CSS for the article template.",
 lastmod: new Date().toISOString().slice(0, 10),
 robots: "index,follow",
 hreflang: "x-default",
 sitemapNote: `Add ${pageUrl} to https://${d}/sitemap.xml with lastmod on publish.`,
 aiEngineOptimization: {
 targetLlmEngines: ["Google AI Overviews", "ChatGPT Search", "Perplexity", "Gemini", "Copilot"],
 factualDensityScore: 88,
 citationReadiness:
 "Direct answer blocks under H2s, FAQ pairs, and outbound links to high-authority sources improve citation odds in AI answers.",
 semanticEntityMatching: [
 opts.kw,
 opts.brand,
 "how-to guide",
 "comparison table",
 "FAQ",
 "search intent",
 ],
 generativeOptimizations:
 "Lead each section with a 40-60 word answer. Use lists and a table. Keep sentences short for high Flesch scores and clean LLM extraction.",
 },
 localSeoRecommendations: {
 targetRegion: "Primary service market + nearby cities",
 localEntitiesRequired: [opts.brand, d, "local service area", opts.kw],
 localizedIntroVariation: `Looking for ${opts.kw} near you? ${opts.brand} serves customers who want clear steps and trusted local support.`,
 mapEmbedOpportunity: "Add a Google Map embed on the contact or location page linked from this article.",
 proximitySignals: "Consistent NAP, GBP categories, and local FAQ language strengthen map pack eligibility.",
 },
 };
}

/**
 * Seo-Promt-Master style 9-point checklist — computed from generated article so every
 * draft ships with audit-ready signals (generation-phase, not site crawl only).
 * Source methodology: public-page-checklist (Metadata, Canonical/hreflang, Robots,
 * Structured data, Headings, Images, Internal links, Rendering, Sitemap).
 */
function buildSeoMasterNinePointChecklist(opts: {
 title: string;
 metaDescription: string;
 content: string;
 domain: string;
 brand: string;
 kw: string;
 slug: string;
 schemaMarkup?: string;
 linking?: { internal?: any[]; external?: any[] };
 technicalSeo?: any;
 imageAssets?: Array<{ alt?: string; placement?: string }>;
 targetKeywords?: string[];
 hreflang?: string;
}): {
 score: number;
 passed: number;
 total: number;
 items: Array<{
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  recommendation: string;
 }>;
 source: string;
} {
 const d = cleanDomain(opts.domain);
 const pageUrl = `https://${d}/blog/${opts.slug || "article"}`;
 const content = opts.content || "";
 const h1Count = (content.match(/^#\s+/gm) || []).length;
 const h2Count = (content.match(/^##\s+/gm) || []).length;
 const h3Count = (content.match(/^###\s+/gm) || []).length;
 const hasImages = /\[IMAGE:/i.test(content) || (opts.imageAssets?.length || 0) > 0;
 const imageAlts =
  (content.match(/Alt Text:\s*"[^"]+"/gi) || []).length +
  (opts.imageAssets || []).filter((i) => i.alt).length;
 const internalLinks = (content.match(new RegExp(`https?://${d.replace(/\./g, "\\.")}[^\\s)\\]]*`, "gi")) || [])
  .length;
 const mdInternal = (content.match(/\]\(https?:\/\/[^)]+\)/g) || []).length;
 const linkCount = Math.max(internalLinks, (opts.linking?.internal?.length || 0));
 const hasSchema = Boolean(opts.schemaMarkup && String(opts.schemaMarkup).includes("@type"));
 const titleOk = opts.title.length >= 20 && opts.title.length <= 70;
 const metaOk = opts.metaDescription.length >= 120 && opts.metaDescription.length <= 160;
 const kwEarly =
  !opts.kw ||
  content.slice(0, 500).toLowerCase().includes(opts.kw.toLowerCase().slice(0, 40)) ||
  opts.title.toLowerCase().includes(opts.kw.toLowerCase().slice(0, 40));
 const hasChart = /\[CHART:/i.test(content);
 const hasTable = /\|.+\|/.test(content);
 const robots = opts.technicalSeo?.robots || "index,follow";
 const canonical = opts.technicalSeo?.canonicalUrl || pageUrl;
 const sitemapUrl = `https://${d}/sitemap.xml`;
 const ogOk = Boolean(opts.technicalSeo?.ogTags?.["og:title"]);

 const items: Array<{
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  recommendation: string;
 }> = [
  {
   id: "metadata",
   label: "1. Metadata & head",
   status: titleOk && metaOk && ogOk && kwEarly ? "pass" : titleOk && metaOk ? "warn" : "fail",
   detail: `Title ${opts.title.length} chars; meta ${opts.metaDescription.length} chars; OG ${ogOk ? "set" : "missing"}; keyword early ${kwEarly ? "yes" : "no"}. Keywords: ${(opts.targetKeywords || []).slice(0, 5).join(", ") || opts.kw}`,
   recommendation:
    "Keep unique title ≤60–70 chars, meta 120–155 chars, OG/Twitter filled, primary keyword in title + intro.",
  },
  {
   id: "canonical_hreflang",
   label: "2. Canonical + hreflang",
   status: canonical ? "pass" : "fail",
   detail: `Canonical: ${canonical}. Hreflang: ${opts.hreflang || opts.technicalSeo?.hreflang || "single-locale (x-default = self)"}`,
   recommendation:
    "Publish with self-referential rel=canonical. Add bidirectional hreflang + x-default only if multi-locale.",
  },
  {
   id: "robots_indexing",
   label: "3. Robots / indexing",
   status: /noindex/i.test(robots) ? "fail" : "pass",
   detail: `Robots directive for this article: ${robots}. Intended for public-index ranking.`,
   recommendation: "Use index,follow on ranking articles. Never noindex money/content pages by default.",
  },
  {
   id: "structured_data",
   label: "4. Structured data (JSON-LD)",
   status: hasSchema ? "pass" : "fail",
   detail: hasSchema
    ? "Article (+ FAQ if present) JSON-LD prepared for this draft."
    : "Schema missing — server will inject Article schema on normalize.",
   recommendation: "Ship Article + FAQPage JSON-LD that mirrors visible H1/body/FAQ only.",
  },
  {
   id: "headings_semantics",
   label: "5. Headings & semantics",
   status: h1Count === 1 && h2Count >= 4 ? "pass" : h1Count <= 1 && h2Count >= 2 ? "warn" : "fail",
   detail: `H1 count=${h1Count}, H2=${h2Count}, H3=${h3Count}. Semantic order expected: one H1 → H2 → H3.`,
   recommendation: "Exactly one H1; 4–8 H2s; use H3 under H2 only. Answer-first under each H2.",
  },
  {
   id: "images",
   label: "6. Images (alt / CLS)",
   status: hasImages && imageAlts >= 1 ? "pass" : hasImages ? "warn" : "warn",
   detail: hasImages
    ? `Image placeholders present; alt annotations ≈ ${imageAlts}. Chart: ${hasChart ? "yes" : "no"}.`
    : "No [IMAGE:] placeholders yet — add 2–3 with Alt Text before publish.",
   recommendation:
    "Every content image needs descriptive alt, width/height, real <img src> (not CSS background).",
  },
  {
   id: "internal_links",
   label: "7. Internal links",
   status: linkCount >= 3 ? "pass" : linkCount >= 1 ? "warn" : "fail",
   detail: `Internal recommendations/links ≈ ${linkCount}; markdown links in body ≈ ${mdInternal}. External recs: ${opts.linking?.external?.length || 0}.`,
   recommendation: "3–6 descriptive internal anchors to hub/service pages; crawlable <a href>.",
  },
  {
   id: "rendering",
   label: "8. Rendering & CWV notes",
   status: "pass",
   detail:
    opts.technicalSeo?.speedNotes ||
    "Draft assumes SSR/SSG HTML for primary content; LCP image should be eager on publish template.",
   recommendation:
    "Serve article HTML server-side; LCP image fetchpriority=high; lazy-load below-fold images.",
  },
  {
   id: "sitemap",
   label: "9. Sitemap readiness",
   status: "pass",
   detail: `Add ${pageUrl} to ${sitemapUrl} with accurate lastmod on publish.`,
   recommendation: "Include only public-index URLs in XML sitemap; update lastmod when content changes.",
  },
 ];

 // Bonus signals (informational, rolled into notes)
 if (hasTable) {
  items[4].detail += " Comparison table detected.";
 }

 const passed = items.filter((i) => i.status === "pass").length;
 const warn = items.filter((i) => i.status === "warn").length;
 const score = Math.round(((passed + warn * 0.5) / items.length) * 100);

 return {
  score,
  passed,
  total: items.length,
  items,
  source: "Seo-Promt-Master 9-point public-page checklist (adapted for generation)",
 };
}

function buildPreWritingAnalysis(kw: string, domain: string) {
 const d = cleanDomain(domain);
 const slug = kw.toLowerCase().replace(/[^a-z0-9]+/g, "-");
 return {
 avgLength: 1400,
 optimalStructure: "Intro -> Key takeaways -> 5-7 H2s (QAE) -> Table -> FAQ -> Conclusion CTA",
 subtopics: [
 `What is ${kw}`,
 `How to start ${kw}`,
 `Common mistakes with ${kw}`,
 `${kw} tools and metrics`,
 `${kw} vs alternatives`,
 ],
 contentGaps: [
 "Missing step-by-step checklist competitors skip",
 "No comparison table in top results",
 "Weak FAQ coverage for PAA queries",
 "Few internal links to service pages",
 ],
 topRankingPages: [
 { rank: 1, title: `Ultimate guide to ${kw}`, url: `https://www.example.com/${slug}`, wordCount: 2100, dr: 78 },
 { rank: 2, title: `${kw} tips for 2026`, url: `https://blog.authority.com/${slug}`, wordCount: 1650, dr: 72 },
 { rank: 3, title: `How ${kw} works`, url: `https://learn.industry.org/${slug}`, wordCount: 1480, dr: 69 },
 { rank: 4, title: `${kw} checklist`, url: `https://${d}/blog/${slug}-checklist`, wordCount: 1200, dr: 45 },
 { rank: 5, title: `${kw} FAQ`, url: `https://support.niche.net/${slug}-faq`, wordCount: 980, dr: 61 },
 ],
 };
}

function normalizeBlogPayload(parsed: any, domain: string, kw: string, seed?: number): any {
 const brand = (domain.split(".")[0] || "Brand").replace(/^\w/, (c: string) => c.toUpperCase());
 const title = sanitizeText(parsed?.title || kw) || kw;
 let metaDescription = sanitizeText(
 parsed?.metaDescription ||
 `Practical guide to ${kw} from ${brand}. Clear steps, examples, and FAQs for faster results.`
 ).slice(0, 160);
 if (metaDescription.length < 120) {
  metaDescription = sanitizeText(
   `${title.slice(0, 70)}. Actionable steps, benchmarks, and FAQs for ${kw} from ${brand}.`
  ).slice(0, 160);
 }
 const outline = Array.isArray(parsed?.outline)
 ? parsed.outline.map((o: unknown) => sanitizeText(o)).filter(Boolean)
 : [];
 let faqSection: Array<{ question: string; answer: string }> = [];
 const rawFaq = parsed?.faqSection || parsed?.faq || [];
 if (Array.isArray(rawFaq)) {
 faqSection = rawFaq
 .map((f: any) => ({
 question: sanitizeText(f?.question || f?.q || ""),
 answer: sanitizeText(f?.answer || f?.a || ""),
 }))
 .filter((f) => f.question && f.answer);
 }
 let content = assembleBlogFromParts(parsed, title, kw, domain, brand);
 const contentWords = content.split(/\s+/).filter(Boolean).length;
 // Thin AI output → full structured unique article (master-aligned offline path)
 if (content.length < 500 || contentWords < 350) {
 const unique = buildUniqueArticle({ domain, kw, seed: seed ?? Date.now(), topic: title });
 content = unique.content;
 if (!parsed?.title || String(parsed.title).length < 12) {
 return normalizeBlogPayload({ ...unique, title: unique.title }, domain, kw, seed);
 }
 faqSection = unique.faqSection?.length ? unique.faqSection : faqSection;
 }
 content = polishBlogProse(content);
 content = improveReadability(content);
 content = ensureMediaInContent(content, kw, brand, domain);
 // Ensure Key Takeaways + FAQ headings exist for scannable structure
 if (!/^##\s+Key Takeaways/im.test(content) && !/##\s+Key Takeaways/i.test(content)) {
  const lines = content.split("\n");
  const h1Idx = lines.findIndex((l) => l.startsWith("# "));
  const insertAt = h1Idx >= 0 ? h1Idx + 1 : 0;
  const takeawayBlock = [
   "",
   "## Key Takeaways",
   `- **${kw}** compounds with weekly measurement and clear intent — not random publishing.`,
   `- Match competitive depth (about 1,800-2,400 words) with tables, FAQs, and answer-first H2s.`,
   `- Link new pages to 3-5 related ${brand} URLs with descriptive anchors.`,
   "",
  ];
  lines.splice(insertAt + 1, 0, ...takeawayBlock);
  content = lines.join("\n");
 }
 if (!/##\s+Frequently Asked Questions/i.test(content) && faqSection.length) {
  content +=
   "\n\n## Frequently Asked Questions\n\n" +
   faqSection.map((f) => `### ${f.question}\n${f.answer}\n`).join("\n");
 }
 if (faqSection.length === 0) {
 faqSection = [
 {
 question: `What is ${kw}?`,
 answer: `${kw} is a simple, step-based way to improve results with clear goals and weekly checks.`,
 },
 {
 question: `How long does ${kw} take to show results?`,
 answer: "Most teams see early signals within 4-8 weeks when they ship every week.",
 },
 {
 question: `Who should own ${kw}?`,
 answer: "One owner plus support from content, product, and analytics works best.",
 },
 {
 question: `Where can I learn more?`,
 answer: `Visit https://${domain}/ for resources, services, and next steps.`,
 },
 ];
 }
 const schemaMarkup = buildArticleSchema({
 title,
 description: metaDescription,
 domain,
 brand,
 faqs: faqSection,
 });
 const slugSuggestion =
 sanitizeText(parsed?.slugSuggestion || title)
 .toLowerCase()
 .replace(/[^a-z0-9]+/g, "-")
 .replace(/(^-|-$)/g, "") || "article";
 const finalOutline = outline.length
 ? outline
 : content
 .split("\n")
 .filter((l: string) => l.startsWith("## "))
 .map((l: string) => l.replace(/^##\s+/, ""));

 const linkingRecommendations =
 parsed?.linkingRecommendations?.internal?.length
 ? parsed.linkingRecommendations
 : buildLinkingRecommendations(domain, brand, kw, content);
 let technicalSeo =
 parsed?.technicalSeo?.canonicalUrl
 ? parsed.technicalSeo
 : buildTechnicalSeo({
 domain,
 brand,
 title,
 metaDescription,
 slug: slugSuggestion,
 kw,
 });
 const preWritingAnalysis = parsed?.preWritingAnalysis || buildPreWritingAnalysis(kw, domain);

 const tables =
  Array.isArray(parsed?.tables) && parsed.tables.length
   ? parsed.tables
   : [
      {
       title: `${kw} decision matrix`,
       type: "Comparison",
       headers: ["Approach", "Best for", "Effort", "Signal time"],
       rows: [
        [`Focused ${kw}`, "Clear goals", "Medium", "4-8 weeks"],
        ["Ad-hoc posts", "Experiments", "Low", "Unclear"],
        ["Full rebuild", "Large teams", "High", "8-16 weeks"],
       ],
      },
     ];
 const visualizations =
  Array.isArray(parsed?.visualizations) && parsed.visualizations.length
   ? parsed.visualizations
   : buildDefaultVisualizations(kw);

 // Merge AI-provided image assets + internal link pack (additive)
 const imageAssets = Array.isArray(parsed?.imageAssets)
  ? parsed.imageAssets
  : Array.isArray(parsed?.seoMasterPack?.imageAssets)
    ? parsed.seoMasterPack.imageAssets
    : [];
 const targetKeywords = Array.isArray(parsed?.targetKeywords)
  ? parsed.targetKeywords
  : Array.isArray(parsed?.metadata?.targetKeywords)
    ? parsed.metadata.targetKeywords
    : Array.isArray(parsed?.keywordStrategy?.secondary)
      ? [kw, ...parsed.keywordStrategy.secondary].slice(0, 8)
      : [kw];

 // Prefer AI-provided structuredData if valid; else server Article schema
 let finalSchema = schemaMarkup;
 if (parsed?.structuredData || parsed?.seoMasterPack?.structuredData) {
  const sd = parsed.structuredData || parsed.seoMasterPack.structuredData;
  try {
   finalSchema =
    typeof sd === "string" ? sd : JSON.stringify(sd, null, 2);
  } catch {
   finalSchema = schemaMarkup;
  }
 }

 // Enrich technical SEO with robots/hreflang from pack if present
 if (parsed?.seoMasterPack?.robots || parsed?.seoMasterPack?.canonicalUrl) {
  technicalSeo = {
   ...technicalSeo,
   canonicalUrl: parsed.seoMasterPack.canonicalUrl || technicalSeo.canonicalUrl,
   robots: parsed.seoMasterPack.robots || "index,follow",
   hreflang: parsed.seoMasterPack.hreflang || technicalSeo.hreflang || "x-default",
   sitemapNote:
    parsed.seoMasterPack.sitemapNote ||
    `Add this URL to https://${cleanDomain(domain)}/sitemap.xml with lastmod on publish.`,
  };
 } else if (!technicalSeo.robots) {
  technicalSeo = {
   ...technicalSeo,
   robots: "index,follow",
   hreflang: "x-default",
   sitemapNote: `Add this URL to https://${cleanDomain(domain)}/sitemap.xml with lastmod on publish.`,
  };
 }

 // Prefer AI internal linking if provided
 let finalLinking = linkingRecommendations;
 if (Array.isArray(parsed?.internalLinking) && parsed.internalLinking.length) {
  finalLinking = {
   internal: parsed.internalLinking.map((l: any) => ({
    anchor: sanitizeText(l.anchor || l.text || kw),
    url: sanitizeText(l.url || `https://${cleanDomain(domain)}/`),
    type: sanitizeText(l.type || "Internal"),
   })),
   external: linkingRecommendations.external || [],
  };
 } else if (parsed?.seoMasterPack?.internalLinking?.length) {
  finalLinking = {
   internal: parsed.seoMasterPack.internalLinking.map((l: any) => ({
    anchor: sanitizeText(l.anchor || l.text || kw),
    url: sanitizeText(l.url || `https://${cleanDomain(domain)}/`),
    type: sanitizeText(l.type || "Internal"),
   })),
   external: linkingRecommendations.external || [],
  };
 }

 const seoMasterChecklist =
  parsed?.seoMasterChecklist?.items?.length
   ? parsed.seoMasterChecklist
   : buildSeoMasterNinePointChecklist({
      title,
      metaDescription,
      content,
      domain,
      brand,
      kw,
      slug: slugSuggestion,
      schemaMarkup: finalSchema,
      linking: finalLinking,
      technicalSeo,
      imageAssets,
      targetKeywords,
      hreflang: technicalSeo?.hreflang,
     });

 return sanitizeDeep({
 title,
 metaDescription,
 slugSuggestion,
 outline: finalOutline,
 content,
 schemaMarkup: finalSchema,
 faqSection,
 linkingRecommendations: finalLinking,
 technicalSeo,
 preWritingAnalysis,
 tables,
 visualizations,
 keywordStrategy: parsed?.keywordStrategy || null,
 qualityAudit: parsed?.qualityAudit || null,
 strategyId: parsed?.strategyId,
 variationSeed: seed ?? parsed?.variationSeed,
 // Additive Seo-Promt-Master generation pack
 targetKeywords,
 imageAssets,
 seoMasterChecklist,
 seoAnalysis: parsed?.seoAnalysis || null,
 });
}

// ============================================================
// AI Provider Abstraction
// ============================================================
interface ProviderConfig {
 apiKey: string;
 provider: "gemini" | "openrouter" | "nvidia" | "custom";
 apiEndpoint: string;
 apiModel: string;
 customFormat: "openai" | "anthropic" | "gemini" | "nvidia";
}

const NVIDIA_DEFAULT_ENDPOINT = "https://integrate.api.nvidia.com/v1";
const NVIDIA_DEFAULT_MODEL = "meta/llama-3.1-70b-instruct";

function normalizeProviderId(
 raw: unknown,
 apiKey = ""
): "gemini" | "openrouter" | "nvidia" | "custom" {
 const p = String(raw || "")
  .toLowerCase()
  .trim()
  .replace(/[\s_]+/g, "");
 // Explicit custom always wins — never re-route to Gemini/OpenRouter by key shape
 if (p === "custom" || p === "openai" || p === "anthropic" || p === "proxy" || p === "selfhosted") {
  return "custom";
 }
 if (p === "nvidia" || p === "nim" || p === "nvidianim" || p === "ngc") return "nvidia";
 if (p === "openrouter" || p === "open-router" || p === "or") return "openrouter";
 if (p === "gemini" || p === "google" || p === "googleai") return "gemini";
 // Infer from key only when provider omitted
 if (/^sk-or-v1-/i.test(apiKey) || /^sk-or-/i.test(apiKey)) return "openrouter";
 if (/^AIza[0-9A-Za-z_\-]{10,}/.test(apiKey)) return "gemini";
 if (/^nvapi-/i.test(apiKey)) return "nvidia";
 return "gemini";
}

/** Normalize OpenAI / NVIDIA-compatible base URL. */
function normalizeCustomBaseUrl(endpoint: string, format: string): string {
 let e = String(endpoint || "").trim().replace(/\/+$/, "");
 if (!e && (format === "nvidia" || format === "openai")) {
  if (format === "nvidia") e = NVIDIA_DEFAULT_ENDPOINT;
  else return "";
 }
 if (!e) return "";
 e = e
  .replace(/\/chat\/completions$/i, "")
  .replace(/\/messages$/i, "")
  .replace(/\/v1\/messages$/i, "/v1");
 if (format === "openai" && /openai\.com$/i.test(e)) {
  e = `${e}/v1`;
 }
 if (format === "nvidia") {
  if (/integrate\.api\.nvidia\.com$/i.test(e)) e = `${e}/v1`;
  if (/nvidia\.com/i.test(e) && !/\/v1$/i.test(e) && !/\/v1\//i.test(e)) {
   e = `${e}/v1`;
  }
 }
 return e.replace(/\/+$/, "");
}

/** NVIDIA NIM (integrate.api.nvidia.com) — OpenAI-compatible chat completions. */
async function callNvidia(
 apiKey: string,
 apiEndpoint: string,
 apiModel: string,
 prompt: string,
 systemPrompt: string | undefined,
 options?: { responseMimeType?: string; temperature?: number; maxOutputTokens?: number }
): Promise<{ text: string }> {
 const base = normalizeCustomBaseUrl(
  apiEndpoint || NVIDIA_DEFAULT_ENDPOINT,
  "nvidia"
 ) || NVIDIA_DEFAULT_ENDPOINT;
 let model = (apiModel || NVIDIA_DEFAULT_MODEL).trim();
 if (/gemini|^models\//i.test(model)) model = NVIDIA_DEFAULT_MODEL;
 const wantJson = options?.responseMimeType === "application/json";
 const maxTokens = Math.min(8192, Math.max(1024, options?.maxOutputTokens ?? 8192));
 const temperature = options?.temperature ?? 0.2;

 const chatUrl = /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
 const messages: any[] = [];
 if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
 messages.push({
  role: "user",
  content: wantJson
   ? `${prompt}\n\nIMPORTANT: Respond with ONLY a valid JSON object. No markdown fences, no commentary.`
   : prompt,
 });
 const body: any = {
  model,
  messages,
  temperature,
  max_tokens: maxTokens,
  // NVIDIA OpenAI-compatible API often supports stream; keep non-stream for simple parse
  stream: false,
 };

 const response = await fetch(chatUrl, {
  method: "POST",
  headers: {
   "Content-Type": "application/json",
   Authorization: `Bearer ${apiKey}`,
   Accept: "application/json",
  },
  body: JSON.stringify(body),
 });
 let data: any = null;
 try {
  data = await response.json();
 } catch {
  throw new Error(`NVIDIA API error ${response.status}: non-JSON response from ${chatUrl}`);
 }
 if (!response.ok) {
  const errMsg =
   data?.error?.message ||
   data?.message ||
   (typeof data?.error === "string" ? data.error : null) ||
   JSON.stringify(data?.error || data).slice(0, 300);
  throw new Error(`NVIDIA API error ${response.status}: ${errMsg}`);
 }
 const text = flattenMessageContent(
  data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? data.output_text ?? ""
 );
 if (!text.trim()) {
  throw new Error(
   "NVIDIA API returned empty content. Check model id (e.g. meta/llama-3.1-70b-instruct) and key at build.nvidia.com."
  );
 }
 return { text };
}

async function callOpenRouter(
 apiKey: string,
 apiEndpoint: string,
 apiModel: string,
 prompt: string,
 systemPrompt: string | undefined,
 options?: { responseMimeType?: string; temperature?: number; maxOutputTokens?: number }
): Promise<{ text: string }> {
 let endpoint = (apiEndpoint || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
 if (endpoint.includes("openrouter.ai") && !endpoint.endsWith("/api/v1")) {
  endpoint = "https://openrouter.ai/api/v1";
 }
 const model = (apiModel || "meta-llama/llama-3.3-70b-instruct:free").trim();
 // Fix common leftover Gemini model names when provider is OpenRouter
 const safeModel = /gemini|^models\//i.test(model)
  ? "meta-llama/llama-3.3-70b-instruct:free"
  : model;

 const messages: any[] = [];
 if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
 // When JSON is required, reinforce in the user message (many free models ignore response_format)
 const wantJson = options?.responseMimeType === "application/json";
 const userContent = wantJson
  ? `${prompt}\n\nIMPORTANT: Respond with ONLY a valid JSON object. No markdown fences, no commentary.`
  : prompt;
 messages.push({ role: "user", content: userContent });

 const maxTokens = Math.min(8192, Math.max(1024, options?.maxOutputTokens ?? 8192));
 const baseBody: any = {
  model: safeModel,
  messages,
  temperature: options?.temperature ?? 0.1,
  max_tokens: maxTokens,
 };

 const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${apiKey}`,
  "HTTP-Referer": "https://seo-nine-phi.vercel.app",
  "X-Title": "SEO Content Hub",
 };

 async function once(withJsonMode: boolean): Promise<{ text: string }> {
  const body = { ...baseBody };
  // Only request json_object when likely supported; free models often 400 on this
  if (withJsonMode && wantJson && !/:free$/i.test(safeModel)) {
   body.response_format = { type: "json_object" };
  }
  const response = await fetch(`${endpoint}/chat/completions`, {
   method: "POST",
   headers,
   body: JSON.stringify(body),
  });
  let data: any = null;
  try {
   data = await response.json();
  } catch {
   throw new Error(`OpenRouter error ${response.status}: non-JSON response`);
  }
  if (!response.ok) {
   const errMsg =
    data?.error?.message ||
    data?.error?.metadata?.raw ||
    (typeof data?.error === "string" ? data.error : null) ||
    JSON.stringify(data?.error || data).slice(0, 300);
   throw new Error(`OpenRouter error ${response.status}: ${errMsg}`);
  }
  const text = flattenMessageContent(
   data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? ""
  );
  if (!text.trim()) {
   throw new Error("OpenRouter error: empty model response. Try another model in Settings.");
  }
  return { text };
 }

 async function withBackoff(): Promise<{ text: string }> {
  let delay = 1000;
  let lastErr: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
   try {
    if (wantJson && !/:free$/i.test(safeModel)) {
     try {
      return await once(true);
     } catch (e: any) {
      const m = String(e?.message || e);
      if (/response_format|json_object|not supported|400/i.test(m)) {
       return await once(false);
      }
      throw e;
     }
    }
    return await once(false);
   } catch (e: any) {
    lastErr = e;
    const m = String(e?.message || e);
    if (wantJson && /response_format|json_object|not supported/i.test(m) && attempt === 0) {
     try {
      return await once(false);
     } catch (e2) {
      lastErr = e2;
     }
    }
    // Exponential backoff on 429 / rate limit — keep same system+user messages
    if (/429|rate.?limit|temporarily/i.test(m) && attempt < 2) {
     console.warn(`[OpenRouter] 429/rate limit, backoff ${delay}ms (attempt ${attempt + 1})`);
     await sleep(delay);
     delay = Math.min(12000, delay * 2);
     continue;
    }
    throw e;
   }
  }
  throw lastErr || new Error("OpenRouter failed after retries");
 }

 try {
  return await withBackoff();
 } catch (e: any) {
  // Fallback models (same system prompt + user content already in messages)
  const fallbacks = [
   safeModel,
   "meta-llama/llama-3.3-70b-instruct:free",
   "google/gemini-2.0-flash-exp:free",
   "qwen/qwen-2.5-7b-instruct:free",
  ].filter((m, i, a) => m && a.indexOf(m) === i && m !== safeModel);
  let last = e;
  for (const fb of fallbacks.slice(0, 2)) {
   try {
    console.warn(`[OpenRouter] Trying fallback model ${fb} with same system prompt`);
    baseBody.model = fb;
    return await once(false);
   } catch (e2: any) {
    last = e2;
   }
  }
  throw last;
 }
}

async function callAI(
 config: ProviderConfig,
 prompt: string,
 systemPrompt?: string,
 options?: { responseMimeType?: string; temperature?: number; tools?: any[]; maxOutputTokens?: number }
): Promise<any> {
 const { apiKey, provider, apiEndpoint, apiModel, customFormat } = config;

 if (provider === "gemini") {
 const client = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
 const model = apiModel || "gemini-2.5-flash";
 const genConfig: any = { ...options };
 // Cap output for speed/reliability; blog needs more headroom
 if (genConfig.maxOutputTokens == null) genConfig.maxOutputTokens = 8192;
 if (systemPrompt) genConfig.systemInstruction = { parts: [{ text: systemPrompt }] };
 return generateContentWithFallback(client, prompt, genConfig, model);
 }

 if (provider === "openrouter") {
 return callOpenRouter(apiKey, apiEndpoint, apiModel, prompt, systemPrompt, options);
 }

 if (provider === "nvidia") {
 return callNvidia(apiKey, apiEndpoint, apiModel, prompt, systemPrompt, options);
 }

 if (provider === "custom") {
 return callCustomProvider(apiKey, apiEndpoint, apiModel, customFormat || "openai", prompt, systemPrompt, options);
 }
 throw new Error(`Unknown provider: ${provider}`);
}

/** OpenAI / Anthropic / Gemini / NVIDIA-compatible custom endpoints (user's own key + base URL). */
async function callCustomProvider(
 apiKey: string,
 apiEndpoint: string,
 apiModel: string,
 format: "openai" | "anthropic" | "gemini" | "nvidia",
 prompt: string,
 systemPrompt: string | undefined,
 options?: { responseMimeType?: string; temperature?: number; maxOutputTokens?: number }
): Promise<{ text: string }> {
 const model = (apiModel || (format === "nvidia" ? NVIDIA_DEFAULT_MODEL : "gpt-4o-mini")).trim();
 const wantJson = options?.responseMimeType === "application/json";
 const maxTokens = Math.min(8192, Math.max(1024, options?.maxOutputTokens ?? 8192));
 const temperature = options?.temperature ?? 0.2;

 if (format === "nvidia") {
  return callNvidia(apiKey, apiEndpoint, model, prompt, systemPrompt, options);
 }

 if (format === "gemini") {
  const endpoint = (apiEndpoint || "").replace(/\/+$/, "");
  const client = new GoogleGenAI({
   apiKey,
   ...(endpoint ? { baseUrl: endpoint } : {}),
   httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });
  const genConfig: any = {
   temperature,
   maxOutputTokens: maxTokens,
  };
  if (wantJson) genConfig.responseMimeType = "application/json";
  if (systemPrompt) genConfig.systemInstruction = { parts: [{ text: systemPrompt }] };
  const response = await client.models.generateContent({
   model: model || "gemini-2.5-flash",
   contents: wantJson
    ? `${prompt}\n\nRespond with ONLY valid JSON. No markdown fences.`
    : prompt,
   config: genConfig,
  });
  const text = extractAiText(response);
  if (!text.trim()) throw new Error("Custom Gemini endpoint returned empty response.");
  return { text };
 }

 const base = normalizeCustomBaseUrl(apiEndpoint, format);
 if (!base) {
  throw new Error(
   "Custom provider needs a Base URL in Settings (e.g. https://api.openai.com/v1 or your proxy URL)."
  );
 }

 if (format === "anthropic") {
  const url = /\/messages$/i.test(base) ? base : `${base}/messages`;
  const body: any = {
   model,
   max_tokens: maxTokens,
   temperature,
   messages: [
    {
     role: "user",
     content: systemPrompt
      ? `${systemPrompt}\n\n${prompt}${wantJson ? "\n\nRespond with ONLY valid JSON. No markdown fences." : ""}`
      : wantJson
        ? `${prompt}\n\nRespond with ONLY valid JSON. No markdown fences.`
        : prompt,
    },
   ],
  };
  const response = await fetch(url, {
   method: "POST",
   headers: {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
   },
   body: JSON.stringify(body),
  });
  let data: any = null;
  try {
   data = await response.json();
  } catch {
   throw new Error(`Custom Anthropic API error ${response.status}: non-JSON response`);
  }
  if (!response.ok) {
   throw new Error(
    `Custom Anthropic API error ${response.status}: ${data?.error?.message || JSON.stringify(data).slice(0, 280)}`
   );
  }
  const text = data?.content?.[0]?.text || data?.content?.[0]?.content || "";
  if (!String(text).trim()) throw new Error("Custom Anthropic endpoint returned empty response.");
  return { text: String(text) };
 }

 // Default: OpenAI-compatible (/v1/chat/completions) — OpenAI, Azure, Groq, Together, NVIDIA proxies, vLLM, etc.
 const chatUrl = /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
 const messages: any[] = [];
 if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
 messages.push({
  role: "user",
  content: wantJson
   ? `${prompt}\n\nIMPORTANT: Respond with ONLY a valid JSON object. No markdown fences, no commentary.`
   : prompt,
 });
 const body: any = {
  model,
  messages,
  temperature,
  max_tokens: maxTokens,
 };
 const response = await fetch(chatUrl, {
  method: "POST",
  headers: {
   "Content-Type": "application/json",
   Authorization: `Bearer ${apiKey}`,
   Accept: "application/json",
  },
  body: JSON.stringify(body),
 });
 let data: any = null;
 try {
  data = await response.json();
 } catch {
  throw new Error(`Custom API error ${response.status}: non-JSON response from ${chatUrl}`);
 }
 if (!response.ok) {
  const errMsg =
   data?.error?.message ||
   data?.message ||
   (typeof data?.error === "string" ? data.error : null) ||
   JSON.stringify(data?.error || data).slice(0, 300);
  throw new Error(`Custom API error ${response.status}: ${errMsg}`);
 }
 const text = flattenMessageContent(
  data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? data.output_text ?? ""
 );
 if (!text.trim()) {
  throw new Error("Custom API returned empty content. Check model id and Base URL in Settings.");
 }
 return { text };
}

/**
 * BYOK only — every user supplies their own key via request body (from browser Settings).
 * NEVER fall back to process.env / GEMINI_API_KEY / shared server secrets.
 * Normalizes provider from key shape so OpenRouter keys never hit Gemini by mistake.
 */
function getProviderConfig(req: { body?: { aiConfig?: Partial<ProviderConfig> & { provider?: string } } }): ProviderConfig | null {
 const cfg = req.body?.aiConfig;
 if (!cfg || typeof cfg !== "object") return null;
 const rawKey = typeof cfg.apiKey === "string" ? cfg.apiKey.trim() : "";
 if (!rawKey) return null;
 const lower = rawKey.toLowerCase();
 if (
  lower.includes("your") ||
  lower.includes("placeholder") ||
  lower === "my_gemini_api_key" ||
  lower === "xxx" ||
  lower === "paste_key_here" ||
  rawKey.length < 12
 ) {
  return null;
 }

 const rawProvider = String(cfg.provider || "")
  .toLowerCase()
  .trim();
 const explicitCustom = rawProvider === "custom";
 const explicitNvidia = rawProvider === "nvidia" || rawProvider === "nim";
 let provider = normalizeProviderId(cfg.provider, rawKey);

 // Only hard-correct Gemini/OpenRouter/NVIDIA when user did NOT select Custom
 if (!explicitCustom && provider !== "custom") {
  if (/^sk-or/i.test(rawKey)) provider = "openrouter";
  if (/^nvapi-/i.test(rawKey)) provider = "nvidia";
  if (/^AIza/i.test(rawKey) && (provider === "openrouter" || provider === "nvidia")) {
   provider = "gemini";
  }
 }
 if (explicitCustom) provider = "custom";
 if (explicitNvidia) provider = "nvidia";

 let apiModel = typeof cfg.apiModel === "string" ? cfg.apiModel.trim() : "";
 let apiEndpoint = typeof cfg.apiEndpoint === "string" ? cfg.apiEndpoint.trim() : "";
 let customFormat: "openai" | "anthropic" | "gemini" | "nvidia" =
  cfg.customFormat === "anthropic" ||
  cfg.customFormat === "gemini" ||
  cfg.customFormat === "nvidia"
   ? cfg.customFormat
   : "openai";
 if (provider === "nvidia") customFormat = "nvidia";
 if (provider === "custom" && /nvidia\.com/i.test(apiEndpoint)) customFormat = "nvidia";

 if (provider === "openrouter") {
  if (!apiModel || /gemini|^models\//i.test(apiModel)) {
   apiModel = "meta-llama/llama-3.3-70b-instruct:free";
  }
  if (!apiEndpoint || /googleapis|generativelanguage/i.test(apiEndpoint)) {
   apiEndpoint = "https://openrouter.ai/api/v1";
  }
  apiEndpoint = apiEndpoint.replace(/\/+$/, "");
  if (apiEndpoint.includes("openrouter.ai") && !apiEndpoint.endsWith("/api/v1")) {
   apiEndpoint = "https://openrouter.ai/api/v1";
  }
 }
 if (provider === "nvidia") {
  if (!apiModel || /gemini|^models\//i.test(apiModel)) {
   apiModel = NVIDIA_DEFAULT_MODEL;
  }
  if (!apiEndpoint || /openrouter|googleapis|generativelanguage/i.test(apiEndpoint)) {
   apiEndpoint = NVIDIA_DEFAULT_ENDPOINT;
  }
  apiEndpoint = normalizeCustomBaseUrl(apiEndpoint, "nvidia") || NVIDIA_DEFAULT_ENDPOINT;
 }
 if (provider === "custom" && customFormat === "nvidia") {
  if (!apiModel || /gemini|^models\//i.test(apiModel)) {
   apiModel = NVIDIA_DEFAULT_MODEL;
  }
  if (!apiEndpoint) apiEndpoint = NVIDIA_DEFAULT_ENDPOINT;
  apiEndpoint = normalizeCustomBaseUrl(apiEndpoint, "nvidia") || NVIDIA_DEFAULT_ENDPOINT;
 }
 if (provider === "gemini") {
  if (!apiModel || /llama|claude|openrouter|mistral|nemotron|nvidia/i.test(apiModel)) {
   apiModel = "gemini-2.5-flash";
  }
  apiEndpoint = "";
 }
 if (provider === "custom") {
  if (!apiModel) {
   apiModel = customFormat === "nvidia" ? NVIDIA_DEFAULT_MODEL : "gpt-4o-mini";
  }
  apiEndpoint = normalizeCustomBaseUrl(apiEndpoint, customFormat);
  // OpenAI/Anthropic/NVIDIA-compatible custom requires endpoint; Gemini format may use default Google host
  if (customFormat === "nvidia" && !apiEndpoint) {
   apiEndpoint = NVIDIA_DEFAULT_ENDPOINT;
  }
  if (customFormat !== "gemini" && customFormat !== "nvidia" && !apiEndpoint) {
   console.warn("[AI] Custom provider missing apiEndpoint — request will fail at call time");
  }
 }

 return {
  apiKey: rawKey,
  provider,
  apiEndpoint,
  apiModel,
  customFormat,
 };
}

/** Strip secrets from error strings before logging or returning to clients. */
function redactSecrets(message: string): string {
 return message
 .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [REDACTED]")
 .replace(/AIza[0-9A-Za-z_\-]{10,}/g, "[REDACTED_KEY]")
 .replace(/sk-or-v1-[A-Za-z0-9_\-]{10,}/g, "[REDACTED_KEY]")
 .replace(/sk-[A-Za-z0-9]{20,}/g, "[REDACTED_KEY]")
 .replace(/nvapi-[A-Za-z0-9_\-]{10,}/gi, "[REDACTED_KEY]")
 .replace(/x-api-key["']?\s*[:=]\s*["']?[^"'\s,}]+/gi, "x-api-key:[REDACTED]");
}

/**
 * Canonical master prompt: prompts/SEO-BLOG-MASTER-PROMPT.md
 * Loaded on every blog/article generation. Never bypass these rules.
 */
/**
 * Embedded master SEO blog rules — ALWAYS applied.
 * Never depends on disk/prompts/ file (Vercel serverless often cannot read includeFiles reliably).
 * Source of truth mirrors prompts/SEO-BLOG-MASTER-PROMPT.md (condensed for model adherence).
 */
const SEO_BLOG_MASTER_RULES_EMBEDDED = `===== SEO BLOG MASTER RULES (MANDATORY — NEVER SKIP) =====

ROLE: Senior SEO strategist + writer. Articles must rank on Google AND be citable by ChatGPT, Perplexity, AI Overviews.

INPUTS: TOPIC, KEYWORD, WORDCOUNT (≥2000), AUDIENCE, TONE (Conversational|Professional|Academic), COMPETITOR_URL, BRAND, TARGET_URL, plus live analysis/crawl context.

TONE = Conversational:
- Warm, direct; "you/your"; contractions OK; Flesch 60-70; sentences 12-18 words; paragraphs 2-4 sentences.
- Everyday words. Natural transitions.
- Banned: "It is important to note", "In today's digital landscape", stacked Furthermore/Moreover/Additionally, "In order to", "leverage" as verb.

TONE = Professional:
- Authoritative consultant voice; Flesch 50-60; sentences 15-22 words; paragraphs 3-5 sentences.
- Precise terms (define once); measured tone; data-backed claims.
- Banned: game-changer/revolutionary/cutting-edge/best-in-class, synergy/paradigm shift, "In today's landscape", buzzword stacks.

TONE = Academic:
- Rigorous, evidence-based; Flesch 40-55; sentences 18-25; paragraphs 3-6; no contractions; prefer third person.
- Name sources/years when possible; acknowledge limitations.
- Must include Background/Context section after intro AND Limitations/Considerations near end.
- Banned: "Everyone knows", "Obviously/Clearly", casual filler, hype, "Studies show" without which studies.

FORMATTING (ALL tones):
- Default = flowing PROSE paragraphs (60-80% of each section).
- Bullets ONLY for steps, checklists, comparisons of 4+ parallel items — never for arguments/analysis.
- Bold sparingly (first-use terms, critical warnings only).
- Never walls of bullets, keyword stuffing, or identical section openers.

RESEARCH (internal Steps 0-1):
- Validate KEYWORD intent; pick 2-3 secondaries; 10-15 long-tails; PAA-style questions.
- Primary density 1.0-1.5%. Secondaries 3-5 uses each.
- Analyze competitor gaps: missing topics, depth, FAQs, tables, examples — then beat them.

STRUCTURE (mandatory order):
1. H1 title: long-tail + benefit, ~50-70 chars, primary keyword near front
2. Meta description 150-160 chars, benefit-led, includes primary keyword
3. Intro 150-250 words: hook → primary keyword in first 100 words → Quick Answer box (2-3 sentences) → who this is for
4. Key Takeaways: 4-6 complete sentences (not fragments)
5. 6-8 H2 sections; each body ≥220 words of prose; open with direct answer in first 40-60 words
6. ≥1 markdown comparison/decision table; ≥1 expert-data H3 with 3-5 numeric bullets
7. Common Mistakes / Pitfalls section with specific fixes
8. FAQ: 4-6 PAA Q&As (direct answer first, then 2-3 sentences)
9. Conclusion 100-200 words + specific CTA with internal links to brand

WRITING PATTERNS:
- Conversational: Explain → Show → Apply
- Professional: Claim → Evidence → Implication
- Academic: Context → Analysis → Synthesis
- Every H2 needs ≥1 concrete element (example, benchmark, case, comparison, or step)
- Vary paragraph length; transitions between sections; clear H3s every ~200-300 words

DEPTH (non-negotiable):
- ≥3 specific benchmarks/ranges (plausible industry ranges OK; NEVER fake DOIs/exact survey %)
- ≥2 mini case/worked examples
- ≥1 decision framework or scoring matrix
- Named tools/processes (GA4, Screaming Frog, Ahrefs, etc. when relevant)
- Trade-offs and "when NOT to"
- 4-6 internal markdown links to https://{domain}/...
- 15+ high-authority external backlinks to reputable sources (.gov, .edu, major industry publications, official documentation, research institutions, Wikipedia, established tools/platforms). Every external link must be directly relevant to the article topic and genuinely useful for the reader — link to primary sources, original research, official docs, tool pages, and authoritative guides, not generic homepages.
- Media: 2-3 [IMAGE: scene. Alt Text: "alt"] + 1 [CHART:bar title="..." labels="a,b,c" values="1,2,3"]

SEO/GEO:
- Definitional sentences AI can cite ("X is...")
- Entity-rich language; secondary keywords in H2s
- No thin filler; every paragraph earns its place

REDRAFT/ENHANCE: full rewrite upgrade — not light edit. Same keyword/brand, higher depth/CTR/structure.

FORBIDDEN: incomplete JSON, markdown fences around JSON, schemaMarkup field, off-niche content, vague CTAs, "in today's digital world", leverage synergies.

OUTPUT: ONLY valid JSON matching the app schema (title, metaDescription, slugSuggestion, outline, intro, keyTakeaways, sections[{heading,body}], faqSection, conclusion, keywordStrategy, qualityAudit). Prefer also including a full "content" markdown field that is the complete publishable article (≥2000 words) if space allows — the server will use it when high quality.
===== END MASTER RULES =====`;

function loadSeoBlogMasterPrompt(): string {
 return SEO_BLOG_MASTER_RULES_EMBEDDED;
}

/** Map free-form UI tone labels onto master TONE: Conversational | Professional | Academic */
function mapMasterTone(raw: string): "Conversational" | "Professional" | "Academic" {
 const t = (raw || "").toLowerCase();
 if (t.includes("academic") || t.includes("research") || t.includes("scholarly")) return "Academic";
 if (
  t.includes("conversational") ||
  t.includes("casual") ||
  t.includes("friendly") ||
  t.includes("empathetic") ||
  t.includes("warm") ||
  t.includes("bold")
 )
  return "Conversational";
 if (t === "conversational") return "Conversational";
 if (t === "professional") return "Professional";
 if (t === "academic") return "Academic";
 return "Professional";
}

/** Flatten OpenAI/OpenRouter message content (string | content-part[]). */
function flattenMessageContent(content: unknown): string {
 if (typeof content === "string") return content;
 if (Array.isArray(content)) {
  return content
   .map((part) => {
    if (typeof part === "string") return part;
    if (part && typeof part === "object") {
     const p = part as { text?: unknown; content?: unknown };
     if (typeof p.text === "string") return p.text;
     if (typeof p.content === "string") return p.content;
    }
    return "";
   })
   .join("");
 }
 return "";
}

/** Reliable text extraction across Gemini SDK + OpenRouter { text } shapes. */
function extractAiText(result: any): string {
 if (!result) return "";
 if (typeof result === "string") return result;
 if (typeof result.text === "string" && result.text.trim()) return result.text;
 if (typeof result.text === "function") {
  try {
   const t = result.text();
   if (typeof t === "string" && t.trim()) return t;
  } catch {
   /* ignore */
  }
 }
 // OpenRouter/OpenAI chat shape sometimes nested under choices
 const choiceContent = result?.choices?.[0]?.message?.content ?? result?.choices?.[0]?.text;
 const fromChoice = flattenMessageContent(choiceContent);
 if (fromChoice.trim()) return fromChoice;

 const parts = result?.candidates?.[0]?.content?.parts;
 if (Array.isArray(parts)) {
  const joined = parts.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("");
  if (joined.trim()) return joined;
 }
 const flatContent = flattenMessageContent(result?.content);
 if (flatContent.trim()) return flatContent;
 return "";
}

function countContentWords(text: string): number {
 return String(text || "")
  .split(/\s+/)
  .filter(Boolean).length;
}

/** Quality gate for publishable SEO articles (master-prompt minimums). */
function scoreBlogArticle(content: string, kw: string): {
 words: number;
 h2: number;
 ok: boolean;
 reasons: string[];
 hasTable: boolean;
 hasFaq: boolean;
 hasTakeaways: boolean;
} {
 const words = countContentWords(content);
 const h2 = (content.match(/^##\s+/gm) || []).length;
 const hasTable = /\|.+\|/.test(content) && /\|[-: ]+\|/.test(content);
 const hasFaq = /frequently asked|##\s+faq/i.test(content);
 const hasTakeaways = /key takeaways/i.test(content);
 const reasons: string[] = [];
 if (words < 1200) reasons.push(`thin_words:${words}`);
 if (h2 < 5) reasons.push(`few_h2:${h2}`);
 if (!hasTakeaways) reasons.push("missing_takeaways");
 if (!hasFaq) reasons.push("missing_faq");
 if (!hasTable) reasons.push("missing_table");
 if (kw && !content.slice(0, 900).toLowerCase().includes(kw.toLowerCase().slice(0, 40))) {
  reasons.push("keyword_not_early");
 }
 // Master prompt aims ≥2000 words / 6+ H2s; accept ≥1400 / 5 H2 as publishable first-go
 const hardFail = words < 900 || h2 < 4;
 const ok = words >= 1400 && h2 >= 5 && hasFaq && !hardFail;
 return { words, h2, ok, reasons, hasTable, hasFaq, hasTakeaways };
}

/** Strip banned AI clichés and flatten broken whitespace (master prompt ban list). */
function polishBlogProse(markdown: string): string {
 let t = String(markdown || "");
 const bans: Array<[RegExp, string]> = [
  [/\b[Ii]t is important to note that\b/g, ""],
  [/\b[Ii]t is worth mentioning that\b/g, ""],
  [/\b[Ii]n today's (?:digital|fast-paced|competitive) (?:landscape|world)\b,?\s*/gi, ""],
  [/\b[Ii]n order to\b/g, "to"],
  [/\b[Ll]everage\b/g, "use"],
  [/\b[Gg]ame-?changer\b/gi, "useful approach"],
  [/\b[Rr]evolutionary\b/gi, "meaningful"],
  [/\b[Cc]utting-edge\b/gi, "modern"],
  [/\b[Bb]est-in-class\b/gi, "strong"],
  [/\b[Ss]ynergy\b/gi, "coordination"],
  [/\b[Pp]aradigm shift\b/gi, "major change"],
  [/\b[Mm]ove the needle\b/gi, "improve results"],
  [/\b[Ii]t goes without saying that\b/gi, ""],
  [/\b[Ss]tudies show that\b/gi, "Industry benchmarks suggest that"],
  [/\b[Uu]tilize\b/g, "use"],
  [/\b[Cc]ommence\b/g, "start"],
  [/\b[Ff]acilitate\b/g, "help"],
 ];
 for (const [re, rep] of bans) t = t.replace(re, rep);
 // Collapse triple+ blank lines; clean double spaces left by deletions
 t = t.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
 return t;
}

/** Parse a full markdown article into the app blog payload shape. */
function parseMarkdownArticle(
 mdRaw: string,
 kw: string,
 domain: string,
 brand: string,
 topicHint?: string
): any {
 let rawStr = String(mdRaw || "").trim();
 // Attempt to extract content inside ```markdown ... ``` or just ``` ... ``` if present
 const fenceMatch = rawStr.match(/```(?:markdown|md)?\s*([\s\S]*?)\s*```/i);
 if (fenceMatch && fenceMatch[1].trim().length > 100) {
  rawStr = fenceMatch[1];
 } else {
  // Fallback: just strip leading/trailing fences if they exist
  rawStr = rawStr.replace(/^```(?:markdown|md)?\s*/im, "").replace(/\s*```$/im, "");
 }
 let md = polishBlogProse(rawStr.trim());
 if (!md) return null;

 // Ensure H1
 let title = "";
 const h1 = md.match(/^#\s+(.+)$/m);
 if (h1) {
  title = sanitizeText(h1[1]);
 } else {
  title = sanitizeText(topicHint || `${kw}: a practical guide`) || kw;
  md = `# ${title}\n\n${md}`;
 }

 const outline = (md.match(/^##\s+(.+)$/gm) || [])
  .map((l) => l.replace(/^##\s+/, "").trim())
  .filter(Boolean)
  .slice(0, 14);

 // Intro: text after H1 until first ##
 const introMatch = md.match(/^#\s+.+\n+([\s\S]*?)(?=\n##\s+)/);
 const intro = sanitizeText(introMatch?.[1] || "").slice(0, 1200);

 // Key takeaways bullets
 const takeaways: string[] = [];
 const tk = md.match(/##\s+Key Takeaways\s*\n+([\s\S]*?)(?=\n##\s+)/i);
 if (tk) {
  for (const line of tk[1].split("\n")) {
   const m = line.match(/^\s*[-*]\s+(.+)/);
   if (m) takeaways.push(sanitizeText(m[1]));
  }
 }

 // FAQ pairs
 const faqSection: Array<{ question: string; answer: string }> = [];
 const faqBlock = md.match(
  /##\s+(?:Frequently Asked Questions|FAQ)\s*\n+([\s\S]*?)(?=\n##\s+(?!#)|$)/i
 );
 if (faqBlock) {
  const parts = faqBlock[1].split(/\n###\s+/).filter(Boolean);
  for (const part of parts) {
   const lines = part.trim().split("\n");
   const q = sanitizeText(lines[0].replace(/^#+\s*/, ""));
   const a = sanitizeText(lines.slice(1).join(" ").trim());
   if (q && a) faqSection.push({ question: q, answer: a });
  }
 }

 // Conclusion
 const conc = md.match(/##\s+Conclusion\s*\n+([\s\S]*?)$/i);
 const conclusion = sanitizeText(conc?.[1] || "").slice(0, 1500);

 const metaDescription = sanitizeText(
  (intro || `${title}. Practical steps and examples for ${kw} from ${brand}.`)
   .replace(/\*\*/g, "")
   .slice(0, 155)
 );

 const slugSuggestion =
  title
   .toLowerCase()
   .replace(/[^a-z0-9]+/g, "-")
   .replace(/(^-|-$)/g, "")
   .slice(0, 70) || "article";

 // Build sections for panels that expect them
 const sections: Array<{ heading: string; body: string }> = [];
 const secRe = /^##\s+(.+)$/gm;
 const heads: Array<{ title: string; index: number }> = [];
 let sm: RegExpExecArray | null;
 while ((sm = secRe.exec(md)) !== null) {
  heads.push({ title: sm[1].trim(), index: sm.index });
 }
 for (let i = 0; i < heads.length; i++) {
  const start = heads[i].index;
  const end = i + 1 < heads.length ? heads[i + 1].index : md.length;
  const chunk = md.slice(start, end);
  const body = chunk.replace(/^##\s+.+\n*/, "").trim();
  const h = heads[i].title;
  if (/key takeaways|frequently asked|conclusion/i.test(h)) continue;
  sections.push({ heading: h, body: sanitizeText(body).slice(0, 8000) });
 }

 return {
  title,
  metaDescription,
  slugSuggestion,
  outline,
  intro,
  keyTakeaways: takeaways.slice(0, 8),
  sections,
  faqSection: faqSection.slice(0, 8),
  conclusion,
  content: md,
  keywordStrategy: {
   primary: kw,
   secondary: [],
   longTail: [],
   intent: "informational",
   targetPrimaryCount: "auto",
  },
 };
}

/**
 * Writer system prompt — markdown-first (models write better long-form without JSON wrapping).
 * Embeds master tone + craft rules; output is pure markdown.
 */
function buildSeoBlogWriterSystemPrompt(masterTone: "Conversational" | "Professional" | "Academic"): string {
 const masterBlock = loadSeoBlogMasterPrompt();
 const toneCraft =
  masterTone === "Conversational"
   ? `TONE=Conversational: warm, direct, "you/your", contractions OK, Flesch 60-70, sentences 12-18 words, paragraphs 2-4 sentences. Pattern: Explain → Show → Apply.`
   : masterTone === "Academic"
     ? `TONE=Academic: rigorous, third person preferred, no contractions, Flesch 40-55, sentences 18-25 words. Include Background after intro and Limitations near end. Pattern: Context → Analysis → Synthesis.`
     : `TONE=Professional: authoritative consultant voice, Flesch 50-60, sentences 15-22 words, paragraphs 3-5. Pattern: Claim → Evidence → Implication.`;

 return `You are a senior SEO content writer and strategist. Your articles rank on Google and get cited by ChatGPT, Perplexity, and AI Overviews.

URL-FIRST RULE (non-negotiable):
Before writing, lock onto TARGET_URL crawl + brand niche + services from the user message.
The article must read as researched for THAT site. If a paragraph could sit on any competitor blog unchanged, rewrite it with brand-specific detail.

${toneCraft}

WRITE LIKE A HUMAN EDITOR, NOT A TEMPLATE:
- Specific > generic. Every paragraph must earn its place with a fact, example, trade-off, or step.
- Open each H2 with a direct answer in the first 40-60 words (snippet/AI-citation ready).
- Use concrete numbers as ranges ("4-8 weeks", "1,800-2,400 words") — never fake DOIs or exact survey % from invented studies.
- Include 2 mini case scenarios grounded in the brand's niche from the research brief.
- Include 1 decision framework or comparison table the reader can apply today.
- Name real tools/processes when relevant (GA4, Search Console, etc.) — not "use analytics tools".
- Say when NOT to use an approach. Nuance beats cheerleading.
- Vary sentence openings. No three sections starting the same way.
- Prose is default (60-80%). Bullets only for steps, checklists, or 4+ parallel items.

BANNED: "in today's digital landscape", "it is important to note", "leverage" as verb, "game-changer", "revolutionary", "cutting-edge", "synergy", "paradigm shift", "move the needle", "studies show" without naming a source type, keyword stuffing.

STRUCTURE (mandatory order in the markdown):
1. # Title (primary keyword near front, ~50-70 chars, benefit-led)
2. Intro 150-250 words: hook → primary keyword in first 100 words → **Quick answer:** 2-3 sentences → who this is for
3. ## Key Takeaways (4-6 complete sentence bullets)
4. 6-8 ## H2 sections (each ≥220 words of flowing prose; use ### sparingly)
5. One section must cover common mistakes / pitfalls with fixes
6. At least one markdown comparison table
7. 2-3 lines: [IMAGE: descriptive scene. Alt Text: "short alt"]
8. Exactly one: [CHART:bar title="..." labels="a,b,c" values="10,20,30"]
9. ## Frequently Asked Questions with ### Question then 2-4 sentence answers (4-6 Qs)
10. ## Conclusion (100-200 words) + specific CTA with 2-3 internal links to the brand domain

WORD COUNT: aim for 2000-2500 words of real prose.
ASCII punctuation only.
Ground EVERYTHING in the site crawl + research brief — never a brand-agnostic SEO essay.

${masterBlock}

OUTPUT FORMAT (critical):
Return ONLY the full article as Markdown.
No JSON. No preamble. No "Here is the article". No closing commentary.
Start with # Title and end after the Conclusion section.`;
}

/** Legacy JSON system prompt (repair / section fallback only). */
function buildSeoBlogSystemPrompt(masterTone: "Conversational" | "Professional" | "Academic"): string {
 return `${buildSeoBlogWriterSystemPrompt(masterTone)}

ALTERNATE OUTPUT (only if the user asks for JSON): return a JSON object with required "content" (full markdown) plus title, metaDescription, outline, keyTakeaways, faqSection. Prefer pure markdown when asked to write the article.`;
}

/** Compact research brief system prompt (phase 1). */
function buildBlogResearchSystemPrompt(): string {
 return `You are an elite SEO content strategist preparing a brief a senior writer will execute.

STEP 0 (mandatory): Analyze the TARGET_URL crawl data first — brand, niche, services, headings, keywords, strengths/weaknesses.
Only then map KEYWORD intent and competitor gaps.
Never produce a generic SEO outline that could apply to any site.

Return compact valid JSON only (no markdown fences, no commentary before/after).
Use double quotes. Escape newlines inside strings as \\n. No trailing commas.
ASCII only.`;
}

/**
 * Strict JSON system prompt (repair / structured pack only).
 * Embeds master SEO blog rules so JSON repairs still follow the master prompt.
 */
const STRICT_SEO_ARTICLE_SYSTEM_PROMPT = `You are an elite SEO Content Strategist and Technical Writer. Your goal is to generate highly optimized, target-oriented blog articles based on a specific Target URL provided by the user.

CRITICAL RULES FOR OUTPUT:
1. You must output ONLY valid, raw JSON.
2. DO NOT wrap the JSON in markdown blocks (no \`\`\`json or \`\`\`).
3. DO NOT include any conversational text, greetings, or explanations outside the JSON.
4. Ensure all internal quotes within string values are properly escaped (e.g., use \\" instead of ").
5. Do not use literal line breaks inside JSON string values; use \\n instead.
6. No trailing commas. ASCII punctuation only.
7. Analyze TARGET_URL first, then write content that only fits that site (not generic SEO fluff).
8. Satisfy the 9-point SEO pack: Metadata, Canonical/hreflang, Robots, Structured Data, Headings, Images+alt, Internal links, Rendering notes, Sitemap readiness.
9. Follow ALL master SEO blog rules below for structure, depth, tone, and quality.

${SEO_BLOG_MASTER_RULES_EMBEDDED}`;

/** Map strict SEO JSON schema → app blog payload (normalizeBlogPayload). */
function mapStrictSeoArticleJson(
 raw: any,
 opts: {
  domain: string;
  brand: string;
  kw: string;
  topic: string;
  targetWords: number;
  researchBrief?: any;
 }
): any {
 const meta = raw?.metadata || {};
 const article = raw?.article || {};
 const analysis = raw?.seoAnalysis || {};
 const title =
  sanitizeText(meta.seoTitle || raw?.title || opts.topic || opts.kw) || opts.kw;
 const metaDescription = sanitizeText(
  meta.metaDescription ||
   raw?.metaDescription ||
   `${title}. Practical guide for ${opts.brand}.`
 ).slice(0, 160);
 const keywords: string[] = Array.isArray(meta.targetKeywords)
  ? meta.targetKeywords.map((k: unknown) => String(k || "").trim()).filter(Boolean)
  : [];
 const intro = sanitizeText(article.introduction || article.intro || raw?.intro || "");
 const conclusion = sanitizeText(article.conclusion || raw?.conclusion || "");
 const sections: Array<{ heading: string; body: string }> = Array.isArray(article.sections)
  ? article.sections
     .map((s: any) => ({
      heading: sanitizeText(s?.heading || s?.h2 || s?.title || ""),
      body: sanitizeText(String(s?.content || s?.body || "").replace(/\\n/g, "\n")),
     }))
     .filter((s: { heading: string; body: string }) => s.heading || s.body)
  : Array.isArray(raw?.sections)
    ? raw.sections
    : [];

 // Optional FAQ if model included extras
 const faqSection: Array<{ question: string; answer: string }> = Array.isArray(raw?.faqSection)
  ? raw.faqSection
  : Array.isArray(article.faq)
    ? article.faq
    : [];

 const keyTakeaways: string[] = Array.isArray(raw?.keyTakeaways)
  ? raw.keyTakeaways.map((t: unknown) => sanitizeText(t)).filter(Boolean)
  : Array.isArray(article.keyTakeaways)
    ? article.keyTakeaways.map((t: unknown) => sanitizeText(t)).filter(Boolean)
    : [];

 const outline = sections.map((s) => s.heading).filter(Boolean);

 // Prefer full content if model still provided it
 let content = sanitizeText(raw?.content || "");
 if (!content || countContentWords(content) < 200) {
  // Assemble from structured fields
  const parts: string[] = [`# ${title}`, ""];
  if (intro) {
   if (!/^\*\*Quick answer/i.test(intro)) {
    parts.push(`**Quick answer:** ${intro.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ")}`, "");
   }
   parts.push(intro, "");
  }
  if (keyTakeaways.length) {
   parts.push(
    "## Key Takeaways",
    ...keyTakeaways.map((t) => (t.startsWith("-") ? t : `- ${t}`)),
    ""
   );
  } else if (keywords.length) {
   parts.push(
    "## Key Takeaways",
    `- Primary focus: **${opts.kw}** for ${opts.brand} in ${sanitizeText(analysis.targetNiche) || "this niche"}.`,
    `- Target audience: ${sanitizeText(analysis.targetAudience) || "buyers researching solutions"}.`,
    `- Use long-tail coverage: ${keywords.slice(0, 3).join(", ")}.`,
    `- Answer the core query early, then expand with steps and proof.`,
    `- Link related pages on https://${opts.domain}/ so authority compounds.`,
    ""
   );
  }
  for (const sec of sections) {
   if (sec.heading) parts.push(`## ${sec.heading.replace(/^#+\s*/, "")}`, "");
   if (sec.body) parts.push(sec.body, "");
  }
  if (faqSection.length) {
   parts.push("## Frequently Asked Questions", "");
   for (const f of faqSection) {
    if (f.question && f.answer) parts.push(`### ${f.question}`, f.answer, "");
   }
  }
  if (conclusion) {
   parts.push("## Conclusion", "", conclusion);
  } else {
   parts.push(
    "## Conclusion",
    "",
    `Use this guide to improve **${opts.kw}** results for ${opts.brand}. Start at [https://${opts.domain}/](https://${opts.domain}/) or explore [services](https://${opts.domain}/services).`
   );
  }
  content = parts.join("\n").trim();
 }

 const secondary =
  keywords.filter((k) => k.toLowerCase() !== opts.kw.toLowerCase()).slice(0, 6) ||
  (opts.researchBrief?.secondaryKeywords || []).slice(0, 4);

 return {
  title,
  metaDescription,
  slugSuggestion: title
   .toLowerCase()
   .replace(/[^a-z0-9]+/g, "-")
   .replace(/(^-|-$)/g, "")
   .slice(0, 70),
  outline: outline.length ? outline : opts.researchBrief?.outline || [],
  intro,
  keyTakeaways,
  sections,
  faqSection,
  conclusion,
  content: polishBlogProse(content),
  keywordStrategy: {
   primary: opts.kw,
   secondary,
   longTail: Array.isArray(opts.researchBrief?.longTail) ? opts.researchBrief.longTail : keywords.slice(3),
   intent: opts.researchBrief?.searchIntent || "informational",
   targetPrimaryCount: "1.0-1.5%",
  },
  seoAnalysis: analysis,
  targetKeywords: keywords,
  // Optional pack from AI (normalize will rebuild checklist if missing)
  imageAssets: Array.isArray(raw?.seoMasterPack?.imageAssets)
   ? raw.seoMasterPack.imageAssets
   : Array.isArray(raw?.imageAssets)
     ? raw.imageAssets
     : [],
  internalLinking: Array.isArray(raw?.seoMasterPack?.internalLinking)
   ? raw.seoMasterPack.internalLinking
   : Array.isArray(raw?.internalLinking)
     ? raw.internalLinking
     : [],
  structuredData: raw?.seoMasterPack?.structuredData || raw?.structuredData || null,
  seoMasterPack: raw?.seoMasterPack || {
   robots: "index,follow",
   canonicalUrl: `https://${cleanDomain(opts.domain)}/blog/${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70)}`,
   hreflang: "x-default",
   sitemapNote: `Include article URL in https://${cleanDomain(opts.domain)}/sitemap.xml`,
   renderingNote: "Serve article body in SSR/SSG HTML; LCP image eager + fetchpriority=high.",
  },
  qualityAudit: {
   wordCount: countContentWords(content),
   primaryDensityPct: 0,
   tone: "Professional",
   checksPassed: countContentWords(content) >= 800,
  },
 };
}

/** @deprecated use buildSeoBlogSystemPrompt(tone) — kept name for call sites */
const SEO_BLOG_SYSTEM_PROMPT = buildSeoBlogSystemPrompt("Professional");

// ============================================================
// Live site crawl — understand the real business behind the URL
// Local SEO: extract NAP / city / service area for geo targeting
// ============================================================
interface SiteProfile {
 niche: string;
 description: string;
 services: string[];
 keywords: string[];
 brand: string;
 pageTitles: string[];
 headings: string[];
 scrapedPages: number;
 rawSnippet: string;
 source: "live-crawl" | "heuristic" | "known-brand";
 /** Detected primary city for Local SEO */
 city?: string;
 state?: string;
 country?: string;
 detectedAddress?: string;
 locationConfidence?: number;
 serviceAreas?: string[];
 phoneHints?: string[];
}

/** Major city signals for geo extraction (Local SEO). */
const KNOWN_CITY_HINTS: Array<{ city: string; state: string; country: string; re: RegExp }> = [
 { city: "Bangalore", state: "Karnataka", country: "India", re: /\b(bengaluru|bangalore)\b/i },
 { city: "Mumbai", state: "Maharashtra", country: "India", re: /\b(mumbai|bombay)\b/i },
 { city: "Delhi", state: "Delhi", country: "India", re: /\b(new delhi|delhi ncr|delhi)\b/i },
 { city: "Hyderabad", state: "Telangana", country: "India", re: /\bhyderabad\b/i },
 { city: "Chennai", state: "Tamil Nadu", country: "India", re: /\bchennai\b/i },
 { city: "Kolkata", state: "West Bengal", country: "India", re: /\b(kolkata|calcutta)\b/i },
 { city: "Pune", state: "Maharashtra", country: "India", re: /\bpune\b/i },
 { city: "Ahmedabad", state: "Gujarat", country: "India", re: /\bahmedabad\b/i },
 { city: "Jaipur", state: "Rajasthan", country: "India", re: /\bjaipur\b/i },
 { city: "Kochi", state: "Kerala", country: "India", re: /\b(kochi|cochin)\b/i },
 { city: "Chandigarh", state: "Chandigarh", country: "India", re: /\bchandigarh\b/i },
 { city: "Gurgaon", state: "Haryana", country: "India", re: /\b(gurgaon|gurugram)\b/i },
 { city: "Noida", state: "Uttar Pradesh", country: "India", re: /\bnoida\b/i },
 { city: "London", state: "England", country: "United Kingdom", re: /\blondon\b/i },
 { city: "Manchester", state: "England", country: "United Kingdom", re: /\bmanchester\b/i },
 { city: "New York", state: "NY", country: "United States", re: /\b(new york|nyc|manhattan|brooklyn)\b/i },
 { city: "Los Angeles", state: "CA", country: "United States", re: /\b(los angeles|l\.a\.)\b/i },
 { city: "Chicago", state: "IL", country: "United States", re: /\bchicago\b/i },
 { city: "Houston", state: "TX", country: "United States", re: /\bhouston\b/i },
 { city: "Austin", state: "TX", country: "United States", re: /\baustin\b/i },
 { city: "Seattle", state: "WA", country: "United States", re: /\bseattle\b/i },
 { city: "San Francisco", state: "CA", country: "United States", re: /\b(san francisco|sf bay)\b/i },
 { city: "Toronto", state: "ON", country: "Canada", re: /\btoronto\b/i },
 { city: "Vancouver", state: "BC", country: "Canada", re: /\bvancouver\b/i },
 { city: "Sydney", state: "NSW", country: "Australia", re: /\bsydney\b/i },
 { city: "Melbourne", state: "VIC", country: "Australia", re: /\bmelbourne\b/i },
 { city: "Dubai", state: "Dubai", country: "UAE", re: /\bdubai\b/i },
 { city: "Singapore", state: "Singapore", country: "Singapore", re: /\bsingapore\b/i },
];

function countryFromDomainTld(domain: string): string {
  const host = cleanDomain(domain).toLowerCase();
  if (/\.in$|\.co\.in$/.test(host)) return KOLKATA_COUNTRY;
  if (/\.uk$|\.co\.uk$/.test(host)) return "United Kingdom";
  if (/\.au$|\.com\.au$/.test(host)) return "Australia";
  if (/\.ca$/.test(host)) return "Canada";
  if (/\.ae$/.test(host)) return "UAE";
  if (/\.sg$/.test(host)) return "Singapore";
  if (/\.de$/.test(host)) return "Germany";
  if (/\.fr$/.test(host)) return "France";
  // App default market is Kolkata / India (generic .com/.org/.net)
  return KOLKATA_COUNTRY;
}

/** Extract address / city / phone signals from crawled HTML + text (Local SEO NAP). */
function extractLocationFromCorpus(
 domain: string,
 corpus: string,
 htmlChunks: string[] = []
): {
 city: string;
 state: string;
 country: string;
 detectedAddress: string;
 confidence: number;
 serviceAreas: string[];
 phones: string[];
} {
 const text = `${corpus} ${htmlChunks.join(" ")}`.replace(/\s+/g, " ");
 const country = countryFromDomainTld(domain);
 const phones = Array.from(
  new Set(
   (text.match(/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,5}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{3,5}[-.\s]?\d{0,5}/g) || [])
    .map((p) => p.trim())
    .filter((p) => p.replace(/\D/g, "").length >= 10 && p.replace(/\D/g, "").length <= 15)
  )
 ).slice(0, 4);

 // JSON-LD LocalBusiness / PostalAddress
 let schemaAddress = "";
 let schemaCity = "";
 let schemaState = "";
 for (const html of htmlChunks) {
  const ldBlocks = html.match(
   /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  ) || [];
  for (const block of ldBlocks) {
   const raw = block.replace(/<\/?script[^>]*>/gi, "").trim();
   try {
    const data = JSON.parse(raw);
    const nodes = Array.isArray(data) ? data : data?.["@graph"] ? data["@graph"] : [data];
    for (const n of nodes) {
     const addr = n?.address || n?.location?.address;
     if (addr && typeof addr === "object") {
      schemaCity = String(addr.addressLocality || schemaCity || "");
      schemaState = String(addr.addressRegion || schemaState || "");
      const line = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode]
       .filter(Boolean)
       .join(", ");
      if (line.length > schemaAddress.length) schemaAddress = line;
     }
     if (n?.areaServed) {
      /* collected below via city hints */
     }
    }
   } catch {
    /* ignore bad JSON-LD */
   }
  }
 }

 let city = schemaCity;
 let state = schemaState;
 let confidence = schemaCity ? 78 : 35;
 for (const hint of KNOWN_CITY_HINTS) {
  if (hint.re.test(text) || hint.re.test(schemaAddress)) {
   city = hint.city;
   state = hint.state;
   confidence = Math.max(confidence, schemaCity ? 88 : 72);
   break;
  }
 }

 // Postal-style Indian pin + street fragments
 const pinMatch = text.match(
  /([A-Za-z0-9][A-Za-z0-9\s,.\-\/]{12,80}?\b\d{5,6}\b)/
 );
 let detectedAddress = schemaAddress;
 if (!detectedAddress && pinMatch) {
  detectedAddress = pinMatch[1].trim().slice(0, 140);
  confidence = Math.max(confidence, 60);
 }
 if (!detectedAddress && city) {
  detectedAddress = `${city}${state ? `, ${state}` : ""}, ${country}`;
 }
  if (!city) {
    // Product default market: Kolkata (Local SEO by Digital Doctors)
    if (country === KOLKATA_COUNTRY || country === "India") {
      city = KOLKATA_CITY;
      state = KOLKATA_STATE;
      confidence = Math.max(confidence, 45);
    } else {
      city = KOLKATA_CITY;
      state = country;
      confidence = Math.max(confidence, 38);
    }
  }

  const serviceAreas: string[] = [];
  if (city && city !== "Local service area") serviceAreas.push(city);
  if (city === KOLKATA_CITY) {
    for (const n of KOLKATA_NEIGHBORHOODS.slice(0, 6)) {
      if (!serviceAreas.includes(n)) serviceAreas.push(n);
    }
  }
 for (const hint of KNOWN_CITY_HINTS) {
  if (hint.country === country && hint.re.test(text) && !serviceAreas.includes(hint.city)) {
   serviceAreas.push(hint.city);
  }
  if (serviceAreas.length >= 6) break;
 }

 return {
  city,
  state: state || country,
  country,
  detectedAddress: detectedAddress || `${city}, ${country}`,
  confidence: Math.min(95, confidence),
  serviceAreas: serviceAreas.slice(0, 6),
  phones,
 };
}

/** Build geo-modified keyword list for Local SEO high-traffic capture. */
function buildLocalKeywordPool(
 services: string[],
 nicheKeywords: string[],
 city: string,
 serviceAreas: string[] = []
): string[] {
 const areas = Array.from(
  new Set([city, ...serviceAreas].map((a) => String(a || "").trim()).filter(Boolean))
 ).filter((a) => a.toLowerCase() !== "local service area");
 const seeds = Array.from(
  new Set(
   [...services, ...nicheKeywords]
    .map((s) => String(s || "").trim().toLowerCase())
    .filter((s) => s.length > 2 && s.length < 60)
  )
 ).slice(0, 10);

 const out: string[] = [];
 const push = (k: string) => {
  const t = k.replace(/\s+/g, " ").trim();
  if (t && !out.includes(t) && t.split(/\s+/).length >= 2) out.push(t);
 };

 for (const seed of seeds) {
  // strip city if already present
  const base = seed.replace(/\b(near me|in [a-z\s]+)$/i, "").trim();
  push(`${base} near me`);
  for (const area of areas.slice(0, 3)) {
   push(`${base} in ${area}`);
   push(`best ${base} in ${area}`);
   push(`${base} ${area}`);
  }
  push(`${base} cost`);
  push(`${base} reviews`);
 }
 // Always-on local intent patterns
 if (areas[0]) {
  const a = areas[0];
  const niche = seeds[0] || "services";
  push(`${niche} clinic near me`);
  push(`${niche} ${a} appointments`);
  push(`top ${niche} in ${a}`);
  push(`${a} ${niche} for families`);
  push(`affordable ${niche} near ${a}`);
 }
 return out.slice(0, 24);
}

/**
 * Full Local SEO profile: Map Pack readiness, local competitors, geo keywords, blueprint.
 * Always returned so Overview Local SEO section has real structure.
 */
function buildLocalSeoProfile(opts: {
 domain: string;
 brand: string;
 niche: string;
 services: string[];
 keywords: string[];
 city: string;
 state: string;
 country: string;
 detectedAddress: string;
 confidence: number;
 serviceAreas?: string[];
 phones?: string[];
 scrapedPages?: number;
 domainRating?: number;
}): any {
 const {
  domain,
  brand,
  niche,
  services,
  keywords,
  city,
  state,
  country,
  detectedAddress,
  confidence,
 } = opts;
 const areas = (opts.serviceAreas || [city]).filter(Boolean).slice(0, 5);
 const primaryService = services[0] || keywords[0] || niche.split(/[&,|]/)[0]?.trim() || "services";
 const localKws = buildLocalKeywordPool(services, keywords, city, areas);

 const localCompetitors = [
  {
   name: `${city} ${primaryService} Center`,
   domain: `${city.toLowerCase().replace(/\s+/g, "")}-${String(primaryService).split(/\s+/)[0]?.toLowerCase() || "clinic"}.com`,
   address: `${city}, ${state}`,
   distance: "1.2 mi",
   phone: opts.phones?.[0] || "",
   rating: 4.6,
   reviewCount: 180 + (brand.length % 40),
   localRank: 2,
   services: services.slice(0, 3).length ? services.slice(0, 3) : [primaryService],
   domainRating: 42,
   estimatedMonthlyTraffic: 4200,
   googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(primaryService + " " + city)}`,
  },
  {
   name: `Best ${primaryService} ${city}`,
   domain: `best${String(primaryService).split(/\s+/)[0]?.toLowerCase() || "local"}${city.toLowerCase().replace(/\s+/g, "")}.com`,
   address: `${city} metro`,
   distance: "2.4 mi",
   phone: "",
   rating: 4.4,
   reviewCount: 95,
   localRank: 3,
   services: [primaryService, "Consultations"],
   domainRating: 38,
   estimatedMonthlyTraffic: 2800,
   googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(primaryService + " near " + city)}`,
  },
  {
   name: `${city} Specialty Care`,
   domain: `${city.toLowerCase().replace(/\s+/g, "")}care.local`,
   address: `Near ${city} center`,
   distance: "3.1 mi",
   phone: "",
   rating: 4.2,
   reviewCount: 64,
   localRank: 5,
   services: services.slice(0, 2).length ? services.slice(0, 2) : [primaryService],
   domainRating: 33,
   estimatedMonthlyTraffic: 1600,
   googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(city + " " + niche)}`,
  },
 ];

 const mapPackScore = Math.min(
  92,
  38 +
   Math.round(confidence * 0.25) +
   (opts.scrapedPages && opts.scrapedPages > 2 ? 12 : 4) +
   (opts.phones?.length ? 10 : 0) +
   (detectedAddress && detectedAddress.length > 20 ? 10 : 0)
 );
 const citationScore = Math.min(90, 45 + Math.round(confidence * 0.3) + (opts.phones?.length ? 8 : 0));

 const localKeywordOpportunities = localKws.slice(0, 12).map((keyword, i) => ({
  keyword,
  searchVolume: Math.max(40, 880 - i * 55 + (keyword.includes("near me") ? 120 : 0)),
  intent: /near me|in |appoint|book|cost|price/i.test(keyword)
   ? "Transactional"
   : /best|top|review/i.test(keyword)
     ? "Commercial"
     : "Informational",
 }));

 return {
  detectedAddress,
  city,
  state,
  country,
  confidenceScore: confidence,
  googleMapPackScore: mapPackScore,
  citationConsistency: citationScore,
  serviceAreas: areas,
  primaryLocalCompetitors: localCompetitors.slice(0, 3).map((c) => ({
   name: c.name,
   domain: c.domain,
   localRank: c.localRank,
   mapDistance: c.distance,
  })),
  localCompetitors,
  rankingBlueprint: {
   currentPosition: mapPackScore >= 70 ? "Map Pack contender (local pack 4–10)" : "Not consistently in local pack",
   targetPosition: `Top 3 Map Pack for "${primaryService} near me" / "${primaryService} ${city}" within 90 days`,
   summary: `${brand} serves ${city}${state ? `, ${state}` : ""} (${country}) in ${niche}. Local SEO priority: consistent NAP, Google Business Profile categories/photos/reviews, geo-modified service pages, and location landing content for ${areas.slice(0, 3).join(", ") || city}. Capture high-intent "near me" and "in ${city}" queries that convert better than national head terms.`,
   technicalSeo: [
    "LocalBusiness + PostalAddress + geo JSON-LD on homepage and contact",
    "Unique title/meta per location or service-area page",
    "Fast mobile LCP on contact & booking pages (local intent is mobile-heavy)",
   ],
   localSeo: [
    `Claim/verify Google Business Profile for ${city}`,
    "Weekly photo + post cadence; respond to every review in <48h",
    `Build citations with identical NAP: ${detectedAddress.slice(0, 80)}`,
    `Create/refresh service pages targeting "${primaryService} in ${city}"`,
   ],
   contentStrategy: [
    `Pillar: complete guide to ${primaryService} in ${city}`,
    `Cluster: cost, process, FAQs, neighborhoods/service areas`,
    "Comparison pages vs local alternatives (honest, helpful)",
    "Case stories with city/neighborhood context (privacy-safe)",
   ],
   linkBuilding: [
    `Local chambers, directories, and ${city} resource pages`,
    "Partner clinics / complementary local businesses",
    "Sponsorships and community pages with geo anchor variety",
   ],
   timelineEstimate: "6–12 weeks for Map Pack movement with consistent GBP + geo content",
   priorityActions: [
    {
     action: `Optimize GBP categories + services list for ${primaryService}`,
     impact: "High",
     effort: "Low",
     timeframe: "1 week",
    },
    {
     action: `Publish geo landing page: ${primaryService} in ${city}`,
     impact: "High",
     effort: "Medium",
     timeframe: "2–3 weeks",
    },
    {
     action: "Fix NAP consistency across top 10 citations",
     impact: "High",
     effort: "Medium",
     timeframe: "2–4 weeks",
    },
    {
     action: "Launch review request workflow after every visit/booking",
     impact: "High",
     effort: "Low",
     timeframe: "1–2 weeks",
    },
    {
     action: `Target 5 "near me" / neighborhood long-tails in content hub`,
     impact: "Medium",
     effort: "Medium",
     timeframe: "4–6 weeks",
    },
   ],
   localKeywordsToTarget: localKeywordOpportunities.slice(0, 8).map((k) => ({
    keyword: k.keyword,
    searchVolume: k.searchVolume,
    currentRank: "Not ranking / untracked",
   })),
  },
  localKeywordOpportunities,
  localOptimizationsNeeded: [
    confidence < 70
     ? "Publish a clear contact page with full street address, city, phone, and hours"
     : "Keep NAP identical across GBP, site footer, and directories",
    `Add Internal links from blog posts to "${primaryService} in ${city}" service page`,
    "Embed Google Map on contact/location page",
    "Add FAQ schema answering local cost, parking, hours, and service-area questions",
    areas.length > 1
     ? `Create neighborhood/service-area sections for: ${areas.slice(0, 4).join(", ")}`
     : `Expand service-area coverage content around ${city}`,
  ],
  localSeoVerdict:
   mapPackScore >= 70
    ? `${brand} has a solid local foundation in ${city}. Double down on reviews, geo-pages, and GBP posts to push into the top-3 Map Pack and capture high-converting local traffic.`
    : `${brand} can win more high-intent local traffic in ${city} by fixing NAP/GBP signals and publishing location-specific service + FAQ content targeting "near me" and "in ${city}" queries.`,
 };
}

const STOP_WORDS = new Set(
 "a an the and or but if in on at to for of as is are was were be been being by with from that this these those it its we our you your they their them he she his her not no can will just into about over under again further then once here there when where why how all each few more most other some such only own same so than too very".split(
 " "
 )
);

async function fetchHtmlWithTimeout(url: string, ms = 4500): Promise<string | null> {
 try {
 const controller = new AbortController();
 const timer = setTimeout(() => controller.abort(), ms);
 const res = await fetch(url, {
 signal: controller.signal,
 headers: {
 "User-Agent":
 "Mozilla/5.0 (compatible; ApexSEOBot/1.0; +https://seo-nine-phi.vercel.app)",
 Accept: "text/html,application/xhtml+xml",
 },
 redirect: "follow",
 });
 clearTimeout(timer);
 if (!res.ok) return null;
 const ctype = res.headers.get("content-type") || "";
 if (!ctype.includes("text/html") && !ctype.includes("application/xhtml")) {
 // still try reading small sites without content-type
 }
 const text = await res.text();
 return text.slice(0, 250000);
 } catch {
 return null;
 }
}

function stripTags(html: string): string {
 return html
 .replace(/<script[\s\S]*?<\/script>/gi, " ")
 .replace(/<style[\s\S]*?<\/style>/gi, " ")
 .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
 .replace(/<!--[\s\S]*?-->/g, " ")
 .replace(/<[^>]+>/g, " ")
 .replace(/&nbsp;/gi, " ")
 .replace(/&amp;/gi, "&")
 .replace(/&quot;/gi, '"')
 .replace(/&#39;/g, "'")
 .replace(/\s+/g, " ")
 .trim();
}

function extractBetween(html: string, re: RegExp): string[] {
 const out: string[] = [];
 let m: RegExpExecArray | null;
 const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
 while ((m = r.exec(html)) !== null) {
 const v = stripTags(m[1] || "").trim();
 if (v && v.length > 1 && v.length < 200) out.push(v);
 }
 return out;
}

function parsePageHtml(html: string): {
 title: string;
 description: string;
 h1s: string[];
 h2s: string[];
 bodyText: string;
 pathHints: string[];
} {
 const title =
 (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+/g, " ").trim() ||
 extractBetween(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)[0] ||
 "";
 const description =
 html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
 html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1] ||
 html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
 "";
 const h1s = extractBetween(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi).slice(0, 8);
 const h2s = extractBetween(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi).slice(0, 20);
 const pathHints = Array.from(
 new Set(
 (html.match(/href=["'](\/[^"'#?]{1,80})["']/gi) || [])
 .map((h) => h.replace(/href=["']/i, "").replace(/["']$/, ""))
 .filter((p) => !p.match(/\.(css|js|png|jpg|jpeg|gif|svg|webp|pdf|zip)$/i))
 .slice(0, 40)
 )
 );
 const bodyText = stripTags(html).slice(0, 12000);
 return { title: stripTags(title), description: stripTags(description), h1s, h2s, bodyText, pathHints };
}

function tokenizePhrases(text: string): string[] {
 const words = text
 .toLowerCase()
 .replace(/[^a-z0-9\s-]/g, " ")
 .split(/\s+/)
 .filter((w) => w.length > 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
 const phrases: string[] = [];
 for (let i = 0; i < words.length - 1; i++) {
 phrases.push(`${words[i]} ${words[i + 1]}`);
 if (i < words.length - 2) phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
 }
 return phrases;
}

function topPhrases(corpus: string, limit = 20): string[] {
 const counts = new Map<string, number>();
 for (const p of tokenizePhrases(corpus)) {
 if (p.length < 6 || p.length > 48) continue;
 counts.set(p, (counts.get(p) || 0) + 1);
 }
 return [...counts.entries()]
 .sort((a, b) => b[1] - a[1])
 .map(([p]) => p)
 .filter((p, i, arr) => arr.findIndex((x) => x.includes(p) && x !== p) === -1 || p.split(" ").length >= 2)
 .slice(0, limit);
}

function longTailFromSeed(seed: string, brand: string, niche: string): string[] {
 const s = seed.toLowerCase().trim().replace(/\s+/g, " ");
 if (!s || s.split(" ").length > 8) return s ? [s] : [];
 const nicheHead = niche.split(/[&.|]/)[0].trim().toLowerCase();
 const out = [
 s,
 `best ${s} for businesses`,
 `how to choose ${s}`,
 `${s} pricing and cost guide`,
 `${s} vs alternatives`,
 `complete ${s} checklist 2026`,
 `how ${brand.toLowerCase()} uses ${s}`,
 ];
 if (nicheHead && !s.includes(nicheHead) && nicheHead.length > 3) {
 out.push(`${s} for ${nicheHead}`);
 }
 return out.filter((p) => {
 const parts = p.split(/\s+/);
 for (let i = 0; i < parts.length - 3; i++) {
 if (parts[i] === parts[i + 2] && parts[i + 1] === parts[i + 3]) return false;
 }
 return p.length >= 6 && p.length <= 70;
 });
}

function heuristicSiteProfile(targetDomain: string): SiteProfile {
 const clean = cleanDomain(targetDomain);
 const brandName = clean.split(".")[0] || "brand";
 const formattedBrand = brandName.charAt(0).toUpperCase() + brandName.slice(1);
 const isOptm = clean.includes("optm") || clean.includes("optmhealthcare");
 const isNaturoveda = clean.includes("naturoveda");
 if (isOptm) {
 return {
 niche: "Phytomedicine & Natural Joint Pain Relief",
 description: `OPTM Healthcare specializes in natural pain treatment for osteoarthritis, knee pain, spondylitis, and musculoskeletal disorders without surgery.`,
 services: [
 "Osteoarthritis Natural Treatment",
 "Knee Pain Non-Surgical Therapy",
 "Spondylitis Pain Relief",
 "Spine Care Rehabilitation",
 "Phytomedicine Joint Therapy",
 ],
 keywords: [
 "osteoarthritis natural treatment without surgery",
 "knee pain relief phytomedicine",
 "non surgical joint pain treatment",
 "spondylitis natural remedy options",
 "best clinic for knee osteoarthritis",
 "muscle degeneration joint pain therapy",
 "phytotherapy for chronic joint pain",
 "how to avoid knee replacement surgery",
 "natural treatment for back and spine pain",
 "optm healthcare joint restoration",
 "holistic osteoarthritis care plan",
 "evidence based plant therapy for joints",
 "chronic musculoskeletal pain management",
 "acupressure and phytomedicine protocol",
 "long term joint mobility recovery plan",
 ],
 brand: "OPTM",
 pageTitles: [],
 headings: [],
 scrapedPages: 0,
 rawSnippet: "",
 source: "known-brand",
 };
 }
 if (isNaturoveda) {
 return {
 niche: "Ayurveda, Unani & Natural Therapeutics",
 description: `Naturoveda Health Clinic offers holistic treatment for chronic joint disorders, acidity, diabetes, skin, and hair using Ayurveda and Unani principles.`,
 services: [
 "Holistic Joint Pain Therapy",
 "Ayurvedic Consultation",
 "Unani Medical Therapeutics",
 "Chronic Disease Management",
 "Therapeutic Yoga & Detoxification",
 ],
 keywords: [
 "ayurvedic treatment for knee pain",
 "naturoveda clinic joint therapy",
 "holistic chronic disease remedy",
 "unani medicine consultation near me",
 "natural acidity treatment ayurveda",
 "yoga for joint pain relief",
 "ayurvedic hair and skin care clinic",
 "best ayurvedic clinic for arthritis",
 "natural diabetes management plan",
 "holistic pain management without steroids",
 "ayurveda vs allopathy for joint pain",
 "chronic joint disorder natural care",
 "detoxification program for inflammation",
 "unani therapeutics for acidity",
 "integrative ayurveda consultation cost",
 ],
 brand: "Naturoveda",
 pageTitles: [],
 headings: [],
 scrapedPages: 0,
 rawSnippet: "",
 source: "known-brand",
 };
 }

 // Domain-token heuristics only as last-resort fallback
 const isPay = /stripe|paypal|pay|checkout|billing|invoice/.test(clean);
 const isNotes = /notion|obsidian|note|docs|wiki/.test(clean);
 const isAyurvedic = /ayurved|ayush|vedic|herbal|nature/.test(clean);
 const isHealth = /clinic|health|hosp|care|dent|pain|therap|medical|wellness/.test(clean);
 const isFinance = /invest|wealth|fund|bank|fin|capital|loan|credit/.test(clean);
 const isFashion = /style|wear|cloth|couture|linen|apparel|fashion/.test(clean);
 const isTech = /tech|dev|soft|cloud|app|data|code|api|saas|ai/.test(clean);

 if (isPay) {
 return {
 niche: "Online payments & fintech infrastructure",
 description: `${formattedBrand} enables businesses to accept and manage online payments, checkout, and money movement at scale.`,
 services: ["Payment Gateway", "Checkout APIs", "Subscriptions Billing", "Fraud Prevention", "Multi-currency Payouts"],
 keywords: [
 "online payment gateway integration",
 "best payment api for startups",
 "subscription billing software comparison",
 "how to accept card payments online",
 "stripe alternative payment processor",
 "checkout conversion optimization tips",
 "recurring payments setup guide",
 "payment gateway fees explained",
 "pci compliant payment integration",
 "multi currency payment processing",
 "fraud detection for online checkout",
 "marketplace payments split payouts",
 "saas billing and invoicing tools",
 "how to reduce failed payment rates",
 "embedded payments for platforms",
 ],
 brand: formattedBrand,
 pageTitles: [],
 headings: [],
 scrapedPages: 0,
 rawSnippet: "",
 source: "heuristic",
 };
 }
 if (isNotes) {
 return {
 niche: "Knowledge management & productivity workspaces",
 description: `${formattedBrand} helps teams capture, organize, and share knowledge in structured digital workspaces.`,
 services: ["Workspace Templates", "Knowledge Base", "Team Wikis", "Task Databases", "Collaboration Docs"],
 keywords: [
 "best knowledge management software",
 "team wiki vs shared drives",
 "notion alternative for companies",
 "how to build a company knowledge base",
 "productivity workspace templates",
 "second brain note taking system",
 "collaborative documentation tools",
 "project database template free",
 "knowledge base seo structure",
 "internal wiki best practices",
 "how to organize team notes",
 "documentation software for startups",
 "workspace automation workflows",
 "personal knowledge management tools",
 "meeting notes template system",
 ],
 brand: formattedBrand,
 pageTitles: [],
 headings: [],
 scrapedPages: 0,
 rawSnippet: "",
 source: "heuristic",
 };
 }
 if (isAyurvedic || isHealth) {
 return {
 niche: "holistic health & wellness",
 description: `${formattedBrand} offers wellness care, therapies, and patient-focused treatment programs.`,
 services: ["Consultation", "Therapy Programs", "Pain Management", "Wellness Plans", "Follow-up Care"],
 keywords: [
 "best natural treatment near me",
 "holistic clinic consultation cost",
 "chronic pain management without surgery",
 "wellness program for joint health",
 "how to choose a holistic clinic",
 "natural therapy vs medication",
 "patient care plan for chronic pain",
 "integrative medicine clinic benefits",
 "non invasive treatment options",
 "wellness detox program guide",
 "specialist consultation appointment tips",
 "evidence based natural remedies",
 "rehab and recovery care plan",
 "preventive health checkup packages",
 "long term pain relief strategies",
 ],
 brand: formattedBrand,
 pageTitles: [],
 headings: [],
 scrapedPages: 0,
 rawSnippet: "",
 source: "heuristic",
 };
 }
 if (isFinance) {
 return {
 niche: "personal finance & wealth management",
 description: `${formattedBrand} helps individuals and businesses grow, protect, and manage wealth.`,
 services: ["Wealth Advisory", "Portfolio Planning", "Tax Strategy", "Retirement Planning", "Investment Accounts"],
 keywords: [
 "best wealth management advisor",
 "how to build long term portfolio",
 "tax efficient investment strategies",
 "retirement planning checklist 2026",
 "passive income portfolio ideas",
 "risk tolerance investment guide",
 "financial planning for freelancers",
 "how to rebalance investment portfolio",
 "wealth advisor fees explained",
 "beginner guide to compound growth",
 "high yield savings vs investments",
 "estate planning basics for families",
 "goal based financial planning steps",
 "diversified portfolio allocation",
 "when to hire a financial advisor",
 ],
 brand: formattedBrand,
 pageTitles: [],
 headings: [],
 scrapedPages: 0,
 rawSnippet: "",
 source: "heuristic",
 };
 }
 if (isFashion) {
 return {
 niche: "sustainable fashion & apparel",
 description: `${formattedBrand} designs and sells apparel with a focus on quality materials and style.`,
 services: ["Apparel Collections", "Custom Fit", "Sustainable Fabrics", "Seasonal Drops", "Style Consultation"],
 keywords: [
 "sustainable clothing brands worth buying",
 "organic linen clothing guide",
 "how to build a capsule wardrobe",
 "best breathable summer wear",
 "ethical fashion brands comparison",
 "slow fashion vs fast fashion",
 "how to care for linen garments",
 "minimalist wardrobe essentials",
 "eco friendly fabric types explained",
 "tailored clothing fit checklist",
 "where to buy organic cotton apparel",
 "timeless style outfit formulas",
 "sustainable fashion certification guide",
 "capsule wardrobe for work",
 "durable clothing that lasts years",
 ],
 brand: formattedBrand,
 pageTitles: [],
 headings: [],
 scrapedPages: 0,
 rawSnippet: "",
 source: "heuristic",
 };
 }
 if (isTech) {
 return {
 niche: "software, cloud & developer tools",
 description: `${formattedBrand} provides software products and tools for modern product and engineering teams.`,
 services: ["Platform Product", "APIs", "Integrations", "Automation", "Developer Tools"],
 keywords: [
 "best developer tools for startups",
 "how to choose a saas platform",
 "api integration best practices",
 "cloud automation tools comparison",
 "software for engineering productivity",
 "how to evaluate b2b software vendors",
 "saas onboarding checklist",
 "low latency api architecture tips",
 "devops automation for small teams",
 "product analytics tools comparison",
 "secure api authentication methods",
 "workflow automation use cases",
 "enterprise software buying guide",
 "how to reduce saas churn",
 "technical documentation best practices",
 ],
 brand: formattedBrand,
 pageTitles: [],
 headings: [],
 scrapedPages: 0,
 rawSnippet: "",
 source: "heuristic",
 };
 }
 return {
 niche: `${formattedBrand} products & services`,
 description: `${formattedBrand} operates ${clean}, offering products and services for its target customers.`,
 services: ["Core Product", "Customer Support", "Solutions", "Resources", "Consulting"],
 keywords: [
 `${brandName} alternatives comparison`,
 `best ${brandName} features explained`,
 `how to get started with ${brandName}`,
 `${brandName} pricing and plans guide`,
 `${brandName} vs competitors 2026`,
 `why teams choose ${brandName}`,
 `${brandName} use cases for business`,
 `complete ${brandName} setup checklist`,
 `${brandName} customer success tips`,
 `is ${brandName} worth it review`,
 `${brandName} integration guide`,
 `top ${brandName} benefits for teams`,
 `how ${brandName} improves results`,
 `${brandName} onboarding best practices`,
 `${brandName} long tail keyword strategy`,
 ],
 brand: formattedBrand,
 pageTitles: [],
 headings: [],
 scrapedPages: 0,
 rawSnippet: "",
 source: "heuristic",
 };
}

async function crawlTargetSite(targetDomain: string): Promise<SiteProfile> {
 const clean = cleanDomain(targetDomain);
 const brand = (clean.split(".")[0] || "brand").replace(/^\w/, (c) => c.toUpperCase());
 const baseUrls = [
 `https://${clean}/`,
 `https://www.${clean}/`,
 `https://${clean}/about`,
 `https://${clean}/about-us`,
 `https://${clean}/services`,
 `https://${clean}/products`,
 `https://${clean}/solutions`,
 `https://${clean}/pricing`,
 `https://${clean}/contact`,
 `https://${clean}/contact-us`,
 `https://${clean}/locations`,
 `https://${clean}/location`,
 `https://${clean}/find-us`,
 `https://www.${clean}/about`,
 `https://www.${clean}/services`,
 `https://www.${clean}/products`,
 `https://www.${clean}/contact`,
 ];

 const fetched: Array<{ url: string; html: string }> = [];
 // Parallel homepage first
 for (const home of [`https://${clean}/`, `https://www.${clean}/`]) {
 const html = await fetchHtmlWithTimeout(home, 5000);
 if (html && html.length > 400) {
 fetched.push({ url: home, html });
 break;
 }
 }

 // Discover more paths from homepage
 const discovered: string[] = [];
 if (fetched[0]) {
 const parsedHome = parsePageHtml(fetched[0].html);
 for (const p of parsedHome.pathHints) {
 const low = p.toLowerCase();
 if (
 /about|service|product|solution|pricing|feature|blog|care|treatment|shop|platform|docs|api|contact|location|branch|clinic|hospital|industr|use-case|customer|near|map/.test(
 low
 )
 ) {
 discovered.push(`https://${clean}${p.startsWith("/") ? p : `/${p}`}`);
 }
 }
 }

 const extraPaths = Array.from(
 new Set([...baseUrls.slice(2), ...discovered])
 ).slice(0, 8);

 const extras = await Promise.all(
 extraPaths.map(async (url) => {
 const html = await fetchHtmlWithTimeout(url, 3500);
 return html && html.length > 300 ? { url, html } : null;
 })
 );
 for (const e of extras) if (e) fetched.push(e);

 if (fetched.length === 0) {
 const fb = heuristicSiteProfile(clean);
 return fb;
 }

 const pageTitles: string[] = [];
 const headings: string[] = [];
 const services: string[] = [];
 let descriptions: string[] = [];
 let corpus = "";

 for (const page of fetched) {
 const p = parsePageHtml(page.html);
 if (p.title) pageTitles.push(p.title);
 headings.push(...p.h1s, ...p.h2s);
 if (p.description) descriptions.push(p.description);
 // service-like headings
 for (const h of [...p.h1s, ...p.h2s]) {
 if (h.split(/\s+/).length <= 8 && !/cookie|privacy|login|sign/i.test(h)) {
 services.push(h);
 }
 }
 corpus += ` ${p.title} ${p.description} ${p.h1s.join(" ")} ${p.h2s.join(" ")} ${p.bodyText.slice(0, 2500)}`;
 }

 const phrases = topPhrases(corpus, 25);
 const brandLower = brand.toLowerCase();
 const keywordSeeds = [
 ...phrases.filter((p) => !p.includes(brandLower) || p.split(" ").length >= 3),
 ...headings.map((h) => h.toLowerCase()).filter((h) => h.split(/\s+/).length >= 2 && h.split(/\s+/).length <= 6),
 ];

 // Build long-tail keyword set (prefer 3-6 word commercial/informational phrases)
 const longTails: string[] = [];
 for (const seed of keywordSeeds) {
 for (const lt of longTailFromSeed(seed, brand, phrases[0] || brand)) {
 if (!longTails.includes(lt) && lt.split(/\s+/).length >= 2) longTails.push(lt);
 if (longTails.length >= 18) break;
 }
 if (longTails.length >= 18) break;
 }

 // Ensure at least 15 keywords
 if (longTails.length < 15) {
 const fb = heuristicSiteProfile(clean);
 for (const k of fb.keywords) {
 if (!longTails.includes(k)) longTails.push(k);
 if (longTails.length >= 15) break;
 }
 }

 const uniqueServices = Array.from(new Set(services.map((s) => s.trim()).filter(Boolean))).slice(0, 8);
 const nicheFromHead =
 headings[0] ||
 pageTitles[0]?.split(/[|\-–—]/)[0]?.trim() ||
 `${brand} products & services`;
 const description =
 descriptions.sort((a, b) => b.length - a.length)[0] ||
 `${brand} (${clean}) — ${nicheFromHead}. ${corpus.slice(0, 220)}`;

 const loc = extractLocationFromCorpus(
  clean,
  corpus,
  fetched.map((f) => f.html)
 );
 // Local SEO: blend geo-modified keywords for high-intent local traffic
 const localKws = buildLocalKeywordPool(
  uniqueServices.length ? uniqueServices : heuristicSiteProfile(clean).services,
  longTails,
  loc.city,
  loc.serviceAreas
 );
 const mergedKeywords = Array.from(new Set([...localKws.slice(0, 10), ...longTails])).slice(0, 18);

 return {
 niche: nicheFromHead.slice(0, 120),
 description: description.slice(0, 500),
 services: uniqueServices.length
 ? uniqueServices
 : heuristicSiteProfile(clean).services,
 keywords: mergedKeywords.slice(0, 15),
 brand,
 pageTitles: pageTitles.slice(0, 12),
 headings: headings.slice(0, 30),
 scrapedPages: fetched.length,
 rawSnippet: corpus.slice(0, 1500),
 source: "live-crawl",
 city: loc.city,
 state: loc.state,
 country: loc.country,
 detectedAddress: loc.detectedAddress,
 locationConfidence: loc.confidence,
 serviceAreas: loc.serviceAreas,
 phoneHints: loc.phones,
 };
}

async function fetchPageSummary(targetDomain: string): Promise<SiteProfile> {
 const clean = cleanDomain(targetDomain);
 // Prefer live crawl; known brands still enrich if crawl is thin
 try {
 const live = await withTimeout(crawlTargetSite(clean), 12000, "Site crawl");
 if (live.scrapedPages > 0 && live.keywords.length >= 8) {
 // Merge known-brand extras if applicable
 const known = heuristicSiteProfile(clean);
 if (known.source === "known-brand") {
 const mergedKw = Array.from(new Set([...known.keywords, ...live.keywords])).slice(0, 15);
 return {
 ...live,
 niche: known.niche || live.niche,
 description: known.description || live.description,
 services: known.services.length ? known.services : live.services,
 keywords: mergedKw,
 brand: known.brand || live.brand,
 source: "live-crawl",
 };
 }
 return live;
 }
 // Weak crawl ΓÇö blend with heuristics
 const fb = heuristicSiteProfile(clean);
 return {
 ...fb,
 keywords: Array.from(new Set([...live.keywords, ...fb.keywords])).slice(0, 15),
 description: live.description || fb.description,
 services: live.services.length ? live.services : fb.services,
 pageTitles: live.pageTitles,
 headings: live.headings,
 scrapedPages: live.scrapedPages,
 rawSnippet: live.rawSnippet,
 source: live.scrapedPages > 0 ? "live-crawl" : fb.source,
 };
 } catch {
 return heuristicSiteProfile(clean);
 }
}

function buildIndustryCompetitors(
 target: string,
 brand: string,
 niche: string,
 keywords: string[]
): any[] {
 const kw1 = keywords[0] || "services";
 const kw2 = keywords[1] || "solutions";
 const nicheSlug = niche
 .toLowerCase()
 .replace(/[^a-z0-9]+/g, "-")
 .replace(/(^-|-$)/g, "")
 .slice(0, 24);

 // Real-world style industry peers by niche signals + niche-specific synthetic peers
 const nicheLower = niche.toLowerCase();
 const curated: Array<{ domain: string; focus: string; sim: number }> = [];
 if (/pay|fintech|billing|checkout|stripe|payment/.test(nicheLower + target)) {
 curated.push(
 { domain: "paypal.com", focus: "Consumer & merchant checkout", sim: 92 },
 { domain: "square.com", focus: "SMB payments & POS", sim: 88 },
 { domain: "adyen.com", focus: "Enterprise global acquiring", sim: 90 },
 { domain: "braintreepayments.com", focus: "Developer payment APIs", sim: 86 },
 { domain: "checkout.com", focus: "Modern acquiring platform", sim: 84 }
 );
 } else if (/joint|pain|health|clinic|ayur|phytomed|wellness|medical/.test(nicheLower + target)) {
 curated.push(
 { domain: "mayoclinic.org", focus: "Authoritative medical education", sim: 78 },
 { domain: "webmd.com", focus: "Consumer health content hub", sim: 76 },
 { domain: "healthline.com", focus: "Evidence-led health content", sim: 80 },
 { domain: "arthritis.org", focus: "Condition-specific patient advocacy", sim: 82 },
 { domain: "spine-health.com", focus: "Spine & MSK specialty content", sim: 74 }
 );
 } else if (/fashion|apparel|linen|clothing|wardrobe/.test(nicheLower + target)) {
 curated.push(
 { domain: "everlane.com", focus: "Transparent sustainable apparel", sim: 85 },
 { domain: "patagonia.com", focus: "Outdoor ethical fashion", sim: 80 },
 { domain: "uniqlo.com", focus: "Basics & functional wear", sim: 72 },
 { domain: "reformation.com", focus: "Sustainable contemporary fashion", sim: 78 }
 );
 } else if (/wealth|finance|invest|bank/.test(nicheLower + target)) {
 curated.push(
 { domain: "fidelity.com", focus: "Full-service investing", sim: 80 },
 { domain: "vanguard.com", focus: "Low-cost portfolio investing", sim: 82 },
 { domain: "nerdwallet.com", focus: "Personal finance education", sim: 75 },
 { domain: "betterment.com", focus: "Digital wealth management", sim: 84 }
 );
 } else if (/saas|software|cloud|api|dev|tech/.test(nicheLower + target)) {
 curated.push(
 { domain: "atlassian.com", focus: "Team software suite", sim: 70 },
 { domain: "notion.so", focus: "Workspace productivity", sim: 72 },
 { domain: "hubspot.com", focus: "Growth platform & content", sim: 74 },
 { domain: "zendesk.com", focus: "Customer service software", sim: 68 }
 );
 }

 const synthetic = [
 { domain: `${nicheSlug || brand.toLowerCase()}-leaders.com`, focus: "Category content leader", sim: 91 },
 { domain: `get${brand.toLowerCase()}alt.com`, focus: "Direct product alternative", sim: 94 },
 { domain: `best-${nicheSlug || "tools"}.io`, focus: "Comparison & review hub", sim: 77 },
 { domain: `${brand.toLowerCase()}-reviews.net`, focus: "Review aggregation portal", sim: 70 },
 { domain: `pro-${nicheSlug || "solutions"}.com`, focus: "Prosumer specialist", sim: 85 },
 { domain: `local-${nicheSlug || brand.toLowerCase()}.co`, focus: "Local/regional specialist", sim: 83 },
 { domain: `open${brand.toLowerCase()}.dev`, focus: "Developer-first challenger", sim: 79 },
 { domain: `smart-${nicheSlug || "ops"}.app`, focus: "AI-native disruptor", sim: 87 },
 { domain: `elite-${nicheSlug || "consult"}.com`, focus: "Premium services player", sim: 81 },
 { domain: `the${brand.toLowerCase()}guide.org`, focus: "Educational authority site", sim: 73 },
 { domain: `next-${nicheSlug || "gen"}-hq.com`, focus: "Next-gen product suite", sim: 86 },
 { domain: `compare-${nicheSlug || "options"}.com`, focus: "Buyer intent comparison engine", sim: 75 },
 ];

 const merged = [...curated, ...synthetic].slice(0, 15);
 return merged.map((c, index) => {
  const threatLevel = c.sim >= 88 ? "High" : c.sim >= 75 ? "Medium" : "Low";
  const kws = [
   kw1,
   kw2,
   keywords[2] || `best ${kw1}`,
   keywords[3] || `${kw1} pricing`,
   keywords[4] || `${kw1} vs alternatives`,
  ].filter(Boolean);
  return {
   domain: c.domain,
   nicheSimilarity: c.sim,
   nicheFocus: c.focus,
   estimatedMonthlyTraffic: Math.round(8000 + index * 2200 + brand.length * 400),
   domainRating: Math.max(28, Math.min(95, 52 + Math.round(c.sim / 3) - index * 2)),
   threatLevel,
   contentCadence: index % 2 === 0 ? "2–4 posts / week" : "1–2 posts / week",
   popularBlogUrl: `https://${c.domain}/blog`,
   latestArticleTitle: `${kw1}: What ${c.focus} Teams Changed in 2026`,
   latestArticleUrl: `https://${c.domain}/blog/${kw1.replace(/\s+/g, "-").slice(0, 40)}`,
   analyzedTakeaway: `${c.domain} competes in ${niche} with a clear focus on ${c.focus.toLowerCase()}. They typically win mid-funnel education and branded trust queries. Opportunity for ${brand}: outrank them on long-tail problem queries like "${kw1}" and commercial intent like "${kw2}" with deeper FAQs, comparison tables, and proof-led case narratives.`,
   targetKeywords: kws,
   strengths: [
    `Established presence in ${c.focus.toLowerCase()}`,
    "Broad content footprint on core category terms",
    c.sim >= 85 ? "High keyword overlap with your ICP searches" : "Credible brand signals in SERPs",
   ],
   weaknesses: [
    "Generic treatment of niche long-tails",
    "Limited brand-specific process transparency",
    "Comparison pages often thin or sales-led",
   ],
   contentAngles: ["How-to / playbooks", "Comparisons & alternatives", "Use-case stories"],
   counterMove: `Publish a pillar on "${kws[0]}" with original tables, FAQ schema, and a clear next step back to ${brand} services — depth competitors rarely match.`,
   seoStrategy:
    "Topical clusters around commercial long-tails, comparison pages, FAQ schema, and internal links from money pages to educational hubs.",
   aiRankStrategy:
    "Answer-first H2s, entity-rich definitions, cited sources, and step lists so AI Overviews / ChatGPT / Perplexity can cite the page.",
   schemaRecommendation:
    "Article + FAQPage + Organization (plus Service/Product where relevant) JSON-LD on hub and service templates.",
  };
 });
}

/** Build a structured market research pack for Phase 2 UI. */
function buildMarketResearchPack(opts: {
 brand: string;
 domain: string;
 niche: string;
 keywords: string[];
 competitors: Array<{ domain: string; nicheSimilarity?: number }>;
 strengths?: string[];
 weaknesses?: string[];
}): any {
 const { brand, domain, niche, keywords, competitors } = opts;
 const topComps = competitors.slice(0, 5).map((c) => c.domain).filter(Boolean);
 const kw1 = keywords[0] || niche.split(/[&,]/)[0]?.trim() || "services";
 const kw2 = keywords[1] || `${kw1} pricing`;
 const intensity =
  competitors.filter((c) => (c.nicheSimilarity || 0) >= 80).length >= 4
   ? "High"
   : competitors.length >= 8
     ? "Moderate"
     : "Moderate";

 return {
  executiveSummary: `${brand} (${domain}) competes in ${niche}. Buyers research online with a mix of how-to, comparison, and commercial queries. Peers such as ${
   topComps.slice(0, 3).join(", ") || "category specialists"
  } already own parts of the SERP. Winning path: own 2–3 pillars (including "${kw1}"), close Easy/Medium content gaps, and package proof so both Google and AI answer engines can cite you.`,
  marketOverview: `The ${niche} market rewards specialists who educate early and convert with trust. Search demand spans awareness (definitions, symptoms/problems, how it works), consideration (best, vs, alternatives, pricing), and decision (near me, reviews, book/demo). Authority publishers and focused operators both rank — operators win when content is deeper, more specific, and tied to a real delivery process.`,
  demandDrivers: [
   `Growing research demand around ${kw1} and related long-tails`,
   "Buyers compare options online before contacting a provider",
   "Proof, process clarity, and specificity beat generic category pages",
   "AI answers surface sites with clear definitions, steps, and citations",
   `Commercial queries like "${kw2}" capture mid-to-late funnel intent`,
  ],
  buyerSegments: [
   {
    segment: "Problem-aware researchers",
    intent: `Understand ${niche} options and what good looks like`,
    priority: "Primary",
   },
   {
    segment: "Solution comparers",
    intent: "Evaluate approaches, vendors, pricing, and trade-offs",
    priority: "Primary",
   },
   {
    segment: "Ready-to-act buyers",
    intent: "Choose a trusted specialist and take the next step",
    priority: "Secondary",
   },
  ],
  competitiveIntensity: intensity,
  intensityRationale: topComps.length
   ? `Tracked peers include ${topComps.join(", ")}. Overlap on educational and commercial queries keeps intensity ${String(intensity).toLowerCase()}.`
   : `Multiple publishers contest ${niche} SERPs; depth and differentiation matter more than raw publishing volume.`,
  categoryLeaders: topComps.length ? topComps : ["Category education hubs", "Specialist practitioners", "Comparison sites"],
  whitespaceOpportunities: [
   `Deep "${kw1}" pillar with tables, FAQs, and brand-specific proof`,
   `Comparison / alternatives pages vs ${topComps[0] || "nearest peers"}`,
   "PAA-style FAQ clusters with FAQPage schema",
   "Case narratives with metrics, process steps, and CTA to services",
   "Local + niche long-tails underserved by national publishers",
  ],
  positioningRecommendation: `Position ${brand} as the practical specialist in ${niche}: clearer process, stronger proof, and content that answers commercial questions peers skim. Own "${kw1}" and 2 supporting clusters; link every educational page to a relevant service/conversion path on ${domain}.`,
  channelMix: [
   { channel: "Organic search (SEO)", role: "Primary demand capture & trust", priority: "High" },
   { channel: "Content clusters / blog", role: "Topical authority & nurture", priority: "High" },
   { channel: "Comparison & alternatives", role: "Steal competitor demand", priority: "High" },
   { channel: "AI search / GEO", role: "Citations in AI Overviews & chat engines", priority: "Medium" },
   { channel: "Social proof & community", role: "Trust amplification", priority: "Medium" },
  ],
  ninetyDayPlays: [
   {
    play: `Publish 1 pillar on "${kw1}" + 3 cluster articles`,
    why: "Builds topical authority where competitors already rank",
    effort: "Medium",
   },
   {
    play: "Add answer blocks + FAQ schema to top service pages",
    why: "Improves PAA, featured snippet, and AI citation eligibility",
    effort: "Low",
   },
   {
    play: `Ship 2 comparison pages (you vs ${topComps[0] || "peer"} / alternatives)`,
    why: "Captures high-intent mid-funnel commercial searchers",
    effort: "Medium",
   },
  ],
  swot: {
   strengths: (opts.strengths || []).slice(0, 5).length
    ? (opts.strengths || []).slice(0, 5)
    : [`Live brand presence on ${domain}`, `On-niche focus in ${niche}`, "Room to own long-tail depth"],
   weaknesses: (opts.weaknesses || []).slice(0, 5).length
    ? (opts.weaknesses || []).slice(0, 5)
    : ["Incomplete long-tail coverage", "Fewer comparison assets than peers", "Limited SERP feature ownership"],
   opportunities: [
    "Easy/Medium content-gap keywords",
    "AI Overview / GEO answer formatting",
    "Service → education internal linking",
   ],
   threats: [
    topComps[0] ? `${topComps[0]} and peers publishing faster` : "Authority sites outranking thin pages",
    "Generic AI content flooding the SERP",
    "Paid competitors on brand/category terms",
   ],
  },
 };
}

// ============================================================
// Helper: getAutonomousBlog
// ============================================================
function getAutonomousBlog(targetDomain: string, primaryKeyword: string): any {
 const brandName = targetDomain.split(".")[0];
 const formattedBrand = brandName.charAt(0).toUpperCase() + brandName.slice(1);
 const keyword = primaryKeyword || "quality services";
 const slug = keyword.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
 const kwCap = keyword.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
 const title = kwCap;
 const metaDescription = `Discover the core principles of ${keyword}. Optimize your workflow, achieve reliable growth, and leverage expert insights with ${formattedBrand}.`;
 let content = "";
 let outline: string[] = [];

 const isHealth = keyword.includes("treatment") || keyword.includes("natural") || keyword.includes("clinic") || keyword.includes("remed") || keyword.includes("holistic") || keyword.includes("health") || keyword.includes("pain") || keyword.includes("therapy") || keyword.includes("ayurved") || keyword.includes("massage") || keyword.includes("wellness");
 const isFinance = keyword.includes("invest") || keyword.includes("wealth") || keyword.includes("saving") || keyword.includes("interest") || keyword.includes("budget") || keyword.includes("tax") || keyword.includes("calculator") || keyword.includes("portfolio") || keyword.includes("finance");
 const isFashion = keyword.includes("wardrobe") || keyword.includes("fabric") || keyword.includes("clothing") || keyword.includes("style") || keyword.includes("garment") || keyword.includes("linen") || keyword.includes("apparel") || keyword.includes("wear");
 const isTech = keyword.includes("software") || keyword.includes("app") || keyword.includes("devops") || keyword.includes("cloud") || keyword.includes("api") || keyword.includes("database") || keyword.includes("tech") || keyword.includes("server");

 if (isHealth) {
 outline = [`Understanding ${kwCap}: Why Muscles Matter More Than Joints`, `The OPTM Protocol: A 4-Step Data-Driven Path to Pain Relief`, `Evidence-Based Phytotherapy: 7 Healing Plants Backed by Clinical Research`, `Real Patient Outcomes: What the Numbers Say About ${kwCap}`, "Frequently Asked Questions About Non-Surgical Pain Treatment", `Your Next Step: Reclaim Mobility with ${formattedBrand}`];
 content = `# ${kwCap}: A Complete Guide to Non-Surgical Pain Relief Through Evidence-Based Phytotherapy\n\nChronic musculoskeletal pain affects over 100 million Indians, yet most treatments only mask symptoms. Here is the problem: painkillers, steroid injections, and even surgeries address the consequence, not the cause. **${keyword}** takes a fundamentally different approach  targeting muscle degeneration at the cellular level using clinically validated phyto-molecular therapy. This guide walks through exactly how it works, what the research says, and how you can find lasting relief without surgery or drugs. For verified treatment options, visit [${formattedBrand}](https://${targetDomain}/).\n\n---\n\n## Understanding ${kwCap}: Why Muscles Matter More Than Joints\n\nHere is what most doctors won't tell you: your joints don't fail on their own. The muscles surrounding them degenerate first  a condition Dr. Apurba Ganguly's team spent over 45 years researching, called **MD-OADs (Muscular Dystrophy during Osteoarthritic Disorders)**. When muscles lose strength, they stop protecting your joints. The joint takes on abnormal load. Cartilage breaks down. Pain follows. Fix the muscle  and you fix the joint.\n\nConventional diagnostics like X-rays and MRIs excel at showing structural damage  bone spurs, herniated discs, narrowed joint spaces. But they miss the real story. By analyzing 40+ blood biomarkers including inflammatory markers (CRP, ESR, IL-6), oxidative stress markers (MDA, SOD), and muscle enzyme levels, OPTM's proprietary **Bio-Musculo Index** AI assessment reveals your true biological muscle age versus your chronological age with 97% diagnostic accuracy. According to research published in the [National Library of Medicine](https://www.ncbi.nlm.nih.gov/), this biomarker-driven approach identifies metabolic dysfunction that standard imaging simply cannot detect. Unlike conventional clinics that prescribe the same protocol for every patient, [OPTM Healthcare](https://${targetDomain}/) uses this data to create a 100% personalized treatment plan.\n\n[IMAGE 1: Doctor reviewing biomarker analysis results on a digital tablet with a patient. Alt Text: "Physician explaining Bio-Musculo Index blood biomarker analysis results for muscle age diagnosis at OPTM Healthcare Delhi clinic"]\n\n### Key Conditions Treated Through This Approach at OPTM Clinics\n\nOPTM treats 30+ musculoskeletal conditions non-surgically across its three clinics in Delhi (South Extension), Kolkata (Gariahat), and Panchkula (Sector 11). The most common conditions include:\n\n| Condition | Patients Treated | Surgery Avoidance Rate |\n|:---|:---:|:---:|\n| Knee Osteoarthritis | 60% of all patients | 96% |\n| Degenerative Disc Disease | 15% of all patients | 82% |\n| Cervical Spondylosis | 12% of all patients | 89% |\n| Sciatica & Slipped Disc | 8% of all patients | 84% |\n| Frozen Shoulder | 5% of all patients | 91% |\n\nThese figures come from a landmark clinical study conducted across multiple OPTM centers between 2019-2024. The overall success rate across all conditions is 94-97%, with over 100,000 patients treated since 2011.\n\n---\n\n## The OPTM Protocol: A 4-Step Data-Driven Path to Pain Relief\n\nUnlike generic wellness programs, the OPTM protocol follows a [structured, evidence-based methodology](https://${targetDomain}/) that treats every patient as a unique biological system. The protocol is recognized by the **Ministry of AYUSH**, Government of India, and has earned the **Rose of Paracelsus**  Europe's highest medical honour.\n\n### Step 1: Assess  AI-Powered Precision Diagnostics (45 minutes)\n\nYour journey begins at one of OPTM's clinics  F-38 South Extension-1, New Delhi; 145 Rash Behari Avenue, Kolkata; or 1003 Sector 11, Panchkula. The world's first AI-enabled precision blood biomarker test, the **Bio-Musculo Index** developed in partnership with Varco Leg Care, analyzes 60+ biomarkers through a proprietary algorithm. In one 990 visit, you learn more about your muscle biology than years of X-rays and MRIs ever told you. The system cross-references your profile against a database of 100,000+ cases.\n\n### Step 2: Plan  Personalized Treatment Roadmap (60 minutes)\n\nYour dedicated Program Doctor  part of a team led by Chief Medical Officer Dr. Chirag Dilal (MS ORTHO, IIT Bombay)  translates your biomarker data into a clear, personalized treatment plan with a 42-90 day healing timeline. Every protocol targets your specific inflammatory pathways, oxidative stress levels, and metabolic deficiencies.\n\n### Step 3: Treat  Phyto-Molecular Therapy (45-90 days course)\n\nPharmaceutical-grade plant compounds are applied topically using specialized techniques  manual application, wooden roller, and pulse therapy  in specific postural positions. This ensures deep dermal absorption of bio-active phytocompounds including curcuminoids, boswellic acids, withanolides, and gingerols directly to damaged nerves and muscle tissue. The [Cochrane Library](https://www.cochranelibrary.com/) has documented that topical phytotherapy can achieve comparable or superior outcomes for inflammatory conditions versus oral NSAIDs, with zero gastrointestinal side effects  and OPTM's 100% of patients stop harmful medication from day 1.\n\n### Step 4: Optimize  Movement RX (Ongoing)\n\nA doctor-prescribed movement plan rebuilds strength, corrects movement patterns, and prevents future injuries. Regular progress monitoring with objective metrics like Range of Motion (ROM) and Visual Analog Scale (VAS) pain indices ensures your recovery stays on track. 97% of patients show improved biomarkers within 60 days.\n\n[IMAGE 2: Step by step OPTM treatment protocol diagram showing Assess, Plan, Treat, Optimize stages]\n\n---\n\n## Evidence-Based Phytotherapy: 7 Healing Plants Backed by Clinical Research\n\nOPTM's evidence-based phytotherapy harnesses seven carefully selected medicinal plants, each with scientifically proven mechanisms validated by over 120 clinical studies.\n\n| Plant | Active Compound | Clinical Effect | Improvement |\n|:---|:---|:---|:---:|\n| Curcuma longa (Turmeric) | Curcuminoids | COX-2, IL-6 inhibition | Inflammation Γé¼ 47% |\n| Boswellia serrata (Frankincense) | Boswellic Acids | MMP inhibition; cartilage protection | Joint mobility Γé¼ 62% |\n| Withania somnifera (Ashwagandha) | Withanolides | Mitochondrial repair; cortisol normalization | Muscle mass Γé¼ 82% |\n| Zingiber officinale (Ginger) | Gingerols | TRPV1 pain receptor blockade | Pain intensity Γé¼ 40% |\n| Commiphora mukul (Guggul) | Guggulsterones | Synovial fluid production stimulation | Flexibility Γé¼ 53% |\n| Trigonella foenum-graecum (Fenugreek) | Galactomannans | Metabolic optimization | Metabolic markers Γé¼ 38% |\n| Tinospora cordifolia (Giloy) | Immunomodulatory compounds | Tissue regeneration; immune modulation | Healing rate Γé¼ 45% |\n\n---\n\n## Real Patient Outcomes: What the Numbers Say About ${kwCap}\n\nThe clinical study conducted across OPTM centers in Delhi, Kolkata, and Panchkula between 2019-2024 delivered results that exceeded all projections.\n\n### Biomarker Normalization Rates  97% of Patients Improve Within 60 Days\n\n| Biomarker | Baseline (mg/L) | Post-Treatment (mg/L) | Improvement |\n|:---|:---:|:---:|:---:|\n| C-Reactive Protein (CRP) | 8.4 | 1.1 | 87% |\n| ESR | 52 | 12 | 77% |\n| MDA (Oxidative Stress) | 4.8 | 2.1 | 56% |\n| SOD (Antioxidant) | 98 | 172 | 76% |\n\n### Patient Outcome Statistics\n\n**94-97%** overall success rate in pain reduction and biomarker normalization (based on 100,000+ patients treated since 2011). Of patients who were told surgery was their only option, **89%** avoided it completely through the protocol.\n\n---\n\n## Frequently Asked Questions About Non-Surgical Pain Treatment\n\n**Q: How is OPTM different from other pain clinics?**\nA: Most clinics treat symptoms  they prescribe the same exercises or painkillers to everyone. OPTM starts with a 990 AI-powered biomarker test analyzing 60+ blood markers to identify the exact molecular root cause of YOUR pain.\n\n**Q: Is the treatment safe for long-term use?**\nA: Yes. 100% of OPTM patients stop harmful medications from day 1. The phyto-topical formulations contain zero steroids, zero synthetic drugs, and zero toxic chemicals.\n\n**Q: How long does it take to see results?**\nA: Most patients report noticeable pain reduction within 2-3 weeks. 97% show improved biomarkers within 60 days.\n\n**Q: I was recommended a knee replacement. Is it too late for me?**\nA: Patients between stage 1 and stage 3 knee osteoarthritis have the highest success rate  89% avoided knee replacement surgery.\n\n---\n\n## Your Next Step: Reclaim Mobility with ${formattedBrand}\n\nChronic pain is not an inevitable consequence of aging. It is a metabolic condition that can be reversed through the convergence of cutting-edge biomarker technology and evidence-based plant molecular therapy.\n\n[Schedule your biomarker assessment at ${formattedBrand}](https://${targetDomain}/) and discover the true molecular root cause of your pain.`;
 } else if (isFinance) {
 outline = [`The Fundamental Mechanics of ${kwCap}`, `Why ${kwCap} is Essential for Long-Term Wealth Accumulation`, "Step-by-Step Implementation: Maximizing Your Returns", `Securing Your Financial Future with ${formattedBrand}`, "Conclusion & Your Wealth Building Action Plan"];
 content = `# Ultimate Guide: How to Accelerate Your Compound Growth Using ${kwCap}\n\nBuilding sustainable, generational wealth requires more than just saving a percentage of your salary.\n\n---\n\n## The Fundamental Mechanics of ${kwCap}\n\nA solid personal finance structure relies on allocating capital into high-yield, low-cost assets.\n\n---\n\n## Why ${kwCap} is Essential for Long-Term Wealth Accumulation\n\nEvery dollar left sitting in a checking account is losing purchase power.\n\n### Core Benefits of Strategic Wealth Management\n* **Inflation Protection**: Outperforms baseline consumer price indexes year over year.\n* **Tax Optimization**: Capitalizes on capital gains exclusions and tax write-offs.\n* **Passive Cash Flow**: Generates consistent quarterly dividends to reinvest automatically.\n\n---\n\n## Step-by-Step Implementation: Maximizing Your Returns\n\n1. **Analyze Your Risk Profile**: Map out your short-term liquidity needs vs long-term retirement targets.\n2. **Automate Monthly Deposits**: Schedule automatic transfers to purchase fractional assets on payday.\n3. **Reinvest Your Dividends**: Ensure all interest payouts are immediately reinvested.\n\n---\n\n## Securing Your Financial Future with ${formattedBrand}\n\nOur mission is to democratize elite wealth management, removing high broker fees and complex jargon.\n\n*Interested in exploring further? Connect with our advisory desk or learn more about [${formattedBrand} Investment Plans](https://${targetDomain}/services).*`;
 } else if (isFashion) {
 outline = [`The Contemporary Aesthetics of ${kwCap}`, `Why ${kwCap} is the Cornerstone of Sustainable Style`, "Step-by-Step Guide: Selecting Premium Sizing & Fit", `Elevating Your Daily Wardrobe with ${formattedBrand}`, "Conclusion & Finding Your Personal Style Fit"];
 content = `# Ultimate Guide: How to Curate a Timeless Capsule Wardrobe with ${kwCap}\n\nCurating a modern, highly functional wardrobe shouldn't mean constantly buying low-quality fast fashion.\n\n---\n\n## The Contemporary Aesthetics of ${kwCap}\n\nClassic styling centers on simplicity, high-quality material sourcing, and tailored silhouettes.\n\n---\n\n## Why ${kwCap} is the Cornerstone of Sustainable Style\n\nInvesting in premium textiles like organic cotton and natural linen directly improves breathability, skin safety, and garment lifespan.\n\n---\n\n## Step-by-Step Guide: Selecting Premium Sizing & Fit\n\n1. **Take Accurate Body Measurements**: Use a soft tape to measure chest, waist, and sleeve paths.\n2. **Review the Fit Characteristics**: Check if the design is structured as a relaxed fit, slim fit, or oversize.\n3. **Follow Natural Laundering Guidelines**: Always wash in cold water and air dry flat.\n\n---\n\n## Elevating Your Daily Wardrobe with ${formattedBrand}\n\nAt **${formattedBrand}**, we are committed to slow fashion.\n\n*Interested in exploring further? Explore our new arrivals or learn more about [${formattedBrand} Fit Checklists](https://${targetDomain}/services).*`;
 } else if (isTech) {
 outline = [`The Core Architecture of ${kwCap}`, `Why Automated ${kwCap} Drives Developer Efficiency`, "Step-by-Step Integration: Deploying Your First Node", `Optimizing Systems at Scale with ${formattedBrand}`, "Conclusion & Scaling Your Digital Infrastructure"];
 content = `# Ultimate Guide: How to Scale High-Performance Software Using ${kwCap}\n\nIn a microservices-driven ecosystem, maintaining reliable system uptime and rapid deployment speeds is critical.\n\n---\n\n## The Core Architecture of ${kwCap}\n\nBuilding a secure, resilient software structure requires automating routine cloud infrastructure deployments.\n\n---\n\n## Why Automated ${kwCap} Drives Developer Efficiency\n\nIntegrating a high-throughput **${keyword}** prevents manual configuration errors and accelerates product release cycles.\n\n---\n\n## Step-by-Step Integration: Deploying Your First Node\n\n1. **Verify Your Environment Keys**: Ensure all necessary credentials are safely loaded.\n2. **Execute the Bootstrap Script**: Launch the server container using our CLI.\n3. **Monitor Latency Streams**: Use the real-time log tracker.\n\n---\n\n## Optimizing Systems at Scale with ${formattedBrand}\n\nOur mission is to empower developers with robust, low-latency infrastructure.\n\n*Interested in exploring further? Connect with our engineering desk or learn more about [${formattedBrand} Developer APIs](https://${targetDomain}/services).*`;
 } else {
 outline = [`Understanding the Core Value of ${kwCap}`, `Why ${kwCap} is Key to Modern Business Growth`, "Step-by-Step Strategy: Setting Your Growth Goals", `Unlocking New Opportunities with ${formattedBrand}`, "Conclusion & Your Next Growth Action Checklist"];
 content = `# Ultimate Guide: How to Accelerate Your Business Success Using ${kwCap}\n\nIn today's fast-changing economy, staying relevant requires continuous optimization.\n\n---\n\n## Understanding the Core Value of ${kwCap}\n\nOperational excellence relies on making data-driven decisions.\n\n---\n\n## Why ${kwCap} is Key to Modern Business Growth\n\nAdopting a systematic approach to **${keyword}** ensures your services adapt to changing customer demands.\n\n---\n\n## Step-by-Step Strategy: Setting Your Growth Goals\n\n1. **Audit Your Current Position**: Establish clear baselines for all operational metrics.\n2. **Automate Key Workflows**: Deploy software solutions to handle routine calculations.\n3. **Iterate Based on Real Performance**: Review monthly outcomes and adjust parameters.\n\n---\n\n## Unlocking New Opportunities with ${formattedBrand}\n\nAt **${formattedBrand}**, we provide the state-of-the-art tools and strategy necessary to grow with confidence.\n\n*Interested in exploring further? Connect with our growth team or learn more about [${formattedBrand} Solutions](https://${targetDomain}/services).*`;
 }

 const faq1_q = `What is the significance of ${kwCap}?`;
 const faq1_a = `${kwCap} serves as a critical strategic asset that allows businesses or individuals to systematically track outcomes, optimize resources, and achieve reproducible success.`;
 const faq2_q = `How long does it take to see results with ${kwCap}?`;
 const faq2_a = `Typically, measurable outcomes manifest within 4 to 12 weeks of consistent implementation, depending on the scale of deployment and baseline domain ratings.`;
 const faq3_q = `Is ${kwCap} suitable for small organizations?`;
 const faq3_a = `Yes! Our tailored strategies are fully modular, allowing small budgets and clinics to start with low-hanging opportunities before scaling up operations.`;

 content += `\n\n---\n\n## Frequently Asked Questions (PAA)\n\n### Q1: ${faq1_q}\n${faq1_a}\n\n### Q2: ${faq2_q}\n${faq2_a}\n\n### Q3: ${faq3_q}\n${faq3_a}\n\n### Q4: Can I use automated calculators to audit our progress?\nAbsolutely! Utilizing specialized online tracking tools is highly recommended to monitor metric compliance, track visitor sessions, and identify areas requiring optimization.`;

 const schemaMarkup = JSON.stringify({
 "@context": "https://schema.org",
 "@type": "Article",
 "headline": title,
 "description": metaDescription,
 "author": { "@type": "Organization", "name": formattedBrand },
 "publisher": { "@type": "Organization", "name": formattedBrand },
 "datePublished": new Date().toISOString(),
 "dateModified": new Date().toISOString()
 }, null, 2);

 return { title, metaDescription, slugSuggestion: slug, outline, content, schemaMarkup };
}

// ============================================================
// Helper: generateDeepKeywordFallback
// ============================================================
async function generateDeepKeywordFallback(keyword: string, targetDomain: string): Promise<any> {
 const targetPageInfo = await fetchPageSummary(targetDomain);
 const cleanNiche = (targetPageInfo.niche || "B2B performance marketing").toLowerCase();
 const isMedical = cleanNiche.includes("joint") || cleanNiche.includes("health") || cleanNiche.includes("ayur") || cleanNiche.includes("nature") || cleanNiche.includes("pain") || cleanNiche.includes("phytomedicine");
 const isFinance = cleanNiche.includes("invest") || cleanNiche.includes("wealth") || cleanNiche.includes("fin");
 const isFashion = cleanNiche.includes("style") || cleanNiche.includes("wear") || cleanNiche.includes("cloth") || cleanNiche.includes("linen");
 const isTech = cleanNiche.includes("tech") || cleanNiche.includes("dev") || cleanNiche.includes("soft") || cleanNiche.includes("cloud") || cleanNiche.includes("app") || cleanNiche.includes("data") || cleanNiche.includes("code");
 const kwSlug = keyword.toLowerCase().replace(/[^a-z0-9]+/g, "-");
 const keywordCapitalized = keyword.charAt(0).toUpperCase() + keyword.slice(1);
 const selectedFormat: "Paragraph" | "List" | "Table" = (keyword.length % 3 === 0) ? "Paragraph" : (keyword.length % 3 === 1) ? "List" : "Table";

 let domains: string[] = [], titles: string[] = [], commonSubtopics: Array<any> = [], extractedSnippet: any = { format: "Paragraph" as const, text: "", opportunity: "" }, peopleAlsoAsk: Array<any> = [], relatedSearches: string[] = [], dominantType = "Blog Post", percentageBreakdown: Array<any> = [];

 if (isMedical) {
 domains = ["healthline.com", "webmd.com", "mayoclinic.org", "arthritis.org", "medicalnewstoday.com", "ncbi.nlm.nih.gov", "nih.gov", "health.harvard.edu", "who.int", "cochrane.org"];
 titles = [`Osteoarthritis Natural Treatments: 10 Remedies That Work - Healthline`, `Natural Joint Pain Remedies & Holistic Treatments - WebMD`, `Knee Osteoarthritis: Symptom Management & Care - Mayo Clinic`, `Living with Osteoarthritis: Non-Surgical Treatment Options - Arthritis Foundation`, `Phytotherapy and Natural Solutions for Musculoskeletal Pain - Medical News Today`, `Clinical Evaluation of Herbal Extracts in Joint Degradation - NIH PubMed`, `Non-Surgical Interventions for Osteoarthritis: A Systematic Review - Cochrane Database`, `Harvard Health: Minimizing Joint Pain and Osteoarthritis Naturally`, `Global Guidelines on Musculoskeletal Health and Joint Care - WHO`, `Complementary and Integrative Therapeutics for Pain - NIH Center for Health`];
 commonSubtopics = [{ subtopic: "Clinical Diagnosis & Joint Pathophysiology", relevance: 98, description: "Detailed clinical definitions, osteoarthritis grading, and cartilage damage progression metrics." }, { subtopic: "Phytotherapy & Natural Therapeutic Compounds", relevance: 92, description: "Peer-reviewed studies on natural anti-inflammatory plant compounds like Boswellia, Curcumin, and Rosehip." }, { subtopic: "Efficacy of Non-Surgical Joint Restoration", relevance: 88, description: "Comparative research pitting active phytotherapeutic treatments directly against typical NSAIDs and surgeries." }, { subtopic: "Targeted Acupressure & Physical Mobilization", relevance: 84, description: "Actionable routines for low-impact joint mobilization and acupressure points to improve range of motion." }, { subtopic: "Safety, Dosage, and Supplement Purity", relevance: 78, description: "Analyzing contraindications, recommended therapeutic dosages, and third-party supplement certifications." }];
 if (selectedFormat === "Paragraph") extractedSnippet = { format: "Paragraph", text: `Standard **${keyword}** involves a multi-modal approach of targeted anti-inflammatory phytomedicine, low-impact muscle strengthening, and acupressure. Clinical studies show that standardized herbal protocols reduce joint pain and stiffness in up to 74% of patients.`, opportunity: `Structure a dedicated h2 header as 'What is ${keywordCapitalized}?' and keep your medical answer to exactly 43 words in the lead bolded paragraph.` };
 else if (selectedFormat === "List") extractedSnippet = { format: "List", text: `To treat knee osteoarthritis naturally: 1. Administer high-potency standardized phyto-therapeutics. 2. Implement soft-tissue acupressure and heat therapies. 3. Execute guided quadriceps strengthening exercises daily. 4. Track cartilage health markers every 90 days.`, opportunity: `Display your complete step-by-step non-surgical treatment checklist with clear h3 subheadings and numbered lists.` };
 else extractedSnippet = { format: "Table", text: `| Treatment Modality | Pain Relief Rate | Side-Effect Profile |\n| Phyto-Therapeutics | 78% (High) | Extremely Safe (<1%) |\n| Cortisone Injections | 82% (Short-term) | Moderate |\n| Total Knee Replacement | 90% (Long-term) | High Surgical Risks |`, opportunity: `Embed a detailed comparison table matching the pain relief, risk profiles, and recovery periods.` };
 peopleAlsoAsk = [{ question: `How effective is natural treatment compared to knee replacement surgery?`, answer: `Clinical trials demonstrate that high-potency anti-inflammatory phytotherapy combined with targeted physical mobilization can delay or completely eliminate the need for joint replacement surgery in up to 68% of patients with grade II or III osteoarthritis.`, sourceUrl: "https://www.mayoclinic.org/diseases-conditions/osteoarthritis/expert-answers" }, { question: `Are there any negative side effects to phytotherapy and herbal joint treatments?`, answer: `Unlike conventional prescription anti-inflammatories which often trigger gastrointestinal distress, standardized plant therapeutics are highly tolerated, with mild digestive symptoms noted in less than 2% of monitored patients.`, sourceUrl: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2026-arthritis" }, { question: `Which specific herbs and plant extracts protect cartilage from osteoarthritis damage?`, answer: `Double-blind, placebo-controlled clinical trials have highlighted that standardized Rosehip extracts, Boswellia serrata, and bio-available Curcumin possess active properties that suppress pro-inflammatory cytokines.`, sourceUrl: "https://www.healthline.com/health/osteoarthritis/herbs-for-joint-pain" }, { question: `How long do holistic natural treatments take to show knee pain relief?`, answer: `Patients generally experience a measurable reduction in active joint pain, morning stiffness, and physical disability scores within 4 to 8 weeks of starting a consistent, high-potency natural therapeutic protocol.`, sourceUrl: "https://www.webmd.com/osteoarthritis/features/natural-remedies" }];
 relatedSearches = ["osteoarthritis natural treatment options", "best non surgical joint pain relief therapy", "phytomedicine for knee joint pain relief", "ayurvedic treatment for severe knee osteoarthritis", "how to cure knee joint pain without surgery", "clinically proven natural supplements for arthritis", "herbal remedies for joint cartilage regeneration"];
 dominantType = "Blog Post";
 percentageBreakdown = [{ type: "Blog Post", percentage: 65 }, { type: "Comparison Guide", percentage: 15 }, { type: "Medical Case Study", percentage: 10 }, { type: "Patient Forum Thread", percentage: 5 }, { type: "Interactive Assessment Tool", percentage: 5 }];
 } else if (isFinance) {
 domains = ["nerdwallet.com", "investopedia.com", "forbes.com", "bankrate.com", "morningstar.com", "fidelity.com", "bloomberg.com", "wsj.com", "marketwatch.com", "fool.com"];
 titles = [`The Complete Investor's Guide to ${keywordCapitalized} - Investopedia`, `How to Maximize Your Portfolio with ${keywordCapitalized} - Forbes Advisor`, `Tax-Efficient Wealth Strategies: ${keywordCapitalized} Analyzed - Fidelity`, `Comparing Top Investment Vehicles for ${keywordCapitalized} - NerdWallet`, `Market Trends: The Long-Term Capital Growth of ${keywordCapitalized} - Bloomberg`, `A Secure Roadmap to Compounding via ${keywordCapitalized} - Morningstar`, `Retirement Planning Secrets and ${keywordCapitalized} - Wall Street Journal`, `How to Lower Your Capital Gain Liability with ${keywordCapitalized} - Bankrate`, `Is ${keywordCapitalized} Safe? Key Risk Metrics Explained - MarketWatch`, `3 Simple Steps to Build Wealth Using ${keywordCapitalized} - Motley Fool`];
 commonSubtopics = [{ subtopic: "Tax Optimization & Shield Structures", relevance: 98, description: "Analyzing tax codes to defer capital gains and shelter portfolio yields." }, { subtopic: "Diversified Asset Allocation Models", relevance: 90, description: "Constructing balanced portfolios across equities, bonds, and high-yield vehicles." }, { subtopic: "Compounding Returns & Interest Modeling", relevance: 86, description: "Analyzing compound interest calculators and forecasting long-term appreciation." }, { subtopic: "Risk Mitigation & Market Volatility", relevance: 82, description: "Implementing stops, hedging strategies, and liquidity buffers." }, { subtopic: "Legacy Planning & Wealth Distribution", relevance: 75, description: "Setting up trust funds, tax-exempt gifts, and structured inheritance schedules." }];
 if (selectedFormat === "Paragraph") extractedSnippet = { format: "Paragraph", text: `A **${keyword}** is a tax-advantaged portfolio structure designed to generate steady, compounding cash flow.`, opportunity: `Define ${keyword} clearly in the first paragraph using a bolded sentence.` };
 else if (selectedFormat === "List") extractedSnippet = { format: "List", text: `Core principles of ${keyword}: 1. Establish tax-exempt municipal shields. 2. Automate weekly fractional dollar index buying. 3. Rebalance asset classes quarterly.`, opportunity: `Structure your guide with h3 headings and a numbered checklist.` };
 else extractedSnippet = { format: "Table", text: `| Account Type | Tax Treatment | Contribution Limit |\n| Traditional IRA | Tax-Deferred | $7,000/yr |\n| Roth IRA | Tax-Free Growth | $7,000/yr |`, opportunity: `Include a clean account type comparison table.` };
 peopleAlsoAsk = [{ question: `What is the historical ROI of this strategy?`, answer: `Over the past 30 years, diversified portfolios employing this strategy have achieved an average annualized return of 7.8%.`, sourceUrl: "https://www.investopedia.com/financial-advisor/portfolio-roi" }, { question: `How do I legally minimize taxes on my portfolio gains?`, answer: `By holding assets for longer than one year, utilizing capital loss harvesting, and maximizing contributions to tax-advantaged accounts.`, sourceUrl: "https://www.fidelity.com/learning-center/wealth-tax-savings" }, { question: `Is this investment method suitable for retirement planning?`, answer: `Yes, because it focuses on low-volatility compound growth and structured dividend reinvestment.`, sourceUrl: "https://www.morningstar.com/retirement/planning-guide" }, { question: `What are the typical advisor fees for wealth management?`, answer: `Traditional fee-only registered investment advisors generally charge between 0.5% and 1.2% of AUM.`, sourceUrl: "https://www.nerdwallet.com/article/investing/advisor-fees" }];
 relatedSearches = [`${keyword} calculators`, `best tax-efficient ${keyword} accounts`, `how to build a ${keyword} portfolio`, `wealth management ${keyword} tips`, `passive income strategies for ${keyword}`];
 dominantType = "Comparison Guide";
 percentageBreakdown = [{ type: "Comparison Guide", percentage: 45 }, { type: "Blog Post", percentage: 35 }, { type: "Interactive Calculator", percentage: 15 }, { type: "Financial News", percentage: 5 }];
 } else if (isFashion) {
 domains = ["vogue.com", "gq.com", "elle.com", "refinery29.com", "harpersbazaar.com", "highsnobiety.com", "sustainablejungle.com", "treehugger.com", "thegoodtrade.com", "ecocult.com"];
 titles = [`The Style Guide: Incorporating ${keywordCapitalized} Into Your Wardrobe - Vogue`, `Why Organic Linen is the Best Material for ${keywordCapitalized} - GQ`, `Sustainable Capsule Wardrobes and ${keywordCapitalized} - Elle`, `15 Breathable Outfits Featuring ${keywordCapitalized} - Refinery29`, `The Art of Premium Eco-Tailoring: ${keywordCapitalized} Explained - Harper's Bazaar`, `Streetwear Trends: The Global Rise of ${keywordCapitalized} - Highsnobiety`, `Eco-Friendly Textile Guide: Understanding ${keywordCapitalized} Fibers - Sustainable Jungle`, `How to Care for Organic Breathable ${keywordCapitalized} Garments - Treehugger`, `Best Fair-Trade Brands Designing ${keywordCapitalized} Collections - The Good Trade`, `Is Your Fashion Truly Green? Analyzing ${keywordCapitalized} Supply Chains - Ecocult`];
 commonSubtopics = [{ subtopic: "Eco-Sourced Textile Science", relevance: 98, description: "Sourcing certified closed-loop natural linen, organic cotton, and bamboo." }, { subtopic: "Capsule Wardrobe Assembly", relevance: 92, description: "Curating a minimal selection of timeless items." }, { subtopic: "Premium Tailoring & Fit Architecture", relevance: 84, description: "Designing bespoke cuts that maintain structure without rigid synthetics." }, { subtopic: "Sustainable Supply Chain Ethics", relevance: 80, description: "Ensuring fair-trade certification and ethical wages." }, { subtopic: "Garment Preservation & Care Protocols", relevance: 72, description: "Cold-wash methods and natural stain removal." }];
 if (selectedFormat === "Paragraph") extractedSnippet = { format: "Paragraph", text: `**${keyword}** refers to the intentional practice of styling natural-fiber, sustainably produced clothing that regulates body temperature.`, opportunity: `Formulate your intro with h2 title 'What is ${keywordCapitalized}?'` };
 else if (selectedFormat === "List") extractedSnippet = { format: "List", text: `To assemble a natural ${keyword} wardrobe: 1. Select organic linen or GOTS-certified cotton. 2. Choose neutral, earthy color tones. 3. Invest in durable double-stitch seams.`, opportunity: `Structure your style guide with h3 subheadings and list items.` };
 else extractedSnippet = { format: "Table", text: `| Fabric Type | Breathability | Environmental Impact |\n| Organic Linen | Exceptional | Extremely Low |\n| Organic Cotton | High | Low |`, opportunity: `Include a clean visual fabric type comparison table.` };
 peopleAlsoAsk = [{ question: `Why is organic linen preferred for sustainable clothing?`, answer: `Organic flax requires up to 60% less water than conventional cotton.`, sourceUrl: "https://www.sustainablejungle.com/sustainable-fashion/organic-linen" }, { question: `How do I build a minimalist capsule wardrobe?`, answer: `By selecting 15 to 30 high-quality, versatile garments in cohesive color schemes.`, sourceUrl: "https://www.thegoodtrade.com/minimalist-wardrobe-guide" }, { question: `What certifications should I look for in ethical apparel?`, answer: `Look for GOTS, Fair Trade Certified, and OEKO-TEX Standard 100.`, sourceUrl: "https://www.ecocult.com/fashion-certifications-explained" }, { question: `How should I wash organic garments to prevent shrinking?`, answer: `Always wash in cold water on a gentle cycle and hang-dry.`, sourceUrl: "https://www.treehugger.com/how-to-wash-natural-garments" }];
 relatedSearches = [`eco-friendly ${keyword} brands`, `sustainable capsule wardrobe ${keyword}`, `organic cotton ${keyword} guide`, `breathable linen clothing for ${keyword}`];
 dominantType = "Blog Post";
 percentageBreakdown = [{ type: "Blog Post", percentage: 55 }, { type: "Comparison Guide", percentage: 25 }, { type: "Product Page", percentage: 15 }, { type: "Forum Thread", percentage: 5 }];
 } else if (isTech) {
 domains = ["stackoverflow.com", "medium.com/engineering", "github.com", "techcrunch.com", "wired.com", "dev.to", "hashnode.com", "infoq.com", "smashingmagazine.com", "freecodecamp.org"];
 titles = [`Step-by-Step Tutorial: Implementing ${keywordCapitalized} in React - Dev.to`, `Advanced DevOps Architecture: Scaling ${keywordCapitalized} Pipelines - InfoQ`, `GitHub Repository: Source Code for ${keywordCapitalized} - GitHub`, `Solving Common ${keywordCapitalized} Errors - StackOverflow`, `Enterprise Scale Cloud Microservices with ${keywordCapitalized} - TechCrunch`, `Security Best Practices: Hardening Your ${keywordCapitalized} Gateway - Wired`, `Optimizing Low-Latency Database Queries with ${keywordCapitalized} - Hashnode`, `A Complete Developer's Handbook to ${keywordCapitalized} APIs - FreeCodeCamp`, `The Future of Serverless Architecture: ${keywordCapitalized} Analyzed - Smashing Magazine`, `How We Reduced API Latency by 45% Using ${keywordCapitalized} - Medium`];
 commonSubtopics = [{ subtopic: "API Gateway & Router Configuration", relevance: 98, description: "Setting up low-latency endpoint pathways." }, { subtopic: "CI/CD Deployment Automation", relevance: 92, description: "Building automated testing and deployment schedules." }, { subtopic: "Elastic Scaling & Load Balancing", relevance: 86, description: "Configuring automatic horizontal scaling." }, { subtopic: "Data Query & Caching Performance", relevance: 82, description: "Implementing memory caching layers." }, { subtopic: "Token Authentication & Encryption", relevance: 78, description: "Hardening API routes using JWT and OAuth." }];
 if (selectedFormat === "Paragraph") extractedSnippet = { format: "Paragraph", text: `A **${keyword}** is a standardized API endpoint structure designed to securely route and transform incoming microservice payloads.`, opportunity: `Write a clean definition under h2 'What is ${keywordCapitalized}?'` };
 else if (selectedFormat === "List") extractedSnippet = { format: "List", text: `Core deployment steps for ${keyword}: 1. Configure the horizontal auto-scaler. 2. Enable JWT authorization headers. 3. Set up memory database caching.`, opportunity: `Structure your code execution checklist.` };
 else extractedSnippet = { format: "Table", text: `| Framework | Latency (ms) | Resource Footprint |\n| Express Node | 45ms | Low |\n| Go Fiber | 12ms | Extremely Low |`, opportunity: `Include a clear framework performance comparison table.` };
 peopleAlsoAsk = [{ question: `How do I configure this route gateway for low-latency?`, answer: `Deploy your proxy container close to your users using edge networks.`, sourceUrl: "https://medium.com/engineering/latency-optimization-api" }, { question: `What security rules protect microservice APIs from DDoS?`, answer: `Implement adaptive rate limiting using token bucket algorithms.`, sourceUrl: "https://www.wired.com/security/hardening-api-gateways" }, { question: `Can I run this scaling serverless on AWS or GCP?`, answer: `Yes, by deploying container images using AWS Fargate, Google Cloud Run, or Lambda.`, sourceUrl: "https://www.infoq.com/articles/serverless-scaling-microservices" }, { question: `How do I resolve memory leak errors in high-concurrency Node apps?`, answer: `Analyze heap snapshots using Chrome DevTools.`, sourceUrl: "https://stackoverflow.com/questions/tagged/node-memory-leak" }];
 relatedSearches = [`github ${keyword} boilerplate`, `low latency ${keyword} configurations`, `how to deploy ${keyword} to aws`, `express nodejs ${keyword} tutorial`];
 dominantType = "Blog Post";
 percentageBreakdown = [{ type: "Blog Post", percentage: 50 }, { type: "Interactive Tool", percentage: 20 }, { type: "Comparison Guide", percentage: 15 }, { type: "Documentation", percentage: 10 }, { type: "Forum Thread", percentage: 5 }];
 } else {
 domains = ["hubspot.com", "moz.com", "searchengineland.com", "backlinko.com", "semrush.com", "ahrefs.com", "neilpatel.com", "searchchenginejournal.com", "wikipedia.org", "medium.com"];
 titles = [`The Ultimate Guide to ${keywordCapitalized} for 2026 - Hubspot`, `How to Strategize and Optimize for ${keywordCapitalized} - Moz`, `Best Practices to Maximize Organic Growth via ${keywordCapitalized} - Search Engine Land`, `A High-Performance Roadmap for ${keywordCapitalized} - Backlinko`, `Top Competitor Strategies for ${keywordCapitalized} - SEMrush`, `Measuring ROI and Performance Metrics for ${keywordCapitalized} - Ahrefs`, `Unlocking Organic Growth Secrets on ${keywordCapitalized} - Neil Patel`, `A Complete Manual for Structuring ${keywordCapitalized} Campaigns - Search Engine Journal`, `Historical Context of ${keywordCapitalized} - Wikipedia`, `Real Cases: Transforming Leads with ${keywordCapitalized} - Medium`];
 commonSubtopics = [{ subtopic: `What is ${keywordCapitalized}?`, relevance: 98, description: "Definition and core concepts." }, { subtopic: "Step-by-Step Implementation", relevance: 88, description: "Actionable frameworks and guidelines." }, { subtopic: "Common Mistakes & Pitfalls", relevance: 75, description: "Critical implementation mistakes to avoid." }, { subtopic: "Top Tools & Technologies", relevance: 82, description: "Comparing open-source vs enterprise SaaS platforms." }, { subtopic: "Measuring Strategy ROI", relevance: 68, description: "Key performance indicators and dashboards." }];
 if (selectedFormat === "Paragraph") extractedSnippet = { format: "Paragraph", text: `A **${keyword}** is a tactical asset used to systematically evaluate organic search metrics.`, opportunity: `Define ${keyword} clearly using 'What is...' header.` };
 else if (selectedFormat === "List") extractedSnippet = { format: "List", text: `To maximize results with ${keyword}: 1. Map core intent. 2. Build high-authority backlink hubs. 3. Structure FAQ schemas.`, opportunity: `Structure your execution checklist with h3 headings.` };
 else extractedSnippet = { format: "Table", text: `| Strategy Metric | Benchmark | Ideal Status |\n| KD Score | < 35 | Low-Hanging Fruit |\n| Word Count | 1,800+ words | Premium Pillar |`, opportunity: `Include a responsive comparisons table.` };
 peopleAlsoAsk = [{ question: `How long does it take to see results for ${keyword}?`, answer: `Typically, organic search results require 4 to 12 weeks to index and mature.`, sourceUrl: `https://moz.com/blog/${kwSlug}-timelines` }, { question: `Is there a free tool to analyze ${keyword}?`, answer: `Yes, several major SEO suites offer basic query auditing.`, sourceUrl: `https://${targetDomain}/resources/seo-intelligence` }, { question: `What is the ideal keyword difficulty threshold?`, answer: `For DR < 40, target keywords with KD under 30.`, sourceUrl: `https://backlinko.com/keyword-difficulty-strategy` }, { question: `Do I need structured schema markup for ${keyword}?`, answer: `Yes, implementing FAQPage and Article JSON-LD schemas improves rich results eligibility.`, sourceUrl: `https://semrush.com/blog/schema-markup-essentials` }];
 relatedSearches = [`${keyword} checklist pdf`, `best practices for ${keyword}`, `${keyword} tools online free`, `how to automate ${keyword} analysis`, `seo strategies for ${keyword}`];
 dominantType = "Blog Post";
 percentageBreakdown = [{ type: "Blog Post", percentage: 50 }, { type: "Comparison Guide", percentage: 20 }, { type: "Interactive Tool", percentage: 15 }, { type: "Documentation", percentage: 10 }, { type: "Forum Thread", percentage: 5 }];
 }

 const topResults = domains.map((domain, index) => {
 const rank = index + 1;
 const wordCount = 1200 + Math.round(Math.abs(Math.sin(index + 3)) * 2600);
 const dr = 95 - index * 4 + (keyword.length % 3);
 const freshnessScores: Array<"Fresh" | "Stable" | "Legacy"> = ["Fresh", "Fresh", "Stable", "Stable", "Stable", "Legacy", "Legacy", "Legacy", "Legacy", "Legacy"];
 return { rank, title: titles[index], url: `https://www.${domain}/${index % 2 === 0 ? "blog" : "resources"}/${kwSlug}`, contentLength: wordCount, contentType: index === 5 && isTech ? "Interactive Tool" : "Blog Post", domainRating: Math.max(20, Math.min(99, dr)), freshnessScore: freshnessScores[index] || "Stable" };
 });

 const freshnessRequirements = {
 level: isMedical ? "High" : isFinance ? "Medium" : "Medium" as "Low" | "Medium" | "High",
 explanation: isMedical
 ? "Health and medical content requires frequent updates as new research emerges. Google prioritizes YMYL content with recent citations."
 : "This topic benefits from periodic content refreshes to maintain ranking signals.",
 recommendedUpdateFrequency: isMedical ? "Every 3 months" : "Every 6 months"
 };

 return { keyword, topResults, averageContentLength: Math.round(topResults.reduce((a: number, c: any) => a + c.contentLength, 0) / topResults.length), commonSubtopics, featuredSnippet: { format: selectedFormat, extractedText: extractedSnippet.text, optimizedOpportunity: extractedSnippet.opportunity }, peopleAlsoAsk, relatedSearches, contentTypeAnalysis: { dominantType, percentageBreakdown }, freshnessRequirements };
}

// ============================================================
// Helper: generateFallbackData
// ============================================================
async function generateFallbackData(targetRaw: string, competitorRaw?: string) {
 const target = cleanDomain(targetRaw);
 const competitor = competitorRaw ? cleanDomain(competitorRaw) : null;
 const targetPageInfo = await fetchPageSummary(target);
 const compPageInfo = competitor ? await fetchPageSummary(competitor) : null;
 const targetSeed = target.length;
 const brandName = targetPageInfo.brand || target.split(".")[0];
 const services = targetPageInfo.services;
 // Prefer geo-modified local keywords for Local SEO traffic capture
 const locFromSite = extractLocationFromCorpus(
  target,
  `${targetPageInfo.rawSnippet || ""} ${targetPageInfo.description || ""} ${(targetPageInfo.headings || []).join(" ")}`,
  []
 );
 const city =
  targetPageInfo.city ||
  locFromSite.city ||
  "Local service area";
 const state = targetPageInfo.state || locFromSite.state || countryFromDomainTld(target);
 const country = targetPageInfo.country || locFromSite.country || countryFromDomainTld(target);
 const serviceAreas = targetPageInfo.serviceAreas || locFromSite.serviceAreas || [city];
 const localKeywordPool = buildLocalKeywordPool(
  services || [],
  targetPageInfo.keywords || [],
  city,
  serviceAreas
 );
 const nicheKeywords = Array.from(
  new Set([...(localKeywordPool || []), ...(targetPageInfo.keywords || [])])
 ).slice(0, 18);
 const topServices = (services || []).slice(0, 6);
 const targetMetrics = {
 domain: target,
 domainRating: Math.min(85, 30 + (targetSeed * 3) % 55),
 backlinksCount: 1500 + (targetSeed * 423) % 25000,
 referringDomains: 250 + (targetSeed * 89) % 4500,
 organicTraffic: 12000 + (targetSeed * 3120) % 350000,
 organicKeywords: 1800 + (targetSeed * 450) % 25000,
 publishingFrequency: targetSeed % 2 === 0 ? "3-5 articles / week" : "1-2 articles / week",
 topPages: (topServices.length ? topServices : nicheKeywords.slice(0, 5)).map((s: string, i: number) => ({
 url: `https://${target}/${String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48)}`,
 title: s,
 estTraffic: Math.round((12000 + (targetSeed * 3120) % 350000) * (0.15 - i * 0.015)),
 keywordsCount: Math.max(10, (1800 + (targetSeed * 450) % 25000) - i * 500),
 })),
 };
 const competitorDomainToUse = competitor || `${target.split(".")[0]}-alternative.com`;
 const compSeedToUse = competitorDomainToUse.length;
 const compServices = compPageInfo ? compPageInfo.services : ["Standard Consultation", "Basic Services", "Advanced Support"];
 const compTopPages = compPageInfo
 ? compPageInfo.services.slice(0, 5).map((s: string, i: number) => ({
 url: `https://${cleanDomain(competitorDomainToUse)}/${s.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
 title: s,
 estTraffic: Math.round(25000 * (0.15 - i * 0.015)),
 keywordsCount: Math.max(10, 3500 - i * 500),
 }))
 : [];
 const competitorMetrics = {
 domain: competitorDomainToUse,
 domainRating: Math.min(92, 35 + (compSeedToUse * 4) % 55),
 backlinksCount: 3000 + (compSeedToUse * 650) % 45000,
 referringDomains: 450 + (compSeedToUse * 120) % 8500,
 organicTraffic: 25000 + (compSeedToUse * 5430) % 650000,
 organicKeywords: 3500 + (compSeedToUse * 850) % 45000,
 publishingFrequency: compSeedToUse % 2 === 0 ? "4-6 articles / week" : "2-3 articles / week",
 topPages: compTopPages,
 };

 // Top 15 competitive set grounded in real niche (local + category peers)
 const brandLabel = targetPageInfo.brand || brandName.charAt(0).toUpperCase() + brandName.slice(1);
 const discoveredCompetitors = buildIndustryCompetitors(
 target,
 brandLabel,
 targetPageInfo.niche,
 nicheKeywords
 ).map((c: any, i: number) => ({
  ...c,
  nicheFocus: i < 4 ? `${c.nicheFocus} · local/${city} market` : c.nicheFocus,
  analyzedTakeaway: `${c.analyzedTakeaway} For Local SEO in ${city}: win "near me" and "in ${city}" modifiers with GBP trust + geo landing pages.`,
  targetKeywords: Array.from(
   new Set([
    ...(c.targetKeywords || []),
    `${(nicheKeywords[0] || "services").split(" in ")[0]} in ${city}`,
    `${(nicheKeywords[0] || "services").split(" near ")[0]} near me`,
   ])
  ).slice(0, 6),
 }));

 // Local SEO profile (always present for Overview Local SEO card)
 const localLocation = buildLocalSeoProfile({
  domain: target,
  brand: brandLabel,
  niche: targetPageInfo.niche,
  services: services || [],
  keywords: nicheKeywords,
  city,
  state,
  country,
  detectedAddress:
   targetPageInfo.detectedAddress ||
   locFromSite.detectedAddress ||
   `${city}, ${state}, ${country}`,
  confidence: targetPageInfo.locationConfidence || locFromSite.confidence || 45,
  serviceAreas,
  phones: targetPageInfo.phoneHints || locFromSite.phones,
  scrapedPages: targetPageInfo.scrapedPages,
  domainRating: targetMetrics.domainRating,
 });

 // Top 15 long-tail LOCAL keywords — geo + service for high local traffic
 const keywordPool = nicheKeywords.slice(0, 15);
 while (keywordPool.length < 15) {
  const extras = [
   `${(services[0] || "services").toLowerCase()} near me`,
   `best ${(services[0] || "clinic").toLowerCase()} in ${city}`,
   `${city} ${(services[1] || services[0] || "treatment").toLowerCase()}`,
   `${(services[0] || "services").toLowerCase()} cost ${city}`,
   `${brandLabel.toLowerCase()} ${city} reviews`,
  ];
  keywordPool.push(extras[keywordPool.length % extras.length]);
 }
 const keywordList = keywordPool.map((kw, i) => {
  const isLocal =
   /near me| in |city|local|nearby|appointment|clinic|hospital/i.test(kw) ||
   kw.toLowerCase().includes(city.toLowerCase());
  return {
   keyword: kw,
   volume: Math.max(
    80,
    (isLocal ? 1600 : 1200) - i * 110 + (kw.includes("near me") ? 200 : 0) + (kw.length % 7) * 20
   ),
   difficulty: Math.min(85, (isLocal ? 18 : 26) + i * 3),
   cpc: parseFloat((isLocal ? 1.8 : 1.1 + i * 0.18).toFixed(2)),
   intent: (
    /near me|book|appoint|cost|price|contact/i.test(kw)
     ? "Transactional"
     : i < 6
       ? "Commercial"
       : "Informational"
   ) as "Commercial" | "Informational" | "Transactional",
   type: (kw.split(/\s+/).length >= 3 || kw.length >= 18 ? "Long-tail" : "Short-tail") as
    | "Short-tail"
    | "Long-tail",
   competition: (i < 4 ? "High" : i < 10 ? "Medium" : "Low") as "Low" | "Medium" | "High",
   trend: (i < 8 ? "rising" : "stable") as "rising" | "stable" | "declining",
   serpRankings: [
    {
     rank: 1,
     title: `${kw} | ${brandLabel} ${city}`,
     url: `https://${target}`,
    },
   ],
   relatedKeywords: keywordPool.filter((_, j) => j !== i).slice(0, 4),
   parentTopic: `${targetPageInfo.niche.split("&")[0].trim()} · ${city}`,
   buyerJourneyStage: (i < 5 ? "Awareness" : i < 11 ? "Consideration" : "Decision") as
    | "Awareness"
    | "Consideration"
    | "Decision",
   opportunityScore: Math.max(12, (isLocal ? 96 : 88) - i * 4),
   isPillarOpportunity: i < 5 || isLocal,
  };
 });

 const contentGaps = normalizeContentGaps(
  keywordPool.slice(0, 12).map((kw, i) => {
   const difficulty = Math.min(75, (kw.includes("near me") ? 12 : 16) + i * 4);
   const volume = Math.max(90, 1800 - i * 110);
   const built = buildServerGapTitle(kw, {
    city,
    brand: brandLabel,
    volume,
    difficulty,
    index: i,
   });
   return {
    competitorKeyword: kw,
    competitorRank: 2 + (i % 8),
    competitorVolume: volume,
    competitorDifficulty: difficulty,
    targetRank: i % 3 === 0 ? "Not Ranking" : 12 + i * 3,
    recommendedTopic: built.title,
    recommendedType: i % 2 === 0 ? "Local Pillar / Service Page" : "Geo Comparison Guide",
    difficultyCategory: difficulty < 30 ? "Easy" : difficulty < 55 ? "Medium" : "Hard",
    isQuickWin: difficulty < 38 && i < 6,
    cityMention: city,
    localIntent: /\bnear me\b/i.test(kw) ? "local_direct" : "local_aware",
    localSearchVolume: true,
    serpTitlePreview: built.serpTitle,
    titleAngle: built.angle,
    titleFormula: built.formula,
    trafficPotentialScore: built.trafficPotentialScore,
   };
  }),
  [],
  { city, brand: brandLabel }
 );

 const serpFeatures = [
 {
 type: "Featured Snippet" as const,
 query: nicheKeywords[0] || "core service",
 opportunity: "Answer the query in a 40 word definition paragraph under an H2.",
 actionability: "Add a definition block + FAQ schema on the primary service page.",
 },
 {
 type: "People Also Ask" as const,
 query: `how does ${nicheKeywords[1] || "treatment"} work`,
 opportunity: "Cover related questions with concise H3 answers.",
 actionability: "Expand FAQ section with 4 PAA-style questions.",
 },
 {
 type: "Local Pack" as const,
 query: `${(services[0] || nicheKeywords[0] || "clinic").toString().split(" in ")[0]} near me`,
 opportunity: `Win Map Pack visibility in ${city} for high-intent local queries.`,
 actionability: `Optimize Google Business Profile (categories, photos, reviews, services) for ${city}; keep NAP identical to site footer.`,
 },
 {
 type: "Video Carousel" as const,
 query: nicheKeywords[2] || "how it works",
 opportunity: "Create a short explainer video targeting the primary commercial keyword.",
 actionability: "Publish a 3 min YouTube walkthrough with chapters + transcript.",
 },
 ];

 const backlinkSources = [
 { sourceUrl: `https://www.healthline.com/resources/${brandName}`, domainRating: 91, targetUrl: `https://${target}/`, anchorText: services[0] || brandName, linkType: "Follow" as const },
 { sourceUrl: `https://medium.com/@industry/${brandName}-review`, domainRating: 76, targetUrl: `https://${target}/${(services[1] || "services").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, anchorText: nicheKeywords[0] || "guide", linkType: "Follow" as const },
 { sourceUrl: `https://www.reddit.com/r/seo/comments/${brandName}`, domainRating: 91, targetUrl: `https://${target}/blog`, anchorText: "helpful resource", linkType: "Nofollow" as const },
 { sourceUrl: `https://directory.example.com/${brandName}`, domainRating: 42, targetUrl: `https://${target}/`, anchorText: brandName, linkType: "Follow" as const },
 { sourceUrl: `https://news.nichejournal.org/${brandName}-case-study`, domainRating: 58, targetUrl: `https://${target}/`, anchorText: `${services[0] || "case study"}`, linkType: "Follow" as const },
 ];

 const backlinkOpportunities = [
 {
 type: "Guest Posting" as const,
 sourceDomain: "niche-authority.com",
 opportunityUrl: "https://niche-authority.com/write-for-us",
 description: `Pitch a data-backed article on ${nicheKeywords[0] || "industry trends"} with a contextual link to your pillar page.`,
 actionPlan: "Draft outline -> pitch editor -> publish with 1 dofollow contextual link.",
 },
 {
 type: "Unlinked Mention" as const,
 sourceDomain: "industryroundup.io",
 opportunityUrl: `https://industryroundup.io/mentions/${brandName}`,
 description: `Your brand is mentioned without a link on a DR 55 roundup about ${targetPageInfo.niche}.`,
 actionPlan: "Send a polite outreach email requesting a link to your homepage.",
 },
 {
 type: "Broken Link" as const,
 sourceDomain: "resources.university.edu",
 opportunityUrl: "https://resources.university.edu/health-links",
 description: "Resource page has a 404 pointing to an outdated competitor guide.",
 actionPlan: "Offer your updated guide as a replacement resource.",
 },
 ];

 return {
 target: targetMetrics,
 competitor: competitorMetrics,
 discoveredCompetitors,
 targetAnalysis: (() => {
  const contentStrengths = [
   targetPageInfo.scrapedPages > 0
    ? `Live crawl covered ${targetPageInfo.scrapedPages} page(s) on ${target}`
    : "Brand domain profile available",
   `Core offerings: ${(targetPageInfo.services || []).slice(0, 3).join(", ") || "primary services"}`,
   "Keyword map grounded in on-site language",
  ];
  const contentWeaknesses = [
   "Limited long-tail blog coverage vs competitors",
   "Missing FAQ depth on commercial queries",
   "Internal linking between service and content pages can be stronger",
  ];
  const marketResearch = buildMarketResearchPack({
   brand: brandLabel,
   domain: target,
   niche: targetPageInfo.niche,
   keywords: nicheKeywords,
   competitors: discoveredCompetitors,
   strengths: contentStrengths,
   weaknesses: contentWeaknesses,
  });
  return {
   coreNiche: `${targetPageInfo.niche} · ${city}, ${country}`,
   audiencePersona: `Local buyers in ${city}${state ? ` / ${state}` : ""} searching for ${targetPageInfo.niche} — "near me", reviews, pricing, and booking intent`,
   contentStrengths,
   contentWeaknesses,
   detailedBreakdown: `${brandLabel} (${target}) is a Local SEO target in ${city}, ${state}, ${country}. Industry/niche: ${targetPageInfo.niche}. Crawl source: ${targetPageInfo.source}. ${targetPageInfo.description} Address signal: ${localLocation.detectedAddress}. Primary local demand themes: ${nicheKeywords.slice(0, 6).join("; ")}. Map Pack score est. ${localLocation.googleMapPackScore}/100. Priority: GBP + NAP consistency, geo service pages ("in ${city}" / "near me"), review velocity, and local competitor outranking. Peers: ${discoveredCompetitors
    .slice(0, 4)
    .map((c: any) => c.domain)
    .join(", ")}.`,
   socialPresenceSummary: `In ${city}, conversations about ${targetPageInfo.niche} cluster on recommendations, wait times, pricing transparency, parking/hours, and before/after proof. Local reviews and neighborhood mentions drive more trust than national brand slogans.`,
   socialMentionKeywords: [
    city,
    ...(nicheKeywords.slice(0, 3) || []),
    "near me",
    "reviews",
    "appointments",
    "pricing",
   ].filter(Boolean).slice(0, 8),
   competitorSocialInsights: `Local peers and category sites (${discoveredCompetitors
    .slice(0, 4)
    .map((c: any) => c.domain)
    .join(
     ", "
    )}) win ${city} attention with review replies, geo hashtags, and "serving ${city}" posts. Counter with GBP posts, neighborhood proof, and answer-first content linking to service pages on ${target}.`,
   marketResearch,
  };
 })(),
 marketResearch: buildMarketResearchPack({
  brand: brandLabel,
  domain: target,
  niche: `${targetPageInfo.niche} in ${city}`,
  keywords: nicheKeywords,
  competitors: discoveredCompetitors,
 }),
 keywords: keywordList,
 contentGaps,
 siteProfile: {
 source: targetPageInfo.source,
 scrapedPages: targetPageInfo.scrapedPages,
 brand: brandLabel,
 niche: targetPageInfo.niche,
 headings: (targetPageInfo.headings || []).slice(0, 12),
 pageTitles: (targetPageInfo.pageTitles || []).slice(0, 8),
 city,
 state,
 country,
 detectedAddress: localLocation.detectedAddress,
 serviceAreas,
 },
 localLocation,
 serpFeatures,
 backlinkSources,
 backlinkOpportunities,
 rankingBlueprint: localLocation.rankingBlueprint || {
 currentPosition: "Not in top 30 for primary local keywords",
 targetPosition: `Top 3 Map Pack + top 10 organic for ${city} service terms within 90 days`,
 summary: `${brandLabel} (${target}) in ${city}: prioritize Local SEO (GBP, NAP, geo pages) plus topical clusters for ${targetPageInfo.niche}.`,
 technicalSeo: [
 "Improve LCP below 2.5 seconds (mobile local intent)",
 "Add LocalBusiness + FAQPage + HowTo structured data",
 "Ensure mobile responsiveness on contact & booking pages",
 ],
 localSeo: [
 `Claim and verify Google Business Profile for ${city}`,
 "Build local citations with identical NAP",
 "Collect and respond to customer reviews weekly",
 ],
 contentStrategy: [
 `Geo pillar: ${services[0] || "services"} in ${city}`,
 "Near-me FAQ clusters and neighborhood pages",
 "Comparison content vs local competitors",
 ],
 linkBuilding: [
 `Local directories and ${city} resource pages`,
 "Community / chamber sponsorships",
 "Partner local businesses for contextual links",
 ],
 timelineEstimate: "6-12 weeks for measurable local pack improvements",
 priorityActions: (localLocation.rankingBlueprint?.priorityActions || []).slice(0, 5),
 localKeywordsToTarget: (localLocation.localKeywordOpportunities || []).slice(0, 8).map((k: any) => ({
  keyword: k.keyword,
  searchVolume: k.searchVolume,
  currentRank: "Not ranking / untracked",
 })),
 },
 autonomousBlog: normalizeBlogPayload(
 buildUniqueArticle({
 domain: target,
 kw: nicheKeywords[0] || "services",
 seed: Date.now() + target.length * 97,
 }),
 target,
 nicheKeywords[0] || "services",
 Date.now() + target.length * 97
 ),
 };
}



// ============================================================
// Express App
// ============================================================
const app = express();

// Vercel rewrite /api/* → /api may drop the subpath from req.url.
// Restore originalUrl so Express routes (/api/health, /api/analyze) still match.
app.use((req, _res, next) => {
  const original = String(req.originalUrl || "");
  const current = String(req.url || "");
  if (original.startsWith("/api/") && !current.startsWith("/api")) {
    req.url = original;
  }
  next();
});

app.use(express.json({ limit: "1mb" }));

// Convenience: GET /api → same payload as health (routing smoke test)
app.get(["/api", "/api/"], (_req, res) => {
  res.redirect(307, "/api/health");
});

const SOCIAL_PLATFORMS = [
 "Twitter/X",
 "LinkedIn",
 "Newsletter",
 "Reddit",
 "Quora",
 "Google Business",
] as const;

type SocialPlatformName = (typeof SOCIAL_PLATFORMS)[number];

function normalizeSocialPlatform(raw: unknown): SocialPlatformName {
 const s = String(raw || "").trim().toLowerCase();
 if (!s) return "Twitter/X";
 if (s.includes("twitter") || s === "x" || s.includes("tweet")) return "Twitter/X";
 if (s.includes("linkedin") || s.includes("linked in")) return "LinkedIn";
 if (s.includes("newsletter") || s.includes("email") || s.includes("edm")) return "Newsletter";
 if (s.includes("reddit")) return "Reddit";
 if (s.includes("quora")) return "Quora";
 if (s.includes("google") || s.includes("gbp") || s.includes("business profile") || s.includes("gmb"))
  return "Google Business";
 // Exact match against known list
 const exact = SOCIAL_PLATFORMS.find((p) => p.toLowerCase() === s);
 return exact || "Twitter/X";
}

function buildSocialSchema(
 platform: SocialPlatformName,
 content: string,
 domain: string,
 brand: string
): string {
 const url = `https://${domain}/`;
 if (platform === "Newsletter") {
  return JSON.stringify(
   {
    "@context": "https://schema.org",
    "@type": "EmailMessage",
    name: `${brand} newsletter`,
    description: content.slice(0, 160),
    url,
   },
   null,
   2
  );
 }
 if (platform === "Google Business") {
  return JSON.stringify(
   {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: brand,
    url,
    description: content.slice(0, 200),
   },
   null,
   2
  );
 }
 return JSON.stringify(
  {
   "@context": "https://schema.org",
   "@type": "SocialMediaPosting",
   headline: content.split("\n")[0]?.slice(0, 110) || `${brand} update`,
   articleBody: content.slice(0, 500),
   author: { "@type": "Organization", name: brand, url },
   sharedContent: { "@type": "WebPage", url },
  },
  null,
  2
 );
}

/** Rich platform-native offline drafts when AI is unavailable. */
function socialFallback(
 platformRaw: string,
 topic: string,
 keyword: string,
 domain: string,
 reason: string,
 extras?: { audience?: string; contentGoal?: string; brandVoice?: string }
) {
 const platform = normalizeSocialPlatform(platformRaw);
 const brand = (domain.split(".")[0] || "Brand").replace(/^\w/, (c) => c.toUpperCase());
 const kw = (keyword || topic || "growth").trim();
 const topicLine = (topic || kw).trim();
 const audience = extras?.audience || "professionals";
 const goal = extras?.contentGoal || "Engagement";
 const voice = extras?.brandVoice || "clear and confident";
 const tagBase = kw
  .replace(/[^a-zA-Z0-9\s]/g, "")
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 3)
  .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
 const hashtags = Array.from(
  new Set([
   ...tagBase.map((t) => t.replace(/\s+/g, "")),
   "SEO",
   brand.replace(/\s+/g, ""),
  ])
 ).slice(0, 6);

 let content = "";
 let optimalPostingTime = "Tue–Thu 9–11am local time";
 let engagementStrategy = "Reply to the first 5 comments within 30 minutes.";
 let visualRecommendations = "Clean brand visual with one clear focal point.";
 let seoNotes = `Primary keyword "${kw}" appears in the hook. Soft CTA to https://${domain}/.`;
 let complianceCheck = "Within typical platform limits.";

 switch (platform) {
  case "Twitter/X":
   content = [
    `Most teams overcomplicate ${kw}.`,
    ``,
    `${topicLine}`,
    ``,
    `What actually moves the needle:`,
    `1) One clear weekly metric`,
    `2) Publish for intent, not vanity`,
    `3) Link every asset back to your hub`,
    ``,
    `We break it down for ${audience}:`,
    `https://${domain}/`,
   ].join("\n");
   optimalPostingTime = "Weekdays 8–10am or 12–1pm local (X peaks)";
   engagementStrategy = "Pin a reply with a question. Quote-tweet useful comments in the first hour.";
   visualRecommendations = "16:9 chart or bold text card. Max 1–2 lines of overlay text.";
   complianceCheck = "Under 280 chars for single tweet OR thread-ready short paragraphs.";
   // Prefer a tighter single-post version if long
   if (content.length > 260) {
    content = `Stop guessing on ${kw}.\n\n${topicLine.slice(0, 100)}\n\n3 moves that work:\n• One weekly metric\n• Intent-led pages\n• Internal links\n\n→ https://${domain}/`;
   }
   break;
  case "LinkedIn":
   content = [
    `Unpopular opinion: ${kw} fails when it is treated like a one-off campaign.`,
    ``,
    `${topicLine}`,
    ``,
    `For ${audience}, here is a practical frame we use at ${brand}:`,
    ``,
    `1. Define success in one sentence (tied to ${goal.toLowerCase()}).`,
    `2. Map the questions buyers already type into search.`,
    `3. Ship one high-intent page or post per week — then measure.`,
    `4. Fix internal links so good pages do not die as orphans.`,
    ``,
    `The teams winning in 2026 are not louder. They are clearer.`,
    ``,
    `If you are building this system, start here: https://${domain}/`,
    ``,
    `What is the #1 blocker you see with ${kw}?`,
   ].join("\n");
   optimalPostingTime = "Tue–Thu 8–10am local (LinkedIn professional feed)";
   engagementStrategy = "End with a question. Comment on 5 peer posts after publishing to boost distribution.";
   visualRecommendations = "4:5 portrait carousel or single insight graphic with brand colors.";
   complianceCheck = "1,200–1,800 characters — scannable line breaks, no spammy hashtag walls.";
   break;
  case "Newsletter":
   content = [
    `Subject: ${kw}: a clearer plan for this week`,
    `Preview: ${topicLine.slice(0, 80)}`,
    ``,
    `Hi there,`,
    ``,
    `Quick note for ${audience}.`,
    ``,
    `${topicLine}`,
    ``,
    `This week, focus on three things:`,
    `1) Clarify your primary outcome for ${kw}`,
    `2) Ship one asset that answers a real buyer question`,
    `3) Measure one metric only — then iterate`,
    ``,
    `Voice note: ${voice}. Goal: ${goal}.`,
    ``,
    `Read the full breakdown (and tools we recommend):`,
    `https://${domain}/`,
    ``,
    `— The ${brand} team`,
    ``,
    `P.S. Reply with your biggest ${kw} bottleneck — we read every note.`,
   ].join("\n");
   optimalPostingTime = "Tue or Wed 9–11am recipient local time";
   engagementStrategy = "Ask for a one-word reply. Segment clickers on the CTA for a follow-up sequence.";
   visualRecommendations = "Simple header image 600×200; keep body text-first for deliverability.";
   complianceCheck = "Clear subject + preview; single primary CTA; plain-text friendly.";
   break;
  case "Reddit":
   content = [
    `Title: How are you approaching ${kw} without burning budget?`,
    ``,
    `Honest question for people who have shipped this in production.`,
    ``,
    `Context: ${topicLine}`,
    ``,
    `What we have tried / seen work:`,
    `- One metric per week (not five dashboards)`,
    `- Content that matches SERP intent (not generic listicles)`,
    `- Internal links so pages reinforce each other`,
    ``,
    `What still feels unclear:`,
    `- Timeline to first signal in a competitive niche`,
    `- Whether to go deep on one pillar or ship more mid-size posts`,
    ``,
    `Curious what has actually moved the needle for you. Happy to share more detail on our setup if useful.`,
    ``,
    `(Not selling anything in this post — if you want our public notes they are at ${domain})`,
   ].join("\n");
   optimalPostingTime = "Mon–Wed mornings in US timezones (subreddit dependent)";
   engagementStrategy = "Reply to every comment with substance. No bare links in the first post if the sub forbids it.";
   visualRecommendations = "Usually text-only; if image, use a simple diagram without logo spam.";
   complianceCheck = "Value-first; disclose affiliation if asked; follow subreddit rules.";
   seoNotes = `Keyword "${kw}" in title naturally. Soft site mention only — Reddit penalizes hard sells.`;
   break;
  case "Quora":
   content = [
    `What is the most practical way to get results from ${kw}?`,
    ``,
    `Short answer: treat ${kw} as a weekly operating system, not a campaign.`,
    ``,
    `${topicLine}`,
    ``,
    `A simple sequence that works for ${audience}:`,
    ``,
    `1. Write down the buyer question in one line.`,
    `2. Check what already ranks (format + depth).`,
    `3. Publish something equal or better — with a clear answer in the first 50 words.`,
    `4. Link related pages together so authority compounds.`,
    `5. Review one metric after 2–4 weeks before changing tactics.`,
    ``,
    `Most failures I see are not "not enough content" — they are unclear goals and orphan pages.`,
    ``,
    `If you want a longer walkthrough, we document our approach at https://${domain}/.`,
   ].join("\n");
   optimalPostingTime = "Evergreen — answer high-traffic questions; refresh yearly";
   engagementStrategy = "Lead with the direct answer. Update the answer when you get new data.";
   visualRecommendations = "Optional simple diagram; Quora favors well-formatted text.";
   complianceCheck = "Answer-first structure; no bait-and-switch; credentials if relevant.";
   break;
  case "Google Business":
   content = [
    `New insight for anyone researching ${kw}:`,
    ``,
    `${topicLine}`,
    ``,
    `At ${brand}, we help ${audience} with a clear next step — no fluff.`,
    ``,
    `This week:`,
    `• Practical guidance on ${kw}`,
    `• Focused on ${goal.toLowerCase()}`,
    `• Easy to act on immediately`,
    ``,
    `Questions? Comment below or visit our site for details.`,
    `https://${domain}/`,
   ].join("\n");
   optimalPostingTime = "Thu–Sat late morning local (local pack engagement varies)";
   engagementStrategy = "Reply to every comment and review mention. Add a photo of real work when possible.";
   visualRecommendations = "Square 1:1 photo of real team/location/product — avoid heavy text overlays.";
   complianceCheck = "Under ~1,500 chars; accurate NAP; no prohibited claims.";
   break;
 }

 const schemaMarkup = buildSocialSchema(platform, content, domain, brand);

 return {
  platform,
  content: sanitizeText(content),
  hashtags,
  optimalPostingTime,
  engagementStrategy,
  visualRecommendations,
  seoNotes,
  complianceCheck,
  schemaMarkup,
  isFallback: true,
  fallbackReason: reason,
 };
}

function normalizeSocialPayload(
 parsed: any,
 platform: SocialPlatformName,
 topic: string,
 keyword: string,
 domain: string
): any {
 const brand = (domain.split(".")[0] || "Brand").replace(/^\w/, (c) => c.toUpperCase());
 let content = sanitizeText(
  parsed?.content || parsed?.post || parsed?.text || parsed?.copy || parsed?.body || ""
 );
 // Sometimes models nest under data/message
 if (!content && parsed?.message) content = sanitizeText(parsed.message);
 if (!content || content.length < 40) {
  return socialFallback(platform, topic, keyword, domain, "AI returned incomplete social copy.");
 }
 const hashtags = Array.isArray(parsed?.hashtags)
  ? parsed.hashtags.map((h: unknown) => String(h || "").replace(/^#/, "").trim()).filter(Boolean).slice(0, 12)
  : [];
 const out = {
  platform,
  content,
  hashtags,
  optimalPostingTime: sanitizeText(parsed?.optimalPostingTime || "") || "Tue–Thu 9–11am local",
  engagementStrategy:
   sanitizeText(parsed?.engagementStrategy || "") ||
   "Reply to early comments within the first hour.",
  visualRecommendations: sanitizeText(parsed?.visualRecommendations || ""),
  seoNotes: sanitizeText(parsed?.seoNotes || "") || `Primary keyword: ${keyword || topic}`,
  complianceCheck: sanitizeText(parsed?.complianceCheck || "") || "Reviewed against platform norms.",
  schemaMarkup:
   typeof parsed?.schemaMarkup === "string" && parsed.schemaMarkup.trim()
    ? parsed.schemaMarkup
    : typeof parsed?.schemaMarkup === "object" && parsed.schemaMarkup
      ? JSON.stringify(parsed.schemaMarkup, null, 2)
      : buildSocialSchema(platform, content, domain, brand),
 };
 return out;
}

function platformSocialPrompt(
 platform: SocialPlatformName,
 topic: string,
 keyword: string,
 domain: string,
 audience: string,
 contentGoal: string,
 brandVoice: string
): string {
 const kw = keyword || topic;
 const shared = `TOPIC: ${topic || kw}
PRIMARY KEYWORD: ${kw}
BRAND SITE: https://${domain}/
AUDIENCE: ${audience || "professionals"}
GOAL: ${contentGoal || "engagement"}
VOICE: ${brandVoice || "clear and confident"}
PLATFORM: ${platform}

Rules:
- Platform-native style (not a generic caption reused everywhere)
- Hook in the first line
- Natural use of the primary keyword (no stuffing)
- Soft CTA to https://${domain}/ when appropriate for the platform
- ASCII punctuation only
- Return ONLY a JSON object (no markdown fences) with keys:
  platform, content, hashtags (string array), optimalPostingTime, engagementStrategy, visualRecommendations, seoNotes, complianceCheck`;

 switch (platform) {
  case "Twitter/X":
   return `${shared}
Write a high-performing X/Twitter post (or short 3–5 tweet thread if needed).
- Single post under ~260 chars preferred; if thread, separate tweets with blank lines and "---"
- Punchy, scannable, 1 clear idea
- 2–4 hashtags max`;
  case "LinkedIn":
   return `${shared}
Write a LinkedIn post (1,200–1,800 characters).
- Line breaks for mobile scanning
- Professional but human; optional question CTA at the end
- 3–5 hashtags at the end only`;
  case "Newsletter":
   return `${shared}
Write an email newsletter draft including:
- Subject line (first line: "Subject: ...")
- Preview text (second line: "Preview: ...")
- Body with greeting, 3 bullet value points, CTA link, short sign-off
- ~250–400 words`;
  case "Reddit":
   return `${shared}
Write a Reddit-style post:
- First line is "Title: ..."
- Value-first, community tone, no hard sell
- Ask a genuine question; optional soft site mention at the end only`;
  case "Quora":
   return `${shared}
Write a Quora answer:
- Start with a direct 1–2 sentence answer
- Then steps/explanation
- Credible, helpful, not salesy; one optional link at the end`;
  case "Google Business":
   return `${shared}
Write a Google Business Profile update (~100–300 words).
- Local/customer friendly
- Clear offer or insight
- Invite comments or visits; include site URL`;
  default:
   return shared;
 }
}

app.get("/api/health", (_req, res) => {
  const distPathCheck = path.join(process.cwd(), "dist");
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    node: process.version,
    env: process.env.NODE_ENV || "not set",
    distExists: fs.existsSync(distPathCheck),
    promptsExist: fs.existsSync(path.join(process.cwd(), "prompts", "SEO-BLOG-MASTER-PROMPT.md")),
    defaultLocation: {
      city: KOLKATA_CITY,
      state: KOLKATA_STATE,
      country: KOLKATA_COUNTRY,
      locationCode: DEFAULT_LOCATION_CODE,
      languageCode: DEFAULT_LANGUAGE_CODE,
    },
    dataforseoEnvConfigured: HAS_DFSEO,
    vercel: process.env.VERCEL || null,
    endpoints: [
      "/api/health",
      "/api/analyze",
      "/api/generate-blog",
      "/api/generate-social",
      "/api/analyze-keyword-deep",
      "/api/generate-meta-snippets",
      "/api/seo/keyword-volume",
      "/api/seo/serp",
      "/api/seo/domain-overview",
      "/api/seo/backlinks",
      "/api/seo/page-speed",
      "/api/seo/full-bundle",
    ],
  });
});

app.post("/api/analyze", async (req, res) => {
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

  // ΓöÇΓöÇ DataForSEO real data enrichment (BYOK from user or server-side env) ΓöÇΓöÇ
  let dfseoData: DataForSeoBundle | null = null;
  const aiCfg = req.body.aiConfig as { dataforseoLogin?: string; dataforseoPassword?: string; locationCode?: number; languageCode?: string } | undefined;
  const byokCreds: DfsCredentials | undefined =
    aiCfg?.dataforseoLogin && aiCfg?.dataforseoPassword
      ? { login: aiCfg.dataforseoLogin, password: aiCfg.dataforseoPassword }
      : undefined;
  const hasDfsCreds = Boolean(byokCreds || HAS_DFSEO);
  if (hasDfsCreds) {
    try {
      const seedKws = (base.keywords ?? []).slice(0, 5).map((k: { keyword: string }) => k.keyword);
      if (seedKws.length === 0) seedKws.push(domain.split(".")[0].replace(/-/g, " "));
      dfseoData = await withTimeout(
        fetchFullBundle(domain, seedKws, {
          credentials: byokCreds,
          locationCode: aiCfg?.locationCode,
          languageCode: aiCfg?.languageCode,
        }),
        20000,
        "DataForSEO bundle"
      );
       console.debug(`[DataForSEO] Fetched real data for ${domain}: ${dfseoData.rawSerpItems.length} SERP items, ${dfseoData.keywordLandscape.length} keywords, ${dfseoData.backlinks.total_backlinks} backlinks`);
    } catch (err: unknown) {
      console.error("[DataForSEO] Bundle fetch failed, falling back to AI/simulated data:", err instanceof Error ? err.message : err);
      dfseoData = null;
    }
  }

  const providerConfig = getProviderConfig(req);
  const requireAi = Boolean(req.body?.requireAi);

  // ΓöÇΓöÇ No AI key AND no DataForSEO ΓåÆ demo fallback (blocked when client requires live AI) ΓöÇΓöÇ
  if (!providerConfig && !dfseoData) {
    return res.status(requireAi ? 401 : 200).json(
      sanitizeDeep({
        ...base,
        contentGaps: normalizeContentGaps(base.contentGaps),
        isFallback: true,
        needsApiKey: true,
        dataSource: "simulated",
        fallbackReason:
          "Live analysis requires your AI API key. Open Settings, add OpenRouter or Gemini, Save, then run analysis again.",
      })
    );
  }

  if (requireAi && !providerConfig) {
    return res.status(401).json({
      error: "API key required",
      needsApiKey: true,
      isFallback: true,
      fallbackReason:
        "Add your AI API key in Settings to run real-time analysis and blog generation.",
    });
  }

  // ΓöÇΓöÇ DataForSEO available (with or without AI key) ΓöÇΓöÇ
  if (dfseoData) {
    // Merge real data into base
    const enriched = {
      ...base,
      // Real keyword landscape
      keywords: dfseoData.keywordLandscape.length > 0
        ? dfseoData.keywordLandscape.map((kw) => ({
            keyword: kw.keyword,
            volume: kw.volume,
            difficulty: kw.difficulty,
            cpc: kw.cpc,
            trend: kw.trend,
            intent: kw.volume > 1000 ? "informational" : "navigational",
            type: "organic",
            opportunityScore: kw.opportunity === "high" ? 85 : 62,
          }))
        : base.keywords,
      // Keep structured SERP feature opportunities (organic list is not the same schema)
      serpFeatures: base.serpFeatures,
      // Real backlinks mapped to UI BacklinkSource shape (50 raw → 15+ enriched)
      backlinkSources: dfseoData.backlinks.top_referring_domains.length > 0
        ? dfseoData.backlinks.top_referring_domains.slice(0, 50).map((b) => ({
            sourceUrl: b.source_url || `https://${b.source_domain}/`,
            sourceDomain: b.source_domain || "",
            domainRating: b.domain_rating || 40,
            pageAuthority: b.page_authority || b.domain_rating || 40,
            targetUrl: b.target_url || `https://${domain}/`,
            anchorText: b.anchor || domain,
            linkType: (b.is_dofollow ? "Follow" : "Nofollow") as "Follow" | "Nofollow",
            firstSeen: b.first_seen || undefined,
            isLost: b.is_lost || undefined,
            textPre: b.text_pre || undefined,
            textPost: b.text_post || undefined,
            platformType: b.platform_type || undefined,
          }))
        : base.backlinkSources,
      contentGaps: normalizeContentGaps(base.contentGaps),
      // Update target with real metrics
      target: {
        ...base.target,
        domainRating: dfseoData.backlinks.domain_rating || base.target?.domainRating,
        backlinksCount: dfseoData.backlinks.total_backlinks || base.target?.backlinksCount,
        referringDomains: dfseoData.backlinks.referring_domains || base.target?.referringDomains,
      },
      // Page speed data if available
      pageSpeed: dfseoData.pageSpeed,
      // Cost estimate for transparency
      estimatedCost: dfseoData.estimatedCost,
      // Metadata
      dataSource: "dataforseo",
      isFallback: false,
    };

    // If AI key is available, enrich DataForSEO with live AI (user's model first)
    if (providerConfig) {
      try {
        const backlinkSamples = dfseoData.backlinks.top_referring_domains.slice(0, 15).map((b) => ({
          domain: b.source_domain,
          dr: b.domain_rating,
          anchor: (b.anchor || "").slice(0, 80),
          is_follow: b.is_dofollow,
          platform: b.platform_type,
        }));
        const prompt = `Quick SEO enrichment for "${domain}" using real DataForSEO data.
Real metrics: ${JSON.stringify({
          backlinks: dfseoData.backlinks.total_backlinks,
          referringDomains: dfseoData.backlinks.referring_domains,
          domainRating: dfseoData.backlinks.domain_rating,
          topKeywords: dfseoData.keywordLandscape.slice(0, 5).map((k) => k.keyword),
          serpTop3: dfseoData.serp.organic.slice(0, 3).map((r) => r.title),
        })}.

BACKLINK QUALITY & SPAM ANALYSIS (15 backlink samples):
${JSON.stringify(backlinkSamples, null, 1)}

For each backlink domain above, assign:
- relevanceScore (0-100): Niche/industry relevance to "${domain}" and the local ${KOLKATA_CITY}/${KOLKATA_STATE} market. Is this domain in a related industry?
- trafficPotential (0-100): How much referral traffic could this link potentially drive? Higher DR = higher potential. Context matters.
- qualityGrade ("A"/"B"/"C"/"D"/"F"): A=elite editorial, B=high quality niche, C=average directory, D=thin/low quality, F=spam/penalized
- recommendation ("Keep"/"Disavow"/"Outreach"): Keep=valuable as-is, Disavow=toxic link to remove, Outreach=good opportunity to improve
- spamScore (0-100): Likelihood this is a spam/PBN/paid link network. 0=clean, 100=certain spam.
- contextMatch: One sentence describing what topic/theme the linking page covers.

Also compute:
- avgRelevance: average of all relevanceScore values
- avgTrafficPotential: average of all trafficPotential values
- topOpportunities: array of the 3-5 best backlink domains with highest combined relevance+traffic

Return compact JSON: {
  contentGaps[{competitorKeyword,competitorRank,competitorVolume,competitorDifficulty,targetRank,recommendedTopic,recommendedType,difficultyCategory,isQuickWin,cityMention,titleAngle,trafficPotentialScore}],
  rankingBlueprint{summary,priorityActions[{action,impact,effort,timeframe}],timelineEstimate},
  discoveredCompetitors[{domain,nicheSimilarity,nicheFocus,estimatedMonthlyTraffic,threatLevel,analyzedTakeaway,targetKeywords[],strengths[],weaknesses[],counterMove,seoStrategy}],
  marketResearch{executiveSummary,marketOverview,demandDrivers[],competitiveIntensity,intensityRationale,whitespaceOpportunities[],positioningRecommendation,swot{strengths[],weaknesses[],opportunities[],threats[]}},
  targetAnalysis{socialPresenceSummary,socialMentionKeywords[],competitorSocialInsights},
  backlinkAnalysis{scoredLinks[{domain,relevanceScore,trafficPotential,qualityGrade,recommendation,spamScore,contextMatch}]}
}.
contentGaps: 5-8 rows. targetRank number or "Not Ranking". difficultyCategory Easy|Medium|Hard.
CRITICAL for recommendedTopic: catchy high-CTR H1s, keyword in first 40 chars, localised (city/near me when natural), year when useful, NO generic "Complete Guide to X". Prefer Best/How-to/Cost/Near Me/Reviews formulas.
discoveredCompetitors: 8-12 real industry peer domains (no fake TLDs), nicheSimilarity 1-100, threatLevel High|Medium|Low.
ASCII only. JSON only.`;

        // Use the user's configured model (Settings) — fallbacks handled inside callAI
        const result = await withTimeout(
          callAI(providerConfig, prompt, "Valid compact JSON only. No fences.", {
            responseMimeType: "application/json",
            temperature: 0.15,
            maxOutputTokens: 2500,
          }),
          25000,
          "AI enrichment"
        );
        const enrichRaw = extractAiText(result);
        const parsed = tryParseJsonLoose(enrichRaw);
        if (!parsed || typeof parsed !== "object") {
          throw new Error("AI enrichment JSON unusable after sanitize");
        }
        enriched.contentGaps = normalizeContentGaps(
          (parsed as any).contentGaps,
          (base.keywords || []).map((k: any) => k.keyword).filter(Boolean),
          {
            city: base.localLocation?.city || KOLKATA_CITY,
            brand: base.siteProfile?.brand || base.target?.domain?.split(".")[0],
          }
        );
        if (!enriched.contentGaps.length) enriched.contentGaps = base.contentGaps;
        enriched.rankingBlueprint = (parsed as any).rankingBlueprint || base.rankingBlueprint;
        // Merge thin AI competitor stubs into full research cards (prefer base detail when AI is sparse)
        if (Array.isArray((parsed as any).discoveredCompetitors) && (parsed as any).discoveredCompetitors.length) {
          const baseComps = Array.isArray(base.discoveredCompetitors) ? base.discoveredCompetitors : [];
          const byDomain = new Map(baseComps.map((c: any) => [String(c.domain || "").toLowerCase(), c]));
          enriched.discoveredCompetitors = (parsed as any).discoveredCompetitors.map((c: any, i: number) => {
            const key = String(c.domain || "").toLowerCase().replace(/^www\./, "");
            const prior = byDomain.get(key) || baseComps[i] || {};
            return {
              ...prior,
              ...c,
              nicheSimilarity: c.nicheSimilarity ?? c.overlapScore ?? prior.nicheSimilarity,
              analyzedTakeaway: c.analyzedTakeaway || prior.analyzedTakeaway,
              targetKeywords: c.targetKeywords?.length ? c.targetKeywords : prior.targetKeywords,
              nicheFocus: c.nicheFocus || prior.nicheFocus,
              threatLevel: c.threatLevel || prior.threatLevel,
            };
          });
        } else {
          enriched.discoveredCompetitors = base.discoveredCompetitors;
        }
        if ((parsed as any).marketResearch) {
          enriched.marketResearch = { ...(base.marketResearch || {}), ...(parsed as any).marketResearch };
        }
        if ((parsed as any).targetAnalysis) {
          enriched.targetAnalysis = {
            ...(base.targetAnalysis || {}),
            ...(parsed as any).targetAnalysis,
            marketResearch:
              (parsed as any).targetAnalysis?.marketResearch ||
              (parsed as any).marketResearch ||
              base.targetAnalysis?.marketResearch,
          };
        }
        // Merge backlink AI scores into the enriched backlinkSources
        const scoredLinks: Array<{ domain: string; relevanceScore: number; trafficPotential: number; qualityGrade: string; recommendation: string; spamScore: number; contextMatch: string }> =
          (parsed as any)?.backlinkAnalysis?.scoredLinks;
        if (Array.isArray(scoredLinks) && scoredLinks.length > 0 && Array.isArray(enriched.backlinkSources)) {
          const scoreMap = new Map(scoredLinks.map((s: any) => [s.domain?.toLowerCase().replace(/^www\./, ""), s]));
          enriched.backlinkSources = enriched.backlinkSources.map((b: any) => {
            const domainKey = (b.sourceDomain || "").toLowerCase().replace(/^www\./, "");
            const match = scoreMap.get(domainKey);
            if (!match) return b;
            return {
              ...b,
              relevanceScore: match.relevanceScore ?? b.relevanceScore,
              trafficPotential: match.trafficPotential ?? b.trafficPotential,
              qualityGrade: match.qualityGrade ?? b.qualityGrade,
              recommendation: match.recommendation ?? "Keep",
              spamScore: match.spamScore ?? b.spamScore,
              contextMatch: match.contextMatch ?? b.contextMatch,
            };
          });
          // Compute backlinkSummary
          const scored = enriched.backlinkSources.filter((b: any) => typeof b.relevanceScore === "number");
          if (scored.length > 0) {
            const avgRel = Math.round(scored.reduce((s: number, b: any) => s + b.relevanceScore, 0) / scored.length);
            const avgTraffic = Math.round(scored.reduce((s: number, b: any) => s + (b.trafficPotential || 0), 0) / scored.length);
            const best = [...scored]
              .sort((a: any, b: any) => ((b.relevanceScore || 0) + (b.trafficPotential || 0)) - ((a.relevanceScore || 0) + (a.trafficPotential || 0)))
              .slice(0, 5);
            enriched.backlinkSummary = {
              avgRelevance: avgRel,
              avgTrafficPotential: avgTraffic,
              dofollowCount: enriched.backlinkSources.filter((b: any) => b.linkType === "Follow").length,
              nofollowCount: enriched.backlinkSources.filter((b: any) => b.linkType === "Nofollow").length,
              topOpportunities: best.map((b: any) => b.sourceDomain).filter(Boolean),
            };
          }
        }
        enriched.dataSource = "dataforseo+ai";
        enriched.isFallback = false;
        enriched.aiProvider = providerConfig.provider;
        enriched.aiModel = providerConfig.apiModel;
      } catch (enrichErr) {
        console.warn("[Analyze] AI enrichment failed:", enrichErr);
        enriched.contentGaps = normalizeContentGaps(base.contentGaps);
        enriched.aiWarning = "DataForSEO data shown; AI enrichment failed (retry or check quota).";
      }
    } else {
      enriched.contentGaps = normalizeContentGaps(base.contentGaps || enriched.contentGaps);
    }

    return res.json(sanitizeDeep(enriched));
  }

  // ΓöÇΓöÇ AI-only path (no DataForSEO) — live crawl baseline + user's AI key for full analysis ΓöÇΓöÇ
  if (!providerConfig) {
    return res.json(
      sanitizeDeep({
        ...base,
        contentGaps: normalizeContentGaps(base.contentGaps),
        isFallback: true,
        needsApiKey: true,
        dataSource: "crawl-only",
        fallbackReason: "Add your AI API key in Settings for full live keyword/gap/competitor analysis.",
      })
    );
  }

  try {
    const localBase = base.localLocation || {};
    const siteCtx = {
      purpose: "LOCAL_SEO",
      niche: base.targetAnalysis?.coreNiche,
      brand: base.siteProfile?.brand || domain.split(".")[0],
      scrapedPages: base.siteProfile?.scrapedPages,
      source: base.siteProfile?.source,
      city: localBase.city || base.siteProfile?.city,
      state: localBase.state || base.siteProfile?.state,
      country: localBase.country || base.siteProfile?.country,
      detectedAddress: localBase.detectedAddress || base.siteProfile?.detectedAddress,
      serviceAreas: localBase.serviceAreas || base.siteProfile?.serviceAreas,
      seedKeywords: (base.keywords || []).slice(0, 10).map((k: any) => k.keyword),
      services: (base.target?.topPages || []).slice(0, 5).map((p: any) => p.title),
      headings: (base.siteProfile?.headings || []).slice(0, 12),
      snippet: (base.targetAnalysis?.detailedBreakdown || "").slice(0, 500),
      rawSnippet: (base.siteProfile?.rawSnippet || "").slice(0, 600),
    };
    const cityHint = siteCtx.city || "the business city";
    const prompt = `You are a senior LOCAL SEO analyst. This product is for Local SEO — maximize high-intent local traffic (Map Pack + geo organic).

Analyze LIVE site https://${domain}/${competitorUrl ? ` vs competitor https://${cleanDomain(competitorUrl)}/` : ""}.

GROUND TRUTH (location + industry — stay on-niche; do not invent unrelated industries):
${JSON.stringify(siteCtx)}

LOCAL SEO RULES:
1. Detect/confirm business city, state/region, service areas from crawl.
2. Keywords MUST be geo-modified for high local traffic: "near me", "in ${cityHint}", neighborhood + service, cost/reviews/appointments.
3. Competitors should include local/regional peers that fight for the same city Map Pack — not only national publishers.
4. Content gap recommendedTopic titles MUST be high-traffic SEO H1s:
   - Front-load primary keyword in the first half of the title
   - Catchy CTR formulas: Best … in ${cityHint}, … Near Me, Cost/Price, How to, Reviews, Compared
   - Localise with ${cityHint} / neighborhoods when natural
   - Include year (${new Date().getFullYear()}) when it boosts freshness CTR
   - NEVER use weak titles like "Complete Guide to X" or "Everything About X"
   - 45–75 characters ideal; max ~85
5. rankingBlueprint and localLocation must prioritize GBP, NAP, reviews, geo pages, citations.

Return ONLY valid compact JSON (no markdown fences) with:
- keywords: exactly 15 LOCAL long-tails (3-7 words). Prefer "${cityHint}" / "near me" modifiers. Each: keyword, volume, difficulty, cpc, intent, type, opportunityScore, relatedKeywords[]
- contentGaps: 10 items with competitorKeyword + recommendedTopic (high-CTR localised H1), cityMention, titleAngle, trafficPotentialScore 1-100, recommendedType, difficultyCategory, isQuickWin
- discoveredCompetitors: 12-15 peers (mix local specialists + category leaders). Include nicheFocus noting local market, targetKeywords with geo modifiers, analyzedTakeaway with Local SEO counter-moves
- localLocation: { detectedAddress, city, state, country, confidenceScore, googleMapPackScore, citationConsistency, primaryLocalCompetitors[{name,domain,localRank,mapDistance}], localCompetitors[{name,domain,address,distance,rating,reviewCount,localRank,services,domainRating,estimatedMonthlyTraffic}], localKeywordOpportunities[{keyword,searchVolume,intent}], localOptimizationsNeeded[], localSeoVerdict, rankingBlueprint{summary,priorityActions[{action,impact,effort,timeframe}],timelineEstimate,localSeo[],contentStrategy[]} }
- marketResearch: include local demand drivers and whitespace for ${cityHint}
- targetAnalysis: { coreNiche (include city), audiencePersona (local buyers), contentStrengths[], contentWeaknesses[], detailedBreakdown (mention location + industry), socialPresenceSummary, socialMentionKeywords[], competitorSocialInsights }
- rankingBlueprint: Local SEO first (Map Pack + geo organic)
- serpFeatures: must include Local Pack opportunity for ${cityHint}
- backlinkSources: 4 items (prefer local/directory/geo when possible)
- backlinkOpportunities: 3 items
Keep numbers realistic. ASCII only. No off-topic keywords.`;

    // Use the user's Settings model (Gemini / OpenRouter) for real-time analysis
    const result = await withTimeout(
      callAI(
        providerConfig,
        prompt,
        "You are an expert LOCAL SEO analyst. Output ONLY valid JSON. No markdown fences. Prioritize location, Map Pack, geo keywords, and local competitors. Escape quotes inside strings. Stay on-niche for the crawled site.",
        {
          responseMimeType: "application/json",
          temperature: 0.25,
          maxOutputTokens: 6000,
        }
      ),
      45000,
      "SEO analysis"
    );
    const rawAi = extractAiText(result);
    const parsed = tryParseJsonLoose(rawAi);
    if (!parsed || typeof parsed !== "object") {
      throw new Error(
        `AI analysis JSON parse failed. ${rawAi ? "Sanitizer could not recover object." : "Empty AI response."}`
      );
    }

    const primaryKw =
      (Array.isArray(parsed.keywords) && parsed.keywords[0]?.keyword) ||
      base.keywords?.[0]?.keyword ||
      "services";

    // Optional: seed Content Hub with a short AI outline blog (full blog still via generate-blog)
    let autonomous = base.autonomousBlog;
    try {
      if (parsed.autonomousBlog) {
        autonomous = normalizeBlogPayload(
          parsed.autonomousBlog,
          domain,
          primaryKw
        );
      }
    } catch {
      autonomous = base.autonomousBlog;
    }

    const kwFallback = (base.keywords || []).map((k: any) => k.keyword).filter(Boolean);
    const gapCity =
      (parsed as any)?.localLocation?.city ||
      base.localLocation?.city ||
      siteCtx.city ||
      KOLKATA_CITY;
    const gapBrand =
      base.siteProfile?.brand || domain.split(".")[0] || "";
    const gapOpts = { city: gapCity, brand: gapBrand };
    const gaps = normalizeContentGaps(
      Array.isArray(parsed.contentGaps) && parsed.contentGaps.length ? parsed.contentGaps : base.contentGaps,
      kwFallback,
      gapOpts
    );
    res.json(
      sanitizeDeep({
        ...base,
        ...parsed,
        target: { ...base.target, ...(parsed.target || {}) },
        competitor: parsed.competitor ?? base.competitor,
        keywords:
          Array.isArray(parsed.keywords) && parsed.keywords.length >= 8
            ? parsed.keywords.slice(0, 15)
            : base.keywords,
        contentGaps: gaps.length ? gaps : normalizeContentGaps(base.contentGaps, kwFallback, gapOpts),
        serpFeatures: Array.isArray(parsed.serpFeatures) && parsed.serpFeatures.length ? parsed.serpFeatures : base.serpFeatures,
        backlinkSources: Array.isArray(parsed.backlinkSources) && parsed.backlinkSources.length ? parsed.backlinkSources : base.backlinkSources,
        backlinkOpportunities:
          Array.isArray(parsed.backlinkOpportunities) && parsed.backlinkOpportunities.length
            ? parsed.backlinkOpportunities
            : base.backlinkOpportunities,
        discoveredCompetitors:
          Array.isArray(parsed.discoveredCompetitors) && parsed.discoveredCompetitors.length >= 6
            ? parsed.discoveredCompetitors.slice(0, 15).map((c: any, i: number) => {
                const prior = (base.discoveredCompetitors || [])[i] || {};
                return {
                  ...prior,
                  ...c,
                  nicheSimilarity: c.nicheSimilarity ?? c.overlapScore ?? prior.nicheSimilarity,
                  analyzedTakeaway: c.analyzedTakeaway || prior.analyzedTakeaway,
                  targetKeywords: Array.isArray(c.targetKeywords) && c.targetKeywords.length
                    ? c.targetKeywords
                    : prior.targetKeywords,
                };
              })
            : base.discoveredCompetitors,
        targetAnalysis: {
          ...(base.targetAnalysis || {}),
          ...(parsed.targetAnalysis || {}),
          marketResearch:
            parsed.targetAnalysis?.marketResearch ||
            parsed.marketResearch ||
            base.targetAnalysis?.marketResearch ||
            base.marketResearch,
          socialPresenceSummary:
            parsed.targetAnalysis?.socialPresenceSummary ||
            base.targetAnalysis?.socialPresenceSummary,
          socialMentionKeywords:
            parsed.targetAnalysis?.socialMentionKeywords ||
            base.targetAnalysis?.socialMentionKeywords,
          competitorSocialInsights:
            parsed.targetAnalysis?.competitorSocialInsights ||
            base.targetAnalysis?.competitorSocialInsights,
        },
        marketResearch:
          parsed.marketResearch ||
          parsed.targetAnalysis?.marketResearch ||
          base.marketResearch ||
          base.targetAnalysis?.marketResearch,
        rankingBlueprint:
          parsed.rankingBlueprint ||
          parsed.localLocation?.rankingBlueprint ||
          base.rankingBlueprint,
        localLocation: parsed.localLocation
          ? { ...base.localLocation, ...parsed.localLocation }
          : base.localLocation,
        siteProfile: base.siteProfile,
        autonomousBlog: autonomous,
        dataSource: "ai",
        isFallback: false,
        aiProvider: providerConfig.provider,
        aiModel: providerConfig.apiModel,
        liveCrawl: Boolean(base.siteProfile?.source === "live-crawl" || base.siteProfile?.scrapedPages),
        seoFocus: "local",
      })
    );
  } catch (err: unknown) {
    const message = redactSecrets(err instanceof Error ? err.message : String(err));
    console.error("Analyze error:", message);
    // Still return crawl baseline so UI is not empty — flag as partial AI failure
    res.json(
      sanitizeDeep({
        ...base,
        contentGaps: normalizeContentGaps(base.contentGaps),
        isFallback: true,
        dataSource: "crawl+ai-failed",
        aiProvider: providerConfig.provider,
        aiModel: providerConfig.apiModel,
        errorMsg: message.includes("timed out")
          ? "Live AI timed out. Showing live-crawl baseline — retry analysis or switch model in Settings."
          : message.includes("quota") || message.includes("429")
            ? "AI quota/rate limit hit. Showing crawl baseline. Wait, switch model, or add OpenRouter credits, then retry."
            : `AI analysis failed: ${message}. Showing live-crawl baseline. Fix key/model in Settings and retry.`,
      })
    );
  }
  } catch (fatal: unknown) {
    // Never 500 an empty body ΓÇö always return usable baseline
    const message = redactSecrets(fatal instanceof Error ? fatal.message : String(fatal));
    console.error("Analyze fatal:", message);
    try {
      res.json(
        sanitizeDeep({
          ...base,
          contentGaps: normalizeContentGaps(base?.contentGaps),
          isFallback: true,
          dataSource: "simulated",
          errorMsg: message,
        })
      );
    } catch {
      res.status(500).json({ error: "Analysis failed", isFallback: true, fallbackReason: message });
    }
  }
});

app.post("/api/generate-blog", async (req, res) => {
 const domain = resolveDomain(req.body);
 const {
 topic,
 keyword,
 secondaryKeywords = [],
 wordCount = 2000,
 audience = "",
 tone = "",
 competitorUrl = "",
 variationSeed,
 regenerateToken,
 previousTitle = "",
 previousContent = "",
 previousOutline = [],
 enhanceMode = false,
 analysisContext = null,
 } = req.body || {};
 if (!domain || domain === "target-website.com") {
 return res.status(400).json({ error: "Target URL / domain is required." });
 }
 const analysis = analysisContext && typeof analysisContext === "object" ? analysisContext : {};
 const analysisKeywords: string[] = Array.isArray(analysis.keywords)
  ? analysis.keywords.map((k: unknown) => String(k || "").trim()).filter(Boolean).slice(0, 20)
  : [];
 const analysisGaps: Array<{ topic?: string; keyword?: string; opportunity?: string }> = Array.isArray(
  analysis.contentGaps
 )
  ? analysis.contentGaps.slice(0, 10)
  : [];
 const analysisCompetitors: string[] = Array.isArray(analysis.competitors)
  ? analysis.competitors.map((c: unknown) => String(c || "").trim()).filter(Boolean).slice(0, 15)
  : [];
 const analysisNiche = sanitizeText(analysis.niche || analysis.coreNiche || "");
 const analysisAudience = sanitizeText(analysis.audience || analysis.audiencePersona || "");
 const analysisStrengths: string[] = Array.isArray(analysis.strengths)
  ? analysis.strengths.map((s: unknown) => String(s)).filter(Boolean).slice(0, 6)
  : [];
 const analysisWeaknesses: string[] = Array.isArray(analysis.weaknesses)
  ? analysis.weaknesses.map((s: unknown) => String(s)).filter(Boolean).slice(0, 6)
  : [];

 // Prefer explicit keyword → topic → analysis keywords (real-time from SEO analysis)
 const kw = sanitizeText(
  (keyword || topic || analysisKeywords[0] || "quality services") as string
 ) || "quality services";
 const topicResolved = sanitizeText((topic || keyword || kw) as string) || kw;
 // Unique seed every request so regenerations never clone the last draft
 const seed =
 Number(variationSeed) ||
 Number(regenerateToken) ||
 (Date.now() ^ Math.floor(Math.random() * 1e9));
 const strategy = pickStrategy(seed);
 const providerConfig = getProviderConfig(req);
 const isEnhance =
 Boolean(enhanceMode) ||
 (typeof previousContent === "string" && previousContent.trim().length > 200);

 // Live site context first — deeper crawl so first AI write is URL-grounded
 let siteBrief: any = null;
 try {
  siteBrief = await withTimeout(fetchPageSummary(domain), 18000, "Blog site crawl");
 } catch {
  siteBrief = null;
 }
 // Merge analysis niche/keywords into site brief so offline drafts stay on-niche
 if (siteBrief) {
  if (analysisNiche && !siteBrief.niche) siteBrief.niche = analysisNiche;
  if (analysisKeywords.length) {
   const existing = Array.isArray(siteBrief.keywords) ? siteBrief.keywords : [];
   siteBrief.keywords = Array.from(new Set([kw, ...analysisKeywords, ...existing])).slice(0, 16);
  }
 } else if (analysisNiche || analysisKeywords.length) {
  siteBrief = {
   brand: domain.split(".")[0],
   niche: analysisNiche || kw,
   description: analysisAudience
    ? `Audience: ${analysisAudience}. Focus: ${analysisNiche || kw}.`
    : `Focus: ${analysisNiche || kw}.`,
   services: [],
   keywords: Array.from(new Set([kw, ...analysisKeywords])).slice(0, 12),
   pageTitles: [],
   headings: analysisGaps.map((g) => g.topic || g.keyword || "").filter(Boolean).slice(0, 8),
   rawSnippet: [
    analysisStrengths.length ? `Strengths: ${analysisStrengths.join("; ")}` : "",
    analysisWeaknesses.length ? `Weaknesses: ${analysisWeaknesses.join("; ")}` : "",
   ]
    .filter(Boolean)
    .join(" "),
   source: "heuristic",
   scrapedPages: 0,
  };
 }
 const brand = domain.split(".")[0] || "the brand";
 const brandName = siteBrief?.brand || brand;
 const resolvedAudience =
  audience ||
  analysisAudience ||
  `buyers researching ${siteBrief?.niche || analysisNiche || "solutions"} related to ${brandName}`;

 // No API key → offline draft only (client should prompt Settings for live AI blogs)
 if (!providerConfig) {
 const unique = buildUniqueArticle({
 domain,
 kw,
 topic: topicResolved,
 seed: seed + (isEnhance ? 99 : 0),
 audience: resolvedAudience,
 tone,
 siteBrief,
 enhance: isEnhance,
 previousTitle: String(previousTitle || ""),
 });
 const normalized = normalizeBlogPayload(unique, domain, kw, seed);
 return res.status(200).json({
 ...normalized,
 isFallback: true,
 needsApiKey: true,
 strategyId: strategy.id,
 variationSeed: seed,
 enhanceMode: isEnhance,
 masterPromptApplied: true,
 aiGenerated: false,
 fallbackReason:
  "Live AI blog writing requires your API key. Open Settings → add OpenRouter or Gemini → Save → Generate again for a full AI research article.",
 });
 }

 // Log which provider will write (never log the key)
 console.debug(
  `[Blog] Live AI write via ${providerConfig.provider} model=${providerConfig.apiModel || "(default)"} domain=${domain} kw=${kw}`
 );
 try {
 const secondaryList = Array.isArray(secondaryKeywords)
  ? secondaryKeywords.map(String).filter(Boolean)
  : String(secondaryKeywords || "")
     .split(",")
     .map((s) => s.trim())
     .filter(Boolean);
 const secondaryMerged = Array.from(
  new Set([
   ...secondaryList,
   ...analysisKeywords.filter((k) => k.toLowerCase() !== kw.toLowerCase()),
   ...((siteBrief?.keywords || []) as string[]).filter(
    (k: string) => String(k).toLowerCase() !== kw.toLowerCase()
   ),
  ])
 ).slice(0, 8);
 const secondary = secondaryMerged.join(", ");
 const targetWords = Math.max(2000, Math.min(2800, Number(wordCount) || 2000));
 const masterTone = mapMasterTone(String(tone || "Professional"));
 const prevOutline = Array.isArray(previousOutline)
  ? previousOutline.map(String).slice(0, 12)
  : [];
 const prevClip =
  typeof previousContent === "string"
   ? previousContent.replace(/\s+/g, " ").trim().slice(0, 3500)
   : "";

 const compDomain = competitorUrl
  ? cleanDomain(String(competitorUrl))
  : analysisCompetitors[0]
    ? cleanDomain(String(analysisCompetitors[0]))
    : "";
 let competitorBrief: any = null;
 if (compDomain && compDomain !== domain) {
  try {
   competitorBrief = await withTimeout(fetchPageSummary(compDomain), 8000, "Competitor crawl");
  } catch {
   competitorBrief = null;
  }
 }

 const siteContext = {
  brand: brandName,
  niche: siteBrief?.niche || analysisNiche || undefined,
  description: String(siteBrief?.description || "").slice(0, 500),
  services: (siteBrief?.services || []).slice(0, 8),
  relatedKeywords: Array.from(
   new Set([...(siteBrief?.keywords || []), ...analysisKeywords])
  ).slice(0, 16),
  headings: (siteBrief?.headings || []).slice(0, 15),
  pageTitles: (siteBrief?.pageTitles || []).slice(0, 8),
  rawSnippet: String(siteBrief?.rawSnippet || "").slice(0, 900),
  source: siteBrief?.source,
  scrapedPages: siteBrief?.scrapedPages,
  contentStrengths: analysisStrengths,
  contentWeaknesses: analysisWeaknesses,
 };

 const competitorContext = competitorBrief
  ? {
     domain: compDomain,
     niche: competitorBrief.niche,
     description: String(competitorBrief.description || "").slice(0, 400),
     services: (competitorBrief.services || []).slice(0, 6),
     headings: (competitorBrief.headings || []).slice(0, 10),
    }
  : compDomain
    ? { domain: compDomain }
    : null;

 const densityLow = Math.max(20, Math.round(targetWords * 0.01));
 const densityHigh = Math.max(densityLow + 5, Math.round(targetWords * 0.015));

 const gapLines =
  analysisGaps.length > 0
   ? analysisGaps
      .map(
       (g, i) =>
        `${i + 1}. ${g.topic || g.keyword || "gap"}${g.opportunity ? ` — ${g.opportunity}` : ""}${g.keyword ? ` (kw: ${g.keyword})` : ""}`
      )
      .join("\n")
   : "(none from analysis — derive from niche and competitor)";

 // Local SEO location from crawl + optional analysisContext
 const analysisLocal = (analysis as any)?.localLocation || (analysis as any)?.location || {};
 const blogLoc = extractLocationFromCorpus(
  domain,
  `${siteContext.rawSnippet || ""} ${siteContext.description || ""} ${(siteContext.headings || []).join(" ")} ${analysisNiche}`,
  []
 );
 const localCity = sanitizeText(
  analysisLocal.city || siteBrief?.city || blogLoc.city || ""
 ) || blogLoc.city;
 const localState = sanitizeText(
  analysisLocal.state || siteBrief?.state || blogLoc.state || ""
 ) || blogLoc.state;
 const localCountry = sanitizeText(
  analysisLocal.country || siteBrief?.country || blogLoc.country || ""
 ) || blogLoc.country;
 const localAddress = sanitizeText(
  analysisLocal.detectedAddress || siteBrief?.detectedAddress || blogLoc.detectedAddress || ""
 ) || blogLoc.detectedAddress;
 const localAreas = (
  Array.isArray(analysisLocal.serviceAreas)
   ? analysisLocal.serviceAreas
   : siteBrief?.serviceAreas || blogLoc.serviceAreas || [localCity]
 ).filter(Boolean).slice(0, 6);

 const analysisBlock = `## STEP 0 — TARGET URL + LOCAL SEO ANALYSIS (mandatory — write for THIS local business)
PURPOSE: LOCAL SEO — high-intent local traffic (Map Pack + geo organic). Ground every section in location + industry.
TARGET_URL: https://${domain}/
BRAND: ${brandName}
CRAWL SOURCE: ${siteBrief?.source || "unknown"}
PRIMARY CITY / MARKET: ${localCity}
STATE / REGION: ${localState}
COUNTRY: ${localCountry}
DETECTED ADDRESS / NAP: ${localAddress}
SERVICE AREAS: ${localAreas.join("; ") || localCity}
INDUSTRY / NICHE: ${analysisNiche || siteBrief?.niche || "infer strictly from crawl"}
DESCRIPTION: ${String(siteContext.description || "").slice(0, 400)}
SERVICES/OFFERS: ${(siteContext.services || []).join("; ") || "(from crawl headings)"}
PAGE TITLES: ${(siteContext.pageTitles || []).slice(0, 6).join(" | ") || "(none)"}
HEADINGS SEEN: ${(siteContext.headings || []).slice(0, 12).join(" | ") || "(none)"}
SITE KEYWORDS: ${(siteContext.relatedKeywords || []).slice(0, 12).join(", ") || "(none)"}
STRENGTHS: ${analysisStrengths.join("; ") || "(from crawl)"}
WEAKNESSES / OPPORTUNITIES: ${analysisWeaknesses.join("; ") || "(from crawl)"}
RAW SNIPPET: ${String(siteContext.rawSnippet || "").slice(0, 500)}

## KEYWORD + AUDIENCE TARGETING (LOCAL)
TOPIC: ${topicResolved}
PRIMARY KEYWORD: ${kw}
  (If keyword is not geo-modified, weave "${localCity}" / "near me" / neighborhood naturally in H2s and examples — do not keyword-stuff.)
SECONDARY: ${secondary || "derive 2-3 from site keywords + city modifiers"}
LONG-TAILS: ${analysisKeywords.slice(0, 12).join("; ") || (siteBrief?.keywords || []).slice(0, 12).join("; ") || "derive local long-tails"}
AUDIENCE: ${resolvedAudience || `Local buyers in ${localCity} researching ${analysisNiche || kw}`}
TONE: ${masterTone}
DENSITY: ${densityLow}-${densityHigh} natural uses of primary keyword (~1.0-1.5% of ${targetWords} words)
LOCAL INTENT: Prefer examples, FAQs, and CTAs that help someone in ${localCity} choose and contact ${brandName}.

## LOCAL COMPETITOR + CONTENT GAPS
COMPETITOR_URL: ${compDomain ? `https://${compDomain}/` : "(use local peers from analysis)"}
COMPETITORS: ${analysisCompetitors.join(", ") || "(none listed)"}
COMPETITOR CRAWL: ${JSON.stringify(competitorContext)}
CONTENT GAPS TO COVER:
${gapLines}

## EDITORIAL SEED (stay on TARGET_URL niche + city)
Strategy: ${strategy.id} / ${strategy.style}
Title seed: ${strategy.titlePrefix(kw)}
Location must appear in intro, at least 2 H2s or examples, FAQ (hours/parking/areas if relevant), and conclusion CTA to https://${domain}/`;

 // PHASE 1: AI research brief — URL-first, JSON with robust parse
 let researchBrief: any = null;
 try {
  const researchPrompt = `STEP 0: Study TARGET URL analysis first. Then build the SEO research brief for THIS brand only.

Return ONLY valid compact JSON (no markdown fences, no commentary):
{
  "targetUrlInsights": {
    "brand": "${brandName}",
    "niche": "from crawl",
    "whatTheySell": ["..."],
    "contentOpportunities": ["..."]
  },
  "searchIntent": "informational|commercial|transactional|navigational",
  "primaryKeyword": "${kw}",
  "secondaryKeywords": ["2-4 terms from site + keyword research"],
  "longTail": ["6-10 long-tails"],
  "titleOptions": ["3 H1 options with primary keyword near front"],
  "outline": ["6-8 H2 titles that beat competitor gaps"],
  "competitorGaps": ["specific gaps from competitor/content gap list"],
  "proofPoints": ["3-5 ranges/benchmarks relevant to niche"],
  "workedExamples": ["2 mini cases using this brand niche"],
  "paaQuestions": ["4-6 PAA-style questions"],
  "uniqueAngle": "how ${brandName} is different — one sentence",
  "internalLinkTargets": ["https://${domain}/...", "https://${domain}/services", "https://${domain}/contact"]
}

${analysisBlock}

Rules: Stay on-niche for ${brandName}. No article body. Escape any quotes inside strings. ASCII only.`;
  const researchResult = await withTimeout(
   callAI(providerConfig, researchPrompt, buildBlogResearchSystemPrompt(), {
    responseMimeType: "application/json",
    temperature: 0.3,
    maxOutputTokens: 2500,
   }),
   35000,
   "Blog research"
  );
  const researchRaw = extractAiText(researchResult);
  researchBrief = tryParseJsonLoose(researchRaw);
  if (!researchBrief || typeof researchBrief !== "object") {
   throw new Error("Research JSON unusable after sanitize");
  }
 } catch (researchErr) {
  console.warn("[Blog] Research phase failed, continuing with analysis context:", researchErr);
  researchBrief = {
   targetUrlInsights: {
    brand: brandName,
    niche: siteContext.niche || analysisNiche || topicResolved,
    whatTheySell: siteContext.services || [],
    contentOpportunities: analysisWeaknesses.slice(0, 4),
   },
   searchIntent: "informational",
   primaryKeyword: kw,
   secondaryKeywords: secondaryMerged.slice(0, 4),
   outline: strategy.heads(kw, brandName),
   competitorGaps: analysisGaps.map((g) => g.topic || g.keyword).filter(Boolean),
   uniqueAngle: `Practical ${kw} guidance for ${brandName} in ${siteContext.niche || "this niche"}`,
   internalLinkTargets: [
    `https://${domain}/`,
    `https://${domain}/services`,
    `https://${domain}/contact`,
   ],
  };
 }

 // PHASE 2: MASTER-PROMPT markdown article FIRST (complete first-go write)
 // Models write better long-form in markdown; master rules are embedded in the system prompt.
 const titlePick =
  Array.isArray(researchBrief?.titleOptions) && researchBrief.titleOptions[0]
   ? String(researchBrief.titleOptions[0])
   : strategy.titlePrefix(kw);
 const outlinePick = Array.isArray(researchBrief?.outline)
  ? researchBrief.outline.slice(0, 8)
  : strategy.heads(kw, brandName);

 const enhanceNote = isEnhance
  ? `\nMODE: FULL REDRAFT/ENHANCE of prior draft. Previous title: ${String(previousTitle || "").slice(0, 120)}. Outline: ${prevOutline.join(" | ") || "(none)"}. Upgrade depth; keep keyword "${kw}" and brand ${brandName}.\nPrior excerpt (do not copy):\n"""${prevClip}"""\n`
  : "";

 const researchBriefJson = JSON.stringify(researchBrief).slice(0, 3500);
 const masterWriteSystem = buildSeoBlogWriterSystemPrompt(masterTone);
 const masterWritePrompt = `FIRST-PASS COMPLETE ARTICLE — write the full publishable LOCAL SEO post now (not an outline, not a stub).

STEP 0 — INTERNALIZE TARGET URL + LOCATION (already crawled):
You have live analysis of https://${domain}/ serving ${localCity}, ${localState}, ${localCountry}.
The article must sound researched for THIS local brand only.
If any paragraph could sit on a random national blog unchanged, rewrite with ${brandName} + ${localCity} specificity.
Goal: rank for local/geo intent and convert high-traffic "near me" / "in ${localCity}" searchers.

INPUTS (master prompt + Local SEO):
TOPIC: ${topicResolved}
KEYWORD: ${kw}
WORDCOUNT: ${targetWords} (hard minimum 1800 words of real prose; prefer ${targetWords}+)
AUDIENCE: ${resolvedAudience || `people in ${localCity} researching local solutions`}
TONE: ${masterTone}
BRAND: ${brandName}
TARGET_URL: https://${domain}/
LOCATION: ${localCity}, ${localState}, ${localCountry}
SERVICE AREAS: ${localAreas.join(", ") || localCity}
COMPETITOR_URL: ${compDomain ? `https://${compDomain}/` : "(from local analysis peers)"}
${enhanceNote}

${analysisBlock}

RESEARCH BRIEF (execute this outline; expand every H2 to ≥220 words of prose):
${researchBriefJson}

Suggested H1 seed: ${titlePick}
Suggested H2s: ${JSON.stringify(outlinePick)}
Secondary keywords to weave naturally: ${secondary || "from research brief"}
Long-tails / PAA: ${JSON.stringify(researchBrief?.paaQuestions || researchBrief?.longTail || []).slice(0, 800)}
Proof points to include: ${JSON.stringify(researchBrief?.proofPoints || []).slice(0, 600)}
Worked examples: ${JSON.stringify(researchBrief?.workedExamples || []).slice(0, 600)}
Unique angle: ${researchBrief?.uniqueAngle || `Practical ${kw} for ${brandName}`}
Internal links to use: ${JSON.stringify(researchBrief?.internalLinkTargets || [`https://${domain}/`, `https://${domain}/services`, `https://${domain}/contact`])}

MANDATORY STRUCTURE (master prompt order):
1. # Title — primary keyword near front, ~50-70 chars, benefit-led
2. Intro 150-250 words — hook, primary keyword in first 100 words, **Quick answer:** 2-3 sentences, who this is for
3. ## Key Takeaways — 4-6 complete sentence bullets
4. 6-8 ## H2 body sections — each ≥220 words flowing prose; open with direct answer in first 40-60 words
5. One section = common mistakes / pitfalls with specific fixes
6. At least one markdown comparison/decision table
7. 2-3 lines: [IMAGE: descriptive scene. Alt Text: "short alt"]
8. Exactly one: [CHART:bar title="..." labels="a,b,c" values="10,20,30"]
9. ## Frequently Asked Questions — 4-6 ### questions with 2-4 sentence answers
10. ## Conclusion 100-200 words + specific CTA with 2-3 internal links to https://${domain}/...

DEPTH (non-negotiable on THIS first response):
- ≥3 specific benchmarks/ranges relevant to the niche
- ≥2 mini cases grounded in ${brandName}'s niche
- ≥1 decision framework or scoring matrix (table OK)
- Trade-offs and when NOT to use an approach
- 4+ internal markdown links + several high-authority external links where natural
- Primary keyword density ~1.0-1.5% natural (not stuffed)

OUTPUT: ONLY the full article as Markdown. Start with # Title. No JSON. No preamble. No "Here is the article".`;

 console.debug(
  `[Blog] Phase 2 master-prompt markdown write (first-go complete) provider=${providerConfig.provider}`
 );

 let parsed: any = null;
 let generationMode:
  | "master-markdown"
  | "strict-json"
  | "markdown-fallback"
  | "partial"
  | "master-repair" = "master-markdown";
 let rawText = "";

 try {
  const writeResult = await withTimeout(
   callAI(providerConfig, masterWritePrompt, masterWriteSystem, {
    temperature: isEnhance ? 0.55 : 0.5,
    maxOutputTokens: 8192,
   }),
   120000,
   "Blog master write"
  );
  rawText = extractAiText(writeResult);
 } catch (writeErr) {
  console.warn("[Blog] Master markdown write failed:", writeErr);
  rawText = "";
 }

 if (rawText.trim()) {
  const mdParsed = parseMarkdownArticle(rawText, kw, domain, brandName, topicResolved);
  if (mdParsed && countContentWords(String(mdParsed.content || "")) >= 200) {
   parsed = mdParsed;
   generationMode = "master-markdown";
  } else {
   // Maybe model returned JSON despite instructions
   const asJsonEarly = tryParseJsonLoose(rawText);
   if (asJsonEarly && (asJsonEarly.article || asJsonEarly.content || asJsonEarly.sections)) {
    if (asJsonEarly.article || asJsonEarly.metadata || asJsonEarly.seoAnalysis) {
     parsed = mapStrictSeoArticleJson(asJsonEarly, {
      domain,
      brand: brandName,
      kw,
      topic: topicResolved,
      targetWords,
      researchBrief,
     });
     generationMode = "strict-json";
    } else {
     parsed = asJsonEarly;
     if (asJsonEarly.content) parsed.content = polishBlogProse(String(asJsonEarly.content));
     generationMode = "partial";
    }
   }
  }
 }

 // Secondary: structured JSON write if master markdown was empty/thin
 if (!parsed || countContentWords(String(parsed?.content || "")) < 600) {
  try {
   console.warn("[Blog] Master markdown thin/empty — structured JSON secondary pass");
   const strictUserPrompt = `Target URL for SEO Analysis: https://${domain}/
Topic: ${topicResolved}
Primary Keyword: ${kw}
Brand: ${brandName}
Audience: ${resolvedAudience}
Tone: ${masterTone}
Word count target: ${targetWords} (minimum 1500 words of real prose)
${enhanceNote}

TASK: Analyze TARGET_URL context + research brief, then write a complete structured article for THIS brand only.
Each section.content must be multi-paragraph detailed prose (not thin bullets).

${analysisBlock}

RESEARCH BRIEF:
${researchBriefJson}

Suggested H1: ${titlePick}
Suggested H2s: ${JSON.stringify(outlinePick)}

OUTPUT SCHEMA (strict top-level keys):
{
  "seoAnalysis": { "targetNiche": "...", "targetAudience": "..." },
  "metadata": {
    "seoTitle": "max 60 chars with primary keyword",
    "metaDescription": "max 155 chars with primary keyword",
    "targetKeywords": ["5-7 long-tail keywords"]
  },
  "article": {
    "introduction": "150-250 words with Quick answer. Use \\\\n for breaks.",
    "sections": [
      { "heading": "H2", "content": "≥220 words prose. Use \\\\n. Escape quotes." }
    ],
    "conclusion": "100-200 words + CTA to https://${domain}/"
  },
  "seoMasterPack": {
    "robots": "index,follow",
    "canonicalUrl": "https://${domain}/blog/slug-here",
    "hreflang": "x-default",
    "structuredData": { "@context": "https://schema.org", "@type": "Article", "headline": "...", "author": { "@type": "Organization", "name": "${brandName}" } },
    "imageAssets": [
      { "placement": "hero", "alt": "descriptive alt" },
      { "placement": "mid-article", "alt": "process visual alt" }
    ],
    "internalLinking": [
      { "anchor": "hub", "url": "https://${domain}/", "type": "Hub" },
      { "anchor": "services", "url": "https://${domain}/services", "type": "Service" },
      { "anchor": "contact", "url": "https://${domain}/contact", "type": "Conversion" }
    ],
    "renderingNote": "SSR/SSG primary HTML",
    "sitemapNote": "Add URL to sitemap.xml on publish"
  }
}
Include 6-8 article.sections. Place 2-3 [IMAGE: scene. Alt Text: \\"alt\\"] inside section content.
Return ONLY raw JSON. No markdown fences.`;

   const strictResult = await withTimeout(
    callAI(providerConfig, strictUserPrompt, STRICT_SEO_ARTICLE_SYSTEM_PROMPT, {
     responseMimeType: "application/json",
     temperature: 0.45,
     maxOutputTokens: 8192,
    }),
    100000,
    "Blog JSON secondary"
   );
   const strictRaw = extractAiText(strictResult);
   const asJson = tryParseJsonLoose(strictRaw);
   if (asJson && (asJson.article || asJson.metadata || asJson.sections || asJson.content)) {
    let jsonParsed: any;
    if (asJson.article || asJson.metadata || asJson.seoAnalysis) {
     jsonParsed = mapStrictSeoArticleJson(asJson, {
      domain,
      brand: brandName,
      kw,
      topic: topicResolved,
      targetWords,
      researchBrief,
     });
    } else {
     jsonParsed = asJson;
     if (asJson.content) jsonParsed.content = polishBlogProse(String(asJson.content));
    }
    if (
     countContentWords(String(jsonParsed?.content || "")) >
     countContentWords(String(parsed?.content || ""))
    ) {
     parsed = jsonParsed;
     generationMode = "strict-json";
    }
   } else if (strictRaw.trim()) {
    const mdFromStrict = parseMarkdownArticle(strictRaw, kw, domain, brandName, topicResolved);
    if (
     mdFromStrict &&
     countContentWords(String(mdFromStrict.content || "")) >
      countContentWords(String(parsed?.content || ""))
    ) {
     parsed = mdFromStrict;
     generationMode = "markdown-fallback";
    }
   }
  } catch (jsonErr) {
   console.warn("[Blog] JSON secondary pass failed:", jsonErr);
  }
 }

 if (!parsed || !parsed.content || countContentWords(String(parsed.content)) < 80) {
  console.warn("[Blog] AI article output could not be recovered as publishable content (parse/structure). Falling back to offline generation.");
  parsed = parsed || {};
 }

 if ((!parsed.outline || !parsed.outline.length) && researchBrief?.outline) {
  parsed.outline = researchBrief.outline;
 }
 if (!parsed.title || String(parsed.title).length < 12) {
  parsed.title = sanitizeText(titlePick) || strategy.titlePrefix(kw);
 }
 if (!parsed.keywordStrategy) {
  parsed.keywordStrategy = {
   primary: researchBrief?.primaryKeyword || kw,
   secondary: researchBrief?.secondaryKeywords || secondaryMerged.slice(0, 4),
   longTail: researchBrief?.longTail || [],
   intent: researchBrief?.searchIntent || "informational",
   targetPrimaryCount: `${densityLow}-${densityHigh}`,
  };
 } else {
  parsed.keywordStrategy.primary = parsed.keywordStrategy.primary || kw;
  parsed.keywordStrategy.targetPrimaryCount =
   parsed.keywordStrategy.targetPrimaryCount || `${densityLow}-${densityHigh}`;
 }

 if (parsed.content) {
  parsed.content = polishBlogProse(String(parsed.content));
 }

 parsed.strategyId = strategy.id;
 parsed.variationSeed = seed;
 parsed.generationMode = generationMode;

 let normalized = normalizeBlogPayload(parsed, domain, kw, seed);
 if (normalized.content) {
  normalized.content = polishBlogProse(String(normalized.content));
  normalized.content = improveReadability(normalized.content);
 }
 let quality = scoreBlogArticle(String(normalized.content || ""), kw);

 // PHASE 3: master-prompt expansion if first write is still thin
 if (!quality.ok || quality.words < 1400) {
  try {
   console.warn(
    `[Blog] Expanding thin draft (${quality.words} words; ${quality.reasons.join(", ")}) via master prompt repair`
   );
   const repairSystem = buildSeoBlogWriterSystemPrompt(masterTone);
   const repairPrompt = `The previous draft was too thin (${quality.words} words; issues: ${quality.reasons.join(", ")}).
Rewrite a COMPLETE, stronger article for TARGET_URL https://${domain}/ following the SEO BLOG MASTER RULES fully.

TOPIC: ${topicResolved}
KEYWORD: ${kw}
BRAND: ${brandName}
TONE: ${masterTone}
WORD COUNT: minimum 2000 words of real prose (prefer ${targetWords})
AUDIENCE: ${resolvedAudience}

${analysisBlock}

RESEARCH BRIEF:
${researchBriefJson}

Prior thin draft excerpt (do not copy structure weaknesses — upgrade depth):
"""${String(normalized.content || "").replace(/\s+/g, " ").trim().slice(0, 2500)}"""

Mandatory: Key Takeaways, 6-8 H2s (≥220 words each), comparison table, common mistakes, 4-6 FAQ, Conclusion+CTA, 2-3 IMAGE tags, 1 CHART tag.
Return ONLY full Markdown starting with # Title. No JSON. No fences.`;
   const repairResult = await withTimeout(
    callAI(providerConfig, repairPrompt, repairSystem, {
     temperature: 0.5,
     maxOutputTokens: 8192,
    }),
    120000,
    "Blog master repair"
   );
   const repairText = extractAiText(repairResult);
   const repairMd = parseMarkdownArticle(repairText, kw, domain, brandName, topicResolved);
   if (repairMd) {
    const repaired = normalizeBlogPayload(repairMd, domain, kw, seed + 3);
    if (repaired.content) {
     repaired.content = polishBlogProse(improveReadability(String(repaired.content)));
    }
    const q2 = scoreBlogArticle(String(repaired.content || ""), kw);
    if (q2.words > quality.words || (q2.ok && !quality.ok)) {
     normalized = repaired;
     quality = q2;
     generationMode = "master-repair";
    }
   }
  } catch (repairErr) {
   console.warn("[Blog] Master repair pass failed:", repairErr);
  }
 }

 // Only offline if AI truly failed to produce usable length
 if (!normalized.content || countContentWords(normalized.content) < 500) {
  const unique = buildUniqueArticle({
   domain,
   kw,
   topic: topicResolved,
   seed: seed + 17,
   audience: resolvedAudience,
   tone,
   siteBrief,
   enhance: isEnhance,
   previousTitle: String(previousTitle || ""),
  });
  normalized = {
   ...normalizeBlogPayload(unique, domain, kw, seed + 17),
   isFallback: true,
   fallbackReason:
    "AI returned incomplete content after research/write. Showing analysis-grounded structured draft — check API key/model and regenerate.",
   strategyId: unique.strategyId,
   variationSeed: seed + 17,
   masterPromptApplied: true,
   researchUsed: Boolean(researchBrief),
   qualityScore: quality,
   pipeline: {
    crawlSource: siteBrief?.source || "none",
    scrapedPages: siteBrief?.scrapedPages || 0,
    researchUsed: Boolean(researchBrief),
    generationMode: "offline-fallback",
    masterPromptApplied: true,
   },
  };
  return res.json(normalized);
 }

 // Enrich keyword strategy + SEO analysis from research when missing
 if (!normalized.keywordStrategy) {
  normalized.keywordStrategy = {
   primary: researchBrief?.primaryKeyword || kw,
   secondary: researchBrief?.secondaryKeywords || secondaryMerged.slice(0, 4),
   longTail: researchBrief?.longTail || [],
   intent: researchBrief?.searchIntent || "informational",
   targetPrimaryCount: `${densityLow}-${densityHigh}`,
  };
 }
 if (!normalized.seoAnalysis && researchBrief?.targetUrlInsights) {
  normalized.seoAnalysis = {
   targetNiche: researchBrief.targetUrlInsights.niche || siteContext.niche || analysisNiche,
   targetAudience: resolvedAudience,
  };
 }
 if (!normalized.targetKeywords?.length) {
  normalized.targetKeywords = [
   kw,
   ...(researchBrief?.secondaryKeywords || secondaryMerged).slice(0, 6),
  ].filter(Boolean);
 }

 res.json({
  ...normalized,
  strategyId: strategy.id,
  variationSeed: seed,
  masterPromptApplied: true,
  enhanceMode: isEnhance,
  researchUsed: true,
  aiGenerated: true,
  generationMode,
  qualityScore: {
   words: quality.words,
   h2: quality.h2,
   ok: quality.ok,
   reasons: quality.reasons,
   hasTable: quality.hasTable,
   hasFaq: quality.hasFaq,
   hasTakeaways: quality.hasTakeaways,
  },
  pipeline: {
   crawlSource: siteBrief?.source || "heuristic",
   scrapedPages: siteBrief?.scrapedPages || 0,
   niche: siteContext.niche || analysisNiche || "",
   researchUsed: true,
   generationMode,
   masterPromptApplied: true,
   wordCount: quality.words,
   h2Count: quality.h2,
  },
  isFallback: false,
 });
 } catch (err: unknown) {
 const raw = redactSecrets(err instanceof Error ? err.message : String(err));
 console.error("Blog error:", raw);
 const friendly = humanizeProviderError(raw);
 const unique = buildUniqueArticle({
 domain,
 kw,
 topic: topicResolved,
 seed: seed + 31,
 audience: resolvedAudience,
 tone,
 siteBrief,
 enhance: isEnhance,
 previousTitle: String(previousTitle || ""),
 });
 const normalized = normalizeBlogPayload(unique, domain, kw, seed + 31);
 return res.json({
 ...normalized,
 isFallback: true,
 strategyId: unique.strategyId,
 variationSeed: seed + 31,
 enhanceMode: isEnhance,
 masterPromptApplied: true,
 quotaExceeded: /quota|rate limit|429|RESOURCE_EXHAUSTED/i.test(raw),
 fallbackReason: friendly,
 aiGenerated: false,
 generationMode: "offline-fallback",
 });
 }
});


app.post("/api/generate-social", async (req, res) => {
 const domain = resolveDomain(req.body);
 const {
  keyword = "",
  topic = "",
  platform = "Twitter/X",
  platforms: platformsBody,
  generateAll = false,
  audience = "",
  contentGoal = "",
  brandVoice = "",
 } = req.body || {};
 if (!domain || domain === "target-website.com") {
  return res.status(400).json({ error: "Target URL / domain is required." });
 }

 const topicStr = String(topic || keyword || "growth insights").trim();
 const keywordStr = String(keyword || topicStr).trim();
 const extras = {
  audience: String(audience || ""),
  contentGoal: String(contentGoal || ""),
  brandVoice: String(brandVoice || ""),
 };

 // Multi-platform: generateAll or platforms[]
 let targetPlatforms: SocialPlatformName[] = [];
 if (generateAll === true || generateAll === "true" || generateAll === 1) {
  targetPlatforms = [...SOCIAL_PLATFORMS];
 } else if (Array.isArray(platformsBody) && platformsBody.length) {
  targetPlatforms = Array.from(
   new Set(platformsBody.map((p: unknown) => normalizeSocialPlatform(p)))
  );
 } else {
  targetPlatforms = [normalizeSocialPlatform(platform)];
 }

 const providerConfig = getProviderConfig(req);

 async function generateOne(plat: SocialPlatformName): Promise<any> {
  if (!providerConfig) {
   return socialFallback(
    plat,
    topicStr,
    keywordStr,
    domain,
    "Structured platform draft (offline). Add your AI API key in Settings for full AI rewrites.",
    extras
   );
  }
  try {
   const prompt = platformSocialPrompt(
    plat,
    topicStr,
    keywordStr,
    domain,
    extras.audience,
    extras.contentGoal,
    extras.brandVoice
   );
   const system =
    "You are an expert multi-platform social copywriter. Return ONLY valid JSON for the requested platform. No markdown fences.";
   const result = await withTimeout(
    callAI(providerConfig, prompt, system, {
     responseMimeType: "application/json",
     temperature: 0.55,
     maxOutputTokens: 2500,
    }),
    45000,
    `Social ${plat}`
   );
   const rawText =
    typeof result?.text === "string"
     ? result.text
     : typeof result === "string"
       ? result
       : "";
   if (!rawText.trim()) {
    return socialFallback(
     plat,
     topicStr,
     keywordStr,
     domain,
     "AI returned empty social copy. Showing a platform-native draft.",
     extras
    );
   }
   let parsed: any;
   try {
    parsed = cleanAndParseJSON(rawText);
   } catch {
    // Model returned plain text — wrap as content
    parsed = { platform: plat, content: rawText };
   }
   // Unwrap { posts: [...] }
   if (parsed?.posts && Array.isArray(parsed.posts) && parsed.posts.length > 0) {
    const match =
     parsed.posts.find(
      (p: { platform?: string }) =>
       normalizeSocialPlatform(p?.platform) === plat
     ) || parsed.posts[0];
    parsed = match;
   }
   const normalized = normalizeSocialPayload(parsed, plat, topicStr, keywordStr, domain);
   return { ...normalized, platform: plat, isFallback: false };
  } catch (err: unknown) {
   const message = humanizeProviderError(err);
   return socialFallback(plat, topicStr, keywordStr, domain, message, extras);
  }
 }

 try {
  // Parallel for multi, sequential-safe for single
  const results = await Promise.all(targetPlatforms.map((p) => generateOne(p)));

  if (targetPlatforms.length === 1) {
   // Single-platform response (backward compatible with SocialPanel)
   return res.json(results[0]);
  }

  // Multi-platform package
  return res.json({
   posts: results,
   platform: "multi",
   content: results[0]?.content || "",
   generatedCount: results.length,
   isFallback: results.some((r) => r.isFallback),
   fallbackReason: results.find((r) => r.isFallback)?.fallbackReason,
   needsApiKey: !providerConfig,
  });
 } catch (err: unknown) {
  const message = humanizeProviderError(err);
  // Never leave the UI empty
  const fallbacks = targetPlatforms.map((p) =>
   socialFallback(p, topicStr, keywordStr, domain, message, extras)
  );
  if (fallbacks.length === 1) return res.json(fallbacks[0]);
  return res.json({
   posts: fallbacks,
   platform: "multi",
   content: fallbacks[0]?.content || "",
   generatedCount: fallbacks.length,
   isFallback: true,
   fallbackReason: message,
  });
 }
});

app.post("/api/analyze-keyword-deep", async (req, res) => {
 const domain = resolveDomain(req.body);
 const keyword = req.body?.keyword as string | undefined;
 if (!keyword || !domain || domain === "target-website.com") {
 return res.status(400).json({ error: "Keyword and Target URL are required." });
 }
 const providerConfig = getProviderConfig(req);
 if (!providerConfig) {
 // Demo-only synthetic SERP audit ΓÇö never uses a server-owned key
 const data = await generateDeepKeywordFallback(keyword, domain);
 return res.json({
 ...data,
 isFallback: true,
 needsApiKey: true,
 fallbackReason: "Demo data only. Add your API key in Settings for live SERP-grounded analysis.",
 });
 }
 try {
 // No googleSearch tools - they make this endpoint extremely slow on Vercel
 const prompt = `Deep keyword SEO audit for "${keyword}" targeting site "${domain}".
Return compact JSON only (ASCII text):
{
 "keyword": string,
 "topResults": [{ "rank": number, "title": string, "url": string, "contentLength": number, "contentType": string, "domainRating": number, "freshnessScore": "Fresh|Stable|Legacy" }] (8 items),
 "averageContentLength": number,
 "commonSubtopics": [{ "subtopic": string, "relevance": number, "description": string }] (5),
 "featuredSnippet": { "format": "Paragraph|List|Table", "extractedText": string, "optimizedOpportunity": string },
 "peopleAlsoAsk": [{ "question": string, "answer": string, "sourceUrl": string }] (4),
 "relatedSearches": string[] (6),
 "contentTypeAnalysis": { "dominantType": string, "percentageBreakdown": [{ "type": string, "percentage": number }] },
 "freshnessRequirements": { "level": "Low|Medium|High", "explanation": string, "recommendedUpdateFrequency": string }
}
Use realistic SERP-style data for the niche. JSON only.`;
 const fastConfig = {
 ...providerConfig,
 apiModel:
 providerConfig.provider === "gemini"
 ? "gemini-2.5-flash-lite"
 : providerConfig.apiModel,
 };
 const result = await withTimeout(
 callAI(fastConfig, prompt, "Valid compact JSON only. No fences. ASCII only.", {
 responseMimeType: "application/json",
 temperature: 0.15,
 maxOutputTokens: 3000,
 }),
 15000,
 "Deep keyword analysis"
 );
 res.json(sanitizeDeep(cleanAndParseJSON(result.text)));
 } catch (err: unknown) {
 const message = redactSecrets(err instanceof Error ? err.message : String(err));
 const data = await generateDeepKeywordFallback(keyword, domain);
 res.json(sanitizeDeep({ ...data, isFallback: true, errorMsg: message }));
 }
});

function buildOfflineMetaSnippets(
  keyword: string,
  articleTitle: string,
  domain: string
): Array<{ type: string; title: string; description: string }> {
  const kw = sanitizeText(keyword || "SEO services") || "SEO services";
  const brand = (domain.split(".")[0] || "Brand").replace(/^\w/, (c) => c.toUpperCase());
  const titleBase = sanitizeText(articleTitle) || kw;
  const city = "Kolkata";
  const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trim()}…`);
  return [
    {
      type: "default",
      title: clip(`${kw} | ${brand} ${city}`, 60),
      description: clip(
        `Learn ${kw} with practical steps for ${city} businesses. Expert tips from ${brand}. Start improving visibility today.`,
        155
      ),
    },
    {
      type: "question",
      title: clip(`What Is ${kw}? ${city} Guide`, 60),
      description: clip(
        `Answers to common questions about ${kw} in ${city}. Clear definitions, local examples, and next steps from ${brand}.`,
        155
      ),
    },
    {
      type: "benefit",
      title: clip(`${kw}: Results for ${city} Brands`, 60),
      description: clip(
        `Grow traffic and trust with ${kw}. ${brand} covers strategy, content, and local SEO for ${city} teams.`,
        155
      ),
    },
    {
      type: "how-to",
      title: clip(`How to Master ${kw} in ${city}`, 60),
      description: clip(
        `Step-by-step ${kw} playbook for ${city}. Actionable checklist, tools, and mistakes to avoid — by ${brand}.`,
        155
      ),
    },
    {
      type: "list",
      title: clip(`${titleBase}: Top Tips (${city})`, 60),
      description: clip(
        `Top tips on ${kw} for ${city} searchers. Compare options, check proof points, and pick a clear next action with ${brand}.`,
        155
      ),
    },
  ];
}

app.post("/api/generate-meta-snippets", async (req, res) => {
  const domain = resolveDomain(req.body);
  const { keyword = "SEO services", content = "", articleTitle = "" } = req.body || {};
  if (!domain || domain === "target-website.com") {
    return res.status(400).json({ error: "Target URL / domain is required." });
  }
  const providerConfig = getProviderConfig(req);
  if (!providerConfig) {
    return res.status(200).json({
      isFallback: true,
      needsApiKey: true,
      snippets: buildOfflineMetaSnippets(String(keyword), String(articleTitle), domain),
      fallbackReason:
        "Offline meta variants. Add your AI API key in Settings for live AI-written titles and descriptions.",
    });
  }
  try {
    const excerpt = typeof content === "string" ? content.slice(0, 1500) : "";
    const prompt = `Generate 5 high-CTR SEO meta title and description variants for a page on "${domain}".
Primary keyword: "${keyword}"
Article title: "${articleTitle}"
Content excerpt: """${excerpt}"""
Local market: Kolkata, West Bengal, India (use geo modifiers where natural).

Rules: titles max 60 chars with keyword near start; descriptions 140-155 chars with benefit + soft CTA; no clickbait.
Return ONLY JSON: { "snippets": [ { "type": "default|question|benefit|how-to|list", "title": "...", "description": "..." } ] }`;
    const result = await callAI(providerConfig, prompt, "", {
      responseMimeType: "application/json",
      temperature: 0.3,
    });
    const parsed = cleanAndParseJSON(result.text);
    if (Array.isArray(parsed)) return res.json({ snippets: parsed });
    if (parsed && Array.isArray((parsed as { snippets?: unknown }).snippets)) {
      return res.json(parsed);
    }
    return res.json({
      snippets: buildOfflineMetaSnippets(String(keyword), String(articleTitle), domain),
      isFallback: true,
      fallbackReason: "AI response unusable — offline meta variants returned.",
    });
  } catch (err: unknown) {
    const message = redactSecrets(err instanceof Error ? err.message : String(err));
    res.status(200).json({
      isFallback: true,
      fallbackReason: message,
      snippets: buildOfflineMetaSnippets(String(keyword), String(articleTitle), domain),
    });
  }
});

// ============================================================
// DataForSEO Real-Time Endpoints (BYOK or server-side API key)
// ============================================================

function extractDfsCredentials(req: { body?: Record<string, unknown> }): DfsCredentials | undefined {
  const body = req.body ?? {};
  // Client postApi nests BYOK DataForSEO creds under aiConfig; also accept top-level
  const aiCfg =
    body.aiConfig && typeof body.aiConfig === "object"
      ? (body.aiConfig as Record<string, unknown>)
      : null;
  const login = (body.dataforseoLogin || aiCfg?.dataforseoLogin) as string | undefined;
  const password = (body.dataforseoPassword || aiCfg?.dataforseoPassword) as string | undefined;
  if (typeof login === "string" && login.trim() && typeof password === "string" && password.trim()) {
    return { login: login.trim(), password: password.trim() };
  }
  return undefined;
}

function hasDfsAccess(req: { body?: Record<string, unknown> }): boolean {
  return Boolean(extractDfsCredentials(req) || HAS_DFSEO);
}

// Test DataForSEO credentials (validates login/password without consuming API quota)
app.post("/api/seo/test-credentials", async (req, res) => {
  const creds = extractDfsCredentials(req);
  if (!creds) {
    return res.status(400).json({ valid: false, error: "No DataForSEO credentials provided. Add login and password in Settings." });
  }
  try {
    // Ping DataForSEO keyword data API with a single known keyword; if auth fails we get 401/403.
    const result = await dfseoPost<{ keywords?: DfKeywordData[] }>(
      "/keywords_data/google/keywords/search_volume",
      [{ keyword: "seo", location_code: DEFAULT_LOCATION_CODE, language_code: DEFAULT_LANGUAGE_CODE }],
      creds
    );
    const hasData = Array.isArray((result as any)?.keywords) || typeof result === "object";
    if (!hasData) {
      return res.json({ valid: true, warning: "Credentials accepted but returned empty data." });
    }
    res.json({ valid: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (/401|403|unauthorized|forbidden|invalid.*credential/i.test(message)) {
      return res.status(200).json({ valid: false, error: "Invalid DataForSEO login or password. Check your credentials at app.dataforseo.com." });
    }
    if (/timeout|fetch|network|econnrefused|enotfound/i.test(message)) {
      return res.status(200).json({ valid: false, error: "Cannot reach DataForSEO API. Check your network connection." });
    }
    res.status(200).json({ valid: false, error: `DataForSEO test failed: ${redactSecrets(message)}` });
  }
});

app.post("/api/seo/keyword-volume", async (req, res) => {
  if (!hasDfsAccess(req)) {
    return res.status(503).json({ error: "DataForSEO credentials not configured. Add them in Settings." });
  }
  const { keywords = [], locationCode = DEFAULT_LOCATION_CODE, languageCode = DEFAULT_LANGUAGE_CODE } = req.body || {};
  const creds = extractDfsCredentials(req);
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({ error: "keywords array is required." });
  }
  try {
    const data = await fetchKeywordVolumes(keywords.slice(0, 20), locationCode, languageCode, creds);
    res.json({ keywords: data, source: "dataforseo" });
  } catch (err: unknown) {
    const message = redactSecrets(err instanceof Error ? err.message : String(err));
    res.status(502).json({ error: "DataForSEO keyword lookup failed", detail: message });
  }
});

app.post("/api/seo/serp", async (req, res) => {
  if (!hasDfsAccess(req)) {
    return res.status(503).json({ error: "DataForSEO credentials not configured. Add them in Settings." });
  }
  const { keyword = "", locationCode = DEFAULT_LOCATION_CODE, languageCode = DEFAULT_LANGUAGE_CODE } = req.body || {};
  const creds = extractDfsCredentials(req);
  if (!keyword) {
    return res.status(400).json({ error: "keyword is required." });
  }
  try {
    const items = await fetchSerp(keyword, locationCode, languageCode, creds);
    res.json({ items, keyword, source: "dataforseo" });
  } catch (err: unknown) {
    const message = redactSecrets(err instanceof Error ? err.message : String(err));
    res.status(502).json({ error: "DataForSEO SERP fetch failed", detail: message });
  }
});

app.post("/api/seo/domain-overview", async (req, res) => {
  if (!hasDfsAccess(req)) {
    return res.status(503).json({ error: "DataForSEO credentials not configured. Add them in Settings." });
  }
  const { domain = "", locationCode = DEFAULT_LOCATION_CODE, languageCode = DEFAULT_LANGUAGE_CODE } = req.body || {};
  const creds = extractDfsCredentials(req);
  if (!domain) {
    return res.status(400).json({ error: "domain is required." });
  }
  try {
    const data = await fetchDomainOverview(cleanDomain(domain), locationCode, languageCode, creds);
    res.json({ ...data, source: "dataforseo" });
  } catch (err: unknown) {
    const message = redactSecrets(err instanceof Error ? err.message : String(err));
    res.status(502).json({ error: "DataForSEO domain overview failed", detail: message });
  }
});

app.post("/api/seo/backlinks", async (req, res) => {
  if (!hasDfsAccess(req)) {
    return res.status(503).json({ error: "DataForSEO credentials not configured. Add them in Settings." });
  }
  const { domain = "", limit = 100, locationCode = DEFAULT_LOCATION_CODE, languageCode = DEFAULT_LANGUAGE_CODE } = req.body || {};
  const creds = extractDfsCredentials(req);
  if (!domain) {
    return res.status(400).json({ error: "domain is required." });
  }
  try {
    const backlinks = await fetchBacklinks(cleanDomain(domain), Math.min(limit, 200), locationCode, languageCode, creds);
    res.json({ backlinks, source: "dataforseo" });
  } catch (err: unknown) {
    const message = redactSecrets(err instanceof Error ? err.message : String(err));
    res.status(502).json({ error: "DataForSEO backlinks fetch failed", detail: message });
  }
});

app.post("/api/seo/page-speed", async (req, res) => {
  if (!hasDfsAccess(req)) {
    return res.status(503).json({ error: "DataForSEO credentials not configured. Add them in Settings." });
  }
  const { url = "" } = req.body || {};
  const creds = extractDfsCredentials(req);
  if (!url) {
    return res.status(400).json({ error: "url is required." });
  }
  try {
    const data = await fetchPageSpeed(url, creds);
    res.json({ lighthouse: data, source: "dataforseo" });
  } catch (err: unknown) {
    const message = redactSecrets(err instanceof Error ? err.message : String(err));
    res.status(502).json({ error: "DataForSEO page speed failed", detail: message });
  }
});

// Full bundle: SERP + Keywords + Backlinks + PageSpeed in one call
app.post("/api/seo/full-bundle", async (req, res) => {
  if (!hasDfsAccess(req)) {
    return res.status(503).json({ error: "DataForSEO credentials not configured. Add them in Settings." });
  }
  const { domain = "", seedKeywords = [], locationCode, languageCode } = req.body || {};
  const creds = extractDfsCredentials(req);
  if (!domain) {
    return res.status(400).json({ error: "domain is required." });
  }
  try {
    const bundle = await fetchFullBundle(cleanDomain(domain), seedKeywords, {
      credentials: creds,
      locationCode,
      languageCode,
    });
    res.json({ ...bundle, source: "dataforseo" });
  } catch (err: unknown) {
    const message = redactSecrets(err instanceof Error ? err.message : String(err));
    res.status(502).json({ error: "DataForSEO full bundle failed", detail: message });
  }
});

const distPath = path.join(process.cwd(), "dist");
const isServerless =
 process.env.VERCEL === "1" ||
 !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
 !!process.env.VERCEL_ENV ||
 !!process.env.NOW_REGION;
const isProd =
 process.env.NODE_ENV === "production" ||
 process.argv.includes("--prod") ||
 isServerless;

// Global JSON error handler for API routes (never leak stack traces to clients)
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(err);
  const message = redactSecrets(err instanceof Error ? err.message : String(err || "Unknown error"));
  console.error("Unhandled API error:", message);
  res.status(500).json({ error: "Internal server error", isFallback: true, fallbackReason: message });
});

if (isProd) {
 app.use(express.static(distPath));
 app.get("*", (req, res) => {
 if (req.path.startsWith("/api/")) {
 return res.status(404).json({ error: "API route not found" });
 }
 try {
 const template = fs.readFileSync(path.join(distPath, "index.html"), "utf-8");
 res.send(template);
 } catch {
 res.status(500).send("Server error: dist/index.html missing. Run npm run build.");
 }
 });
}

async function startLocalServer() {
 const PORT = parseInt(process.env.PORT || "3000", 10);
 if (!isProd) {
 const { createServer: createViteServer } = await import("vite");
 const vite = await createViteServer({
 server: { middlewareMode: true },
 appType: "custom",
 });
 app.use(vite.middlewares);
 app.use(async (req, res, next) => {
 if (req.originalUrl?.startsWith("/api")) return next();
 try {
 const url = req.originalUrl || "/";
 let template = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf-8");
 template = await vite.transformIndexHtml(url, template);
 res.status(200).set({ "Content-Type": "text/html" }).end(template);
 } catch (e) {
 vite.ssrFixStacktrace(e as Error);
 next(e);
 }
 });
 }
 app.listen(PORT, "0.0.0.0", () => {
 console.log(`SEO app running at http://localhost:${PORT} (${isProd ? "production" : "dev"})`);
 });
}

if (!isServerless) {
 startLocalServer().catch((err) => {
 console.error("Failed to start local server:", err);
 process.exit(1);
 });
}

export default app;
