const ROLLOVER_HOUR_LOCAL = 4;

function getLocalParts(date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);

  if ([year, month, day, hour].some((value) => Number.isNaN(value))) {
    throw new Error("failed to calculate local date parts");
  }

  return { year, month, day, hour };
}

function formatDateUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function calculateLogicalDay(date: Date, timeZone: string): string {
  const local = getLocalParts(date, timeZone);
  const localDateAsUtc = new Date(Date.UTC(local.year, local.month - 1, local.day));

  if (local.hour < ROLLOVER_HOUR_LOCAL) {
    localDateAsUtc.setUTCDate(localDateAsUtc.getUTCDate() - 1);
  }

  return formatDateUTC(localDateAsUtc);
}

export function calculateTodayLogicalDay(timeZone: string): string {
  return calculateLogicalDay(new Date(), timeZone);
}

export const rolloverHourLocal = ROLLOVER_HOUR_LOCAL;
