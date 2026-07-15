export default async function handler(req: any, res: any) {
  const url = new URL(req.url || '/', 'http://localhost');
  const path = url.pathname;

  if (path === '/api/health' || path === '/health') {
    return res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      node: process.version,
      env: process.env.NODE_ENV || "not set"
    });
  }

  // For SSR - serve static HTML for non-API routes
  if (!path.startsWith('/api/')) {
    try {
      const fs = await import('fs');
      const pathMod = await import('path');
      const distPath = pathMod.default.join(process.cwd(), 'dist');
      const template = fs.readFileSync(pathMod.default.join(distPath, 'index.html'), 'utf-8');
      const html = template.replace('<!--ssr-outlet-->', '');
      return res.status(200).setHeader('Content-Type', 'text/html').send(html);
    } catch {
      return res.status(200).setHeader('Content-Type', 'text/html').send('<html><body><div id="root"></div></body></html>');
    }
  }

  // All API routes
  if (path === '/api/analyze') {
    return res.json({ isFallback: true, error: 'AI features disabled - server in minimal mode' });
  }

  if (path === '/api/generate-blog') {
    return res.json({ isFallback: true, fallbackReason: 'AI features disabled - server in minimal mode' });
  }

  return res.status(404).json({ error: 'not found' });
}
