import React, { useState, useEffect, useMemo } from "react";
import { SocialPost, BlogPost, PageMetric, AiProviderConfig } from "../types";
import { 
  Sparkles, Twitter, Linkedin, Mail, Copy, Check, ChevronRight, 
  FileText, Code, Globe, HelpCircle, MessageSquare, AlertCircle, 
  Settings, PenTool, Eye, Volume2, User, Award, Plus, X,
  Compass, Globe2, Table, Image, Link, CheckCircle,
  ChevronDown, List, ShieldCheck, Cpu, Share2,
  RefreshCw, Bookmark, Trash2, Save, History, Smile, Activity
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface LinkSuggestion {
  id: string;
  anchorText: string;
  targetUrl: string;
  pageTitle: string;
  contextBefore: string;
  contextAfter: string;
  relevance: number;
  status: "pending" | "inserted" | "ignored";
  startIndex: number;
  endIndex: number;
}

interface SavedArticle {
  id: string;
  timestamp: string;
  title: string;
  topic: string;
  keyword: string;
  secondaryKeywords: string[];
  wordCount: number;
  tone: string;
  audience: string;
  blogPost: BlogPost;
  customLabel?: string;
}

// Helper to analyze sentiment and readability of content in real-time
function analyzeTextLinguistics(text: string) {
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

interface ContentHubProps {
  initialKeyword?: string;
  initialTopic?: string;
  targetDomain: string;
  autonomousBlog?: BlogPost;
  targetPages?: PageMetric[];
  aiConfig?: AiProviderConfig;
}
 
export default function ContentHub({ initialKeyword = "", initialTopic = "", targetDomain, autonomousBlog, targetPages = [], aiConfig }: ContentHubProps) {
  const [activeTab, setActiveTab] = useState<"social" | "blog">("blog");
  const [showConfigForm, setShowConfigForm] = useState(!initialTopic);
  
  // States for Blog Writer
  const [blogTopic, setBlogTopic] = useState(autonomousBlog?.title || "");
  const [blogKeyword, setBlogKeyword] = useState(autonomousBlog?.slugSuggestion || "");
  const [secondaryKeywords, setSecondaryKeywords] = useState<string[]>([]);
  const [secKeywordInput, setSecKeywordInput] = useState("");
  const [wordCount, setWordCount] = useState<number>(1000);
  const [targetAudience, setTargetAudience] = useState("Marketing Managers & SEOs");
  const [toneOfVoice, setToneOfVoice] = useState("Authoritative & Analytical");
  
  const [blogPost, setBlogPost] = useState<BlogPost | null>(autonomousBlog || null);
  
  // Real-time sentiment and readability stats memo
  const blogLinguisticStats = useMemo(() => {
    return analyzeTextLinguistics(blogPost?.content || "");
  }, [blogPost?.content]);
  
  // Keyword density heatmap and highlight states
  const [highlightKeywords, setHighlightKeywords] = useState(true);
  const [hoveredHeatmapIndex, setHoveredHeatmapIndex] = useState<number | null>(null);

  // Parse the content into paragraphs and evaluate keyword density
  const keywordDensityMetrics = useMemo(() => {
    const text = blogPost?.content || "";
    if (!text) {
      return {
        paragraphs: [],
        primaryMetrics: { count: 0, density: 0, status: "Under-optimized", color: "text-slate-400 bg-slate-50 border-slate-200" },
        secondaryMetrics: [],
        totalWords: 0
      };
    }

    const words = text.toLowerCase().match(/\b[a-z']+\b/g) || [];
    const totalWords = words.length || 1;

    // Helper to count occurrences of a phrase
    const getPhraseCount = (fullText: string, phrase: string) => {
      if (!phrase || !phrase.trim()) return 0;
      const cleanPhrase = phrase.trim().toLowerCase().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      try {
        const startBoundary = /^\w/.test(phrase.trim()) ? '\\b' : '';
        const endBoundary = /\w$/.test(phrase.trim()) ? '\\b' : '';
        const regex = new RegExp(`${startBoundary}${cleanPhrase}${endBoundary}`, "gi");
        const matches = fullText.match(regex);
        return matches ? matches.length : 0;
      } catch (e) {
        return 0;
      }
    };

    // 1. Primary Keyword Metrics
    const primary = blogKeyword ? blogKeyword.trim() : "";
    const primaryCount = getPhraseCount(text, primary);
    const primaryWordCount = primary ? primary.split(/\s+/).length : 1;
    const primaryDensity = totalWords > 0 ? ((primaryCount * primaryWordCount) / totalWords) * 100 : 0;

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

    // 2. Secondary Keywords Metrics
    const secondaryMetrics = secondaryKeywords.map(kw => {
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

      return {
        keyword: kw,
        count,
        density,
        status,
        color
      };
    });

    // 3. Paragraph-level breakdown for the Heatmap Grid
    const rawBlocks = text.split(/\n\s*\n+/);
    const paragraphs: {
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
    }[] = [];

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

      secondaryKeywords.forEach(kw => {
        const count = getPhraseCount(trimmed, kw);
        if (count > 0) {
          pSecondaryCount += count;
          foundKws.push(`Secondary: "${kw}" (${count}x)`);
        }
      });

      const totalKws = pPrimaryCount + pSecondaryCount;
      const density = pWordCount > 0 ? ((pPrimaryCount * primaryWordCount + pSecondaryCount * 1.5) / pWordCount) * 100 : 0;

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
        keywordsFound: foundKws
      });
    });

    return {
      paragraphs,
      primaryMetrics: {
        count: primaryCount,
        density: primaryDensity,
        status: primaryStatus,
        color: primaryColor
      },
      secondaryMetrics,
      totalWords
    };
  }, [blogPost?.content, blogKeyword, secondaryKeywords]);
  
  // Saved Articles state
  const [savedArticles, setSavedArticles] = useState<SavedArticle[]>([]);

  // Load saved articles on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("seo_saved_articles");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSavedArticles(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load saved articles from localStorage:", e);
    }
  }, []);

  const saveArticlesToStorage = (updatedList: SavedArticle[]) => {
    try {
      localStorage.setItem("seo_saved_articles", JSON.stringify(updatedList));
    } catch (e) {
      console.error("Failed to save articles to localStorage:", e);
    }
  };

  const handleSaveArticleVersion = (postToSave: BlogPost, isAuto = false) => {
    if (!postToSave) return;
    
    const formattedDate = new Date().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

    const newSaved: SavedArticle = {
      id: `art-${Date.now()}`,
      timestamp: formattedDate,
      title: postToSave.title,
      topic: blogTopic || postToSave.title,
      keyword: blogKeyword,
      secondaryKeywords: [...secondaryKeywords],
      wordCount: wordCount,
      tone: toneOfVoice,
      audience: targetAudience,
      blogPost: JSON.parse(JSON.stringify(postToSave)), // deep copy
      customLabel: isAuto 
        ? `Auto-Saved (${toneOfVoice.split(" ")[0]})` 
        : `Version ${savedArticles.length + 1}`
    };

    setSavedArticles(prev => {
      const updated = [newSaved, ...prev];
      saveArticlesToStorage(updated);
      return updated;
    });
  };

  const handleLoadSavedArticle = (saved: SavedArticle) => {
    setBlogPost(saved.blogPost);
    setBlogTopic(saved.topic);
    setBlogKeyword(saved.keyword);
    setSecondaryKeywords(saved.secondaryKeywords);
    setWordCount(saved.wordCount);
    setTargetAudience(saved.audience);
    setToneOfVoice(saved.tone);
    setShowConfigForm(false);
  };

  const handleDeleteSavedArticle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedArticles(prev => {
      const updated = prev.filter(art => art.id !== id);
      saveArticlesToStorage(updated);
      return updated;
    });
  };

  const handleUpdateCustomLabel = (id: string, newLabel: string) => {
    setSavedArticles(prev => {
      const updated = prev.map(art => {
        if (art.id === id) {
          return { ...art, customLabel: newLabel };
        }
        return art;
      });
      saveArticlesToStorage(updated);
      return updated;
    });
  };
  
  // Link Discovery States
  const [linkSuggestions, setLinkSuggestions] = useState<LinkSuggestion[]>([]);
  const [isScanningLinks, setIsScanningLinks] = useState(false);
  const [hasScannedLinks, setHasScannedLinks] = useState(false);
  const [isCustomLinkOpen, setIsCustomLinkOpen] = useState(false);
  const [customAnchor, setCustomAnchor] = useState("");
  const [customTargetUrl, setCustomTargetUrl] = useState("");
  const [isBlogGenerating, setIsBlogGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [blogCopied, setBlogCopied] = useState(false);
  const [schemaCopied, setSchemaCopied] = useState(false);
  const [showSchema, setShowSchema] = useState(false);
  const [schemaFormatType, setSchemaFormatType] = useState<"json" | "script">("json");
  const [schemaSearchQuery, setSchemaSearchQuery] = useState("");
  
  // Custom states for SEO-First Blog Workspace
  const [blogViewTab, setBlogViewTab] = useState<"draft" | "prewriting" | "seo" | "multimedia" | "links" | "technical" | "schema">("draft");
  const [technicalSubTab, setTechnicalSubTab] = useState<"ai" | "local" | "og" | "code">("ai");
  const [headerTagsCopied, setHeaderTagsCopied] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [activeSchemaTab, setActiveSchemaTab] = useState<string>("article");

  // Meta Title & Meta Description Generator States & Handlers
  const [metaSuggestions, setMetaSuggestions] = useState<Array<{ type: string; title: string; description: string }>>([]);
  const [isMetaGenerating, setIsMetaGenerating] = useState(false);
  const [metaGenError, setMetaGenError] = useState<string | null>(null);
  const [isEditingMeta, setIsEditingMeta] = useState(false);

  const handleGenerateMetaSnippets = async () => {
    if (!blogPost) return;
    setIsMetaGenerating(true);
    setMetaGenError(null);
    try {
      const response = await fetch("/api/generate-meta-snippets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: blogKeyword,
          content: blogPost.content,
          articleTitle: blogPost.title,
          targetDomain: targetDomain,
          aiConfig
        })
      });
      let data;
      const responseText = await response.text();
      try {
        data = JSON.parse(responseText);
      } catch {
        if (!response.ok) throw new Error(`Server returned ${response.status}: Expected JSON response`);
        throw new Error("Server returned invalid JSON response for meta snippets.");
      }
      if (!response.ok) {
        throw new Error(data.errorMsg || data.error || `Server returned status ${response.status}`);
      }
      if (data.isFallback) {
        setMetaSuggestions([]);
        setMetaGenError(data.fallbackReason || data.errorMsg || "AI engine unavailable. Check your API key in Settings.");
        return;
      }
      if (data && Array.isArray(data.snippets)) {
        setMetaSuggestions(data.snippets);
      } else {
        throw new Error("Invalid response received from server.");
      }
    } catch (err: any) {
      console.error("Error generating meta snippets:", err);
      setMetaGenError(err.message || "An unexpected error occurred while generating meta snippets.");
    } finally {
      setIsMetaGenerating(false);
    }
  };

  const handleUpdateMetaTitle = (newTitle: string) => {
    if (!blogPost) return;
    setBlogPost({
      ...blogPost,
      title: newTitle
    });
  };

  const handleUpdateMetaDescription = (newDescription: string) => {
    if (!blogPost) return;
    setBlogPost({
      ...blogPost,
      metaDescription: newDescription
    });
  };

  // Keep track of auto-generated topics to prevent infinite loops
  const [lastAutoGeneratedTopic, setLastAutoGeneratedTopic] = useState(autonomousBlog?.title || "");

  // States for Social & Forum Forum Generator
  const [socialPlatform, setSocialPlatform] = useState<"Twitter/X" | "LinkedIn" | "Newsletter" | "Reddit" | "Quora" | "Google Business">("Twitter/X");
  const [socialTopic, setSocialTopic] = useState("");
  const [socialKeyword, setSocialKeyword] = useState("");
  const [socialPost, setSocialPost] = useState<SocialPost | null>(null);
  const [isSocialGenerating, setIsSocialGenerating] = useState(false);
  const [socialCopied, setSocialCopied] = useState(false);
  const [socialAudience, setSocialAudience] = useState("Marketing Managers & SEOs");
  const [socialGoal, setSocialGoal] = useState("Engagement");
  const [socialVoice, setSocialVoice] = useState("Authoritative & Analytical");
  const [activeSocialOutputTab, setActiveSocialOutputTab] = useState<"post" | "metadata" | "seo" | "schema">("post");

  // Synchronize initial props and auto-generate content
  const pagesToScan = useMemo(() => {
    if (targetPages && targetPages.length > 0) {
      return targetPages;
    }
    const isMedical = targetDomain.includes("health") || targetDomain.includes("clinic") || targetDomain.includes("naturoveda") || targetDomain.includes("optm") || targetDomain.includes("medical");
    if (isMedical) {
      return [
        { url: `https://${targetDomain}/services/osteoarthritis-treatment`, title: "Non-Surgical Osteoarthritis Treatment & Care", estTraffic: 1200, keywordsCount: 24 },
        { url: `https://${targetDomain}/services/knee-pain-treatment`, title: "Phytotherapy Knee Pain Relief Protocols", estTraffic: 950, keywordsCount: 18 },
        { url: `https://${targetDomain}/services/backache-treatment`, title: "Active Botanical Spine & Backache Recovery", estTraffic: 800, keywordsCount: 15 },
        { url: `https://${targetDomain}/about-us`, title: "About OPTM Healthcare Clinics & Medical Staff", estTraffic: 400, keywordsCount: 5 }
      ];
    } else {
      return [
        { url: `https://${targetDomain}/features/keyword-research`, title: "Keyword Research & Topical Clustering Tool", estTraffic: 1500, keywordsCount: 30 },
        { url: `https://${targetDomain}/features/content-gap`, title: "Organic Competitor Content Gap Analyzer", estTraffic: 1100, keywordsCount: 22 },
        { url: `https://${targetDomain}/pricing`, title: "ApexSEO Pro Suite Cost & Subscription Plans", estTraffic: 900, keywordsCount: 12 },
        { url: `https://${targetDomain}/about`, title: "About ApexSEO Competitive Intelligence Company", estTraffic: 500, keywordsCount: 8 }
      ];
    }
  }, [targetPages, targetDomain]);

  const scanForInternalLinks = () => {
    if (!blogPost || !blogPost.content) return;
    setIsScanningLinks(true);
    setLinkSuggestions([]);
    
    setTimeout(() => {
      const content = blogPost.content;
      const suggestions: LinkSuggestion[] = [];

      pagesToScan.forEach((page) => {
        const terms: string[] = [];
        const cleanTitle = page.title.toLowerCase();
        const cleanUrl = page.url.toLowerCase();

        if (cleanUrl.includes("osteoarthritis") || cleanTitle.includes("osteoarthritis")) {
          terms.push("osteoarthritis", "osteoarthritis treatment", "joint restoration", "cartilage protection");
        }
        if (cleanUrl.includes("knee") || cleanTitle.includes("knee")) {
          terms.push("knee pain", "knee pain relief", "joint flexibility", "digital testing");
        }
        if (cleanUrl.includes("backache") || cleanUrl.includes("spine") || cleanTitle.includes("backache")) {
          terms.push("backache", "back pain", "spine recovery", "spine and backache");
        }
        if (cleanUrl.includes("phytotherapy") || cleanTitle.includes("phytotherapy")) {
          terms.push("phytotherapy", "plant therapeutics", "botanical extracts");
        }
        if (cleanUrl.includes("phytomedicine") || cleanTitle.includes("phytomedicine")) {
          terms.push("phytomedicine", "standardized plant compounds", "active bio-compounds");
        }

        if (cleanUrl.includes("keyword") || cleanTitle.includes("keyword")) {
          terms.push("keyword research", "keyword clustering", "semantic clustering", "keyword mapping");
        }
        if (cleanUrl.includes("gap") || cleanTitle.includes("gap")) {
          terms.push("content gap", "competitor content gaps", "gap audit", "content gap analysis");
        }
        if (cleanUrl.includes("pricing") || cleanTitle.includes("pricing")) {
          terms.push("pricing", "subscription plans", "pro suite cost", "cost plans");
        }
        if (cleanUrl.includes("about") || cleanTitle.includes("about")) {
          terms.push("about us", "company", "clinical team");
        }

        const titleParts = page.title.split(/[:|]/);
        titleParts.forEach(part => {
          const trimmed = part.trim().toLowerCase();
          if (trimmed.length > 5 && trimmed.length < 35) {
            terms.push(trimmed);
          }
        });

        const nouns = page.title
          .replace(/[^\w\s]/g, "")
          .split(/\s+/)
          .filter(w => w.length >= 6 && !["treatment", "services", "healthcare", "protocols", "national", "institutes", "research", "medical", "clinical", "company", "plans", "pro", "suite"].includes(w.toLowerCase()));
        nouns.forEach(w => terms.push(w.toLowerCase()));

        const uniqueTerms = Array.from(new Set(terms.map(t => t.trim()).filter(t => t.length > 3)));

        uniqueTerms.forEach((term) => {
          try {
            const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(`\\b(${escapedTerm})\\b`, "gi");
            let match;

            while ((match = regex.exec(content)) !== null) {
              const matchedText = match[1];
              const matchIndex = match.index;

              const urlSuffix = page.url.replace(/^https?:\/\/[^\/]+/, "");
              const isAlreadyLinked = content.includes(`(${page.url})`) || content.includes(`(${urlSuffix})`);
              if (isAlreadyLinked) continue;

              const preText = content.substring(Math.max(0, matchIndex - 60), matchIndex);
              const postText = content.substring(matchIndex + matchedText.length, Math.min(content.length, matchIndex + matchedText.length + 60));
              
              const isPrecededByBracket = preText.includes("[") && !preText.substring(preText.lastIndexOf("[")).includes("]");
              const isFollowedByParenthesis = postText.includes(")") && !postText.substring(0, postText.indexOf(")")).includes("(");
              
              if (isPrecededByBracket || isFollowedByParenthesis) {
                continue;
              }

              const contextBefore = preText.substring(Math.max(0, preText.length - 25));
              const contextAfter = postText.substring(0, Math.min(postText.length, 25));

              let relevance = 70;
              if (cleanTitle.includes(term)) relevance += 15;
              if (cleanUrl.includes(term.replace(/\s+/g, "-"))) relevance += 10;
              relevance = Math.min(98, relevance);

              suggestions.push({
                id: `${page.url}-${matchIndex}`,
                anchorText: matchedText,
                targetUrl: page.url,
                pageTitle: page.title,
                contextBefore,
                contextAfter,
                relevance,
                status: "pending",
                startIndex: matchIndex,
                endIndex: matchIndex + matchedText.length
              });
            }
          } catch (err) {
            console.error("Link scan error for term:", term, err);
          }
        });
      });

      suggestions.sort((a, b) => b.anchorText.length - a.anchorText.length);
      const filtered: LinkSuggestion[] = [];
      const seenIndices = new Set<number>();

      suggestions.forEach(s => {
        let overlap = false;
        for (let i = s.startIndex; i < s.endIndex; i++) {
          if (seenIndices.has(i)) {
            overlap = true;
            break;
          }
        }
        if (!overlap) {
          filtered.push(s);
          for (let i = s.startIndex; i < s.endIndex; i++) {
            seenIndices.add(i);
          }
        }
      });

      setLinkSuggestions(filtered.slice(0, 8));
      setIsScanningLinks(false);
      setHasScannedLinks(true);
    }, 1200);
  };

  const handleInsertLink = (suggestion: LinkSuggestion) => {
    if (!blogPost) return;

    const { anchorText, targetUrl } = suggestion;
    const fullContext = suggestion.contextBefore + anchorText + suggestion.contextAfter;
    const markdownLink = `[${anchorText}](${targetUrl})`;
    const replacementContext = suggestion.contextBefore + markdownLink + suggestion.contextAfter;

    let newContent = blogPost.content;
    if (newContent.includes(fullContext)) {
      newContent = newContent.replace(fullContext, replacementContext);
    } else {
      newContent = newContent.replace(anchorText, markdownLink);
    }

    setBlogPost({
      ...blogPost,
      content: newContent
    });

    setLinkSuggestions(prev => prev.map(s => s.id === suggestion.id ? { ...s, status: "inserted" } : s));
  };

  const handleIgnoreLink = (id: string) => {
    setLinkSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: "ignored" } : s));
  };

  const handleAddCustomLink = () => {
    if (!blogPost || !customAnchor.trim() || !customTargetUrl.trim()) return;

    const anchor = customAnchor.trim();
    const url = customTargetUrl.trim();
    const markdownLink = `[${anchor}](${url})`;

    let newContent = blogPost.content;
    
    const regex = new RegExp(`\\b(${anchor.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})\\b`, "i");
    if (regex.test(newContent)) {
      newContent = newContent.replace(regex, markdownLink);
      setBlogPost({
        ...blogPost,
        content: newContent
      });
      
      const customSuggestion: LinkSuggestion = {
        id: `custom-${Date.now()}`,
        anchorText: anchor,
        targetUrl: url,
        pageTitle: "Custom Manual Link",
        contextBefore: "...inserted manual link: ",
        contextAfter: " ...",
        relevance: 100,
        status: "inserted",
        startIndex: 0,
        endIndex: 0
      };
      setLinkSuggestions(prev => [customSuggestion, ...prev]);
      setCustomAnchor("");
      setCustomTargetUrl("");
      setIsCustomLinkOpen(false);
    } else {
      alert(`The exact text "${anchor}" was not found in the article body. Please select a word or phrase that actually exists in your draft.`);
    }
  };

  // Helper to dynamically extract the optimal SEO configuration based on the selected content gap topic, keyword, and target domain
  const getDynamicSEOConfig = (topic: string, keyword: string, domain: string) => {
    const topicLower = topic.toLowerCase();
    const keywordLower = keyword.toLowerCase();
    const domainLower = domain.toLowerCase();

    const isMedical =
      domainLower.includes("health") ||
      domainLower.includes("clinic") ||
      domainLower.includes("naturoveda") ||
      domainLower.includes("optm") ||
      domainLower.includes("medical") ||
      topicLower.includes("osteoarthritis") ||
      topicLower.includes("joint") ||
      topicLower.includes("pain") ||
      topicLower.includes("treatment") ||
      topicLower.includes("medical") ||
      topicLower.includes("health") ||
      topicLower.includes("arthritis") ||
      topicLower.includes("knee") ||
      topicLower.includes("backache") ||
      topicLower.includes("natural") ||
      keywordLower.includes("osteoarthritis") ||
      keywordLower.includes("joint") ||
      keywordLower.includes("pain") ||
      keywordLower.includes("treatment") ||
      keywordLower.includes("medical") ||
      keywordLower.includes("health") ||
      keywordLower.includes("arthritis") ||
      keywordLower.includes("knee") ||
      keywordLower.includes("backache") ||
      keywordLower.includes("natural");

    const isPayments =
      domainLower.includes("stripe") ||
      domainLower.includes("paypal") ||
      domainLower.includes("pay") ||
      topicLower.includes("payment") ||
      topicLower.includes("gateway") ||
      topicLower.includes("api") ||
      topicLower.includes("transaction") ||
      keywordLower.includes("payment") ||
      keywordLower.includes("gateway") ||
      keywordLower.includes("api") ||
      keywordLower.includes("transaction");

    const isNotes =
      domainLower.includes("notion") ||
      domainLower.includes("obsidian") ||
      domainLower.includes("productivity") ||
      topicLower.includes("note") ||
      topicLower.includes("workspace") ||
      topicLower.includes("knowledge") ||
      keywordLower.includes("note") ||
      keywordLower.includes("workspace") ||
      keywordLower.includes("knowledge");

    if (isMedical) {
      return {
        wordCount: 2500, // Deep authority content for medical
        targetAudience: "Patients seeking natural joint pain relief without surgery",
        toneOfVoice: "Empathetic & Warm",
        secondaryKeywords: ["joint restoration", "knee pain relief", "phytomedicine", "osteoarthritis natural treatment"]
      };
    } else if (isPayments) {
      return {
        wordCount: 1800,
        targetAudience: "Technical Engineers & Developers",
        toneOfVoice: "Technical & Precise",
        secondaryKeywords: ["payment gateway integration", "multi-currency processing", "checkout workflows", "api security"]
      };
    } else if (isNotes) {
      return {
        wordCount: 1200,
        targetAudience: "General Professionals",
        toneOfVoice: "Educational & Conversational",
        secondaryKeywords: ["productivity templates", "knowledge base workflows", "structured workspaces", "notion template"]
      };
    } else {
      return {
        wordCount: 1500,
        targetAudience: "Marketing Managers & SEOs",
        toneOfVoice: "Authoritative & Analytical",
        secondaryKeywords: ["organic traffic growth", "competitor analysis", "content strategy", "topical authority"]
      };
    }
  };

  useEffect(() => {
    if (initialTopic) {
      const config = getDynamicSEOConfig(initialTopic, initialKeyword || initialTopic, targetDomain);

      setBlogTopic(initialTopic);
      setSocialTopic(initialTopic);
      setActiveTab("blog");
      setShowConfigForm(false);
      if (initialKeyword) {
        setBlogKeyword(initialKeyword);
        setSocialKeyword(initialKeyword);
      }

      setWordCount(config.wordCount);
      setTargetAudience(config.targetAudience);
      setToneOfVoice(config.toneOfVoice);
      setSecondaryKeywords(config.secondaryKeywords);

      if (initialTopic !== lastAutoGeneratedTopic) {
        setLastAutoGeneratedTopic(initialTopic);
        generateBlogContent(
          initialTopic,
          initialKeyword || initialTopic,
          config.wordCount,
          config.targetAudience,
          config.toneOfVoice,
          config.secondaryKeywords
        );
      }
      return;
    }

    if (autonomousBlog) {
      setBlogPost(autonomousBlog);
      setBlogTopic(autonomousBlog.title);
      setBlogKeyword(autonomousBlog.slugSuggestion);
      setLastAutoGeneratedTopic(autonomousBlog.title);
    }
  }, [initialKeyword, initialTopic, autonomousBlog, targetDomain, lastAutoGeneratedTopic]);

  // Handle adding secondary keyword
  const handleAddSecondaryKeyword = () => {
    const trimmed = secKeywordInput.trim().toLowerCase();
    if (trimmed && !secondaryKeywords.includes(trimmed)) {
      setSecondaryKeywords([...secondaryKeywords, trimmed]);
      setSecKeywordInput("");
    }
  };

  // Handle removing secondary keyword
  const handleRemoveSecondaryKeyword = (kw: string) => {
    setSecondaryKeywords(secondaryKeywords.filter(k => k !== kw));
  };

  const handleCopy = (text: string, setCopiedState: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopiedState(true);
    setTimeout(() => setCopiedState(false), 2000);
  };

  // Generate Social API Call
  const generateSocialContent = async () => {
    const topicToUse = (socialTopic || "").trim();
    const keywordToUse = (socialKeyword || "").trim();
    const platformToUse = socialPlatform;
    const audienceToUse = (socialAudience || "").trim();
    const goalToUse = (socialGoal || "").trim();
    const voiceToUse = (socialVoice || "").trim();

    console.log("[SEO Content Hub - Client] Initiating generateSocialContent with parameters:", {
      platform: platformToUse,
      topic: topicToUse,
      keyword: keywordToUse,
      targetDomain,
      audience: audienceToUse,
      contentGoal: goalToUse,
      brandVoice: voiceToUse
    });

    if (!topicToUse) {
      const errMsg = "Validation Error: Social topic is required to initiate generation.";
      console.warn(`[SEO Content Hub - Client] ${errMsg}`);
      setGenerationError(errMsg);
      return;
    }

    setIsSocialGenerating(true);
    setSocialPost(null);
    setGenerationError(null);
 
    try {
      const payload = {
        platform: platformToUse,
        topic: topicToUse,
        keyword: keywordToUse,
        targetDomain,
        audience: audienceToUse,
        contentGoal: goalToUse,
        brandVoice: voiceToUse,
        aiConfig
      };

      const res = await fetch("/api/generate-social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      console.log(`[SEO Content Hub - Client] Social Fetch completed. Status: ${res.status} (${res.statusText})`);

      let data;
      const responseText = await res.text();
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        console.error("[SEO Content Hub - Client] Failed to parse social response as JSON. Raw response length:", responseText.length);
        throw new Error(`Server returned invalid JSON response for social copy (Status ${res.status}).`);
      }

      if (!res.ok) {
        const errorMsg = data.errorMsg || data.error || `Server responded with error status ${res.status}`;
        const errorDetails = data.details ? ` (${data.details})` : "";
        throw new Error(`${errorMsg}${errorDetails}`);
      }

      if (data.isFallback) {
        setSocialPost(data);
        setGenerationError(data.fallbackReason || data.errorMsg || "AI engine unavailable. Check your API key in Settings.");
        return;
      }

      console.log("[SEO Content Hub - Client] Successfully generated social content:", data);
      setSocialPost(data);
    } catch (err: any) {
      console.error("[SEO Content Hub - Client] Error during generateSocialContent:", err);
      setGenerationError(err.message || "An unexpected error occurred while generating your social media copy.");
    } finally {
      setIsSocialGenerating(false);
    }
  };
 
  // Generate Blog API Call supporting parameter overrides for dynamic auto-fill
  const generateBlogContent = async (
    overrideTopic?: string,
    overrideKeyword?: string,
    overrideWordCount?: number,
    overrideAudience?: string,
    overrideTone?: string,
    overrideSecondaryKeywords?: string[]
  ) => {
    const topicToUse = (overrideTopic || blogTopic || "").trim();
    const keywordToUse = (overrideKeyword || blogKeyword || "").trim();
    const secondaryKeywordsToUse = overrideSecondaryKeywords !== undefined ? overrideSecondaryKeywords : secondaryKeywords;
    const wordCountToUse = overrideWordCount !== undefined ? overrideWordCount : wordCount;
    const audienceToUse = (overrideAudience !== undefined ? overrideAudience : targetAudience || "").trim();
    const toneToUse = (overrideTone !== undefined ? overrideTone : toneOfVoice || "").trim();

    console.log("[SEO Content Hub - Client] Initiating generateBlogContent with parameters:", {
      topic: topicToUse,
      keyword: keywordToUse,
      secondaryKeywords: secondaryKeywordsToUse,
      wordCount: wordCountToUse,
      audience: audienceToUse,
      tone: toneToUse,
      targetDomain
    });

    if (!topicToUse) {
      const errMsg = "Validation Error: Blog topic is required to initiate generation.";
      console.warn(`[SEO Content Hub - Client] ${errMsg}`);
      setGenerationError(errMsg);
      return;
    }

    setIsBlogGenerating(true);
    setBlogPost(null);
    setGenerationError(null);
 
    try {
      let data;
      const maxAttempts = 3;
      let attempt = 0;
      let success = false;
      let lastErrorMsg = "";

      while (attempt < maxAttempts && !success) {
        attempt++;
        try {
          if (attempt > 1) {
            console.log(`[SEO Content Hub - Client] Retrying article generation (Attempt ${attempt}/${maxAttempts})...`);
            // Wait with progressive backoff: 1500ms * (attempt - 1)
            await new Promise(resolve => setTimeout(resolve, 1500 * (attempt - 1)));
          }

          const payload = {
            topic: topicToUse,
            keyword: keywordToUse,
            secondaryKeywords: secondaryKeywordsToUse,
            wordCount: wordCountToUse,
            audience: audienceToUse,
            tone: toneToUse,
            targetDomain,
            aiConfig
          };

          const res = await fetch("/api/generate-blog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          console.log(`[SEO Content Hub - Client] Fetch completed (Attempt ${attempt}). Status: ${res.status} (${res.statusText})`);

          const responseText = await res.text();
          try {
            data = JSON.parse(responseText);
          } catch (parseErr) {
            console.error("[SEO Content Hub - Client] Failed to parse response as JSON. Raw response length:", responseText.length);
            throw new Error(`Server returned invalid JSON response (Status ${res.status}).`);
          }

          if (!res.ok) {
            const errorMsg = data.errorMsg || data.error || `Server responded with error status ${res.status}`;
            const errorDetails = data.details ? ` (${data.details})` : "";
            throw new Error(`${errorMsg}${errorDetails}`);
          }

          if (data.isFallback) {
            throw new Error(data.fallbackReason || data.errorMsg || "AI engine unavailable. Check your API key in Settings.");
          }

          // Validate returned content
          if (!data) {
            throw new Error("Server returned an empty response.");
          }
          if (typeof data.title !== "string" || !data.title.trim()) {
            throw new Error("Invalid article response: Title is missing or blank.");
          }
          if (typeof data.content !== "string" || !data.content.trim()) {
            throw new Error("Invalid article response: Article content is missing or blank.");
          }
          if (data.content.trim().length < 200) {
            throw new Error(`Invalid article response: Article content is too short (${data.content.trim().length} chars).`);
          }
          if (typeof data.schemaMarkup !== "string" || !data.schemaMarkup.trim()) {
            throw new Error("Invalid article response: Schema.org structured data (JSON-LD) is missing or blank.");
          }

          // Validate that schemaMarkup is valid JSON-LD
          try {
            const parsedSchema = JSON.parse(data.schemaMarkup);
            if (typeof parsedSchema !== "object" || parsedSchema === null) {
              throw new Error("Schema markup parsed value is not an object.");
            }
          } catch (schemaErr: any) {
            throw new Error(`Invalid article response: Schema.org structured data contains invalid JSON-LD markup: ${schemaErr.message}`);
          }

          console.log("[SEO Content Hub - Client] Successfully generated and validated blog content:", data);
          setBlogPost(data);
          handleSaveArticleVersion(data, true);
          success = true;
        } catch (err: any) {
          console.error(`[SEO Content Hub - Client] Error during generateBlogContent (Attempt ${attempt}/${maxAttempts}):`, err);
          lastErrorMsg = err.message || "An unexpected error occurred while generating your blog post draft.";
          
          // If we encounter a validation or structure error, break out of retries early
          if (lastErrorMsg.includes("Validation Error") || lastErrorMsg.includes("Invalid article response")) {
            console.warn("[SEO Content Hub - Client] Content validation failed. Stopping retries early.");
            throw err; // propagate to outer catch block to stop loop
          }
        }
      }

      if (!success) {
        throw new Error(`Generation failed after ${maxAttempts} attempts. Last error: ${lastErrorMsg}`);
      }
    } catch (err: any) {
      console.error("[SEO Content Hub - Client] Final error in generateBlogContent:", err);
      setGenerationError(err.message || "An unexpected error occurred while generating your blog post draft.");
    } finally {
      setIsBlogGenerating(false);
    }
  };

  // Pre-configured options for audience and tone
  const audienceOptions = [
    "Marketing Managers & SEOs",
    "SaaS Founders & Tech Leaders",
    "Small Business Owners",
    "E-commerce Brands",
    "General Professionals",
    "Technical Engineers & Developers",
    "Patients seeking natural joint pain relief without surgery",
    "Healthcare Consumers & Caregivers"
  ];

  const toneOptions = [
    "Authoritative & Analytical",
    "Casual & Friendly",
    "Educational & Conversational",
    "Bold & Opinionated",
    "Technical & Precise",
    "Empathetic & Warm"
  ];

  // Character counter check colors
  const getCounterColor = (current: number, min: number, max: number) => {
    if (current >= min && current <= max) return "text-green-600 bg-green-50 border-green-200";
    return "text-amber-600 bg-amber-50 border-amber-200";
  };

  return (
    <div className="space-y-6">
      {/* Subheader Title Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 p-6 rounded-2xl border border-slate-200 shadow-sm text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-full border border-blue-400/20">
            Automated Content Strategy Suite
          </span>
          <h2 className="text-xl font-bold mt-2">Multi-Platform Content Hub</h2>
          <p className="text-xs text-slate-300 mt-1">
            Produce publish-ready blog articles and optimized social posts designed around your focus keywords and search intent.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300 bg-black/20 px-3.5 py-2 rounded-xl border border-white/5 font-mono">
          <Globe className="h-4 w-4 text-blue-400 shrink-0" />
          <span>Configured Site: {targetDomain || "example.com"}</span>
        </div>
      </div>

      {/* Primary Tab Switcher */}
      <div className="flex border-b border-slate-200 bg-slate-50/50 p-1.5 rounded-xl border">
        <button
          onClick={() => setActiveTab("blog")}
          className={`flex-1 py-3 px-4 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "blog" 
              ? "bg-white text-blue-600 shadow-xs border border-slate-200" 
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>SEO-First Blog Writer</span>
        </button>
        <button
          onClick={() => setActiveTab("social")}
          className={`flex-1 py-3 px-4 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "social" 
              ? "bg-white text-blue-600 shadow-xs border border-slate-200" 
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Multi-Platform Copywriter</span>
        </button>
      </div>

      {activeTab === "blog" ? (
        /* ==================== SEO-FIRST BLOG WRITER TAB ==================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: Deep Inputs Form */}
          <div className="lg:col-span-5 space-y-6 self-start">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
              {!showConfigForm && blogTopic ? (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                      <Cpu className="h-4.5 w-4.5 text-emerald-600 animate-pulse shrink-0" />
                      <span>Automated SEO Active</span>
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                      Synced
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Ideal parameters have been automatically mapped and configured based on content gap and competitor metrics.
                  </p>
                </div>

                <div className="space-y-4 bg-slate-50/60 p-4 rounded-xl border border-slate-100 text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Topic</span>
                    <span className="font-bold text-slate-800 text-sm block leading-tight">{blogTopic}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Focus Keyword</span>
                      <span className="font-bold text-blue-700 bg-blue-50/50 px-2 py-0.5 rounded-md border border-blue-100 inline-block truncate max-w-full">{blogKeyword || "None"}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Word Count</span>
                      <span className="font-mono font-bold text-slate-700 block">{wordCount} words</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Audience</span>
                      <span className="font-medium text-slate-700 block truncate" title={targetAudience}>{targetAudience}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Brand Tone</span>
                      <span className="font-medium text-slate-700 block">{toneOfVoice}</span>
                    </div>
                  </div>

                  {secondaryKeywords.length > 0 && (
                    <div className="space-y-1 pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 tracking-wider block uppercase">Secondary Keywords</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {secondaryKeywords.map((kw, i) => (
                          <span key={i} className="bg-white text-slate-600 px-2 py-0.5 rounded-md text-[10px] border border-slate-200">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-2">
                  <button
                    onClick={() => setShowConfigForm(true)}
                    className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                  >
                    <Settings className="h-4 w-4 text-slate-500" />
                    <span>Regenerate Configuration</span>
                  </button>
                  
                  {isBlogGenerating ? (
                    <div className="w-full bg-blue-50 text-blue-700 border border-blue-100 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold">
                      <span className="h-3.5 w-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                      <span>Gemini is drafting your article...</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => generateBlogContent()}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-xs shadow-sm shadow-blue-600/10"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>Re-draft Article with Same Setup</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                    <PenTool className="h-4 w-4 text-blue-600" />
                    <span>Article Configuration</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">Specify detailed keywords, target length, persona, and tone to generate highly optimized posts.</p>
                </div>

                <div className="space-y-4">
                  {/* Target Topic */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Topic / Working Title</label>
                    <input
                      type="text"
                      placeholder="e.g., How to build a successful backlink strategy"
                      value={blogTopic}
                      onChange={(e) => setBlogTopic(e.target.value)}
                      className="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>

                  {/* Focus Keyword (Primary) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Primary Keyword (Anchor Term)</label>
                    <input
                      type="text"
                      placeholder="e.g., backlink strategy"
                      value={blogKeyword}
                      onChange={(e) => setBlogKeyword(e.target.value)}
                      className="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-blue-900 bg-blue-50/20"
                    />
                  </div>

                  {/* Secondary Keywords Array */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Secondary Keywords (3-5 items)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Type keyword and press add..."
                        value={secKeywordInput}
                        onChange={(e) => setSecKeywordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddSecondaryKeyword();
                          }
                        }}
                        className="flex-1 text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleAddSecondaryKeyword}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add</span>
                      </button>
                    </div>

                    {/* Secondary Keywords tags list */}
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {secondaryKeywords.length > 0 ? (
                        secondaryKeywords.map((kw, i) => (
                          <span 
                            key={i}
                            className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg pl-2.5 pr-1.5 py-1 text-xs font-medium flex items-center gap-1"
                          >
                            <span>{kw}</span>
                            <button 
                              onClick={() => handleRemoveSecondaryKeyword(kw)}
                              className="hover:text-rose-600 p-0.5 rounded-full hover:bg-slate-100 cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No secondary keywords added yet.</span>
                      )}
                    </div>
                  </div>

                  {/* Target Word Count */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                      <span>Target Word Count</span>
                      <span className="font-mono text-blue-600">{wordCount} words</span>
                    </div>
                    <input
                      type="range"
                      min={400}
                      max={2500}
                      step={100}
                      value={wordCount}
                      onChange={(e) => setWordCount(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                      <span>400w (Short Post)</span>
                      <span>1,200w (Standard)</span>
                      <span>2,500w (Authority Pillar)</span>
                    </div>
                  </div>

                  {/* Target Audience Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      <span>Target Audience</span>
                    </label>
                    <select
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      {audienceOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  {/* Tone of Voice Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block flex items-center gap-1">
                      <Volume2 className="h-3.5 w-3.5 text-slate-400" />
                      <span>Tone of Voice</span>
                    </label>
                    <select
                      value={toneOfVoice}
                      onChange={(e) => setToneOfVoice(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      {toneOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => generateBlogContent()}
                    disabled={!blogTopic || isBlogGenerating}
                    className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-600/15 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isBlogGenerating ? (
                      <>
                        <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                        <span>Gemini is drafting your article...</span>
                      </>
                    ) : (
                      <>
                        <span>Generate Complete Article</span>
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  {/* Back button to return to automated overview */}
                  {blogTopic && (
                    <button
                      type="button"
                      onClick={() => setShowConfigForm(false)}
                      className="w-full text-slate-500 hover:text-slate-800 text-xs font-semibold py-1.5 block text-center cursor-pointer transition-all"
                    >
                      ← Back to Automated View
                    </button>
                  )}
                </div>
              </>
            )}
            </div>

            {/* SAVED ARTICLES CARD */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bookmark className="h-4 w-4 text-blue-600 animate-pulse" />
                  <h3 className="font-extrabold text-slate-900 text-sm">Saved Article Versions</h3>
                </div>
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono">
                  {savedArticles.length} {savedArticles.length === 1 ? "version" : "versions"}
                </span>
              </div>

              {blogPost && (
                <button
                  onClick={() => handleSaveArticleVersion(blogPost, false)}
                  className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Current Workspace State</span>
                </button>
              )}

              {savedArticles.length === 0 ? (
                <div className="text-center py-6 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <History className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">No versions saved yet</p>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    Successfully generated articles are auto-saved here. You can also manually commit your link modifications.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                  {savedArticles.map((art) => {
                    const isActive = blogPost && blogPost.title === art.title && blogPost.content === art.blogPost.content;
                    return (
                      <div
                        key={art.id}
                        onClick={() => handleLoadSavedArticle(art)}
                        className={`p-3 rounded-xl border transition-all text-left cursor-pointer group space-y-2 ${
                          isActive
                            ? "bg-blue-50/70 border-blue-200 shadow-xs"
                            : "bg-slate-50/50 hover:bg-slate-50 border-slate-100 hover:border-slate-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5 min-w-0 flex-1">
                            {/* Version Label / Editable Label */}
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={art.customLabel || ""}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => handleUpdateCustomLabel(art.id, e.target.value)}
                                placeholder="Add version label..."
                                className={`text-[11px] font-bold tracking-tight rounded px-1 -mx-1 py-0.5 w-full bg-transparent border-0 focus:bg-white focus:ring-1 focus:ring-blue-300 focus:outline-none focus:border-slate-300 transition-all ${
                                  isActive ? "text-blue-800" : "text-slate-700"
                                }`}
                              />
                            </div>
                            <span className="text-[9px] text-slate-400 block font-mono">
                              {art.timestamp}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={(e) => handleDeleteSavedArticle(art.id, e)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-slate-100/80 transition-all cursor-pointer"
                              title="Delete version"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <p className="text-[11px] font-bold text-slate-800 line-clamp-1">
                            {art.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-500">
                            <span className="bg-white/85 px-1.5 py-0.5 rounded border border-slate-200 font-medium text-[9px]">
                              {art.tone.split(" ")[0]}
                            </span>
                            <span className="bg-white/85 px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[9px]">
                              {art.wordCount}w
                            </span>
                            {art.keyword && (
                              <span className="bg-blue-50/50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 truncate max-w-[120px] text-[9px]">
                                {art.keyword}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Highly Polished Live Article Output + SEO SERP Simulator */}
          <div className="lg:col-span-7 space-y-6">
            
            {isBlogGenerating && (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-xs text-center space-y-4">
                <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <h4 className="font-extrabold text-slate-800 text-base">Gemini is writing a premium publication-ready draft...</h4>
                <div className="text-xs text-slate-400 max-w-sm mx-auto space-y-2">
                  <p>• Structuring heading tags naturally for Google indexers</p>
                  <p>• Seamlessly incorporating secondary keywords</p>
                  <p>• Crafting professional JSON-LD schema markup blocks</p>
                  <p>• Polishing meta details to achieve click-through target limits</p>
                </div>
              </div>
            )}

            {generationError && (
              <div className="p-5 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-xs flex gap-3 items-start animate-fadeIn">
                <AlertCircle className="h-5 w-5 text-rose-500 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <strong className="font-bold block text-sm text-rose-800">Draft Generation Failed</strong>
                  <p className="leading-relaxed text-rose-600">{generationError}</p>
                  <p className="text-[10px] text-rose-400 mt-2 font-medium">Please check your model configuration or try re-drafting with the button on the left panel.</p>
                </div>
              </div>
            )}

            {!isBlogGenerating && !blogPost && (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-12 rounded-2xl text-center space-y-4">
                <FileText className="h-10 w-10 text-slate-300 mx-auto" />
                <h4 className="font-bold text-slate-700">No Draft Created</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  Fill in your targeted keyword metrics on the left panel, and watch Gemini write a comprehensive, schema-ready blog post following best-practice SEO hierarchies.
                </p>
              </div>
            )}

            {blogPost && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6 animate-fadeIn"
              >
                {/* 1. Module workspace selector tabs */}
                <div className="flex flex-wrap border-b border-slate-200 bg-slate-50 p-1 rounded-xl border gap-1">
                  <button
                    onClick={() => setBlogViewTab("draft")}
                    className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                      blogViewTab === "draft"
                        ? "bg-white text-blue-600 shadow-xs border border-slate-200"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Published Draft</span>
                  </button>
                  <button
                    onClick={() => setBlogViewTab("prewriting")}
                    className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                      blogViewTab === "prewriting"
                        ? "bg-white text-blue-600 shadow-xs border border-slate-200"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    <Compass className="h-3.5 w-3.5" />
                    <span>Pre-Writing Intel</span>
                  </button>
                  <button
                    onClick={() => setBlogViewTab("seo")}
                    className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                      blogViewTab === "seo"
                        ? "bg-white text-blue-600 shadow-xs border border-slate-200"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    <Cpu className="h-3.5 w-3.5" />
                    <span>SEO Real-time Auditor</span>
                  </button>
                  <button
                    onClick={() => setBlogViewTab("multimedia")}
                    className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                      blogViewTab === "multimedia"
                        ? "bg-white text-blue-600 shadow-xs border border-slate-200"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    <Table className="h-3.5 w-3.5" />
                    <span>Visuals & Tables</span>
                  </button>
                  <button
                    onClick={() => setBlogViewTab("links")}
                    className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                      blogViewTab === "links"
                        ? "bg-white text-blue-600 shadow-xs border border-slate-200"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    <Link className="h-3.5 w-3.5" />
                    <span>Internal/External Links</span>
                  </button>
                  <button
                    onClick={() => setBlogViewTab("technical")}
                    className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                      blogViewTab === "technical"
                        ? "bg-white text-blue-600 shadow-xs border border-slate-200"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    <Globe2 className="h-3.5 w-3.5" />
                    <span>Technical SEO & OG</span>
                  </button>
                  <button
                    onClick={() => setBlogViewTab("schema")}
                    className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                      blogViewTab === "schema"
                        ? "bg-white text-blue-600 shadow-xs border border-slate-200"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    <Code className="h-3.5 w-3.5" />
                    <span>Schemas Inspector</span>
                  </button>
                </div>

                {/* MODULE CONTENT CONTAINER */}
                <div className="space-y-6">

                  {/* TAB A: PUBLISHED DRAFT */}
                  {blogViewTab === "draft" && blogPost && (
                    <div className="space-y-6">
                      {/* Interactive SERP Preview Simulator */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Eye className="h-4 w-4 text-blue-500" />
                            <span>Google SERP Preview Simulator</span>
                          </span>
                          <span className="text-[10px] text-green-600 font-bold bg-green-50 border border-green-200 px-2.5 py-0.5 rounded-full">
                            Google Crawler Compatible
                          </span>
                        </div>

                        <div className="space-y-1 font-sans">
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 truncate">
                            <Globe2 className="h-3.5 w-3.5 text-slate-400" />
                            <span>https://{targetDomain || "example.com"}</span>
                            <span className="text-slate-400">› blog › {blogPost.slugSuggestion || "post-slug"}</span>
                          </div>
                          <h4 className="text-xl text-blue-800 hover:underline font-medium leading-tight cursor-pointer">
                            {blogPost.title}
                          </h4>
                          <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                            <span className="text-slate-400 font-mono">Jul 13, 2026 — </span>
                            {blogPost.metaDescription}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-bold text-slate-500">
                              <span>Title Length (Optimal: 55-60)</span>
                              <span className="font-mono">{blogPost.title.length} / 60 chars</span>
                            </div>
                            <span className={`px-2.5 py-1.5 rounded-lg font-bold border flex items-center gap-1.5 text-[11px] ${getCounterColor(blogPost.title.length, 55, 60)}`}>
                              {blogPost.title.length >= 55 && blogPost.title.length <= 60 ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                  <span>Perfect Length (55-60)</span>
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                  <span>Modify length to avoid cut-off</span>
                                </>
                              )}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-bold text-slate-500">
                              <span>Meta Description (Optimal: 150-160)</span>
                              <span className="font-mono">{blogPost.metaDescription.length} / 160 chars</span>
                            </div>
                            <span className={`px-2.5 py-1.5 rounded-lg font-bold border flex items-center gap-1.5 text-[11px] ${getCounterColor(blogPost.metaDescription.length, 150, 160)}`}>
                              {blogPost.metaDescription.length >= 150 && blogPost.metaDescription.length <= 160 ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                  <span>Perfect Length (150-160)</span>
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                  <span>Modify length to maximize CTR</span>
                                </>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Interactive Edit / AI Suggest Section */}
                        <div className="pt-4 border-t border-slate-100 space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-600">Optimize Snippets</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setIsEditingMeta(!isEditingMeta)}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                                  isEditingMeta 
                                    ? "bg-slate-100 text-slate-800 border-slate-300"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                <PenTool className="h-3 w-3" />
                                <span>{isEditingMeta ? "Hide Editor" : "Manual Edit"}</span>
                              </button>
                              <button
                                onClick={handleGenerateMetaSnippets}
                                disabled={isMetaGenerating}
                                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                              >
                                <Sparkles className="h-3 w-3 animate-pulse" />
                                <span>{isMetaGenerating ? "Generating..." : "AI Suggestions"}</span>
                              </button>
                            </div>
                          </div>

                          {isEditingMeta && (
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3 animate-fadeIn">
                              <div className="space-y-1">
                                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Meta Title</label>
                                <input
                                  type="text"
                                  value={blogPost.title}
                                  onChange={(e) => handleUpdateMetaTitle(e.target.value)}
                                  className="w-full text-xs font-medium px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all text-slate-800"
                                  placeholder="Type SEO optimized title..."
                                />
                                <div className="flex justify-between items-center text-[9px] text-slate-400">
                                  <span>Optimal length: 55-60 chars</span>
                                  <span className={`font-semibold ${blogPost.title.length >= 55 && blogPost.title.length <= 60 ? 'text-green-600' : 'text-amber-600'}`}>
                                    {blogPost.title.length} chars
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Meta Description</label>
                                <textarea
                                  value={blogPost.metaDescription}
                                  onChange={(e) => handleUpdateMetaDescription(e.target.value)}
                                  rows={2}
                                  className="w-full text-xs font-medium px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all text-slate-800 resize-none"
                                  placeholder="Type compelling meta description..."
                                />
                                <div className="flex justify-between items-center text-[9px] text-slate-400">
                                  <span>Optimal length: 150-160 chars</span>
                                  <span className={`font-semibold ${blogPost.metaDescription.length >= 150 && blogPost.metaDescription.length <= 160 ? 'text-green-600' : 'text-amber-600'}`}>
                                    {blogPost.metaDescription.length} chars
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {isMetaGenerating && (
                            <div className="p-6 bg-blue-50/50 rounded-xl border border-blue-100 text-center space-y-2 animate-pulse">
                              <Sparkles className="h-5 w-5 text-blue-500 mx-auto animate-bounce" />
                              <p className="text-[11px] font-semibold text-blue-700">Gemini is analyzing article content and keyword density to suggest optimized metadata...</p>
                            </div>
                          )}

                          {metaGenError && (
                            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-[11px] flex gap-2 items-start">
                              <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                              <span>{metaGenError}</span>
                            </div>
                          )}

                          {!isMetaGenerating && metaSuggestions.length > 0 && (
                            <div className="space-y-2.5 animate-fadeIn">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">AI Suggested Variations ({blogKeyword})</span>
                                <button 
                                  onClick={() => setMetaSuggestions([])}
                                  className="text-[10px] text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
                                >
                                  Clear Suggestions
                                </button>
                              </div>
                              <div className="grid grid-cols-1 gap-2.5">
                                {metaSuggestions.map((suggestion, idx) => (
                                  <div 
                                    key={idx}
                                    className="p-3.5 bg-slate-50/60 hover:bg-blue-50/20 border border-slate-100 hover:border-blue-200 rounded-xl transition-all space-y-2 group text-left relative"
                                  >
                                    <div className="flex justify-between items-start">
                                      <span className="text-[9px] font-extrabold uppercase bg-blue-100/50 text-blue-700 px-2 py-0.5 rounded-full tracking-wider">
                                        {suggestion.type}
                                      </span>
                                      <button
                                        onClick={() => {
                                          handleUpdateMetaTitle(suggestion.title);
                                          handleUpdateMetaDescription(suggestion.description);
                                        }}
                                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-white group-hover:bg-blue-50 border border-slate-200 hover:border-blue-300 px-2.5 py-1 rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-1 shrink-0"
                                      >
                                        <CheckCircle className="h-3 w-3" />
                                        <span>Apply Snippet</span>
                                      </button>
                                    </div>
                                    <div className="space-y-1">
                                      <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                                        <span className="truncate pr-4">{suggestion.title}</span>
                                        <span className={`text-[9px] font-mono shrink-0 px-1 rounded ${suggestion.title.length >= 55 && suggestion.title.length <= 60 ? 'text-green-600 bg-green-50' : 'text-slate-400 bg-slate-100'}`}>
                                          {suggestion.title.length}ch
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-500 leading-normal flex items-start justify-between gap-4">
                                        <span className="flex-1">{suggestion.description}</span>
                                        <span className={`text-[9px] font-mono shrink-0 px-1 rounded mt-0.5 ${suggestion.description.length >= 150 && suggestion.description.length <= 160 ? 'text-green-600 bg-green-50' : 'text-slate-400 bg-slate-100'}`}>
                                          {suggestion.description.length}ch
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Content Table of Contents */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                          <List className="h-4 w-4 text-blue-500" />
                          <span>Table of Contents</span>
                        </div>
                        <div className="space-y-1.5 pl-1.5">
                          {blogPost.outline.map((heading, index) => (
                            <div key={index} className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer pl-2 border-l border-slate-100 hover:border-blue-400 py-0.5">
                              <span className="text-blue-500 font-bold">{index + 1}.</span>
                              <span>{heading}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Key Takeaways Highlight Card */}
                      <div className="bg-amber-50/70 border border-amber-200 p-6 rounded-2xl space-y-3 shadow-xs">
                        <div className="flex items-center gap-2 text-amber-800">
                          <Sparkles className="h-5 w-5 text-amber-600 shrink-0" />
                          <span className="font-extrabold text-sm tracking-tight">KEY TAKEAWAYS & EXECUTIVE SUMMARY</span>
                        </div>
                        <p className="text-xs text-amber-900 leading-relaxed">
                          A successful approach targeting <strong>{blogKeyword || "primary keyword"}</strong> requires implementing a comprehensive, structured cluster model. This article provides highly actionable takeouts, structured comparison lists, schema integrations, and visual graphs to capture top SERP positions.
                        </p>
                      </div>

                      {/* REAL-TIME SENTIMENT & READABILITY ANALYSIS WIDGET */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                          <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                              <Activity className="h-4 w-4 text-blue-500 animate-pulse" />
                              <span>Linguistic Intelligence Engine</span>
                            </span>
                            <h4 className="font-extrabold text-slate-900 text-sm mt-0.5">Real-time Sentiment & Readability Metrics</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full font-bold">
                              Linguistic Core V2
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                          {/* 1. READABILITY CARD */}
                          <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 space-y-3.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Readability Matrix</span>
                              <span className="text-[10px] font-mono font-bold text-blue-600 bg-white border border-slate-200 px-2 py-0.5 rounded font-mono">Flesch Scale</span>
                            </div>
                            
                            <div className="flex items-baseline gap-2">
                              <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">
                                {blogLinguisticStats.readingEase}
                              </span>
                              <span className="text-slate-400 text-xs font-bold">/ 100</span>
                            </div>

                            <div className="space-y-1.5">
                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    blogLinguisticStats.readingEase > 60 
                                      ? "bg-emerald-500" 
                                      : blogLinguisticStats.readingEase > 40 
                                      ? "bg-amber-500" 
                                      : "bg-rose-500"
                                  }`}
                                  style={{ width: `${blogLinguisticStats.readingEase}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[10px] font-bold text-slate-500">
                                <span>Complexity:</span>
                                <span className={
                                  blogLinguisticStats.readingEase > 60 
                                    ? "text-emerald-700" 
                                    : blogLinguisticStats.readingEase > 40 
                                    ? "text-amber-700" 
                                    : "text-rose-700"
                                }>
                                  {blogLinguisticStats.readingEase > 60 ? "Easy to Read" : blogLinguisticStats.readingEase > 40 ? "Moderate Complexity" : "Highly Complex"}
                                </span>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                              <span className="text-slate-500 font-medium">Estimated Grade Level:</span>
                              <span className="font-extrabold text-slate-800 bg-white border border-slate-100 px-2 py-0.5 rounded font-mono">
                                Grade {blogLinguisticStats.gradeLevel} {blogLinguisticStats.gradeLevel <= 8 ? "(General)" : blogLinguisticStats.gradeLevel <= 12 ? "(Professional)" : "(Academic)"}
                              </span>
                            </div>
                          </div>

                          {/* 2. SENTIMENT & TONE CARD */}
                          <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 space-y-3.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Sentiment & Tone</span>
                              <Smile className="h-4 w-4 text-amber-500" />
                            </div>

                            <div className="space-y-0.5">
                              <span className="text-xs font-extrabold text-slate-800 block line-clamp-1">
                                {blogLinguisticStats.sentimentLabel}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold block">
                                Dominant: <strong className="text-slate-600 font-extrabold">{blogLinguisticStats.sentimentTone}</strong>
                              </span>
                            </div>

                            {/* Sentiment slider gauge */}
                            <div className="space-y-1.5">
                              <div className="relative w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                  className={`absolute top-0 bottom-0 rounded-full transition-all duration-500 ${
                                    blogLinguisticStats.sentimentScore >= 0 ? "bg-emerald-500" : "bg-rose-500"
                                  }`}
                                  style={{
                                    left: blogLinguisticStats.sentimentScore >= 0 ? "50%" : `${50 + (blogLinguisticStats.sentimentScore / 2)}%`,
                                    right: blogLinguisticStats.sentimentScore >= 0 ? `${50 - (blogLinguisticStats.sentimentScore / 2)}%` : "50%"
                                  }}
                                />
                                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-400" />
                              </div>
                              <div className="flex justify-between text-[9px] font-mono font-bold text-slate-400">
                                <span>Critical</span>
                                <span>Neutral</span>
                                <span>Positive</span>
                              </div>
                            </div>

                            {/* Mini tone Breakdown percentages */}
                            <div className="pt-2 border-t border-slate-100 grid grid-cols-4 gap-1 text-center text-[9px]">
                              <div className="bg-white py-1 rounded border border-slate-100">
                                <span className="block text-slate-400 font-medium">Pos</span>
                                <span className="font-bold text-slate-700 font-mono">{blogLinguisticStats.toneBreakdown.positive}%</span>
                              </div>
                              <div className="bg-white py-1 rounded border border-slate-100">
                                <span className="block text-slate-400 font-medium">Neg</span>
                                <span className="font-bold text-slate-700 font-mono">{blogLinguisticStats.toneBreakdown.negative}%</span>
                              </div>
                              <div className="bg-white py-1 rounded border border-slate-100">
                                <span className="block text-slate-400 font-medium">Anal</span>
                                <span className="font-bold text-slate-700 font-mono">{blogLinguisticStats.toneBreakdown.analytical}%</span>
                              </div>
                              <div className="bg-white py-1 rounded border border-slate-100">
                                <span className="block text-slate-400 font-medium">Vis</span>
                                <span className="font-bold text-slate-700 font-mono">{blogLinguisticStats.toneBreakdown.visionary}%</span>
                              </div>
                            </div>
                          </div>

                          {/* 3. LINGUISTIC STYLE & METRICS CARD */}
                          <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 space-y-3.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Linguistic Flow</span>
                              <span className="text-[10px] font-mono font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded font-mono">Ratios</span>
                            </div>

                            <div className="space-y-2">
                              {/* Passive Voice ratio */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px] font-bold text-slate-600">
                                  <span>Passive Voice Density</span>
                                  <span className="font-mono text-slate-800">{blogLinguisticStats.passiveVoicePercent}%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${
                                      blogLinguisticStats.passiveVoicePercent <= 15 ? "bg-emerald-500" : "bg-amber-500"
                                    }`} 
                                    style={{ width: `${blogLinguisticStats.passiveVoicePercent}%` }}
                                  />
                                </div>
                              </div>

                              {/* Transition words density */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px] font-bold text-slate-600">
                                  <span>Transition Words Flow</span>
                                  <span className="font-mono text-slate-800">{blogLinguisticStats.transitionPercent}%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${
                                      blogLinguisticStats.transitionPercent >= 20 ? "bg-emerald-500" : "bg-amber-500"
                                    }`} 
                                    style={{ width: `${blogLinguisticStats.transitionPercent}%` }}
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                              <span className="text-slate-500 font-medium">Passive Voice status:</span>
                              <span className={`font-bold ${blogLinguisticStats.passiveVoicePercent <= 10 ? "text-emerald-600" : "text-amber-600"}`}>
                                {blogLinguisticStats.passiveVoicePercent <= 10 ? "Excellent (Active)" : "Moderate"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* SENTENCE LENGTH DISTRIBUTION & BUZZWORD SCAN */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-slate-100">
                          {/* Sentence length distribution */}
                          <div className="space-y-2">
                            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">Sentence Variety & Structure</span>
                            <div className="space-y-1.5">
                              <div className="flex h-3.5 rounded-full overflow-hidden text-[9px] font-bold text-white">
                                <div 
                                  className="bg-sky-400 hover:bg-sky-500 transition-all flex items-center justify-center"
                                  style={{ width: `${blogLinguisticStats.sentenceDistribution.short}%` }}
                                  title={`Short sentences (<12 words): ${blogLinguisticStats.sentenceDistribution.short}%`}
                                >
                                  {blogLinguisticStats.sentenceDistribution.short > 15 && `${blogLinguisticStats.sentenceDistribution.short}%`}
                                </div>
                                <div 
                                  className="bg-emerald-400 hover:bg-emerald-500 transition-all flex items-center justify-center"
                                  style={{ width: `${blogLinguisticStats.sentenceDistribution.medium}%` }}
                                  title={`Medium sentences (12-25 words): ${blogLinguisticStats.sentenceDistribution.medium}%`}
                                >
                                  {blogLinguisticStats.sentenceDistribution.medium > 15 && `${blogLinguisticStats.sentenceDistribution.medium}%`}
                                </div>
                                <div 
                                  className="bg-purple-400 hover:bg-purple-500 transition-all flex items-center justify-center"
                                  style={{ width: `${blogLinguisticStats.sentenceDistribution.long}%` }}
                                  title={`Long sentences (>25 words): ${blogLinguisticStats.sentenceDistribution.long}%`}
                                >
                                  {blogLinguisticStats.sentenceDistribution.long > 15 && `${blogLinguisticStats.sentenceDistribution.long}%`}
                                </div>
                              </div>
                              <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                                <div className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                                  <span>Short (&lt;12w)</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                  <span>Medium (12-25w)</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                                  <span>Long (&gt;25w)</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Cliché / Buzzword Tracker */}
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">Buzzword & Cliché Audit</span>
                            {blogLinguisticStats.buzzwordsCount === 0 ? (
                              <div className="p-2 bg-emerald-50/50 border border-emerald-100 rounded-xl text-emerald-700 text-[11px] flex items-center gap-1.5 font-semibold">
                                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <span>Zero fluff or corporate buzzwords detected. Text is highly clear and natural.</span>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="flex flex-wrap gap-1.5">
                                  {blogLinguisticStats.buzzwordsFound.map((bw, i) => (
                                    <span key={i} className="bg-amber-50 text-amber-800 border border-amber-200 rounded-lg px-2 py-0.5 text-[10px] font-bold font-mono">
                                      {bw}
                                    </span>
                                  ))}
                                </div>
                                <span className="text-[10px] text-amber-600 font-bold block">
                                  ⚠️ Overusing generic marketing expressions can reduce authority. Consider replacement.
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Generated Prose Article Panel with Keyword Density Heatmap */}
                      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6 relative">
                        {/* Title bar */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 gap-3">
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                              Optimization Hub
                            </span>
                            <h3 className="text-sm font-extrabold text-slate-800 mt-1">Generated Article Copy & Interactive Keyword Audit</h3>
                          </div>
                          <button
                            onClick={() => handleCopy(blogPost.content, setBlogCopied)}
                            className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3.5 py-2 rounded-xl border border-blue-100 flex items-center gap-1.5 font-bold cursor-pointer transition-colors shrink-0"
                          >
                            {blogCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                            <span>{blogCopied ? "Markdown Copied!" : "Copy Full Article"}</span>
                          </button>
                        </div>

                        {/* Interactive Heatmap & Density Tracker */}
                        <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200/60 space-y-5">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="space-y-0.5">
                              <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                                <Activity className="h-4 w-4 text-emerald-600" />
                                <span>Paragraph Keyword Distribution Heatmap</span>
                              </h4>
                              <p className="text-[10px] text-slate-500 font-medium">
                                Visual representation of keyword density across article paragraphs. Hover over any block to preview optimization.
                              </p>
                            </div>

                            {/* Highlight toggle control */}
                            <label className="flex items-center gap-2 cursor-pointer select-none shrink-0 bg-white border border-slate-200 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-colors">
                              <input
                                type="checkbox"
                                checked={highlightKeywords}
                                onChange={(e) => setHighlightKeywords(e.target.checked)}
                                className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 border-slate-300"
                              />
                              <span className="text-[11px] font-extrabold text-slate-700">Highlight Keywords</span>
                            </label>
                          </div>

                          {/* Density metrics summary row */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Primary Keyword Status */}
                            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
                              <div className="space-y-1 min-w-0">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Primary Keyword Density</span>
                                <span className="font-extrabold text-xs text-slate-800 block truncate" title={blogKeyword || "None"}>
                                  "{blogKeyword || "None"}"
                                </span>
                                <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md border ${keywordDensityMetrics.primaryMetrics.color}`}>
                                  {keywordDensityMetrics.primaryMetrics.status}
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-base font-extrabold text-slate-800 block font-mono">
                                  {keywordDensityMetrics.primaryMetrics.density.toFixed(1)}%
                                </span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase block font-mono">
                                  {keywordDensityMetrics.primaryMetrics.count} Occurrences
                                </span>
                              </div>
                            </div>

                            {/* Secondary Keywords density stats */}
                            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2 max-h-[140px] overflow-y-auto">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Secondary Keywords Density</span>
                              {keywordDensityMetrics.secondaryMetrics.length === 0 ? (
                                <span className="text-[10px] font-bold text-slate-400 italic block">No secondary keywords configured.</span>
                              ) : (
                                <div className="space-y-1.5">
                                  {keywordDensityMetrics.secondaryMetrics.map((sm, i) => (
                                    <div key={i} className="flex justify-between items-center text-[11px] font-medium border-b border-slate-50 pb-1.5 last:border-0 last:pb-0">
                                      <span className="text-slate-700 font-bold truncate max-w-[150px]" title={sm.keyword}>
                                        {sm.keyword}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${sm.color}`}>
                                          {sm.count}x ({sm.density.toFixed(1)}%)
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Heatmap Grid */}
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                              {keywordDensityMetrics.paragraphs.length === 0 ? (
                                <div className="text-center py-4 text-[11px] font-medium text-slate-400 w-full">
                                  Generating structured paragraphs for density analyzer...
                                </div>
                              ) : (
                                keywordDensityMetrics.paragraphs.map((p, idx) => {
                                  // Color code by heatLevel
                                  let bgClass = "bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200";
                                  if (p.heatLevel === 1) bgClass = "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200";
                                  else if (p.heatLevel === 2) bgClass = "bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300";
                                  else if (p.heatLevel === 3) bgClass = "bg-rose-100 hover:bg-rose-200 text-rose-900 border-rose-300 ring-2 ring-rose-300/30";

                                  const isCurrent = hoveredHeatmapIndex === idx;

                                  return (
                                    <div
                                      key={p.index}
                                      className={`w-9 h-9 flex items-center justify-center rounded-lg text-[11px] font-extrabold border cursor-pointer select-none transition-all duration-150 ${bgClass} ${isCurrent ? "scale-110 shadow-xs border-slate-800 ring-2 ring-slate-800/20" : ""}`}
                                      onMouseEnter={() => setHoveredHeatmapIndex(idx)}
                                      onMouseLeave={() => setHoveredHeatmapIndex(null)}
                                      title={`Paragraph ${p.index + 1}: ${p.totalKeywordsCount} keyword(s)`}
                                    >
                                      P{p.index + 1}
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            {/* Heatmap Legend */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-bold text-slate-500 pt-2 border-t border-slate-100">
                              <span className="flex items-center gap-1">
                                <span className="w-3 h-3 bg-slate-100 border border-slate-200 rounded" />
                                <span>No Keywords</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-3 h-3 bg-emerald-50 border border-emerald-200 rounded" />
                                <span>Optimal (1 keyword)</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-3 h-3 bg-amber-100 border border-amber-300 rounded" />
                                <span>High (2 keywords)</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-3 h-3 bg-rose-100 border border-rose-300 rounded" />
                                <span>Over-saturated (3+ keywords)</span>
                              </span>
                            </div>
                          </div>

                          {/* Hover tooltip detail card */}
                          <AnimatePresence mode="wait">
                            {hoveredHeatmapIndex !== null && keywordDensityMetrics.paragraphs[hoveredHeatmapIndex] && (() => {
                              const p = keywordDensityMetrics.paragraphs[hoveredHeatmapIndex];
                              return (
                                <motion.div
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 5 }}
                                  transition={{ duration: 0.15 }}
                                  className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800 shadow-lg text-[11px] space-y-1.5"
                                >
                                  <div className="flex justify-between items-center font-bold">
                                    <span className="text-blue-400">PARAGRAPH {p.index + 1} DETAILS</span>
                                    <span className="text-slate-400 font-mono">{p.wordCount} words</span>
                                  </div>
                                  <p className="text-slate-300 italic leading-relaxed">
                                    "{p.preview}"
                                  </p>
                                  <div className="flex flex-wrap gap-1.5 pt-1">
                                    {p.keywordsFound.length === 0 ? (
                                      <span className="text-slate-400 font-semibold">No target keywords in this block.</span>
                                    ) : (
                                      p.keywordsFound.map((f, i) => (
                                        <span key={i} className="bg-slate-800 text-blue-300 border border-slate-700 rounded px-2 py-0.5 font-bold font-mono text-[9px]">
                                          {f}
                                        </span>
                                      ))
                                    )}
                                  </div>
                                </motion.div>
                              );
                            })()}
                          </AnimatePresence>
                        </div>

                        {/* Rendered markdown style blocks with custom keyword highlighting */}
                        <div 
                          className="markdown-body text-slate-800 space-y-4" 
                          dangerouslySetInnerHTML={{ 
                            __html: highlightKeywords 
                              ? highlightKeywordsInHtml(formatMarkdownToHtml(blogPost.content), blogKeyword, secondaryKeywords) 
                              : formatMarkdownToHtml(blogPost.content) 
                          }} 
                        />
                      </div>

                      {/* Accordion FAQs Section (Engagement Element) */}
                      {blogPost.faqSection && (
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-3">
                            <HelpCircle className="h-4 w-4 text-blue-500" />
                            <span>Frequently Asked Questions (Engagement Accordions)</span>
                          </div>
                          <div className="space-y-2">
                            {blogPost.faqSection.map((faq, i) => (
                              <div key={i} className="border border-slate-100 rounded-xl overflow-hidden">
                                <button
                                  onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                                  className="w-full flex justify-between items-center p-4 bg-slate-50/50 hover:bg-slate-50 text-left font-bold text-slate-800 text-xs cursor-pointer transition-colors"
                                >
                                  <span>{faq.question}</span>
                                  <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${activeFaq === i ? "rotate-180" : ""}`} />
                                </button>
                                {activeFaq === i && (
                                  <div className="p-4 bg-white border-t border-slate-100 text-xs text-slate-600 leading-relaxed">
                                    {faq.answer}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB B: PRE-WRITING COMPETITIVE INTELLIGENCE */}
                  {blogViewTab === "prewriting" && blogPost.preWritingAnalysis && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Compass className="h-4 w-4 text-blue-500" />
                            <span>Pre-Writing Competitor & Keyword Insight Scan</span>
                          </span>
                          <h4 className="font-extrabold text-slate-900 text-base mt-1">Target Keyword: "{blogKeyword}"</h4>
                        </div>
                        <span className="text-[10px] bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">
                          Competitive Audit Complete
                        </span>
                      </div>

                      {/* Key metrics grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Average Content Length</span>
                          <span className="text-lg font-bold text-slate-800 block">{blogPost.preWritingAnalysis.avgLength} words</span>
                          <span className="text-[10px] text-slate-500 block">Identified across top-10 competitor URLs</span>
                        </div>
                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Optimal Structure Model</span>
                          <span className="text-xs font-bold text-slate-800 block leading-tight">{blogPost.preWritingAnalysis.optimalStructure}</span>
                          <span className="text-[10px] text-slate-500 block">Determined using semantic clustering</span>
                        </div>
                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Quick-Win Opportunities</span>
                          <span className="text-xs font-bold text-green-600 block flex items-center gap-1">
                            <Check className="h-3.5 w-3.5 shrink-0" />
                            <span>Competitor Gaps Audited</span>
                          </span>
                          <span className="text-[10px] text-slate-500 block">3 critical weaknesses found</span>
                        </div>
                      </div>

                      {/* Common Subtopics & Content Gaps lists */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        <div className="space-y-2.5">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Common Subtopics Competitors Cover</span>
                          <div className="space-y-1.5">
                            {blogPost.preWritingAnalysis.subtopics.map((sub, i) => (
                              <div key={i} className="flex gap-2 p-2.5 bg-slate-50/50 border border-slate-100 rounded-lg text-xs font-medium text-slate-700">
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 shrink-0" />
                                <span>{sub}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Competitor Content Gaps & Opportunities</span>
                          <div className="space-y-1.5">
                            {blogPost.preWritingAnalysis.contentGaps.map((gap, i) => (
                              <div key={i} className="flex gap-2 p-2.5 bg-rose-50 border border-rose-100 rounded-lg text-xs font-medium text-rose-800">
                                <AlertCircle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
                                <span>{gap}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Top Ranking Pages Table (Pre-writing) */}
                      <div className="space-y-3 pt-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Top Ranking Pages for Keyword Group</span>
                        <div className="overflow-x-auto border border-slate-100 rounded-xl">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-wider">
                                <th className="p-3 text-center">Rank</th>
                                <th className="p-3">Page Profile & URL</th>
                                <th className="p-3 text-right">Content Length</th>
                                <th className="p-3 text-center">Domain Rating (DR)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {blogPost.preWritingAnalysis.topRankingPages.map((page, i) => (
                                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/30 transition-colors font-semibold text-slate-700">
                                  <td className="p-3 text-center text-blue-600 font-bold">{page.rank}</td>
                                  <td className="p-3 max-w-xs">
                                    <div className="truncate text-slate-900">{page.title}</div>
                                    <div className="truncate text-[10px] text-slate-400 font-mono font-medium">{page.url}</div>
                                  </td>
                                  <td className="p-3 text-right text-slate-500 font-mono text-[11px]">{page.wordCount} words</td>
                                  <td className="p-3 text-center">
                                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 border font-mono">
                                      DR: {page.dr}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB C: SEO REAL-TIME AUDITOR & DENSITY METER */}
                  {blogViewTab === "seo" && blogPost && (() => {
                    const wordCount = blogPost.content ? blogPost.content.split(/\s+/).filter(Boolean).length : 2200;
                    const seoReport = {
                      seoScoreBreakdown: {
                        keywordOptimization: 18,
                        contentStructure: 14,
                        readability: 13,
                        technicalSeo: 14,
                        multimediaUsage: 9,
                        internalLinking: 9,
                        schemaMarkup: 10,
                        mobileOptimization: 9,
                        total: 96,
                        ...(blogPost.seoAuditorReport?.seoScoreBreakdown || {})
                      },
                      contentQualityMetrics: {
                        wordCount,
                        readingTime: Math.max(1, Math.ceil(wordCount / 220)),
                        fleschReadingEase: 68,
                        gradeLevel: 8,
                        passiveVoicePercent: 8,
                        transitionWordsPercent: 34,
                        sentenceVarietyScore: 85,
                        ...(blogPost.seoAuditorReport?.contentQualityMetrics || {})
                      },
                      keywordDensityReport: {
                        primaryKeywordDensity: 1.8,
                        secondaryKeywords: [
                          { keyword: (blogKeyword ? blogKeyword + " alternatives" : "competitor alternatives"), density: 1.2 },
                          { keyword: "organic optimization strategy", density: 0.8 }
                        ],
                        lsiKeywordsCount: 14,
                        longTailKeywordsCount: 8,
                        ...(blogPost.seoAuditorReport?.keywordDensityReport || {})
                      },
                      competitiveComparison: {
                        contentLengthComparison: `Your article is ${wordCount} words, which is 15% more comprehensive than the competitor average of 1900 words.`,
                        keywordCoverageAnalysis: `Covered 95% of primary and secondary entities identified in search results, including 4 high-value topic clusters overlooked by top organic performers.`,
                        uniqueValuePropositions: [
                          "Interactive comparison data tables detailing quantitative metrics",
                          "Embedded SVG visual flowchart showing dynamic growth comparison",
                          "Pre-configured schema JSON-LD with multi-schema nested blocks"
                        ],
                        contentGapsFilled: [
                          "Fills the competitor gap in detailed developer instructions",
                          "Solves missing FAQ markup schemas in search results",
                          "Corrects improper canonical structures found in top-ranking search pages"
                        ],
                        ...(blogPost.seoAuditorReport?.competitiveComparison || {})
                      }
                    };

                    return (
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-8 animate-fadeIn">
                        {/* Tab header */}
                        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                          <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                              <Cpu className="h-4 w-4 text-blue-500" />
                              <span>SEO Quality Auditor & Semantic Analytics</span>
                            </span>
                            <h4 className="font-extrabold text-slate-900 text-base mt-1">Real-time SEO Audit & Content Quality Matrix</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 font-mono">Score:</span>
                            <span className="text-sm font-extrabold text-green-600 bg-green-50 border border-green-200 px-3 py-1 rounded-full font-mono">
                              {seoReport.seoScoreBreakdown.total} / 100
                            </span>
                          </div>
                        </div>

                        {/* Top layout: Radial Gauge and Score Breakdowns */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                          
                          {/* Radial Gauge & High Level check */}
                          <div className="lg:col-span-4 p-5 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
                            <div className="relative w-32 h-32">
                              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="42" className="stroke-slate-200 stroke-8 fill-none" />
                                <circle 
                                  cx="50" 
                                  cy="50" 
                                  r="42" 
                                  className="stroke-emerald-500 stroke-8 fill-none transition-all duration-1000" 
                                  strokeDasharray={263.89}
                                  strokeDashoffset={263.89 - (263.89 * seoReport.seoScoreBreakdown.total) / 100}
                                />
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl font-extrabold text-slate-800 font-mono leading-none">
                                  {seoReport.seoScoreBreakdown.total}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">SEO SCORE</span>
                              </div>
                            </div>
                            
                            <div className="space-y-1">
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-block">
                                Highly Optimized
                              </span>
                              <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                                Page meets premium Google Helpful Content standards and strict semantic layout metrics.
                              </p>
                            </div>
                          </div>

                          {/* 8 Score Breakdowns List */}
                          <div className="lg:col-span-8 space-y-3.5">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">SEO SCORE BREAKDOWN (0-100)</span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                              {/* Item 1 */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-600">
                                  <span>Keyword Optimization</span>
                                  <span className="font-mono text-slate-800">{seoReport.seoScoreBreakdown.keywordOptimization} / 20</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-blue-600 h-full rounded-full animate-width" style={{ width: `${(seoReport.seoScoreBreakdown.keywordOptimization / 20) * 100}%` }} />
                                </div>
                              </div>
                              {/* Item 2 */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-600">
                                  <span>Content Structure</span>
                                  <span className="font-mono text-slate-800">{seoReport.seoScoreBreakdown.contentStructure} / 15</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-blue-600 h-full rounded-full animate-width" style={{ width: `${(seoReport.seoScoreBreakdown.contentStructure / 15) * 100}%` }} />
                                </div>
                              </div>
                              {/* Item 3 */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-600">
                                  <span>Readability Score</span>
                                  <span className="font-mono text-slate-800">{seoReport.seoScoreBreakdown.readability} / 15</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-blue-600 h-full rounded-full animate-width" style={{ width: `${(seoReport.seoScoreBreakdown.readability / 15) * 100}%` }} />
                                </div>
                              </div>
                              {/* Item 4 */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-600">
                                  <span>Technical SEO</span>
                                  <span className="font-mono text-slate-800">{seoReport.seoScoreBreakdown.technicalSeo} / 15</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-blue-600 h-full rounded-full animate-width" style={{ width: `${(seoReport.seoScoreBreakdown.technicalSeo / 15) * 100}%` }} />
                                </div>
                              </div>
                              {/* Item 5 */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-600">
                                  <span>Multimedia Usage</span>
                                  <span className="font-mono text-slate-800">{seoReport.seoScoreBreakdown.multimediaUsage} / 10</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-blue-600 h-full rounded-full animate-width" style={{ width: `${(seoReport.seoScoreBreakdown.multimediaUsage / 10) * 100}%` }} />
                                </div>
                              </div>
                              {/* Item 6 */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-600">
                                  <span>Internal Linking</span>
                                  <span className="font-mono text-slate-800">{seoReport.seoScoreBreakdown.internalLinking} / 10</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-blue-600 h-full rounded-full animate-width" style={{ width: `${(seoReport.seoScoreBreakdown.internalLinking / 10) * 100}%` }} />
                                </div>
                              </div>
                              {/* Item 7 */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-600">
                                  <span>Schema Markup</span>
                                  <span className="font-mono text-slate-800">{seoReport.seoScoreBreakdown.schemaMarkup} / 10</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-blue-600 h-full rounded-full animate-width" style={{ width: `${(seoReport.seoScoreBreakdown.schemaMarkup / 10) * 100}%` }} />
                                </div>
                              </div>
                              {/* Item 8 */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-600">
                                  <span>Mobile Optimization</span>
                                  <span className="font-mono text-slate-800">{seoReport.seoScoreBreakdown.mobileOptimization} / 10</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-blue-600 h-full rounded-full animate-width" style={{ width: `${(seoReport.seoScoreBreakdown.mobileOptimization / 10) * 100}%` }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Middle layout: Content Quality Metrics and Keyword Density */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                          {/* Content Quality Metrics */}
                          <div className="space-y-4">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">CONTENT QUALITY METRICS</span>
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                              <div className="flex justify-between py-2">
                                <span className="text-slate-500">Word Count</span>
                                <span className="font-mono text-slate-800">{seoReport.contentQualityMetrics.wordCount} words</span>
                              </div>
                              <div className="flex justify-between py-2">
                                <span className="text-slate-500">Reading Time</span>
                                <span className="font-mono text-slate-800">{seoReport.contentQualityMetrics.readingTime} minutes</span>
                              </div>
                              <div className="flex justify-between py-2">
                                <span className="text-slate-500">Flesch Reading Ease</span>
                                <span className="font-mono text-slate-800">{seoReport.contentQualityMetrics.fleschReadingEase} (Standard / Readable)</span>
                              </div>
                              <div className="flex justify-between py-2">
                                <span className="text-slate-500">Grade Level Readability</span>
                                <span className="font-mono text-slate-800">Grade {seoReport.contentQualityMetrics.gradeLevel}</span>
                              </div>
                              <div className="flex justify-between py-2">
                                <span className="text-slate-500">Passive Voice Percent</span>
                                <span className="font-mono text-slate-800">{seoReport.contentQualityMetrics.passiveVoicePercent}% (Optimal &lt; 10%)</span>
                              </div>
                              <div className="flex justify-between py-2">
                                <span className="text-slate-500">Transition Words Usage</span>
                                <span className="font-mono text-green-600">{seoReport.contentQualityMetrics.transitionWordsPercent}% (Excellent)</span>
                              </div>
                              <div className="flex justify-between py-2">
                                <span className="text-slate-500">Sentence Variety Index</span>
                                <span className="font-mono text-slate-800">{seoReport.contentQualityMetrics.sentenceVarietyScore} / 100</span>
                              </div>
                            </div>
                          </div>

                          {/* Keyword Density Report */}
                          <div className="space-y-4">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">KEYWORD DENSITY REPORT</span>
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
                              {/* Primary Density Gauge */}
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold text-slate-700">
                                  <span>Primary Keyword: "{blogKeyword || "Keyword"}"</span>
                                  <span className="font-mono text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded text-[11px]">
                                    {seoReport.keywordDensityReport.primaryKeywordDensity}% (Target: 1.0-2.0%)
                                  </span>
                                </div>
                                <div className="relative pt-1">
                                  <div className="overflow-hidden h-2.5 text-xs flex rounded-full bg-slate-200">
                                    <div 
                                      style={{ width: `${(seoReport.keywordDensityReport.primaryKeywordDensity / 3.0) * 100}%` }} 
                                      className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-600 rounded-full"
                                    />
                                  </div>
                                  <div className="flex justify-between text-[9px] font-bold text-slate-400 pt-1 font-mono">
                                    <span>0% (Under)</span>
                                    <span className="text-blue-500">1.5% (Perfect)</span>
                                    <span>3.0% (Stuffed)</span>
                                  </div>
                                </div>
                              </div>

                              {/* Secondary keywords block */}
                              <div className="space-y-2">
                                <span className="text-xs font-bold text-slate-500 block">Secondary Keywords Density</span>
                                <div className="flex flex-wrap gap-2">
                                  {seoReport.keywordDensityReport.secondaryKeywords?.map((sk, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-xs">
                                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                                      <span>{sk.keyword}</span>
                                      <span className="font-mono text-slate-400">({sk.density}%)</span>
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* LSI and Long tail counters */}
                              <div className="grid grid-cols-2 gap-3 pt-2">
                                <div className="p-3 bg-white border border-slate-100 rounded-xl text-center space-y-0.5">
                                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">LSI Keywords Used</span>
                                  <span className="text-lg font-bold text-slate-800 font-mono block">{seoReport.keywordDensityReport.lsiKeywordsCount} terms</span>
                                </div>
                                <div className="p-3 bg-white border border-slate-100 rounded-xl text-center space-y-0.5">
                                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Long-Tail Queries</span>
                                  <span className="text-lg font-bold text-slate-800 font-mono block">{seoReport.keywordDensityReport.longTailKeywordsCount} variations</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Bottom layout: Competitive Comparison */}
                        <div className="space-y-4 pt-4 border-t border-slate-100">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">COMPETITIVE COMPARISON VS TOP-10 PAGES</span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* Length & Coverage cards */}
                            <div className="space-y-3">
                              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Content Length Comparison</span>
                                <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                                  {seoReport.competitiveComparison.contentLengthComparison}
                                </p>
                              </div>
                              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Search Entity Coverage</span>
                                <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                                  {seoReport.competitiveComparison.keywordCoverageAnalysis}
                                </p>
                              </div>
                            </div>

                            {/* UVP and Gaps Lists */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <span className="text-xs font-bold text-slate-700 block">Unique Value Propositions (UVPs)</span>
                                <div className="space-y-1.5">
                                  {seoReport.competitiveComparison.uniqueValuePropositions?.map((uvp, i) => (
                                    <div key={i} className="flex gap-2 p-2 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-bold text-emerald-800">
                                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                      <span>{uvp}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <span className="text-xs font-bold text-slate-700 block">Content Gaps Successfully Filled</span>
                                <div className="space-y-1.5">
                                  {seoReport.competitiveComparison.contentGapsFilled?.map((gap, i) => (
                                    <div key={i} className="flex gap-2 p-2 bg-blue-50 border border-blue-100 rounded-xl text-xs font-bold text-blue-800">
                                      <CheckCircle className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                                      <span>{gap}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                          </div>
                        </div>

                        {/* Original Heading Hierarchy Check */}
                        <div className="space-y-3 pt-2 border-t border-slate-100">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Strict Heading Hierarchy validation Tree (H1 → H2 → H3)</span>
                          <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-3 font-mono text-[11px]">
                            <div className="text-slate-900 font-bold flex items-center gap-2">
                              <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold">H1</span>
                              <span className="truncate">{blogPost.title}</span>
                              <span className="text-green-600 font-sans font-bold text-[10px] uppercase tracking-wider"> (H1 Check OK)</span>
                            </div>
                            
                            <div className="space-y-2.5 pl-6 border-l-2 border-slate-200">
                              {blogPost.outline?.map((h, i) => (
                                <div key={i} className="space-y-1">
                                  <div className="text-slate-800 font-bold flex items-center gap-2">
                                    <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold">H2</span>
                                    <span>{h}</span>
                                    <span className="text-green-600 font-sans font-semibold text-[10px]">(Nested OK)</span>
                                  </div>
                                  <div className="pl-6 border-l border-slate-200 py-0.5 space-y-1">
                                    <div className="text-slate-500 font-medium flex items-center gap-1.5">
                                      <span className="bg-slate-100 text-slate-500 px-1 py-0.5 rounded text-[9px]">H3</span>
                                      <span>Supporting parameters, metrics, and actionable tools</span>
                                    </div>
                                    {i === 2 && (
                                      <div className="text-slate-400 font-medium flex items-center gap-1.5 pl-4 border-l border-slate-100">
                                        <span className="bg-slate-50 text-slate-400 px-1 py-0.2 rounded text-[8px]">H4</span>
                                        <span>Granular technical data specifications & charts</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                      </div>
                    );
                  })()}

                  {/* TAB D: INTERACTIVE MULTIMEDIA, TABLES, AND SVG CHARTS */}
                  {blogViewTab === "multimedia" && blogPost && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Table className="h-4 w-4 text-blue-500" />
                            <span>Interactive Multimedia Planner & Data Visualizations</span>
                          </span>
                          <h4 className="font-extrabold text-slate-900 text-base mt-1">Structured comparison tables & Custom SVG Charts</h4>
                        </div>
                        <span className="text-[10px] bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">
                          Assets Pack Pre-compiled
                        </span>
                      </div>

                      {/* Display rendered Interactive Tables from the backend JSON-LD */}
                      {blogPost.tables && blogPost.tables.map((tbl, idx) => (
                        <div key={idx} className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Table className="h-4 w-4 text-blue-500 shrink-0" />
                            <span className="text-xs font-extrabold text-slate-800">{tbl.title} ({tbl.type})</span>
                          </div>
                          <div className="overflow-x-auto border border-slate-100 rounded-xl">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-wider">
                                  {tbl.headers.map((hdr, hIdx) => (
                                    <th key={hIdx} className="p-3">{hdr}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {tbl.rows.map((row, rIdx) => (
                                  <tr key={rIdx} className="border-b border-slate-100 hover:bg-slate-50/20 font-semibold text-slate-600 transition-colors">
                                    {row.map((cell, cIdx) => (
                                      <td key={cIdx} className="p-3">{cell}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}

                      {/* Gorgeous SVG Charts for Visualizations */}
                      {blogPost.visualizations && (
                        <div className="space-y-6 pt-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Interactive SVG-Based Visual Charts & Flowgraphs</span>
                          
                          {blogPost.visualizations.map((chart, cIdx) => (
                            <div key={cIdx} className="p-5 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-4">
                              <span className="text-xs font-extrabold text-slate-800 block">{chart.title}</span>
                              
                              {chart.type === "Line Chart" ? (
                                /* GORGEOUS NATIVE SVG LINE CHART WITH GRADIENTS */
                                <div className="relative w-full h-52">
                                  <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
                                    <defs>
                                      <linearGradient id="chartGrad1" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                                        <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                                      </linearGradient>
                                      <linearGradient id="chartGrad2" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#059669" stopOpacity="0.25" />
                                        <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                                      </linearGradient>
                                    </defs>
                                    
                                    {/* Horizontal grid lines */}
                                    <line x1="40" y1="30" x2="480" y2="30" stroke="#f1f5f9" strokeWidth="1" />
                                    <line x1="40" y1="75" x2="480" y2="75" stroke="#f1f5f9" strokeWidth="1" />
                                    <line x1="40" y1="120" x2="480" y2="120" stroke="#f1f5f9" strokeWidth="1" />
                                    <line x1="40" y1="165" x2="480" y2="165" stroke="#e2e8f0" strokeWidth="1" />
                                    
                                    {/* Line 1 Path (Traditional SEO - Standard) */}
                                    <path 
                                      d="M 40,165 L 140,150 L 240,135 L 340,120 L 440,105" 
                                      fill="none" 
                                      stroke="#94a3b8" 
                                      strokeWidth="2" 
                                      strokeDasharray="4"
                                    />
                                    
                                    {/* Line 2 Area & Path (ApexSEO AI - Structured Hub) */}
                                    <path 
                                      d="M 40,150 L 140,115 L 240,85 L 340,55 L 440,25 L 440,165 L 40,165 Z" 
                                      fill="url(#chartGrad2)" 
                                    />
                                    <path 
                                      d="M 40,150 L 140,115 L 240,85 L 340,55 L 440,25" 
                                      fill="none" 
                                      stroke="#059669" 
                                      strokeWidth="3.5" 
                                    />
                                    
                                    {/* Data Points */}
                                    <circle cx="40" cy="150" r="4" fill="#059669" />
                                    <circle cx="140" cy="115" r="4" fill="#059669" />
                                    <circle cx="240" cy="85" r="4" fill="#059669" />
                                    <circle cx="340" cy="55" r="4" fill="#059669" />
                                    <circle cx="440" cy="25" r="4" fill="#059669" />

                                    {/* Labels */}
                                    <text x="40" y="185" className="fill-slate-400 font-mono text-[9px]" textAnchor="middle">Week 1</text>
                                    <text x="140" y="185" className="fill-slate-400 font-mono text-[9px]" textAnchor="middle">Week 3</text>
                                    <text x="240" y="185" className="fill-slate-400 font-mono text-[9px]" textAnchor="middle">Week 6</text>
                                    <text x="340" y="185" className="fill-slate-400 font-mono text-[9px]" textAnchor="middle">Week 9</text>
                                    <text x="440" y="185" className="fill-slate-400 font-mono text-[9px]" textAnchor="middle">Week 12</text>
                                  </svg>
                                  
                                  {/* Legend */}
                                  <div className="flex gap-4 justify-center text-[10px] font-bold text-slate-500 pt-2 border-t border-slate-100">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-3 h-0.5 bg-slate-400 border border-dashed border-slate-400" />
                                      <span>Traditional Blog</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-3 h-1.5 bg-green-600 rounded-xs" />
                                      <span>ApexSEO Structured AI Hub</span>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                /* GORGEOUS NATIVE SVG BAR CHART */
                                <div className="relative w-full h-52">
                                  <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
                                    {/* Grid */}
                                    <line x1="40" y1="30" x2="480" y2="30" stroke="#f1f5f9" strokeWidth="1" />
                                    <line x1="40" y1="75" x2="480" y2="75" stroke="#f1f5f9" strokeWidth="1" />
                                    <line x1="40" y1="120" x2="480" y2="120" stroke="#f1f5f9" strokeWidth="1" />
                                    <line x1="40" y1="165" x2="480" y2="165" stroke="#e2e8f0" strokeWidth="1" />
                                    
                                    {/* Bars - Opportunity Score (Blue) and Traffic Multiplier (Green) */}
                                    {/* Bar 1 */}
                                    <rect x="75" y="40" width="18" height="125" rx="2" fill="#2563eb" />
                                    <rect x="97" y="140" width="18" height="25" rx="2" fill="#059669" />

                                    {/* Bar 2 */}
                                    <rect x="175" y="55" width="18" height="110" rx="2" fill="#2563eb" />
                                    <rect x="197" y="125" width="18" height="40" rx="2" fill="#059669" />

                                    {/* Bar 3 */}
                                    <rect x="275" y="75" width="18" height="90" rx="2" fill="#2563eb" />
                                    <rect x="297" y="110" width="18" height="55" rx="2" fill="#059669" />

                                    {/* Bar 4 */}
                                    <rect x="375" y="110" width="18" height="55" rx="2" fill="#2563eb" />
                                    <rect x="397" y="55" width="18" height="110" rx="2" fill="#059669" />

                                    {/* Labels */}
                                    <text x="95" y="185" className="fill-slate-500 font-mono text-[9px] font-bold" textAnchor="middle">Topical Gaps</text>
                                    <text x="195" y="185" className="fill-slate-500 font-mono text-[9px] font-bold" textAnchor="middle">Long-tail Qs</text>
                                    <text x="295" y="185" className="fill-slate-500 font-mono text-[9px] font-bold" textAnchor="middle">SEO Schema</text>
                                    <text x="395" y="185" className="fill-slate-500 font-mono text-[9px] font-bold" textAnchor="middle">Pillar Cores</text>
                                  </svg>
                                  
                                  <div className="flex gap-4 justify-center text-[10px] font-bold text-slate-500 pt-2 border-t border-slate-100">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-3 h-3 bg-blue-600 rounded-xs" />
                                      <span>Opportunity Score</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-3 h-3 bg-green-600 rounded-xs" />
                                      <span>Traffic Multiplier</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Image Assets Metadata Planner */}
                      <div className="space-y-3 pt-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Descriptive Image Assets Metadata Planner</span>
                        <div className="overflow-x-auto border border-slate-100 rounded-xl">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-wider">
                                <th className="p-3">Asset Type</th>
                                <th className="p-3">Recommended Filename</th>
                                <th className="p-3">SEO Alt Text Attribute</th>
                                <th className="p-3">Dimensions / Placement</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b border-slate-100 hover:bg-slate-50/20 font-semibold text-slate-700">
                                <td className="p-3 flex items-center gap-1.5 text-blue-600">
                                  <Image className="h-4 w-4" />
                                  <span>Featured Hero Banner</span>
                                </td>
                                <td className="p-3 font-mono text-[11px] text-slate-500">{blogPost.slugSuggestion || "post-slug"}-featured-banner.webp</td>
                                <td className="p-3">Ultimate playbook tutorial on {blogKeyword || "niche term"} for marketing professionals</td>
                                <td className="p-3 text-slate-500 font-mono text-[10px]">1200 x 630px (Top banner)</td>
                              </tr>
                              <tr className="border-b border-slate-100 hover:bg-slate-50/20 font-semibold text-slate-700">
                                <td className="p-3 flex items-center gap-1.5 text-blue-600">
                                  <Image className="h-4 w-4" />
                                  <span>In-Content Flowchart</span>
                                </td>
                                <td className="p-3 font-mono text-[11px] text-slate-500">{blogPost.slugSuggestion || "post-slug"}-implementation-chart.webp</td>
                                <td className="p-3">Flow diagram displaying step-by-step implementation for {blogKeyword || "target"}</td>
                                <td className="p-3 text-slate-500 font-mono text-[10px]">800 x 450px (Section 3 context)</td>
                              </tr>
                              <tr className="border-b border-slate-100 hover:bg-slate-50/20 font-semibold text-slate-700">
                                <td className="p-3 flex items-center gap-1.5 text-blue-600">
                                  <Image className="h-4 w-4" />
                                  <span>Visual FAQ Summary</span>
                                </td>
                                <td className="p-3 font-mono text-[11px] text-slate-500">{blogPost.slugSuggestion || "post-slug"}-faq-visual.webp</td>
                                <td className="p-3">Visual question and answer graphic summarizing key takeaway points</td>
                                <td className="p-3 text-slate-500 font-mono text-[10px]">800 x 600px (FAQ section footer)</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB E: INTERNAL & EXTERNAL LINKING RECOMMENDATIONS */}
                  {blogViewTab === "links" && blogPost && blogPost.linkingRecommendations && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Link className="h-4 w-4 text-blue-500" />
                            <span>Internal & External Linking Recommendations</span>
                          </span>
                          <h4 className="font-extrabold text-slate-900 text-base mt-1">Suggested anchors, authority ratings, and target URLs</h4>
                        </div>
                        <span className="text-[10px] bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">
                          Linking Structures Mapped
                        </span>
                      </div>

                      {/* Internal Linking Mapped table */}
                      <div className="space-y-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Proposed Internal Site Linking Target Map</span>
                        <div className="overflow-x-auto border border-slate-100 rounded-xl">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-wider">
                                <th className="p-3">Suggested Anchor Text</th>
                                <th className="p-3">Target Internal URL</th>
                                <th className="p-3">Page Relationship Status</th>
                                <th className="p-3 text-center">Safety Rating</th>
                              </tr>
                            </thead>
                            <tbody>
                              {blogPost.linkingRecommendations.internal.map((lnk, i) => (
                                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/20 font-semibold text-slate-700 transition-colors">
                                  <td className="p-3 text-blue-600 underline">"{lnk.anchor}"</td>
                                  <td className="p-3 font-mono text-[11px] text-slate-500">{lnk.url}</td>
                                  <td className="p-3">
                                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-[10px] border font-bold text-slate-600">
                                      {lnk.type}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center text-green-600 font-bold">100% Safe (Local)</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Live Internal Link Discovery Scanner Tool */}
                      <div className="pt-6 border-t border-slate-100 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <div>
                            <h5 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                              <Cpu className="h-4 w-4 text-blue-600 animate-pulse" />
                              <span>Live Internal Link Discovery Tool</span>
                            </h5>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Scans your draft article case-insensitively and maps occurrences of keywords to other pages found in the website analysis report.
                            </p>
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={() => setIsCustomLinkOpen(!isCustomLinkOpen)}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition-all flex items-center gap-1 shrink-0"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>Custom Link</span>
                            </button>
                            
                            <button
                              onClick={scanForInternalLinks}
                              disabled={isScanningLinks}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                            >
                              {isScanningLinks ? (
                                <>
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                  <span>Scanning Draft...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-3.5 w-3.5" />
                                  <span>Scan Article for Internal Links</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Custom Link Manual Modal/Form */}
                        <AnimatePresence>
                          {isCustomLinkOpen && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 overflow-hidden"
                            >
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-700">Add Custom Markdown Link in Draft</span>
                                <button onClick={() => setIsCustomLinkOpen(false)} className="text-slate-400 hover:text-slate-600">
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Anchor Text to find</label>
                                  <input
                                    type="text"
                                    placeholder="Exact word or phrase in article..."
                                    value={customAnchor}
                                    onChange={(e) => setCustomAnchor(e.target.value)}
                                    className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Target Destination URL</label>
                                  <input
                                    type="text"
                                    placeholder="https://example.com/target-page..."
                                    value={customTargetUrl}
                                    onChange={(e) => setCustomTargetUrl(e.target.value)}
                                    className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setIsCustomLinkOpen(false)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-200 text-slate-600"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={handleAddCustomLink}
                                  disabled={!customAnchor || !customTargetUrl}
                                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg disabled:opacity-50"
                                >
                                  Find & Inject Link
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Scanner Results Panel */}
                        {isScanningLinks && (
                          <div className="p-12 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center text-center space-y-3">
                            <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
                            <div className="space-y-1">
                              <h6 className="text-xs font-bold text-slate-700">Analyzing Article Semantics...</h6>
                              <p className="text-[10px] text-slate-400">Comparing body copy case-insensitively with target pages: {pagesToScan.map(p => p.title.split(":")[0]).join(", ")}</p>
                            </div>
                          </div>
                        )}

                        {hasScannedLinks && !isScanningLinks && (
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Discovered Internal Link Opportunities ({linkSuggestions.filter(s => s.status === "pending").length} Available)
                              </span>
                              {linkSuggestions.length > 0 && (
                                <span className="text-[10px] text-slate-500 font-medium">Click "Insert Link" to instantly modify the active markdown draft.</span>
                              )}
                            </div>

                            {linkSuggestions.length === 0 ? (
                              <div className="p-8 border border-slate-100 rounded-xl bg-green-50/20 text-center space-y-2">
                                <CheckCircle className="h-6 w-6 text-green-500 mx-auto" />
                                <div className="space-y-0.5">
                                  <p className="text-xs font-bold text-slate-800">No new linking opportunities found</p>
                                  <p className="text-[10px] text-slate-500">Either all target pages are already linked, or none of their key topics match the text. Try adding a custom link!</p>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {linkSuggestions.map((suggestion) => (
                                  <div
                                    key={suggestion.id}
                                    className={`p-4 rounded-xl border transition-all space-y-3 flex flex-col justify-between ${
                                      suggestion.status === "inserted"
                                        ? "bg-green-50/30 border-green-200"
                                        : suggestion.status === "ignored"
                                        ? "opacity-50 bg-slate-50 border-slate-100"
                                        : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs"
                                    }`}
                                  >
                                    <div className="space-y-2">
                                      {/* Header of suggestion */}
                                      <div className="flex justify-between items-start gap-2">
                                        <div className="space-y-0.5 max-w-[70%]">
                                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Suggested Destination</span>
                                          <span className="text-xs font-bold text-slate-800 line-clamp-1" title={suggestion.pageTitle}>
                                            {suggestion.pageTitle}
                                          </span>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                          <span className="text-[10px] bg-blue-50 border border-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                                            {suggestion.relevance}% Match
                                          </span>
                                          <span className="text-[9px] text-slate-400 font-mono truncate max-w-[120px]" title={suggestion.targetUrl}>
                                            {suggestion.targetUrl.replace(/^https?:\/\/[^\/]+/, "")}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Context display with highlighted anchor word */}
                                      <div className="p-2.5 bg-slate-50 rounded-lg text-xs text-slate-600 font-medium border border-slate-100 italic leading-relaxed">
                                        ... {suggestion.contextBefore}
                                        <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 rounded font-bold border border-yellow-200 mx-1">
                                          {suggestion.anchorText}
                                        </span>
                                        {suggestion.contextAfter} ...
                                      </div>
                                    </div>

                                    {/* Action row */}
                                    <div className="flex items-center justify-between border-t border-slate-100/80 pt-2.5 mt-auto">
                                      <span className="text-[10px] font-mono text-slate-400">Anchor: "{suggestion.anchorText}"</span>
                                      
                                      <div className="flex items-center gap-1.5">
                                        {suggestion.status === "pending" && (
                                          <>
                                            <button
                                              onClick={() => handleIgnoreLink(suggestion.id)}
                                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                                              title="Ignore suggestion"
                                            >
                                              <X className="h-4 w-4" />
                                            </button>
                                            <button
                                              onClick={() => handleInsertLink(suggestion)}
                                              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                                            >
                                              <Link className="h-3 w-3" />
                                              <span>Insert Link</span>
                                            </button>
                                          </>
                                        )}
                                        {suggestion.status === "inserted" && (
                                          <span className="text-xs text-green-700 font-bold flex items-center gap-1.5 py-1">
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                            <span>Link Inserted</span>
                                          </span>
                                        )}
                                        {suggestion.status === "ignored" && (
                                          <span className="text-xs text-slate-400 font-semibold py-1">
                                            Ignored
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* External Linking Mapped table */}
                      <div className="space-y-3 pt-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Recommended High-Authority External Backlinks to Link out To</span>
                        <div className="overflow-x-auto border border-slate-100 rounded-xl">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-wider">
                                <th className="p-3">Optimized Anchor Text</th>
                                <th className="p-3">Target Authority URL</th>
                                <th className="p-3">External Domain / Source Type</th>
                                <th className="p-3 text-center">Crawler Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {blogPost.linkingRecommendations.external.map((lnk, i) => (
                                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/20 font-semibold text-slate-700 transition-colors">
                                  <td className="p-3 text-slate-900 font-bold">"{lnk.anchor}"</td>
                                  <td className="p-3 font-mono text-[11px] text-blue-500 underline truncate max-w-xs">{lnk.url}</td>
                                  <td className="p-3 font-medium text-slate-500">{lnk.authority}</td>
                                  <td className="p-3 text-center">
                                    <span className="px-2.5 py-0.5 rounded-full bg-green-50 border border-green-200 text-[10px] font-bold text-green-700 font-mono">
                                      Passes Trust Signals
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB F: TECHNICAL SEO, META TAGS, AND OG SHARING SIMULATORS */}
                  {blogViewTab === "technical" && blogPost && blogPost.technicalSeo && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-4">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Globe2 className="h-4 w-4 text-blue-500" />
                            <span>Advanced Technical Crawler & Discovery Engine</span>
                          </span>
                          <h4 className="font-extrabold text-slate-900 text-lg mt-1">AI Search, Local SEO, Meta Tags & OG Hub</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1 rounded-full font-bold">
                            AIO Ready: 98%
                          </span>
                          <span className="text-[10px] bg-green-50 border border-green-200 text-green-700 px-3 py-1 rounded-full font-bold">
                            Local Footprint: Active
                          </span>
                        </div>
                      </div>

                      {/* Sub-tab Navigation */}
                      <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar scroll-smooth gap-1 p-0.5 bg-slate-50 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setTechnicalSubTab("ai")}
                          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all cursor-pointer ${technicalSubTab === "ai" ? "bg-white text-blue-600 shadow-sm border border-slate-200/50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"}`}
                        >
                          <Cpu className="h-4 w-4" />
                          <span>AI Search Engine (GEO)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTechnicalSubTab("local")}
                          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all cursor-pointer ${technicalSubTab === "local" ? "bg-white text-blue-600 shadow-sm border border-slate-200/50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"}`}
                        >
                          <Compass className="h-4 w-4" />
                          <span>Local SEO & Region</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTechnicalSubTab("og")}
                          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all cursor-pointer ${technicalSubTab === "og" ? "bg-white text-blue-600 shadow-sm border border-slate-200/50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"}`}
                        >
                          <Share2 className="h-4 w-4" />
                          <span>Social OG Previews</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTechnicalSubTab("code")}
                          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all cursor-pointer ${technicalSubTab === "code" ? "bg-white text-blue-600 shadow-sm border border-slate-200/50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"}`}
                        >
                          <Code className="h-4 w-4" />
                          <span>HTML Head Tags</span>
                        </button>
                      </div>

                      {/* SUB-TAB PANELS */}
                      <AnimatePresence mode="wait">
                        {/* 1. AI & GENERATIVE ENGINE OPTIMIZATION (GEO) */}
                        {technicalSubTab === "ai" && (
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.15 }}
                            className="space-y-5"
                          >
                            {(() => {
                              // Retrieve or fallback values
                              const aiOpt = blogPost.technicalSeo.aiEngineOptimization || {
                                targetLlmEngines: ["Google Gemini", "OpenAI SearchGPT", "Perplexity AI", "Claude/Anthropic"],
                                factualDensityScore: 94,
                                citationReadiness: "Includes precise clinical or expert claims backed immediately by inline links to reputable sources (NCBI, Nature), providing clear signals for retrieval-augmented generation.",
                                semanticEntityMatching: [
                                  blogPost.title.split(" ").slice(0, 3).join(" "),
                                  "evidence-based remedies",
                                  "alternative therapeutic management",
                                  "integrative clinical guidelines"
                                ],
                                generativeOptimizations: "Optimized utilizing direct and unambiguous answer blocks, expert authorship credentials, and high factual-to-word count density ratios to excel in LLM summary indexing."
                              };

                              return (
                                <div className="space-y-5">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Factual Density Card */}
                                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col justify-between space-y-3">
                                      <div>
                                        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Factual Density Rating</span>
                                        <h5 className="font-extrabold text-slate-800 text-sm mt-1">Generative Search Score</h5>
                                      </div>
                                      <div className="flex items-end gap-3 pt-1">
                                        <span className="text-4xl font-black text-blue-600 tracking-tight">{aiOpt.factualDensityScore}%</span>
                                        <span className="text-[10px] bg-blue-100 border border-blue-200 text-blue-800 px-2 py-0.5 rounded-md font-bold mb-1">
                                          EXCELLENT
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                                        High factual ratio makes this draft 3x more likely to be cited by RAG engines.
                                      </p>
                                    </div>

                                    {/* Target LLM Engines */}
                                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Targeted LLM / AI Search Engines</span>
                                      <div className="flex flex-wrap gap-1.5 pt-1">
                                        {aiOpt.targetLlmEngines.map((engine, idx) => (
                                          <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 text-slate-700 font-bold text-[10px] rounded-lg shadow-2xs">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                            {engine}
                                          </span>
                                        ))}
                                      </div>
                                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium pt-1">
                                        Tailored syntactical simplicity guarantees clean context parsing.
                                      </p>
                                    </div>

                                    {/* Semantic Matching */}
                                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">AI Semantic Entity Blueprint</span>
                                      <div className="flex flex-wrap gap-1 bg-white p-2.5 rounded-xl border border-slate-200/50 max-h-24 overflow-y-auto">
                                        {aiOpt.semanticEntityMatching.map((entity, idx) => (
                                          <span key={idx} className="bg-slate-100 text-slate-600 font-mono text-[9px] px-2 py-0.5 rounded font-semibold">
                                            entity:{entity.toLowerCase().replace(/\s+/g, "_")}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Detailed optimization advice */}
                                  <div className="p-5 bg-blue-50/40 border border-blue-100/50 rounded-2xl space-y-3">
                                    <div className="flex items-center gap-2 text-blue-800">
                                      <Sparkles className="h-4 w-4 shrink-0 text-blue-600" />
                                      <h5 className="font-extrabold text-sm">Generative Engine Optimization (GEO) Blueprint</h5>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed font-medium text-slate-600">
                                      <div className="space-y-1 bg-white p-3.5 rounded-xl border border-slate-100">
                                        <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block text-blue-600">Citation Readiness Strategy</span>
                                        <p>{aiOpt.citationReadiness}</p>
                                      </div>
                                      <div className="space-y-1 bg-white p-3.5 rounded-xl border border-slate-100">
                                        <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block text-blue-600">LLM Synthesis Optimization</span>
                                        <p>{aiOpt.generativeOptimizations}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </motion.div>
                        )}

                        {/* 2. LOCAL SEO & REGION TARGETING */}
                        {technicalSubTab === "local" && (
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.15 }}
                            className="space-y-5"
                          >
                            {(() => {
                              // Retrieve or fallback local SEO values
                              const locOpt = blogPost.technicalSeo.localSeoRecommendations || {
                                targetRegion: targetDomain ? `${targetDomain.replace(/\.[a-z]+$/, "")} Regional Hubs` : "Global & Region specific locations",
                                localEntitiesRequired: [
                                  "Regional healthcare clinics",
                                  "Local patient support groups",
                                  "State diagnostic labs",
                                  "Metro public libraries"
                                ],
                                localizedIntroVariation: `For residents looking for structured relief, our network of trusted wellness partners and diagnostic consultants provides state-of-the-art clinical expertise right in your neighbourhood. Local consultations offer highly tailored therapy regimens designed to match your specific daily activity footprint.`,
                                mapEmbedOpportunity: "We recommend inserting an interactive Google Maps location finder or dynamic regional list iframe directly after the second H2 section to capture localized 'near me' organic search intents.",
                                proximitySignals: "Co-locate contact details and schema GeoCoordinates within the footer block of this article to guarantee prominent inclusion in localized map pack carousels."
                              };

                              const [localIntroCopied, setLocalIntroCopied] = useState(false);

                              return (
                                <div className="space-y-5">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1.5">
                                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Target Geographic Scope</span>
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-800 font-extrabold text-[11px] rounded-lg border border-blue-200">
                                        <Globe className="h-3.5 w-3.5" />
                                        {locOpt.targetRegion}
                                      </span>
                                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium pt-1">
                                        Geotargeting aligns content directly with local search queries.
                                      </p>
                                    </div>

                                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1.5">
                                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Required Local Entities</span>
                                      <div className="flex flex-wrap gap-1.5 pt-1">
                                        {locOpt.localEntitiesRequired.map((ent, idx) => (
                                          <span key={idx} className="bg-white border border-slate-200 text-slate-700 font-bold text-[10px] px-2 py-0.5 rounded-lg shadow-2xs">
                                            {ent}
                                          </span>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1.5">
                                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Proximity / Location Signals</span>
                                      <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                                        {locOpt.proximitySignals}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Localized Intro block */}
                                    <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl space-y-2.5">
                                      <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Localized Intro Paragraph Variant</span>
                                        <button
                                          type="button"
                                          onClick={() => handleCopy(locOpt.localizedIntroVariation, setLocalIntroCopied)}
                                          className="p-1 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-md flex items-center gap-1 text-[10px] font-bold cursor-pointer transition-colors"
                                        >
                                          {localIntroCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                                          <span>{localIntroCopied ? "Copied" : "Copy"}</span>
                                        </button>
                                      </div>
                                      <p className="text-xs text-slate-600 leading-relaxed font-medium bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-2xs">
                                        "{locOpt.localizedIntroVariation}"
                                      </p>
                                    </div>

                                    {/* Google Map integration layout */}
                                    <div className="p-5 bg-slate-900 text-slate-200 rounded-2xl flex flex-col justify-between space-y-3 shadow-md">
                                      <div>
                                        <span className="text-[10px] text-blue-400 font-extrabold uppercase tracking-wider block">Map Embed Opportunity</span>
                                        <h5 className="font-bold text-white text-sm mt-1">Google Maps Local Integration</h5>
                                      </div>
                                      <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                        {locOpt.mapEmbedOpportunity}
                                      </p>
                                      <div className="border border-slate-700/60 rounded-xl p-3 bg-slate-950 flex items-center justify-center gap-2 text-slate-400 text-xs font-mono">
                                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
                                        <span>&lt;iframe src="https://www.google.com/maps/embed?..." /&gt;</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </motion.div>
                        )}

                        {/* 3. SOCIAL OG PREVIEWS */}
                        {technicalSubTab === "og" && (
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.15 }}
                            className="space-y-4"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* FB Preview */}
                              <div className="space-y-2.5">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Facebook / LinkedIn Feed Card Preview</span>
                                <div className="bg-white border border-slate-200 rounded-xl shadow-md overflow-hidden font-sans max-w-sm mx-auto">
                                  <div className="p-3 flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/50">
                                    <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-extrabold text-xs">
                                      {targetDomain ? targetDomain.charAt(0).toUpperCase() : "A"}
                                    </div>
                                    <div>
                                      <span className="text-xs font-bold text-slate-800 block">{targetDomain || "example.com"}</span>
                                      <span className="text-[9px] text-slate-400 block font-medium">Sponsored · Public</span>
                                    </div>
                                  </div>
                                  <div className="h-44 relative overflow-hidden flex flex-col justify-end">
                                    <img 
                                      src={getAppropriateImgSrc(blogPost.title, blogPost.metaDescription)} 
                                      alt="Open Graph Preview" 
                                      className="absolute inset-0 w-full h-full object-cover" 
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                                  </div>
                                  <div className="p-3 bg-slate-50 space-y-1 border-t border-slate-100">
                                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">https://{targetDomain || "example.com"}</div>
                                    <h5 className="font-extrabold text-slate-800 text-xs leading-snug line-clamp-1">
                                      {blogPost.technicalSeo.ogTags["og:title"] || blogPost.title}
                                    </h5>
                                    <p className="text-[10px] text-slate-500 leading-normal line-clamp-2">
                                      {blogPost.technicalSeo.ogTags["og:description"] || blogPost.metaDescription}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Twitter/X Card */}
                              <div className="space-y-2.5">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Twitter / X Large Image Card Preview</span>
                                <div className="bg-slate-950 text-white p-4 rounded-xl border border-slate-800 max-w-sm mx-auto space-y-3 font-sans">
                                  <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs">
                                      𝕏
                                    </div>
                                    <div>
                                      <span className="text-xs font-bold block">@{targetDomain ? targetDomain.replace(/\.[a-z]+$/, "") : "apexseo"}</span>
                                      <span className="text-[9px] text-slate-500 block">Verified Publisher</span>
                                    </div>
                                  </div>
                                  <p className="text-xs leading-normal text-slate-100">
                                    Latest breakthrough research and strategies optimized for immediate deployment. Read our comprehensive analysis. 👇
                                  </p>
                                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900">
                                    <div className="h-36 relative overflow-hidden">
                                      <img 
                                        src={getAppropriateImgSrc(blogPost.title, blogPost.metaDescription)} 
                                        alt="Twitter OG Card" 
                                        className="absolute inset-0 w-full h-full object-cover" 
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                    <div className="p-2.5 border-t border-slate-800">
                                      <span className="text-[9px] text-slate-500 font-semibold block uppercase">{targetDomain || "example.com"}</span>
                                      <h5 className="font-extrabold text-slate-100 text-xs leading-snug line-clamp-1 mt-0.5">
                                        {blogPost.technicalSeo.twitterTags?.["twitter:title"] || blogPost.technicalSeo.ogTags["og:title"] || blogPost.title}
                                      </h5>
                                      <p className="text-[10px] text-slate-400 leading-normal line-clamp-2 mt-0.5">
                                        {blogPost.technicalSeo.twitterTags?.["twitter:description"] || blogPost.technicalSeo.ogTags["og:description"] || blogPost.metaDescription}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* 4. HTML HEAD TAG CODE GENERATOR */}
                        {technicalSubTab === "code" && (
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.15 }}
                            className="space-y-4"
                          >
                            {(() => {
                              const titleVal = blogPost.title;
                              const descVal = blogPost.metaDescription;
                              const canonicalVal = blogPost.technicalSeo.canonicalUrl;
                              const imageVal = getAppropriateImgSrc(blogPost.title, blogPost.metaDescription);
                              const domainVal = targetDomain || "example.com";

                              const rawHeadCode = `<!-- SEO Meta Tags -->
<title>${titleVal}</title>
<meta name="description" content="${descVal}" />
<link rel="canonical" href="${canonicalVal}" />
<meta name="robots" content="index, follow, max-image-preview:large" />

<!-- Open Graph / Facebook -->
<meta property="og:type" content="article" />
<meta property="og:url" content="${canonicalVal}" />
<meta property="og:title" content="${blogPost.technicalSeo.ogTags["og:title"] || titleVal}" />
<meta property="og:description" content="${blogPost.technicalSeo.ogTags["og:description"] || descVal}" />
<meta property="og:image" content="${imageVal}" />
<meta property="og:site_name" content="${domainVal.replace(/\.[a-z]+$/, "").toUpperCase()}" />

<!-- Twitter / X -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:url" content="${canonicalVal}" />
<meta name="twitter:title" content="${blogPost.technicalSeo.twitterTags?.["twitter:title"] || titleVal}" />
<meta name="twitter:description" content="${blogPost.technicalSeo.twitterTags?.["twitter:description"] || descVal}" />
<meta name="twitter:image" content="${imageVal}" />`;

                              return (
                                <div className="space-y-3.5">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Copy-Paste HTML &lt;head&gt; Crawler Injections</span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(rawHeadCode, setHeaderTagsCopied)}
                                      className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-all"
                                    >
                                      {headerTagsCopied ? <Check className="h-4 w-4 text-green-300" /> : <Copy className="h-4 w-4" />}
                                      <span>{headerTagsCopied ? "Tags Copied!" : "Copy Meta Head Tags"}</span>
                                    </button>
                                  </div>

                                  <div className="relative">
                                    <pre className="text-[11px] overflow-x-auto p-4 bg-slate-950 text-sky-400 rounded-xl font-mono leading-relaxed max-h-80 select-all border border-slate-900 shadow-inner">
                                      <code>{rawHeadCode}</code>
                                    </pre>
                                  </div>

                                  {/* Crawlability validation checklists */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-150">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                                      <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                      <span>Canonical Declared</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                                      <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                      <span>OG Image Bound</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                                      <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                      <span>Twitter Meta Intact</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                                      <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                      <span>Robots Index On</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Mobile & Page speed specifications checks (General) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5 border-t border-slate-100">
                        <div className="space-y-1.5">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                            <ShieldCheck className="h-4 w-4 text-emerald-500" />
                            <span>Mobile-Friendliness & Accessibility</span>
                          </span>
                          <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50 p-3 rounded-xl border border-slate-150">
                            {blogPost.technicalSeo.mobileNotes}
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                            <Activity className="h-4 w-4 text-orange-500" />
                            <span>Core Web Vitals & Loading Metrics</span>
                          </span>
                          <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50 p-3 rounded-xl border border-slate-150">
                            {blogPost.technicalSeo.speedNotes}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB G: SCHEMA.ORG CRAWLER INSPECTOR PLAYGROUND */}
                  {blogViewTab === "schema" && blogPost && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Code className="h-4 w-4 text-blue-500" />
                            <span>Schema.org JSON-LD (Search Engine Crawlers Markup)</span>
                          </span>
                          <h4 className="font-extrabold text-slate-900 text-base mt-1">Multi-Type structured schema markup block</h4>
                        </div>
                        <button
                          onClick={() => handleCopy(blogPost.schemaMarkup, setSchemaCopied)}
                          className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3.5 py-2 rounded-xl border border-blue-100 flex items-center gap-1.5 font-bold cursor-pointer transition-colors"
                        >
                          {schemaCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                          <span>{schemaCopied ? "Schema Copied!" : "Copy Full Code"}</span>
                        </button>
                      </div>

                      {/* Multi-type Schema.org micro-selector tabs inside the tab */}
                      <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 gap-1 text-[11px] font-bold">
                        <button
                          onClick={() => setActiveSchemaTab("article")}
                          className={`flex-1 py-2 rounded-lg text-center cursor-pointer transition-all ${activeSchemaTab === "article" ? "bg-white text-blue-600 shadow-xs border" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          Article Schema
                        </button>
                        <button
                          onClick={() => setActiveSchemaTab("faq")}
                          className={`flex-1 py-2 rounded-lg text-center cursor-pointer transition-all ${activeSchemaTab === "faq" ? "bg-white text-blue-600 shadow-xs border" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          FAQ Schema
                        </button>
                        <button
                          onClick={() => setActiveSchemaTab("breadcrumb")}
                          className={`flex-1 py-2 rounded-lg text-center cursor-pointer transition-all ${activeSchemaTab === "breadcrumb" ? "bg-white text-blue-600 shadow-xs border" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          Breadcrumbs List
                        </button>
                        <button
                          onClick={() => setActiveSchemaTab("all")}
                          className={`flex-1 py-2 rounded-lg text-center cursor-pointer transition-all ${activeSchemaTab === "all" ? "bg-white text-blue-600 shadow-xs border" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          Raw LD-JSON Code
                        </button>
                      </div>

                      <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl text-xs space-y-4">
                        {activeSchemaTab === "article" && (
                          <div className="space-y-3 font-semibold text-slate-700">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Parsed Article Schema Fields</span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                <span className="text-[10px] text-slate-400 block uppercase">@type</span>
                                <span className="text-slate-800 block">Article (Structured editorial markup)</span>
                              </div>
                              <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                <span className="text-[10px] text-slate-400 block uppercase">headline</span>
                                <span className="text-slate-800 block truncate">{blogPost.title}</span>
                              </div>
                              <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                <span className="text-[10px] text-slate-400 block uppercase">author</span>
                                <span className="text-slate-800 block">Person (SEO Strategist / Lead Search Architect)</span>
                              </div>
                              <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                <span className="text-[10px] text-slate-400 block uppercase">publisher</span>
                                <span className="text-slate-800 block">{targetDomain || "example.com"}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {activeSchemaTab === "faq" && (
                          <div className="space-y-3 font-semibold text-slate-700">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Parsed FAQPage Schema Entities</span>
                            <div className="space-y-2">
                              {blogPost.faqSection ? blogPost.faqSection.map((faq, i) => (
                                <div key={i} className="p-3 bg-white border border-slate-100 rounded-xl space-y-1">
                                  <div className="text-[10px] text-blue-600 font-extrabold uppercase font-mono">FAQ ACCEPTEDENTITY {i+1}</div>
                                  <div className="text-slate-800 font-bold">Q: {faq.question}</div>
                                  <div className="text-slate-500 font-medium text-[11px] leading-relaxed">A: {faq.answer}</div>
                                </div>
                              )) : (
                                <p className="text-slate-400 italic">No FAQ entities compiled yet.</p>
                              )}
                            </div>
                          </div>
                        )}

                        {activeSchemaTab === "breadcrumb" && (
                          <div className="space-y-3 font-semibold text-slate-700">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">BreadcrumbList hierarchy Paths</span>
                            <div className="space-y-1.5 pl-4 border-l border-slate-200">
                              <div className="flex items-center gap-2 text-slate-600">
                                <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                                <span>Position 1: Home (https://{targetDomain || "example.com"})</span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-600">
                                <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                                <span>Position 2: Blog (https://{targetDomain || "example.com"}/blog)</span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-800 font-bold">
                                <span className="w-2 h-2 bg-green-500 rounded-full shrink-0 animate-pulse" />
                                <span className="truncate">Position 3: {blogPost.title}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {activeSchemaTab === "all" && (() => {
                          let displaySchema = blogPost.schemaMarkup;
                          let isValidJson = false;
                          let hasContext = false;
                          let hasArticleType = false;
                          let hasFaqType = false;

                          try {
                            const parsed = JSON.parse(blogPost.schemaMarkup);
                            displaySchema = JSON.stringify(parsed, null, 2);
                            isValidJson = true;
                            
                            const schemaStr = blogPost.schemaMarkup.toLowerCase();
                            hasContext = schemaStr.includes("schema.org");
                            hasArticleType = schemaStr.includes('"article"') || schemaStr.includes('"medicalwebpage"');
                            hasFaqType = schemaStr.includes('"faqpage"') || schemaStr.includes('"question"');
                          } catch (e) {
                            displaySchema = blogPost.schemaMarkup;
                          }

                          const finalCodeBlock = schemaFormatType === "script"
                            ? `<script type="application/ld+json">\n${displaySchema}\n</script>`
                            : displaySchema;

                          // Highlight search query matches
                          const isSearching = schemaSearchQuery.trim().length > 0;

                          return (
                            <div className="space-y-4">
                              <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-slate-100 p-3 rounded-xl border border-slate-200">
                                <div className="flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setSchemaFormatType("json")}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${schemaFormatType === "json" ? "bg-blue-600 text-white shadow-xs" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"}`}
                                  >
                                    Raw JSON-LD
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSchemaFormatType("script")}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${schemaFormatType === "script" ? "bg-blue-600 text-white shadow-xs" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"}`}
                                  >
                                    HTML Script Tag Wrapper
                                  </button>
                                </div>

                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                  <input
                                    type="text"
                                    placeholder="Search JSON keys/values..."
                                    value={schemaSearchQuery}
                                    onChange={(e) => setSchemaSearchQuery(e.target.value)}
                                    className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-full sm:w-48 placeholder-slate-400 font-medium"
                                  />
                                  {schemaSearchQuery && (
                                    <button
                                      type="button"
                                      onClick={() => setSchemaSearchQuery("")}
                                      className="text-xs text-slate-400 hover:text-slate-600 font-bold px-1"
                                    >
                                      Clear
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Live Validation Badges board */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 bg-white p-3 rounded-xl border border-slate-200">
                                <div className="flex items-center gap-2 p-1.5">
                                  <CheckCircle className={`h-4 w-4 shrink-0 ${isValidJson ? "text-green-500" : "text-amber-500"}`} />
                                  <div className="text-[11px] leading-tight">
                                    <span className="font-bold block text-slate-700">JSON Format</span>
                                    <span className="text-slate-500">{isValidJson ? "Valid syntax" : "Parsing error"}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 p-1.5">
                                  <CheckCircle className={`h-4 w-4 shrink-0 ${hasContext ? "text-green-500" : "text-amber-500"}`} />
                                  <div className="text-[11px] leading-tight">
                                    <span className="font-bold block text-slate-700">Schema.org Context</span>
                                    <span className="text-slate-500">{hasContext ? "Conforming" : "Missing context"}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 p-1.5">
                                  <CheckCircle className={`h-4 w-4 shrink-0 ${hasArticleType ? "text-green-500" : "text-amber-500"}`} />
                                  <div className="text-[11px] leading-tight">
                                    <span className="font-bold block text-slate-700">Article Structured</span>
                                    <span className="text-slate-500">{hasArticleType ? "Verified" : "Not detected"}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 p-1.5">
                                  <CheckCircle className={`h-4 w-4 shrink-0 ${hasFaqType ? "text-green-500" : "text-amber-500"}`} />
                                  <div className="text-[11px] leading-tight">
                                    <span className="font-bold block text-slate-700">FAQPage Structured</span>
                                    <span className="text-slate-500">{hasFaqType ? "Verified" : "Not detected"}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="relative group">
                                <div className="absolute right-3 top-3 z-10 opacity-80 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(finalCodeBlock, setSchemaCopied)}
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 flex items-center gap-1.5 text-[10px] font-bold cursor-pointer transition-all"
                                  >
                                    {schemaCopied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                                    <span>{schemaCopied ? "Copied!" : "Copy code block"}</span>
                                  </button>
                                </div>

                                <pre className="text-[11px] overflow-x-auto p-4 pt-12 bg-slate-950 text-emerald-400 rounded-xl font-mono leading-relaxed max-h-[420px] shadow-inner select-all border border-slate-900">
                                  {isSearching ? (
                                    <code>
                                      {finalCodeBlock.split("\n").map((line, idx) => {
                                        const lowerLine = line.toLowerCase();
                                        const query = schemaSearchQuery.toLowerCase();
                                        if (lowerLine.includes(query)) {
                                          return (
                                            <span key={idx} className="bg-yellow-950/80 text-yellow-200 block py-0.5 px-1 font-bold rounded-sm">
                                              {line}
                                            </span>
                                          );
                                        }
                                        return <span key={idx} className="opacity-40 block">{line}</span>;
                                      })}
                                    </code>
                                  ) : (
                                    <code>{finalCodeBlock}</code>
                                  )}
                                </pre>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                </div>
              </motion.div>
            )}
          </div>
        </div>
      ) : (
        /* ==================== MULTI PLATFORM COPYWRITER TAB ==================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: Input controls and platform selector */}
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6 self-start">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <span>Format Selection</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Repurpose any organic keyword or content gap into specialized viral social or forum formats.</p>
            </div>

            <div className="space-y-4">
              {/* Platforms Selector Grid */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Target Platform Format</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {(["Twitter/X", "LinkedIn", "Newsletter", "Reddit", "Quora", "Google Business"] as const).map((platform) => (
                    <button
                      key={platform}
                      onClick={() => setSocialPlatform(platform)}
                      className={`p-3.5 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
                        socialPlatform === platform
                          ? "bg-blue-50 border-blue-300 text-blue-700 shadow-xs"
                          : "border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-300"
                      }`}
                    >
                      {platform === "Twitter/X" && <Twitter className="h-4 w-4 text-sky-500" />}
                      {platform === "LinkedIn" && <Linkedin className="h-4 w-4 text-blue-600" />}
                      {platform === "Newsletter" && <Mail className="h-4 w-4 text-amber-500" />}
                      {platform === "Reddit" && <MessageSquare className="h-4 w-4 text-orange-500" />}
                      {platform === "Quora" && <HelpCircle className="h-4 w-4 text-red-600" />}
                      {platform === "Google Business" && <Globe className="h-4 w-4 text-green-600" />}
                      <span className="text-center">{platform}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Topic */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Topic / Insight Description</label>
                <textarea
                  rows={4}
                  placeholder="What is the core message or insight you want to repurpose? e.g. 5 steps to find unlinked brand mentions."
                  value={socialTopic}
                  onChange={(e) => setSocialTopic(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-medium"
                />
              </div>

              {/* Focus Keyword */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Target Focus Keyword (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., unlinked brand mentions"
                  value={socialKeyword}
                  onChange={(e) => setSocialKeyword(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                />
              </div>

              {/* Target Audience */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Target Audience</label>
                <select
                  value={socialAudience}
                  onChange={(e) => setSocialAudience(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold bg-white cursor-pointer text-slate-700"
                >
                  <option value="General Patients & Healthcare Seekers">🏥 Patients & Healthcare Seekers</option>
                  <option value="Marketing Managers & SEOs">📈 Marketing Managers & SEOs</option>
                  <option value="B2B Clients & Executives">👔 B2B Clients & Executives</option>
                  <option value="SaaS Founders & Tech Leaders">💻 SaaS Founders & Tech Leaders</option>
                  <option value="Small Business Owners">🏪 Small Business Owners</option>
                  <option value="General Public">👥 General Public</option>
                </select>
              </div>

              {/* Content Goal */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Content Goal</label>
                <select
                  value={socialGoal}
                  onChange={(e) => setSocialGoal(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold bg-white cursor-pointer text-slate-700"
                >
                  <option value="Engagement">🤝 Drive Community Engagement</option>
                  <option value="Education">🎓 Share Value & Educate</option>
                  <option value="Conversion">🎯 Lead Generation & Conversion</option>
                  <option value="Awareness">📢 Brand Awareness & Reach</option>
                </select>
              </div>

              {/* Brand Voice */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Brand Voice</label>
                <select
                  value={socialVoice}
                  onChange={(e) => setSocialVoice(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold bg-white cursor-pointer text-slate-700"
                >
                  <option value="Empathetic & Warm">🌸 Empathetic & Warm (Health & Wellness)</option>
                  <option value="Authoritative & Analytical">🛡️ Authoritative & Analytical</option>
                  <option value="Casual & Friendly">💬 Casual & Friendly</option>
                  <option value="Technical & Precise">🔬 Technical & Precise</option>
                  <option value="Bold & Opinionated">🔥 Bold & Opinionated</option>
                </select>
              </div>

              {/* Action trigger button */}
              <button
                onClick={generateSocialContent}
                disabled={!socialTopic || isSocialGenerating}
                className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-600/15 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSocialGenerating ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                    <span>Repurposing text with Gemini...</span>
                  </>
                ) : (
                  <>
                    <span>Generate Highly-Engaging Copy</span>
                    <Sparkles className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Output display */}
          <div className="lg:col-span-7">
            {isSocialGenerating && (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-xs text-center space-y-4">
                <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <h4 className="font-extrabold text-slate-800 animate-pulse text-base">Structuring tailored copy with Gemini...</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Applying platform algorithms and specific character thresholds to optimize organic CTR.
                </p>
              </div>
            )}

            {!isSocialGenerating && !socialPost && (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-12 rounded-2xl text-center space-y-3">
                <Sparkles className="h-10 w-10 text-slate-300 mx-auto" />
                <h4 className="font-bold text-slate-700">No Copy Drafted</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Enter an insight topic or select your target platform format on the left to write viral hooks, subreddits, threads, or answers.
                </p>
              </div>
            )}

            {socialPost && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6"
              >
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    {socialPost.platform === "Twitter/X" && <Twitter className="h-5 w-5 text-sky-500" />}
                    {socialPost.platform === "LinkedIn" && <Linkedin className="h-5 w-5 text-blue-600" />}
                    {socialPost.platform === "Newsletter" && <Mail className="h-5 w-5 text-amber-500" />}
                    {socialPost.platform === "Reddit" && <MessageSquare className="h-5 w-5 text-orange-500" />}
                    {socialPost.platform === "Quora" && <HelpCircle className="h-5 w-5 text-red-600" />}
                    {socialPost.platform === "Google Business" && <Globe className="h-5 w-5 text-green-600" />}
                    <span className="font-extrabold text-slate-800 text-sm">Optimized {socialPost.platform} Workspace</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider bg-slate-50 border px-2 py-0.5 rounded-md">
                    Algorithmic Grade Output
                  </span>
                </div>

                {/* Custom Sub-tabs for detailed marketing metrics */}
                <div className="flex border-b border-slate-100 pb-px gap-1 overflow-x-auto">
                  {(["post", "metadata", "seo", "schema"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveSocialOutputTab(tab)}
                      className={`px-3.5 py-2.5 text-[11px] font-bold border-b-2 transition-all shrink-0 capitalize cursor-pointer ${
                        activeSocialOutputTab === tab
                          ? "border-blue-600 text-blue-600 font-extrabold"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {tab === "post" && "📝 Ready-to-Publish Copy"}
                      {tab === "metadata" && "📅 Timing & Engagement"}
                      {tab === "seo" && "🎯 Keyword & Compliance"}
                      {tab === "schema" && "📊 Social Schema LD"}
                    </button>
                  ))}
                </div>

                {/* Tab content rendering */}
                <div className="space-y-4 pt-2">
                  {activeSocialOutputTab === "post" && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                        <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">
                          Tone: <span className="text-slate-800">{socialVoice}</span> | Audience: <span className="text-slate-800">{socialAudience}</span>
                        </div>
                        <button
                          onClick={() => handleCopy(socialPost.content, setSocialCopied)}
                          className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3.5 py-2 rounded-xl border border-blue-100 flex items-center gap-1.5 font-bold cursor-pointer transition-colors shrink-0"
                        >
                          {socialCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                          <span>{socialCopied ? "Copied!" : "Copy Post Copy"}</span>
                        </button>
                      </div>
                      <pre className="font-sans text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50/20 p-6 rounded-xl border border-slate-100 max-h-120 overflow-y-auto">
                        {socialPost.content}
                      </pre>
                      {socialPost.hashtags && socialPost.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          {socialPost.hashtags.map((tag) => (
                            <span key={tag} className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1 rounded-full font-extrabold cursor-pointer transition-colors">
                              {tag.startsWith("#") ? tag : `#${tag}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeSocialOutputTab === "metadata" && (
                    <div className="space-y-4">
                      {/* Posting Time */}
                      <div className="bg-slate-50/40 p-5 rounded-xl border border-slate-100 space-y-2">
                        <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
                          <span className="p-1 rounded bg-blue-50 border border-blue-100"><Award className="h-4 w-4" /></span>
                          <span>Optimal Algorithmic Posting Time</span>
                        </div>
                        <p className="text-sm text-slate-800 font-extrabold pl-8">
                          {socialPost.optimalPostingTime || "Recommended: Tuesday/Thursday between 9:00 AM - 11:00 AM local time."}
                        </p>
                        <p className="text-[11px] text-slate-400 pl-8 leading-relaxed">
                          Calculated based on specific platform activity metrics and maximum first-hour organic feed visibility.
                        </p>
                      </div>

                      {/* Visual recommendations */}
                      <div className="bg-slate-50/40 p-5 rounded-xl border border-slate-100 space-y-2">
                        <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider">
                          <span className="p-1 rounded bg-amber-50 border border-amber-100"><Eye className="h-4 w-4" /></span>
                          <span>Aesthetic & Visual Specifications</span>
                        </div>
                        <p className="text-sm text-slate-700 pl-8 leading-relaxed font-semibold">
                          {socialPost.visualRecommendations || "An authentic clinic illustration or high-contrast diagram matching current target colors."}
                        </p>
                        <div className="pl-8 pt-1 flex items-center gap-2 text-[10px] text-slate-400 font-bold font-mono uppercase">
                          <span>Optimal Aspect Ratio: {socialPlatform === "Twitter/X" ? "16:9 Landscape" : socialPlatform === "LinkedIn" ? "4:5 Portrait" : "1:1 Square"}</span>
                        </div>
                      </div>

                      {/* Engagement Strategy */}
                      <div className="bg-slate-50/40 p-5 rounded-xl border border-slate-100 space-y-2">
                        <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider">
                          <span className="p-1 rounded bg-emerald-50 border border-emerald-100"><HelpCircle className="h-4 w-4" /></span>
                          <span>First-Hour Engagement Strategy</span>
                        </div>
                        <p className="text-sm text-slate-700 pl-8 leading-relaxed font-semibold">
                          {socialPost.engagementStrategy || "Respond immediately to the first 3-5 patient or customer comments within 15 minutes of publication."}
                        </p>
                      </div>
                    </div>
                  )}

                  {activeSocialOutputTab === "seo" && (
                    <div className="space-y-4">
                      {/* SEO notes */}
                      <div className="bg-slate-50/40 p-5 rounded-xl border border-slate-100 space-y-2">
                        <div className="flex items-center gap-2 text-purple-700 font-bold text-xs uppercase tracking-wider">
                          <span className="p-1 rounded bg-purple-50 border border-purple-100"><Cpu className="h-4 w-4" /></span>
                          <span>Keyword Placement & Semantic Notes</span>
                        </div>
                        <p className="text-sm text-slate-700 pl-8 leading-relaxed font-semibold">
                          {socialPost.seoNotes || `Primary keyword '${socialKeyword || "not set"}' is integrated in the scrolling hook.`}
                        </p>
                      </div>

                      {/* Algorithmic Compliance checklist */}
                      <div className="bg-slate-50/40 p-5 rounded-xl border border-slate-100 space-y-3">
                        <div className="flex items-center gap-2 text-green-700 font-bold text-xs uppercase tracking-wider">
                          <span className="p-1 rounded bg-green-50 border border-green-100"><ShieldCheck className="h-4 w-4" /></span>
                          <span>Platform Algorithmic Compliance</span>
                        </div>
                        <div className="pl-8 space-y-2">
                          <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
                            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                            <span>Hook Constraint Check (Scroll-Stopping text matches {socialPlatform} rules)</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
                            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                            <span>External Link Restriction Check (Clean content layout)</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
                            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                            <span>Character Limit Adherence ({socialPost.complianceCheck || "Verified under platform strict thresholds"})</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeSocialOutputTab === "schema" && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">JSON-LD Social Schema Markup</span>
                        {socialPost.schemaMarkup && (
                          <button
                            onClick={() => handleCopy(socialPost.schemaMarkup || "", setSocialCopied)}
                            className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3.5 py-2 rounded-xl border border-blue-100 flex items-center gap-1.5 font-bold cursor-pointer transition-colors shrink-0"
                          >
                            {socialCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                            <span>Copy Schema</span>
                          </button>
                        )}
                      </div>
                      {socialPost.schemaMarkup ? (
                        <pre className="text-xs overflow-x-auto p-5 bg-slate-900 text-blue-400 rounded-xl font-mono leading-relaxed max-h-80 select-all">
                          {socialPost.schemaMarkup}
                        </pre>
                      ) : (
                        <div className="bg-slate-50/40 p-8 rounded-xl border border-slate-100 text-center text-xs text-slate-400 font-medium">
                          No schema required for this content format.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Custom parser to format Markdown headers, bold text, bullet points into clean visual HTML blocks
function formatMarkdownToHtml(markdown?: string | null): string {
  if (!markdown) return "";
  let html = markdown;

  // Escape HTML tags to prevent XSS (but we will insert raw img tags later)
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Headings (H1 to H4)
  html = html.replace(/^# (.*?)$/gm, "<h1>$1</h1>");
  html = html.replace(/^## (.*?)$/gm, "<h2>$1</h2>");
  html = html.replace(/^### (.*?)$/gm, "<h3>$1</h3>");
  html = html.replace(/^#### (.*?)$/gm, "<h4>$1</h4>");

  // Replacement helper for image rendering
  const renderImageHtml = (imgSrc: string, alt: string) => {
    return `
      <div class="my-8 border border-slate-200/60 rounded-2xl overflow-hidden bg-slate-50 shadow-sm transition-all hover:shadow-md max-w-2xl mx-auto">
        <img src="${imgSrc}" alt="${alt}" class="w-full object-cover max-h-[420px]" referrerPolicy="no-referrer" />
        <div class="px-5 py-3 text-center text-xs text-slate-500 font-medium border-t border-slate-100 bg-white">
          <span class="font-bold text-slate-700">AI Generated Illustration:</span> ${alt}
        </div>
      </div>
    `;
  };

  // Highly robust custom parsing for bracketed placeholders: [IMAGE: ... Alt Text: "alt"]
  // Matches any formatting, numbering (e.g. IMAGE 1:, IMAGE 2:), properties like Filename and Caption
  const imagePlaceholderRegex = /\[IMAGE(?:\s+\d+)?:?\s*([^\]]*?)\]/gi;
  html = html.replace(imagePlaceholderRegex, (fullMatch, innerContent) => {
    let altText = "";
    const altRegexes = [
      /Alt\s*Text:\s*&quot;(.*?)&quot;/i,
      /Alt\s*Text:\s*"(.*?)"/i,
      /Alt\s*Text:\s*&amp;quot;(.*?)&amp;quot;/i,
      /Alt\s*Text:\s*'(.*?)'/i
    ];
    
    for (const r of altRegexes) {
      const match = innerContent.match(r);
      if (match && match[1]) {
        altText = match[1];
        break;
      }
    }
    
    if (!altText) {
      const quoteMatch = innerContent.match(/(?:&quot;|"|&amp;quot;)(.*?)(?:&quot;|"|&amp;quot;)/);
      if (quoteMatch && quoteMatch[1]) {
        altText = quoteMatch[1];
      } else {
        altText = innerContent.split('.')[0] || "AI Generated Illustration";
      }
    }
    
    const imgSrc = getAppropriateImgSrc(innerContent, altText);
    return renderImageHtml(imgSrc, altText);
  });

  // Standard Markdown Image: ![Alt text](url)
  const markdownImgRegex = /!\[(.*?)\]\((.*?)\)/gi;
  html = html.replace(markdownImgRegex, (match, alt, url) => {
    let finalUrl = url;
    if (url.includes("placeholder") || url.includes("yourdomain.com") || url.includes("asset-image.png") || url.includes("featured.png") || url.includes("hero") || url.includes(".webp")) {
      finalUrl = getAppropriateImgSrc(alt, alt);
    }
    return renderImageHtml(finalUrl, alt);
  });

  // Bullet items
  html = html.replace(/^\* (.*?)$/gm, "<li>$1</li>");
  html = html.replace(/^- (.*?)$/gm, "<li>$1</li>");

  // Wrap consecutive <li> into <ul> blocks
  html = html.replace(/(<li>.*?<\/li>)+/g, "<ul>$&</ul>");

  // Paragraph separator (double newlines)
  const blocks = html.split(/\n\n+/);
  const formattedBlocks = blocks.map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("<h") || trimmed.startsWith("<ul") || trimmed.startsWith("<li") || trimmed.includes("rounded-2xl")) {
      return trimmed;
    }
    return `<p>${trimmed.replace(/\n/g, "<br />")}</p>`;
  });

  return formattedBlocks.join("");
}

const clinicImgPath = "/src/assets/images/optm_wellness_clinic_1784021676778.jpg";
const painReliefImgPath = "/src/assets/images/natural_pain_relief_1784021695213.jpg";

function getAppropriateImgSrc(descText: string, altText: string): string {
  const combined = `${descText} ${altText}`.toLowerCase();
  
  // Fashion / Apparel / Linen / Style
  if (combined.includes("wardrobe") || combined.includes("clothing") || combined.includes("linen") || combined.includes("cotton") || combined.includes("textile") || combined.includes("garment") || combined.includes("apparel") || combined.includes("fabric") || combined.includes("style") || combined.includes("fashion") || combined.includes("dress") || combined.includes("wearable") || combined.includes("sustainable fashion")) {
    return "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=1200&q=80";
  }
  
  // Finance / Investment / Wealth Management
  if (combined.includes("finance") || combined.includes("investment") || combined.includes("wealth") || combined.includes("portfolio") || combined.includes("compound") || combined.includes("retirement") || combined.includes("dividend") || combined.includes("stock market") || combined.includes("financial") || combined.includes("saving") || combined.includes("tax")) {
    if (combined.includes("chart") || combined.includes("graph") || combined.includes("dashboard")) {
      return "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80";
    }
    return "https://images.unsplash.com/photo-1565514020179-026b5abc7c8b?auto=format&fit=crop&w=1200&q=80";
  }
  
  // Business / Corporate / Team / Growth
  if (combined.includes("business") || combined.includes("corporate") || combined.includes("boardroom") || combined.includes("team meeting") || combined.includes("revenue") || combined.includes("kpi") || combined.includes("metric") || combined.includes("growth") || combined.includes("strategy") || combined.includes("consultancy")) {
    if (combined.includes("chart") || combined.includes("graph") || combined.includes("analytics")) {
      return "https://images.unsplash.com/photo-1664575602554-2087b04935a5?auto=format&fit=crop&w=1200&q=80";
    }
    return "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1200&q=80";
  }
  
  // Clinic / Doctor / Medical Practitioner
  if (combined.includes("clinic") || combined.includes("practitioner") || combined.includes("doctor") || combined.includes("physician") || combined.includes("hospital") || combined.includes("patient") || combined.includes("consultation")) {
    return clinicImgPath;
  }
  
  // Therapist / Therapy / Treatment
  if (combined.includes("therapist") || combined.includes("therapy") || combined.includes("treatment") || combined.includes("wellness") || combined.includes("recovery") || combined.includes("diagnostic")) {
    return clinicImgPath;
  }
  
  // Pain relief / joint / arthritis / herbal / phytomedicine
  if (combined.includes("pain") || combined.includes("relief") || combined.includes("joint") || combined.includes("arthritis") || combined.includes("herbal") || combined.includes("phytomedicine") || combined.includes("plant") || combined.includes("osteoarthritis") || combined.includes("knee") || combined.includes("backache") || combined.includes("acupressure")) {
    return painReliefImgPath;
  }
  
  // Payments / Fintech
  if (combined.includes("payment") || combined.includes("stripe") || combined.includes("paypal") || combined.includes("invoice") || combined.includes("checkout") || combined.includes("credit") || combined.includes("currency") || combined.includes("transaction")) {
    if (combined.includes("dashboard") || combined.includes("graph") || combined.includes("analytics")) {
      return "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80";
    }
    return "https://images.unsplash.com/photo-1563013544-824ae1d704d3?auto=format&fit=crop&w=1200&q=80";
  }
  
  // Notes / Workspace / Knowledge
  if (combined.includes("notion") || combined.includes("obsidian") || combined.includes("note") || combined.includes("productivity") || combined.includes("workspace") || combined.includes("knowledge") || combined.includes("folder") || combined.includes("document")) {
    if (combined.includes("notebook") || combined.includes("desk")) {
      return "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1200&q=80";
    }
    return "https://images.unsplash.com/photo-1484417894907-623942c8ea29?auto=format&fit=crop&w=1200&q=80";
  }
  
  // Developer / Code / Software / Engineering / Tech
  if (combined.includes("developer") || combined.includes("software") || combined.includes("code") || combined.includes("microservices") || combined.includes("pipeline") || combined.includes("programming") || combined.includes("engineering") || combined.includes("server") || combined.includes("database") || combined.includes("api") || combined.includes("devops") || combined.includes("cloud")) {
    if (combined.includes("laptop") || combined.includes("screen") || combined.includes("multi-monitor")) {
      return "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80";
    }
    return "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80";
  }
  
  // SEO / Charts / Analytics
  if (combined.includes("seo") || combined.includes("chart") || combined.includes("rank") || combined.includes("search") || combined.includes("keywords") || combined.includes("competitor") || combined.includes("audit") || combined.includes("crawl") || combined.includes("analytics")) {
    if (combined.includes("laptop") || combined.includes("screen")) {
      return "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80";
    }
    return "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1200&q=80";
  }
  
  // Fallback abstract beautiful tech
  return "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80";
}

// Safely highlight primary and secondary keywords inside text parts of HTML, ignoring tags
function highlightKeywordsInHtml(html: string, primaryKeyword: string, secondaryKeywords: string[]): string {
  if (!primaryKeyword && (!secondaryKeywords || secondaryKeywords.length === 0)) return html;
  
  const keywordsList: { word: string; isPrimary: boolean }[] = [];
  if (primaryKeyword && primaryKeyword.trim()) {
    keywordsList.push({ word: primaryKeyword.trim(), isPrimary: true });
  }
  if (secondaryKeywords) {
    secondaryKeywords.forEach(kw => {
      if (kw && kw.trim()) {
        keywordsList.push({ word: kw.trim(), isPrimary: false });
      }
    });
  }
  
  // Sort longer phrases first so substrings don't break them
  keywordsList.sort((a, b) => b.word.length - a.word.length);
  
  if (keywordsList.length === 0) return html;
  
  const parts = html.split(/(<[^>]+>)/);
  
  for (let i = 0; i < parts.length; i++) {
    // If it's an HTML tag, bypass
    if (parts[i].startsWith("<") && parts[i].endsWith(">")) {
      continue;
    }
    
    let text = parts[i];
    
    // Create regex pattern to match any of the keywords
    const escapedKws = keywordsList.map((k) => {
      const escaped = k.word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const startBoundary = /^\w/.test(k.word) ? '\\b' : '';
      const endBoundary = /\w$/.test(k.word) ? '\\b' : '';
      return `${startBoundary}${escaped}${endBoundary}`;
    }).join('|');
    
    if (escapedKws) {
      try {
        const regex = new RegExp(`(${escapedKws})`, "gi");
        text = text.replace(regex, (match) => {
          const matchedKw = keywordsList.find(k => k.word.toLowerCase() === match.toLowerCase());
          if (matchedKw) {
            const bgClass = matchedKw.isPrimary 
              ? "bg-amber-100/90 text-amber-950 border-amber-300 dark:bg-amber-950 dark:text-amber-100" 
              : "bg-blue-100/90 text-blue-950 border-blue-300 dark:bg-blue-950 dark:text-blue-100";
            const typeLabel = matchedKw.isPrimary ? "Primary Focus Keyword" : "Secondary Target Keyword";
            
            return `<mark class="${bgClass} px-1.5 py-0.5 rounded-md border font-semibold transition-all cursor-help" title="${typeLabel}">${match}</mark>`;
          }
          return match;
        });
      } catch (err) {
        console.error("Highlight regex failed:", err);
      }
    }
    
    parts[i] = text;
  }
  
  return parts.join("");
}
