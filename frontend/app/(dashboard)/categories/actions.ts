"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server/action";
import { api } from "@/lib/server/api";
import { requireAdmin } from "@/lib/server/session";

export type CategoryInput = { name: string; parentId: string | null; imageUrl: string | null; sortOrder: number; isActive: boolean };
export type BrandInput = { name: string; logoUrl: string | null; isActive: boolean };

export async function saveCategory(id: string | null, input: CategoryInput) {
  await requireAdmin();
  return runAction(async () => {
    if (id) await api.patch(`/admin/categories/${id}`, input);
    else await api.post("/admin/categories", input);
    revalidatePath("/categories");
  });
}

export async function deleteCategory(id: string) {
  await requireAdmin();
  return runAction(async () => {
    await api.delete(`/admin/categories/${id}`);
    revalidatePath("/categories");
  });
}

export async function saveBrand(id: string | null, input: BrandInput) {
  await requireAdmin();
  return runAction(async () => {
    if (id) await api.patch(`/admin/brands/${id}`, input);
    else await api.post("/admin/brands", input);
    revalidatePath("/brands");
  });
}

export async function deleteBrand(id: string) {
  await requireAdmin();
  return runAction(async () => {
    await api.delete(`/admin/brands/${id}`);
    revalidatePath("/brands");
  });
}
