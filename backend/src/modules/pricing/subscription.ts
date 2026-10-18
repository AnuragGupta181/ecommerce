/**
 * Pure subscription maths: schedule, price breakdown, instalments and ledger.
 * Dates are calendar days as "YYYY-MM-DD" in India time; money is integer paise.
 */

export type Period = "WEEKLY" | "MONTHLY";
export type FeeMode = "PER_DELIVERY" | "PER_PERIOD";
export type PaymentPlan = "UPFRONT" | "TWO_INSTALMENTS" | "END_OF_PERIOD";

export const PERIOD_DAYS: Record<Period, number> = { WEEKLY: 7, MONTHLY: 30 };

/** Mon = 1, Tue = 2, Wed = 4, Thu = 8, Fri = 16, Sat = 32, Sun = 64. */
export const ALL_DAYS = 127;
const IST_OFFSET_MS = 330 * 60 * 1000;
/** Skips and pauses for a day close at 8 pm the evening before. */
export const SKIP_CUTOFF_HOUR = 20;

export const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The calendar day in India at `now`. */
export function todayIST(now = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function weekdayBit(iso: string): number {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return day === 0 ? 64 : 1 << (day - 1);
}

export const isDeliveryDay = (iso: string, weekdays: number) => (weekdays & weekdayBit(iso)) !== 0;

export function weekdayNames(mask: number): string[] {
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return names.filter((_, index) => (mask & (1 << index)) !== 0);
}

export type Schedule = { startDate: string; endDate: string; dates: string[]; skipped: string[] };

/** Every delivery day in the period, minus the days the customer chose to skip. */
export function buildSchedule(startDate: string, period: Period, weekdays: number, skip: Iterable<string> = []): Schedule {
  const skipSet = new Set(skip);
  const endDate = addDays(startDate, PERIOD_DAYS[period] - 1);
  const dates: string[] = [];
  const skipped: string[] = [];
  for (let day = startDate; day <= endDate; day = addDays(day, 1)) {
    if (!isDeliveryDay(day, weekdays)) continue;
    (skipSet.has(day) ? skipped : dates).push(day);
  }
  return { startDate, endDate, dates, skipped };
}

export type SubscriptionTerms = { quantity: number; pricePerDelivery: number; deliveryFee: number; deliveryFeeMode: FeeMode };

export type SubscriptionQuote = {
  deliveries: number;
  perDelivery: { goods: number; deliveryFee: number };
  goodsTotal: number;
  deliveryTotal: number;
  total: number;
};

/** goods = deliveries × price × quantity; delivery = per drop, or one flat amount for the period. */
export function quoteSubscription(deliveries: number, terms: SubscriptionTerms): SubscriptionQuote {
  const goodsPerDelivery = terms.pricePerDelivery * terms.quantity;
  const feePerDelivery = terms.deliveryFeeMode === "PER_DELIVERY" ? terms.deliveryFee : 0;
  const goodsTotal = deliveries * goodsPerDelivery;
  const deliveryTotal = terms.deliveryFeeMode === "PER_DELIVERY" ? deliveries * terms.deliveryFee : deliveries > 0 ? terms.deliveryFee : 0;
  return { deliveries, perDelivery: { goods: goodsPerDelivery, deliveryFee: feePerDelivery }, goodsTotal, deliveryTotal, total: goodsTotal + deliveryTotal };
}

export type Instalment = { sequence: number; dueDate: string; amount: number };

/** When money is due: all before the start, half now and half at the midpoint, or at the end. */
export function instalmentPlan(total: number, plan: PaymentPlan, startDate: string, endDate: string): Instalment[] {
  if (total <= 0) return [];
  if (plan === "UPFRONT") return [{ sequence: 1, dueDate: startDate, amount: total }];
  if (plan === "END_OF_PERIOD") return [{ sequence: 1, dueDate: endDate, amount: total }];
  const first = Math.ceil(total / 2 / 100) * 100;
  const days = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000);
  return [
    { sequence: 1, dueDate: startDate, amount: Math.min(first, total) },
    { sequence: 2, dueDate: addDays(startDate, Math.floor(days / 2)), amount: total - Math.min(first, total) },
  ].filter((instalment) => instalment.amount > 0);
}

export type LedgerInput = {
  /** Value of drops already delivered (goods + per-drop fees). */
  delivered: number;
  /** One-off period delivery fee, charged from the first drop on. */
  periodFee: number;
  /** Everything still scheduled, for the expected total. */
  scheduled: number;
  paid: number;
  instalments: Instalment[];
  plan: PaymentPlan;
  today: string;
};

export type InstalmentStatus = Instalment & { status: "PAID" | "PARTLY_PAID" | "DUE" | "OVERDUE" | "UPCOMING" };

export type Ledger = {
  charged: number;
  paid: number;
  /** Charged minus paid; negative means the customer is in credit (paid ahead). */
  balance: number;
  expectedTotal: number;
  /** What the customer should pay now under their plan. */
  dueNow: number;
  instalments: InstalmentStatus[];
};

export function buildLedger(input: LedgerInput): Ledger {
  const charged = input.delivered + (input.delivered > 0 ? input.periodFee : 0);
  const expectedTotal = input.delivered + input.scheduled + input.periodFee;
  let remainingPaid = input.paid;
  const instalments = input.instalments.map((instalment): InstalmentStatus => {
    const covered = Math.min(Math.max(remainingPaid, 0), instalment.amount);
    remainingPaid -= covered;
    const status = covered >= instalment.amount ? "PAID" : covered > 0 ? "PARTLY_PAID" : instalment.dueDate < input.today ? "OVERDUE" : instalment.dueDate === input.today ? "DUE" : "UPCOMING";
    return { ...instalment, status };
  });
  // Pay-as-delivered plans owe what was delivered; prepaid plans owe every instalment that has fallen due.
  const owedByPlan =
    input.plan === "END_OF_PERIOD"
      ? charged
      : input.instalments.filter((instalment) => instalment.dueDate <= input.today).reduce((sum, instalment) => sum + instalment.amount, 0);
  return {
    charged,
    paid: input.paid,
    balance: charged - input.paid,
    expectedTotal,
    dueNow: Math.max(0, owedByPlan - input.paid),
    instalments,
  };
}

/** A drop can be skipped (or paused) until 8 pm IST the evening before. */
export function canChangeDelivery(date: string, now = new Date()): boolean {
  const cutoff = Date.parse(`${addDays(date, -1)}T${String(SKIP_CUTOFF_HOUR).padStart(2, "0")}:00:00Z`) - IST_OFFSET_MS;
  return now.getTime() < cutoff;
}
