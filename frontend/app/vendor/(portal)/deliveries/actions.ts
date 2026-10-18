"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server/action";
import { api } from "@/lib/server/api";
import { requireVendor } from "@/lib/server/session";

function refresh() {
  revalidatePath("/vendor/deliveries");
  revalidatePath("/vendor/stock");
  revalidatePath("/vendor");
}

/** "Today's delivery sent": marks the drops delivered and deducts their stock. */
export async function markDropsDelivered(ids: string[]) {
  await requireVendor();
  return runAction(async () => {
    const result = await api.post<unknown>("/vendor/deliveries/delivered", { ids });
    refresh();
    return result;
  });
}

export async function markDropMissed(id: string, note: string) {
  await requireVendor();
  return runAction(async () => {
    await api.post(`/vendor/deliveries/${id}/missed`, { note });
    refresh();
  });
}
