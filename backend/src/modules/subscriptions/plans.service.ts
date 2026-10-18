import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { pageMeta } from "../../lib/pagination.js";
import { prisma } from "../../lib/prisma.js";
import { audit, type AuditActor } from "../audit/audit.service.js";
import type { Point } from "../geo/geo.js";
import { describeShop, offerBranchSelect } from "../listings/offers.service.js";
import type { PlanInput, PlansQuery, PlanUpdate } from "./subscriptions.schema.js";

export const planSelect = {
  id: true,
  name: true,
  description: true,
  quantityPerDelivery: true,
  slots: true,
  capacity: true,
  isActive: true,
  createdAt: true,
  prices: { select: { period: true, pricePerDelivery: true, deliveryFee: true, deliveryFeeMode: true }, orderBy: { period: "desc" } },
  listing: {
    select: {
      id: true,
      price: true,
      mrp: true,
      stock: true,
      variant: { select: { id: true, label: true, product: { select: { id: true, name: true, slug: true, images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } } } } } },
    },
  },
  branch: { select: offerBranchSelect },
  _count: { select: { subscriptions: { where: { status: "ACTIVE" } } } },
} satisfies Prisma.SubscriptionPlanSelect;

type PlanRow = Prisma.SubscriptionPlanGetPayload<{ select: typeof planSelect }>;

export function toPlanView(plan: PlanRow, point: Point | null) {
  const { listing, branch, _count, ...rest } = plan;
  return {
    ...rest,
    product: {
      id: listing.variant.product.id,
      name: listing.variant.product.name,
      slug: listing.variant.product.slug,
      variantLabel: listing.variant.label,
      imageUrl: listing.variant.product.images[0]?.url ?? null,
      /** The shop's normal one-off price, to show the subscription saving. */
      regularPrice: listing.price,
    },
    shop: describeShop(branch, point),
    activeSubscribers: _count.subscriptions,
    isFull: plan.capacity !== null && _count.subscriptions >= plan.capacity,
  };
}

export type PlanView = ReturnType<typeof toPlanView>;

const publicPlanWhere: Prisma.SubscriptionPlanWhereInput = {
  isActive: true,
  branch: { isActive: true },
  vendor: { status: "APPROVED", subscriptionsEnabled: true },
};

/** "Daily essentials": plans customers can subscribe to, deliverable ones nearest first. */
export async function listPublicPlans(point: Point | null, query: PlansQuery) {
  const where: Prisma.SubscriptionPlanWhereInput = {
    ...publicPlanWhere,
    ...(query.vendor ? { vendor: { slug: query.vendor, status: "APPROVED", subscriptionsEnabled: true } } : {}),
    ...(query.q
      ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { listing: { variant: { product: { name: { contains: query.q, mode: "insensitive" } } } } }] }
      : {}),
  };
  const rows = await prisma.subscriptionPlan.findMany({ where, select: planSelect, take: 200 });
  const views = rows
    .map((row) => toPlanView(row, point))
    .sort((a, b) => Number(b.shop.deliverable) - Number(a.shop.deliverable) || (a.shop.distanceKm ?? 0) - (b.shop.distanceKm ?? 0));
  const start = (query.page - 1) * query.limit;
  return { items: views.slice(start, start + query.limit), meta: pageMeta(query, views.length) };
}

export async function getPublicPlan(id: string, point: Point | null) {
  const plan = await prisma.subscriptionPlan.findFirst({ where: { id, ...publicPlanWhere }, select: planSelect });
  if (!plan) throw AppError.notFound("Plan");
  return toPlanView(plan, point);
}

// ───────────────────────── vendor ─────────────────────────

async function assertSubscriptionsEnabled(vendorId: string) {
  const vendor = await prisma.vendor.findUniqueOrThrow({ where: { id: vendorId }, select: { subscriptionsEnabled: true } });
  if (!vendor.subscriptionsEnabled) throw AppError.badRequest("Turn on daily needs (subscriptions) in your shop settings first");
}

async function ownListing(vendorId: string, listingId: string) {
  const listing = await prisma.branchVariantStock.findFirst({ where: { id: listingId, branch: { vendorId } }, select: { id: true, branchId: true } });
  if (!listing) throw AppError.notFound("Listing");
  return listing;
}

export async function listVendorPlans(vendorId: string) {
  const rows = await prisma.subscriptionPlan.findMany({ where: { vendorId }, orderBy: { createdAt: "desc" }, select: planSelect });
  return rows.map((row) => toPlanView(row, null));
}

export async function createPlan(vendorId: string, input: PlanInput, actor: AuditActor) {
  await assertSubscriptionsEnabled(vendorId);
  const listing = await ownListing(vendorId, input.listingId);
  const { prices, ...fields } = input;
  return prisma.$transaction(async (tx) => {
    const plan = await tx.subscriptionPlan.create({
      data: { ...fields, vendorId, branchId: listing.branchId, prices: { create: prices } },
      select: planSelect,
    });
    await audit(tx, actor, { action: "plan.create", entity: "plan", entityId: plan.id, vendorId });
    return toPlanView(plan, null);
  });
}

export async function updatePlan(vendorId: string, planId: string, input: PlanUpdate, actor: AuditActor) {
  const existing = await prisma.subscriptionPlan.findFirst({ where: { id: planId, vendorId }, select: { id: true } });
  if (!existing) throw AppError.notFound("Plan");
  const listing = input.listingId ? await ownListing(vendorId, input.listingId) : null;
  const { prices, ...fields } = input;
  return prisma.$transaction(async (tx) => {
    // New prices apply to new subscribers only: each subscription locked its terms when it started.
    if (prices) {
      await tx.subscriptionPlanPrice.deleteMany({ where: { planId } });
      await tx.subscriptionPlanPrice.createMany({ data: prices.map((price) => ({ ...price, planId })) });
    }
    const plan = await tx.subscriptionPlan.update({
      where: { id: planId },
      data: { ...fields, ...(listing ? { branchId: listing.branchId } : {}) },
      select: planSelect,
    });
    await audit(tx, actor, { action: "plan.update", entity: "plan", entityId: planId, vendorId, data: input });
    return toPlanView(plan, null);
  });
}

/** Plans with subscribers are retired (no new sign-ups) instead of deleted. */
export async function deletePlan(vendorId: string, planId: string, actor: AuditActor) {
  const plan = await prisma.subscriptionPlan.findFirst({ where: { id: planId, vendorId }, select: { _count: { select: { subscriptions: true } } } });
  if (!plan) throw AppError.notFound("Plan");
  const archived = plan._count.subscriptions > 0;
  await prisma.$transaction(async (tx) => {
    if (archived) await tx.subscriptionPlan.update({ where: { id: planId }, data: { isActive: false } });
    else await tx.subscriptionPlan.delete({ where: { id: planId } });
    await audit(tx, actor, { action: "plan.delete", entity: "plan", entityId: planId, vendorId, data: { archived } });
  });
  return { archived };
}

export async function loadPlanForSubscribe(planId: string) {
  const plan = await prisma.subscriptionPlan.findFirst({ where: { id: planId, ...publicPlanWhere }, select: { ...planSelect, vendorId: true, branchId: true, listingId: true } });
  if (!plan) throw AppError.notFound("Plan");
  return plan;
}

