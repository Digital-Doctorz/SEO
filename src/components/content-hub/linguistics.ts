/** Real-time sentiment + readability analysis for blog draft content. */

/** Strip markdown noise so Flesch scores prose, not table pipes / heading hashes. */
function extractProse(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (line.startsWith("#")) return false;
      if (line.startsWith("|")) return false;
      if (line.startsWith("```")) return false;
      if (line.startsWith("- ") || line.startsWith("* ")) return false;
      if (/^\d+\.\s/.test(line)) return false;
      if (line.startsWith("[")) return false;
      return true;
    })
    .join(" ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // markdown links -> anchor text
    .replace(/[*_`>#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function analyzeTextLinguistics(text: string) {
  if (!text || text.trim().length === 0) {
    return {
      wordCount: 0,
      sentenceCount: 0,
      syllableCount: 0,
      readingEase: 100,
      gradeLevel: 1,
      passiveVoiceCount: 0,
      passiveVoicePercent: 0,
      transitionCount: 0,
      transitionPercent: 0,
      sentimentScore: 0,
      sentimentLabel: "Neutral / Balanced",
      sentimentTone: "Objective / Academic",
      buzzwordsCount: 0,
      buzzwordsFound: [] as string[],
      sentenceDistribution: { short: 0, medium: 100, long: 0 },
      toneBreakdown: { positive: 0, negative: 0, analytical: 100, visionary: 0 },
    };
  }

  const prose = extractProse(text) || text;
  const words = prose.toLowerCase().match(/\b[a-z']+\b/g) || [];
  const wordCount = words.length;

  // Sentence split on punctuation only (prose), not every newline/header
  const sentences = prose
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 3);
  const sentenceCount = Math.max(1, sentences.length);

  // Syllable approximation
  let syllableCount = 0;
  for (const word of words) {
    let count = 0;
    const w = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
    const matches = w.match(/[aeiouy]{1,2}/g);
    if (matches) count = matches.length;
    syllableCount += Math.max(1, count);
  }

  // Flesch Reading Ease
  const asl = wordCount / sentenceCount;
  const asw = wordCount > 0 ? syllableCount / wordCount : 0;
  let readingEase = 206.835 - 1.015 * asl - 84.6 * asw;
  readingEase = Math.max(0, Math.min(100, Math.round(readingEase)));

  // Flesch-Kincaid Grade Level
  let gradeLevel = 0.39 * asl + 11.8 * asw - 15.59;
  gradeLevel = Math.max(1, Math.min(18, Math.round(gradeLevel)));

  const buzzwordsDict = [
    "synergy",
    "game-changer",
    "revolutionary",
    "disruptive",
    "paradigm shift",
    "think outside the box",
    "next-generation",
    "state-of-the-art",
    "cutting-edge",
    "world-class",
    "leverage",
    "ecosystem",
    "epicenter",
    "mission-critical",
    "bandwidth",
  ];
  const lowerFull = text.toLowerCase();
  const buzzwordsFound = buzzwordsDict.filter((bw) => lowerFull.includes(bw));
  const buzzwordsCount = buzzwordsFound.length;

  const passiveVoiceRegex = /\b(is|are|was|were|been|being|be)\b\s+\w+ed\b/gi;
  const passiveVoiceMatches = prose.match(passiveVoiceRegex) || [];
  const passiveVoiceCount = passiveVoiceMatches.length;
  const passiveVoicePercent = Math.min(100, Math.round((passiveVoiceCount / sentenceCount) * 100));

  const transitionWords = [
    "however",
    "therefore",
    "consequently",
    "furthermore",
    "additionally",
    "meanwhile",
    "specifically",
    "in contrast",
    "moreover",
    "nonetheless",
    "subsequently",
    "as a result",
    "on the other hand",
  ];
  let transitionCount = 0;
  for (const trans of transitionWords) {
    const reg = new RegExp(`\\b${trans.replace(/\s+/g, "\\s+")}\\b`, "gi");
    const m = prose.match(reg);
    if (m) transitionCount += m.length;
  }
  const transitionPercent = Math.min(100, Math.round((transitionCount / sentenceCount) * 100));

  const positiveWords = [
    "beneficial",
    "outstanding",
    "perfect",
    "excellent",
    "success",
    "advantage",
    "growth",
    "optimize",
    "achieve",
    "boost",
    "increase",
    "win",
    "profit",
    "stellar",
    "seamless",
    "easy",
    "efficient",
    "powerful",
    "innovative",
    "maximize",
    "accelerate",
    "proven",
    "clear",
    "simple",
    "helpful",
  ];
  const negativeWords = [
    "fail",
    "error",
    "risk",
    "threat",
    "bottleneck",
    "slow",
    "vulnerable",
    "costly",
    "deficit",
    "decline",
    "worry",
    "difficult",
    "hazard",
    "poor",
    "wasted",
    "overloaded",
    "stagnant",
    "decrease",
    "negative",
    "loss",
  ];
  const analyticalWords = [
    "data",
    "analysis",
    "metrics",
    "quantitative",
    "formula",
    "framework",
    "hypothesis",
    "empiric",
    "coefficient",
    "statistical",
    "algorithm",
    "schema",
    "canonical",
    "index",
    "structure",
    "systematic",
    "verify",
    "demonstrate",
    "evidence",
  ];
  const visionaryWords = [
    "future",
    "vision",
    "imagine",
    "pioneer",
    "inspire",
    "transform",
    "empower",
    "unlock",
    "catalyst",
    "dream",
    "unlimited",
    "create",
    "lead",
    "champion",
    "destiny",
    "horizon",
  ];

  let positiveCount = 0;
  let negativeCount = 0;
  let analyticalCount = 0;
  let visionaryCount = 0;

  for (const w of words) {
    if (positiveWords.includes(w)) positiveCount++;
    if (negativeWords.includes(w)) negativeCount++;
    if (analyticalWords.includes(w)) analyticalCount++;
    if (visionaryWords.includes(w)) visionaryCount++;
  }

  const totalToneWords = positiveCount + negativeCount + analyticalCount + visionaryCount || 1;
  const toneBreakdown = {
    positive: Math.round((positiveCount / totalToneWords) * 100),
    negative: Math.round((negativeCount / totalToneWords) * 100),
    analytical: Math.round((analyticalCount / totalToneWords) * 100),
    visionary: Math.round((visionaryCount / totalToneWords) * 100),
  };

  const netSentiment = positiveCount - negativeCount;
  const totalSentimentBase = positiveCount + negativeCount || 1;
  const sentimentScore = Math.round((netSentiment / totalSentimentBase) * 100);

  let sentimentLabel = "Neutral / Balanced";
  if (sentimentScore > 40) sentimentLabel = "Highly Positive & Empowering";
  else if (sentimentScore > 10) sentimentLabel = "Optimistic & Constructive";
  else if (sentimentScore < -40) sentimentLabel = "Critical & Alarmist";
  else if (sentimentScore < -10) sentimentLabel = "Cautious & Skeptical";

  let sentimentTone = "Objective / Academic";
  const dominantTone = Math.max(
    toneBreakdown.positive,
    toneBreakdown.negative,
    toneBreakdown.analytical,
    toneBreakdown.visionary
  );
  if (dominantTone === toneBreakdown.analytical) sentimentTone = "Analytical & Empirical";
  else if (dominantTone === toneBreakdown.visionary) sentimentTone = "Visionary & Inspirational";
  else if (dominantTone === toneBreakdown.positive) sentimentTone = "Persuasive & Growth-Oriented";
  else if (dominantTone === toneBreakdown.negative) sentimentTone = "Problem-Focused / Urgent";

  let shortSentences = 0;
  let mediumSentences = 0;
  let longSentences = 0;
  for (const sent of sentences) {
    const sWords = sent.trim().split(/\s+/).filter(Boolean).length;
    if (sWords < 12) shortSentences++;
    else if (sWords <= 25) mediumSentences++;
    else longSentences++;
  }
  const totalSents = sentences.length || 1;
  const sentenceDistribution = {
    short: Math.round((shortSentences / totalSents) * 100),
    medium: Math.round((mediumSentences / totalSents) * 100),
    long: Math.round((longSentences / totalSents) * 100),
  };

  return {
    wordCount,
    sentenceCount,
    syllableCount,
    readingEase,
    gradeLevel,
    passiveVoiceCount,
    passiveVoicePercent,
    transitionCount,
    transitionPercent,
    sentimentScore,
    sentimentLabel,
    sentimentTone,
    buzzwordsCount,
    buzzwordsFound,
    sentenceDistribution,
    toneBreakdown,
  };
}
