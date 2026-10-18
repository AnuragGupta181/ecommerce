"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server/action";
import { api } from "@/lib/server/api";
import { requireVendor } from "@/lib/server/session";
import type { OrderStatus } from "@/lib/types";

function refresh(id: string) {
  revalidatePath(`/vendor/orders/${id}`);
  revalidatePath("/vendor/orders");
  revalidatePath("/vendor");
}

export async function updateVendorOrderStatus(id: string, status: OrderStatus, note?: string) {
  await requireVendor();
  return runAction(async () => {
    await api.patch(`/vendor/orders/${id}/status`, { status, note: note || undefined });
    refresh(id);
  });
}

export async function assignVendorRider(id: string, riderId: string) {
  await requireVendor();
  return runAction(async () => {
    await api.patch(`/vendor/orders/${id}/assign-rider`, { riderId });
    refresh(id);
  });
}

export async function resendVendorNotifications(id: string) {
  await requireVendor();
  return runAction(async () => {
    await api.post(`/vendor/orders/${id}/resend-notifications`);
    refresh(id);
  });
}
