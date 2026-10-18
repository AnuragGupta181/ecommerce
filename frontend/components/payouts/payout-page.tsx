import { FileText } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { downloadHref } from "@/lib/download-href";
import { formatDate, formatDateTime } from "@/lib/format";
import type { PayoutRow } from "@/lib/marketplace-types";
import { SettlementView, type SettlementRows } from "./settlement-view";

export type PayoutDetail = PayoutRow & Omit<SettlementRows, "drops"> & { deliveries: SettlementRows["drops"]; vendor: { id: string; shopName: string; payoutUpi: string | null; payoutDetails: string | null } };

/** One settlement statement, shared by the admin and the shop. */
export function PayoutPage({ payout, portal, children }: { payout: PayoutDetail; portal: "admin" | "vendor"; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-bold">{payout.number}</h1>
        <Badge tone={payout.status === "PAID" ? "success" : "warning"}>{payout.status === "PAID" ? "Paid" : "Pending"}</Badge>
        <span className="text-ink-500">
          {payout.vendor.shopName} · {formatDate(payout.periodFrom)} – {formatDate(payout.periodTo)}
          {payout.paidAt ? ` · paid ${formatDateTime(payout.paidAt)}` : ""}
          {payout.reference ? ` · ref ${payout.reference}` : ""}
        </span>
        <a
          href={downloadHref(portal === "admin" ? "/download" : "/vendor/download", `/documents/payout/${payout.id}`)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-control border border-line px-3 py-1.5 font-semibold hover:bg-brand-50"
        >
          <FileText size={14} /> Statement PDF
        </a>
      </div>
      {children}
      <SettlementView settlement={{ ...payout, drops: payout.deliveries }} />
    </div>
  );
}
