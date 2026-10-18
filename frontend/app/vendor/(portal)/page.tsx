import { AlertTriangle, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { OrderStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { formatCount, formatDateTime, formatINR } from "@/lib/format";
import type { VendorDashboard } from "@/lib/marketplace-types";
import { param, type SearchParams } from "@/lib/search-params";
import { api } from "@/lib/server/api";

export const metadata: Metadata = { title: "Dashboard" };

const RANGES = [7, 30, 90];

export default function VendorDashboardPage({ searchParams }: PageProps<"/vendor">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DashboardContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const requested = Number(param(await searchParams, "days"));
  const days = RANGES.includes(requested) ? requested : 7;
  const data = await api.get<VendorDashboard>("/vendor/profile/dashboard", { days });
  const { today, period, stock } = data;

  const todos: { label: string; count: number; href: string }[] = [
    { label: "New orders to confirm", count: today.toConfirm, href: "/vendor/orders?status=PLACED" },
    { label: "Orders to pack", count: today.toPack, href: "/vendor/orders?status=CONFIRMED" },
    { label: "Packed, waiting for a rider", count: today.toDispatch, href: "/vendor/orders?status=PACKED" },
    { label: "Out for delivery", count: today.outForDelivery, href: "/vendor/orders?status=OUT_FOR_DELIVERY" },
    ...(data.shop.subscriptionsEnabled
      ? [{ label: `Subscription drops today (${today.dropsDelivered} sent)`, count: today.dropsScheduled, href: "/vendor/deliveries" }]
      : []),
    { label: "Unread messages", count: data.unreadMessages, href: "/vendor/messages" },
    { label: "Open tickets", count: data.openTickets, href: "/vendor/tickets" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={data.shop.shopName} description={`Today, ${today.date}. Commission ${data.shop.commissionBps / 100}% on goods.`} />

      <ShopStatusNotice status={data.shop.status} reason={data.shop.rejectionReason} />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="To do now" className="xl:col-span-1">
          <ul className="flex flex-col">
            {todos.map((todo) => (
              <li key={todo.label} className="border-b border-line last:border-b-0">
                <Link href={todo.href} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-brand-50">
                  <span className={todo.count > 0 ? "font-semibold" : "text-ink-500"}>{todo.label}</span>
                  <span className="flex items-center gap-2">
                    <span className={`tabular rounded-full px-2 text-xs font-bold ${todo.count > 0 ? "bg-brand-500 text-ink-900" : "bg-canvas text-ink-500"}`}>{todo.count}</span>
                    <ArrowRight size={14} className="text-ink-300" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-4 xl:col-span-2">
          <div className="flex gap-2">
            {RANGES.map((range) => (
              <Link
                key={range}
                href={`/vendor?days=${range}`}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${range === days ? "border-brand-500 bg-brand-500 text-ink-900" : "border-line bg-surface text-ink-700 hover:bg-brand-50"}`}
              >
                Last {range} days
              </Link>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Sales delivered" value={formatINR(period.sales)} footnote={`${period.ordersDelivered} orders`} />
            <StatCard label="Your earnings" value={formatINR(period.earnings)} footnote={`after ${formatINR(period.commission)} commission`} />
            <StatCard label="Active subscribers" value={formatCount(data.activeSubscribers)} />
          </div>
          <Card title="Revenue">
            <div className="p-4">
              <RevenueChart series={data.series} />
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Stock" actions={<Link href="/vendor/stock" className="text-xs font-semibold hover:underline">Manage</Link>}>
          <dl className="flex flex-col gap-2 p-5">
            <div className="flex justify-between">
              <dt className="text-ink-700">Units in stock</dt>
              <dd className="tabular font-semibold">{formatCount(stock.totalUnits)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-700">Stock value at selling price</dt>
              <dd className="tabular font-semibold">{formatINR(stock.stockValue)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-700">Low stock</dt>
              <dd className={`tabular font-semibold ${stock.lowStock ? "text-warning" : ""}`}>{stock.lowStock}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-700">Out of stock</dt>
              <dd className={`tabular font-semibold ${stock.outOfStock ? "text-danger" : ""}`}>{stock.outOfStock}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Recent orders" className="xl:col-span-2">
          {data.recentOrders.length === 0 ? (
            <p className="p-5 text-ink-500">No orders yet. Make sure your shop is online and has stock.</p>
          ) : (
            <Table minWidth={520}>
              <THead>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th align="right">Amount</Th>
                <Th>Status</Th>
              </THead>
              <tbody>
                {data.recentOrders.map((order) => (
                  <Tr key={order.id}>
                    <Td>
                      <Link href={`/vendor/orders/${order.id}`} className="font-semibold hover:underline">
                        {order.orderNumber}
                      </Link>
                      <p className="text-xs text-ink-500">{formatDateTime(order.createdAt)}</p>
                    </Td>
                    <Td>{order.customer}</Td>
                    <Td numeric>{formatINR(order.payable)}</Td>
                    <Td>
                      <OrderStatusBadge status={order.status} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}

function ShopStatusNotice({ status, reason }: { status: VendorDashboard["shop"]["status"]; reason: string | null }) {
  if (status === "APPROVED") return null;
  const text = {
    PENDING: "Your shop is waiting for approval. Set up your stock now; customers will see it once Haat approves the shop.",
    REJECTED: `Your application was not approved${reason ? `: ${reason}` : "."} Contact Haat support to appeal.`,
    SUSPENDED: `Your shop is suspended${reason ? `: ${reason}` : "."} It is hidden from customers and read-only until Haat reactivates it.`,
  }[status];
  return (
    <div role="status" className={`flex items-start gap-3 rounded-card border p-4 ${status === "PENDING" ? "border-brand-200 bg-brand-50" : "border-transparent bg-danger-soft text-danger"}`}>
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <p className="font-semibold">{text}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-6 xl:grid-cols-3">
        <Skeleton className="h-80" />
        <Skeleton className="h-80 xl:col-span-2" />
      </div>
    </div>
  );
}
