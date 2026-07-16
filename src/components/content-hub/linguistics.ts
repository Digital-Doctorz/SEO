/** Real-time sentiment + readability analysis for blog draft content. */
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
      toneBreakdown: { positive: 0, negative: 0, analytical: 100, visionary: 0 }
    };
  }

  // Clean and prepare
  const words = text.toLowerCase().match(/\b[a-z']+\b/g) || [];
  const wordCount = words.length;

  // Split into sentences (rudimentary but effective, handles newlines for headers/lists)
  const sentences = text.split(/[.!?\n\r]+/).map(s => s.trim()).filter(s => s.length > 3);
  const sentenceCount = Math.max(1, sentences.length);

  // Syllables count approximation (English syllable counting heuristic)
  let syllableCount = 0;
  for (const word of words) {
    let count = 0;
    const w = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    const matches = w.match(/[aeiouy]{1,2}/g);
    if (matches) {
      count = matches.length;
    }
    syllableCount += Math.max(1, count);
  }

  // Flesch Reading Ease Formula
  const asl = wordCount / sentenceCount;
  const asw = wordCount > 0 ? syllableCount / wordCount : 0;
  
  let readingEase = 206.835 - (1.015 * asl) - (84.6 * asw);
  readingEase = Math.max(0, Math.min(100, Math.round(readingEase)));

  // Flesch-Kincaid Grade Level Formula
  let gradeLevel = (0.39 * asl) + (11.8 * asw) - 15.59;
  gradeLevel = Math.max(1, Math.min(18, Math.round(gradeLevel)));

  // Buzzwords detection
  const buzzwordsDict = ["synergy", "game-changer", "revolutionary", "disruptive", "paradigm shift", "think outside the box", "next-generation", "state-of-the-art", "cutting-edge", "world-class", "leverage", "ecosystem", "epicenter", "mission-critical", "bandwidth"];
  const buzzwordsFound = buzzwordsDict.filter(bw => text.toLowerCase().includes(bw));
  const buzzwordsCount = buzzwordsFound.length;

  // Passive voice detector (e.g. is/are/was/were/been/being + [verb]ed)
  const passiveVoiceRegex = /\b(is|are|was|were|been|being|be)\b\s+\w+ed\b/gi;
  const passiveVoiceMatches = text.match(passiveVoiceRegex) || [];
  const passiveVoiceCount = passiveVoiceMatches.length;
  const passiveVoicePercent = Math.min(100, Math.round((passiveVoiceCount / sentenceCount) * 100));

  // Transition words
  const transitionWords = ["however", "therefore", "consequently", "furthermore", "additionally", "meanwhile", "specifically", "in contrast", "moreover", "nonetheless", "subsequently", "as a result", "on the other hand"];
  let transitionCount = 0;
  for (const trans of transitionWords) {
    const reg = new RegExp(`\\b${trans}\\b`, "gi");
    const m = text.match(reg);
    if (m) transitionCount += m.length;
  }
  const transitionPercent = Math.min(100, Math.round((transitionCount / sentenceCount) * 100));

  // Sentiment and tone dictionaries
  const positiveWords = ["beneficial", "outstanding", "perfect", "excellent", "success", "advantage", "growth", "optimize", "achieve", "boost", "increase", "win", "profit", "stellar", "seamless", "easy", "efficient", "powerful", "innovative", "maximize", "accelerate", "proven"];
  const negativeWords = ["fail", "error", "risk", "threat", "bottleneck", "slow", "vulnerable", "costly", "deficit", "decline", "worry", "difficult", "hazard", "poor", "wasted", "overloaded", "stagnant", "decrease", "negative", "loss"];
  const analyticalWords = ["data", "analysis", "metrics", "quantitative", "formula", "framework", "hypothesis", "empiric", "coefficient", "statistical", "algorithm", "schema", "canonical", "index", "structure", "systematic", "verify", "demonstrate", "evidence"];
  const visionaryWords = ["future", "vision", "imagine", "pioneer", "inspire", "transform", "empower", "unlock", "catalyst", "dream", "unlimited", "create", "lead", "champion", "destiny", "horizon"];

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
    visionary: Math.round((visionaryCount / totalToneWords) * 100)
  };

  // Calculate sentiment score from -100 to +100
  const netSentiment = positiveCount - negativeCount;
  const totalSentimentBase = positiveCount + negativeCount || 1;
  const sentimentScore = Math.round((netSentiment / totalSentimentBase) * 100);

  let sentimentLabel = "Neutral / Balanced";
  if (sentimentScore > 40) sentimentLabel = "Highly Positive & Empowering";
  else if (sentimentScore > 10) sentimentLabel = "Optimistic & Constructive";
  else if (sentimentScore < -40) sentimentLabel = "Critical & Alarmist";
  else if (sentimentScore < -10) sentimentLabel = "Cautious & Skeptical";

  let sentimentTone = "Objective / Academic";
  const dominantTone = Math.max(toneBreakdown.positive, toneBreakdown.negative, toneBreakdown.analytical, toneBreakdown.visionary);
  if (dominantTone === toneBreakdown.analytical) sentimentTone = "Analytical & Empirical";
  else if (dominantTone === toneBreakdown.visionary) sentimentTone = "Visionary & Inspirational";
  else if (dominantTone === toneBreakdown.positive) sentimentTone = "Persuasive & Growth-Oriented";
  else if (dominantTone === toneBreakdown.negative) sentimentTone = "Problem-Focused / Urgent";

  // Sentence length distribution
  let shortSentences = 0; // < 12 words
  let mediumSentences = 0; // 12-25 words
  let longSentences = 0; // > 25 words

  for (const sent of sentences) {
    const sWords = sent.trim().split(/\s+/).length;
    if (sWords < 12) shortSentences++;
    else if (sWords <= 25) mediumSentences++;
    else longSentences++;
  }

  const totalSents = sentences.length || 1;
  const sentenceDistribution = {
    short: Math.round((shortSentences / totalSents) * 100),
    medium: Math.round((mediumSentences / totalSents) * 100),
    long: Math.round((longSentences / totalSents) * 100)
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
    toneBreakdown
  };
}
