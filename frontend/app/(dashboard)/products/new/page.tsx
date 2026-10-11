import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductForm } from "@/components/products/product-form";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/server/api";
import type { Brand, Category } from "@/lib/types";

export const metadata: Metadata = { title: "Add product" };

export default function NewProductPage() {
  return (
    <>
      <PageHeader title="Add product" description="Create a catalog item with its variants and images" />
      <Suspense fallback={<TableSkeleton />}>
        <NewProductForm />
      </Suspense>
    </>
  );
}

async function NewProductForm() {
  const [categories, brands] = await Promise.all([api.get<Category[]>("/admin/categories"), api.get<Brand[]>("/admin/brands")]);
  return <ProductForm categories={categories} brands={brands} product={null} />;
}
