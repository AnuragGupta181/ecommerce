import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import { hashPassword } from "../../lib/password.js";
import { toE164 } from "../../lib/phone.js";
import { prisma } from "../../lib/prisma.js";
import { audit, type AuditActor } from "../audit/audit.service.js";
import { passwordSchema, phoneSchema } from "../auth/auth.schema.js";

export const adminInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().trim().toLowerCase(),
  phone: phoneSchema.optional(),
  password: passwordSchema,
});

const adminSelect = { id: true, name: true, email: true, phone: true, isSuperAdmin: true, isBlocked: true, createdAt: true } as const;

export function listAdmins() {
  return prisma.user.findMany({ where: { role: "ADMIN" }, orderBy: [{ isSuperAdmin: "desc" }, { createdAt: "asc" }], select: adminSelect });
}

export async function createAdmin(input: z.infer<typeof adminInputSchema>, actor: AuditActor) {
  const phone = input.phone ? toE164(input.phone) : null;
  const clash = await prisma.user.findFirst({ where: { OR: [{ email: input.email }, ...(phone ? [{ phone }] : [])] }, select: { id: true } });
  if (clash) throw AppError.conflict("An account with this email or phone already exists");
  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { name: input.name, email: input.email, phone, passwordHash, role: "ADMIN" }, select: adminSelect });
    await audit(tx, actor, { action: "admin.create", entity: "user", entityId: user.id });
    return user;
  });
}

/** Blocks an admin (keeps their audit history) and ends their sessions. The super admin cannot be removed. */
export async function removeAdmin(id: string, actor: AuditActor) {
  const admin = await prisma.user.findFirst({ where: { id, role: "ADMIN" }, select: { isSuperAdmin: true } });
  if (!admin) throw AppError.notFound("Admin");
  if (admin.isSuperAdmin) throw AppError.forbidden("The super admin cannot be removed");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { isBlocked: true } });
    await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit(tx, actor, { action: "admin.remove", entity: "user", entityId: id });
  });
}

export async function restoreAdmin(id: string, actor: AuditActor) {
  const admin = await prisma.user.findFirst({ where: { id, role: "ADMIN" }, select: { id: true } });
  if (!admin) throw AppError.notFound("Admin");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { isBlocked: false } });
    await audit(tx, actor, { action: "admin.restore", entity: "user", entityId: id });
  });
}
