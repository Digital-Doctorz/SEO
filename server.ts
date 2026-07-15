import express from "express";
import path from "path";
import fs from "fs";

function startServer() {
  const app = express();

  app.use(express.json({ limit: '10kb' }));

  app.get("/api/health", (req, res) => {
    const diagnostics = {
      status: "ok",
      timestamp: new Date().toISOString(),
      node: process.version,
      env: process.env.NODE_ENV || "not set",
    };
    res.json(diagnostics);
  });

  app.post("/api/analyze", async (req, res) => {
    res.json({ isFallback: true, needsApiKey: false, errorMsg: "Not implemented in minimal mode" });
  });

  app.post("/api/generate-blog", async (req, res) => {
    res.json({ isFallback: true, fallbackReason: "Not implemented in minimal mode" });
  });

  // Static file serving
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));

  // SPA fallback
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return;
    try {
      const template = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
      res.send(template.replace('<!--ssr-outlet-->', ''));
    } catch {
      res.status(500).send('Server error');
    }
  });

  return app;
}

let app: any;
try {
  app = startServer();
} catch (err: any) {
  console.error("Fatal server startup error:", err);
  app = express();
  app.get("/api/health", (req, res) => {
    res.json({ status: "error", error: err.message, node: process.version, env: process.env.NODE_ENV });
  });
}

if (process.env.VERCEL !== "1") {
  const PORT = parseInt(process.env.PORT || "3000", 10);
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
