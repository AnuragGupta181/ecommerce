import type { ReactNode } from "react";
import { titleCase } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

export type Tone = "neutral" | "brand" | "success" | "danger" | "info" | "warning";

const tones: Record<Tone, string> = {
  neutral: "bg-canvas text-ink-700 border-line",
  brand: "bg-brand-100 text-brand-700 border-brand-200",
  success: "bg-success-soft text-success border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
  info: "bg-info-soft text-info border-transparent",
  warning: "bg-warning-soft text-warning border-transparent",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
}

const statusTone: Record<OrderStatus, Tone> = {
  PLACED: "neutral",
  CONFIRMED: "info",
  PACKED: "info",
  RIDER_ASSIGNED: "brand",
  OUT_FOR_DELIVERY: "brand",
  DELIVERED: "success",
  CANCELLED: "danger",
  RETURN_REJECTED: "danger",
  RETURN_REQUESTED: "warning",
  RETURNED: "warning",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={statusTone[status]}>{titleCase(status)}</Badge>;
}
