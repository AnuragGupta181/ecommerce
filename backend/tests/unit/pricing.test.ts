import { describe, expect, it } from "vitest";
import { calculatePricing, type PricingCoupon, type PricingSettings } from "../../src/modules/pricing/pricing.js";

const settings: PricingSettings = {
  deliveryFee: 4_000,
  freeDeliveryThreshold: 49_900,
  coinEarnPer100: 2,
  coinMaxRedeemPercent: 20,
};

const line = (price: number, mrp: number, quantity = 1) => ({ price, mrp, quantity });

const percent = (value: number, maxDiscount: number | null = null, minOrderValue = 0): PricingCoupon => ({
  code: "PCT",
  type: "PERCENT",
  value,
  maxDiscount,
  minOrderValue,
});

const flat = (value: number, minOrderValue = 0): PricingCoupon => ({
  code: "FLAT",
  type: "FLAT",
  value,
  maxDiscount: null,
  minOrderValue,
});

describe("calculatePricing", () => {
  it("prices items with MRP savings and a delivery fee below the threshold", () => {
    const result = calculatePricing({ lines: [line(20_000, 30_000, 2)], coinBalance: 0, useCoins: false, settings });
    expect(result).toMatchObject({
      itemCount: 2,
      itemsMrp: 60_000,
      itemsTotal: 40_000,
      mrpDiscount: 20_000,
      deliveryFee: 4_000,
      amountForFreeDelivery: 9_900,
      payable: 44_000,
      totalSavings: 20_000,
    });
  });

  it("waives delivery at or above the free-delivery threshold", () => {
    const result = calculatePricing({ lines: [line(49_900, 49_900)], coinBalance: 0, useCoins: false, settings });
    expect(result.deliveryFee).toBe(0);
    expect(result.amountForFreeDelivery).toBe(0);
    expect(result.payable).toBe(49_900);
  });

  it("returns zeros for an empty cart", () => {
    const result = calculatePricing({ lines: [], coinBalance: 50, useCoins: true, settings });
    expect(result).toMatchObject({ itemCount: 0, deliveryFee: 0, payable: 0, coinsUsed: 0, coinsToEarn: 0 });
  });

  it("caps percentage coupons at maxDiscount", () => {
    const result = calculatePricing({
      lines: [line(300_000, 300_000)],
      coupon: percent(10, 20_000),
      coinBalance: 0,
      useCoins: false,
      settings,
    });
    expect(result.couponDiscount).toBe(20_000);
    expect(result.couponCode).toBe("PCT");
  });

  it("applies flat coupons and never discounts below zero", () => {
    const result = calculatePricing({ lines: [line(5_000, 5_000)], coupon: flat(10_000), coinBalance: 0, useCoins: false, settings });
    expect(result.couponDiscount).toBe(5_000);
    expect(result.payable).toBe(4_000); // only delivery remains
  });

  it("reports a friendly error when below the coupon minimum", () => {
    const result = calculatePricing({
      lines: [line(40_000, 40_000)],
      coupon: flat(5_000, 49_900),
      coinBalance: 0,
      useCoins: false,
      settings,
    });
    expect(result.couponDiscount).toBe(0);
    expect(result.couponCode).toBeNull();
    expect(result.couponError).toBe("Add items worth ₹99 more to use FLAT");
  });

  it("caps redeemable coins at the configured percentage of the post-coupon amount", () => {
    // ₹1000 after coupon → 20% cap = ₹200 = 200 coins
    const result = calculatePricing({
      lines: [line(110_000, 120_000)],
      coupon: flat(10_000),
      coinBalance: 500,
      useCoins: true,
      settings,
    });
    expect(result.coinsRedeemable).toBe(200);
    expect(result.coinsUsed).toBe(200);
    expect(result.coinsDiscount).toBe(20_000);
    expect(result.payable).toBe(110_000 - 10_000 - 20_000);
  });

  it("uses the full balance when it is below the cap and ignores coins when toggled off", () => {
    const on = calculatePricing({ lines: [line(100_000, 100_000)], coinBalance: 50, useCoins: true, settings });
    expect(on.coinsUsed).toBe(50);
    const off = calculatePricing({ lines: [line(100_000, 100_000)], coinBalance: 50, useCoins: false, settings });
    expect(off.coinsUsed).toBe(0);
    expect(off.coinsRedeemable).toBe(50);
  });

  it("bases delivery on the post-coupon amount, so coins never add a delivery fee", () => {
    const result = calculatePricing({ lines: [line(50_000, 50_000)], coinBalance: 100, useCoins: true, settings });
    expect(result.coinsUsed).toBe(100);
    expect(result.deliveryFee).toBe(0);
  });

  it("earns coins per ₹100 of goods paid, excluding delivery", () => {
    const result = calculatePricing({ lines: [line(45_000, 45_000)], coinBalance: 0, useCoins: false, settings });
    // goods ₹450 → 4 × 2 = 8 coins; the ₹40 delivery fee does not count
    expect(result.coinsToEarn).toBe(8);
  });

  it("totals all savings", () => {
    const result = calculatePricing({
      lines: [line(100_000, 150_000)],
      coupon: flat(10_000),
      coinBalance: 10,
      useCoins: true,
      settings,
    });
    expect(result.totalSavings).toBe(50_000 + 10_000 + 1_000);
  });
});
