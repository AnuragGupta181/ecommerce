"use server";

import { revalidatePath } from "next/cache";
import type { BranchInput, VendorProfileInput } from "@/lib/marketplace-types";
import { runAction } from "@/lib/server/action";
import { api } from "@/lib/server/api";
import { requireVendor } from "@/lib/server/session";

function refresh() {
  revalidatePath("/vendor/shop");
  revalidatePath("/vendor");
}

export async function saveShopProfile(input: VendorProfileInput) {
  await requireVendor();
  return runAction(async () => {
    await api.patch("/vendor/profile", input);
    refresh();
  });
}

export async function saveBranch(id: string | null, input: BranchInput) {
  await requireVendor();
  return runAction(async () => {
    if (id) await api.patch(`/vendor/branches/${id}`, input);
    else await api.post("/vendor/branches", input);
    refresh();
  });
}

/** Closing a branch hides it from customers immediately, whatever its hours say. */
export async function setBranchOnline(id: string, isOnline: boolean, offlineMessage?: string) {
  await requireVendor();
  return runAction(async () => {
    await api.patch(`/vendor/branches/${id}/online`, { isOnline, offlineMessage: offlineMessage || null });
    refresh();
  });
}

export async function addStaff(input: { name: string; email: string; phone: string; password: string }) {
  await requireVendor();
  return runAction(async () => {
    await api.post("/vendor/staff", input);
    refresh();
  });
}

export async function removeStaff(id: string) {
  await requireVendor();
  return runAction(async () => {
    await api.delete(`/vendor/staff/${id}`);
    refresh();
  });
}
