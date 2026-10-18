import type { Prisma, Role } from "../../generated/prisma/client.js";
import { pageMeta, toSkipTake, type PaginationQuery } from "../../lib/pagination.js";
import { prisma, type Db } from "../../lib/prisma.js";

export type AuditActor = { id: string; role: Role; vendorId?: string };

export type AuditEntry = {
  action: string;
  entity: string;
  entityId?: string;
  /** Target vendor, so a vendor's history can be filtered even when an admin acted. */
  vendorId?: string | null;
  data?: Prisma.InputJsonValue;
};

/** Records who did what. Call inside the business transaction so the log matches what committed. */
export async function audit(db: Db, actor: AuditActor | null, entry: AuditEntry) {
  await db.auditLog.create({
    data: {
      actorId: actor?.id,
      actorRole: actor?.role,
      vendorId: entry.vendorId ?? actor?.vendorId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      data: entry.data,
    },
  });
}

export type AuditQuery = PaginationQuery & { vendorId?: string; actorId?: string; entity?: string; from?: Date; to?: Date };

export async function listAudit(query: AuditQuery) {
  const where: Prisma.AuditLogWhereInput = {
    vendorId: query.vendorId,
    actorId: query.actorId,
    entity: query.entity,
    createdAt: query.from || query.to ? { gte: query.from, lte: query.to } : undefined,
  };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...toSkipTake(query),
      include: { actor: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { items: rows, meta: pageMeta(query, total) };
}
