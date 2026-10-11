import { Settings } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Store, delivery, coin and payment settings" />
      <Card>
        <EmptyState icon={Settings} title="Settings is being built" description="This section is scaffolded; its data views land in the next step of docs/PLAN.md." />
      </Card>
    </>
  );
}
