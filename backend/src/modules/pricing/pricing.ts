/**
 * Pure price calculation shared by cart preview and order placement.
 * All amounts are integer paise; 1 coin = ₹1 = 100 paise.
 *
 * Order of operations: items → coupon → coins → delivery fee → payable.
 */

export const PAISE_PER_COIN = 100;

export type PricingLine = { mrp: number; price: number; quantity: number };

export type PricingCoupon = {
  code: string;
  type: "PERCENT" | "FLAT";
  value: number;
  maxDiscount: number | null;
  minOrderValue: number;
};

export type PricingSettings = {
  deliveryFee: number;
  freeDeliveryThreshold: number;
  coinEarnPer100: number;
  coinMaxRedeemPercent: number;
};

export type PricingInput = {
  lines: PricingLine[];
  coupon?: PricingCoupon | null;
  coinBalance: number;
  useCoins: boolean;
  settings: PricingSettings;
  /**
   * The shop's distance-based fee (see delivery.ts). When given it replaces the store-wide
   * flat fee; `freeAbove` is the shop's own free-delivery threshold.
   */
  delivery?: { fee: number; freeAbove: number | null } | null;
};

export type PriceSummary = {
  itemCount: number;
  itemsMrp: number;
  itemsTotal: number;
  mrpDiscount: number;
  couponCode: string | null;
  couponDiscount: number;
  couponError: string | null;
  coinsAvailable: number;
  coinsRedeemable: number;
  coinsUsed: number;
  coinsDiscount: number;
  deliveryFee: number;
  amountForFreeDelivery: number;
  payable: number;
  totalSavings: number;
  coinsToEarn: number;
};

export function couponDiscountFor(coupon: PricingCoupon, itemsTotal: number): number {
  const raw = coupon.type === "PERCENT" ? Math.floor((itemsTotal * coupon.value) / 100) : coupon.value;
  const capped = coupon.maxDiscount !== null ? Math.min(raw, coupon.maxDiscount) : raw;
  return Math.max(0, Math.min(capped, itemsTotal));
}

export function calculatePricing({ lines, coupon, coinBalance, useCoins, settings, delivery }: PricingInput): PriceSummary {
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const itemsMrp = lines.reduce((sum, line) => sum + line.mrp * line.quantity, 0);
  const itemsTotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const mrpDiscount = itemsMrp - itemsTotal;

  let couponDiscount = 0;
  let couponError: string | null = null;
  if (coupon) {
    if (itemsTotal < coupon.minOrderValue) {
      const short = coupon.minOrderValue - itemsTotal;
      couponError = `Add items worth ₹${Math.ceil(short / 100)} more to use ${coupon.code}`;
    } else {
      couponDiscount = couponDiscountFor(coupon, itemsTotal);
    }
  }

  const afterCoupon = itemsTotal - couponDiscount;

  const coinCap = Math.floor((afterCoupon * settings.coinMaxRedeemPercent) / 100 / PAISE_PER_COIN);
  const coinsAvailable = Math.max(0, coinBalance);
  const coinsRedeemable = Math.max(0, Math.min(coinsAvailable, coinCap));
  const coinsUsed = useCoins ? coinsRedeemable : 0;
  const coinsDiscount = coinsUsed * PAISE_PER_COIN;

  const baseFee = delivery ? delivery.fee : settings.deliveryFee;
  const freeAbove = delivery ? delivery.freeAbove : settings.freeDeliveryThreshold;
  const qualifiesForFreeDelivery = freeAbove !== null && afterCoupon >= freeAbove;
  const deliveryFee = itemCount === 0 || qualifiesForFreeDelivery ? 0 : baseFee;
  const amountForFreeDelivery = itemCount === 0 || qualifiesForFreeDelivery || freeAbove === null ? 0 : freeAbove - afterCoupon;

  const goodsPayable = afterCoupon - coinsDiscount;
  const payable = goodsPayable + deliveryFee;
  // Coins are earned on the goods value actually paid, not on delivery charges.
  const coinsToEarn = Math.floor(goodsPayable / (100 * PAISE_PER_COIN)) * settings.coinEarnPer100;

  return {
    itemCount,
    itemsMrp,
    itemsTotal,
    mrpDiscount,
    couponCode: coupon && !couponError ? coupon.code : null,
    couponDiscount,
    couponError,
    coinsAvailable,
    coinsRedeemable,
    coinsUsed,
    coinsDiscount,
    deliveryFee,
    amountForFreeDelivery,
    payable,
    totalSavings: mrpDiscount + couponDiscount + coinsDiscount,
    coinsToEarn,
  };
}
