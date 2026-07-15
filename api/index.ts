import express from "express";
import path from "path";
import fs from "fs";

const app = express();
app.use(express.json({ limit: '10kb' }));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    node: process.version,
    env: process.env.NODE_ENV || "not set",
  });
});

app.post("/api/analyze", async (_req, res) => {
  res.json({ isFallback: true, needsApiKey: false, errorMsg: "minimal mode" });
});

app.post("/api/generate-blog", async (_req, res) => {
  res.json({ isFallback: true, fallbackReason: "minimal mode" });
});

const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return;
  try {
    const template = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
    res.send(template.replace('<!--ssr-outlet-->', ''));
  } catch { res.status(500).send('Server error'); }
});

export default app;
