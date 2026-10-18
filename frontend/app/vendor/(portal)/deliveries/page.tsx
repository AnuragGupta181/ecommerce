import { CalendarCheck } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { controlClass } from "@/components/ui/field";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { DeliveryList } from "@/components/vendor/delivery-list";
import type { DeliveryDay } from "@/lib/marketplace-types";
import { param, type SearchParams } from "@/lib/search-params";
import { api } from "@/lib/server/api";

export const metadata: Metadata = { title: "Deliveries" };

export default function DeliveriesPage({ searchParams }: PageProps<"/vendor/deliveries">) {
  return (
    <>
      <PageHeader title="Subscription deliveries" description="Load the van from the totals, then tick off each drop. Stock is deducted when you mark a drop delivered." />
      <Suspense fallback={<TableSkeleton />}>
        <DeliveriesContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function DeliveriesContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const day = await api.get<DeliveryDay>("/vendor/deliveries", { date: param(params, "date") });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="To deliver" value={day.counts.scheduled} />
        <StatCard label="Delivered" value={day.counts.delivered} />
        <StatCard label="Missed" value={day.counts.missed} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Load for the day">
          {day.toLoad.length === 0 ? (
            <p className="p-5 text-ink-500">Nothing to load.</p>
          ) : (
            <ul className="flex flex-col">
              {day.toLoad.map((row) => (
                <li key={row.product} className="flex justify-between border-b border-line px-5 py-2.5 last:border-b-0">
                  <span>{row.product}</span>
                  <span className="tabular font-bold">{row.quantity}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="xl:col-span-2">
          <FilterBar action="/vendor/deliveries">
            <input type="date" name="date" defaultValue={day.date} aria-label="Date" className={`${controlClass} w-auto`} />
            <button type="submit" className="h-10 rounded-control border border-line px-3 font-semibold hover:bg-brand-50">
              Show day
            </button>
          </FilterBar>
          {day.deliveries.length === 0 ? (
            <EmptyState icon={CalendarCheck} title={`No drops on ${day.date}`} description="Subscribers' deliveries for the day appear here." />
          ) : (
            <DeliveryList key={day.date} deliveries={day.deliveries} />
          )}
        </Card>
      </div>
    </div>
  );
}
