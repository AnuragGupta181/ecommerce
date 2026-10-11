import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderActions } from "@/components/orders/order-actions";
import { Badge, OrderStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { Thumb } from "@/components/ui/thumb";
import { formatDateTime, formatINR, titleCase } from "@/lib/format";
import { ApiError, api } from "@/lib/server/api";
import type { OrderDetail, RiderRow } from "@/lib/types";

export const metadata: Metadata = { title: "Order" };

export default function OrderPage({ params }: PageProps<"/orders/[id]">) {
  return (
    <>
      <Link href="/orders" className="mb-4 inline-flex items-center gap-1.5 font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft size={16} /> Orders
      </Link>
      <Suspense fallback={<TableSkeleton rows={10} />}>
        <OrderContent params={params} />
      </Suspense>
    </>
  );
}

async function OrderContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, riders] = await Promise.all([
    api.get<OrderDetail>(`/admin/orders/${id}`).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }),
    api.list<RiderRow>("/admin/riders", { active: "true", limit: 100 }),
  ]);
  const address = order.shippingAddress;

  const priceRows: [string, number, string?][] = [
    ["Items (MRP)", order.itemsMrp],
    ["Discount on MRP", order.itemsTotal - order.itemsMrp, "text-success"],
    ...(order.couponDiscount ? [[`Coupon ${order.couponCode ?? ""}`, -order.couponDiscount, "text-success"] as [string, number, string]] : []),
    ...(order.coinsUsed ? [["Coins redeemed", -order.coinsUsed * 100, "text-success"] as [string, number, string]] : []),
    ["Delivery", order.deliveryFee],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-bold">{order.orderNumber}</h1>
        <OrderStatusBadge status={order.status} />
        <span className="text-ink-500">Placed {formatDateTime(order.createdAt)}</span>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card title={`Items (${order.items.length})`}>
            <Table minWidth={560}>
              <THead>
                <Th>Product</Th>
                <Th align="right">Price</Th>
                <Th align="right">Qty</Th>
                <Th align="right">Total</Th>
              </THead>
              <tbody>
                {order.items.map((item) => (
                  <Tr key={item.id}>
                    <Td>
                      <Link href={`/products/${item.productId}`} className="flex items-center gap-3">
                        <Thumb src={item.imageUrl} alt={item.productName} />
                        <span>
                          <span className="line-clamp-1 font-semibold hover:underline">{item.productName}</span>
                          <span className="text-xs text-ink-500">
                            {item.variantLabel} · {item.sku}
                          </span>
                        </span>
                      </Link>
                    </Td>
                    <Td numeric>
                      {formatINR(item.price)}
                      {item.mrp > item.price ? <s className="block text-xs text-ink-500">{formatINR(item.mrp)}</s> : null}
                    </Td>
                    <Td numeric>{item.quantity}</Td>
                    <Td numeric className="font-semibold">
                      {formatINR(item.lineTotal)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <dl className="flex flex-col gap-2 border-t border-line p-5">
              {priceRows.map(([label, amount, tone]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-ink-700">{label}</dt>
                  <dd className={`tabular ${tone ?? ""}`}>
                    {amount < 0 ? "−" : ""}
                    {formatINR(Math.abs(amount))}
                  </dd>
                </div>
              ))}
              <div className="mt-1 flex justify-between border-t border-dashed border-line pt-3 text-base font-bold">
                <dt>Total payable</dt>
                <dd className="tabular">{formatINR(order.payable)}</dd>
              </div>
              <p className="text-xs text-ink-500">
                {order.paymentMethod === "COD" ? "Cash on delivery" : "UPI on delivery"} · {titleCase(order.paymentStatus)} · {order.coinsEarned || order.coinsToEarn} coins
                {order.coinsEarned ? " earned" : " on delivery"}
              </p>
            </dl>
          </Card>

          <Card title="Timeline">
            <ol className="flex flex-col gap-4 p-5">
              {order.history.map((entry, index) => (
                <li key={entry.id} className="flex gap-3">
                  <span className={`mt-1 size-2.5 shrink-0 rounded-full ${index === order.history.length - 1 ? "bg-brand-500 ring-4 ring-brand-100" : "bg-ink-300"}`} />
                  <div>
                    <p className="font-semibold">{titleCase(entry.status)}</p>
                    {entry.note ? <p className="text-ink-700">{entry.note}</p> : null}
                    <p className="text-xs text-ink-500">
                      {formatDateTime(entry.createdAt)}
                      {entry.actorRole ? ` · by ${entry.actorRole.toLowerCase()}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card title="Notifications sent">
            {order.notificationLogs.length === 0 ? (
              <p className="p-5 text-ink-500">No email or WhatsApp messages for this order yet.</p>
            ) : (
              <Table minWidth={560}>
                <THead>
                  <Th>Channel</Th>
                  <Th>To</Th>
                  <Th>Message</Th>
                  <Th>Status</Th>
                </THead>
                <tbody>
                  {order.notificationLogs.map((log) => (
                    <Tr key={log.id}>
                      <Td>
                        {titleCase(log.channel)}
                        <p className="text-xs text-ink-500">{formatDateTime(log.createdAt)}</p>
                      </Td>
                      <Td>
                        {titleCase(log.recipientType)}
                        <p className="text-xs text-ink-500">{log.recipient}</p>
                      </Td>
                      <Td className="text-ink-700">{log.subject ?? titleCase(log.template)}</Td>
                      <Td>
                        <Badge tone={log.status === "SENT" ? "success" : log.status === "FAILED" ? "danger" : "neutral"}>{titleCase(log.status)}</Badge>
                        {log.error ? <p className="mt-1 max-w-48 text-xs text-danger">{log.error}</p> : null}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <OrderActions order={order} riders={riders.items} />

          <Card title="Customer">
            <div className="flex flex-col gap-1 p-5">
              <Link href={`/customers/${order.user.id}`} className="font-semibold hover:underline">
                {order.user.name}
              </Link>
              <p className="text-ink-700">{order.user.email}</p>
              <p className="text-ink-700">{order.user.phone}</p>
              {order.customerNote ? <p className="mt-2 rounded-control bg-brand-50 p-3 text-ink-700">“{order.customerNote}”</p> : null}
            </div>
          </Card>

          <Card title="Delivery address">
            <address className="flex flex-col gap-0.5 p-5 not-italic text-ink-700">
              <span className="font-semibold text-ink-900">{address.name}</span>
              <span>{address.line1}</span>
              {address.line2 ? <span>{address.line2}</span> : null}
              {address.landmark ? <span>Near {address.landmark}</span> : null}
              <span>
                {address.city}, {address.state} {address.pincode}
              </span>
              <span>{address.phone}</span>
            </address>
          </Card>

          {order.cancelReason || order.returnReason ? (
            <Card title={order.returnReason ? "Return reason" : "Cancellation reason"}>
              <p className="p-5 text-ink-700">{order.returnReason ?? order.cancelReason}</p>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
