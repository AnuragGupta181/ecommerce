import { Star } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Reviews" };

export default function ReviewsPage() {
  return (
    <>
      <PageHeader title="Reviews" description="Moderate customer reviews" />
      <Card>
        <EmptyState icon={Star} title="Reviews is being built" description="This section is scaffolded; its data views land in the next step of docs/PLAN.md." />
      </Card>
    </>
  );
}
