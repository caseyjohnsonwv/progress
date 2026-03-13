import { calculateTodayLogicalDay, rolloverHourLocal } from "./day-logic.js";
import type { AppDeps } from "./app.js";
import type { DailySummaryResponse } from "./types.js";

export function buildDailySummary(day: string, deps: AppDeps): DailySummaryResponse {
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

export function buildTodaySummary(deps: AppDeps): DailySummaryResponse {
  const day = calculateTodayLogicalDay(deps.config.appTimezone);
  return buildDailySummary(day, deps);
}
