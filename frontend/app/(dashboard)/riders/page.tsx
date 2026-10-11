import { Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RiderFormButton } from "@/components/riders/rider-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { titleCase } from "@/lib/format";
import { pageParam, param, type SearchParams } from "@/lib/search-params";
import { api } from "@/lib/server/api";
import type { RiderRow } from "@/lib/types";

export const metadata: Metadata = { title: "Riders" };

export default function RidersPage({ searchParams }: PageProps<"/riders">) {
  return (
    <>
      <PageHeader title="Riders" description="Registered delivery partners. Only active riders can be assigned orders." actions={<RiderFormButton rider={null} />} />
      <Suspense fallback={<TableSkeleton />}>
        <RidersTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function RidersTable({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = { q: param(params, "q"), active: param(params, "active") };
  const { items, meta } = await api.list<RiderRow>("/admin/riders", { ...filters, page: pageParam(params), limit: 20 });

  return (
    <Card>
      <FilterBar action="/riders">
        <SearchInput name="q" defaultValue={filters.q} placeholder="Name, phone or vehicle number" />
        <FilterSelect name="active" defaultValue={filters.active ?? ""}>
          <option value="">All riders</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </FilterSelect>
      </FilterBar>
      {items.length === 0 ? (
        <EmptyState icon={Truck} title="No riders yet" description="Register delivery partners so orders can be assigned to them." />
      ) : (
        <>
          <Table>
            <THead>
              <Th>Rider</Th>
              <Th>Contact</Th>
              <Th>Vehicle</Th>
              <Th align="right">Active orders</Th>
              <Th>Status</Th>
              <Th />
            </THead>
            <tbody>
              {items.map((rider) => (
                <Tr key={rider.id}>
                  <Td>
                    <Link href={`/riders/${rider.id}`} className="font-semibold hover:underline">
                      {rider.name}
                    </Link>
                  </Td>
                  <Td>
                    <p>{rider.phone}</p>
                    {rider.email ? <p className="text-xs text-ink-500">{rider.email}</p> : null}
                  </Td>
                  <Td>
                    {titleCase(rider.vehicleType)}
                    {rider.vehicleNumber ? <p className="text-xs text-ink-500">{rider.vehicleNumber}</p> : null}
                  </Td>
                  <Td numeric>{rider.activeOrders}</Td>
                  <Td>
                    <Badge tone={rider.isActive ? "success" : "neutral"}>{rider.isActive ? "Active" : "Inactive"}</Badge>
                  </Td>
                  <Td align="right">
                    <RiderFormButton rider={rider} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination meta={meta} pathname="/riders" params={params} />
        </>
      )}
    </Card>
  );
}
