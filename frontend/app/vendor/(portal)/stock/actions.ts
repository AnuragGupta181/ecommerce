"use server";

import { revalidatePath } from "next/cache";
import type { CatalogProduct, ListingMovement } from "@/lib/marketplace-types";
import { runAction } from "@/lib/server/action";
import { api } from "@/lib/server/api";
import { requireVendor } from "@/lib/server/session";

export type ListingTerms = { price: number; mrp: number; costPrice: number | null; lowStockThreshold: number; isAvailable: boolean };

function refresh() {
  revalidatePath("/vendor/stock");
  revalidatePath("/vendor");
}

export async function searchCatalog(q: string, branchId: string) {
  await requireVendor();
  return runAction(async () => (await api.list<CatalogProduct>("/vendor/listings/catalog", { q, branchId, limit: 20 })).items);
}

export async function createListing(input: ListingTerms & { branchId: string; variantId: string; stock: number }) {
  await requireVendor();
  return runAction(async () => {
    await api.post("/vendor/listings", input);
    refresh();
  });
}

export async function updateListing(id: string, input: ListingTerms) {
  await requireVendor();
  return runAction(async () => {
    await api.patch(`/vendor/listings/${id}`, input);
    refresh();
  });
}

export async function deleteListing(id: string) {
  await requireVendor();
  return runAction(async () => {
    await api.delete(`/vendor/listings/${id}`);
    refresh();
  });
}

export async function adjustListing(id: string, input: { mode: "IN" | "OUT" | "SET"; quantity: number; reason: string }) {
  await requireVendor();
  return runAction(async () => {
    const result = await api.post<{ stock: number }>(`/vendor/listings/${id}/adjust`, input);
    refresh();
    return result;
  });
}

export async function loadMovements(id: string) {
  await requireVendor();
  return runAction(async () => (await api.list<ListingMovement>(`/vendor/listings/${id}/movements`, { limit: 50 })).items);
}

export type VendorProductInput = {
  branchId: string;
  name: string;
  description: string;
  categoryId: string;
  brandId: string | null;
  images: { url: string }[];
  variants: { sku: string; label: string; mrp: number; price: number; costPrice: number | null; stock: number; lowStockThreshold: number }[];
};

export async function createVendorProduct(input: VendorProductInput) {
  await requireVendor();
  return runAction(async () => {
    const product = await api.post<{ id: string }>("/vendor/products", input);
    refresh();
    return product;
  });
}
