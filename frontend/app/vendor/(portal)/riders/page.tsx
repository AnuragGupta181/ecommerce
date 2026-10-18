import { Truck } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { RiderFormButton } from "@/components/riders/rider-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { ScheduleLinkButton } from "@/components/vendor/schedule-link-button";
import { titleCase } from "@/lib/format";
import { pageParam, param, type SearchParams } from "@/lib/search-params";
import { api } from "@/lib/server/api";
import type { RiderRow } from "@/lib/types";
import { deleteVendorRider, saveVendorRider } from "./actions";

export const metadata: Metadata = { title: "Riders" };

export default function VendorRidersPage({ searchParams }: PageProps<"/vendor/riders">) {
  return (
    <>
      <PageHeader
        title="Riders"
        description="Your delivery partners. Assign them orders; each gets a private schedule link."
        actions={<RiderFormButton rider={null} save={saveVendorRider} />}
      />
      <Suspense fallback={<TableSkeleton />}>
        <RidersTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function RidersTable({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = { q: param(params, "q"), active: param(params, "active") };
  const { items, meta } = await api.list<RiderRow>("/vendor/riders", { ...filters, page: pageParam(params), limit: 20 });

  return (
    <Card>
      <FilterBar action="/vendor/riders">
        <SearchInput name="q" defaultValue={filters.q} placeholder="Name, phone or vehicle number" />
        <FilterSelect name="active" defaultValue={filters.active ?? ""}>
          <option value="">All riders</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </FilterSelect>
      </FilterBar>
      {items.length === 0 ? (
        <EmptyState icon={Truck} title="No riders yet" description="Register the people who deliver for your shop." />
      ) : (
        <>
          <Table minWidth={860}>
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
                  <Td className="font-semibold">{rider.name}</Td>
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
                    <div className="flex justify-end gap-2">
                      {rider.isActive ? <ScheduleLinkButton riderId={rider.id} riderName={rider.name} /> : null}
                      <RiderFormButton rider={rider} save={saveVendorRider} />
                      <ConfirmAction
                        label="Remove"
                        title={`Remove ${rider.name}?`}
                        description="Riders with delivery history are deactivated instead of deleted."
                        confirmLabel="Remove"
                        success="Rider removed"
                        action={deleteVendorRider.bind(null, rider.id)}
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination meta={meta} pathname="/vendor/riders" params={params} />
        </>
      )}
    </Card>
  );
}
