import { z } from "zod";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Forms send calendar days ("2026-10-18"). Shops are in IST, so a day-only bound covers that whole
 * IST day; parsed naively, `to` would be midnight UTC and silently drop most of that day.
 * Full timestamps pass through unchanged.
 */
export function parseDayBound(value: string, edge: "start" | "end"): Date {
  if (!DATE_ONLY.test(value)) return new Date(value);
  return new Date(`${value}T${edge === "start" ? "00:00:00.000" : "23:59:59.999"}+05:30`);
}

export const dayBound = (edge: "start" | "end") =>
  z
    .string({ error: "Choose a date" })
    .trim()
    .min(1, "Choose a date")
    .transform((value, ctx) => {
      const date = parseDayBound(value, edge);
      if (Number.isNaN(date.getTime())) {
        ctx.addIssue({ code: "custom", message: "Enter a valid date" });
        return z.NEVER;
      }
      return date;
    });

/** Optional filter bounds: blank query values count as absent. */
export const optionalDayBound = (edge: "start" | "end") =>
  z.preprocess((value) => (value === "" ? undefined : value), dayBound(edge).optional());

export const dayRange = { from: dayBound("start"), to: dayBound("end") };
export const optionalDayRange = { from: optionalDayBound("start"), to: optionalDayBound("end") };
