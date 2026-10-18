"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server/action";
import { api } from "@/lib/server/api";
import { requireAdmin } from "@/lib/server/session";

export type VendorStatusAction = "approve" | "reject" | "suspend" | "reactivate";

function refresh(id: string) {
  revalidatePath(`/vendors/${id}`);
  revalidatePath("/vendors");
}

export async function changeVendorStatus(id: string, action: VendorStatusAction, reason?: string) {
  await requireAdmin();
  return runAction(async () => {
    await api.post(`/admin/vendors/${id}/status`, { action, reason: reason || undefined });
    refresh(id);
  });
}

export async function updateVendorTerms(id: string, input: { commissionBps: number; subscriptionsEnabled: boolean }) {
  await requireAdmin();
  return runAction(async () => {
    await api.patch(`/admin/vendors/${id}`, input);
    refresh(id);
  });
}
