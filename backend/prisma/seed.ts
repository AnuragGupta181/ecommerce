/**
 * Seeds the admin account, store settings and a demo catalog.
 * Idempotent: existing records (matched by email / slug / code) are left untouched.
 *
 * Run: pnpm db:seed
 */
import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client.js";

type SeedVariant = { sku: string; label: string; attributes: Record<string, string>; mrp: number; price: number; stock: number };
type SeedProduct = {
  name: string;
  slug: string;
  description: string;
  highlights: string[];
  specs: { label: string; value: string }[];
  tags: string[];
  category: string;
  brand: string | null;
  images: string[];
  isFeatured: boolean;
  variants: SeedVariant[];
  reviews: { rating: number; comment: string; name: string; email: string; date: string }[];
};
type SeedCategory = { name: string; slug: string; imageUrl: string | null; children: Omit<SeedCategory, "children">[] };

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

const DAY_MS = 24 * 60 * 60 * 1000;
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function seedAdmin() {
  const email = (process.env.ADMIN_SEED_EMAIL ?? "admin@haat.local").toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!password) throw new Error("ADMIN_SEED_PASSWORD is not set");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return console.log(`• admin exists: ${email}`);
  await prisma.user.create({
    data: { name: "Store Admin", email, role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
  });
  console.log(`✓ admin created: ${email}`);
}

async function seedSettings() {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      storeName: "Haat",
      supportEmail: "support@haat.local",
      supportPhone: "+919800000000",
      adminEmail: process.env.ADMIN_SEED_EMAIL ?? "admin@haat.local",
      adminWhatsapp: "+919800000000",
    },
  });
  console.log("✓ settings");
}

async function seedCategories(categories: SeedCategory[]) {
  const ids = new Map<string, string>();
  for (const [index, parent] of categories.entries()) {
    const created = await prisma.category.upsert({
      where: { slug: parent.slug },
      update: {},
      create: { name: parent.name, slug: parent.slug, imageUrl: parent.imageUrl, sortOrder: index },
    });
    for (const [childIndex, child] of parent.children.entries()) {
      const sub = await prisma.category.upsert({
        where: { slug: child.slug },
        update: {},
        create: { name: child.name, slug: child.slug, imageUrl: child.imageUrl, sortOrder: childIndex, parentId: created.id },
      });
      ids.set(child.slug, sub.id);
    }
  }
  console.log(`✓ categories (${ids.size} sub-categories)`);
  return ids;
}

async function seedBrands(products: SeedProduct[]) {
  const names = [...new Set(products.map((product) => product.brand).filter((brand): brand is string => !!brand))];
  await prisma.brand.createMany({ data: names.map((name) => ({ name, slug: slugify(name) })), skipDuplicates: true });
  const brands = await prisma.brand.findMany({ select: { id: true, name: true } });
  console.log(`✓ brands (${brands.length})`);
  return new Map(brands.map((brand) => [brand.name, brand.id]));
}

async function seedProducts(products: SeedProduct[], categoryIds: Map<string, string>, brandIds: Map<string, string>) {
  const existing = new Set((await prisma.product.findMany({ select: { slug: true } })).map((product) => product.slug));
  let created = 0;

  for (const [index, product] of products.entries()) {
    if (existing.has(product.slug)) continue;
    const categoryId = categoryIds.get(product.category);
    if (!categoryId) continue;
    // The source data repeats a few titles; the first one wins.
    existing.add(product.slug);

    const cheapest = [...product.variants].sort((a, b) => a.price - b.price)[0]!;
    const result = await prisma.product.create({
      data: {
        name: product.name,
        slug: product.slug,
        description: product.description,
        highlights: product.highlights,
        specs: product.specs,
        tags: product.tags,
        categoryId,
        brandId: product.brand ? brandIds.get(product.brand) : undefined,
        isFeatured: product.isFeatured,
        minPrice: cheapest.price,
        minMrp: cheapest.mrp,
        discountPercent: Math.round(((cheapest.mrp - cheapest.price) / cheapest.mrp) * 100),
        // Deterministic spread so "popular" and "new arrivals" have meaningful ordering.
        soldCount: (index * 37) % 480,
        createdAt: new Date(Date.now() - ((index * 7) % 90) * DAY_MS),
        images: { create: product.images.map((url, sortOrder) => ({ url, alt: product.name, sortOrder })) },
        variants: {
          create: product.variants.map((variant, sortOrder) => ({ ...variant, sortOrder })),
        },
      },
      select: { variants: { select: { id: true, stock: true } } },
    });
    await prisma.stockMovement.createMany({
      data: result.variants
        .filter((variant) => variant.stock > 0)
        .map((variant) => ({ variantId: variant.id, type: "IN" as const, quantity: variant.stock, stockAfter: variant.stock, reason: "Initial stock" })),
    });
    created += 1;
  }
  console.log(`✓ products (${created} new)`);
}

async function seedReviews(products: SeedProduct[]) {
  const reviewers = new Map<string, string>();
  for (const product of products) for (const review of product.reviews) reviewers.set(review.email.toLowerCase(), review.name);

  // Demo reviewers cannot log in: they share an unguessable random hash.
  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);
  await prisma.user.createMany({
    data: [...reviewers].map(([email, name]) => ({ email, name, passwordHash })),
    skipDuplicates: true,
  });
  const users = await prisma.user.findMany({ where: { email: { in: [...reviewers.keys()] } }, select: { id: true, email: true } });
  const userIds = new Map(users.map((user) => [user.email, user.id]));
  const productIds = new Map((await prisma.product.findMany({ select: { id: true, slug: true } })).map((p) => [p.slug, p.id]));

  const { count } = await prisma.review.createMany({
    data: products.flatMap((product) =>
      product.reviews.flatMap((review) => {
        const userId = userIds.get(review.email.toLowerCase());
        const productId = productIds.get(product.slug);
        return userId && productId
          ? [{ userId, productId, rating: review.rating, comment: review.comment, createdAt: new Date(review.date) }]
          : [];
      }),
    ),
    skipDuplicates: true,
  });

  await prisma.$executeRaw`
    UPDATE "Product" p SET "ratingAvg" = r.avg, "ratingCount" = r.cnt
    FROM (SELECT "productId", AVG(rating)::float AS avg, COUNT(*)::int AS cnt FROM "Review" WHERE "isHidden" = false GROUP BY "productId") r
    WHERE p.id = r."productId"`;
  console.log(`✓ reviews (${count} new)`);
}

async function seedCoupons() {
  const now = new Date();
  const in90Days = new Date(now.getTime() + 90 * DAY_MS);
  const coupons = [
    { code: "WELCOME100", description: "Welcome offer on your first order", type: "FLAT" as const, value: 10_000, minOrderValue: 49_900, firstOrderOnly: true },
    { code: "SAVE10", description: "10% off on bigger baskets", type: "PERCENT" as const, value: 10, maxDiscount: 20_000, minOrderValue: 99_900 },
    { code: "HAAT50", description: "Flat ₹50 off", type: "FLAT" as const, value: 5_000, minOrderValue: 29_900, perUserLimit: 3 },
    { code: "MEGA20", description: "Mega sale: 20% off", type: "PERCENT" as const, value: 20, maxDiscount: 50_000, minOrderValue: 199_900, endsAt: in90Days, usageLimit: 500 },
  ];
  await prisma.coupon.createMany({ data: coupons, skipDuplicates: true });
  console.log(`✓ coupons (${coupons.length})`);
}

async function seedBanners(categories: SeedCategory[]) {
  if ((await prisma.banner.count()) > 0) return console.log("• banners exist");
  const pick = (slug: string) => categories.find((category) => category.slug === slug);
  const electronics = pick("mobiles-electronics");
  const fashion = pick("fashion");
  const grocery = pick("grocery");
  await prisma.banner.createMany({
    data: [
      { title: "Big Savings Days", subtitle: "Up to 60% off on top brands", imageUrl: electronics?.imageUrl ?? "", linkType: "CATEGORY", linkValue: electronics?.slug, sortOrder: 0 },
      { title: "Fresh Fashion Drop", subtitle: "New styles, every week", imageUrl: fashion?.imageUrl ?? "", linkType: "CATEGORY", linkValue: fashion?.slug, sortOrder: 1 },
      { title: "Daily Essentials", subtitle: "Groceries delivered by your local store", imageUrl: grocery?.imageUrl ?? "", linkType: "CATEGORY", linkValue: grocery?.slug, sortOrder: 2 },
      { title: "Use WELCOME100", subtitle: "₹100 off your first order", imageUrl: electronics?.imageUrl ?? "", linkType: "NONE", placement: "HOME_STRIP", sortOrder: 0 },
    ],
  });
  console.log("✓ banners");
}

async function seedRiders() {
  await prisma.rider.createMany({
    data: [
      { name: "Ravi Kumar", phone: "+919811111111", whatsapp: "+919811111111", email: "ravi.rider@haat.local", vehicleType: "BIKE", vehicleNumber: "DL01AB1234", idProofType: "Driving Licence", idProofNumber: "DL-0420110012345" },
      { name: "Suresh Yadav", phone: "+919822222222", whatsapp: "+919822222222", vehicleType: "SCOOTER", vehicleNumber: "DL02CD5678" },
      { name: "Imran Khan", phone: "+919833333333", email: "imran.rider@haat.local", vehicleType: "BICYCLE" },
    ],
    skipDuplicates: true,
  });
  console.log("✓ riders");
}

async function main() {
  const catalog = JSON.parse(await readFile(new URL("./seed-data/catalog.json", import.meta.url), "utf8")) as {
    categories: SeedCategory[];
    products: SeedProduct[];
  };
  await seedAdmin();
  await seedSettings();
  const categoryIds = await seedCategories(catalog.categories);
  const brandIds = await seedBrands(catalog.products);
  await seedProducts(catalog.products, categoryIds, brandIds);
  await seedReviews(catalog.products);
  await seedCoupons();
  await seedBanners(catalog.categories);
  await seedRiders();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
