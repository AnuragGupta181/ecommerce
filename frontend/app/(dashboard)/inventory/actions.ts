"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server/action";
import { api } from "@/lib/server/api";
import { requireAdmin } from "@/lib/server/session";
import type { StockMovement } from "@/lib/types";

export async function adjustStock(variantId: string, input: { mode: "IN" | "OUT" | "SET"; quantity: number; reason: string }) {
  await requireAdmin();
  return runAction(async () => {
    const result = await api.post<{ stock: number }>(`/admin/inventory/variants/${variantId}/adjust`, input);
    revalidatePath("/inventory");
    return result;
  });
}

export async function updateThreshold(variantId: string, lowStockThreshold: number) {
  await requireAdmin();
  return runAction(async () => {
    await api.patch(`/admin/inventory/variants/${variantId}/threshold`, { lowStockThreshold });
    revalidatePath("/inventory");
  });
}

export async function loadMovements(variantId: string) {
  await requireAdmin();
  return runAction(async () => (await api.list<StockMovement>(`/admin/inventory/variants/${variantId}/movements`, { limit: 50 })).items);
}
