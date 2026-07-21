/**
 * Vercel catch-all for /api/* → Express app in api/index.ts
 * (exact /api alone is not enough for /api/health, /api/analyze, …)
 */
import app from "./index";

export default app;
