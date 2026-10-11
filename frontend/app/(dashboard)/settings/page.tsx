import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsForm } from "@/components/settings/settings-form";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/server/api";
import type { Settings } from "@/lib/types";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Store contact details, delivery fees, coin rules and payment options" />
      <Suspense fallback={<TableSkeleton />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}

async function SettingsContent() {
  return <SettingsForm settings={await api.get<Settings>("/admin/settings")} />;
}
