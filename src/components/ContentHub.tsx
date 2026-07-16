import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles, FileText, Globe, Globe2, AlertCircle, Code, Compass, Cpu,
  Image, Link, Eye, List, Share2, Table,
} from "lucide-react";
import { motion } from "motion/react";

import type { ContentHubProps, LinkSuggestion, SavedArticle, BlogPost } from "./content-hub/types";
import { analyzeTextLinguistics } from "./content-hub/linguistics";
import { computeKeywordDensityMetrics } from "./content-hub/keywordDensity";
import {
  generateBlogPost,
  ensureSchemaString,
  validateBlogResponse,
} from "./content-hub/generation";
import SocialPanel from "./content-hub/SocialPanel";
import BlogSchemaPanel from "./content-hub/BlogSchemaPanel";
import BlogConfigSidebar from "./content-hub/BlogConfigSidebar";
import BlogDraftPanel from "./content-hub/BlogDraftPanel";
import BlogPrewritingPanel from "./content-hub/BlogPrewritingPanel";
import BlogSeoPanel from "./content-hub/BlogSeoPanel";
import BlogMultimediaPanel from "./content-hub/BlogMultimediaPanel";
import BlogLinksPanel from "./content-hub/BlogLinksPanel";
import BlogTechnicalPanel from "./content-hub/BlogTechnicalPanel";

export type { LinkSuggestion } from "./content-hub/types";

export default function ContentHub({
  initialKeyword = "",
  initialTopic = "",
  targetDomain,
  autonomousBlog,
  targetPages = [],
  aiConfig,
}: ContentHubProps) {
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
  
  // Parse the content into paragraphs and evaluate keyword density (for draft panel)
  const keywordDensityMetrics = useMemo(
    () => computeKeywordDensityMetrics(blogPost?.content || "", blogKeyword, secondaryKeywords),
    [blogPost?.content, blogKeyword, secondaryKeywords]
  );
  
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
  const [schemaCopied, setSchemaCopied] = useState(false);
  // Custom states for SEO-First Blog Workspace
  const [blogViewTab, setBlogViewTab] = useState<"draft" | "prewriting" | "seo" | "multimedia" | "links" | "technical" | "schema">("draft");
  const [headerTagsCopied, setHeaderTagsCopied] = useState(false);

  // Keep track of auto-generated topics to prevent infinite loops
  const [lastAutoGeneratedTopic, setLastAutoGeneratedTopic] = useState(autonomousBlog?.title || "");

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

    // Cap word counts: oversized generations often truncate JSON and fail on serverless
    if (isMedical) {
      return {
        wordCount: 1200,
        targetAudience: "Patients seeking natural joint pain relief without surgery",
        toneOfVoice: "Empathetic & Warm",
        secondaryKeywords: ["joint restoration", "knee pain relief", "phytomedicine", "osteoarthritis natural treatment"]
      };
    } else if (isPayments) {
      return {
        wordCount: 1100,
        targetAudience: "Technical Engineers & Developers",
        toneOfVoice: "Technical & Precise",
        secondaryKeywords: ["payment gateway integration", "multi-currency processing", "checkout workflows", "api security"]
      };
    } else if (isNotes) {
      return {
        wordCount: 1000,
        targetAudience: "General Professionals",
        toneOfVoice: "Educational & Conversational",
        secondaryKeywords: ["productivity templates", "knowledge base workflows", "structured workspaces", "notion template"]
      };
    } else {
      return {
        wordCount: 1100,
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
      setActiveTab("blog");
      setShowConfigForm(false);
      if (initialKeyword) {
        setBlogKeyword(initialKeyword);
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
    const secondaryKeywordsToUse =
      overrideSecondaryKeywords !== undefined ? overrideSecondaryKeywords : secondaryKeywords;
    const wordCountToUse = overrideWordCount !== undefined ? overrideWordCount : wordCount;
    const audienceToUse = (overrideAudience !== undefined ? overrideAudience : targetAudience || "").trim();
    const toneToUse = (overrideTone !== undefined ? overrideTone : toneOfVoice || "").trim();

    if (!topicToUse) {
      setGenerationError("Validation Error: Blog topic is required to initiate generation.");
      return;
    }

    setIsBlogGenerating(true);
    setBlogPost(null);
    setGenerationError(null);

    try {
      // Single attempt: server already recovers with a structured draft on AI failure
      const cappedWords = Math.min(1400, Math.max(800, Number(wordCountToUse) || 1100));
      let data = await generateBlogPost({
        topic: topicToUse,
        keyword: keywordToUse || topicToUse,
        secondaryKeywords: secondaryKeywordsToUse,
        wordCount: cappedWords,
        audience: audienceToUse,
        tone: toneToUse,
        targetDomain,
        aiConfig,
      });

      data = ensureSchemaString(data);
      validateBlogResponse(data);

      setBlogPost(data);
      handleSaveArticleVersion(data, true);
      if (data.isFallback) {
        setGenerationError(
          data.fallbackReason ||
            data.errorMsg ||
            "Draft recovered after an AI issue. Edit freely, or check your API key in Settings and regenerate."
        );
      }
    } catch (err: unknown) {
      console.error("Final error in generateBlogContent:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while generating your blog post draft.";
      // Last-resort local draft so the editor never stays blank
      const localDraft: BlogPost = {
        title: topicToUse,
        metaDescription: `Practical guide to ${keywordToUse || topicToUse}. Steps, examples, and FAQs.`.slice(0, 155),
        slugSuggestion: (keywordToUse || topicToUse)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, ""),
        outline: [
          `What is ${keywordToUse || topicToUse}?`,
          "Key steps to get started",
          "Common mistakes",
          "Frequently Asked Questions",
        ],
        content: [
          `# ${topicToUse}`,
          "",
          `This draft covers **${keywordToUse || topicToUse}** for teams working with ${targetDomain}.`,
          "",
          "## Key Takeaways",
          `- Define a clear goal for ${keywordToUse || topicToUse}.`,
          "- Ship a useful first version, then improve weekly.",
          "- Use FAQs and structured headings for search visibility.",
          "",
          `## What is ${keywordToUse || topicToUse}?`,
          "",
          `${keywordToUse || topicToUse} is a practical approach to better outcomes with clear process and measurement.`,
          "",
          "## Key steps to get started",
          "",
          "1. Audit your current baseline.",
          "2. Prioritize one high-intent topic.",
          "3. Publish, measure, and iterate.",
          "",
          "## Frequently Asked Questions",
          "",
          `### How long does ${keywordToUse || topicToUse} take?`,
          "Most teams see early signals within 4-8 weeks.",
          "",
          "## Conclusion",
          "",
          `Continue at https://${targetDomain}/.`,
        ].join("\n"),
        schemaMarkup: JSON.stringify(
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: topicToUse,
            description: `Guide to ${keywordToUse || topicToUse}`,
          },
          null,
          2
        ),
        faqSection: [
          {
            question: `What is ${keywordToUse || topicToUse}?`,
            answer: "A focused approach with clear process and measurement.",
          },
        ],
        isFallback: true,
        fallbackReason: msg.includes("API key")
          ? "Add your AI API key in Settings to generate a full article. Showing a starter draft for now."
          : `${msg} Showing a starter draft you can edit.`,
      };
      setBlogPost(localDraft);
      setGenerationError(localDraft.fallbackReason || msg);
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
          <BlogConfigSidebar
            showConfigForm={showConfigForm}
            onShowConfigForm={setShowConfigForm}
            blogTopic={blogTopic}
            onBlogTopic={setBlogTopic}
            blogKeyword={blogKeyword}
            onBlogKeyword={setBlogKeyword}
            secondaryKeywords={secondaryKeywords}
            secKeywordInput={secKeywordInput}
            onSecKeywordInput={setSecKeywordInput}
            onAddSecondaryKeyword={handleAddSecondaryKeyword}
            onRemoveSecondaryKeyword={handleRemoveSecondaryKeyword}
            wordCount={wordCount}
            onWordCount={setWordCount}
            targetAudience={targetAudience}
            onTargetAudience={setTargetAudience}
            toneOfVoice={toneOfVoice}
            onToneOfVoice={setToneOfVoice}
            audienceOptions={audienceOptions}
            toneOptions={toneOptions}
            isBlogGenerating={isBlogGenerating}
            onGenerate={() => void generateBlogContent()}
            savedArticles={savedArticles}
            blogPost={blogPost}
            onLoadSaved={handleLoadSavedArticle}
            onDeleteSaved={handleDeleteSavedArticle}
            onUpdateLabel={handleUpdateCustomLabel}
            onSaveVersion={() => blogPost && handleSaveArticleVersion(blogPost)}
          />

          {/* RIGHT COLUMN: Highly Polished Live Article Output + SEO SERP Simulator */}
          <div className="lg:col-span-7 space-y-6">
            
            {isBlogGenerating && (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-xs text-center space-y-4">
                <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <h4 className="font-extrabold text-slate-800 text-base">Gemini is writing a premium publication-ready draft...</h4>
                <div className="text-xs text-slate-400 max-w-sm mx-auto space-y-2">
                  <p>- Structuring heading tags naturally for Google indexers</p>
                  <p>- Seamlessly incorporating secondary keywords</p>
                  <p>- Crafting professional JSON-LD schema markup blocks</p>
                  <p>- Polishing meta details to achieve click-through target limits</p>
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

                  {blogViewTab === "draft" && blogPost && (
                    <BlogDraftPanel
                      blogPost={blogPost}
                      setBlogPost={setBlogPost}
                      blogKeyword={blogKeyword}
                      secondaryKeywords={secondaryKeywords}
                      targetDomain={targetDomain}
                      aiConfig={aiConfig}
                      keywordDensityMetrics={keywordDensityMetrics}
                      blogLinguisticStats={blogLinguisticStats}
                      getCounterColor={getCounterColor}
                      onCopy={handleCopy}
                    />
                  )}

                  {blogViewTab === "prewriting" && blogPost?.preWritingAnalysis && (
                    <BlogPrewritingPanel blogPost={blogPost} blogKeyword={blogKeyword} />
                  )}


                  {blogViewTab === "seo" && blogPost && (
                    <BlogSeoPanel blogPost={blogPost} blogKeyword={blogKeyword} />
                  )}

                  {blogViewTab === "multimedia" && blogPost && (
                    <BlogMultimediaPanel blogPost={blogPost} targetDomain={targetDomain} blogKeyword={blogKeyword} />
                  )}

                  {blogViewTab === "links" && blogPost && blogPost.linkingRecommendations && (
                    <BlogLinksPanel
                      blogPost={blogPost}
                      targetDomain={targetDomain}
                      linkSuggestions={linkSuggestions}
                      isScanningLinks={isScanningLinks}
                      hasScannedLinks={hasScannedLinks}
                      isCustomLinkOpen={isCustomLinkOpen}
                      customAnchor={customAnchor}
                      customTargetUrl={customTargetUrl}
                      pagesToScan={pagesToScan}
                      onInsertLink={handleInsertLink}
                      onIgnoreLink={handleIgnoreLink}
                      onAddCustomLink={handleAddCustomLink}
                      setIsCustomLinkOpen={setIsCustomLinkOpen}
                      setCustomAnchor={setCustomAnchor}
                      setCustomTargetUrl={setCustomTargetUrl}
                      setIsScanningLinks={setIsScanningLinks}
                      setHasScannedLinks={setHasScannedLinks}
                      setLinkSuggestions={setLinkSuggestions}
                      scanForInternalLinks={scanForInternalLinks}
                    />
                  )}

                  {blogViewTab === "technical" && blogPost && blogPost.technicalSeo && (
                    <BlogTechnicalPanel
                      blogPost={blogPost}
                      targetDomain={targetDomain}
                      headerTagsCopied={headerTagsCopied}
                      setHeaderTagsCopied={setHeaderTagsCopied}
                      onCopy={handleCopy}
                    />
                  )}

                  {blogViewTab === "schema" && blogPost && (
                    <BlogSchemaPanel
                      blogPost={blogPost}
                      schemaCopied={schemaCopied}
                      targetDomain={targetDomain}
                      onCopy={(text) => handleCopy(text, setSchemaCopied)}
                    />
                  )}

                </div>
              </motion.div>
            )}
          </div>
        </div>
      ) : (
        <SocialPanel
          targetDomain={targetDomain}
          aiConfig={aiConfig}
          initialTopic={initialTopic || blogTopic}
          initialKeyword={initialKeyword || blogKeyword}
        />
      )}
    </div>
  );
}

