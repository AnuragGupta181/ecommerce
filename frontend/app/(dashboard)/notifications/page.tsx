import { Bell } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { formatDateTime, titleCase } from "@/lib/format";
import { pageParam, param, type SearchParams } from "@/lib/search-params";
import { api } from "@/lib/server/api";
import type { NotificationLog } from "@/lib/types";

export const metadata: Metadata = { title: "Notification log" };

export default function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  return (
    <>
      <PageHeader title="Notification log" description="Every email and WhatsApp message the store sent, with delivery status" />
      <Suspense fallback={<TableSkeleton />}>
        <LogTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function LogTable({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = { status: param(params, "status"), channel: param(params, "channel") };
  const { items, meta } = await api.list<NotificationLog>("/admin/notification-logs", { ...filters, page: pageParam(params), limit: 30 });

  return (
    <Card>
      <FilterBar action="/notifications">
        <FilterSelect name="channel" defaultValue={filters.channel ?? ""}>
          <option value="">All channels</option>
          <option value="EMAIL">Email</option>
          <option value="WHATSAPP">WhatsApp</option>
        </FilterSelect>
        <FilterSelect name="status" defaultValue={filters.status ?? ""}>
          <option value="">Any status</option>
          <option value="SENT">Sent</option>
          <option value="FAILED">Failed</option>
          <option value="SKIPPED">Skipped</option>
        </FilterSelect>
      </FilterBar>
      {items.length === 0 ? (
        <EmptyState icon={Bell} title="No messages logged" />
      ) : (
        <>
          <Table minWidth={900}>
            <THead>
              <Th>Sent</Th>
              <Th>Channel</Th>
              <Th>Recipient</Th>
              <Th>Message</Th>
              <Th>Order</Th>
              <Th>Status</Th>
            </THead>
            <tbody>
              {items.map((log) => (
                <Tr key={log.id}>
                  <Td className="whitespace-nowrap text-ink-700">{formatDateTime(log.createdAt)}</Td>
                  <Td>{titleCase(log.channel)}</Td>
                  <Td>
                    {titleCase(log.recipientType)}
                    <p className="text-xs text-ink-500">{log.recipient}</p>
                  </Td>
                  <Td>
                    <p>{log.subject ?? titleCase(log.template)}</p>
                    <p className="line-clamp-1 max-w-80 text-xs text-ink-500">{log.body}</p>
                  </Td>
                  <Td>
                    {log.orderId && log.order ? (
                      <Link href={`/orders/${log.orderId}`} className="font-semibold hover:underline">
                        {log.order.orderNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <Badge tone={log.status === "SENT" ? "success" : log.status === "FAILED" ? "danger" : "neutral"}>{titleCase(log.status)}</Badge>
                    {log.error ? <p className="mt-1 max-w-56 text-xs text-danger">{log.error}</p> : null}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination meta={meta} pathname="/notifications" params={params} />
        </>
      )}
    </Card>
  );
}
