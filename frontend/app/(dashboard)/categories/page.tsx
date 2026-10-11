import { FolderTree } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Categories" };

export default function CategoriesPage() {
  return (
    <>
      <PageHeader title="Categories" description="Two-level category tree" />
      <Card>
        <EmptyState icon={FolderTree} title="Categories is being built" description="This section is scaffolded; its data views land in the next step of docs/PLAN.md." />
      </Card>
    </>
  );
}
