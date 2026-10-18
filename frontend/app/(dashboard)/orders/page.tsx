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
import type { VendorRow } from "@/lib/marketplace-types";
import { type OrderRow, type OrderStatus, type RiderRow } from "@/lib/types";

export const metadata: Metadata = { title: "Orders" };

const TABS: (OrderStatus | undefined)[] = [undefined, "PLACED", "CONFIRMED", "PACKED", "RIDER_ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED", "RETURN_REQUESTED", "CANCELLED"];

export default function OrdersPage({ searchParams }: PageProps<"/orders">) {
  return (
    <>
      <PageHeader title="Orders" description="Every shop's orders. Shops confirm and deliver their own; step in when needed." />
      <Suspense fallback={<TableSkeleton />}>
        <OrdersContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function OrdersContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const status = param(params, "status") as OrderStatus | undefined;
  const filters = { q: param(params, "q"), status, vendorId: param(params, "vendorId"), riderId: param(params, "riderId"), from: param(params, "from"), to: param(params, "to") };
  const [{ items, meta }, counts, riders, vendors] = await Promise.all([
    api.list<OrderRow>("/admin/orders", { ...filters, page: pageParam(params), limit: 20 }),
    api.get<Partial<Record<OrderStatus, number>>>("/admin/orders/status-counts", { vendorId: filters.vendorId }),
    api.list<RiderRow>("/admin/riders", { limit: 100, vendorId: filters.vendorId }),
    api.list<VendorRow>("/admin/vendors", { limit: 100 }),
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
              href={hrefWith("/orders", params, { status: tab, page: undefined })}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2.5 font-semibold whitespace-nowrap ${active ? "border-brand-600 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-900"}`}
            >
              {tab ? titleCase(tab) : "All"}
              <span className={`rounded-full px-1.5 text-xs ${active ? "bg-brand-100" : "bg-canvas"}`}>{count}</span>
            </Link>
          );
        })}
      </nav>
      <FilterBar action="/orders">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <SearchInput name="q" defaultValue={filters.q} placeholder="Order number, customer name, email or phone" />
        <FilterSelect name="vendorId" defaultValue={filters.vendorId ?? ""}>
          <option value="">All shops</option>
          {vendors.items.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.shopName}
            </option>
          ))}
        </FilterSelect>
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
        <EmptyState icon={ClipboardList} title="No orders found" />
      ) : (
        <>
          <Table minWidth={1000}>
            <THead>
              <Th>Order</Th>
              <Th>Customer</Th>
              <Th>Shop</Th>
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
                    <Link href={`/orders/${order.id}`} className="font-semibold hover:underline">
                      {order.orderNumber}
                    </Link>
                    <p className="text-xs text-ink-500">{formatDateTime(order.createdAt)}</p>
                  </Td>
                  <Td>
                    <p>{order.user.name}</p>
                    <p className="text-xs text-ink-500">{order.user.phone}</p>
                  </Td>
                  <Td>
                    <p>{order.vendor?.shopName ?? "—"}</p>
                    {order.branch ? <p className="text-xs text-ink-500">{order.branch.name}</p> : null}
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
          <Pagination meta={meta} pathname="/orders" params={params} />
        </>
      )}
    </Card>
  );
}

