import { Router } from "express";
import { buildDailySummary, buildTodaySummary } from "../daily-summary.js";
import { parseDay } from "../validation.js";
import type { AppDeps } from "../app.js";

export function createDaysRouter(deps: AppDeps): Router {
  const router = Router();

  router.get("/days/today", (_req, res) => {
    res.json(buildTodaySummary(deps));
  });

  router.get("/days/:day", (req, res) => {
    const day = parseDay(req.params.day);
    res.json(buildDailySummary(day, deps));
  });

  return router;
}
