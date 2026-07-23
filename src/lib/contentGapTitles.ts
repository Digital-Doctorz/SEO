/**
 * High-CTR, keyword-first, localised content-gap titles.
 * Used by normalizeAnalysis + Content Gaps UI so every tile H1 is
 * traffic-ready (not generic "Complete Guide to…").
 */

export type GapTitleIntent =
  | "near_me"
  | "cost"
  | "how_to"
  | "best_list"
  | "comparison"
  | "reviews"
  | "booking"
  | "local_guide"
  | "question";

export interface OptimizedGapTitle {
  /** Full recommended H1 / article title */
  title: string;
  /** ~50–60 char SERP-style title for preview */
  serpTitle: string;
  /** Short pitch under the title */
  angle: string;
  formula: GapTitleIntent;
  /** 0–100 composite of volume + KD ease + local CTR signals */
  trafficPotentialScore: number;
  city: string;
}

import { KOLKATA_CITY } from "./geo";

const DEFAULT_CITY = KOLKATA_CITY;
const YEAR = new Date().getFullYear();

const WEAK_TITLE_RE =
  /^(complete guide to|guide to|everything about|all about|introduction to|overview of)\b/i;

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => {
      if (!w) return w;
      if (/^(a|an|the|in|on|of|for|and|or|to|vs|near|me)$/i.test(w) && w.length <= 3) {
        return w.toLowerCase();
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function cleanKeyword(raw: string): string {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .replace(/[“”"']/g, "")
    .trim();
}

/** True if keyword already contains a clear geo modifier. */
export function keywordHasGeo(kw: string, city: string): boolean {
  const k = kw.toLowerCase();
  const c = city.toLowerCase();
  if (!c) return /\bnear me\b|\bin\s+[a-z]{3,}/i.test(k);
  return (
    k.includes(c) ||
    /\bnear me\b/i.test(k) ||
    /\b(west bengal|salt lake|new town|howrah|park street)\b/i.test(k)
  );
}

function detectIntent(keyword: string): GapTitleIntent {
  const k = keyword.toLowerCase();
  if (/\bnear me\b|\bnearby\b|\bclose to me\b/.test(k)) return "near_me";
  if (/\b(cost|price|pricing|fees?|charges?|rate)\b/.test(k)) return "cost";
  if (/\b(how to|how do|how can|steps? to)\b/.test(k)) return "how_to";
  if (/\b(best|top \d+|top)\b/.test(k)) return "best_list";
  if (/\b(vs|versus|alternative|compare|comparison)\b/.test(k)) return "comparison";
  if (/\b(review|reviews|rating|ratings)\b/.test(k)) return "reviews";
  if (/\b(book|appointment|consult|schedule|visit)\b/.test(k)) return "booking";
  if (/\?|^(what|why|when|where|who|which|is|are|can|should)\b/.test(k)) return "question";
  return "local_guide";
}

function stripLeadingBoilerplate(title: string): string {
  return title.replace(WEAK_TITLE_RE, "").trim() || title;
}

function clipSerp(title: string, max = 58): string {
  const t = title.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 28 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

/**
 * Build a catchy, keyword-fronted, localised title.
 * Always embeds primary keyword early for SEO; city when it boosts local CTR.
 */
export function buildOptimizedGapTitle(
  keywordRaw: string,
  opts: {
    city?: string;
    brand?: string;
    volume?: number;
    difficulty?: number;
    index?: number;
    existingTitle?: string;
    forceRebuild?: boolean;
  } = {}
): OptimizedGapTitle {
  const keyword = cleanKeyword(keywordRaw);
  const city = (opts.city || DEFAULT_CITY).trim() || DEFAULT_CITY;
  const brand = (opts.brand || "").trim();
  const i = opts.index ?? 0;
  const volume = Math.max(0, Number(opts.volume) || 0);
  const difficulty = Math.max(1, Math.min(100, Number(opts.difficulty) || 40));
  const intent = detectIntent(keyword);
  const hasGeo = keywordHasGeo(keyword, city);
  const kwDisplay = titleCase(keyword);
  const core = hasGeo ? kwDisplay : kwDisplay; // keyword always primary

  // Reuse a strong AI title if it already includes the keyword and isn't weak boilerplate
  const existing = stripLeadingBoilerplate(String(opts.existingTitle || "").trim());
  const existingLc = existing.toLowerCase();
  const kwLc = keyword.toLowerCase();
  const existingIsStrong =
    !opts.forceRebuild &&
    existing.length >= 28 &&
    existing.length <= 90 &&
    existingLc.includes(kwLc.split(/\s+/).slice(0, 3).join(" ")) &&
    !WEAK_TITLE_RE.test(String(opts.existingTitle || "")) &&
    !/complete guide to/i.test(existing);

  let title: string;
  let formula: GapTitleIntent = intent;
  let angle: string;

  if (existingIsStrong) {
    title = existing;
    // Prefer injecting city if missing and local intent
    if (!hasGeo && !existingLc.includes(city.toLowerCase()) && intent !== "question") {
      if (existing.length < 55) {
        title = `${existing} in ${city}`;
      }
    }
    angle = `Keyword-led H1 kept from analysis; tuned for ${city} local demand.`;
  } else {
    // Rotate high-CTR formulas — all front-load keyword for SEO
    switch (intent) {
      case "near_me":
        title = hasGeo
          ? `${core}: Top-Rated Options in ${city} (${YEAR})`
          : `${core} Near Me in ${city}: Top-Rated Options (${YEAR})`;
        formula = "near_me";
        angle = "Map Pack + “near me” intent — high conversion local traffic.";
        break;
      case "cost":
        title = hasGeo
          ? `${core}: What ${city} Locals Actually Pay (${YEAR})`
          : `${core} in ${city}: Real Prices & What Affects Cost (${YEAR})`;
        formula = "cost";
        angle = "Commercial cost queries convert; price clarity wins clicks.";
        break;
      case "how_to":
        title = hasGeo
          ? `${core}: Step-by-Step Guide for ${city}`
          : `How to Get ${core} in ${city}: Step-by-Step (${YEAR})`;
        formula = "how_to";
        angle = "Informational → transactional ladder with clear steps.";
        break;
      case "best_list":
        title = hasGeo
          ? `${core}: Expert Picks for ${city} (${YEAR})`
          : `Best ${core} in ${city} (${YEAR}): Compared & Ranked`;
        formula = "best_list";
        angle = "Listicle CTR — “best” + year + city = high SERP clicks.";
        break;
      case "comparison":
        title = hasGeo
          ? `${core}: Honest Comparison for ${city} Buyers`
          : `${core}: Which Option Wins in ${city}?`;
        formula = "comparison";
        angle = "Mid-funnel comparison captures switcher traffic.";
        break;
      case "reviews":
        title = hasGeo
          ? `${core}: Real ${city} Reviews & Ratings (${YEAR})`
          : `${core} Reviews in ${city}: What Patients Actually Say`;
        formula = "reviews";
        angle = "Review intent = trust + booking proximity.";
        break;
      case "booking":
        title = hasGeo
          ? `${core}: Book Faster in ${city} (${YEAR})`
          : `Book ${core} in ${city}: Same-Week Options & Tips`;
        formula = "booking";
        angle = "Transactional booking language for bottom-funnel wins.";
        break;
      case "question":
        title = hasGeo
          ? `${core} — Clear Answer for ${city} Searchers`
          : `${kwDisplay}? Answered for ${city} (${YEAR})`;
        formula = "question";
        angle = "PAA / featured-snippet style — answer-first H1.";
        break;
      default: {
        // local_guide — rotate 4 catchy patterns by index
        const patterns = [
          () =>
            hasGeo
              ? `${core}: Complete Local Guide (${YEAR})`
              : `${core} in ${city}: Complete Local Guide (${YEAR})`,
          () =>
            hasGeo
              ? `${core}: What ${city} Families Should Know`
              : `${core} in ${city}: What Locals Should Know First`,
          () =>
            hasGeo
              ? `${core} — Trusted ${city} Resource (${YEAR})`
              : `Trusted ${core} in ${city}: How to Choose Wisely`,
          () =>
            hasGeo
              ? `${core}: From First Search to Booked Visit`
              : `${core} ${city}: From First Search to Booked Visit`,
        ];
        title = patterns[i % patterns.length]();
        formula = "local_guide";
        angle = "Local pillar angle — geo + keyword for sustained organic growth.";
        break;
      }
    }

    // Optional brand soft mention for brand SERP affinity (not forced)
    if (brand && title.length < 52 && i % 5 === 0 && !title.toLowerCase().includes(brand.toLowerCase())) {
      title = `${title} | ${brand}`;
    }
  }

  // Hard length guard for H1 (SEO best practice ~50–70 preferred, allow up to 90)
  if (title.length > 88) {
    title = clipSerp(title, 86).replace(/…$/, "");
  }

  // Ensure keyword (or first 2 tokens) appears in title
  const firstTokens = kwLc.split(/\s+/).slice(0, 2).join(" ");
  if (firstTokens && !title.toLowerCase().includes(firstTokens) && keyword.length < 40) {
    title = `${kwDisplay}: ${title}`;
    if (title.length > 88) title = clipSerp(title, 86).replace(/…$/, "");
  }

  const serpTitle = clipSerp(title, 58);

  // Traffic potential: volume weight + ease (low KD) + local/CTR formula bonus
  const volScore = Math.min(45, Math.log10(Math.max(volume, 10) + 1) * 14);
  const easeScore = Math.max(0, 35 - difficulty * 0.35);
  const formulaBonus =
    formula === "near_me" || formula === "cost" || formula === "best_list"
      ? 14
      : formula === "booking" || formula === "reviews"
        ? 12
        : formula === "how_to"
          ? 10
          : 8;
  const geoBonus = hasGeo || title.toLowerCase().includes(city.toLowerCase()) ? 8 : 0;
  const trafficPotentialScore = Math.round(
    Math.max(12, Math.min(99, volScore + easeScore + formulaBonus + geoBonus))
  );

  return {
    title,
    serpTitle,
    angle,
    formula,
    trafficPotentialScore,
    city,
  };
}

/** Soft rewrite of a weak recommendedTopic; keeps strong titles. */
export function ensureOptimizedGapTitle(
  keyword: string,
  existingTitle: string | undefined,
  opts: {
    city?: string;
    brand?: string;
    volume?: number;
    difficulty?: number;
    index?: number;
  } = {}
): OptimizedGapTitle {
  const weak =
    !existingTitle ||
    WEAK_TITLE_RE.test(existingTitle) ||
    existingTitle.trim().length < 20 ||
    !existingTitle.toLowerCase().includes(cleanKeyword(keyword).toLowerCase().split(/\s+/)[0] || "");

  return buildOptimizedGapTitle(keyword, {
    ...opts,
    existingTitle,
    forceRebuild: weak,
  });
}

export function trafficLabel(score: number): "High" | "Medium" | "Steady" {
  if (score >= 72) return "High";
  if (score >= 48) return "Medium";
  return "Steady";
}

export function formulaLabel(f: GapTitleIntent): string {
  const map: Record<GapTitleIntent, string> = {
    near_me: "Near Me / Map Pack",
    cost: "Cost / Commercial",
    how_to: "How-To / Steps",
    best_list: "Best-Of List",
    comparison: "Comparison",
    reviews: "Reviews / Trust",
    booking: "Booking / Convert",
    local_guide: "Local Pillar",
    question: "Q&A / Snippet",
  };
  return map[f] || "Local Pillar";
}
