import { calculateTodayLogicalDay, rolloverHourLocal } from "./day-logic.js";
import type { AppDeps } from "./app.js";
import type { DailySummaryResponse, RollingDailySummariesResponse } from "./types.js";

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

function shiftDay(day: string, byDays: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + byDays);
  return date.toISOString().slice(0, 10);
}

export function buildRollingDailySummaries(
  input: { anchorDay: string; days: number },
  deps: AppDeps,
): RollingDailySummariesResponse {
  const summaries: DailySummaryResponse[] = [];

  for (let offset = input.days - 1; offset >= 0; offset -= 1) {
    const day = shiftDay(input.anchorDay, -offset);
    summaries.push(buildDailySummary(day, deps));
  }

  return {
    anchor_day: input.anchorDay,
    days: input.days,
    summaries,
  };
}
