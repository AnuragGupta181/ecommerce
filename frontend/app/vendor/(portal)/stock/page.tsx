import { Boxes, PackagePlus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { Thumb } from "@/components/ui/thumb";
import { AddFromCatalogButton, ListingEditButton, StockAdjustButton } from "@/components/vendor/listing-dialogs";
import { formatCount, formatINR } from "@/lib/format";
import type { Branch, Listing, ListingSummary } from "@/lib/marketplace-types";
import { pageParam, param, type SearchParams } from "@/lib/search-params";
import { api } from "@/lib/server/api";

export const metadata: Metadata = { title: "Products & stock" };

const statusBadge = { in: { tone: "success", label: "In stock" }, low: { tone: "warning", label: "Low" }, out: { tone: "danger", label: "Out" } } as const;

export default function VendorStockPage({ searchParams }: PageProps<"/vendor/stock">) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <StockContent searchParams={searchParams} />
    </Suspense>
  );
}

async function StockContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = { q: param(params, "q"), branchId: param(params, "branchId"), status: param(params, "status") ?? "all" };
  const [{ items, meta }, summary, branches] = await Promise.all([
    api.list<Listing>("/vendor/listings", { ...filters, page: pageParam(params), limit: 25 }),
    api.get<ListingSummary>("/vendor/listings/summary", { branchId: filters.branchId }),
    api.get<Branch[]>("/vendor/branches"),
  ]);
  const branchOptions = branches.map((branch) => ({ id: branch.id, name: branch.name }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Products & stock"
        description="Your prices and stock per shop. Every change is logged."
        actions={
          <>
            <ButtonLink href="/vendor/stock/new" variant="outline">
              <PackagePlus size={16} /> New product
            </ButtonLink>
            <AddFromCatalogButton branches={branchOptions} />
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Units in stock" value={formatCount(summary.totalUnits)} />
        <StatCard label="Stock value" value={formatINR(summary.stockValue)} footnote="at your price" />
        <StatCard label="Low stock" value={formatCount(summary.lowStock)} />
        <StatCard label="Out of stock" value={formatCount(summary.outOfStock)} />
      </div>
      <Card>
        <FilterBar action="/vendor/stock">
          <SearchInput name="q" defaultValue={filters.q} placeholder="Search product, SKU or variant" />
          {branches.length > 1 ? (
            <FilterSelect name="branchId" defaultValue={filters.branchId ?? ""}>
              <option value="">All branches</option>
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </FilterSelect>
          ) : null}
          <FilterSelect name="status" defaultValue={filters.status}>
            <option value="all">All stock levels</option>
            <option value="in">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </FilterSelect>
        </FilterBar>
        {items.length === 0 ? (
          <EmptyState icon={Boxes} title="Nothing here yet" description="Add products from the Haat catalog or create your own." />
        ) : (
          <>
            <Table minWidth={960}>
              <THead>
                <Th>Product</Th>
                <Th align="right">Price</Th>
                <Th align="right">Cost</Th>
                <Th align="right">Stock</Th>
                <Th>Status</Th>
                <Th />
              </THead>
              <tbody>
                {items.map((row) => (
                  <Tr key={row.id}>
                    <Td>
                      <span className="flex items-center gap-3">
                        <Thumb src={row.product.imageUrl} alt={row.product.name} size={36} />
                        <span className="min-w-0">
                          <span className="line-clamp-1 font-semibold">{row.product.name}</span>
                          <span className="text-xs text-ink-500">
                            {row.variant.label} · {row.variant.sku}
                            {branches.length > 1 ? ` · ${row.branch.name}` : ""}
                            {!row.isAvailable ? " · hidden" : ""}
                          </span>
                        </span>
                      </span>
                    </Td>
                    <Td numeric>
                      {formatINR(row.price)}
                      {row.mrp > row.price ? <s className="block text-xs text-ink-500">{formatINR(row.mrp)}</s> : null}
                    </Td>
                    <Td numeric className="text-ink-500">
                      {row.costPrice != null ? formatINR(row.costPrice) : "—"}
                    </Td>
                    <Td numeric>
                      <span className="text-base font-bold">{formatCount(row.stock)}</span>
                      <span className="block text-xs text-ink-500">alert at {row.lowStockThreshold}</span>
                    </Td>
                    <Td>
                      <Badge tone={statusBadge[row.status].tone}>{statusBadge[row.status].label}</Badge>
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-2">
                        <StockAdjustButton listing={row} />
                        <ListingEditButton listing={row} />
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination meta={meta} pathname="/vendor/stock" params={params} />
          </>
        )}
      </Card>
    </div>
  );
}
