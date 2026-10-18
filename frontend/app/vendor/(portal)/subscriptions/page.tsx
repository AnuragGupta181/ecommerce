import { Users } from "lucide-react";
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
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { formatDate, formatINR, titleCase } from "@/lib/format";
import type { SubscriptionRow } from "@/lib/marketplace-types";
import { pageParam, param, type SearchParams } from "@/lib/search-params";
import { api } from "@/lib/server/api";

export const metadata: Metadata = { title: "Subscribers" };

export default function SubscribersPage({ searchParams }: PageProps<"/vendor/subscriptions">) {
  return (
    <>
      <PageHeader title="Subscribers" description="Everyone on a plan, with what they owe. Open one to record a payment or change the rider." />
      <Suspense fallback={<TableSkeleton />}>
        <SubscribersTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function SubscribersTable({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = { q: param(params, "q"), status: param(params, "status") ?? "ACTIVE" };
  const { items, meta } = await api.list<SubscriptionRow>("/vendor/subscriptions", { ...filters, page: pageParam(params), limit: 20 });

  return (
    <Card>
      <FilterBar action="/vendor/subscriptions">
        <SearchInput name="q" defaultValue={filters.q} placeholder="Customer name, phone or SUB number" />
        <FilterSelect name="status" defaultValue={filters.status}>
          <option value="ACTIVE">Active</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </FilterSelect>
      </FilterBar>
      {items.length === 0 ? (
        <EmptyState icon={Users} title="No subscribers here" description="Customers subscribe to your plans from the Haat app." />
      ) : (
        <>
          <Table minWidth={900}>
            <THead>
              <Th>Subscription</Th>
              <Th>Customer</Th>
              <Th>Period</Th>
              <Th>Rider</Th>
              <Th align="right">Balance</Th>
              <Th>Status</Th>
            </THead>
            <tbody>
              {items.map((sub) => (
                <Tr key={sub.id}>
                  <Td>
                    <Link href={`/vendor/subscriptions/${sub.id}`} className="font-semibold hover:underline">
                      {sub.number}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {sub.plan.name} · {sub.quantity}× · {sub.slot ?? "any time"}
                    </p>
                  </Td>
                  <Td>
                    <p>{sub.customer.name}</p>
                    <p className="text-xs text-ink-500">{sub.customer.phone}</p>
                  </Td>
                  <Td>
                    {titleCase(sub.period)}
                    <p className="text-xs text-ink-500">
                      {formatDate(sub.startDate)} – {formatDate(sub.endDate)}
                    </p>
                  </Td>
                  <Td className="text-ink-700">{sub.rider?.name ?? "—"}</Td>
                  <Td numeric>
                    <span className={sub.balance > 0 ? "font-semibold" : "text-ink-500"}>{formatINR(sub.balance)}</span>
                    {sub.dueNow > 0 ? <span className="block text-xs text-warning">{formatINR(sub.dueNow)} due now</span> : null}
                  </Td>
                  <Td>
                    <Badge tone={sub.status === "ACTIVE" ? "success" : "neutral"}>{titleCase(sub.status)}</Badge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination meta={meta} pathname="/vendor/subscriptions" params={params} />
        </>
      )}
    </Card>
  );
}
