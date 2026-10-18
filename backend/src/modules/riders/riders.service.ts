import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { pageMeta, toSkipTake } from "../../lib/pagination.js";
import { toE164 } from "../../lib/phone.js";
import { randomToken } from "../../lib/crypto.js";
import { prisma } from "../../lib/prisma.js";
import { ACTIVE_STATUSES } from "../orders/order-status.js";
import type { RiderInput, RiderListQuery, RiderUpdate } from "./riders.schema.js";

/** Vendor portal passes its vendor id; the admin sees every rider. */
export type RiderScope = { vendorId?: string };

async function scopedRider(id: string, scope: RiderScope) {
  const rider = await prisma.rider.findFirst({ where: { id, ...(scope.vendorId ? { vendorId: scope.vendorId } : {}) } });
  if (!rider) throw AppError.notFound("Rider");
  return rider;
}

function normalisePhones<T extends { phone?: string; whatsapp?: string | null }>(input: T): T {
  return {
    ...input,
    phone: input.phone ? toE164(input.phone) : input.phone,
    whatsapp: input.whatsapp ? toE164(input.whatsapp) : input.whatsapp,
  };
}

export async function listRiders(query: RiderListQuery, scope: RiderScope = {}) {
  const and: Prisma.RiderWhereInput[] = [];
  if (scope.vendorId) and.push({ vendorId: scope.vendorId });
  if (query.vendorId) and.push({ vendorId: query.vendorId });
  if (query.q) {
    and.push({
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { phone: { contains: query.q } },
        { vehicleNumber: { contains: query.q, mode: "insensitive" } },
      ],
    });
  }
  if (query.active !== undefined) and.push({ isActive: query.active });

  const where: Prisma.RiderWhereInput = { AND: and };
  const [rows, total] = await Promise.all([
    prisma.rider.findMany({ where, orderBy: [{ isActive: "desc" }, { name: "asc" }], ...toSkipTake(query), include: { vendor: { select: { id: true, shopName: true } } } }),
    prisma.rider.count({ where }),
  ]);

  const activeLoads = await prisma.order.groupBy({
    by: ["riderId"],
    where: { riderId: { in: rows.map((rider) => rider.id) }, status: { in: [...ACTIVE_STATUSES] } },
    _count: true,
  });
  const loadByRider = new Map(activeLoads.map((group) => [group.riderId, group._count]));

  return {
    items: rows.map((rider) => ({ ...rider, activeOrders: loadByRider.get(rider.id) ?? 0 })),
    meta: pageMeta(query, total),
  };
}

export async function getRider(id: string, scope: RiderScope = {}) {
  await scopedRider(id, scope);
  const rider = await prisma.rider.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { riderAssignedAt: "desc" },
        take: 30,
        select: { id: true, orderNumber: true, status: true, payable: true, riderAssignedAt: true, deliveredAt: true },
      },
    },
  });
  if (!rider) throw AppError.notFound("Rider");
  const [delivered, active] = await Promise.all([
    prisma.order.count({ where: { riderId: id, status: "DELIVERED" } }),
    prisma.order.count({ where: { riderId: id, status: { in: [...ACTIVE_STATUSES] } } }),
  ]);
  return { ...rider, stats: { delivered, active } };
}

export function createRider(input: RiderInput, scope: RiderScope = {}) {
  return prisma.rider.create({ data: { ...normalisePhones(input), vendorId: scope.vendorId ?? input.vendorId ?? null, linkToken: randomToken() } });
}

export async function updateRider(id: string, input: RiderUpdate, scope: RiderScope = {}) {
  await scopedRider(id, scope);
  // A vendor cannot move its riders to another shop.
  const { vendorId, ...rest } = input;
  return prisma.rider.update({ where: { id }, data: { ...normalisePhones(rest), ...(scope.vendorId ? {} : { vendorId }) } });
}

/** New private schedule link; the old one stops working. */
export async function rotateRiderLink(id: string, scope: RiderScope = {}) {
  await scopedRider(id, scope);
  return prisma.rider.update({ where: { id }, data: { linkToken: randomToken() }, select: { id: true, linkToken: true } });
}

/** Riders with delivery history are deactivated instead of deleted. */
export async function deleteRider(id: string, scope: RiderScope = {}) {
  await scopedRider(id, scope);
  const orders = await prisma.order.count({ where: { riderId: id } });
  if (orders > 0) {
    await prisma.rider.update({ where: { id }, data: { isActive: false } });
    return { archived: true };
  }
  await prisma.rider.delete({ where: { id } });
  return { archived: false };
}
