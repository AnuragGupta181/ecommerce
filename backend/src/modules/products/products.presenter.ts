import type { Prisma } from "../../generated/prisma/client.js";

/** Minimal shape needed to render a product tile anywhere in the apps. */
export const productCardSelect = {
  id: true,
  slug: true,
  name: true,
  minPrice: true,
  minMrp: true,
  discountPercent: true,
  ratingAvg: true,
  ratingCount: true,
  isFeatured: true,
  brand: { select: { name: true } },
  images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
  variants: {
    where: { isActive: true },
    orderBy: [{ price: "asc" }, { sortOrder: "asc" }],
    select: { id: true, stock: true },
  },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

export function toProductCard(row: CardRow, wishlisted: Set<string> = new Set()) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand?.name ?? null,
    imageUrl: row.images[0]?.url ?? null,
    price: row.minPrice,
    mrp: row.minMrp,
    discountPercent: row.discountPercent,
    ratingAvg: Math.round(row.ratingAvg * 10) / 10,
    ratingCount: row.ratingCount,
    isFeatured: row.isFeatured,
    inStock: row.variants.some((variant) => variant.stock > 0),
    /** Lets clients add single-variant products to the cart straight from a tile. */
    defaultVariantId: row.variants.length === 1 ? (row.variants[0]?.id ?? null) : null,
    variantCount: row.variants.length,
    isWishlisted: wishlisted.has(row.id),
  };
}

export type ProductCard = ReturnType<typeof toProductCard>;
