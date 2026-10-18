"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server/action";
import { api } from "@/lib/server/api";
import { requireSuperAdmin } from "@/lib/server/session";

export async function createAdmin(input: { name: string; email: string; phone?: string; password: string }) {
  await requireSuperAdmin();
  return runAction(async () => {
    await api.post("/admin/admins", { ...input, phone: input.phone || undefined });
    revalidatePath("/admins");
  });
}

/** Blocks the login; history stays attributed to them. */
export async function removeAdmin(id: string) {
  await requireSuperAdmin();
  return runAction(async () => {
    await api.delete(`/admin/admins/${id}`);
    revalidatePath("/admins");
  });
}

export async function restoreAdmin(id: string) {
  await requireSuperAdmin();
  return runAction(async () => {
    await api.post(`/admin/admins/${id}/restore`);
    revalidatePath("/admins");
  });
}
