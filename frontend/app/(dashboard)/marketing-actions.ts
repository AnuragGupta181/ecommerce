"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server/action";
import { api } from "@/lib/server/api";
import { requireAdmin } from "@/lib/server/session";
import type { BannerInput, CouponInput, Settings } from "@/lib/types";

export async function saveCoupon(id: string | null, input: CouponInput) {
  await requireAdmin();
  return runAction(async () => {
    if (id) await api.patch(`/admin/coupons/${id}`, input);
    else await api.post("/admin/coupons", input);
    revalidatePath("/coupons");
  });
}

export async function deleteCoupon(id: string) {
  await requireAdmin();
  return runAction(async () => {
    const result = await api.delete<{ archived: boolean }>(`/admin/coupons/${id}`);
    revalidatePath("/coupons");
    return result;
  });
}

export async function saveBanner(id: string | null, input: BannerInput) {
  await requireAdmin();
  return runAction(async () => {
    if (id) await api.patch(`/admin/banners/${id}`, input);
    else await api.post("/admin/banners", input);
    revalidatePath("/banners");
  });
}

export async function deleteBanner(id: string) {
  await requireAdmin();
  return runAction(async () => {
    await api.delete(`/admin/banners/${id}`);
    revalidatePath("/banners");
  });
}

export async function setReviewHidden(id: string, isHidden: boolean) {
  await requireAdmin();
  return runAction(async () => {
    await api.patch(`/admin/reviews/${id}`, { isHidden });
    revalidatePath("/reviews");
  });
}

export async function deleteReview(id: string) {
  await requireAdmin();
  return runAction(async () => {
    await api.delete(`/admin/reviews/${id}`);
    revalidatePath("/reviews");
  });
}

export async function saveSettings(input: Settings) {
  await requireAdmin();
  return runAction(async () => {
    await api.patch("/admin/settings", input);
    revalidatePath("/settings");
  });
}
