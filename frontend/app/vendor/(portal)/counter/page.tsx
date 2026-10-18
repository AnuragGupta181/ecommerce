import { FileText, Receipt } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { controlClass } from "@/components/ui/field";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { CounterBillButton } from "@/components/vendor/counter-bill-form";
import { downloadHref } from "@/lib/download-href";
import { formatDateTime, formatINR, titleCase } from "@/lib/format";
import type { Branch, CounterSaleRow } from "@/lib/marketplace-types";
import { pageParam, param, type SearchParams } from "@/lib/search-params";
import { api } from "@/lib/server/api";

export const metadata: Metadata = { title: "Counter bills" };

export default function CounterPage({ searchParams }: PageProps<"/vendor/counter">) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <CounterContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CounterContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = { from: param(params, "from"), to: param(params, "to") };
  const [{ items, meta }, branches] = await Promise.all([
    api.list<CounterSaleRow>("/vendor/counter-sales", { ...filters, page: pageParam(params), limit: 20 }),
    api.get<Branch[]>("/vendor/branches"),
  ]);

  return (
    <>
      <PageHeader
        title="Counter bills"
        description="Sales at your shop counter. Stock leaves the same way as an online order."
        actions={<CounterBillButton branches={branches.map((branch) => ({ id: branch.id, name: branch.name }))} />}
      />
      <Card>
        <FilterBar action="/vendor/counter">
          <input type="date" name="from" defaultValue={filters.from} aria-label="From date" className={`${controlClass} w-auto`} />
          <input type="date" name="to" defaultValue={filters.to} aria-label="To date" className={`${controlClass} w-auto`} />
          <button type="submit" className="h-10 rounded-control border border-line px-3 font-semibold hover:bg-brand-50">
            Apply
          </button>
        </FilterBar>
        {items.length === 0 ? (
          <EmptyState icon={Receipt} title="No bills yet" description="Create a bill when a customer buys at the shop." />
        ) : (
          <>
            <Table minWidth={720}>
              <THead>
                <Th>Bill</Th>
                <Th>Customer</Th>
                <Th align="right">Items</Th>
                <Th align="right">Total</Th>
                <Th>Paid by</Th>
                <Th />
              </THead>
              <tbody>
                {items.map((sale) => (
                  <Tr key={sale.id}>
                    <Td>
                      <p className="font-semibold">{sale.number}</p>
                      <p className="text-xs text-ink-500">{formatDateTime(sale.createdAt)}</p>
                    </Td>
                    <Td>
                      <p>{sale.customerName ?? "Walk-in"}</p>
                      {sale.customerPhone ? <p className="text-xs text-ink-500">{sale.customerPhone}</p> : null}
                    </Td>
                    <Td numeric>{sale.itemCount}</Td>
                    <Td numeric className="font-semibold">
                      {formatINR(sale.total)}
                    </Td>
                    <Td>{titleCase(sale.method)}</Td>
                    <Td align="right">
                      <a href={downloadHref("/vendor/download", `/documents/bill/${sale.id}`)} className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline">
                        <FileText size={14} /> PDF
                      </a>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination meta={meta} pathname="/vendor/counter" params={params} />
          </>
        )}
      </Card>
    </>
  );
}
