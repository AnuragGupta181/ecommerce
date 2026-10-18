import type { Metadata } from "next";
import { Suspense } from "react";
import { PayoutTable } from "@/components/payouts/payout-table";
import { SettlementView, type SettlementRows } from "@/components/payouts/settlement-view";
import { Card } from "@/components/ui/card";
import { controlClass } from "@/components/ui/field";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import type { PayoutRow } from "@/lib/marketplace-types";
import { thisMonthRange } from "@/lib/month-range";
import { pageParam, param, type SearchParams } from "@/lib/search-params";
import { api } from "@/lib/server/api";

export const metadata: Metadata = { title: "Payouts" };

export default function VendorPayoutsPage({ searchParams }: PageProps<"/vendor/payouts">) {
  return (
    <>
      <PageHeader title="Payouts" description="What Haat owes you, or you owe Haat, after commission. Statements download as PDF." />
      <Suspense fallback={<TableSkeleton />}>
        <PayoutsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function PayoutsContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const range = { from: param(params, "from") ?? thisMonthRange().from, to: param(params, "to") ?? thisMonthRange().to };
  const [{ items, meta }, upcoming] = await Promise.all([
    api.list<PayoutRow>("/vendor/payouts", { page: pageParam(params), limit: 20 }),
    api.get<SettlementRows>("/vendor/payouts/upcoming", range),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Card title="Not settled yet">
        <FilterBar action="/vendor/payouts">
          <input type="date" name="from" defaultValue={range.from} aria-label="From date" className={`${controlClass} w-auto`} />
          <input type="date" name="to" defaultValue={range.to} aria-label="To date" className={`${controlClass} w-auto`} />
          <button type="submit" className="h-10 rounded-control border border-line px-3 font-semibold hover:bg-brand-50">
            Show
          </button>
        </FilterBar>
        <div className="p-4">
          <SettlementView settlement={upcoming} />
        </div>
      </Card>
      <Card title="Statements">
        <PayoutTable items={items} basePath="/vendor/payouts" showShop={false} />
        {items.length > 0 ? <Pagination meta={meta} pathname="/vendor/payouts" params={params} /> : null}
      </Card>
    </div>
  );
}
