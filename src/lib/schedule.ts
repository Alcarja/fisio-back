// Shared checks for clinic schedules (CALENDARIO.md, section 1).
// Times are the clinic's local time "HH:MM"; weekdays are ISO (1 = Monday … 7 = Sunday).
// Appointments will reuse these when checking opening hours.

export type TimeRange = { startTime: string; endTime: string };

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isTime = (value: unknown): value is string =>
  typeof value === "string" && TIME_PATTERN.test(value);

export const isWeekday = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 7;

// A real calendar date in "YYYY-MM-DD" (rejects 2026-02-30)
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m! - 1 && date.getUTCDate() === d;
}

// A time zone the runtime knows, e.g. "Europe/Madrid"
export function isTimezone(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// Postgres returns "09:00:00": the frontend works with "09:00"
export const toHHMM = (time: string) => time.slice(0, 5);

// Problem with a group of slots (one day), or null: each must start before it
// ends, and they can't overlap. "HH:MM" strings compare correctly as text
export function rangesError(ranges: TimeRange[]): string | null {
  if (ranges.some((r) => r.startTime >= r.endTime)) {
    return "Cada franja debe empezar antes de terminar";
  }
  const sorted = [...ranges].sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.startTime < sorted[i - 1]!.endTime) return "Las franjas no pueden solaparse";
  }
  return null;
}

// Groups slots by a key (the weekday) to check each group separately
export function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return groups;
}
