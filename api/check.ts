import express from "express";

const app = express();
app.get("/api/check", (_req: any, res: any) => {
  res.json({ ok: true });
});

export default app;
