"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server/action";
import { api } from "@/lib/server/api";
import { requireAdmin } from "@/lib/server/session";
import type { OrderStatus } from "@/lib/types";

function refresh(id: string) {
  revalidatePath(`/orders/${id}`);
  revalidatePath("/orders");
}

export async function updateOrderStatus(id: string, status: OrderStatus, note?: string) {
  await requireAdmin();
  return runAction(async () => {
    await api.patch(`/admin/orders/${id}/status`, { status, note: note || undefined });
    refresh(id);
  });
}

export async function assignRider(id: string, riderId: string, note?: string) {
  await requireAdmin();
  return runAction(async () => {
    await api.patch(`/admin/orders/${id}/assign-rider`, { riderId, note: note || undefined });
    refresh(id);
  });
}

export async function resendNotifications(id: string) {
  await requireAdmin();
  return runAction(async () => {
    await api.post(`/admin/orders/${id}/resend-notifications`);
    refresh(id);
  });
}

export async function saveAdminNote(id: string, adminNote: string) {
  await requireAdmin();
  return runAction(async () => {
    await api.patch(`/admin/orders/${id}/note`, { adminNote });
    refresh(id);
  });
}
