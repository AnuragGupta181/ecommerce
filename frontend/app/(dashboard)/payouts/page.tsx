import type { Metadata } from "next";
import { Suspense } from "react";
import { NewPayoutButton } from "@/components/payouts/payout-controls";
import { PayoutTable } from "@/components/payouts/payout-table";
import { Card } from "@/components/ui/card";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import type { PayoutRow, VendorRow } from "@/lib/marketplace-types";
import { thisMonthRange } from "@/lib/month-range";
import { pageParam, param, type SearchParams } from "@/lib/search-params";
import { api } from "@/lib/server/api";

export const metadata: Metadata = { title: "Payouts" };

export default function PayoutsPage({ searchParams }: PageProps<"/payouts">) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <PayoutsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PayoutsContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = { vendorId: param(params, "vendorId"), status: param(params, "status") };
  const [{ items, meta }, vendors] = await Promise.all([
    api.list<PayoutRow>("/admin/payouts", { ...filters, page: pageParam(params), limit: 20 }),
    api.list<VendorRow>("/admin/vendors", { status: "APPROVED", limit: 100 }),
  ]);

  return (
    <>
      <PageHeader
        title="Payouts"
        description="Settle each shop's delivered sales after commission. Cash the shop collected on delivery is netted off."
        actions={<NewPayoutButton vendors={vendors.items.map((vendor) => ({ id: vendor.id, shopName: vendor.shopName }))} defaultRange={thisMonthRange()} />}
      />
      <Card>
        <FilterBar action="/payouts">
          <FilterSelect name="vendorId" defaultValue={filters.vendorId ?? ""}>
            <option value="">All shops</option>
            {vendors.items.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.shopName}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect name="status" defaultValue={filters.status ?? ""}>
            <option value="">Any status</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
          </FilterSelect>
        </FilterBar>
        <PayoutTable items={items} basePath="/payouts" showShop />
        {items.length > 0 ? <Pagination meta={meta} pathname="/payouts" params={params} /> : null}
      </Card>
    </>
  );
}
