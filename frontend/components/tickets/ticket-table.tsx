import { LifeBuoy } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/filter-bar";
import { Pagination } from "@/components/ui/pagination";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { formatDateTime, titleCase } from "@/lib/format";
import type { TicketRow, TicketStatus } from "@/lib/marketplace-types";
import type { SearchParams } from "@/lib/search-params";
import { ticketTone } from "@/lib/status-tones";
import type { PageMeta } from "@/lib/types";

const STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export function TicketTable({
  basePath,
  items,
  meta,
  params,
  filters,
  showShop,
}: {
  basePath: "/tickets" | "/vendor/tickets";
  items: TicketRow[];
  meta: PageMeta;
  params: SearchParams;
  filters: { q?: string; status?: string; level?: string };
  showShop: boolean;
}) {
  return (
    <Card>
      <FilterBar action={basePath}>
        <SearchInput name="q" defaultValue={filters.q} placeholder="Ticket number, subject or customer" />
        <FilterSelect name="status" defaultValue={filters.status ?? ""}>
          <option value="">Any status</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {titleCase(status)}
            </option>
          ))}
        </FilterSelect>
        {showShop ? (
          <FilterSelect name="level" defaultValue={filters.level ?? ""}>
            <option value="">Shop and platform</option>
            <option value="MAJOR">Platform (major)</option>
            <option value="MINOR">Shop (minor)</option>
          </FilterSelect>
        ) : null}
      </FilterBar>
      {items.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="No tickets" description="Customer issues show up here with their order and history." />
      ) : (
        <>
          <Table minWidth={860}>
            <THead>
              <Th>Ticket</Th>
              <Th>Customer</Th>
              {showShop ? <Th>Handled by</Th> : null}
              <Th>Last activity</Th>
              <Th>Status</Th>
            </THead>
            <tbody>
              {items.map((ticket) => (
                <Tr key={ticket.id}>
                  <Td>
                    <Link href={`${basePath}/${ticket.id}`} className="font-semibold hover:underline">
                      {ticket.subject}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {ticket.number} · {titleCase(ticket.category)}
                      {ticket.order ? ` · ${ticket.order.orderNumber}` : ""} · {ticket.messageCount} messages
                    </p>
                  </Td>
                  <Td>{ticket.user.name}</Td>
                  {showShop ? (
                    <Td>
                      <Badge tone={ticket.level === "MAJOR" ? "danger" : "neutral"}>{ticket.level === "MAJOR" ? "Platform" : (ticket.vendor?.shopName ?? "Shop")}</Badge>
                    </Td>
                  ) : null}
                  <Td className="text-ink-700">{formatDateTime(ticket.lastMessageAt)}</Td>
                  <Td>
                    <Badge tone={ticketTone[ticket.status]}>{titleCase(ticket.status)}</Badge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination meta={meta} pathname={basePath} params={params} />
        </>
      )}
    </Card>
  );
}
