/**
 * Pure per-km delivery pricing. Amounts are integer paise.
 * fee = max(minFee, distanceKm × ratePerKm), rounded to whole rupees.
 */

export type DeliveryTerms = {
  ratePerKm: number;
  minFee: number;
  /** Items total at or above which delivery is free (null = never). */
  freeAbove: number | null;
  /** Furthest the shop delivers. */
  maxKm: number;
};

export const roundToRupee = (paise: number) => Math.round(paise / 100) * 100;

export function deliveryFeeFor(terms: Pick<DeliveryTerms, "ratePerKm" | "minFee">, distanceKm: number): number {
  return Math.max(terms.minFee, roundToRupee(distanceKm * terms.ratePerKm));
}

export function isDeliverable(terms: Pick<DeliveryTerms, "maxKm">, distanceKm: number): boolean {
  return distanceKm <= terms.maxKm;
}

/** The fee before any free-delivery threshold, for showing "₹40 delivery" next to a shop. */
export type DeliveryQuote = { distanceKm: number | null; fee: number; freeAbove: number | null; deliverable: boolean };

/** Without a customer location the minimum fee is shown and the order is assumed deliverable. */
export function quoteDelivery(terms: DeliveryTerms, distanceKm: number | null): DeliveryQuote {
  if (distanceKm === null) return { distanceKm: null, fee: terms.minFee, freeAbove: terms.freeAbove, deliverable: true };
  return { distanceKm, fee: deliveryFeeFor(terms, distanceKm), freeAbove: terms.freeAbove, deliverable: isDeliverable(terms, distanceKm) };
}

export function termsOf(branch: { deliveryRatePerKm: number; minDeliveryFee: number; freeDeliveryAbove: number | null; deliveryRadiusKm: number }): DeliveryTerms {
  return { ratePerKm: branch.deliveryRatePerKm, minFee: branch.minDeliveryFee, freeAbove: branch.freeDeliveryAbove, maxKm: branch.deliveryRadiusKm };
}
