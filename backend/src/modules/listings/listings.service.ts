import { AppError } from "../../lib/errors.js";
import { pageMeta, toSkipTake } from "../../lib/pagination.js";
import { prisma } from "../../lib/prisma.js";
import { audit, type AuditActor } from "../audit/audit.service.js";
import { applyListingStockChange, syncProductPricing, vendorListing } from "../branch-stock/branch-stock.service.js";
import { createProduct, getProductAdmin, updateProduct } from "../products/products.admin.service.js";
import type { CatalogSearchQuery, ListingCreate, ListingUpdate, VendorProductInput, VendorProductUpdate } from "./listings.schema.js";

async function ownBranch(vendorId: string, branchId: string) {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, vendorId }, select: { id: true } });
  if (!branch) throw AppError.notFound("Branch");
}

/** Catalog products a vendor can list, flagged when already listed at the chosen shop. */
export async function searchCatalog(vendorId: string, query: CatalogSearchQuery) {
  const contains = { contains: query.q, mode: "insensitive" as const };
  const where = { isActive: true, OR: [{ name: contains }, { brand: { name: contains } }, { variants: { some: { sku: contains } } }] };
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { soldCount: "desc" },
      ...toSkipTake(query),
      select: {
        id: true,
        name: true,
        slug: true,
        createdByVendorId: true,
        category: { select: { name: true } },
        images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } },
        variants: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, sku: true, label: true, mrp: true, price: true, branchStock: { where: { branch: { vendorId } }, select: { id: true, branchId: true } } },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);
  return {
    items: rows.map(({ images, variants, ...product }) => ({
      ...product,
      imageUrl: images[0]?.url ?? null,
      ownedByMe: product.createdByVendorId === vendorId,
      variants: variants.map(({ branchStock, ...variant }) => ({
        ...variant,
        listedAt: branchStock.map((listing) => listing.branchId),
        listedHere: query.branchId ? branchStock.some((listing) => listing.branchId === query.branchId) : branchStock.length > 0,
      })),
    })),
    meta: pageMeta(query, total),
  };
}

export async function createListing(vendorId: string, input: ListingCreate, actor: AuditActor) {
  await ownBranch(vendorId, input.branchId);
  const variant = await prisma.productVariant.findFirst({ where: { id: input.variantId, isActive: true, product: { isActive: true } }, select: { productId: true } });
  if (!variant) throw AppError.notFound("Product");
  const exists = await prisma.branchVariantStock.count({ where: { branchId: input.branchId, variantId: input.variantId } });
  if (exists) throw AppError.conflict("You already sell this item at this shop. Edit the existing listing.");

  return prisma.$transaction(async (tx) => {
    const { stock, ...terms } = input;
    const listing = await tx.branchVariantStock.create({ data: { ...terms, stock: 0 } });
    // Opening stock goes through the movement log like every other change.
    await applyListingStockChange(tx, { listingId: listing.id, delta: stock, type: "IN", reason: "Opening stock", actorId: actor.id });
    await syncProductPricing(tx, variant.productId);
    await audit(tx, actor, { action: "listing.create", entity: "listing", entityId: listing.id, vendorId, data: { variantId: input.variantId, price: input.price, stock } });
    return tx.branchVariantStock.findUniqueOrThrow({ where: { id: listing.id } });
  });
}

export async function updateListing(vendorId: string, listingId: string, input: ListingUpdate, actor: AuditActor) {
  const listing = await vendorListing(prisma, vendorId, listingId);
  const price = input.price ?? listing.price;
  const mrp = input.mrp ?? listing.mrp;
  if (price > mrp) throw AppError.badRequest("Price cannot exceed MRP");
  const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: listing.variantId }, select: { productId: true } });
  return prisma.$transaction(async (tx) => {
    const updated = await tx.branchVariantStock.update({ where: { id: listingId }, data: input });
    await syncProductPricing(tx, variant.productId);
    await audit(tx, actor, { action: "listing.update", entity: "listing", entityId: listingId, vendorId, data: { ...input, previousPrice: listing.price } });
    return updated;
  });
}

/** Listings with history (orders, plans) are hidden rather than deleted. */
export async function deleteListing(vendorId: string, listingId: string, actor: AuditActor) {
  const listing = await vendorListing(prisma, vendorId, listingId);
  const [plans, orders] = await Promise.all([
    prisma.subscriptionPlan.count({ where: { listingId } }),
    prisma.orderItem.count({ where: { variantId: listing.variantId, order: { branchId: listing.branchId } } }),
  ]);
  await prisma.$transaction(async (tx) => {
    if (plans > 0 || orders > 0) await tx.branchVariantStock.update({ where: { id: listingId }, data: { isAvailable: false } });
    else await tx.branchVariantStock.delete({ where: { id: listingId } });
    await audit(tx, actor, { action: "listing.delete", entity: "listing", entityId: listingId, vendorId, data: { archived: plans > 0 || orders > 0 } });
  });
  return { archived: plans > 0 || orders > 0 };
}

// ───────────────────────── vendor-created products ─────────────────────────

export async function createVendorProduct(vendorId: string, input: VendorProductInput, actor: AuditActor) {
  await ownBranch(vendorId, input.branchId);
  const { branchId, variants, ...product } = input;
  // The catalog variant keeps a reference price; the vendor's real price and stock live on the listing.
  const catalogVariants = variants.map(({ costPrice: _cost, ...variant }) => ({ ...variant, stock: 0 }));
  const created = await createProduct({ ...product, variants: catalogVariants }, actor.id, async (tx, productId) => {
    await tx.product.update({ where: { id: productId }, data: { createdByVendorId: vendorId } });
    const saved = await tx.productVariant.findMany({ where: { productId }, select: { id: true, sku: true } });
    const idBySku = new Map(saved.map((variant) => [variant.sku, variant.id]));
    for (const variant of variants) {
      const variantId = idBySku.get(variant.sku);
      if (!variantId) continue;
      const listing = await tx.branchVariantStock.create({
        data: { branchId, variantId, price: variant.price, mrp: variant.mrp, costPrice: variant.costPrice ?? null, lowStockThreshold: variant.lowStockThreshold, stock: 0 },
      });
      await applyListingStockChange(tx, { listingId: listing.id, delta: variant.stock, type: "IN", reason: "Opening stock", actorId: actor.id });
    }
    await syncProductPricing(tx, productId);
    await audit(tx, actor, { action: "product.create", entity: "product", entityId: productId, vendorId });
  });
  return created;
}

async function ownProduct(vendorId: string, productId: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, createdByVendorId: vendorId }, select: { id: true } });
  if (!product) throw AppError.forbidden("You can only edit products your shop created. Change your price and stock on the listing instead.");
}

export async function updateVendorProduct(vendorId: string, productId: string, input: VendorProductUpdate, actor: AuditActor) {
  await ownProduct(vendorId, productId);
  const updated = await updateProduct(productId, input, actor.id);
  await audit(prisma, actor, { action: "product.update", entity: "product", entityId: productId, vendorId });
  return updated;
}

export async function getVendorProduct(vendorId: string, productId: string) {
  await ownProduct(vendorId, productId);
  return getProductAdmin(productId);
}
