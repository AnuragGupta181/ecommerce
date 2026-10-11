"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server/action";
import { api } from "@/lib/server/api";
import { requireAdmin } from "@/lib/server/session";
import type { ProductDetail, ProductInput } from "@/lib/types";

export async function saveProduct(id: string | null, input: ProductInput) {
  await requireAdmin();
  return runAction(async () => {
    const product = id
      ? await api.patch<ProductDetail>(`/admin/products/${id}`, input)
      : await api.post<ProductDetail>("/admin/products", input);
    revalidatePath("/products");
    revalidatePath("/inventory");
    return { id: product.id };
  });
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  return runAction(async () => {
    const result = await api.delete<{ archived: boolean }>(`/admin/products/${id}`);
    revalidatePath("/products");
    return result;
  });
}

export async function setProductActive(id: string, isActive: boolean) {
  await requireAdmin();
  return runAction(async () => {
    await api.patch(`/admin/products/${id}`, { isActive });
    revalidatePath("/products");
  });
}
