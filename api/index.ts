import express from 'express';

let _app: any = null;

function createFallback() {
  const fb = express();
  fb.get('/api/health', (_req: any, res: any) => {
    res.json({ status: 'error', message: 'server module failed to load', node: process.version });
  });
  fb.use((_req: any, res: any) => {
    res.status(500).json({ error: 'Server startup failed' });
  });
  return fb;
}

export default async function handler(req: any, res: any) {
  if (!_app) {
    try {
      const mod = await import('../server');
      _app = mod.default || mod;
    } catch (err: any) {
      console.error('api/index.ts: failed to load server module:', err);
      _app = createFallback();
    }
  }
  return _app(req, res);
}
