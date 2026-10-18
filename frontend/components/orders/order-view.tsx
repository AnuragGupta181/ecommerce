import { FileText } from "lucide-react";
import Link from "next/link";
import { Badge, OrderStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { Thumb } from "@/components/ui/thumb";
import { downloadHref } from "@/lib/download-href";
import { formatDateTime, formatINR, titleCase } from "@/lib/format";
import type { MarketplaceOrderDetail } from "@/lib/marketplace-types";
import type { RiderRow } from "@/lib/types";
import { OrderActions, type OrderActionSet } from "./order-actions";

type Portal = "admin" | "vendor";

/** One order, as admins and shops see it. Shops also see their cost prices; only admins get links into the catalog and customers. */
export function OrderView({ order, riders, actions, portal }: { order: MarketplaceOrderDetail; riders: RiderRow[]; actions: OrderActionSet; portal: Portal }) {
  const address = order.shippingAddress;
  const isAdmin = portal === "admin";
  const invoiceHref = order.invoiceNumber ? downloadHref(isAdmin ? "/download" : "/vendor/download", `/documents/invoice/${order.id}`) : null;

  const priceRows: [string, number, string?][] = [
    ["Items (MRP)", order.itemsMrp],
    ["Discount on MRP", order.itemsTotal - order.itemsMrp, "text-success"],
    ...(order.couponDiscount ? [[`Coupon ${order.couponCode ?? ""}`, -order.couponDiscount, "text-success"] as [string, number, string]] : []),
    ...(order.coinsUsed ? [["Coins redeemed", -order.coinsUsed * 100, "text-success"] as [string, number, string]] : []),
    [order.distanceKm ? `Delivery (${order.distanceKm} km)` : "Delivery", order.deliveryFee],
  ];
  const cost = order.items.reduce((sum, item) => sum + (item.costPrice ?? 0) * item.quantity, 0);
  const hasCost = order.items.some((item) => item.costPrice != null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-bold">{order.orderNumber}</h1>
        <OrderStatusBadge status={order.status} />
        <span className="text-ink-500">Placed {formatDateTime(order.createdAt)}</span>
        {invoiceHref ? (
          <a href={invoiceHref} className="ml-auto inline-flex items-center gap-1.5 rounded-control border border-line px-3 py-1.5 font-semibold hover:bg-brand-50">
            <FileText size={14} /> Invoice {order.invoiceNumber}
          </a>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card title={`Items (${order.items.length})`}>
            <Table minWidth={560}>
              <THead>
                <Th>Product</Th>
                <Th align="right">Price</Th>
                {!isAdmin && hasCost ? <Th align="right">Cost</Th> : null}
                <Th align="right">Qty</Th>
                <Th align="right">Total</Th>
              </THead>
              <tbody>
                {order.items.map((item) => {
                  const product = (
                    <span className="flex items-center gap-3">
                      <Thumb src={item.imageUrl} alt={item.productName} />
                      <span>
                        <span className="line-clamp-1 font-semibold">{item.productName}</span>
                        <span className="text-xs text-ink-500">
                          {item.variantLabel} · {item.sku}
                        </span>
                      </span>
                    </span>
                  );
                  return (
                    <Tr key={item.id}>
                      <Td>
                        {isAdmin ? (
                          <Link href={`/products/${item.productId}`} className="hover:underline">
                            {product}
                          </Link>
                        ) : (
                          product
                        )}
                      </Td>
                      <Td numeric>
                        {formatINR(item.price)}
                        {item.mrp > item.price ? <s className="block text-xs text-ink-500">{formatINR(item.mrp)}</s> : null}
                      </Td>
                      {!isAdmin && hasCost ? (
                        <Td numeric className="text-ink-500">
                          {item.costPrice != null ? formatINR(item.costPrice) : "—"}
                        </Td>
                      ) : null}
                      <Td numeric>{item.quantity}</Td>
                      <Td numeric className="font-semibold">
                        {formatINR(item.lineTotal)}
                      </Td>
                    </Tr>
                  );
                })}
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
                {order.paymentMethod === "COD" ? "Cash on delivery" : "UPI on delivery"} · {titleCase(order.paymentStatus)}
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

          {isAdmin ? (
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
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          <OrderActions order={order} riders={riders} actions={actions} ridersHref={isAdmin ? "/riders" : "/vendor/riders"} />

          <Card title={isAdmin ? "Shop and commission" : "Your earning"}>
            <dl className="flex flex-col gap-2 p-5">
              {isAdmin && order.vendor ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-700">Shop</dt>
                  <dd className="text-right">
                    <Link href={`/vendors/${order.vendor.id}`} className="font-semibold hover:underline">
                      {order.vendor.shopName}
                    </Link>
                    {order.branch ? <span className="block text-xs text-ink-500">{order.branch.name}</span> : null}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-ink-700">Commission ({order.commissionBps / 100}%)</dt>
                <dd className="tabular">{formatINR(order.commissionAmount)}</dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>Shop earning</dt>
                <dd className="tabular">{formatINR(order.vendorEarning)}</dd>
              </div>
              {!isAdmin && hasCost ? (
                <div className="flex justify-between text-ink-700">
                  <dt>Profit after cost</dt>
                  <dd className="tabular">{formatINR(order.vendorEarning - order.deliveryFee - cost)}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card title="Customer">
            <div className="flex flex-col gap-1 p-5">
              {isAdmin ? (
                <Link href={`/customers/${order.user.id}`} className="font-semibold hover:underline">
                  {order.user.name}
                </Link>
              ) : (
                <p className="font-semibold">{order.user.name}</p>
              )}
              {isAdmin ? <p className="text-ink-700">{order.user.email}</p> : null}
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
