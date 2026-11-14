// Converting between the clinic's local time and UTC (appointments are stored
// in UTC and shown in organization.timezone). Uses Intl, so daylight saving
// time changes are handled by the runtime's time zone data.

// The local date and time a UTC instant has in `timeZone`
function zonedParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

// Minutes `timeZone` is ahead of UTC at that instant (Madrid: 60 in winter, 120 in summer)
function offsetMinutes(instant: Date, timeZone: string) {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - instant.getTime()) / 60000);
}

// "2026-11-16" + "09:30" in Europe/Madrid -> the UTC instant
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const guess = Date.UTC(y!, m! - 1, d!, h!, min!);
  // Correct by the offset; check again in case the guess fell on the other
  // side of a daylight saving change
  const first = guess - offsetMinutes(new Date(guess), timeZone) * 60000;
  const second = guess - offsetMinutes(new Date(first), timeZone) * 60000;
  return new Date(second);
}

const pad = (n: number) => String(n).padStart(2, "0");

// A UTC instant -> { date: "2026-11-16", time: "09:30" } in `timeZone`
export function utcToZoned(instant: Date, timeZone: string) {
  const p = zonedParts(instant, timeZone);
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

// "2026-11-16" + 1 -> "2026-11-17" (calendar dates, no time zone involved)
export function addDaysIso(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y!, m! - 1, d! + days));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

// ISO weekday of a calendar date: 1 = Monday … 7 = Sunday
export function isoWeekdayOf(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return day === 0 ? 7 : day;
}
