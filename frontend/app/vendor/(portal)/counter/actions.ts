"use server";

import { revalidatePath } from "next/cache";
import type { Listing, PayMethod } from "@/lib/marketplace-types";
import { runAction } from "@/lib/server/action";
import { api } from "@/lib/server/api";
import { requireVendor } from "@/lib/server/session";

export async function findListings(q: string, branchId: string) {
  await requireVendor();
  return runAction(async () => (await api.list<Listing>("/vendor/listings", { q, branchId, limit: 10 })).items);
}

export type CounterSaleInput = {
  branchId: string;
  items: { listingId: string; quantity: number; price?: number }[];
  customerName?: string;
  customerPhone?: string;
  method: PayMethod;
};

export async function createCounterSale(input: CounterSaleInput) {
  await requireVendor();
  return runAction(async () => {
    const sale = await api.post<{ id: string; number: string; total: number }>("/vendor/counter-sales", input);
    revalidatePath("/vendor/counter");
    revalidatePath("/vendor/stock");
    return sale;
  });
}
