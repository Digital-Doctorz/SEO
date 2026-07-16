<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Local SEO — Competitive Intelligence Platform

AI-powered SEO analysis, content gap mapping, and blog generation.

## Run Locally

**Prerequisites:** Node.js 20+

1. Install dependencies: `npm install`
2. (Optional) Put a Gemini key in Settings UI after launch, or set secrets in `.env.local`
3. Start dev server (API + Vite HMR on one port):

```bash
npm run dev
```

Open http://localhost:3000

4. Production local:

```bash
npm run build
npm start
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Express API + Vite middleware (port 3000) |
| `npm run build` | Client production build → `dist/` |
| `npm start` | Serve `dist/` + API (port 3000) |
| `npm run lint` | TypeScript check |

## API keys (bring your own)

**Required for live AI.** There is no shared server key.

1. Open **Settings** (gear icon) in the app  
2. Paste **your** Gemini, OpenRouter, or custom provider key  
3. Keys stay in **your browser only** (`localStorage`) and are sent per-request as `aiConfig`

- Never commit keys to git  
- Server does **not** read `GEMINI_API_KEY` / env secrets for AI  
- Without a key: demo/fallback dashboard data only; blog & social generation require a key  

Supported providers: Gemini, OpenRouter, Custom (OpenAI / Anthropic / Gemini-compatible).
