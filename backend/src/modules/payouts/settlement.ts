/**
 * Pure settlement maths between the platform and a vendor. Money is paise.
 *
 * Customers pay the vendor's rider (cash/UPI on delivery), so the vendor already holds what the
 * customer paid. The platform funded coupons and coins, and is owed its commission:
 *   owedToVendor = vendorEarning − collectedByVendor
 * Positive: the platform pays the vendor. Negative: the vendor pays the platform.
 */

export type SettlementOrder = { itemsTotal: number; deliveryFee: number; payable: number; commissionAmount: number; vendorEarning: number };
export type SettlementDrop = { goodsAmount: number; deliveryFee: number };

export type Settlement = {
  orderCount: number;
  deliveryCount: number;
  /** Sales value: goods + delivery for orders and subscription drops. */
  grossAmount: number;
  commissionAmount: number;
  /** Money the vendor already received from customers. */
  collectedByVendor: number;
  /** What the vendor earns after commission. */
  vendorEarning: number;
  /** Platform → vendor when positive, vendor → platform when negative. */
  netAmount: number;
};

export function commissionOn(goods: number, commissionBps: number): number {
  return Math.round((goods * commissionBps) / 10_000);
}

export function settle(orders: SettlementOrder[], drops: SettlementDrop[], commissionBps: number): Settlement {
  const orderGross = orders.reduce((sum, order) => sum + order.itemsTotal + order.deliveryFee, 0);
  const orderCommission = orders.reduce((sum, order) => sum + order.commissionAmount, 0);
  const orderEarning = orders.reduce((sum, order) => sum + order.vendorEarning, 0);
  const orderCollected = orders.reduce((sum, order) => sum + order.payable, 0);

  // Subscription customers pay the shop directly for exactly what was delivered.
  const dropGoods = drops.reduce((sum, drop) => sum + drop.goodsAmount, 0);
  const dropGross = drops.reduce((sum, drop) => sum + drop.goodsAmount + drop.deliveryFee, 0);
  const dropCommission = commissionOn(dropGoods, commissionBps);

  const commissionAmount = orderCommission + dropCommission;
  const vendorEarning = orderEarning + dropGross - dropCommission;
  const collectedByVendor = orderCollected + dropGross;
  return {
    orderCount: orders.length,
    deliveryCount: drops.length,
    grossAmount: orderGross + dropGross,
    commissionAmount,
    collectedByVendor,
    vendorEarning,
    netAmount: vendorEarning - collectedByVendor,
  };
}
