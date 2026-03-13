import { badRequest } from "./errors.js";

export type AppConfig = {
  port: number;
  calorieDailyBudget: number;
  appTimezone: string;
  sqliteDbPath: string;
  openAiApiKey: string;
  openAiModel: string;
};

function parsePositiveInt(raw: string | undefined, name: string): number {
  const parsed = Number(raw);
  if (!raw || !Number.isInteger(parsed) || parsed <= 0) {
    throw badRequest(`${name} must be a positive integer`);
  }
  return parsed;
}

function validateTimeZone(timeZone: string | undefined): string {
  if (!timeZone) {
    throw badRequest("APP_TIMEZONE must be set");
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    throw badRequest("APP_TIMEZONE must be a valid IANA timezone");
  }
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const portRaw = env.PORT ?? "8000";
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port <= 0) {
    throw badRequest("PORT must be a positive integer");
  }

  return {
    port,
    calorieDailyBudget: parsePositiveInt(env.CALORIE_DAILY_BUDGET, "CALORIE_DAILY_BUDGET"),
    appTimezone: validateTimeZone(env.APP_TIMEZONE),
    sqliteDbPath: env.SQLITE_DB_PATH ?? "./data/calories.db",
    openAiApiKey: parseRequiredString(env.OPENAI_API_KEY, "OPENAI_API_KEY"),
    openAiModel: env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
  };
}

function parseRequiredString(raw: string | undefined, name: string): string {
  const value = raw?.trim();
  if (!value) {
    throw badRequest(`${name} must be set`);
  }
  return value;
}
