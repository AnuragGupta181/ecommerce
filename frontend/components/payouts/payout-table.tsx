import { Wallet } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { formatDate, formatINR } from "@/lib/format";
import type { PayoutRow } from "@/lib/marketplace-types";
import { netLabel } from "./settlement-view";

export function PayoutTable({ items, basePath, showShop }: { items: PayoutRow[]; basePath: "/payouts" | "/vendor/payouts"; showShop: boolean }) {
  if (items.length === 0) return <EmptyState icon={Wallet} title="No payouts yet" description="Settlements for delivered orders and subscription drops appear here." />;
  return (
    <Table minWidth={820}>
      <THead>
        <Th>Payout</Th>
        {showShop ? <Th>Shop</Th> : null}
        <Th>Period</Th>
        <Th align="right">Sales</Th>
        <Th>Settlement</Th>
        <Th>Status</Th>
      </THead>
      <tbody>
        {items.map((payout) => (
          <Tr key={payout.id}>
            <Td>
              <Link href={`${basePath}/${payout.id}`} className="font-semibold hover:underline">
                {payout.number}
              </Link>
              <p className="text-xs text-ink-500">
                {payout.orderCount} orders · {payout.deliveryCount} drops
              </p>
            </Td>
            {showShop ? <Td>{payout.vendor?.shopName ?? "—"}</Td> : null}
            <Td>
              {formatDate(payout.periodFrom)} – {formatDate(payout.periodTo)}
            </Td>
            <Td numeric>{formatINR(payout.grossAmount)}</Td>
            <Td className={payout.netAmount < 0 ? "text-danger" : ""}>{netLabel(payout.netAmount)}</Td>
            <Td>
              <Badge tone={payout.status === "PAID" ? "success" : "warning"}>{payout.status === "PAID" ? "Paid" : "Pending"}</Badge>
              {payout.reference ? <p className="text-xs text-ink-500">{payout.reference}</p> : null}
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
