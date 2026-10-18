/** Delivery weekdays as the backend's bitmask: Mon = 1, Tue = 2 … Sun = 64. */

export type WeekdayName = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export const WEEKDAYS: { name: WeekdayName; bit: number }[] = [
  { name: "Mon", bit: 1 },
  { name: "Tue", bit: 2 },
  { name: "Wed", bit: 4 },
  { name: "Thu", bit: 8 },
  { name: "Fri", bit: 16 },
  { name: "Sat", bit: 32 },
  { name: "Sun", bit: 64 },
];

export const EVERY_DAY = 127;

export function toggleWeekday(mask: number, bit: number): number {
  return mask ^ bit;
}

export function hasWeekday(mask: number, bit: number): boolean {
  return (mask & bit) !== 0;
}

export function maskFromNames(names: string[]): number {
  return WEEKDAYS.reduce((mask, day) => (names.includes(day.name) ? mask | day.bit : mask), 0);
}

export function namesFromMask(mask: number): WeekdayName[] {
  return WEEKDAYS.filter((day) => hasWeekday(mask, day.bit)).map((day) => day.name);
}

export function describeWeekdays(mask: number): string {
  if (mask === EVERY_DAY) return "Every day";
  if (mask === 31) return "Weekdays";
  if (mask === 96) return "Weekends";
  return namesFromMask(mask).join(", ") || "No days";
}

/* ISO calendar dates (YYYY-MM-DD) are handled in UTC so a device timezone can't shift the day. */

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function addDays(iso: string, days: number): string {
  const date = toDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Today as the shopper's calendar date. */
export function todayIso(now: Date = new Date()): string {
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/** Monday-first column index (0 = Mon … 6 = Sun). */
export function weekdayIndex(iso: string): number {
  return (toDate(iso).getUTCDay() + 6) % 7;
}

export function upcomingDates(fromIso: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(fromIso, i));
}

/**
 * Month grid for a delivery calendar: rows of 7 cells (Mon first), `null` padding before the
 * first and after the last date. Only lays dates out; which dates exist comes from the server.
 */
export function calendarMonths(dates: string[]): { month: string; weeks: (string | null)[][] }[] {
  const sorted = [...new Set(dates)].sort();
  if (!sorted.length) return [];
  const months: { month: string; weeks: (string | null)[][] }[] = [];
  let cursor = `${sorted[0].slice(0, 7)}-01`;
  const lastMonth = sorted[sorted.length - 1].slice(0, 7);
  while (cursor.slice(0, 7) <= lastMonth) {
    const month = cursor.slice(0, 7);
    const cells: (string | null)[] = Array.from({ length: weekdayIndex(cursor) }, () => null);
    for (let day = cursor; day.slice(0, 7) === month; day = addDays(day, 1)) cells.push(day);
    while (cells.length % 7) cells.push(null);
    const weeks: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    months.push({ month, weeks });
    cursor = addDays(`${month}-01`, 32).slice(0, 7) + "-01";
  }
  return months;
}

const monthFormat = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const shortFormat = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function formatMonth(month: string): string {
  return monthFormat.format(toDate(`${month}-01`));
}

/** "Tue, 20 Oct" for an ISO calendar date. */
export function formatDay(iso: string): string {
  return shortFormat.format(toDate(iso));
}
