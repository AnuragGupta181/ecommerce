"use server";

import { revalidatePath } from "next/cache";
import type { TicketLevel, TicketStatus } from "@/lib/marketplace-types";
import { runAction } from "@/lib/server/action";
import { api } from "@/lib/server/api";
import { requireAdmin } from "@/lib/server/session";

function refresh(id: string) {
  revalidatePath(`/tickets/${id}`);
  revalidatePath("/tickets");
}

export async function replyTicket(id: string, body: string) {
  await requireAdmin();
  return runAction(async () => {
    await api.post(`/admin/tickets/${id}/messages`, { body });
    refresh(id);
  });
}

export async function setTicketStatus(id: string, status: TicketStatus, note?: string) {
  await requireAdmin();
  return runAction(async () => {
    await api.patch(`/admin/tickets/${id}/status`, { status, note: note || undefined });
    refresh(id);
  });
}

/** MAJOR goes to the platform team; MINOR hands it back to the shop. */
export async function setTicketLevel(id: string, level: TicketLevel) {
  await requireAdmin();
  return runAction(async () => {
    await api.patch(`/admin/tickets/${id}/level`, { level });
    refresh(id);
  });
}
