const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 0 });
const count = new Intl.NumberFormat("en-IN");
const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const dateTime = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Money is integer paise everywhere; this is the only place it becomes rupees for display. */
export function formatINR(paise: number): string {
  return inr.format(paise / 100);
}

export function formatCount(value: number): string {
  return count.format(value);
}

export function formatDate(value: string | Date): string {
  return date.format(new Date(value));
}

export function formatDateTime(value: string | Date): string {
  return dateTime.format(new Date(value));
}

/** Form inputs hold rupees as text; convert without float drift. */
export function rupeesToPaise(rupees: string): number {
  const [whole = "0", fraction = ""] = rupees.trim().split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));
}

export function paiseToRupees(paise: number): string {
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
