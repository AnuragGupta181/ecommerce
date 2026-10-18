import type { Prisma, VendorStatus } from "../../generated/prisma/client.js";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { pageMeta, toSkipTake } from "../../lib/pagination.js";
import { hashPassword } from "../../lib/password.js";
import { toE164 } from "../../lib/phone.js";
import { prisma, type Db } from "../../lib/prisma.js";
import { slugify } from "../../lib/slug.js";
import { uniqueSlug } from "../../lib/unique-slug.js";
import { inBackground, sendNotice } from "../../services/notify/index.js";
import { audit, type AuditActor } from "../audit/audit.service.js";
import { createBranchFor } from "../branches/branch.service.js";
import type { Point } from "../geo/geo.js";
import { describeShop, offerBranchSelect } from "../listings/offers.service.js";
import { getSettings } from "../settings/settings.service.js";
import type { AdminCreateVendorInput, AdminVendorUpdate, StaffInput, VendorListQuery, VendorProfileUpdate, VendorSignupInput, VendorStatusAction } from "./vendors.schema.js";

const vendorSlugTaken = async (slug: string) => (await prisma.vendor.count({ where: { slug } })) > 0;

async function assertLoginFree(db: Db, email: string, phone: string) {
  const clash = await db.user.findFirst({ where: { OR: [{ email }, { phone }] }, select: { email: true } });
  if (clash) throw AppError.conflict(clash.email === email ? "An account with this email already exists" : "An account with this phone number already exists");
}

type NewVendor = VendorSignupInput & { status: VendorStatus; commissionBps?: number; subscriptionsEnabled?: boolean };

async function createVendorWithOwner(input: NewVendor, actor: AuditActor | null) {
  const ownerEmail = input.owner.email;
  const ownerPhone = toE164(input.owner.phone);
  const slug = await uniqueSlug(slugify(input.shop.shopName), vendorSlugTaken);
  const passwordHash = await hashPassword(input.owner.password);

  return prisma.$transaction(async (tx) => {
    await assertLoginFree(tx, ownerEmail, ownerPhone);
    const vendor = await tx.vendor.create({
      data: {
        ...input.shop,
        phone: toE164(input.shop.phone),
        slug,
        status: input.status,
        commissionBps: input.commissionBps,
        subscriptionsEnabled: input.subscriptionsEnabled,
        approvedAt: input.status === "APPROVED" ? new Date() : null,
      },
    });
    await tx.user.create({
      data: { name: input.owner.name, email: ownerEmail, phone: ownerPhone, passwordHash, role: "VENDOR", vendorId: vendor.id, vendorRole: "OWNER" },
    });
    await createBranchFor(tx, vendor.id, slug, input.branch);
    await audit(tx, actor, { action: "vendor.create", entity: "vendor", entityId: vendor.id, vendorId: vendor.id, data: { status: input.status } });
    return vendor;
  });
}

/** Self-service signup: the shop waits for the admin's approval before customers can see it. */
export async function signupVendor(input: VendorSignupInput) {
  const vendor = await createVendorWithOwner({ ...input, status: "PENDING" }, null);
  inBackground(async () => {
    const settings = await getSettings();
    await sendNotice({
      recipientType: "ADMIN",
      to: settings.adminEmail,
      template: "vendor_signup",
      subject: `New vendor waiting for approval: ${vendor.shopName}`,
      heading: `${vendor.shopName} signed up`,
      lines: [`Owner: ${input.owner.name} (${input.owner.phone})`, `Address: ${vendor.address}`, `Review it: ${env.PORTAL_URL}/vendors/${vendor.id}`],
    });
  });
  return { id: vendor.id, slug: vendor.slug, shopName: vendor.shopName, status: vendor.status };
}

export async function adminCreateVendor(input: AdminCreateVendorInput, actor: AuditActor) {
  const vendor = await createVendorWithOwner({ ...input, status: "APPROVED" }, actor);
  return getVendorAdmin(vendor.id);
}

// ───────────────────────── vendor self-service ─────────────────────────

export async function getVendorProfile(vendorId: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: { branches: { select: offerBranchSelect, orderBy: { createdAt: "asc" } } },
  });
  if (!vendor) throw AppError.notFound("Vendor");
  const { branches, ...profile } = vendor;
  return { ...profile, branches: branches.map((branch) => describeShop(branch, null)) };
}

export async function updateVendorProfile(vendorId: string, input: VendorProfileUpdate, actor: AuditActor) {
  return prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.update({ where: { id: vendorId }, data: { ...input, phone: input.phone ? toE164(input.phone) : undefined } });
    await audit(tx, actor, { action: "vendor.profile", entity: "vendor", entityId: vendorId, vendorId, data: input });
    return vendor;
  });
}

/** Approved vendors can trade; pending ones can set up their shop; rejected and suspended ones cannot act. */
export async function assertVendorCanTrade(vendorId: string) {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { status: true } });
  if (!vendor) throw AppError.notFound("Vendor");
  if (vendor.status === "SUSPENDED") throw AppError.forbidden("Your shop is suspended. Contact the platform admin.");
  if (vendor.status === "REJECTED") throw AppError.forbidden("Your shop application was not approved.");
  return vendor;
}

// ───────────────────────── staff ─────────────────────────

export async function listStaff(vendorId: string) {
  return prisma.user.findMany({
    where: { vendorId },
    orderBy: [{ vendorRole: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, email: true, phone: true, vendorRole: true, isBlocked: true, createdAt: true },
  });
}

export async function addStaff(vendorId: string, input: StaffInput, actor: AuditActor) {
  if (!(await isOwner(actor.id, vendorId))) throw AppError.forbidden("Only the shop owner can add staff");
  const phone = toE164(input.phone);
  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    await assertLoginFree(tx, input.email, phone);
    const user = await tx.user.create({
      data: { name: input.name, email: input.email, phone, passwordHash, role: "VENDOR", vendorId, vendorRole: "STAFF" },
      select: { id: true, name: true, email: true, phone: true, vendorRole: true },
    });
    await audit(tx, actor, { action: "vendor.staff.add", entity: "user", entityId: user.id, vendorId });
    return user;
  });
}

export async function removeStaff(vendorId: string, userId: string, actor: AuditActor) {
  if (!(await isOwner(actor.id, vendorId))) throw AppError.forbidden("Only the shop owner can remove staff");
  const staff = await prisma.user.findFirst({ where: { id: userId, vendorId, vendorRole: "STAFF" } });
  if (!staff) throw AppError.notFound("Staff member");
  await prisma.$transaction(async (tx) => {
    // Blocking keeps their history intact and ends every session.
    await tx.user.update({ where: { id: userId }, data: { isBlocked: true } });
    await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit(tx, actor, { action: "vendor.staff.remove", entity: "user", entityId: userId, vendorId });
  });
}

async function isOwner(userId: string, vendorId: string) {
  return (await prisma.user.count({ where: { id: userId, vendorId, vendorRole: "OWNER" } })) > 0;
}

// ───────────────────────── admin ─────────────────────────

export async function listVendorsAdmin(query: VendorListQuery) {
  const and: Prisma.VendorWhereInput[] = [];
  if (query.status) and.push({ status: query.status });
  if (query.q) {
    const contains = { contains: query.q, mode: "insensitive" as const };
    and.push({ OR: [{ shopName: contains }, { email: contains }, { phone: { contains: query.q } }] });
  }
  const where: Prisma.VendorWhereInput = { AND: and };
  const [rows, total] = await Promise.all([
    prisma.vendor.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      ...toSkipTake(query),
      include: { _count: { select: { branches: true, orders: true, plans: true } } },
    }),
    prisma.vendor.count({ where }),
  ]);
  return { items: rows.map(({ _count, ...vendor }) => ({ ...vendor, branchCount: _count.branches, orderCount: _count.orders, planCount: _count.plans })), meta: pageMeta(query, total) };
}

export async function getVendorAdmin(id: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      branches: { select: { ...offerBranchSelect, address: true, city: true } },
      members: { select: { id: true, name: true, email: true, phone: true, vendorRole: true, isBlocked: true } },
    },
  });
  if (!vendor) throw AppError.notFound("Vendor");
  const [orders, delivered, listings, openTickets] = await Promise.all([
    prisma.order.count({ where: { vendorId: id } }),
    prisma.order.aggregate({ where: { vendorId: id, status: "DELIVERED" }, _sum: { itemsTotal: true, commissionAmount: true, vendorEarning: true } }),
    prisma.branchVariantStock.count({ where: { branch: { vendorId: id } } }),
    prisma.ticket.count({ where: { vendorId: id, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
  ]);
  const { branches, ...rest } = vendor;
  return {
    ...rest,
    branches: branches.map((branch) => ({ ...describeShop(branch, null), address: branch.address, city: branch.city, lat: branch.lat, lng: branch.lng })),
    stats: {
      orders,
      listings,
      openTickets,
      deliveredSales: delivered._sum.itemsTotal ?? 0,
      commissionEarned: delivered._sum.commissionAmount ?? 0,
      vendorEarnings: delivered._sum.vendorEarning ?? 0,
    },
  };
}

export async function updateVendorAdmin(id: string, input: AdminVendorUpdate, actor: AuditActor) {
  const before = await prisma.vendor.findUnique({ where: { id }, select: { commissionBps: true } });
  if (!before) throw AppError.notFound("Vendor");
  await prisma.$transaction(async (tx) => {
    await tx.vendor.update({ where: { id }, data: { ...input, phone: input.phone ? toE164(input.phone) : undefined } });
    await audit(tx, actor, {
      action: input.commissionBps !== undefined && input.commissionBps !== before.commissionBps ? "vendor.commission" : "vendor.update",
      entity: "vendor",
      entityId: id,
      vendorId: id,
      data: { ...input, previousCommissionBps: before.commissionBps },
    });
  });
  return getVendorAdmin(id);
}

const nextStatus: Record<VendorStatusAction["action"], { from: VendorStatus[]; to: VendorStatus }> = {
  approve: { from: ["PENDING", "REJECTED"], to: "APPROVED" },
  reject: { from: ["PENDING"], to: "REJECTED" },
  suspend: { from: ["APPROVED"], to: "SUSPENDED" },
  reactivate: { from: ["SUSPENDED"], to: "APPROVED" },
};

export async function setVendorStatus(id: string, { action, reason }: VendorStatusAction, actor: AuditActor) {
  const vendor = await prisma.vendor.findUnique({ where: { id }, select: { status: true, shopName: true, email: true } });
  if (!vendor) throw AppError.notFound("Vendor");
  const rule = nextStatus[action];
  if (!rule.from.includes(vendor.status)) throw new AppError("INVALID_TRANSITION", `A ${vendor.status.toLowerCase()} shop cannot be ${action}d`);
  if ((action === "reject" || action === "suspend") && !reason) throw AppError.badRequest("Give a reason; the vendor will see it");

  await prisma.$transaction(async (tx) => {
    await tx.vendor.update({
      where: { id },
      data: {
        status: rule.to,
        rejectionReason: action === "reject" || action === "suspend" ? reason : null,
        approvedAt: rule.to === "APPROVED" ? new Date() : undefined,
      },
    });
    await audit(tx, actor, { action: `vendor.${action}`, entity: "vendor", entityId: id, vendorId: id, data: { from: vendor.status, to: rule.to, reason: reason ?? null } });
  });

  const copy = {
    approve: { subject: "Your shop is live", heading: `${vendor.shopName} is approved`, line: "Customers near you can now see your shop and order from it." },
    reject: { subject: "Your shop application", heading: `${vendor.shopName} was not approved`, line: `Reason: ${reason}` },
    suspend: { subject: "Your shop is suspended", heading: `${vendor.shopName} is suspended`, line: `Reason: ${reason}` },
    reactivate: { subject: "Your shop is live again", heading: `${vendor.shopName} is active again`, line: "Customers can order from you again." },
  }[action];
  inBackground(() =>
    sendNotice({ recipientType: "VENDOR", to: vendor.email, template: `vendor_${action}`, subject: copy.subject, heading: copy.heading, lines: [copy.line, `Portal: ${env.PORTAL_URL}`] }),
  );
  return getVendorAdmin(id);
}

// ───────────────────────── public shop page ─────────────────────────

export async function getShop(slug: string, point: Point | null) {
  const vendor = await prisma.vendor.findFirst({
    where: { slug, status: "APPROVED" },
    select: {
      id: true,
      slug: true,
      shopName: true,
      description: true,
      logoUrl: true,
      phone: true,
      address: true,
      subscriptionsEnabled: true,
      branches: { where: { isActive: true }, select: offerBranchSelect },
      _count: { select: { plans: { where: { isActive: true } } } },
    },
  });
  if (!vendor) throw AppError.notFound("Shop");
  const { branches, _count, ...shop } = vendor;
  const [listingCount, ratings] = await Promise.all([
    prisma.branchVariantStock.count({ where: { isAvailable: true, branch: { vendorId: vendor.id, isActive: true } } }),
    prisma.order.count({ where: { vendorId: vendor.id, status: "DELIVERED" } }),
  ]);
  return {
    ...shop,
    branches: branches.map((branch) => describeShop(branch, point)).sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0)),
    listingCount,
    deliveredOrders: ratings,
    planCount: _count.plans,
  };
}
