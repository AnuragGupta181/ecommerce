import type { OrderStatus } from "../../generated/prisma/enums.js";

/** The single source of truth for which status changes are allowed. */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PLACED: ["CONFIRMED", "RIDER_ASSIGNED", "CANCELLED"],
  CONFIRMED: ["PACKED", "RIDER_ASSIGNED", "CANCELLED"],
  PACKED: ["RIDER_ASSIGNED", "CANCELLED"],
  RIDER_ASSIGNED: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["RETURN_REQUESTED"],
  RETURN_REQUESTED: ["RETURNED", "RETURN_REJECTED"],
  CANCELLED: [],
  RETURNED: [],
  RETURN_REJECTED: [],
};

export const ACTIVE_STATUSES: readonly OrderStatus[] = [
  "PLACED",
  "CONFIRMED",
  "PACKED",
  "RIDER_ASSIGNED",
  "OUT_FOR_DELIVERY",
];

/** Statuses in which a rider can be (re)assigned. */
export const RIDER_ASSIGNABLE: readonly OrderStatus[] = ["PLACED", "CONFIRMED", "PACKED", "RIDER_ASSIGNED", "OUT_FOR_DELIVERY"];

const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = ["PLACED", "CONFIRMED", "PACKED"];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function canCustomerCancel(status: OrderStatus): boolean {
  return CUSTOMER_CANCELLABLE.includes(status);
}

export function canRequestReturn(
  status: OrderStatus,
  deliveredAt: Date | null,
  returnWindowDays: number,
  now = new Date(),
): boolean {
  if (status !== "DELIVERED" || !deliveredAt || returnWindowDays <= 0) return false;
  const deadline = deliveredAt.getTime() + returnWindowDays * 24 * 60 * 60 * 1000;
  return now.getTime() <= deadline;
}

/** Customer-facing step tracker shown in the app's order timeline. */
export const TIMELINE_STEPS: readonly OrderStatus[] = ["PLACED", "CONFIRMED", "PACKED", "RIDER_ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED"];
