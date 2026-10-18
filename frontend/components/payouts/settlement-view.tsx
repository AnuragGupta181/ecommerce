import { Card } from "@/components/ui/card";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { formatDate, formatINR } from "@/lib/format";

export type SettlementRows = {
  orderCount: number;
  deliveryCount: number;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  orders: { id: string; orderNumber: string; deliveredAt: string | null; payable: number; commissionAmount: number; vendorEarning: number }[];
  drops: { id: string; date: string; goodsAmount: number; deliveryFee: number; subscription: { number: string } }[];
};

/** Net > 0: the platform pays the shop. Net < 0: the shop collected cash and owes the platform its commission. */
export function netLabel(net: number): string {
  if (net > 0) return `Haat pays the shop ${formatINR(net)}`;
  if (net < 0) return `Shop pays Haat ${formatINR(-net)}`;
  return "Nothing to transfer";
}

export function SettlementView({ settlement }: { settlement: SettlementRows }) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <dl className="grid gap-4 p-5 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-ink-500">Sales</dt>
            <dd className="tabular text-lg font-bold">{formatINR(settlement.grossAmount)}</dd>
            <dd className="text-xs text-ink-500">
              {settlement.orderCount} orders · {settlement.deliveryCount} drops
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-500">Commission</dt>
            <dd className="tabular text-lg font-bold">{formatINR(settlement.commissionAmount)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-ink-500">Settlement</dt>
            <dd className={`text-lg font-bold ${settlement.netAmount < 0 ? "text-danger" : ""}`}>{netLabel(settlement.netAmount)}</dd>
            <dd className="text-xs text-ink-500">Cash collected on delivery is already with the shop, so it is netted off.</dd>
          </div>
        </dl>
      </Card>
      {settlement.orders.length > 0 ? (
        <Card title="Orders">
          <Table minWidth={560}>
            <THead>
              <Th>Order</Th>
              <Th>Delivered</Th>
              <Th align="right">Paid by customer</Th>
              <Th align="right">Commission</Th>
              <Th align="right">Shop earning</Th>
            </THead>
            <tbody>
              {settlement.orders.map((order) => (
                <Tr key={order.id}>
                  <Td className="font-semibold">{order.orderNumber}</Td>
                  <Td>{order.deliveredAt ? formatDate(order.deliveredAt) : "—"}</Td>
                  <Td numeric>{formatINR(order.payable)}</Td>
                  <Td numeric>{formatINR(order.commissionAmount)}</Td>
                  <Td numeric className="font-semibold">
                    {formatINR(order.vendorEarning)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}
      {settlement.drops.length > 0 ? (
        <Card title="Subscription drops">
          <Table minWidth={480}>
            <THead>
              <Th>Subscription</Th>
              <Th>Date</Th>
              <Th align="right">Goods</Th>
              <Th align="right">Delivery</Th>
            </THead>
            <tbody>
              {settlement.drops.map((drop) => (
                <Tr key={drop.id}>
                  <Td>{drop.subscription.number}</Td>
                  <Td>{formatDate(drop.date)}</Td>
                  <Td numeric>{formatINR(drop.goodsAmount)}</Td>
                  <Td numeric>{formatINR(drop.deliveryFee)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}
    </div>
  );
}
