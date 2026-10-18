import type { Metadata } from "next";
import { ReportPicker } from "@/components/reports/report-picker";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Reports" };

export default function VendorReportsPage() {
  return (
    <>
      <PageHeader title="Reports" description="Download your numbers as an Excel workbook." />
      <ReportPicker
        base="/vendor/download"
        targets={[{ label: "Shop report", path: "/vendor/reports/export" }]}
        contents="Sheets: summary, sales and profit (using your cost prices), best sellers, inventory with movements, subscriptions and settlements."
      />
    </>
  );
}
