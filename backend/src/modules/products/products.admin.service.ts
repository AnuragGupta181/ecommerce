import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { discountPercent } from "../../lib/money.js";
import { pageMeta, toSkipTake } from "../../lib/pagination.js";
import { prisma, type Db } from "../../lib/prisma.js";
import { uniqueSlug } from "../../lib/unique-slug.js";
import { applyStockChange } from "../inventory/inventory.service.js";
import type { AdminProductListQuery, ProductInput, ProductUpdate, VariantInput } from "./products.schema.js";

/** Keeps the denormalised listing columns in sync with the cheapest active variant. */
export async function recomputeProductSummary(db: Db, productId: string) {
  const cheapest = await db.productVariant.findFirst({
    where: { productId, isActive: true },
    orderBy: [{ price: "asc" }, { sortOrder: "asc" }],
    select: { price: true, mrp: true },
  });
  await db.product.update({
    where: { id: productId },
    data: {
      minPrice: cheapest?.price ?? 0,
      minMrp: cheapest?.mrp ?? 0,
      discountPercent: cheapest ? discountPercent(cheapest.mrp, cheapest.price) : 0,
    },
  });
}

const slugTaken = (excludeId?: string) => async (slug: string) =>
  (await prisma.product.count({ where: { slug, id: excludeId ? { not: excludeId } : undefined } })) > 0;

async function assertReferences(db: Db, categoryId?: string, brandId?: string | null) {
  if (categoryId && !(await db.category.count({ where: { id: categoryId } }))) {
    throw AppError.badRequest("Category not found");
  }
  if (brandId && !(await db.brand.count({ where: { id: brandId } }))) {
    throw AppError.badRequest("Brand not found");
  }
}

function variantData(variant: VariantInput, index: number) {
  return {
    sku: variant.sku,
    label: variant.label,
    attributes: variant.attributes,
    mrp: variant.mrp,
    price: variant.price,
    lowStockThreshold: variant.lowStockThreshold,
    isActive: variant.isActive,
    sortOrder: index,
  };
}

async function createVariant(db: Db, productId: string, variant: VariantInput, index: number, actorId: string) {
  const created = await db.productVariant.create({
    data: { ...variantData(variant, index), productId, stock: 0 },
  });
  await applyStockChange(db, {
    variantId: created.id,
    delta: variant.stock,
    type: "IN",
    reason: "Initial stock",
    actorId,
  });
}

/** Upserts the submitted variants; removed ones are deleted, or deactivated if they appear in orders. */
async function syncVariants(db: Db, productId: string, variants: VariantInput[], actorId: string) {
  const existing = await db.productVariant.findMany({
    where: { productId },
    select: { id: true, _count: { select: { orderItems: true } } },
  });
  const existingIds = new Set(existing.map((variant) => variant.id));
  const keptIds = new Set(variants.map((variant) => variant.id).filter((id): id is string => !!id && existingIds.has(id)));

  for (const variant of existing) {
    if (keptIds.has(variant.id)) continue;
    if (variant._count.orderItems > 0) {
      await db.productVariant.update({ where: { id: variant.id }, data: { isActive: false } });
    } else {
      await db.productVariant.delete({ where: { id: variant.id } });
    }
  }

  for (const [index, variant] of variants.entries()) {
    if (variant.id && keptIds.has(variant.id)) {
      await db.productVariant.update({ where: { id: variant.id }, data: variantData(variant, index) });
    } else {
      await createVariant(db, productId, variant, index, actorId);
    }
  }
}

export async function createProduct(input: ProductInput, actorId: string) {
  const slug = await uniqueSlug(input.slug ?? input.name, slugTaken());
  const { images, variants, ...fields } = input;

  const id = await prisma.$transaction(async (tx) => {
    await assertReferences(tx, fields.categoryId, fields.brandId);
    const product = await tx.product.create({
      data: {
        ...fields,
        slug,
        images: { create: images.map((image, index) => ({ url: image.url, alt: image.alt, sortOrder: index })) },
      },
    });
    for (const [index, variant] of variants.entries()) {
      await createVariant(tx, product.id, variant, index, actorId);
    }
    await recomputeProductSummary(tx, product.id);
    return product.id;
  });
  return getProductAdmin(id);
}

export async function updateProduct(id: string, input: ProductUpdate, actorId: string) {
  const current = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw AppError.notFound("Product");

  const { images, variants, slug: requestedSlug, ...fields } = input;
  const slug = requestedSlug ? await uniqueSlug(requestedSlug, slugTaken(id)) : undefined;

  await prisma.$transaction(async (tx) => {
    await assertReferences(tx, fields.categoryId, fields.brandId);
    await tx.product.update({ where: { id }, data: { ...fields, slug } });

    if (images) {
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productImage.createMany({
        data: images.map((image, index) => ({ productId: id, url: image.url, alt: image.alt, sortOrder: index })),
      });
    }
    if (variants) await syncVariants(tx, id, variants, actorId);
    await recomputeProductSummary(tx, id);
  });
  return getProductAdmin(id);
}

/** Products that appear in orders are archived to preserve order history; others are deleted. */
export async function deleteProduct(id: string) {
  const product = await prisma.product.findUnique({ where: { id }, select: { _count: { select: { orderItems: true } } } });
  if (!product) throw AppError.notFound("Product");
  if (product._count.orderItems > 0) {
    await prisma.product.update({ where: { id }, data: { isActive: false } });
    return { archived: true };
  }
  await prisma.product.delete({ where: { id } });
  return { archived: false };
}

export async function getProductAdmin(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      brand: { select: { id: true, name: true } },
      images: { orderBy: { sortOrder: "asc" } },
      variants: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!product) throw AppError.notFound("Product");
  return product;
}

export async function listProductsAdmin(query: AdminProductListQuery) {
  const and: Prisma.ProductWhereInput[] = [];
  if (query.q) {
    and.push({
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { slug: { contains: query.q, mode: "insensitive" } },
        { variants: { some: { sku: { contains: query.q, mode: "insensitive" } } } },
      ],
    });
  }
  if (query.categoryId) and.push({ categoryId: query.categoryId });
  if (query.brandId) and.push({ brandId: query.brandId });
  if (query.status === "active") and.push({ isActive: true });
  if (query.status === "inactive") and.push({ isActive: false });
  if (query.status === "low_stock") {
    and.push({ variants: { some: { isActive: true, stock: { gt: 0, lte: prisma.productVariant.fields.lowStockThreshold } } } });
  }
  if (query.status === "out_of_stock") and.push({ variants: { none: { isActive: true, stock: { gt: 0 } } } });

  const where: Prisma.ProductWhereInput = { AND: and };
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      ...toSkipTake(query),
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        isFeatured: true,
        minPrice: true,
        minMrp: true,
        discountPercent: true,
        soldCount: true,
        ratingAvg: true,
        updatedAt: true,
        category: { select: { name: true } },
        brand: { select: { name: true } },
        images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } },
        variants: { where: { isActive: true }, select: { stock: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: rows.map(({ images, variants, category, brand, ...row }) => ({
      ...row,
      category: category.name,
      brand: brand?.name ?? null,
      imageUrl: images[0]?.url ?? null,
      variantCount: variants.length,
      totalStock: variants.reduce((sum, variant) => sum + variant.stock, 0),
    })),
    meta: pageMeta(query, total),
  };
}
