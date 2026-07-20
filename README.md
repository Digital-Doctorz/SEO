<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Local SEO — Competitive Intelligence Platform

AI-powered SEO analysis with real search data. Audit any website's search authority, discover high-converting keywords, map content gaps, and generate SEO-first blog articles.

---

## Quick Start (2 minutes)

**Prerequisites:** Node.js 20+ ([download here](https://nodejs.org))

```bash
npm install
npm run dev
```

Open **http://localhost:3000** — that's it.

---

## Step 1: Add Your AI Key (Required)

The app needs an AI key to analyze websites. Every user brings their own key — no shared keys.

1. Click the **gear icon** (top right)
2. Choose your provider:
   - **Gemini** (free tier available) — get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   - **OpenRouter** — get a key at [openrouter.ai/keys](https://openrouter.ai/keys)
   - **Custom** — any OpenAI/Anthropic/Gemini-compatible endpoint
3. Paste your key and click **Save & Close**

Your key stays in **your browser only** (localStorage) — never stored on any server.

---

## Step 2: Get Live SEO Data (Recommended)

For real search volumes, backlinks, and rankings (not AI estimates), connect DataForSEO:

### 2a. Create a free account

1. Go to **[app.dataforseo.com/register](https://app.dataforseo.com/register)**
2. Sign up — **no credit card required**
3. You get **$1 free credit** on signup (~500 queries)

### 2b. Get your API credentials

1. Log in to your DataForSEO dashboard
2. Go to **API Access** (left sidebar)
3. Copy your **Login** and **API Password** (the auto-generated password, not your account password)

### 2c. Enter them in the app

1. Click the **gear icon** in the app
2. Scroll down to **"Live SEO Data"** section
3. Paste your Login and Password
4. Click **Save & Close**

That's it! Your analyses now use real Google search data. The app automatically detects the business location from the domain (e.g., `.in` → India, `.co.uk` → UK).

### How much does it cost?

| Operation | Cost |
|-----------|------|
| Full analysis (1 domain) | ~$0.025 |
| Free credit | $1 (~500 analyses) |
| After free credit | Pay per use, ~$0.03/analysis |

You see the estimated cost before each analysis. You control spending — only pay for what you use.

---

## Without DataForSEO

The app works without DataForSEO using AI-estimated data. You'll see a banner suggesting you connect for live/accurate data. Demo data is available when no keys are configured at all.

---

## What You Get

- **Overview Dashboard** — Domain authority, traffic estimate, key metrics
- **Keyword Map** — Real search volumes, difficulty, CPC, trends
- **Content Gaps** — Topics competitors rank for that you don't
- **SERP & Backlinks** — Search results analysis, referring domains, link profile
- **AI Content Hub** — Generate SEO-optimized blog articles and social posts

---

## Production Build

```bash
npm run build    # builds the frontend
npm start        # serves on port 3000
```

### Deploying on Vercel

The API is a serverless function (`api/index.ts`). It is configured in `vercel.json` with `maxDuration: 300`, which **requires a Vercel Pro plan** (Hobby caps functions at 60s; the blog generation pipeline runs multiple sequential AI calls and needs headroom).

- The function reads `dist/**` and `prompts/**` at runtime, so the master blog prompt (`prompts/SEO-BLOG-MASTER-PROMPT.md`) is editable and takes effect on the next deploy — no code change needed to tweak article generation.
- If you deploy somewhere with a shorter function limit, set the `BLOG_FUNCTION_BUDGET_MS` environment variable (default `85000`) to skip the optional JSON-secondary and repair passes before the timeout, so a usable draft is always returned.

Self-hosted: `npm run build && npm start` serves the API + built frontend on port 3000.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Full dev server (API + frontend, port 3000) |
| `npm run build` | Production build to `dist/` |
| `npm start` | Production server (port 3000) |
| `npm run lint` | TypeScript check |

---

## Troubleshooting

**"Analysis failed" / No results**
- Make sure you've added an AI key in Settings
- Check that your key is valid (Gemini keys start with `AIza...`)

**"DataForSEO credentials not configured"**
- You need DataForSEO credentials in Settings for live data
- Free signup at [app.dataforseo.com/register](https://app.dataforseo.com/register)

**Port 3000 already in use**
- Run: `npx kill-port 3000` then `npm run dev`

**Slow analysis**
- First analysis may take 10-15 seconds (cold start)
- Subsequent analyses are faster

---

## Environment Variables (Optional)

For self-hosted deployments, you can set server-side DataForSEO credentials in `.env.local`:

```
DATAFORSEO_LOGIN=your@email.com
DATAFORSEO_PASSWORD=auto-generated-api-password
```

When using the Settings UI, these env vars are not needed — credentials are stored in your browser and sent with each request.

---

Built by **Digital Doctors** — [Contact: +91-9555955595](tel:+919555955595)
