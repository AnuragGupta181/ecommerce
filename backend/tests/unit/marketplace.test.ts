import { describe, expect, it } from "vitest";
import { isWithinHours, shopStatus } from "../../src/modules/branches/shop-status.js";
import { approxRoadKm, haversineKm, parsePoint } from "../../src/modules/geo/geo.js";
import { settle } from "../../src/modules/payouts/settlement.js";
import { deliveryFeeFor, quoteDelivery } from "../../src/modules/pricing/delivery.js";
import { calculatePricing } from "../../src/modules/pricing/pricing.js";
import {
  ALL_DAYS,
  buildLedger,
  buildSchedule,
  canChangeDelivery,
  instalmentPlan,
  quoteSubscription,
  weekdayBit,
} from "../../src/modules/pricing/subscription.js";
import { levelFor, vendorCanSee } from "../../src/modules/tickets/ticket-routing.js";

describe("distance", () => {
  it("measures great-circle km and scales to road km", () => {
    const mgRoad = { lat: 12.9716, lng: 77.5946 };
    const hebbal = { lat: 13.035, lng: 77.5972 };
    const km = haversineKm(mgRoad, hebbal);
    expect(km).toBeGreaterThan(6.9);
    expect(km).toBeLessThan(7.2);
    expect(approxRoadKm(mgRoad, hebbal, 1.3)).toBeCloseTo(km * 1.3, 0);
  });

  it("parses X-Location and rejects junk and 0,0", () => {
    expect(parsePoint("12.97, 77.59")).toEqual({ lat: 12.97, lng: 77.59 });
    expect(parsePoint("abc")).toBeNull();
    expect(parsePoint("0,0")).toBeNull();
    expect(parsePoint("95,10")).toBeNull();
  });
});

describe("per-km delivery fee", () => {
  const terms = { ratePerKm: 1000, minFee: 2500, freeAbove: 50_000, maxKm: 8 };

  it("charges distance × rate, rounded to rupees, never below the minimum", () => {
    expect(deliveryFeeFor(terms, 1)).toBe(2500);
    expect(deliveryFeeFor(terms, 4.26)).toBe(4300);
  });

  it("flags shops that are too far", () => {
    expect(quoteDelivery(terms, 9).deliverable).toBe(false);
    expect(quoteDelivery(terms, 7.9).deliverable).toBe(true);
  });

  it("assumes the minimum fee when the location is unknown", () => {
    expect(quoteDelivery(terms, null)).toMatchObject({ fee: 2500, deliverable: true });
  });

  it("feeds the shop fee and free threshold into the price summary", () => {
    const settings = { deliveryFee: 4000, freeDeliveryThreshold: 49_900, coinEarnPer100: 2, coinMaxRedeemPercent: 20 };
    const lines = [{ price: 20_000, mrp: 25_000, quantity: 1 }];
    const paid = calculatePricing({ lines, coinBalance: 0, useCoins: false, settings, delivery: { fee: 4300, freeAbove: 50_000 } });
    expect(paid.deliveryFee).toBe(4300);
    expect(paid.amountForFreeDelivery).toBe(30_000);
    const free = calculatePricing({ lines: [{ price: 60_000, mrp: 60_000, quantity: 1 }], coinBalance: 0, useCoins: false, settings, delivery: { fee: 4300, freeAbove: 50_000 } });
    expect(free.deliveryFee).toBe(0);
    const neverFree = calculatePricing({ lines: [{ price: 60_000, mrp: 60_000, quantity: 1 }], coinBalance: 0, useCoins: false, settings, delivery: { fee: 4300, freeAbove: null } });
    expect(neverFree.deliveryFee).toBe(4300);
  });
});

describe("shop open / closed", () => {
  const shop = { isActive: true, isOnline: true, offlineMessage: null, opensAt: "06:00", closesAt: "22:00", vendorApproved: true };
  // 10:00 IST = 04:30 UTC; 23:00 IST = 17:30 UTC.
  const at = (utc: string) => new Date(`2026-10-18T${utc}:00Z`);

  it("is open inside hours and closed outside", () => {
    expect(shopStatus(shop, at("04:30")).state).toBe("OPEN");
    expect(shopStatus(shop, at("17:30"))).toEqual({ state: "CLOSED", message: "Opens at 06:00" });
  });

  it("handles overnight hours", () => {
    expect(isWithinHours("18:00", "02:00", 23 * 60)).toBe(true);
    expect(isWithinHours("18:00", "02:00", 60)).toBe(true);
    expect(isWithinHours("18:00", "02:00", 12 * 60)).toBe(false);
  });

  it("is closed when switched offline or the vendor is not approved", () => {
    expect(shopStatus({ ...shop, isOnline: false, offlineMessage: "Back at 9" }, at("04:30"))).toEqual({ state: "CLOSED", message: "Back at 9" });
    expect(shopStatus({ ...shop, vendorApproved: false }, at("04:30")).state).toBe("CLOSED");
  });
});

describe("subscription schedule and pricing", () => {
  it("maps weekdays to bits (Mon = 1 … Sun = 64)", () => {
    expect(weekdayBit("2026-10-19")).toBe(1); // Monday
    expect(weekdayBit("2026-10-25")).toBe(64); // Sunday
  });

  it("lists every chosen weekday in a 30-day month minus skipped dates", () => {
    const daily = buildSchedule("2026-11-01", "MONTHLY", ALL_DAYS);
    expect(daily.endDate).toBe("2026-11-30");
    expect(daily.dates).toHaveLength(30);
    const weekdaysOnly = buildSchedule("2026-11-02", "WEEKLY", 1 | 2 | 4 | 8 | 16, ["2026-11-04"]);
    expect(weekdaysOnly.dates).toEqual(["2026-11-02", "2026-11-03", "2026-11-05", "2026-11-06"]);
    expect(weekdaysOnly.skipped).toEqual(["2026-11-04"]);
  });

  it("prices per delivery or with one flat delivery charge", () => {
    const perDrop = quoteSubscription(30, { quantity: 2, pricePerDelivery: 3_000, deliveryFee: 500, deliveryFeeMode: "PER_DELIVERY" });
    expect(perDrop).toMatchObject({ goodsTotal: 180_000, deliveryTotal: 15_000, total: 195_000 });
    const flat = quoteSubscription(30, { quantity: 1, pricePerDelivery: 3_000, deliveryFee: 0, deliveryFeeMode: "PER_PERIOD" });
    expect(flat).toMatchObject({ deliveryTotal: 0, total: 90_000 });
  });

  it("splits payment plans", () => {
    expect(instalmentPlan(90_000, "UPFRONT", "2026-11-01", "2026-11-30")).toEqual([{ sequence: 1, dueDate: "2026-11-01", amount: 90_000 }]);
    const halves = instalmentPlan(90_100, "TWO_INSTALMENTS", "2026-11-01", "2026-11-30");
    expect(halves.map((row) => row.amount).reduce((a, b) => a + b, 0)).toBe(90_100);
    expect(halves[1]!.dueDate).toBe("2026-11-15");
    expect(instalmentPlan(90_000, "END_OF_PERIOD", "2026-11-01", "2026-11-30")[0]!.dueDate).toBe("2026-11-30");
  });

  it("tracks charged, paid and due", () => {
    const instalments = instalmentPlan(60_000, "TWO_INSTALMENTS", "2026-11-01", "2026-11-30");
    const ledger = buildLedger({ delivered: 20_000, periodFee: 0, scheduled: 40_000, paid: 10_000, instalments, plan: "TWO_INSTALMENTS", today: "2026-11-10" });
    expect(ledger).toMatchObject({ charged: 20_000, paid: 10_000, balance: 10_000, expectedTotal: 60_000, dueNow: 20_000 });
    expect(ledger.instalments[0]!.status).toBe("PARTLY_PAID");
    const prepaid = buildLedger({ delivered: 20_000, periodFee: 0, scheduled: 0, paid: 30_000, instalments: [], plan: "END_OF_PERIOD", today: "2026-11-30" });
    expect(prepaid.balance).toBe(-10_000);
    expect(prepaid.dueNow).toBe(0);
  });

  it("closes changes at 8 pm IST the evening before", () => {
    // 19:59 IST on 31 Oct = 14:29 UTC; 20:01 IST = 14:31 UTC.
    expect(canChangeDelivery("2026-11-01", new Date("2026-10-31T14:29:00Z"))).toBe(true);
    expect(canChangeDelivery("2026-11-01", new Date("2026-10-31T14:31:00Z"))).toBe(false);
  });
});

describe("settlement", () => {
  it("pays the vendor platform-funded discounts minus commission", () => {
    // Customer paid 950 (100 coupon off) for 1000 goods + 50 delivery; commission 10% = 100.
    const result = settle([{ itemsTotal: 100_000, deliveryFee: 5_000, payable: 95_000, commissionAmount: 10_000, vendorEarning: 95_000 }], [], 1000);
    expect(result.netAmount).toBe(0);
    const noCoupon = settle([{ itemsTotal: 100_000, deliveryFee: 5_000, payable: 105_000, commissionAmount: 10_000, vendorEarning: 95_000 }], [], 1000);
    expect(noCoupon.netAmount).toBe(-10_000); // the vendor owes the platform its commission
  });

  it("charges commission on subscription goods the vendor collected", () => {
    const result = settle([], [{ goodsAmount: 3_000, deliveryFee: 500 }, { goodsAmount: 3_000, deliveryFee: 500 }], 1000);
    expect(result).toMatchObject({ grossAmount: 7_000, commissionAmount: 600, netAmount: -600 });
  });
});

describe("ticket routing", () => {
  it("sends order and subscription problems to the shop, everything else to the platform", () => {
    expect(levelFor("ORDER_ISSUE")).toBe("MINOR");
    expect(levelFor("SUBSCRIPTION_ISSUE")).toBe("MINOR");
    for (const category of ["APP_BUG", "PAYMENT", "ACCOUNT", "VENDOR_COMPLAINT", "OTHER"] as const) expect(levelFor(category)).toBe("MAJOR");
  });

  it("never shows a vendor a major ticket, even about its own shop", () => {
    expect(vendorCanSee({ level: "MINOR", vendorId: "v1" }, "v1")).toBe(true);
    expect(vendorCanSee({ level: "MAJOR", vendorId: "v1" }, "v1")).toBe(false);
    expect(vendorCanSee({ level: "MINOR", vendorId: "v2" }, "v1")).toBe(false);
  });
});
