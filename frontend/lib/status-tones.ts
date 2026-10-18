import type { Tone } from "@/components/ui/badge";
import type { DeliveryStatus, TicketStatus, VendorStatus } from "./marketplace-types";

/** Badge colours for marketplace statuses, shared by server pages and client components. */
export const deliveryTone: Record<DeliveryStatus, Tone> = { SCHEDULED: "info", DELIVERED: "success", MISSED: "danger", SKIPPED: "neutral", CANCELLED: "neutral" };

export const ticketTone: Record<TicketStatus, Tone> = { OPEN: "warning", IN_PROGRESS: "info", RESOLVED: "success", CLOSED: "neutral" };

export const vendorStatusTone: Record<VendorStatus, Tone> = { PENDING: "warning", APPROVED: "success", SUSPENDED: "danger", REJECTED: "neutral" };
