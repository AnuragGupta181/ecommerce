import { Image } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Banners" };

export default function BannersPage() {
  return (
    <>
      <PageHeader title="Banners" description="Home carousel and offer strips" />
      <Card>
        <EmptyState icon={Image} title="Banners is being built" description="This section is scaffolded; its data views land in the next step of docs/PLAN.md." />
      </Card>
    </>
  );
}
