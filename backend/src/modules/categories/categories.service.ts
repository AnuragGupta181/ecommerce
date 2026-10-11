import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { uniqueSlug } from "../../lib/unique-slug.js";
import type { CategoryInput, CategoryUpdate } from "./categories.schema.js";

const publicSelect = { id: true, name: true, slug: true, imageUrl: true, parentId: true } as const;

/** Active top-level categories with their active children. */
export async function getCategoryTree() {
  return prisma.category.findMany({
    where: { isActive: true, parentId: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      ...publicSelect,
      children: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: publicSelect,
      },
    },
  });
}

export async function getCategoryBySlug(slug: string) {
  const category = await prisma.category.findFirst({
    where: { slug, isActive: true },
    select: {
      ...publicSelect,
      parent: { select: publicSelect },
      children: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: publicSelect },
    },
  });
  if (!category) throw AppError.notFound("Category");
  return category;
}

/** The category plus its direct children, used for listing filters. */
export async function categoryWithDescendantIds(slug: string): Promise<string[]> {
  const category = await prisma.category.findUnique({
    where: { slug },
    select: { id: true, children: { select: { id: true } } },
  });
  if (!category) return [];
  return [category.id, ...category.children.map((child) => child.id)];
}

// ───────────────────────── admin ─────────────────────────

export async function listCategoriesAdmin() {
  return prisma.category.findMany({
    orderBy: [{ parentId: { sort: "asc", nulls: "first" } }, { sortOrder: "asc" }, { name: "asc" }],
    include: {
      parent: { select: { id: true, name: true } },
      _count: { select: { products: true, children: true } },
    },
  });
}

async function assertValidParent(parentId: string | null | undefined, selfId?: string) {
  if (!parentId) return;
  if (parentId === selfId) throw AppError.badRequest("A category cannot be its own parent");
  const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { parentId: true } });
  if (!parent) throw AppError.badRequest("Parent category not found");
  // Two-level tree keeps navigation simple on mobile.
  if (parent.parentId) throw AppError.badRequest("Sub-categories cannot have their own children");
}

const slugTaken = (excludeId?: string) => async (slug: string) =>
  (await prisma.category.count({ where: { slug, id: excludeId ? { not: excludeId } : undefined } })) > 0;

export async function createCategory(input: CategoryInput) {
  await assertValidParent(input.parentId);
  const slug = await uniqueSlug(input.slug ?? input.name, slugTaken());
  return prisma.category.create({ data: { ...input, slug } });
}

export async function updateCategory(id: string, input: CategoryUpdate) {
  const existing = await prisma.category.findUnique({ where: { id }, include: { _count: { select: { children: true } } } });
  if (!existing) throw AppError.notFound("Category");
  await assertValidParent(input.parentId, id);
  if (input.parentId && existing._count.children > 0) {
    throw AppError.badRequest("A category with sub-categories cannot become a sub-category");
  }
  const slug = input.slug ? await uniqueSlug(input.slug, slugTaken(id)) : undefined;
  return prisma.category.update({ where: { id }, data: { ...input, slug } });
}

export async function deleteCategory(id: string) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true, children: true } } },
  });
  if (!category) throw AppError.notFound("Category");
  if (category._count.products > 0 || category._count.children > 0) {
    throw AppError.conflict("Move its products and sub-categories before deleting, or deactivate it instead");
  }
  await prisma.category.delete({ where: { id } });
}
