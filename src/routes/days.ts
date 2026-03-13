import { Router } from "express";
import { calculateTodayLogicalDay, rolloverHourLocal } from "../day-logic.js";
import { parseDay } from "../validation.js";
import type { AppDeps } from "../app.js";
import type { DailySummaryResponse } from "../types.js";

function buildDailySummary(day: string, deps: AppDeps): DailySummaryResponse {
  const entries = deps.db.listEntriesByDay(day);
  const consumedCalories = deps.db.getConsumedCaloriesByDay(day);
  const budgetCalories = deps.config.calorieDailyBudget;

  return {
    day,
    timezone: deps.config.appTimezone,
    rollover_hour_local: rolloverHourLocal,
    budget_calories: budgetCalories,
    consumed_calories: consumedCalories,
    remaining_calories: budgetCalories - consumedCalories,
    entries,
  };
}

export function createDaysRouter(deps: AppDeps): Router {
  const router = Router();

  router.get("/days/today", (_req, res) => {
    const day = calculateTodayLogicalDay(deps.config.appTimezone);
    res.json(buildDailySummary(day, deps));
  });

  router.get("/days/:day", (req, res) => {
    const day = parseDay(req.params.day);
    res.json(buildDailySummary(day, deps));
  });

  return router;
}
