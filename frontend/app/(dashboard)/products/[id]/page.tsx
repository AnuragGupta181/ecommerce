import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductForm } from "@/components/products/product-form";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/server/api";
import type { Brand, Category, ProductDetail } from "@/lib/types";

export const metadata: Metadata = { title: "Edit product" };

export default function EditProductPage({ params }: PageProps<"/products/[id]">) {
  return (
    <>
      <PageHeader title="Edit product" description="Stock is changed from Inventory so every change is audited" />
      <Suspense fallback={<TableSkeleton />}>
        <EditProductForm params={params} />
      </Suspense>
    </>
  );
}

async function EditProductForm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories, brands] = await Promise.all([
    api.get<ProductDetail>(`/admin/products/${id}`).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }),
    api.get<Category[]>("/admin/categories"),
    api.get<Brand[]>("/admin/brands"),
  ]);
  return <ProductForm categories={categories} brands={brands} product={product} />;
}
