import type { TicketCategory, TicketLevel } from "../../generated/prisma/client.js";

/**
 * Who handles a ticket. Problems with one order or subscription are the shop's to fix (MINOR);
 * anything about the app, money, the account or a shop itself goes to the platform (MAJOR).
 */
export function levelFor(category: TicketCategory): TicketLevel {
  return category === "ORDER_ISSUE" || category === "SUBSCRIPTION_ISSUE" ? "MINOR" : "MAJOR";
}

/** Vendors see only MINOR tickets about their own shop; complaints about a shop never reach it. */
export function vendorCanSee(ticket: { level: TicketLevel; vendorId: string | null }, vendorId: string): boolean {
  return ticket.level === "MINOR" && ticket.vendorId === vendorId;
}
