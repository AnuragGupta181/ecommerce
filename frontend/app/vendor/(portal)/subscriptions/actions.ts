"use server";

import { revalidatePath } from "next/cache";
import type { PayMethod } from "@/lib/marketplace-types";
import { runAction } from "@/lib/server/action";
import { api } from "@/lib/server/api";
import { requireVendor } from "@/lib/server/session";

function refresh(id: string) {
  revalidatePath(`/vendor/subscriptions/${id}`);
  revalidatePath("/vendor/subscriptions");
}

/** A negative amount records a refund. The customer is emailed the receipt. */
export async function recordPayment(id: string, input: { amount: number; method: PayMethod; note?: string }) {
  await requireVendor();
  return runAction(async () => {
    const payment = await api.post<{ id: string; receiptNumber: string }>(`/vendor/subscriptions/${id}/payments`, input);
    refresh(id);
    return payment;
  });
}

export async function assignSubscriptionRider(id: string, riderId: string | null) {
  await requireVendor();
  return runAction(async () => {
    await api.patch(`/vendor/subscriptions/${id}/rider`, { riderId });
    refresh(id);
  });
}
