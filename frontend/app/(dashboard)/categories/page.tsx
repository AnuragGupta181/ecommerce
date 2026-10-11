import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoryManager } from "@/components/catalog/category-manager";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/server/api";
import type { Category } from "@/lib/types";

export const metadata: Metadata = { title: "Categories" };

export default function CategoriesPage() {
  return (
    <>
      <PageHeader title="Categories" description="A two-level tree: top-level categories and their sub-categories" />
      <Suspense fallback={<TableSkeleton />}>
        <Categories />
      </Suspense>
    </>
  );
}

async function Categories() {
  return <CategoryManager categories={await api.get<Category[]>("/admin/categories")} />;
}
