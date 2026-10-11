import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { uniqueSlug } from "../../lib/unique-slug.js";
import type { BrandInput, BrandUpdate } from "./brands.schema.js";

const slugTaken = (excludeId?: string) => async (slug: string) =>
  (await prisma.brand.count({ where: { slug, id: excludeId ? { not: excludeId } : undefined } })) > 0;

export function listActiveBrands() {
  return prisma.brand.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, logoUrl: true },
  });
}

export function listBrandsAdmin() {
  return prisma.brand.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
}

export async function createBrand(input: BrandInput) {
  const slug = await uniqueSlug(input.name, slugTaken());
  return prisma.brand.create({ data: { ...input, slug } });
}

export async function updateBrand(id: string, input: BrandUpdate) {
  const slug = input.name ? await uniqueSlug(input.name, slugTaken(id)) : undefined;
  return prisma.brand.update({ where: { id }, data: { ...input, slug } });
}

export async function deleteBrand(id: string) {
  const products = await prisma.product.count({ where: { brandId: id } });
  if (products > 0) throw AppError.conflict(`Brand is used by ${products} product(s); deactivate it instead`);
  await prisma.brand.delete({ where: { id } });
}
