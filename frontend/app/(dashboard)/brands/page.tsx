import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandManager } from "@/components/catalog/brand-manager";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/server/api";
import type { Brand } from "@/lib/types";

export const metadata: Metadata = { title: "Brands" };

export default function BrandsPage() {
  return (
    <>
      <PageHeader title="Brands" description="Brands shown on product pages and in filters" />
      <Suspense fallback={<TableSkeleton />}>
        <Brands />
      </Suspense>
    </>
  );
}

async function Brands() {
  return <BrandManager brands={await api.get<Brand[]>("/admin/brands")} />;
}
