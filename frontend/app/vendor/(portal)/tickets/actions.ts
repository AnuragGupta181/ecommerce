"use server";

import { revalidatePath } from "next/cache";
import type { TicketStatus } from "@/lib/marketplace-types";
import { runAction } from "@/lib/server/action";
import { api } from "@/lib/server/api";
import { requireVendor } from "@/lib/server/session";

function refresh(id: string) {
  revalidatePath(`/vendor/tickets/${id}`);
  revalidatePath("/vendor/tickets");
}

export async function replyTicket(id: string, body: string) {
  await requireVendor();
  return runAction(async () => {
    await api.post(`/vendor/tickets/${id}/messages`, { body });
    refresh(id);
  });
}

export async function setTicketStatus(id: string, status: TicketStatus, note?: string) {
  await requireVendor();
  return runAction(async () => {
    await api.patch(`/vendor/tickets/${id}/status`, { status, note: note || undefined });
    refresh(id);
  });
}
