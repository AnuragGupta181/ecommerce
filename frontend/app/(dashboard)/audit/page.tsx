import { History } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { controlClass } from "@/components/ui/field";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { formatDateTime, titleCase } from "@/lib/format";
import type { AuditEntry, VendorRow } from "@/lib/marketplace-types";
import { pageParam, param, type SearchParams } from "@/lib/search-params";
import { api } from "@/lib/server/api";
import { isSuperAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Audit log" };

export default function AuditPage({ searchParams }: PageProps<"/audit">) {
  return (
    <>
      <PageHeader title="Audit log" description="Who did what: vendor approvals, stock corrections, payouts, admin changes." />
      <Suspense fallback={<TableSkeleton />}>
        <AuditTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function summarize(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  return Object.entries(data as Record<string, unknown>)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(" · ");
}

async function AuditTable({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (!(await isSuperAdmin())) redirect("/");
  const params = await searchParams;
  const filters = { vendorId: param(params, "vendorId"), entity: param(params, "entity"), from: param(params, "from"), to: param(params, "to") };
  const [{ items, meta }, vendors] = await Promise.all([
    api.list<AuditEntry>("/admin/audit", { ...filters, page: pageParam(params), limit: 30 }),
    api.list<VendorRow>("/admin/vendors", { limit: 100 }),
  ]);
  const shopName = new Map(vendors.items.map((vendor) => [vendor.id, vendor.shopName]));

  return (
    <Card>
      <FilterBar action="/audit">
        <FilterSelect name="vendorId" defaultValue={filters.vendorId ?? ""}>
          <option value="">All shops and platform</option>
          {vendors.items.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.shopName}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect name="entity" defaultValue={filters.entity ?? ""}>
          <option value="">Everything</option>
          {["vendor", "branch", "listing", "product", "plan", "subscription", "subscription_delivery", "counter_sale", "payout", "user"].map((entity) => (
            <option key={entity} value={entity}>
              {titleCase(entity)}
            </option>
          ))}
        </FilterSelect>
        <input type="date" name="from" defaultValue={filters.from} aria-label="From date" className={`${controlClass} w-auto`} />
        <input type="date" name="to" defaultValue={filters.to} aria-label="To date" className={`${controlClass} w-auto`} />
        <button type="submit" className="h-10 rounded-control border border-line px-3 font-semibold hover:bg-brand-50">
          Apply
        </button>
      </FilterBar>
      {items.length === 0 ? (
        <EmptyState icon={History} title="Nothing recorded for these filters" />
      ) : (
        <>
          <Table minWidth={900}>
            <THead>
              <Th>When</Th>
              <Th>Who</Th>
              <Th>Action</Th>
              <Th>Details</Th>
            </THead>
            <tbody>
              {items.map((entry) => (
                <Tr key={entry.id}>
                  <Td className="whitespace-nowrap">{formatDateTime(entry.createdAt)}</Td>
                  <Td>
                    <p>{entry.actor?.name ?? "System"}</p>
                    <p className="text-xs text-ink-500">
                      {entry.actorRole ? titleCase(entry.actorRole) : ""}
                      {entry.vendorId ? ` · ${shopName.get(entry.vendorId) ?? "shop"}` : ""}
                    </p>
                  </Td>
                  <Td className="font-mono text-xs">{entry.action}</Td>
                  <Td className="max-w-md text-xs text-ink-700">{summarize(entry.data)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination meta={meta} pathname="/audit" params={params} />
        </>
      )}
    </Card>
  );
}
