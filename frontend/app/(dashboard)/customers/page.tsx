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
import { formatCount, formatDate, formatINR } from "@/lib/format";
import { pageParam, param, type SearchParams } from "@/lib/search-params";
import { api } from "@/lib/server/api";
import type { CustomerRow } from "@/lib/types";

export const metadata: Metadata = { title: "Customers" };

export default function CustomersPage({ searchParams }: PageProps<"/customers">) {
  return (
    <>
      <PageHeader title="Customers" description="Accounts, order history and coin balances" />
      <Suspense fallback={<TableSkeleton />}>
        <CustomersTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CustomersTable({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = { q: param(params, "q"), blocked: param(params, "blocked") };
  const { items, meta } = await api.list<CustomerRow>("/admin/customers", { ...filters, page: pageParam(params), limit: 20 });

  return (
    <Card>
      <FilterBar action="/customers">
        <SearchInput name="q" defaultValue={filters.q} placeholder="Name, email or phone" />
        <FilterSelect name="blocked" defaultValue={filters.blocked ?? ""}>
          <option value="">All customers</option>
          <option value="false">Active</option>
          <option value="true">Blocked</option>
        </FilterSelect>
      </FilterBar>
      {items.length === 0 ? (
        <EmptyState icon={Users} title="No customers found" />
      ) : (
        <>
          <Table>
            <THead>
              <Th>Customer</Th>
              <Th>Phone</Th>
              <Th align="right">Orders</Th>
              <Th align="right">Spent</Th>
              <Th align="right">Coins</Th>
              <Th>Joined</Th>
              <Th>Status</Th>
            </THead>
            <tbody>
              {items.map((customer) => (
                <Tr key={customer.id}>
                  <Td>
                    <Link href={`/customers/${customer.id}`} className="font-semibold hover:underline">
                      {customer.name}
                    </Link>
                    <p className="text-xs text-ink-500">{customer.email}</p>
                  </Td>
                  <Td>{customer.phone ?? "—"}</Td>
                  <Td numeric>{formatCount(customer.orderCount)}</Td>
                  <Td numeric>{formatINR(customer.totalSpent)}</Td>
                  <Td numeric className="text-brand-700">
                    {formatCount(customer.coinBalance)}
                  </Td>
                  <Td className="text-ink-700">{formatDate(customer.createdAt)}</Td>
                  <Td>
                    <Badge tone={customer.isBlocked ? "danger" : "success"}>{customer.isBlocked ? "Blocked" : "Active"}</Badge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination meta={meta} pathname="/customers" params={params} />
        </>
      )}
    </Card>
  );
}
