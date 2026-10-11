import { AlertTriangle, LayoutDashboard } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { OrderStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { formatCount, formatDateTime, formatINR, titleCase } from "@/lib/format";
import { param, type SearchParams } from "@/lib/search-params";
import { api } from "@/lib/server/api";
import type { Dashboard } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

const RANGES = [7, 30, 90];

export default function DashboardPage({ searchParams }: PageProps<"/">) {
  return (
    <>
      <PageHeader title="Dashboard" description="Sales, orders and stock at a glance" />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function DashboardContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const requested = Number(param(await searchParams, "days"));
  const days = RANGES.includes(requested) ? requested : 30;
  const data = await api.get<Dashboard>("/admin/dashboard", { days });
  const { kpis } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2">
        {RANGES.map((range) => (
          <Link
            key={range}
            href={`/?days=${range}`}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${range === days ? "border-brand-500 bg-brand-500 text-ink-900" : "border-line bg-surface text-ink-700 hover:bg-brand-50"}`}
          >
            Last {range} days
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={formatINR(kpis.revenue.value)} change={kpis.revenue.change} footnote={`${formatINR(kpis.revenueToday)} today`} />
        <StatCard label="Orders" value={formatCount(kpis.orders.value)} change={kpis.orders.change} footnote={`${kpis.ordersToday} today`} />
        <StatCard label="Average order value" value={formatINR(kpis.averageOrderValue.value)} change={kpis.averageOrderValue.change} />
        <StatCard label="New customers" value={formatCount(kpis.newCustomers.value)} change={kpis.newCustomers.change} />
      </div>

      {kpis.pendingOrders > 0 || kpis.lowStock > 0 || kpis.outOfStock > 0 ? (
        <div className="flex flex-wrap gap-3">
          {kpis.pendingOrders > 0 ? (
            <Link href="/orders?status=PLACED" className="flex items-center gap-2 rounded-control border border-brand-200 bg-brand-50 px-4 py-2.5 font-semibold hover:bg-brand-100">
              {kpis.pendingOrders} orders waiting to be processed
            </Link>
          ) : null}
          {kpis.lowStock + kpis.outOfStock > 0 ? (
            <Link href="/inventory?status=low" className="flex items-center gap-2 rounded-control border border-line bg-surface px-4 py-2.5 font-semibold text-warning hover:bg-brand-50">
              <AlertTriangle size={16} /> {kpis.lowStock} low stock · {kpis.outOfStock} out of stock
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Revenue" className="xl:col-span-2">
          <div className="p-4">
            <RevenueChart series={data.series} />
          </div>
        </Card>
        <Card title="Orders by status">
          <ul className="flex flex-col gap-2 p-5">
            {data.statusBreakdown.length === 0 ? <li className="text-ink-500">No orders in this range</li> : null}
            {data.statusBreakdown
              .sort((a, b) => b.count - a.count)
              .map((row) => (
                <li key={row.status} className="flex items-center justify-between">
                  <Link href={`/orders?status=${row.status}`} className="hover:underline">
                    {titleCase(row.status)}
                  </Link>
                  <span className="tabular font-semibold">{row.count}</span>
                </li>
              ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Recent orders" actions={<Link href="/orders" className="text-xs font-semibold text-brand-700 hover:underline">View all</Link>}>
          {data.recentOrders.length === 0 ? (
            <EmptyState icon={LayoutDashboard} title="No orders yet" />
          ) : (
            <Table minWidth={480}>
              <THead>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Status</Th>
                <Th align="right">Amount</Th>
              </THead>
              <tbody>
                {data.recentOrders.map((order) => (
                  <Tr key={order.id}>
                    <Td>
                      <Link href={`/orders/${order.id}`} className="font-semibold hover:underline">
                        {order.orderNumber}
                      </Link>
                      <p className="text-xs text-ink-500">{formatDateTime(order.createdAt)}</p>
                    </Td>
                    <Td>{order.customer}</Td>
                    <Td>
                      <OrderStatusBadge status={order.status} />
                    </Td>
                    <Td numeric>{formatINR(order.payable)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <Card title="Top products">
          {data.topProducts.length === 0 ? (
            <EmptyState icon={LayoutDashboard} title="No sales in this range" />
          ) : (
            <Table minWidth={420}>
              <THead>
                <Th>Product</Th>
                <Th align="right">Units</Th>
                <Th align="right">Revenue</Th>
              </THead>
              <tbody>
                {data.topProducts.map((product) => (
                  <Tr key={product.productId}>
                    <Td>
                      <Link href={`/products/${product.productId}`} className="hover:underline">
                        {product.name}
                      </Link>
                    </Td>
                    <Td numeric>{formatCount(product.quantity)}</Td>
                    <Td numeric>{formatINR(product.revenue)}</Td>
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

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}
