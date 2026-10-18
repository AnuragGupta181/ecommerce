import { Boxes } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { Thumb } from "@/components/ui/thumb";
import { formatCount, formatINR } from "@/lib/format";
import { pageParam, param, type SearchParams } from "@/lib/search-params";
import { api } from "@/lib/server/api";
import { PLATFORM_SHOP_SLUG, type Listing, type ListingSummary, type VendorRow } from "@/lib/marketplace-types";
import type { Category } from "@/lib/types";

export const metadata: Metadata = { title: "Inventory" };

const statusBadge = { in: { tone: "success", label: "In stock" }, low: { tone: "warning", label: "Low" }, out: { tone: "danger", label: "Out" } } as const;

export default function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  return (
    <>
      <PageHeader
        title="Shop stock"
        description="Read-only: every shop's stock, including the platform's own shop. Each shop manages its prices and stock from the shop portal."
      />
      <Suspense fallback={<TableSkeleton />}>
        <InventoryContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function InventoryContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = {
    q: param(params, "q"),
    vendorId: param(params, "vendorId"),
    categoryId: param(params, "categoryId"),
    status: param(params, "status") ?? "all",
    sort: param(params, "sort") ?? "name",
  };
  const [{ items, meta }, summary, categories, vendors] = await Promise.all([
    api.list<Listing>("/admin/inventory", { ...filters, page: pageParam(params), limit: 25 }),
    api.get<ListingSummary>("/admin/inventory/summary", { vendorId: filters.vendorId }),
    api.get<Category[]>("/admin/categories"),
    api.list<VendorRow>("/admin/vendors", { limit: 100 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Units in stock" value={formatCount(summary.totalUnits)} />
        <StatCard label="Low stock variants" value={formatCount(summary.lowStock)} />
        <StatCard label="Out of stock variants" value={formatCount(summary.outOfStock)} />
      </div>
      <Card>
        <FilterBar action="/inventory">
          <SearchInput name="q" defaultValue={filters.q} placeholder="Search product, SKU or variant" />
          <FilterSelect name="vendorId" defaultValue={filters.vendorId ?? ""}>
            <option value="">All shops</option>
            {vendors.items.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.shopName}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect name="categoryId" defaultValue={filters.categoryId ?? ""}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.parent ? `${category.parent.name} › ` : ""}
                {category.name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect name="status" defaultValue={filters.status}>
            <option value="all">All stock levels</option>
            <option value="in">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </FilterSelect>
          <FilterSelect name="sort" defaultValue={filters.sort}>
            <option value="name">Sort: name</option>
            <option value="stock">Sort: lowest stock first</option>
          </FilterSelect>
        </FilterBar>
        {items.length === 0 ? (
          <EmptyState icon={Boxes} title="Nothing matches these filters" />
        ) : (
          <>
            <Table minWidth={860}>
              <THead>
                <Th>Product</Th>
                <Th>Shop</Th>
                <Th align="right">Price</Th>
                <Th align="right">Stock</Th>
                <Th align="right">Alert at</Th>
                <Th>Status</Th>
              </THead>
              <tbody>
                {items.map((row) => (
                  <Tr key={row.id}>
                    <Td>
                      <Link href={`/products/${row.product.id}`} className="flex items-center gap-3">
                        <Thumb src={row.product.imageUrl} alt={row.product.name} size={36} />
                        <span className="min-w-0">
                          <span className="line-clamp-1 font-semibold hover:underline">{row.product.name}</span>
                          <span className="text-xs text-ink-500">
                            {row.variant.label} · {row.variant.sku} · {row.product.category}
                            {!row.isAvailable || !row.product.isActive ? " · not for sale" : ""}
                          </span>
                        </span>
                      </Link>
                    </Td>
                    <Td>
                      <p className="flex items-center gap-2">
                        {row.vendor.shopName}
                        {row.vendor.slug === PLATFORM_SHOP_SLUG ? <Badge tone="neutral">Platform shop</Badge> : null}
                      </p>
                      <p className="text-xs text-ink-500">{row.branch.name}</p>
                    </Td>
                    <Td numeric>{formatINR(row.price)}</Td>
                    <Td numeric>
                      <span className="text-base font-bold">{formatCount(row.stock)}</span>
                    </Td>
                    <Td numeric className="text-ink-500">
                      {row.lowStockThreshold}
                    </Td>
                    <Td>
                      <Badge tone={statusBadge[row.status].tone}>{statusBadge[row.status].label}</Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination meta={meta} pathname="/inventory" params={params} />
          </>
        )}
      </Card>
    </div>
  );
}
