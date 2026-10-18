import Link from "next/link";
import { Badge, OrderStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate, formatDateTime, formatINR, titleCase } from "@/lib/format";
import type { TicketDetail } from "@/lib/marketplace-types";
import { ticketTone } from "@/lib/status-tones";
import { TicketReply, TicketStatusCard, type TicketActionSet } from "./ticket-controls";

/** A support thread with everything needed to answer it: the customer, their orders and the order or subscription it is about. */
export function TicketView({ ticket, actions, portal }: { ticket: TicketDetail; actions: TicketActionSet; portal: "admin" | "vendor" }) {
  const { context } = ticket;
  const orderHref = (id: string) => (portal === "admin" ? `/orders/${id}` : `/vendor/orders/${id}`);
  const closed = ticket.status === "CLOSED";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-bold">{ticket.subject}</h1>
        <Badge tone={ticketTone[ticket.status]}>{titleCase(ticket.status)}</Badge>
        <Badge tone={ticket.level === "MAJOR" ? "danger" : "neutral"}>{ticket.level === "MAJOR" ? "Platform" : "Shop"}</Badge>
        <span className="text-ink-500">
          {ticket.number} · {titleCase(ticket.category)} · opened {formatDateTime(ticket.createdAt)}
          {ticket.vendor ? ` · ${ticket.vendor.shopName}` : ""}
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Conversation" className="xl:col-span-2">
          <ol className="flex flex-col gap-3 p-5">
            {ticket.messages.map((message) => (
              <li key={message.id} className={`flex ${message.mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-card px-4 py-3 ${
                    message.authorRole === "SYSTEM" ? "bg-canvas text-ink-500 italic" : message.mine ? "bg-brand-100" : "border border-line bg-surface"
                  }`}
                >
                  <p className="text-xs font-semibold text-ink-500">{titleCase(message.authorRole)}</p>
                  <p className="whitespace-pre-wrap">{message.body}</p>
                  <p className="mt-1 text-xs text-ink-500">{formatDateTime(message.createdAt)}</p>
                </div>
              </li>
            ))}
          </ol>
          {closed ? <p className="border-t border-line p-4 text-ink-500">This ticket is closed.</p> : <TicketReply ticketId={ticket.id} actions={actions} />}
        </Card>

        <div className="flex flex-col gap-6">
          <TicketStatusCard ticketId={ticket.id} status={ticket.status} level={ticket.level} actions={actions} />

          <Card title="Customer">
            <div className="flex flex-col gap-1 p-5 text-ink-700">
              <p className="font-semibold text-ink-900">{context.customer.name}</p>
              {portal === "admin" ? <p>{context.customer.email}</p> : null}
              <p>{context.customer.phone}</p>
              <p className="text-xs text-ink-500">
                Customer since {formatDate(context.customer.createdAt)} · {context.customer.deliveredOrders} delivered orders · {formatINR(context.customer.totalSpent)} spent
                {context.customer.isBlocked ? " · blocked" : ""}
              </p>
            </div>
          </Card>

          {context.order ? (
            <Card title="About this order">
              <div className="flex flex-col gap-2 p-5">
                <div className="flex items-center justify-between gap-2">
                  <Link href={orderHref(context.order.id)} className="font-semibold hover:underline">
                    {context.order.orderNumber}
                  </Link>
                  <OrderStatusBadge status={context.order.status} />
                </div>
                <p className="text-xs text-ink-500">
                  {formatINR(context.order.payable)} · {context.order.paymentMethod === "COD" ? "cash" : "UPI"} · {context.order.shop ?? ""}
                  {context.order.deliveredAt ? ` · delivered ${formatDateTime(context.order.deliveredAt)}` : ""}
                </p>
                <ul className="text-ink-700">
                  {context.order.items.map((item) => (
                    <li key={`${item.productName}-${item.variantLabel}`}>
                      {item.quantity} × {item.productName} {item.variantLabel}
                    </li>
                  ))}
                </ul>
                {context.order.rider ? <p className="text-xs text-ink-500">Rider: {context.order.rider.name}, {context.order.rider.phone}</p> : null}
              </div>
            </Card>
          ) : null}

          {context.subscription ? (
            <Card title="About this subscription">
              <p className="p-5">
                {portal === "vendor" ? (
                  <Link href={`/vendor/subscriptions/${context.subscription.id}`} className="font-semibold hover:underline">
                    {context.subscription.number}
                  </Link>
                ) : (
                  <span className="font-semibold">{context.subscription.number}</span>
                )}{" "}
                · {titleCase(context.subscription.status)}
              </p>
            </Card>
          ) : null}

          {context.recentOrders.length > 0 ? (
            <Card title="Recent orders">
              <ul className="flex flex-col">
                {context.recentOrders.map((order) => (
                  <li key={order.id} className="flex items-center justify-between gap-2 border-b border-line px-5 py-2.5 last:border-b-0">
                    <Link href={orderHref(order.id)} className="font-semibold hover:underline">
                      {order.orderNumber}
                    </Link>
                    <span className="tabular text-xs text-ink-500">{formatINR(order.payable)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
