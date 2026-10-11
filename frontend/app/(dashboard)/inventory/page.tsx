import { Boxes } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StockDialog } from "@/components/inventory/stock-dialog";
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
import type { Category, InventoryRow, InventorySummary } from "@/lib/types";

export const metadata: Metadata = { title: "Inventory" };

const statusBadge = { in: { tone: "success", label: "In stock" }, low: { tone: "warning", label: "Low" }, out: { tone: "danger", label: "Out" } } as const;

export default function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  return (
    <>
      <PageHeader title="Inventory" description="Stock per variant. Every change is recorded in the movement log." />
      <Suspense fallback={<TableSkeleton />}>
        <InventoryContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function InventoryContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = { q: param(params, "q"), categoryId: param(params, "categoryId"), status: param(params, "status") ?? "all" };
  const [{ items, meta }, summary, categories] = await Promise.all([
    api.list<InventoryRow>("/admin/inventory", { ...filters, page: pageParam(params), limit: 25 }),
    api.get<InventorySummary>("/admin/inventory/summary"),
    api.get<Category[]>("/admin/categories"),
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
        </FilterBar>
        {items.length === 0 ? (
          <EmptyState icon={Boxes} title="Nothing matches these filters" />
        ) : (
          <>
            <Table minWidth={860}>
              <THead>
                <Th>Product</Th>
                <Th>SKU</Th>
                <Th align="right">Price</Th>
                <Th align="right">Stock</Th>
                <Th align="right">Alert at</Th>
                <Th>Status</Th>
                <Th />
              </THead>
              <tbody>
                {items.map((row) => (
                  <Tr key={row.id}>
                    <Td>
                      <Link href={`/products/${row.product.id}`} className="flex items-center gap-3">
                        <Thumb src={row.imageUrl} alt={row.product.name} size={36} />
                        <span className="min-w-0">
                          <span className="line-clamp-1 font-semibold hover:underline">{row.product.name}</span>
                          <span className="text-xs text-ink-500">
                            {row.label} · {row.product.category}
                            {!row.isActive || !row.product.isActive ? " · inactive" : ""}
                          </span>
                        </span>
                      </Link>
                    </Td>
                    <Td className="font-mono text-xs">{row.sku}</Td>
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
                    <Td align="right">
                      <StockDialog variant={{ id: row.id, sku: row.sku, name: `${row.product.name} · ${row.label}`, stock: row.stock, lowStockThreshold: row.lowStockThreshold }} />
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
