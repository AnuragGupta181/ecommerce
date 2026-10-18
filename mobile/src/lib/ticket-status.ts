import { colors } from "./theme";
import type { TicketStatus } from "./types";

export const TICKET_STATUS: Record<TicketStatus, { label: string; color: string }> = {
  OPEN: { label: "Open", color: colors.warning },
  IN_PROGRESS: { label: "In progress", color: colors.info },
  RESOLVED: { label: "Resolved", color: colors.success },
  CLOSED: { label: "Closed", color: colors.ink500 },
};
