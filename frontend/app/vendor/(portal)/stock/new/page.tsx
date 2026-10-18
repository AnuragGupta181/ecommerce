import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { VendorProductForm } from "@/components/vendor/vendor-product-form";
import type { Branch } from "@/lib/marketplace-types";
import { api } from "@/lib/server/api";

export const metadata: Metadata = { title: "New product" };

type CategoryNode = { id: string; name: string; children?: CategoryNode[] };

export default function NewVendorProductPage() {
  return (
    <>
      <Link href="/vendor/stock" className="mb-4 inline-flex items-center gap-1.5 font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft size={16} /> Products & stock
      </Link>
      <PageHeader title="New product" description="For items not in the Haat catalog. Search the catalog first so customers see one product with every shop's offer." />
      <Suspense fallback={<TableSkeleton rows={6} />}>
        <FormLoader />
      </Suspense>
    </>
  );
}

async function FormLoader() {
  const [branches, tree, brands] = await Promise.all([
    api.get<Branch[]>("/vendor/branches"),
    api.get<CategoryNode[]>("/categories"),
    api.get<{ id: string; name: string }[]>("/brands"),
  ]);
  // Products belong in leaf categories ("Grocery › Vegetables").
  const categories = tree.flatMap((parent) =>
    parent.children?.length ? parent.children.map((child) => ({ id: child.id, name: `${parent.name} › ${child.name}` })) : [{ id: parent.id, name: parent.name }],
  );
  return (
    <VendorProductForm
      branches={branches.map((branch) => ({ id: branch.id, name: branch.name }))}
      categories={categories}
      brands={brands.map((brand) => ({ id: brand.id, name: brand.name }))}
    />
  );
}
