"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server/action";
import { api } from "@/lib/server/api";
import { requireAdmin } from "@/lib/server/session";

export async function setCustomerBlocked(id: string, isBlocked: boolean) {
  await requireAdmin();
  return runAction(async () => {
    await api.patch(`/admin/customers/${id}/block`, { isBlocked });
    revalidatePath(`/customers/${id}`);
    revalidatePath("/customers");
  });
}

export async function adjustCoins(id: string, amount: number, note: string) {
  await requireAdmin();
  return runAction(async () => {
    await api.post(`/admin/customers/${id}/coins`, { amount, note });
    revalidatePath(`/customers/${id}`);
  });
}
