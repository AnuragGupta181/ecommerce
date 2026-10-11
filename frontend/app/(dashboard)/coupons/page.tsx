import { TicketPercent } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CouponDeleteButton, CouponFormButton } from "@/components/marketing/coupon-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { pageParam, param, type SearchParams } from "@/lib/search-params";
import { api } from "@/lib/server/api";
import type { Coupon } from "@/lib/types";

export const metadata: Metadata = { title: "Coupons" };

export default function CouponsPage({ searchParams }: PageProps<"/coupons">) {
  return (
    <>
      <PageHeader title="Coupons" description="Discount codes customers apply at checkout" actions={<CouponFormButton coupon={null} />} />
      <Suspense fallback={<TableSkeleton />}>
        <CouponsTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function couponState(coupon: Coupon): { tone: "success" | "neutral" | "danger" | "warning"; label: string } {
  const now = Date.now();
  if (!coupon.isActive) return { tone: "neutral", label: "Inactive" };
  if (coupon.endsAt && new Date(coupon.endsAt).getTime() < now) return { tone: "danger", label: "Expired" };
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) return { tone: "warning", label: "Scheduled" };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return { tone: "danger", label: "Used up" };
  return { tone: "success", label: "Live" };
}

async function CouponsTable({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = { q: param(params, "q"), status: param(params, "status") };
  const { items, meta } = await api.list<Coupon>("/admin/coupons", { ...filters, page: pageParam(params), limit: 20 });

  return (
    <Card>
      <FilterBar action="/coupons">
        <SearchInput name="q" defaultValue={filters.q} placeholder="Code or description" />
        <FilterSelect name="status" defaultValue={filters.status ?? ""}>
          <option value="">All coupons</option>
          <option value="active">Live</option>
          <option value="inactive">Inactive</option>
          <option value="expired">Expired</option>
        </FilterSelect>
      </FilterBar>
      {items.length === 0 ? (
        <EmptyState icon={TicketPercent} title="No coupons" />
      ) : (
        <>
          <Table minWidth={860}>
            <THead>
              <Th>Code</Th>
              <Th>Offer</Th>
              <Th>Valid</Th>
              <Th align="right">Used</Th>
              <Th>Status</Th>
              <Th />
            </THead>
            <tbody>
              {items.map((coupon) => {
                const state = couponState(coupon);
                return (
                  <Tr key={coupon.id}>
                    <Td>
                      <span className="rounded-md border border-dashed border-brand-600 bg-brand-100 px-2 py-0.5 font-mono text-xs font-bold">{coupon.code}</span>
                      {coupon.firstOrderOnly ? <p className="mt-1 text-xs text-ink-500">First order only</p> : null}
                    </Td>
                    <Td>
                      <p>{coupon.summary}</p>
                      {coupon.description ? <p className="text-xs text-ink-500">{coupon.description}</p> : null}
                    </Td>
                    <Td className="text-ink-700">
                      {coupon.startsAt ? formatDate(coupon.startsAt) : "Now"} – {coupon.endsAt ? formatDate(coupon.endsAt) : "No end"}
                    </Td>
                    <Td numeric>
                      {coupon.usedCount}
                      {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""}
                    </Td>
                    <Td>
                      <Badge tone={state.tone}>{state.label}</Badge>
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-2">
                        <CouponFormButton coupon={coupon} />
                        <CouponDeleteButton id={coupon.id} />
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination meta={meta} pathname="/coupons" params={params} />
        </>
      )}
    </Card>
  );
}
