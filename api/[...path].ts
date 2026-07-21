/**
 * Vercel catch-all: routes /api/* (e.g. /api/health, /api/analyze) to the Express app.
 * Without this, only exact /api is handled and nested paths 404.
 */
export { default } from "./index";
