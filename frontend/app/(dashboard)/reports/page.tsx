import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportPicker } from "@/components/reports/report-picker";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { VendorRow } from "@/lib/marketplace-types";
import { api } from "@/lib/server/api";

export const metadata: Metadata = { title: "Reports" };

export default function AdminReportsPage() {
  return (
    <>
      <PageHeader title="Reports" description="Excel workbooks for the whole platform or one shop." />
      <Suspense fallback={<Skeleton className="h-48" />}>
        <Picker />
      </Suspense>
    </>
  );
}

async function Picker() {
  const vendors = await api.list<VendorRow>("/admin/vendors", { limit: 100 });
  return (
    <ReportPicker
      base="/download"
      targets={[
        { label: "Platform (all shops)", path: "/admin/reports/platform" },
        ...vendors.items.map((vendor) => ({ label: vendor.shopName, path: `/admin/reports/vendors/${vendor.id}` })),
      ]}
      contents="The platform workbook has sales and commission per shop, orders by status and settlements. A shop workbook is the same one the shop downloads."
    />
  );
}
