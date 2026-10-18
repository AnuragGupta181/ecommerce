"use server";

import { revalidatePath } from "next/cache";
import type { SettlementRows } from "@/components/payouts/settlement-view";
import { runAction } from "@/lib/server/action";
import { api } from "@/lib/server/api";
import { requireAdmin } from "@/lib/server/session";

export async function previewPayout(vendorId: string, from: string, to: string) {
  await requireAdmin();
  return runAction(() => api.get<SettlementRows>(`/admin/payouts/preview/${vendorId}`, { from, to }));
}

/** Locks the period's delivered orders and drops into one statement; the shop is emailed it. */
export async function createPayout(input: { vendorId: string; from: string; to: string; note?: string }) {
  await requireAdmin();
  return runAction(async () => {
    const payout = await api.post<{ id: string }>("/admin/payouts", input);
    revalidatePath("/payouts");
    return payout;
  });
}

export async function markPayoutPaid(id: string, reference: string, note?: string) {
  await requireAdmin();
  return runAction(async () => {
    await api.post(`/admin/payouts/${id}/paid`, { reference, note: note || undefined });
    revalidatePath(`/payouts/${id}`);
    revalidatePath("/payouts");
  });
}
