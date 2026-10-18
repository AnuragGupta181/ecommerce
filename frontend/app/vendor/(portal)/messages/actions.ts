"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server/action";
import { api } from "@/lib/server/api";
import { requireVendor } from "@/lib/server/session";

export async function sendMessage(conversationId: string, body: string) {
  await requireVendor();
  return runAction(async () => {
    await api.post(`/vendor/messages/${conversationId}/messages`, { body });
    revalidatePath("/vendor/messages");
  });
}

export async function markConversationRead(conversationId: string) {
  await requireVendor();
  return runAction(async () => {
    await api.post(`/vendor/messages/${conversationId}/read`);
  });
}
