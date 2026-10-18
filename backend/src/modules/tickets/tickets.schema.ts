import { z } from "zod";
import { paginationQuery } from "../../lib/pagination.js";

export const ticketCategories = ["ORDER_ISSUE", "SUBSCRIPTION_ISSUE", "APP_BUG", "PAYMENT", "ACCOUNT", "VENDOR_COMPLAINT", "OTHER"] as const;

export const createTicketSchema = z
  .object({
    category: z.enum(ticketCategories),
    subject: z.string().trim().min(4).max(120),
    message: z.string().trim().min(5).max(4000),
    orderId: z.string().min(1).optional(),
    subscriptionId: z.string().min(1).optional(),
  })
  .refine((input) => input.category !== "ORDER_ISSUE" || input.orderId, { message: "Pick the order this is about", path: ["orderId"] })
  .refine((input) => input.category !== "SUBSCRIPTION_ISSUE" || input.subscriptionId, { message: "Pick the subscription this is about", path: ["subscriptionId"] });

export const replySchema = z.object({ body: z.string().trim().min(1).max(4000) });

export const ticketStatusSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
  note: z.string().trim().max(500).optional(),
});

export const ticketLevelSchema = z.object({ level: z.enum(["MINOR", "MAJOR"]) });

export const ticketListQuery = paginationQuery.extend({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  level: z.enum(["MINOR", "MAJOR"]).optional(),
  category: z.enum(ticketCategories).optional(),
  vendorId: z.string().optional(),
  q: z.string().trim().max(100).optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type TicketListQuery = z.infer<typeof ticketListQuery>;
