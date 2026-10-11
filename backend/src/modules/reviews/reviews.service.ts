import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { pageMeta, toSkipTake } from "../../lib/pagination.js";
import { prisma, type Db } from "../../lib/prisma.js";
import type { AdminReviewListQuery, ProductReviewQuery, ReviewInput } from "./reviews.schema.js";

/** Rating aggregates only count visible reviews. */
async function recomputeRating(db: Db, productId: string) {
  const stats = await db.review.aggregate({
    where: { productId, isHidden: false },
    _avg: { rating: true },
    _count: true,
  });
  await db.product.update({
    where: { id: productId },
    data: { ratingAvg: stats._avg.rating ?? 0, ratingCount: stats._count },
  });
}

export async function listProductReviews(query: ProductReviewQuery) {
  const where: Prisma.ReviewWhereInput = {
    productId: query.productId,
    isHidden: false,
    ...(query.rating ? { rating: query.rating } : {}),
  };
  const orderBy: Prisma.ReviewOrderByWithRelationInput[] =
    query.sort === "rating_high"
      ? [{ rating: "desc" }, { createdAt: "desc" }]
      : query.sort === "rating_low"
        ? [{ rating: "asc" }, { createdAt: "desc" }]
        : [{ createdAt: "desc" }];

  const [rows, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy,
      ...toSkipTake(query),
      select: { id: true, rating: true, title: true, comment: true, createdAt: true, user: { select: { name: true } } },
    }),
    prisma.review.count({ where }),
  ]);
  return {
    items: rows.map(({ user, ...review }) => ({ ...review, userName: user.name, verifiedBuyer: true })),
    meta: pageMeta(query, total),
  };
}

/** Only customers with a delivered order containing the product may review it (one review each, editable). */
export async function upsertReview(userId: string, input: ReviewInput) {
  const deliveredOrder = await prisma.order.findFirst({
    where: { userId, status: "DELIVERED", items: { some: { productId: input.productId } } },
    orderBy: { deliveredAt: "desc" },
    select: { id: true },
  });
  if (!deliveredOrder) throw AppError.forbidden("You can review products after they are delivered to you");

  return prisma.$transaction(async (tx) => {
    const review = await tx.review.upsert({
      where: { userId_productId: { userId, productId: input.productId } },
      update: { rating: input.rating, title: input.title, comment: input.comment },
      create: { ...input, userId, orderId: deliveredOrder.id },
    });
    await recomputeRating(tx, input.productId);
    return review;
  });
}

export async function listMyReviews(userId: string) {
  return prisma.review.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { id: true, slug: true, name: true, images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } } } },
    },
  });
}

export async function deleteOwnReview(userId: string, id: string) {
  const review = await prisma.review.findFirst({ where: { id, userId }, select: { productId: true } });
  if (!review) throw AppError.notFound("Review");
  await prisma.$transaction(async (tx) => {
    await tx.review.delete({ where: { id } });
    await recomputeRating(tx, review.productId);
  });
}

// ───────────────────────── admin ─────────────────────────

export async function listReviewsAdmin(query: AdminReviewListQuery) {
  const and: Prisma.ReviewWhereInput[] = [];
  if (query.q) {
    const contains = { contains: query.q, mode: "insensitive" as const };
    and.push({ OR: [{ title: contains }, { comment: contains }, { product: { name: contains } }, { user: { name: contains } }] });
  }
  if (query.rating) and.push({ rating: query.rating });
  if (query.hidden !== undefined) and.push({ isHidden: query.hidden });

  const where: Prisma.ReviewWhereInput = { AND: and };
  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...toSkipTake(query),
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.review.count({ where }),
  ]);
  return { items, meta: pageMeta(query, total) };
}

export async function setReviewHidden(id: string, isHidden: boolean) {
  return prisma.$transaction(async (tx) => {
    const review = await tx.review.update({ where: { id }, data: { isHidden } });
    await recomputeRating(tx, review.productId);
    return review;
  });
}

export async function deleteReviewAdmin(id: string) {
  await prisma.$transaction(async (tx) => {
    const review = await tx.review.delete({ where: { id } });
    await recomputeRating(tx, review.productId);
  });
}
