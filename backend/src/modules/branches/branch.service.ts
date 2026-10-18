import { AppError } from "../../lib/errors.js";
import { prisma, type Db } from "../../lib/prisma.js";
import { slugify } from "../../lib/slug.js";
import { uniqueSlug } from "../../lib/unique-slug.js";
import { audit, type AuditActor } from "../audit/audit.service.js";
import type { Point } from "../geo/geo.js";
import { describeShop, offerBranchSelect } from "../listings/offers.service.js";
import type { BranchInput, BranchUpdate, SetOnlineInput } from "./branch.schema.js";

const slugTaken = async (slug: string) => (await prisma.branch.count({ where: { slug } })) > 0;

export async function createBranchFor(db: Db, vendorId: string, vendorSlug: string, input: BranchInput) {
  const slug = await uniqueSlug(slugify(`${vendorSlug}-${input.name}`), slugTaken);
  return db.branch.create({ data: { ...input, slug, vendorId } });
}

async function ownBranch(vendorId: string, branchId: string) {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, vendorId } });
  if (!branch) throw AppError.notFound("Branch");
  return branch;
}

// ───────────────────────── vendor ─────────────────────────

export async function listVendorBranches(vendorId: string) {
  const branches = await prisma.branch.findMany({
    where: { vendorId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { ...offerBranchSelect, address: true, city: true, state: true, pincode: true, phone: true, email: true, slug: true, _count: { select: { branchStock: true, orders: true } } },
  });
  return branches.map(({ _count, ...branch }) => ({ ...branch, ...describeShop(branch, null), listingCount: _count.branchStock, orderCount: _count.orders }));
}

export async function createVendorBranch(vendorId: string, input: BranchInput, actor: AuditActor) {
  const vendor = await prisma.vendor.findUniqueOrThrow({ where: { id: vendorId }, select: { slug: true } });
  return prisma.$transaction(async (tx) => {
    const branch = await createBranchFor(tx, vendorId, vendor.slug, input);
    await audit(tx, actor, { action: "branch.create", entity: "branch", entityId: branch.id, vendorId });
    return branch;
  });
}

export async function updateVendorBranch(vendorId: string, branchId: string, input: BranchUpdate, actor: AuditActor) {
  await ownBranch(vendorId, branchId);
  return prisma.$transaction(async (tx) => {
    const branch = await tx.branch.update({ where: { id: branchId }, data: input });
    await audit(tx, actor, { action: "branch.update", entity: "branch", entityId: branchId, vendorId, data: input });
    return branch;
  });
}

/** The vendor's working switch. Closed shops stay visible to customers but take no orders. */
export async function setBranchOnline(vendorId: string, branchId: string, input: SetOnlineInput, actor: AuditActor) {
  await ownBranch(vendorId, branchId);
  return prisma.$transaction(async (tx) => {
    const branch = await tx.branch.update({
      where: { id: branchId },
      data: { isOnline: input.isOnline, ...(input.offlineMessage !== undefined ? { offlineMessage: input.offlineMessage } : {}) },
    });
    await tx.branchStatusLog.create({ data: { branchId, isOnline: input.isOnline, reason: input.reason, actorId: actor.id } });
    await audit(tx, actor, { action: input.isOnline ? "branch.online" : "branch.offline", entity: "branch", entityId: branchId, vendorId, data: { reason: input.reason ?? null } });
    return branch;
  });
}

// ───────────────────────── admin (read-only) ─────────────────────────

export async function listAllBranches() {
  const branches = await prisma.branch.findMany({
    orderBy: [{ vendor: { shopName: "asc" } }, { name: "asc" }],
    select: { ...offerBranchSelect, city: true, address: true, _count: { select: { branchStock: true, orders: true } } },
  });
  return branches.map(({ _count, ...branch }) => ({ ...branch, ...describeShop(branch, null), listingCount: _count.branchStock, orderCount: _count.orders }));
}

// ───────────────────────── public ─────────────────────────

/** Shops near a point, open ones first, for "Shops near you" and the location picker. */
export async function nearbyShops(point: Point | null, limit: number) {
  const branches = await prisma.branch.findMany({ where: { isActive: true, vendor: { status: "APPROVED" } }, select: offerBranchSelect });
  return branches
    .map((branch) => describeShop(branch, point))
    .filter((shop) => shop.deliverable)
    .sort((a, b) => Number(b.isOpen) - Number(a.isOpen) || (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
    .slice(0, limit);
}
