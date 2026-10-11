import { TicketPercent } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Coupons" };

export default function CouponsPage() {
  return (
    <>
      <PageHeader title="Coupons" description="Discount codes and their usage" />
      <Card>
        <EmptyState icon={TicketPercent} title="Coupons is being built" description="This section is scaffolded; its data views land in the next step of docs/PLAN.md." />
      </Card>
    </>
  );
}
