/** Phrase-level keyword density + heatmap metrics for article drafts. */

export function getPhraseCount(fullText: string, phrase: string): number {
  if (!phrase || !phrase.trim()) return 0;
  const cleanPhrase = phrase
    .trim()
    .toLowerCase()
    .replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  try {
    const startBoundary = /^\w/.test(phrase.trim()) ? "\\b" : "";
    const endBoundary = /\w$/.test(phrase.trim()) ? "\\b" : "";
    const regex = new RegExp(`${startBoundary}${cleanPhrase}${endBoundary}`, "gi");
    const matches = fullText.match(regex);
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

export interface KeywordDensityMetrics {
  paragraphs: Array<{
    index: number;
    text: string;
    preview: string;
    wordCount: number;
    primaryCount: number;
    secondaryCount: number;
    totalKeywordsCount: number;
    density: number;
    heatLevel: number;
    keywordsFound: string[];
  }>;
  primaryMetrics: {
    count: number;
    density: number;
    status: string;
    color: string;
  };
  secondaryMetrics: Array<{
    keyword: string;
    count: number;
    density: number;
    status: string;
    color: string;
  }>;
  totalWords: number;
}

export function computeKeywordDensityMetrics(
  text: string,
  primaryKeyword: string,
  secondaryKeywords: string[]
): KeywordDensityMetrics {
  if (!text) {
    return {
      paragraphs: [],
      primaryMetrics: {
        count: 0,
        density: 0,
        status: "Under-optimized",
        color: "text-slate-400 bg-slate-50 border-slate-200",
      },
      secondaryMetrics: [],
      totalWords: 0,
    };
  }

  const words = text.toLowerCase().match(/\b[a-z']+\b/g) || [];
  const totalWords = words.length || 1;

  const primary = primaryKeyword ? primaryKeyword.trim() : "";
  const primaryCount = getPhraseCount(text, primary);
  const primaryWordCount = primary ? primary.split(/\s+/).length : 1;
  const primaryDensity =
    totalWords > 0 ? ((primaryCount * primaryWordCount) / totalWords) * 100 : 0;

  let primaryStatus = "Under-optimized";
  let primaryColor = "text-amber-600 bg-amber-50 border-amber-200";
  if (primaryCount > 0) {
    if (primaryDensity < 0.8) {
      primaryStatus = "Under-optimized (Below 0.8%)";
      primaryColor = "text-amber-600 bg-amber-50 border-amber-200";
    } else if (primaryDensity <= 2.5) {
      primaryStatus = "Optimal Density (0.8% - 2.5%)";
      primaryColor = "text-emerald-700 bg-emerald-50 border-emerald-200";
    } else {
      primaryStatus = "Over-optimized (> 2.5%)";
      primaryColor = "text-rose-700 bg-rose-50 border-rose-200";
    }
  }

  const secondaryMetrics = secondaryKeywords.map((kw) => {
    const kwTrimmed = kw.trim();
    const count = getPhraseCount(text, kwTrimmed);
    const kwWordCount = kwTrimmed ? kwTrimmed.split(/\s+/).length : 1;
    const density = totalWords > 0 ? ((count * kwWordCount) / totalWords) * 100 : 0;

    let status = "Under-optimized";
    let color = "text-blue-600 bg-blue-50 border-blue-200";
    if (count > 0) {
      if (density < 0.4) {
        status = "Under-optimized";
        color = "text-blue-500 bg-blue-50 border-blue-100";
      } else if (density <= 1.8) {
        status = "Optimal Density";
        color = "text-emerald-700 bg-emerald-50 border-emerald-200";
      } else {
        status = "Over-optimized";
        color = "text-rose-700 bg-rose-50 border-rose-200";
      }
    }

    return { keyword: kw, count, density, status, color };
  });

  const rawBlocks = text.split(/\n\s*\n+/);
  const paragraphs: KeywordDensityMetrics["paragraphs"] = [];
  let pIndex = 0;

  rawBlocks.forEach((block) => {
    const trimmed = block.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("![") || trimmed.startsWith("[IMAGE")) {
      return;
    }

    const pWords = trimmed.toLowerCase().match(/\b[a-z']+\b/g) || [];
    const pWordCount = pWords.length;
    if (pWordCount < 5) return;

    const pPrimaryCount = getPhraseCount(trimmed, primary);
    let pSecondaryCount = 0;
    const foundKws: string[] = [];
    if (pPrimaryCount > 0) foundKws.push(`Primary: "${primary}" (${pPrimaryCount}x)`);

    secondaryKeywords.forEach((kw) => {
      const count = getPhraseCount(trimmed, kw);
      if (count > 0) {
        pSecondaryCount += count;
        foundKws.push(`Secondary: "${kw}" (${count}x)`);
      }
    });

    const totalKws = pPrimaryCount + pSecondaryCount;
    const density =
      pWordCount > 0
        ? ((pPrimaryCount * primaryWordCount + pSecondaryCount * 1.5) / pWordCount) * 100
        : 0;

    let heatLevel = 0;
    if (totalKws === 1) heatLevel = 1;
    else if (totalKws === 2) heatLevel = 2;
    else if (totalKws >= 3) heatLevel = 3;

    paragraphs.push({
      index: pIndex++,
      text: trimmed,
      preview: trimmed.substring(0, 120) + (trimmed.length > 120 ? "..." : ""),
      wordCount: pWordCount,
      primaryCount: pPrimaryCount,
      secondaryCount: pSecondaryCount,
      totalKeywordsCount: totalKws,
      density,
      heatLevel,
      keywordsFound: foundKws,
    });
  });

  return {
    paragraphs,
    primaryMetrics: {
      count: primaryCount,
      density: primaryDensity,
      status: primaryStatus,
      color: primaryColor,
    },
    secondaryMetrics,
    totalWords,
  };
}
