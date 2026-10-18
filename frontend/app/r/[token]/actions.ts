"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server/action";
import { publicApi } from "@/lib/server/api";

/** The token in the URL is the rider's only credential; the backend checks it on every call. */
export async function riderMarkDelivered(token: string, deliveryId: string) {
  return runAction(async () => {
    await publicApi.post(`/rider-schedule/${encodeURIComponent(token)}/deliveries/${encodeURIComponent(deliveryId)}/delivered`);
    revalidatePath(`/r/${token}`);
  });
}
