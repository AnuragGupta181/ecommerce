import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OrderStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { controlClass } from "@/components/ui/field";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { formatDateTime, formatINR, titleCase } from "@/lib/format";
import { hrefWith, pageParam, param, type SearchParams } from "@/lib/search-params";
import { api } from "@/lib/server/api";
import type { OrderRow, OrderStatus, RiderRow } from "@/lib/types";

export const metadata: Metadata = { title: "Orders" };

const TABS: (OrderStatus | undefined)[] = [undefined, "PLACED", "CONFIRMED", "PACKED", "RIDER_ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED", "RETURN_REQUESTED", "CANCELLED"];

export default function VendorOrdersPage({ searchParams }: PageProps<"/vendor/orders">) {
  return (
    <>
      <PageHeader title="Orders" description="Confirm new orders, pack them and hand them to your rider" />
      <Suspense fallback={<TableSkeleton />}>
        <OrdersContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function OrdersContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const status = param(params, "status") as OrderStatus | undefined;
  const filters = { q: param(params, "q"), status, riderId: param(params, "riderId"), from: param(params, "from"), to: param(params, "to") };
  const [{ items, meta }, counts, riders] = await Promise.all([
    api.list<OrderRow>("/vendor/orders", { ...filters, page: pageParam(params), limit: 20 }),
    api.get<Partial<Record<OrderStatus, number>>>("/vendor/orders/status-counts"),
    api.list<RiderRow>("/vendor/riders", { limit: 100 }),
  ]);
  const total = Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0);

  return (
    <Card>
      <nav className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-3">
        {TABS.map((tab) => {
          const active = tab === status;
          const count = tab ? (counts[tab] ?? 0) : total;
          return (
            <Link
              key={tab ?? "all"}
              href={hrefWith("/vendor/orders", params, { status: tab, page: undefined })}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2.5 font-semibold whitespace-nowrap ${active ? "border-brand-600 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-900"}`}
            >
              {tab ? titleCase(tab) : "All"}
              <span className={`rounded-full px-1.5 text-xs ${active ? "bg-brand-100" : "bg-canvas"}`}>{count}</span>
            </Link>
          );
        })}
      </nav>
      <FilterBar action="/vendor/orders">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <SearchInput name="q" defaultValue={filters.q} placeholder="Order number, customer name or phone" />
        <FilterSelect name="riderId" defaultValue={filters.riderId ?? ""}>
          <option value="">Any rider</option>
          {riders.items.map((rider) => (
            <option key={rider.id} value={rider.id}>
              {rider.name}
            </option>
          ))}
        </FilterSelect>
        <input type="date" name="from" defaultValue={filters.from} aria-label="From date" className={`${controlClass} w-auto`} />
        <input type="date" name="to" defaultValue={filters.to} aria-label="To date" className={`${controlClass} w-auto`} />
        <button type="submit" className="h-10 rounded-control border border-line px-3 font-semibold hover:bg-brand-50">
          Apply
        </button>
      </FilterBar>
      {items.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No orders here" description="New orders from customers near your shop show up here." />
      ) : (
        <>
          <Table minWidth={860}>
            <THead>
              <Th>Order</Th>
              <Th>Customer</Th>
              <Th align="right">Items</Th>
              <Th align="right">Amount</Th>
              <Th>Payment</Th>
              <Th>Rider</Th>
              <Th>Status</Th>
            </THead>
            <tbody>
              {items.map((order) => (
                <Tr key={order.id}>
                  <Td>
                    <Link href={`/vendor/orders/${order.id}`} className="font-semibold hover:underline">
                      {order.orderNumber}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {formatDateTime(order.createdAt)}
                      {order.branch ? ` · ${order.branch.name}` : ""}
                    </p>
                  </Td>
                  <Td>
                    <p>{order.user.name}</p>
                    <p className="text-xs text-ink-500">{order.user.phone}</p>
                  </Td>
                  <Td numeric>{order.itemCount}</Td>
                  <Td numeric className="font-semibold">
                    {formatINR(order.payable)}
                  </Td>
                  <Td>
                    <p>{order.paymentMethod === "COD" ? "Cash" : "UPI on delivery"}</p>
                    <p className="text-xs text-ink-500">{titleCase(order.paymentStatus)}</p>
                  </Td>
                  <Td className="text-ink-700">{order.rider?.name ?? "—"}</Td>
                  <Td>
                    <OrderStatusBadge status={order.status} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination meta={meta} pathname="/vendor/orders" params={params} />
        </>
      )}
    </Card>
  );
}
