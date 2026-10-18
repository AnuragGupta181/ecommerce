import { Store } from "lucide-react";
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
import { Thumb } from "@/components/ui/thumb";
import { formatDate, titleCase } from "@/lib/format";
import type { VendorRow } from "@/lib/marketplace-types";
import { vendorStatusTone } from "@/lib/status-tones";
import { pageParam, param, type SearchParams } from "@/lib/search-params";
import { api } from "@/lib/server/api";

export const metadata: Metadata = { title: "Vendors" };

export default function VendorsPage({ searchParams }: PageProps<"/vendors">) {
  return (
    <>
      <PageHeader title="Vendors" description="Shops selling on Haat. Approve new sign-ups, set commission and suspend if needed." />
      <Suspense fallback={<TableSkeleton />}>
        <VendorsTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function VendorsTable({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = { q: param(params, "q"), status: param(params, "status") };
  const { items, meta } = await api.list<VendorRow>("/admin/vendors", { ...filters, page: pageParam(params), limit: 20 });

  return (
    <Card>
      <FilterBar action="/vendors">
        <SearchInput name="q" defaultValue={filters.q} placeholder="Shop name, email or phone" />
        <FilterSelect name="status" defaultValue={filters.status ?? ""}>
          <option value="">Any status</option>
          <option value="PENDING">Waiting for approval</option>
          <option value="APPROVED">Approved</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="REJECTED">Rejected</option>
        </FilterSelect>
      </FilterBar>
      {items.length === 0 ? (
        <EmptyState icon={Store} title="No shops found" />
      ) : (
        <>
          <Table minWidth={860}>
            <THead>
              <Th>Shop</Th>
              <Th>Contact</Th>
              <Th align="right">Commission</Th>
              <Th align="right">Branches</Th>
              <Th align="right">Orders</Th>
              <Th>Status</Th>
            </THead>
            <tbody>
              {items.map((vendor) => (
                <Tr key={vendor.id}>
                  <Td>
                    <Link href={`/vendors/${vendor.id}`} className="flex items-center gap-3">
                      <Thumb src={vendor.logoUrl} alt={vendor.shopName} size={36} />
                      <span>
                        <span className="font-semibold hover:underline">{vendor.shopName}</span>
                        <span className="block text-xs text-ink-500">Joined {formatDate(vendor.createdAt)}</span>
                      </span>
                    </Link>
                  </Td>
                  <Td>
                    <p>{vendor.phone}</p>
                    <p className="text-xs text-ink-500">{vendor.email}</p>
                  </Td>
                  <Td numeric>{vendor.commissionBps / 100}%</Td>
                  <Td numeric>{vendor.branchCount}</Td>
                  <Td numeric>{vendor.orderCount}</Td>
                  <Td>
                    <Badge tone={vendorStatusTone[vendor.status]}>{titleCase(vendor.status)}</Badge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination meta={meta} pathname="/vendors" params={params} />
        </>
      )}
    </Card>
  );
}
