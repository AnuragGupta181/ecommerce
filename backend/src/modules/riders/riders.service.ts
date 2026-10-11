import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { pageMeta, toSkipTake } from "../../lib/pagination.js";
import { toE164 } from "../../lib/phone.js";
import { prisma } from "../../lib/prisma.js";
import { ACTIVE_STATUSES } from "../orders/order-status.js";
import type { RiderInput, RiderListQuery, RiderUpdate } from "./riders.schema.js";

function normalisePhones<T extends { phone?: string; whatsapp?: string | null }>(input: T): T {
  return {
    ...input,
    phone: input.phone ? toE164(input.phone) : input.phone,
    whatsapp: input.whatsapp ? toE164(input.whatsapp) : input.whatsapp,
  };
}

export async function listRiders(query: RiderListQuery) {
  const and: Prisma.RiderWhereInput[] = [];
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
    prisma.rider.findMany({ where, orderBy: [{ isActive: "desc" }, { name: "asc" }], ...toSkipTake(query) }),
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

export async function getRider(id: string) {
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

export function createRider(input: RiderInput) {
  return prisma.rider.create({ data: normalisePhones(input) });
}

export function updateRider(id: string, input: RiderUpdate) {
  return prisma.rider.update({ where: { id }, data: normalisePhones(input) });
}

/** Riders with delivery history are deactivated instead of deleted. */
export async function deleteRider(id: string) {
  const orders = await prisma.order.count({ where: { riderId: id } });
  if (orders > 0) {
    await prisma.rider.update({ where: { id }, data: { isActive: false } });
    return { archived: true };
  }
  await prisma.rider.delete({ where: { id } });
  return { archived: false };
}
