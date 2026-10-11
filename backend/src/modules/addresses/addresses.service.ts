import { AppError } from "../../lib/errors.js";
import { toE164 } from "../../lib/phone.js";
import { prisma } from "../../lib/prisma.js";
import type { AddressInput, AddressUpdate } from "./addresses.schema.js";

export function listAddresses(userId: string) {
  return prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] });
}

export async function getOwnedAddress(userId: string, id: string) {
  const address = await prisma.address.findFirst({ where: { id, userId } });
  if (!address) throw AppError.notFound("Address");
  return address;
}

export async function createAddress(userId: string, input: AddressInput) {
  const count = await prisma.address.count({ where: { userId } });
  // The first address becomes the default automatically.
  const isDefault = input.isDefault || count === 0;
  return prisma.$transaction(async (tx) => {
    if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return tx.address.create({ data: { ...input, phone: toE164(input.phone), isDefault, userId } });
  });
}

export async function updateAddress(userId: string, id: string, input: AddressUpdate) {
  await getOwnedAddress(userId, id);
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return tx.address.update({
      where: { id },
      data: { ...input, phone: input.phone ? toE164(input.phone) : undefined },
    });
  });
}

export async function deleteAddress(userId: string, id: string) {
  const address = await getOwnedAddress(userId, id);
  await prisma.$transaction(async (tx) => {
    await tx.address.delete({ where: { id } });
    if (address.isDefault) {
      const next = await tx.address.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
}
