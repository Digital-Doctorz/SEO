import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

import { cleanDomain, cleanAndParseJSON, resolveDomain } from "./lib/utils";
import { callAI, getProviderConfig } from "./providers";
import {
  generateFallbackData,
  getAutonomousBlog,
  generateDeepKeywordFallback,
} from "./fallback";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const app = express();
// Meta/blog payloads can include full article text
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
    optimalPostingTime: "Tue–Thu 9–11am local",
    engagementStrategy: "Ask a question in the first line and reply to comments within 1 hour.",
    seoNotes: `Primary keyword: ${kw}`,
    isFallback: true,
    fallbackReason: reason,
  };
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    node: process.version,
    env: process.env.NODE_ENV || "not set",
    distExists: fs.existsSync(path.join(process.cwd(), "dist")),
  });
});

// Analyze endpoint
app.post("/api/analyze", async (req, res) => {
  const domain = resolveDomain(req.body);
  const competitorUrl = req.body?.competitorUrl as string | undefined;
  if (!domain || domain === "target-website.com") {
    return res.status(400).json({ error: "Target URL is required." });
  }
  const providerConfig = getProviderConfig(req);
  if (!providerConfig) {
    const data = await generateFallbackData(domain, competitorUrl);
    return res.json({ ...data, isFallback: true, needsApiKey: true });
  }
  try {
    const prompt = `Perform a comprehensive Content Strategy & Competitive Intelligence SEO analysis for "${domain}". ${competitorUrl ? `Compare with competitor "${cleanDomain(competitorUrl)}".` : ""} Use googleSearch to find real web data. Return structured JSON with: target (domain, domainRating, backlinksCount, referringDomains, organicTraffic, organicKeywords, publishingFrequency, topPages[]), competitor (same shape or null), discoveredCompetitors[], targetAnalysis, keywords[], contentGaps[], serpFeatures[], backlinkSources[], backlinkOpportunities[], rankingBlueprint, autonomousBlog.`;
    const result = await callAI(providerConfig, prompt, "", {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      temperature: 0.1,
    });
    const parsed = cleanAndParseJSON(result.text);
    res.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Analyze error:", message);
    const data = await generateFallbackData(domain, competitorUrl);
    res.json({ ...data, isFallback: true, errorMsg: message });
  }
});

// Blog generation — matches ContentHub client payload
app.post("/api/generate-blog", async (req, res) => {
  const domain = resolveDomain(req.body);
  const {
    topic,
    keyword,
    secondaryKeywords = [],
    wordCount = 2000,
    audience = "",
    tone = "",
  } = req.body || {};
  if (!domain || domain === "target-website.com") {
    return res.status(400).json({ error: "Target URL / domain is required." });
  }
  const kw = (keyword || topic || "quality services") as string;
  const providerConfig = getProviderConfig(req);
  if (!providerConfig) {
    const blog = getAutonomousBlog(domain, kw);
    return res.json({
      ...blog,
      isFallback: true,
      fallbackReason: "No API key configured. Using pre-compiled template.",
    });
  }
  try {
    const secondary = Array.isArray(secondaryKeywords)
      ? secondaryKeywords.join(", ")
      : String(secondaryKeywords || "");
    const prompt = `Write a comprehensive, SEO-optimized blog article of about ${wordCount} words.
Primary keyword: "${kw}"
Topic: "${topic || kw}"
Secondary keywords: ${secondary || "none"}
Target website: "${domain}"
Audience: ${audience || "professionals researching solutions"}
Tone: ${tone || "Authoritative & Educational"}

Return ONLY JSON with fields:
title, metaDescription, slugSuggestion, outline (string array), content (full markdown article), schemaMarkup (JSON-LD string), faqSection (array of {question, answer}).
Include H2 sections, an FAQ block, and natural internal-link style anchors.`;
    const result = await callAI(providerConfig, prompt, "", {
      responseMimeType: "application/json",
      temperature: 0.3,
    });
    const parsed = cleanAndParseJSON(result.text);
    if (parsed.schemaMarkup && typeof parsed.schemaMarkup === "object") {
      parsed.schemaMarkup = JSON.stringify(parsed.schemaMarkup, null, 2);
    }
    res.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Blog error:", message);
    const blog = getAutonomousBlog(domain, kw);
    res.json({ ...blog, isFallback: true, fallbackReason: message });
  }
});

// Social — client expects a single SocialPost object
app.post("/api/generate-social", async (req, res) => {
  const domain = resolveDomain(req.body);
  const {
    keyword = "",
    topic = "",
    platform = "Twitter/X",
    audience = "",
    contentGoal = "",
    brandVoice = "",
  } = req.body || {};
  if (!domain || domain === "target-website.com") {
    return res.status(400).json({ error: "Target URL / domain is required." });
  }
  const providerConfig = getProviderConfig(req);
  if (!providerConfig) {
    return res.json(socialFallback(platform, topic, keyword, domain, "No API key configured."));
  }
  try {
    const prompt = `Write one high-quality social media post for platform "${platform}" promoting content about "${topic || keyword || "SEO services"}" for website "${domain}".
Audience: ${audience || "professionals"}
Goal: ${contentGoal || "drive clicks"}
Brand voice: ${brandVoice || "clear and confident"}
Primary keyword: ${keyword || topic}

Return ONLY JSON object (not an array) with:
platform, content, hashtags (string array), optimalPostingTime, engagementStrategy, seoNotes.`;
    const result = await callAI(providerConfig, prompt, "", {
      responseMimeType: "application/json",
      temperature: 0.4,
    });
    const parsed = cleanAndParseJSON(result.text);
    if (parsed.posts && Array.isArray(parsed.posts) && parsed.posts.length > 0) {
      const match =
        parsed.posts.find((p: { platform?: string }) => p.platform === platform) ||
        parsed.posts[0];
      return res.json(match);
    }
    res.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.json(socialFallback(platform, topic, keyword, domain, message));
  }
});

// Keyword deep analysis
app.post("/api/analyze-keyword-deep", async (req, res) => {
  const domain = resolveDomain(req.body);
  const keyword = req.body?.keyword as string | undefined;
  if (!keyword || !domain || domain === "target-website.com") {
    return res.status(400).json({ error: "Keyword and Target URL are required." });
  }
  const providerConfig = getProviderConfig(req);
  if (!providerConfig) {
    const data = await generateDeepKeywordFallback(keyword, domain);
    return res.json(data);
  }
  try {
    const prompt = `Perform a deep keyword analysis for "${keyword}" in the context of "${domain}". Use googleSearch for real data. Return JSON with: keyword, topResults (10 items with rank, title, url, contentLength, contentType, freshnessScore, domainRating), averageContentLength, commonSubtopics (5 items with subtopic, relevance, description), featuredSnippet (format, extractedText, optimizedOpportunity), peopleAlsoAsk (4 items with question, answer, sourceUrl), relatedSearches (7 items), contentTypeAnalysis (dominantType, percentageBreakdown), freshnessRequirements (level, explanation, recommendedUpdateFrequency).`;
    const result = await callAI(providerConfig, prompt, "", {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      temperature: 0.1,
    });
    res.json(cleanAndParseJSON(result.text));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const data = await generateDeepKeywordFallback(keyword, domain);
    res.json({ ...data, isFallback: true, errorMsg: message });
  }
});

// Meta snippets
app.post("/api/generate-meta-snippets", async (req, res) => {
  const domain = resolveDomain(req.body);
  const { keyword = "SEO services", content = "", articleTitle = "" } = req.body || {};
  if (!domain || domain === "target-website.com") {
    return res.status(400).json({ error: "Target URL / domain is required." });
  }
  const providerConfig = getProviderConfig(req);
  if (!providerConfig) {
    return res.json({ isFallback: true, fallbackReason: "No API key configured.", snippets: [] });
  }
  try {
    const excerpt = typeof content === "string" ? content.slice(0, 1500) : "";
    const prompt = `Generate 5 SEO meta title and description variants for a page on "${domain}".
Primary keyword: "${keyword}"
Article title: "${articleTitle}"
Content excerpt: """${excerpt}"""

Return ONLY JSON: { "snippets": [ { "type": "default|question|benefit|how-to|list", "title": "...", "description": "..." } ] }
Titles max 60 chars, descriptions max 155 chars.`;
    const result = await callAI(providerConfig, prompt, "", {
      responseMimeType: "application/json",
      temperature: 0.3,
    });
    const parsed = cleanAndParseJSON(result.text);
    if (Array.isArray(parsed)) {
      return res.json({ snippets: parsed });
    }
    res.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.json({ isFallback: true, fallbackReason: message, snippets: [] });
  }
});

// Static files & SPA fallback (production / Vercel)
const distPath = path.join(process.cwd(), "dist");
const isVercel = process.env.VERCEL === "1";
const isProd =
  process.env.NODE_ENV === "production" || process.argv.includes("--prod") || isVercel;

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

if (!isVercel) {
  startLocalServer().catch((err) => {
    console.error("Failed to start local server:", err);
    process.exit(1);
  });
}

export default app;
