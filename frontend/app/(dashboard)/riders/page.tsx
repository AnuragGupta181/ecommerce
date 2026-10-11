import { Truck } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Riders" };

export default function RidersPage() {
  return (
    <>
      <PageHeader title="Riders" description="Registered delivery partners" />
      <Card>
        <EmptyState icon={Truck} title="Riders is being built" description="This section is scaffolded; its data views land in the next step of docs/PLAN.md." />
      </Card>
    </>
  );
}
