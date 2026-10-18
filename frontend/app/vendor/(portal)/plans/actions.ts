"use server";

import { revalidatePath } from "next/cache";
import type { PlanInput } from "@/lib/marketplace-types";
import { runAction } from "@/lib/server/action";
import { api } from "@/lib/server/api";
import { requireVendor } from "@/lib/server/session";

export async function savePlan(id: string | null, input: PlanInput | Omit<PlanInput, "listingId">) {
  await requireVendor();
  return runAction(async () => {
    if (id) await api.patch(`/vendor/plans/${id}`, input);
    else await api.post("/vendor/plans", input);
    revalidatePath("/vendor/plans");
  });
}

export async function deletePlan(id: string) {
  await requireVendor();
  return runAction(async () => {
    await api.delete(`/vendor/plans/${id}`);
    revalidatePath("/vendor/plans");
  });
}
