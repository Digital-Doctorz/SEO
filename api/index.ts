import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const HAS_DFSEO = Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);

// ============================================================
// DataForSEO helpers (inlined — Vercel serverless cannot import ./lib/* reliably)
// ============================================================
const DFSEO_BASE = "https://api.dataforseo.com/v3";

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
  first_seen?: string;
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
  return json.tasks?.[0]?.result?.[0] as T;
}

async function fetchSerp(keyword: string, locationCode = 2840, languageCode = "en", credentials?: DfsCredentials): Promise<DfSerpItem[]> {
  const result = await dfseoPost<{ items?: DfSerpItem[]; search_dataframe?: DfSerpItem[] }>(
    "/serp/google/organic/live/advanced",
    [{ keyword, location_code: locationCode, language_code: languageCode, device: "desktop", os: "windows", depth: 10 }],
    credentials
  );
  return result.items ?? result.search_dataframe ?? [];
}

async function fetchKeywordVolumes(keywords: string[], locationCode = 2840, languageCode = "en", credentials?: DfsCredentials): Promise<DfKeywordData[]> {
  if (!keywords.length) return [];
  const tasks = keywords.map((kw) => ({ keyword: kw, location_code: locationCode, language_code: languageCode }));
  const result = await dfseoPost<{ keywords?: DfKeywordData[] }>(
    "/keywords_data/google/keywords/search_volume",
    tasks,
    credentials
  );
  return result.keywords ?? [];
}

async function fetchDomainOverview(domain: string, locationCode = 2840, languageCode = "en", credentials?: DfsCredentials): Promise<DfDomainBacklinksResult> {
  return dfseoPost<DfDomainBacklinksResult>("/backlinks/domain/overview", [
    { target: domain, location_code: locationCode, language_code: languageCode },
  ], credentials);
}

async function fetchBacklinks(domain: string, limit = 100, locationCode = 2840, languageCode = "en", credentials?: DfsCredentials): Promise<DfBacklinkItem[]> {
  const result = await dfseoPost<{ backlinks?: DfBacklinkItem[] }>("/backlinks/domain/backlinks", [
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
  const result = await dfseoPost<{ lighthouse_result?: { categories?: Record<string, { score?: number }>; audits?: Record<string, { numericValue?: number }> } }>(
    "/page_speed/google/lighthouse/summary",
    [{ target: url, settings: { device: "desktop", locale: "en" } }],
    credentials
  );
  return result.lighthouse_result;
}

async function fetchFullBundle(domain: string, seedKeywords: string[], options?: { credentials?: DfsCredentials; locationCode?: number; languageCode?: string }): Promise<DataForSeoBundle> {
  const creds = options?.credentials;
  const loc = options?.locationCode ?? 2840;
  const lang = options?.languageCode ?? "en";
  const primaryKeyword =
    seedKeywords[0] ?? domain.replace(/\.(com|in|org|net|co\.in)$/i, "").replace(/-/g, " ");
  const [serpItems, domainOverview, backlinks, pageSpeedResult, ...keywordResults] = await Promise.all([
    fetchSerp(primaryKeyword, loc, lang, creds).catch(() => [] as DfSerpItem[]),
    fetchDomainOverview(domain, loc, lang, creds).catch(() => ({} as DfDomainBacklinksResult)),
    fetchBacklinks(domain, 200, loc, lang, creds).catch(() => [] as DfBacklinkItem[]),
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
      top_referring_domains: (backlinks || []).slice(0, 20).map((b) => ({
        source_url: b.referring_url ?? "",
        source_domain: b.referring_domain ?? "",
        anchor: b.anchor ?? "",
        domain_rating: b.domain_rank ?? 0,
        first_seen: b.first_seen ?? "",
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
 s = s.replace(/â€[™˜'"]|â€œ|â€\u009C|â€\u009D/g, "'");
 s = s.replace(/â€"|â€“|â€”/g, "-");
 s = s.replace(/â€¦/g, "...");
 s = s.replace(/â€¢/g, "-");
 s = s.replace(/Ãƒ[\u0080-\u00FF]{0,4}/g, "");
 s = s.replace(/Ã¢[\u0080-\u00FF]{0,6}/g, "");
 s = s.replace(/Â/g, "");
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

function cleanAndParseJSON(text: string): any {
 let cleaned = String(text || "").trim();
 if (cleaned.startsWith("```")) {
 cleaned = cleaned.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "");
 }
 cleaned = cleaned.trim();
 try {
 return JSON.parse(cleaned);
 } catch {
 /* continue */
 }
 const firstBrace = cleaned.indexOf("{");
 if (firstBrace === -1) {
 throw new Error(`Failed to parse JSON: no object found. Snippet: ${cleaned.slice(0, 180)}`);
 }
 const lastBrace = cleaned.lastIndexOf("}");
 const extracted =
 lastBrace > firstBrace
 ? cleaned.substring(firstBrace, lastBrace + 1)
 : cleaned.substring(firstBrace);
 try {
 return JSON.parse(extracted);
 } catch {
 /* try repair */
 }
 try {
 return JSON.parse(repairTruncatedJson(extracted));
 } catch (err) {
 throw new Error(
 `Failed to parse JSON: ${(err as Error).message}. Snippet: ${cleaned.slice(0, 200)}`
 );
 }
}

/** Client sends targetDomain; older paths send targetUrl. Accept both. */
function resolveDomain(
 body: { targetUrl?: string; targetDomain?: string } | undefined
): string {
 const raw = body?.targetUrl || body?.targetDomain || "";
 return cleanDomain(raw);
}

async function generateContentWithFallback(
 ai: GoogleGenAI,
 contents: string | any[],
 config: any,
 defaultModel: string = "gemini-2.5-flash"
): Promise<any> {
 // Prefer speed: primary model first, one lite fallback, single retry only
 const modelsToTry = Array.from(new Set([defaultModel, "gemini-2.5-flash-lite"])).slice(0, 2);
 let lastError: any = null;
 for (const model of modelsToTry) {
 let retries = 1;
 let delay = 500;
 while (retries >= 0) {
 try {
 console.log(`[Gemini] Attempting model: "${model}"`);
 const response = await ai.models.generateContent({ model, contents, config });
 if (response && response.text) {
 console.log(`[Gemini] Success with model: "${model}"`);
 return response;
 }
 throw new Error(`Empty response from model ${model}`);
 } catch (err: any) {
 lastError = err;
 const msg = String(err?.message || "");
 const isQuota = /quota|resource_exhausted|billing|exceeded|limit/i.test(msg)
 && !/rate limit exceeded/i.test(msg);
 if (retries > 0 && !isQuota && (err.status === 503 || err.status === 429 || /high demand|Spikes in demand/i.test(msg))) {
 await new Promise((r) => setTimeout(r, delay));
 delay *= 2;
 retries--;
 } else {
 break;
 }
 }
 }
 }
 throw lastError || new Error("All fallback models failed.");
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
 * Ensure every content-gap row has the full UI schema.
 * AI often returns partial objects (missing volume/rank) which crash the Gaps tab.
 */
function normalizeContentGaps(raw: unknown, fallbackKeywords: string[] = []): any[] {
 const source = Array.isArray(raw) ? raw : [];
 const items = source.length > 0
 ? source
 : fallbackKeywords.slice(0, 6).map((kw, i) => ({
 competitorKeyword: kw,
 recommendedTopic: `Complete Guide to ${String(kw).charAt(0).toUpperCase()}${String(kw).slice(1)}`,
 difficultyCategory: i < 2 ? "Easy" : i < 4 ? "Medium" : "Hard",
 isQuickWin: i < 3,
 }));

 return items
 .map((g: any, i: number) => {
 if (!g || typeof g !== "object") return null;
 const keyword = sanitizeText(
 g.competitorKeyword || g.keyword || g.query || fallbackKeywords[i] || `opportunity ${i + 1}`
 );
 if (!keyword) return null;

 const difficultyRaw = Number(g.competitorDifficulty ?? g.difficulty ?? g.kd ?? 25 + (i % 5) * 10);
 const difficulty = Math.max(1, Math.min(100, Number.isFinite(difficultyRaw) ? Math.round(difficultyRaw) : 30));

 let difficultyCategory = sanitizeText(g.difficultyCategory || g.difficulty_category || "");
 if (!["Easy", "Medium", "Hard"].includes(difficultyCategory)) {
 difficultyCategory = difficulty < 30 ? "Easy" : difficulty < 55 ? "Medium" : "Hard";
 }

 const volumeRaw = Number(g.competitorVolume ?? g.volume ?? g.searchVolume ?? 1200 - i * 100);
 const volume = Math.max(50, Number.isFinite(volumeRaw) ? Math.round(volumeRaw) : 500);

 const rankRaw = Number(g.competitorRank ?? g.rank ?? g.position ?? 3 + (i % 7));
 const competitorRank = Math.max(1, Math.min(100, Number.isFinite(rankRaw) ? Math.round(rankRaw) : 5));

 let targetRank: number | "Not Ranking" = "Not Ranking";
 if (g.targetRank === "Not Ranking" || g.targetRank === "unranked" || g.target_rank === "Not Ranking") {
 targetRank = "Not Ranking";
 } else if (g.targetRank != null && g.targetRank !== "") {
 const tr = Number(g.targetRank);
 targetRank = Number.isFinite(tr) ? Math.round(tr) : "Not Ranking";
 } else if (i % 3 !== 0) {
 targetRank = 15 + i * 4;
 }

 const recommendedTopic = sanitizeText(
 g.recommendedTopic || g.topic || g.recommended_topic || `Complete Guide to ${keyword}`
 );
 const recommendedType = sanitizeText(
 g.recommendedType || g.contentType || g.recommended_type || (i % 2 === 0 ? "Pillar Blog Post" : "Comparison Guide")
 );
 const isQuickWin = Boolean(
 g.isQuickWin ?? g.quickWin ?? g.is_quick_win ?? (difficulty < 35 && i < 4)
 );

 return {
 competitorKeyword: keyword,
 competitorRank,
 competitorVolume: volume,
 competitorDifficulty: difficulty,
 targetRank,
 recommendedTopic: recommendedTopic || `Guide to ${keyword}`,
 recommendedType: recommendedType || "Pillar Blog Post",
 difficultyCategory,
 isQuickWin,
 };
 })
 .filter(Boolean);
}

/** Assemble full markdown from sectioned AI payload (more reliable than one giant string). */
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

 // Prefer existing full content if already long enough
 const existing = sanitizeText(parsed?.content || "");
 if (existing.length >= 400 && sections.length === 0) return existing;

 if (intro || takeaways.length || sections.length) {
 const parts: string[] = [`# ${title}`, ""];
 if (intro) parts.push(intro, "");
 if (takeaways.length) {
 parts.push("## Key Takeaways", ...takeaways.map((t) => (t.startsWith("-") ? t : `- ${t}`)), "");
 }
 for (const sec of sections) {
 if (sec.heading) parts.push(`## ${sec.heading.replace(/^#+\s*/, "")}`, "");
 if (sec.body) parts.push(sec.body, "");
 }
 if (faqs.length) {
 parts.push("## Frequently Asked Questions", "");
 for (const f of faqs) {
 parts.push(`### ${f.question}`, f.answer, "");
 }
 }
 if (conclusion) {
 parts.push("## Conclusion", "", conclusion);
 } else {
 parts.push(
 "## Conclusion",
 "",
 `Use this guide to put ${kw} into practice. Learn more at [${brand}](https://${domain}/).`
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
 titlePrefix: (kw: string) => `How to Win With ${kw} in 7 Steps (Without the Fluff)`,
 style: "step-by-step how-to with numbered actions",
 heads: (kw: string, brand: string) => [
 `What is ${kw}? (plain answer)`,
 `Why ${kw} matters right now`,
 `A 7-step plan to apply ${kw}`,
 `Tools and checks that keep you on track`,
 `Mistakes that slow ${kw} results`,
 `How ${brand} helps you move faster`,
 ],
 intro: (kw: string, brand: string) =>
 `Struggling to get clear results from **${kw}**? You are not alone. This guide gives you a short plan you can use this week. You will see what ${kw} means, the steps that work, and how ${brand} supports the work without fluff.`,
 },
 {
 id: "compare",
 titlePrefix: (kw: string) => `${kw}: Best Options Compared (What Actually Works in 2026)`,
 style: "comparison-first decision guide",
 heads: (kw: string, brand: string) => [
 `Quick answer: which ${kw} path fits you`,
 `Side-by-side options for ${kw}`,
 `When to choose speed vs depth`,
 `A simple decision framework`,
 `Rollout plan for the next 30 days`,
 `Next steps with ${brand}`,
 ],
 intro: (kw: string, brand: string) =>
 `Not every approach to **${kw}** is equal. Some paths burn time. Others build results you can measure. This article compares the main options in plain language, then shows a clear pick-and-run plan for teams working with ${brand}.`,
 },
 {
 id: "myths",
 titlePrefix: (kw: string) => `${kw} Myths Costing You Clicks (And What to Do Instead)`,
 style: "myth-busting expert brief",
 heads: (kw: string, brand: string) => [
 `The biggest myth about ${kw}`,
 `What the data and practice actually show`,
 `A better model for ${kw}`,
 `Proof points and real examples`,
 `Action checklist for this month`,
 `Work with ${brand} on a clean plan`,
 ],
 intro: (kw: string, brand: string) =>
 `Many guides on **${kw}** repeat the same weak advice. That costs months. Here we cut the myths, keep the facts, and give you a cleaner model you can apply with support from ${brand}.`,
 },
 {
 id: "playbook",
 titlePrefix: (kw: string) => `The ${kw} Playbook: First Audit to Steady Wins`,
 style: "tactical playbook with weekly sprints",
 heads: (kw: string, brand: string) => [
 `Start here: define success for ${kw}`,
 `Week 1 audit and baselines`,
 `Week 2 build and publish`,
 `Week 3 measure and fix`,
 `Scale what works with ${brand}`,
 `Keep results compounding`,
 ],
 intro: (kw: string, brand: string) =>
 `Want a repeatable system for **${kw}**? This playbook runs in short weekly sprints. Each step is simple on purpose so your score for clarity stays high and your team can ship. ${brand} is the home base for your next action.`,
 },
 {
 id: "faqhub",
 titlePrefix: (kw: string) => `${kw} Explained: Real Answers Searchers Click in 2026`,
 style: "PAA-led answer hub for featured snippets",
 heads: (kw: string, brand: string) => [
 `What is ${kw}?`,
 `How does ${kw} work in practice?`,
 `How long until ${kw} shows results?`,
 `What budget and skills do you need?`,
 `How to avoid common traps`,
 `Where ${brand} fits in your plan`,
 ],
 intro: (kw: string, brand: string) =>
 `People type many questions about **${kw}** into Google. This page answers them first in short blocks, then expands with steps. Short answers help search and AI systems. Full steps help you act with ${brand}.`,
 },
 {
 id: "case",
 titlePrefix: (kw: string) => `From Stuck to Results: A ${kw} Walkthrough You Can Copy`,
 style: "narrative case walkthrough with lessons",
 heads: (kw: string, brand: string) => [
 `The starting problem with ${kw}`,
 `What we measured first`,
 `The turning point`,
 `The exact sequence that worked`,
 `Lessons you can copy today`,
 `How to run this with ${brand}`,
 ],
 intro: (kw: string, brand: string) =>
 `Here is a story-style walkthrough of **${kw}** done the hard way, then the smart way. You will see the early mistakes, the metrics that mattered, and a clean sequence you can copy. ${brand} can be your partner for the same path.`,
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
}): {
 title: string;
 metaDescription: string;
 slugSuggestion: string;
 outline: string[];
 content: string;
 faqSection: Array<{ question: string; answer: string }>;
 strategyId: string;
} {
 const domain = cleanDomain(opts.domain);
 const brand = (domain.split(".")[0] || "Brand").replace(/^\w/, (c) => c.toUpperCase());
 const kw = sanitizeText(opts.kw || opts.topic || "growth strategy") || "growth strategy";
 const seed = opts.seed ?? Date.now();
 const strategy = pickStrategy(seed);
 const yearHint = 2026;
 const title = strategy.titlePrefix(kw);
 const heads = strategy.heads(kw, brand);
 const slug =
 title
 .toLowerCase()
 .replace(/[^a-z0-9]+/g, "-")
 .replace(/(^-|-$)/g, "")
 .slice(0, 70) || "article";
 const metaDescription = sanitizeText(
 `${title.slice(0, 80)}. Clear steps, a comparison table, and FAQs for ${kw}. From ${brand}.`
 ).slice(0, 155);

 const faqSection = [
 {
 question: `What is ${kw}?`,
 answer: `${kw} is a clear method to get better results with simple steps, short checks, and steady weekly work.`,
 },
 {
 question: `How long does ${kw} take to show results?`,
 answer: "Most teams see early signals in 4 to 8 weeks when they ship every week and track one main metric.",
 },
 {
 question: `What is the best first step for ${kw}?`,
 answer: "Write down your goal, your audience, and one number you will improve. Then run a short audit before you scale.",
 },
 {
 question: `How can ${brand} help with ${kw}?`,
 answer: `${brand} provides focused support, resources, and next steps at https://${domain}/ so you can move from plan to action.`,
 },
 ];

 const tableBlock = [
 "## Quick comparison",
 "",
 "| Path | Best for | Effort | Time to first signal |",
 "| --- | --- | --- | --- |",
 `| Focused ${kw} plan | Clear weekly goals | Medium | 4-8 weeks |`,
 "| Random posts | Testing ideas only | Low | Hard to tell |",
 "| Full rebuild | Large teams | High | 8-16 weeks |",
 "",
 ].join("\n");

 const bodySections = heads
 .map((h, idx) => {
 const n = idx + 1;
 const body = [
 `${h.replace(/\?.*$/, "")} has a simple answer. Start with one outcome you can measure. Keep language plain so more people finish the page.`,
 "",
 "### Do this next",
 `1. Note your current baseline for ${kw}.`,
 `2. Ship one small improvement this week.`,
 `3. Review results every Friday and adjust.`,
 "",
 idx === 1 ? tableBlock : "",
 idx === 2
 ? `For a deeper service path, see [${brand} resources](https://${domain}/services) and the main hub at [https://${domain}/](https://${domain}/).`
 : `Keep related pages linked. Example: [${brand} home](https://${domain}/).`,
 "",
 `Tip ${n}: short paragraphs beat long walls of text. Aim for 2 to 4 sentences, then a list.`,
 ].filter(Boolean);
 return [`## ${h}`, "", ...body].join("\n");
 })
 .join("\n\n");

 const content = improveReadability(
 [
 `# ${title}`,
 "",
 strategy.intro(kw, brand),
 "",
 `Audience focus: ${sanitizeText(opts.audience || "busy professionals")}. Tone: ${sanitizeText(opts.tone || "clear and practical")}. Updated for ${yearHint}.`,
 "",
 "## Key Takeaways",
 `- ${kw} works when goals are clear and progress is weekly.`,
 "- Short sentences and direct answers help readers and search systems.",
 "- Use a simple table to compare options before you commit.",
 `- Link to related pages on [${brand}](https://${domain}/) for topical strength.`,
 "- Measure one primary metric so you know what to fix next.",
 "",
 bodySections,
 "",
 "## Frequently Asked Questions",
 "",
 ...faqSection.flatMap((f) => [`### ${f.question}`, f.answer, ""]),
 "## Conclusion",
 "",
 `You now have a fresh ${strategy.style} for **${kw}**. Pick one step today. Track it this week. Then expand. Continue at [${brand}](https://${domain}/).`,
 ].join("\n")
 );

 return {
 title,
 metaDescription,
 slugSuggestion: slug,
 outline: heads,
 content,
 faqSection,
 strategyId: strategy.id,
 };
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
 {
 anchor: "Google Search Essentials",
 url: "https://developers.google.com/search/docs/essentials",
 authority: "Google (Search docs)",
 },
 {
 anchor: "Flesch reading ease overview",
 url: "https://en.wikipedia.org/wiki/Flesch%E2%80%93Kincaid_readability_tests",
 authority: "Wikipedia (readability)",
 },
 {
 anchor: "Schema.org Article",
 url: "https://schema.org/Article",
 authority: "Schema.org",
 },
 {
 anchor: "MDN web docs",
 url: "https://developer.mozilla.org/",
 authority: "MDN (web standards)",
 },
 {
 anchor: "NCBI research library",
 url: "https://www.ncbi.nlm.nih.gov/",
 authority: "NCBI / NIH",
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
 if (content.length < 250) {
 const unique = buildUniqueArticle({ domain, kw, seed: seed ?? Date.now(), topic: title });
 content = unique.content;
 if (!title || title === kw) {
 return normalizeBlogPayload({ ...unique, title: unique.title }, domain, kw, seed);
 }
 }
 content = improveReadability(content);
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
 const technicalSeo =
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

 return sanitizeDeep({
 title,
 metaDescription,
 slugSuggestion,
 outline: finalOutline,
 content,
 schemaMarkup,
 faqSection,
 linkingRecommendations,
 technicalSeo,
 preWritingAnalysis,
 strategyId: parsed?.strategyId,
 variationSeed: seed ?? parsed?.variationSeed,
 });
}

// ============================================================
// AI Provider Abstraction
// ============================================================
interface ProviderConfig {
 apiKey: string;
 provider: "gemini" | "openrouter" | "custom";
 apiEndpoint: string;
 apiModel: string;
 customFormat: "openai" | "anthropic" | "gemini";
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
 const endpoint = (apiEndpoint || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
 const messages: any[] = [];
 if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
 messages.push({ role: "user", content: prompt });
 const body: any = {
 model: apiModel || "meta-llama/llama-3.3-70b-instruct:free",
 messages,
 temperature: options?.temperature ?? 0.1,
 max_tokens: 8192,
 };
 if (options?.responseMimeType === "application/json") body.response_format = { type: "json_object" };
 const response = await fetch(`${endpoint}/chat/completions`, {
 method: "POST",
 headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}`, "HTTP-Referer": "http://localhost:3000", "X-Title": "Local SEO App" },
 body: JSON.stringify(body),
 });
 const data = await response.json();
 if (!response.ok) throw new Error(`OpenRouter error ${response.status}: ${data.error?.message || JSON.stringify(data)}`);
 const text = data.choices?.[0]?.message?.content || "";
 return { text };
 }

 if (provider === "custom") {
 const format = customFormat || "openai";
 const endpoint = (apiEndpoint || "").replace(/\/+$/, "");
 if (format === "openai") {
 const messages: any[] = [];
 if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
 messages.push({ role: "user", content: prompt });
 const body: any = { model: apiModel, messages, temperature: options?.temperature ?? 0.1, max_tokens: 8192 };
 if (options?.responseMimeType === "application/json") body.response_format = { type: "json_object" };
 const response = await fetch(`${endpoint}/chat/completions`, {
 method: "POST",
 headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
 body: JSON.stringify(body),
 });
 const data = await response.json();
 if (!response.ok) throw new Error(`Custom API error ${response.status}: ${data.error?.message || JSON.stringify(data)}`);
 const text = data.choices?.[0]?.message?.content || "";
 return { text };
 }
 if (format === "anthropic") {
 const body: any = {
 model: apiModel,
 messages: systemPrompt
 ? [{ role: "user", content: `${systemPrompt}\n\n${prompt}` }]
 : [{ role: "user", content: prompt }],
 max_tokens: 8192,
 temperature: options?.temperature ?? 0.1,
 };
 const headers: Record<string, string> = { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
 const response = await fetch(`${endpoint}/messages`, { method: "POST", headers, body: JSON.stringify(body) });
 const data = await response.json();
 if (!response.ok) throw new Error(`Anthropic API error ${response.status}: ${data.error?.message || JSON.stringify(data)}`);
 const text = data.content?.[0]?.text || "";
 return { text };
 }
 if (format === "gemini") {
 const client = new GoogleGenAI({ apiKey, ...(endpoint ? { baseUrl: endpoint } : {}), httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
 const model = apiModel || "gemini-2.5-flash";
 const genConfig: any = { ...options };
 if (systemPrompt) genConfig.systemInstruction = { parts: [{ text: systemPrompt }] };
 const response = await client.models.generateContent({ model, contents: prompt, config: genConfig });
 return response;
 }
 }
 throw new Error(`Unknown provider: ${provider}`);
}

/**
 * BYOK only — every user supplies their own key via request body (from browser Settings).
 * NEVER fall back to process.env / GEMINI_API_KEY / shared server secrets.
 * Keys are never written to disk, logs, or shared storage on the server.
 */
function getProviderConfig(req: { body?: { aiConfig?: Partial<ProviderConfig> } }): ProviderConfig | null {
 const cfg = req.body?.aiConfig;
 const rawKey = typeof cfg?.apiKey === "string" ? cfg.apiKey.trim() : "";
 if (!rawKey) return null;
 // Reject obvious placeholders so a fake "key" never hits a provider
 const lower = rawKey.toLowerCase();
 if (
 lower.includes("your") ||
 lower.includes("placeholder") ||
 lower === "my_gemini_api_key" ||
 lower === "xxx" ||
 rawKey.length < 8
 ) {
 return null;
 }
 return {
 apiKey: rawKey,
 provider: cfg?.provider || "gemini",
 apiEndpoint: (cfg?.apiEndpoint || "").trim(),
 apiModel: (cfg?.apiModel || "").trim(),
 customFormat: cfg?.customFormat || "openai",
 };
}

/** Strip secrets from error strings before logging or returning to clients. */
function redactSecrets(message: string): string {
 return message
 .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [REDACTED]")
 .replace(/AIza[0-9A-Za-z_\-]{10,}/g, "[REDACTED_KEY]")
 .replace(/sk-or-v1-[A-Za-z0-9_\-]{10,}/g, "[REDACTED_KEY]")
 .replace(/sk-[A-Za-z0-9]{20,}/g, "[REDACTED_KEY]")
 .replace(/x-api-key["']?\s*[:=]\s*["']?[^"'\s,}]+/gi, "x-api-key:[REDACTED]");
}

const SEO_BLOG_SYSTEM_PROMPT = `You are an elite SEO content strategist and editorial writer.
Write for humans first; structure for Google ranking and AI answer engines (GEO).

READABILITY (CRITICAL - Flesch Reading Ease must score 65-85):
- Average sentence length 12-18 words. Never exceed 22 words in one sentence.
- Prefer common short words. Avoid stacked jargon.
- Active voice. One idea per sentence.
- Short paragraphs (2-4 sentences). Lists after key points.
- Grade level target: 7-9.

TITLE RULES (CRITICAL - click-through optimized long-tail):
- Title MUST lead with a high-intent long-tail keyword phrase tied to the brand/niche.
- 50-70 characters. Curiosity + clear benefit. Specific, not vague.
- Preferred patterns: "How to [result] with [keyword] (Without [pain])", "[Number] Proven Ways to [result]", "The Complete [keyword] Guide for [audience] (2026)", "Why [audience] Switch to [keyword] (And How to Start)".
- Catchy and clickable, but NOT misleading clickbait or fake urgency.
- Never use only a brand name or a single generic word as the title.

MANDATORY STANDARDS:
1. Content MUST stay relevant to the target website niche, services, and audience provided in the prompt.
2. Fresh structure every run: new title, H2 order, examples. No generic boilerplate.
3. Primary long-tail keyword near start of title, in intro first 100 words, and in one H2. Density ~0.8-1.5%.
4. Intro 40-90 words: hook -> keyword -> what reader learns.
5. Exactly 5 key takeaways (short bullets).
6. QAE body: each section answers first (40-60 words), then steps.
7. One markdown comparison table in one section body.
8. 4 FAQ Q&As (People Also Ask style).
9. Conclusion with CTA link to the brand domain.
10. 3-5 internal markdown links to https://{domain}/... paths with descriptive anchors.
11. 2-3 external links to reputable sources.
12. ASCII punctuation only. No emojis. No fancy dashes.

FORBIDDEN: keyword stuffing, "in today's digital world", "leverage synergies", fake study stats, incomplete JSON, identical boilerplates, off-niche content.

Return ONLY valid compact JSON (no markdown fences, no schemaMarkup field):
{
 "title": string (long-tail, click-optimized, SEO title),
 "metaDescription": string (140-155 chars, keyword + benefit + soft CTA),
 "slugSuggestion": string (kebab-case from primary long-tail),
 "outline": string[] (H2 titles),
 "intro": string (markdown paragraphs, no H1),
 "keyTakeaways": string[] (5 short bullets without leading dashes),
 "sections": [ { "heading": string, "body": string } ] (5-7 sections; body is markdown without the H2 line; one body includes a markdown table),
 "faqSection": [ { "question": string, "answer": string } ],
 "conclusion": string (markdown with CTA link)
}`;

// ============================================================
// Live site crawl — understand the real business behind the URL
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
 const s = seed.toLowerCase().trim();
 if (!s) return [];
 return [
 s,
 `best ${s} for ${brand} customers`,
 `how to choose ${s}`,
 `${s} cost and pricing guide`,
 `${s} vs alternatives`,
 `${s} near me`,
 `complete ${s} checklist 2026`,
 `${niche.split("&")[0].trim().toLowerCase()} ${s}`,
 ];
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
 `https://www.${clean}/about`,
 `https://www.${clean}/services`,
 `https://www.${clean}/products`,
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
 /about|service|product|solution|pricing|feature|blog|care|treatment|shop|platform|docs|api|contact|industr|use-case|customer/.test(
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

 return {
 niche: nicheFromHead.slice(0, 120),
 description: description.slice(0, 500),
 services: uniqueServices.length
 ? uniqueServices
 : heuristicSiteProfile(clean).services,
 keywords: longTails.slice(0, 15),
 brand,
 pageTitles: pageTitles.slice(0, 12),
 headings: headings.slice(0, 30),
 scrapedPages: fetched.length,
 rawSnippet: corpus.slice(0, 1500),
 source: "live-crawl",
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
 // Weak crawl — blend with heuristics
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
 return merged.map((c, index) => ({
 domain: c.domain,
 nicheSimilarity: c.sim,
 nicheFocus: c.focus,
 estimatedMonthlyTraffic: Math.round(8000 + index * 2200 + brand.length * 400),
 popularBlogUrl: `https://${c.domain}/blog`,
 latestArticleTitle: `${kw1}: What ${c.focus} Teams Changed in 2026`,
 latestArticleUrl: `https://${c.domain}/blog/${kw1.replace(/\s+/g, "-").slice(0, 40)}`,
 analyzedTakeaway: `${c.domain} competes in ${niche} with focus on ${c.focus.toLowerCase()}. Opportunity: outrank them on long-tail queries like "${kw1}" and "${kw2}" with deeper FAQs and comparison pages.`,
 targetKeywords: [
 kw1,
 kw2,
 keywords[2] || `best ${kw1}`,
 keywords[3] || `${kw1} pricing`,
 ].filter(Boolean),
 seoStrategy: "Topical clusters, comparison pages, and FAQ schema around commercial long-tails.",
 aiRankStrategy: "Answer-first H2s, entity-rich definitions, and cited sources for AI Overviews.",
 schemaRecommendation: "Article + FAQPage + Organization JSON-LD on service and blog templates.",
 }));
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
 content = `# ${kwCap}: A Complete Guide to Non-Surgical Pain Relief Through Evidence-Based Phytotherapy\n\nChronic musculoskeletal pain affects over 100 million Indians, yet most treatments only mask symptoms. Here is the problem: painkillers, steroid injections, and even surgeries address the consequence, not the cause. **${keyword}** takes a fundamentally different approach  targeting muscle degeneration at the cellular level using clinically validated phyto-molecular therapy. This guide walks through exactly how it works, what the research says, and how you can find lasting relief without surgery or drugs. For verified treatment options, visit [${formattedBrand}](https://${targetDomain}/).\n\n---\n\n## Understanding ${kwCap}: Why Muscles Matter More Than Joints\n\nHere is what most doctors won't tell you: your joints don't fail on their own. The muscles surrounding them degenerate first  a condition Dr. Apurba Ganguly's team spent over 45 years researching, called **MD-OADs (Muscular Dystrophy during Osteoarthritic Disorders)**. When muscles lose strength, they stop protecting your joints. The joint takes on abnormal load. Cartilage breaks down. Pain follows. Fix the muscle  and you fix the joint.\n\nConventional diagnostics like X-rays and MRIs excel at showing structural damage  bone spurs, herniated discs, narrowed joint spaces. But they miss the real story. By analyzing 40+ blood biomarkers including inflammatory markers (CRP, ESR, IL-6), oxidative stress markers (MDA, SOD), and muscle enzyme levels, OPTM's proprietary **Bio-Musculo Index** AI assessment reveals your true biological muscle age versus your chronological age with 97% diagnostic accuracy. According to research published in the [National Library of Medicine](https://www.ncbi.nlm.nih.gov/), this biomarker-driven approach identifies metabolic dysfunction that standard imaging simply cannot detect. Unlike conventional clinics that prescribe the same protocol for every patient, [OPTM Healthcare](https://${targetDomain}/) uses this data to create a 100% personalized treatment plan.\n\n[IMAGE 1: Doctor reviewing biomarker analysis results on a digital tablet with a patient. Alt Text: "Physician explaining Bio-Musculo Index blood biomarker analysis results for muscle age diagnosis at OPTM Healthcare Delhi clinic"]\n\n### Key Conditions Treated Through This Approach at OPTM Clinics\n\nOPTM treats 30+ musculoskeletal conditions non-surgically across its three clinics in Delhi (South Extension), Kolkata (Gariahat), and Panchkula (Sector 11). The most common conditions include:\n\n| Condition | Patients Treated | Surgery Avoidance Rate |\n|:---|:---:|:---:|\n| Knee Osteoarthritis | 60% of all patients | 96% |\n| Degenerative Disc Disease | 15% of all patients | 82% |\n| Cervical Spondylosis | 12% of all patients | 89% |\n| Sciatica & Slipped Disc | 8% of all patients | 84% |\n| Frozen Shoulder | 5% of all patients | 91% |\n\nThese figures come from a landmark clinical study conducted across multiple OPTM centers between 2019-2024. The overall success rate across all conditions is 94-97%, with over 100,000 patients treated since 2011.\n\n---\n\n## The OPTM Protocol: A 4-Step Data-Driven Path to Pain Relief\n\nUnlike generic wellness programs, the OPTM protocol follows a [structured, evidence-based methodology](https://${targetDomain}/) that treats every patient as a unique biological system. The protocol is recognized by the **Ministry of AYUSH**, Government of India, and has earned the **Rose of Paracelsus**  Europe's highest medical honour.\n\n### Step 1: Assess  AI-Powered Precision Diagnostics (45 minutes)\n\nYour journey begins at one of OPTM's clinics  F-38 South Extension-1, New Delhi; 145 Rash Behari Avenue, Kolkata; or 1003 Sector 11, Panchkula. The world's first AI-enabled precision blood biomarker test, the **Bio-Musculo Index** developed in partnership with Varco Leg Care, analyzes 60+ biomarkers through a proprietary algorithm. In one 990 visit, you learn more about your muscle biology than years of X-rays and MRIs ever told you. The system cross-references your profile against a database of 100,000+ cases.\n\n### Step 2: Plan  Personalized Treatment Roadmap (60 minutes)\n\nYour dedicated Program Doctor  part of a team led by Chief Medical Officer Dr. Chirag Dilal (MS ORTHO, IIT Bombay)  translates your biomarker data into a clear, personalized treatment plan with a 42-90 day healing timeline. Every protocol targets your specific inflammatory pathways, oxidative stress levels, and metabolic deficiencies.\n\n### Step 3: Treat  Phyto-Molecular Therapy (45-90 days course)\n\nPharmaceutical-grade plant compounds are applied topically using specialized techniques  manual application, wooden roller, and pulse therapy  in specific postural positions. This ensures deep dermal absorption of bio-active phytocompounds including curcuminoids, boswellic acids, withanolides, and gingerols directly to damaged nerves and muscle tissue. The [Cochrane Library](https://www.cochranelibrary.com/) has documented that topical phytotherapy can achieve comparable or superior outcomes for inflammatory conditions versus oral NSAIDs, with zero gastrointestinal side effects  and OPTM's 100% of patients stop harmful medication from day 1.\n\n### Step 4: Optimize  Movement RX (Ongoing)\n\nA doctor-prescribed movement plan rebuilds strength, corrects movement patterns, and prevents future injuries. Regular progress monitoring with objective metrics like Range of Motion (ROM) and Visual Analog Scale (VAS) pain indices ensures your recovery stays on track. 97% of patients show improved biomarkers within 60 days.\n\n[IMAGE 2: Step by step OPTM treatment protocol diagram showing Assess, Plan, Treat, Optimize stages]\n\n---\n\n## Evidence-Based Phytotherapy: 7 Healing Plants Backed by Clinical Research\n\nOPTM's evidence-based phytotherapy harnesses seven carefully selected medicinal plants, each with scientifically proven mechanisms validated by over 120 clinical studies.\n\n| Plant | Active Compound | Clinical Effect | Improvement |\n|:---|:---|:---|:---:|\n| Curcuma longa (Turmeric) | Curcuminoids | COX-2, IL-6 inhibition | Inflammation € 47% |\n| Boswellia serrata (Frankincense) | Boswellic Acids | MMP inhibition; cartilage protection | Joint mobility € 62% |\n| Withania somnifera (Ashwagandha) | Withanolides | Mitochondrial repair; cortisol normalization | Muscle mass € 82% |\n| Zingiber officinale (Ginger) | Gingerols | TRPV1 pain receptor blockade | Pain intensity € 40% |\n| Commiphora mukul (Guggul) | Guggulsterones | Synovial fluid production stimulation | Flexibility € 53% |\n| Trigonella foenum-graecum (Fenugreek) | Galactomannans | Metabolic optimization | Metabolic markers € 38% |\n| Tinospora cordifolia (Giloy) | Immunomodulatory compounds | Tissue regeneration; immune modulation | Healing rate € 45% |\n\n---\n\n## Real Patient Outcomes: What the Numbers Say About ${kwCap}\n\nThe clinical study conducted across OPTM centers in Delhi, Kolkata, and Panchkula between 2019-2024 delivered results that exceeded all projections.\n\n### Biomarker Normalization Rates  97% of Patients Improve Within 60 Days\n\n| Biomarker | Baseline (mg/L) | Post-Treatment (mg/L) | Improvement |\n|:---|:---:|:---:|:---:|\n| C-Reactive Protein (CRP) | 8.4 | 1.1 | 87% |\n| ESR | 52 | 12 | 77% |\n| MDA (Oxidative Stress) | 4.8 | 2.1 | 56% |\n| SOD (Antioxidant) | 98 | 172 | 76% |\n\n### Patient Outcome Statistics\n\n**94-97%** overall success rate in pain reduction and biomarker normalization (based on 100,000+ patients treated since 2011). Of patients who were told surgery was their only option, **89%** avoided it completely through the protocol.\n\n---\n\n## Frequently Asked Questions About Non-Surgical Pain Treatment\n\n**Q: How is OPTM different from other pain clinics?**\nA: Most clinics treat symptoms  they prescribe the same exercises or painkillers to everyone. OPTM starts with a 990 AI-powered biomarker test analyzing 60+ blood markers to identify the exact molecular root cause of YOUR pain.\n\n**Q: Is the treatment safe for long-term use?**\nA: Yes. 100% of OPTM patients stop harmful medications from day 1. The phyto-topical formulations contain zero steroids, zero synthetic drugs, and zero toxic chemicals.\n\n**Q: How long does it take to see results?**\nA: Most patients report noticeable pain reduction within 2-3 weeks. 97% show improved biomarkers within 60 days.\n\n**Q: I was recommended a knee replacement. Is it too late for me?**\nA: Patients between stage 1 and stage 3 knee osteoarthritis have the highest success rate  89% avoided knee replacement surgery.\n\n---\n\n## Your Next Step: Reclaim Mobility with ${formattedBrand}\n\nChronic pain is not an inevitable consequence of aging. It is a metabolic condition that can be reversed through the convergence of cutting-edge biomarker technology and evidence-based plant molecular therapy.\n\n[Schedule your biomarker assessment at ${formattedBrand}](https://${targetDomain}/) and discover the true molecular root cause of your pain.`;
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
 const brandName = target.split(".")[0];
 const services = targetPageInfo.services;
 const nicheKeywords = targetPageInfo.keywords;
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

 // Top 15 competitive set grounded in real niche (not random prefixes)
 const brandLabel = targetPageInfo.brand || brandName.charAt(0).toUpperCase() + brandName.slice(1);
 const discoveredCompetitors = buildIndustryCompetitors(
 target,
 brandLabel,
 targetPageInfo.niche,
 nicheKeywords
 );

 // Top 15 long-tail keywords derived from live site crawl / niche profile
 const keywordPool = nicheKeywords.slice(0, 15);
 while (keywordPool.length < 15) {
 keywordPool.push(`${brandLabel.toLowerCase()} ${["guide", "pricing", "alternatives", "setup", "review"][keywordPool.length % 5]}`);
 }
 const keywordList = keywordPool.map((kw, i) => ({
 keyword: kw,
 volume: Math.max(80, 2400 - i * 130 + (kw.length % 7) * 20),
 difficulty: Math.min(85, 22 + i * 4),
 cpc: parseFloat((1.1 + i * 0.22).toFixed(2)),
 intent: (i < 5 ? "Commercial" : i < 11 ? "Informational" : "Transactional") as "Commercial" | "Informational" | "Transactional",
 type: (kw.split(/\s+/).length >= 3 || kw.length >= 18 ? "Long-tail" : "Short-tail") as "Short-tail" | "Long-tail",
 competition: (i < 4 ? "High" : i < 10 ? "Medium" : "Low") as "Low" | "Medium" | "High",
 trend: (i < 6 ? "rising" : "stable") as "rising" | "stable" | "declining",
 serpRankings: [{ rank: 1, title: `${kw} | ${brandLabel}`, url: `https://${target}` }],
 relatedKeywords: keywordPool.filter((_, j) => j !== i).slice(0, 4),
 parentTopic: targetPageInfo.niche.split("&")[0].trim(),
 buyerJourneyStage: (i < 5 ? "Awareness" : i < 11 ? "Consideration" : "Decision") as
 | "Awareness"
 | "Consideration"
 | "Decision",
 opportunityScore: Math.max(12, 92 - i * 4),
 isPillarOpportunity: i < 5,
 }));

 const contentGaps = normalizeContentGaps(
 keywordPool.slice(0, 12).map((kw, i) => {
 const difficulty = Math.min(75, 16 + i * 5);
 const titleCase = kw.replace(/\b\w/g, (c) => c.toUpperCase());
 return {
 competitorKeyword: kw,
 competitorRank: 2 + (i % 8),
 competitorVolume: Math.max(90, 1800 - i * 110),
 competitorDifficulty: difficulty,
 targetRank: i % 3 === 0 ? "Not Ranking" : 12 + i * 3,
 recommendedTopic:
 i % 3 === 0
 ? `How to Master ${titleCase} Without Wasting Budget (2026 Guide)`
 : i % 3 === 1
 ? `${titleCase}: ${5 + (i % 4)} Proven Steps That Actually Work`
 : `Why Smart Teams Switch to ${titleCase} (And How to Start)`,
 recommendedType: i % 2 === 0 ? "Pillar Blog Post" : "Comparison Guide",
 difficultyCategory: difficulty < 30 ? "Easy" : difficulty < 55 ? "Medium" : "Hard",
 isQuickWin: difficulty < 38 && i < 6,
 };
 })
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
 query: `${nicheKeywords[0] || "clinic"} near me`,
 opportunity: "Win map pack visibility for local commercial intent.",
 actionability: "Optimize Google Business Profile categories, photos, and reviews.",
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
 targetAnalysis: {
 coreNiche: targetPageInfo.niche,
 audiencePersona: `People actively searching for ${targetPageInfo.niche} solutions related to ${brandLabel}`,
 contentStrengths: [
 targetPageInfo.scrapedPages > 0
 ? `Live crawl covered ${targetPageInfo.scrapedPages} page(s) on ${target}`
 : "Brand domain profile available",
 `Core offerings: ${(targetPageInfo.services || []).slice(0, 3).join(", ") || "primary services"}`,
 "Keyword map grounded in on-site language",
 ],
 contentWeaknesses: [
 "Limited long-tail blog coverage vs competitors",
 "Missing FAQ depth on commercial queries",
 "Internal linking between service and content pages can be stronger",
 ],
 detailedBreakdown: `${brandLabel} (${target}) operates in ${targetPageInfo.niche}. Site profile source: ${targetPageInfo.source}. ${targetPageInfo.description} Top demand themes: ${nicheKeywords.slice(0, 5).join("; ")}. Estimated DR ${targetMetrics.domainRating} with ~${(targetMetrics.organicTraffic / 1000).toFixed(0)}k monthly organic visits. Priority: publish long-tail pillar content and comparison pages that match real service language.`,
 },
 keywords: keywordList,
 contentGaps,
 siteProfile: {
 source: targetPageInfo.source,
 scrapedPages: targetPageInfo.scrapedPages,
 brand: brandLabel,
 niche: targetPageInfo.niche,
 headings: (targetPageInfo.headings || []).slice(0, 12),
 pageTitles: (targetPageInfo.pageTitles || []).slice(0, 8),
 },
 serpFeatures,
 backlinkSources,
 backlinkOpportunities,
 rankingBlueprint: {
 currentPosition: "Not in top 30 for primary keywords",
 targetPosition: "Top 10 for 5+ primary keywords within 90 days",
 summary: `${target.split(".")[0]} has a solid domain authority of ${targetMetrics.domainRating} but needs to close the gap with competitors via structured topical authority, backlink acquisition, and schema implementation.`,
 technicalSeo: [
 "Improve LCP below 2.5 seconds",
 "Add structured data (FAQPage, HowTo, LocalBusiness)",
 "Ensure mobile responsiveness across all pages",
 ],
 localSeo: [
 "Claim and verify Google Business Profile",
 "Build local citations on relevant directories",
 "Collect and respond to customer reviews",
 ],
 contentStrategy: [
 "Build topic clusters around primary service keywords",
 "Publish pillar pages for each core offering",
 "Create comparison content vs competitors",
 ],
 linkBuilding: [
 "Guest post on niche health/wellness publications",
 "Get listed on curated resource pages",
 "Build broken-link replacements on .edu and .org domains",
 ],
 timelineEstimate: "3-6 months for measurable ranking improvements",
 priorityActions: [
 { action: "Build topical authority clusters with internal hub pages", impact: "High" as const, effort: "Medium" as const, timeframe: "4-6 weeks" },
 { action: "Acquire contextual backlinks from niche academic & .org domains", impact: "High" as const, effort: "High" as const, timeframe: "8-12 weeks" },
 { action: "Optimize Core Web Vitals (LCP < 2.5s, CLS < 0.1)", impact: "Medium" as const, effort: "Low" as const, timeframe: "1-2 weeks" },
 { action: "Implement FAQPage & HowTo structured data for rich snippets", impact: "Medium" as const, effort: "Low" as const, timeframe: "1 week" },
 { action: "Publish 2-3 pillar articles targeting bottom-of-funnel commercial intents", impact: "High" as const, effort: "Medium" as const, timeframe: "3-4 weeks" },
 ],
 localKeywordsToTarget: [],
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
app.use(express.json({ limit: "1mb" }));

function socialFallback(
 platform: string,
 topic: string,
 keyword: string,
 domain: string,
 reason: string
) {
 const brand = domain.split(".")[0] || "Brand";
 const kw = keyword || topic || "SEO";
 return {
 platform: platform || "Twitter/X",
 content: `Discover how ${brand} approaches ${kw}.\n\n${topic || "Fresh insights"} for teams who care about organic growth.\n\nLearn more: https://${domain}`,
 hashtags: [kw.replace(/\s+/g, ""), "SEO", "ContentMarketing"].filter(Boolean),
 optimalPostingTime: "Tue-Thu 9-11am local",
 engagementStrategy: "Ask a question in the first line and reply to comments within 1 hour.",
 seoNotes: `Primary keyword: ${kw}`,
 isFallback: true,
 fallbackReason: reason,
 };
}

app.get("/api/health", (_req, res) => {
 res.json({
 status: "ok",
 timestamp: new Date().toISOString(),
 node: process.version,
 env: process.env.NODE_ENV || "not set",
 distExists: fs.existsSync(path.join(process.cwd(), "dist")),
 vercel: process.env.VERCEL || null,
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

  // ── DataForSEO real data enrichment (BYOK from user or server-side env) ──
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
      console.log(`[DataForSEO] Fetched real data for ${domain}: ${dfseoData.rawSerpItems.length} SERP items, ${dfseoData.keywordLandscape.length} keywords, ${dfseoData.backlinks.total_backlinks} backlinks`);
    } catch (err: unknown) {
      console.error("[DataForSEO] Bundle fetch failed, falling back to AI/simulated data:", err instanceof Error ? err.message : err);
      dfseoData = null;
    }
  }

  const providerConfig = getProviderConfig(req);

  // ── No AI key AND no DataForSEO → demo fallback ──
  if (!providerConfig && !dfseoData) {
    return res.json(
      sanitizeDeep({
        ...base,
        contentGaps: normalizeContentGaps(base.contentGaps),
        isFallback: true,
        needsApiKey: true,
        dataSource: "simulated",
        fallbackReason:
          "Demo data only. Open Settings and add your own AI API key, or configure DataForSEO credentials for real SEO data.",
      })
    );
  }

  // ── DataForSEO available (with or without AI key) ──
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
      // Real backlinks mapped to UI BacklinkSource shape
      backlinkSources: dfseoData.backlinks.top_referring_domains.length > 0
        ? dfseoData.backlinks.top_referring_domains.slice(0, 8).map((b) => ({
            sourceUrl: b.source_url || `https://${b.source_domain}/`,
            domainRating: b.domain_rating || 40,
            targetUrl: `https://${domain}/`,
            anchorText: b.anchor || domain,
            linkType: "Follow" as const,
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

    // If AI key is also available, let AI enrich with gaps/blueprint on top of real data
    if (providerConfig) {
      try {
        const prompt = `Quick SEO enrichment for "${domain}" using real DataForSEO data.
Real metrics: ${JSON.stringify({
          backlinks: dfseoData.backlinks.total_backlinks,
          referringDomains: dfseoData.backlinks.referring_domains,
          domainRating: dfseoData.backlinks.domain_rating,
          topKeywords: dfseoData.keywordLandscape.slice(0, 5).map((k) => k.keyword),
          serpTop3: dfseoData.serp.organic.slice(0, 3).map((r) => r.title),
        })}.
Return compact JSON: { contentGaps[{competitorKeyword,competitorRank,competitorVolume,competitorDifficulty,targetRank,recommendedTopic,recommendedType,difficultyCategory,isQuickWin}], rankingBlueprint{summary,priorityActions[{action,impact,effort,timeframe}],timelineEstimate}, discoveredCompetitors[{domain,overlapScore,threatLevel}] }.
contentGaps: 5-8 rows. targetRank number or "Not Ranking". difficultyCategory Easy|Medium|Hard. competitorVolume monthly searches. competitorDifficulty 1-100.
ASCII only. JSON only.`;

        const fastConfig: ProviderConfig = {
          ...providerConfig,
          apiModel: providerConfig.provider === "gemini" ? "gemini-2.5-flash-lite" : providerConfig.apiModel,
        };

        const result = await withTimeout(
          callAI(fastConfig, prompt, "Valid compact JSON only. No fences.", {
            responseMimeType: "application/json",
            temperature: 0.15,
            maxOutputTokens: 2000,
          }),
          10000,
          "AI enrichment"
        );
        const parsed = cleanAndParseJSON(result.text);
        enriched.contentGaps = normalizeContentGaps(
          parsed.contentGaps,
          (base.keywords || []).map((k: any) => k.keyword).filter(Boolean)
        );
        if (!enriched.contentGaps.length) enriched.contentGaps = base.contentGaps;
        enriched.rankingBlueprint = parsed.rankingBlueprint || base.rankingBlueprint;
        enriched.discoveredCompetitors = Array.isArray(parsed.discoveredCompetitors) && parsed.discoveredCompetitors.length
          ? parsed.discoveredCompetitors
          : base.discoveredCompetitors;
        enriched.dataSource = "dataforseo+ai";
      } catch {
        // AI enrichment failed — DataForSEO data is still valuable
        enriched.contentGaps = normalizeContentGaps(base.contentGaps);
      }
    } else {
      // No AI key: still normalize gaps from baseline
      enriched.contentGaps = normalizeContentGaps(base.contentGaps || enriched.contentGaps);
    }

    return res.json(sanitizeDeep(enriched));
  }

  // ── AI-only path (no DataForSEO) — original behavior ──
  try {
    const siteCtx = {
      niche: base.targetAnalysis?.coreNiche,
      brand: base.siteProfile?.brand || domain.split(".")[0],
      scrapedPages: base.siteProfile?.scrapedPages,
      source: base.siteProfile?.source,
      seedKeywords: (base.keywords || []).slice(0, 10).map((k: any) => k.keyword),
      services: (base.target?.topPages || []).slice(0, 5).map((p: any) => p.title),
      snippet: (base.targetAnalysis?.detailedBreakdown || "").slice(0, 400),
    };
    const prompt = `SEO competitive analysis for LIVE website https://${domain}/${competitorUrl ? ` vs competitor https://${cleanDomain(competitorUrl)}/` : ""}.
Site context from crawl (MUST stay on-niche; do not invent unrelated industries):
${JSON.stringify(siteCtx)}

Return compact JSON with:
- keywords: exactly 15 LONG-TAIL keywords highly relevant to this business (3-7 words each, commercial + informational mix). volume,difficulty,cpc,intent,type,opportunityScore
- contentGaps: 10 items with competitorKeyword,competitorRank,competitorVolume,competitorDifficulty,targetRank,recommendedTopic (click-worthy long-tail title),recommendedType,difficultyCategory,isQuickWin
- discoveredCompetitors: exactly 15 industry peers/similar businesses with domain,nicheSimilarity,nicheFocus,estimatedMonthlyTraffic,analyzedTakeaway,targetKeywords[]
- targetAnalysis{coreNiche,audiencePersona,contentStrengths[],contentWeaknesses[],detailedBreakdown}
- rankingBlueprint{summary,priorityActions[{action,impact,effort,timeframe}],timelineEstimate}
- serpFeatures(4), backlinkSources(4), backlinkOpportunities(3) optional
Keep numbers realistic. ASCII only. JSON only. No off-topic keywords.`;

    // Prefer flash-lite for analysis speed (user can still set a custom model in Settings)
    const fastConfig: ProviderConfig = {
      ...providerConfig,
      apiModel:
        providerConfig.provider === "gemini"
          ? "gemini-2.5-flash-lite"
          : providerConfig.apiModel,
    };

    const result = await withTimeout(
      callAI(fastConfig, prompt, "Valid compact JSON only. No fences. ASCII punctuation. Stay on-niche.", {
        responseMimeType: "application/json",
        temperature: 0.2,
        maxOutputTokens: 5000,
      }),
      22000,
      "SEO analysis"
    );
    const parsed = cleanAndParseJSON(result.text);
    const autonomous =
      parsed.autonomousBlog
        ? normalizeBlogPayload(parsed.autonomousBlog, domain, base.keywords?.[0]?.keyword || "services")
        : base.autonomousBlog;
    const kwFallback = (base.keywords || []).map((k: any) => k.keyword).filter(Boolean);
    const gaps = normalizeContentGaps(
      Array.isArray(parsed.contentGaps) && parsed.contentGaps.length ? parsed.contentGaps : base.contentGaps,
      kwFallback
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
        contentGaps: gaps.length ? gaps : normalizeContentGaps(base.contentGaps, kwFallback),
        serpFeatures: Array.isArray(parsed.serpFeatures) && parsed.serpFeatures.length ? parsed.serpFeatures : base.serpFeatures,
        backlinkSources: Array.isArray(parsed.backlinkSources) && parsed.backlinkSources.length ? parsed.backlinkSources : base.backlinkSources,
        backlinkOpportunities:
          Array.isArray(parsed.backlinkOpportunities) && parsed.backlinkOpportunities.length
            ? parsed.backlinkOpportunities
            : base.backlinkOpportunities,
        discoveredCompetitors:
          Array.isArray(parsed.discoveredCompetitors) && parsed.discoveredCompetitors.length >= 8
            ? parsed.discoveredCompetitors.slice(0, 15)
            : base.discoveredCompetitors,
        siteProfile: base.siteProfile,
        autonomousBlog: autonomous,
        dataSource: "ai",
        isFallback: false,
      })
    );
  } catch (err: unknown) {
    const message = redactSecrets(err instanceof Error ? err.message : String(err));
    console.error("Analyze error:", message);
    res.json(
      sanitizeDeep({
        ...base,
        contentGaps: normalizeContentGaps(base.contentGaps),
        isFallback: true,
        dataSource: "simulated",
        errorMsg: message.includes("timed out")
          ? "Live AI timed out. Showing fast structured analysis instead."
          : message,
      })
    );
  }
  } catch (fatal: unknown) {
    // Never 500 an empty body — always return usable baseline
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
 wordCount = 1200,
 audience = "",
 tone = "",
 variationSeed,
 regenerateToken,
 } = req.body || {};
 if (!domain || domain === "target-website.com") {
 return res.status(400).json({ error: "Target URL / domain is required." });
 }
 const kw = (keyword || topic || "quality services") as string;
 // Unique seed every request so regenerations never clone the last draft
 const seed =
 Number(variationSeed) ||
 Number(regenerateToken) ||
 (Date.now() ^ Math.floor(Math.random() * 1e9));
 const strategy = pickStrategy(seed);
 const providerConfig = getProviderConfig(req);

 // No API key: still return a FRESH unique high-readability article (not a static demo clone)
 if (!providerConfig) {
 const unique = buildUniqueArticle({
 domain,
 kw,
 topic: topic || kw,
 seed,
 audience,
 tone,
 });
 const normalized = normalizeBlogPayload(unique, domain, kw, seed);
 return res.json({
 ...normalized,
 isFallback: true,
 needsApiKey: true,
 strategyId: strategy.id,
 variationSeed: seed,
 fallbackReason:
 "Unique structured draft generated offline. Add your AI API key in Settings for fully original AI-written articles each time.",
 });
 }

 try {
 const secondary = Array.isArray(secondaryKeywords)
 ? secondaryKeywords.filter(Boolean).join(", ")
 : String(secondaryKeywords || "");
 const targetWords = Math.max(900, Math.min(1400, Number(wordCount) || 1200));
 const brand = domain.split(".")[0] || "the brand";
 // Live site context so article stays relevant to the real business
 let siteBrief: any = null;
 try {
  siteBrief = await withTimeout(fetchPageSummary(domain), 10000, "Blog site crawl");
 } catch {
  siteBrief = null;
 }
 const brandName = siteBrief?.brand || brand;
 const userPrompt = `Write a BRAND-NEW highly engaging, SEO-optimized article as JSON for https://${domain}/

TARGET SITE CONTEXT (must stay on-niche — write as if you researched this company):
${JSON.stringify({
  brand: brandName,
  niche: siteBrief?.niche,
  description: siteBrief?.description?.slice?.(0, 350),
  services: (siteBrief?.services || []).slice(0, 6),
  relatedKeywords: (siteBrief?.keywords || []).slice(0, 8),
  source: siteBrief?.source,
  scrapedPages: siteBrief?.scrapedPages,
})}

UNIQUE RUN ID: ${seed}
REQUIRED STRATEGY THIS RUN: ${strategy.style} (id: ${strategy.id})
Suggested title seed (improve into a clickable long-tail SEO title): ${strategy.titlePrefix(kw)}
Suggested H2 themes (rewrite in your own words): ${strategy.heads(kw, brandName).join(" | ")}

Primary long-tail keyword: ${kw}
Topic: ${topic || kw}
Secondary keywords: ${secondary || (siteBrief?.keywords || []).slice(1, 5).join(", ") || "related practical terms"}
Target length: about ${targetWords} words total
Audience: ${audience || `people researching ${siteBrief?.niche || "solutions"} from ${brandName}`}
Tone: ${tone || "clear, practical, confident, engaging"}
Brand: ${brandName}

TITLE MUST:
- Be a high-traffic style LONG-TAIL phrase (not a single word)
- Be catchy and click-worthy (curiosity + benefit) without false claims
- Put the primary keyword near the start
- Ideally 50-70 characters

HARD RULES FOR THIS RUN:
- Article must be relevant to ${brandName} / ${domain} and the niche above.
- Completely different title, outline, examples from any prior draft.
- Flesch-friendly prose: sentences 12-18 words, simple words, active voice.
- Highly engaging: concrete examples, short stories, checklists, bold takeaways.
- Sectioned fields only (intro, keyTakeaways, sections, faqSection, conclusion).
- Include one markdown table in a section body.
- Include 3+ internal links to https://${domain}/... and 2+ reputable external links.
- CTA should feel natural for ${brandName}.
- ASCII only. No schemaMarkup field.
Return ONLY the JSON object from the system prompt.`;

 const result = await withTimeout(
 callAI(providerConfig, userPrompt, SEO_BLOG_SYSTEM_PROMPT, {
 responseMimeType: "application/json",
 temperature: 0.85,
 maxOutputTokens: 6144,
 }),
 45000,
 "Blog generation"
 );
 const parsed = cleanAndParseJSON(result.text);
 parsed.strategyId = strategy.id;
 parsed.variationSeed = seed;
 let normalized = normalizeBlogPayload(parsed, domain, kw, seed);
 if (!normalized.content || normalized.content.length < 300) {
 const unique = buildUniqueArticle({ domain, kw, topic: topic || kw, seed: seed + 17, audience, tone });
 normalized = {
 ...normalizeBlogPayload(unique, domain, kw, seed + 17),
 isFallback: true,
 fallbackReason: "AI returned incomplete content. Showing a fresh structured draft instead.",
 strategyId: unique.strategyId,
 variationSeed: seed + 17,
 };
 return res.json(normalized);
 }
 res.json({ ...normalized, strategyId: strategy.id, variationSeed: seed });
 } catch (err: unknown) {
 const message = redactSecrets(err instanceof Error ? err.message : String(err));
 console.error("Blog error:", message);
 const unique = buildUniqueArticle({
 domain,
 kw,
 topic: topic || kw,
 seed: seed + 31,
 audience,
 tone,
 });
 const normalized = normalizeBlogPayload(unique, domain, kw, seed + 31);
 return res.json({
 ...normalized,
 isFallback: true,
 strategyId: unique.strategyId,
 variationSeed: seed + 31,
 fallbackReason: message.includes("timed out")
 ? "AI timed out. Showing a fresh unique draft you can edit. Regenerate for another strategy."
 : `AI issue: ${message}. Showing a fresh unique draft. Regenerate for a new angle.`,
 });
 }
});

app.post("/api/generate-social", async (req, res) => {
 const domain = resolveDomain(req.body);
 const { keyword = "", topic = "", platform = "Twitter/X", audience = "", contentGoal = "", brandVoice = "" } = req.body || {};
 if (!domain || domain === "target-website.com") {
 return res.status(400).json({ error: "Target URL / domain is required." });
 }
 const providerConfig = getProviderConfig(req);
 if (!providerConfig) {
 return res.status(401).json({
 error: "API key required",
 isFallback: true,
 needsApiKey: true,
 fallbackReason:
 "Add your own AI API key in Settings. No shared keys are stored on the server.",
 });
 }
 try {
 const prompt = `Write one high-quality social media post for platform "${platform}" promoting content about "${topic || keyword || "SEO services"}" for website "${domain}".
Audience: ${audience || "professionals"}
Goal: ${contentGoal || "drive clicks"}
Brand voice: ${brandVoice || "clear and confident"}
Primary keyword: ${keyword || topic}

Hook in the first line. Platform-native length and style. Include a soft CTA to https://${domain}/.
Return ONLY JSON object (not an array) with:
platform, content, hashtags (string array), optimalPostingTime, engagementStrategy, seoNotes.`;
 const result = await callAI(providerConfig, prompt, "", { responseMimeType: "application/json", temperature: 0.4 });
 const parsed = cleanAndParseJSON(result.text);
 if (parsed.posts && Array.isArray(parsed.posts) && parsed.posts.length > 0) {
 const match = parsed.posts.find((p: { platform?: string }) => p.platform === platform) || parsed.posts[0];
 return res.json(match);
 }
 res.json(parsed);
 } catch (err: unknown) {
 const message = redactSecrets(err instanceof Error ? err.message : String(err));
 res.status(502).json({
 error: "Social generation failed",
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
 // Demo-only synthetic SERP audit — never uses a server-owned key
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

app.post("/api/generate-meta-snippets", async (req, res) => {
 const domain = resolveDomain(req.body);
 const { keyword = "SEO services", content = "", articleTitle = "" } = req.body || {};
 if (!domain || domain === "target-website.com") {
 return res.status(400).json({ error: "Target URL / domain is required." });
 }
 const providerConfig = getProviderConfig(req);
 if (!providerConfig) {
 return res.status(401).json({
 error: "API key required",
 isFallback: true,
 needsApiKey: true,
 snippets: [],
 fallbackReason:
 "Add your own AI API key in Settings. No shared keys are stored on the server.",
 });
 }
 try {
 const excerpt = typeof content === "string" ? content.slice(0, 1500) : "";
 const prompt = `Generate 5 high-CTR SEO meta title and description variants for a page on "${domain}".
Primary keyword: "${keyword}"
Article title: "${articleTitle}"
Content excerpt: """${excerpt}"""

Rules: titles max 60 chars with keyword near start; descriptions 140–155 chars with benefit + soft CTA; no clickbait.
Return ONLY JSON: { "snippets": [ { "type": "default|question|benefit|how-to|list", "title": "...", "description": "..." } ] }`;
 const result = await callAI(providerConfig, prompt, "", { responseMimeType: "application/json", temperature: 0.3 });
 const parsed = cleanAndParseJSON(result.text);
 if (Array.isArray(parsed)) return res.json({ snippets: parsed });
 res.json(parsed);
  } catch (err: unknown) {
    const message = redactSecrets(err instanceof Error ? err.message : String(err));
    res.status(502).json({ isFallback: true, fallbackReason: message, snippets: [] });
  }
});

// ============================================================
// DataForSEO Real-Time Endpoints (BYOK or server-side API key)
// ============================================================

function extractDfsCredentials(req: { body?: Record<string, unknown> }): DfsCredentials | undefined {
  const body = req.body ?? {};
  const login = body.dataforseoLogin as string | undefined;
  const password = body.dataforseoPassword as string | undefined;
  if (login && password) return { login, password };
  return undefined;
}

function hasDfsAccess(req: { body?: Record<string, unknown> }): boolean {
  return Boolean(extractDfsCredentials(req) || HAS_DFSEO);
}

app.post("/api/seo/keyword-volume", async (req, res) => {
  if (!hasDfsAccess(req)) {
    return res.status(503).json({ error: "DataForSEO credentials not configured. Add them in Settings." });
  }
  const { keywords = [], locationCode = 2840, languageCode = "en" } = req.body || {};
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
  const { keyword = "", locationCode = 2840, languageCode = "en" } = req.body || {};
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
  const { domain = "", locationCode = 2840, languageCode = "en" } = req.body || {};
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
  const { domain = "", limit = 100, locationCode = 2840, languageCode = "en" } = req.body || {};
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