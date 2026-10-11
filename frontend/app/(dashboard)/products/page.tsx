import { Package, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { Thumb } from "@/components/ui/thumb";
import { formatCount, formatINR } from "@/lib/format";
import { pageParam, param, type SearchParams } from "@/lib/search-params";
import { api } from "@/lib/server/api";
import type { Brand, Category, ProductRow } from "@/lib/types";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage({ searchParams }: PageProps<"/products">) {
  return (
    <>
      <PageHeader
        title="Products"
        description="Catalog items, variants and images"
        actions={
          <ButtonLink href="/products/new">
            <Plus size={16} /> Add product
          </ButtonLink>
        }
      />
      <Suspense fallback={<TableSkeleton />}>
        <ProductsTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ProductsTable({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = { q: param(params, "q"), categoryId: param(params, "categoryId"), brandId: param(params, "brandId"), status: param(params, "status") };
  const [{ items, meta }, categories, brands] = await Promise.all([
    api.list<ProductRow>("/admin/products", { ...filters, page: pageParam(params), limit: 20 }),
    api.get<Category[]>("/admin/categories"),
    api.get<Brand[]>("/admin/brands"),
  ]);

  return (
    <Card>
      <FilterBar action="/products">
        <SearchInput name="q" defaultValue={filters.q} placeholder="Search name, slug or SKU" />
        <FilterSelect name="categoryId" defaultValue={filters.categoryId ?? ""}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.parent ? `${category.parent.name} › ` : ""}
              {category.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect name="brandId" defaultValue={filters.brandId ?? ""}>
          <option value="">All brands</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect name="status" defaultValue={filters.status ?? ""}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="low_stock">Low stock</option>
          <option value="out_of_stock">Out of stock</option>
        </FilterSelect>
      </FilterBar>
      {items.length === 0 ? (
        <EmptyState icon={Package} title="No products found" description="Try different filters, or add your first product." action={<ButtonLink href="/products/new">Add product</ButtonLink>} />
      ) : (
        <>
          <Table>
            <THead>
              <Th>Product</Th>
              <Th>Category</Th>
              <Th align="right">Price</Th>
              <Th align="right">Stock</Th>
              <Th align="right">Sold</Th>
              <Th>Status</Th>
            </THead>
            <tbody>
              {items.map((product) => (
                <Tr key={product.id}>
                  <Td>
                    <Link href={`/products/${product.id}`} className="flex items-center gap-3">
                      <Thumb src={product.imageUrl} alt={product.name} />
                      <span className="min-w-0">
                        <span className="line-clamp-1 font-semibold hover:underline">{product.name}</span>
                        <span className="text-xs text-ink-500">
                          {product.brand ?? "No brand"} · {product.variantCount} variant{product.variantCount === 1 ? "" : "s"}
                        </span>
                      </span>
                    </Link>
                  </Td>
                  <Td className="text-ink-700">{product.category}</Td>
                  <Td numeric>
                    <span className="font-semibold">{formatINR(product.minPrice)}</span>
                    {product.discountPercent > 0 ? (
                      <span className="block text-xs text-ink-500">
                        <s>{formatINR(product.minMrp)}</s> <span className="text-success">{product.discountPercent}% off</span>
                      </span>
                    ) : null}
                  </Td>
                  <Td numeric>
                    <span className={product.totalStock === 0 ? "font-semibold text-danger" : ""}>{formatCount(product.totalStock)}</span>
                  </Td>
                  <Td numeric>{formatCount(product.soldCount)}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={product.isActive ? "success" : "neutral"}>{product.isActive ? "Active" : "Inactive"}</Badge>
                      {product.isFeatured ? <Badge tone="brand">Featured</Badge> : null}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination meta={meta} pathname="/products" params={params} />
        </>
      )}
    </Card>
  );
}
