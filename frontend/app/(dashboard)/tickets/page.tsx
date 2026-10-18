import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { TicketTable } from "@/components/tickets/ticket-table";
import type { TicketRow } from "@/lib/marketplace-types";
import { pageParam, param, type SearchParams } from "@/lib/search-params";
import { api } from "@/lib/server/api";

export const metadata: Metadata = { title: "Tickets" };

export default function TicketsPage({ searchParams }: PageProps<"/tickets">) {
  return (
    <>
      <PageHeader title="Tickets" description="Major issues are yours; minor ones are handled by the shop. You can see and step into all of them." />
      <Suspense fallback={<TableSkeleton />}>
        <TicketsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function TicketsContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = { q: param(params, "q"), status: param(params, "status"), level: param(params, "level") };
  const { items, meta } = await api.list<TicketRow>("/admin/tickets", { ...filters, page: pageParam(params), limit: 20 });
  return <TicketTable basePath="/tickets" items={items} meta={meta} params={params} filters={filters} showShop={true} />;
}
