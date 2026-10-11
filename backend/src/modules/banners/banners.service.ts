import type { BannerPlacement, Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import type { BannerInput, BannerUpdate } from "./banners.schema.js";

function liveWhere(now = new Date()): Prisma.BannerWhereInput {
  return {
    isActive: true,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ],
  };
}

const publicSelect = {
  id: true,
  title: true,
  subtitle: true,
  imageUrl: true,
  linkType: true,
  linkValue: true,
  placement: true,
} satisfies Prisma.BannerSelect;

export function listLiveBanners(placement?: BannerPlacement) {
  return prisma.banner.findMany({
    where: { ...liveWhere(), ...(placement ? { placement } : {}) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: publicSelect,
  });
}

export function listBannersAdmin() {
  return prisma.banner.findMany({ orderBy: [{ placement: "asc" }, { sortOrder: "asc" }] });
}

export function createBanner(input: BannerInput) {
  return prisma.banner.create({ data: input });
}

export function updateBanner(id: string, input: BannerUpdate) {
  return prisma.banner.update({ where: { id }, data: input });
}

export async function deleteBanner(id: string) {
  await prisma.banner.delete({ where: { id } });
}
