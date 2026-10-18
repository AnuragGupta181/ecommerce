/**
 * Seeds the marketplace: the platform's own shop plus demo vendors close to each other,
 * so vendor choice, per-km delivery fees and subscriptions have realistic data.
 * Idempotent: vendors and branches are matched by slug, listings by branch + variant.
 */
import bcrypt from "bcryptjs";
import type { Prisma } from "../src/generated/prisma/client.js";
import { prisma } from "../src/lib/prisma.js";
import { TEST_ACCOUNT_PASSWORD } from "./seed-demo.js";

const GROCERY = ["fruits", "daily-essentials", "oil-masala", "vegetables", "dairy-bakery", "snacks-beverages", "atta-rice-dal"];

type BranchSeed = Omit<Prisma.BranchUncheckedCreateInput, "vendorId">;
type VendorSeed = {
  vendor: Omit<Prisma.VendorUncheckedCreateInput, "id">;
  branch: BranchSeed;
  owner?: { name: string; email: string; phone: string };
  /** Only these catalog categories are listed (undefined = whole catalog). */
  categories?: string[];
  /** Price relative to the catalog price, in percent (e.g. 96 = 4% cheaper). */
  pricePercent: number;
  plans?: PlanSeed[];
};
type PlanSeed = {
  productSlug: string;
  name: string;
  description: string;
  quantityPerDelivery: number;
  slots: string[];
  weekly: { pricePercent: number; deliveryFee: number; mode: "PER_DELIVERY" | "PER_PERIOD" };
  monthly: { pricePercent: number; deliveryFee: number; mode: "PER_DELIVERY" | "PER_PERIOD" };
};

const VENDORS: VendorSeed[] = [
  {
    vendor: {
      slug: "haat",
      shopName: "Haat Store",
      description: "The platform's own store with the full catalog.",
      phone: "+919800000000",
      email: "store@haat.local",
      address: "12, MG Road, Brigade Road Junction, Bengaluru",
      status: "APPROVED",
      commissionBps: 0,
      subscriptionsEnabled: true,
      approvedAt: new Date(),
    },
    branch: {
      name: "MG Road",
      slug: "main",
      address: "12, MG Road, Brigade Road Junction",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      lat: 12.9716,
      lng: 77.5946,
      deliveryRadiusKm: 12,
      deliveryRatePerKm: 800,
      minDeliveryFee: 2000,
      freeDeliveryAbove: 49900,
      phone: "+918011110001",
      email: "main@haat.local",
    },
    pricePercent: 100,
  },
  {
    vendor: {
      slug: "sharma-dairy",
      shopName: "Sharma Dairy & Kirana",
      description: "Fresh milk every morning, groceries and daily needs.",
      phone: "+919876500001",
      email: "sharma.dairy@haat.local",
      address: "45, Hebbal Flyover Road, Hebbal, Bengaluru",
      status: "APPROVED",
      commissionBps: 800,
      subscriptionsEnabled: true,
      approvedAt: new Date(),
    },
    branch: {
      name: "Hebbal",
      slug: "north",
      address: "45, Hebbal Flyover Road, Hebbal",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560024",
      lat: 13.035,
      lng: 77.5972,
      deliveryRadiusKm: 10,
      deliveryRatePerKm: 600,
      minDeliveryFee: 1500,
      opensAt: "06:00",
      closesAt: "22:00",
      phone: "+918011110002",
    },
    owner: { name: "Ramesh Sharma", email: "vendor.sharma@haat.local", phone: "9876500001" },
    categories: GROCERY,
    pricePercent: 96,
    plans: [
      {
        productSlug: "milk",
        name: "Morning milk",
        description: "Fresh milk at your door before 8 am.",
        quantityPerDelivery: 1,
        slots: ["6-7 am", "7-8 am"],
        weekly: { pricePercent: 98, deliveryFee: 500, mode: "PER_DELIVERY" },
        monthly: { pricePercent: 92, deliveryFee: 0, mode: "PER_PERIOD" },
      },
      {
        productSlug: "curd",
        name: "Daily curd",
        description: "Set curd delivered with your milk.",
        quantityPerDelivery: 1,
        slots: ["6-7 am", "7-8 am"],
        weekly: { pricePercent: 100, deliveryFee: 500, mode: "PER_DELIVERY" },
        monthly: { pricePercent: 94, deliveryFee: 0, mode: "PER_PERIOD" },
      },
    ],
  },
  {
    vendor: {
      slug: "green-basket",
      shopName: "Green Basket",
      description: "Vegetables and fruit from local farms, packed daily.",
      phone: "+919876500002",
      email: "green.basket@haat.local",
      address: "78, Banashankari 2nd Stage, Bengaluru",
      status: "APPROVED",
      commissionBps: 1000,
      subscriptionsEnabled: true,
      approvedAt: new Date(),
    },
    branch: {
      name: "Banashankari",
      slug: "south",
      address: "78, Banashankari 2nd Stage",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560070",
      lat: 12.9352,
      lng: 77.5552,
      deliveryRadiusKm: 8,
      deliveryRatePerKm: 1000,
      minDeliveryFee: 2500,
      opensAt: "07:00",
      closesAt: "21:00",
      phone: "+918011110003",
    },
    owner: { name: "Lakshmi Rao", email: "vendor.green@haat.local", phone: "9876500002" },
    categories: ["fruits", "vegetables", "dairy-bakery"],
    pricePercent: 104,
    plans: [
      {
        productSlug: "tomato",
        name: "Weekly vegetables: tomato",
        description: "A fresh kilo of tomatoes on your chosen days.",
        quantityPerDelivery: 1,
        slots: ["7-9 am", "5-7 pm"],
        weekly: { pricePercent: 100, deliveryFee: 1000, mode: "PER_DELIVERY" },
        monthly: { pricePercent: 95, deliveryFee: 4900, mode: "PER_PERIOD" },
      },
    ],
  },
  {
    vendor: {
      slug: "new-corner-store",
      shopName: "New Corner Store",
      description: "Signed up and waiting for approval.",
      phone: "+919876500003",
      email: "corner.store@haat.local",
      address: "3, Indiranagar 100 Ft Road, Bengaluru",
      status: "PENDING",
    },
    branch: {
      name: "Indiranagar",
      slug: "indiranagar",
      address: "3, Indiranagar 100 Ft Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560038",
      lat: 12.9784,
      lng: 77.6408,
      deliveryRadiusKm: 5,
    },
    owner: { name: "Arjun Mehta", email: "vendor.corner@haat.local", phone: "9876500003" },
    categories: ["snacks-beverages"],
    pricePercent: 100,
  },
];

const priced = (paise: number, percent: number) => Math.round((paise * percent) / 100 / 100) * 100;

async function upsertListings(branchId: string, seed: VendorSeed) {
  const variants = await prisma.productVariant.findMany({
    where: { isActive: true, product: { isActive: true, ...(seed.categories ? { category: { slug: { in: seed.categories } } } : {}) } },
    select: { id: true, price: true, mrp: true, stock: true },
  });
  for (const variant of variants) {
    const price = Math.min(priced(variant.price, seed.pricePercent), variant.mrp);
    await prisma.branchVariantStock.upsert({
      where: { branchId_variantId: { branchId, variantId: variant.id } },
      update: {},
      create: {
        branchId,
        variantId: variant.id,
        price,
        mrp: variant.mrp,
        // Demo cost: ~75% of the selling price so profit reports have numbers.
        costPrice: Math.round((price * 0.75) / 100) * 100,
        stock: seed.pricePercent === 100 && !seed.categories ? variant.stock : 20 + Math.floor(Math.random() * 120),
        lowStockThreshold: 5,
      },
    });
  }
  return variants.length;
}

async function upsertPlans(vendorId: string, branchId: string, plans: PlanSeed[]) {
  for (const plan of plans) {
    const listing = await prisma.branchVariantStock.findFirst({
      where: { branchId, variant: { product: { slug: plan.productSlug } } },
      orderBy: { price: "asc" },
    });
    if (!listing) continue;
    const exists = await prisma.subscriptionPlan.findFirst({ where: { branchId, name: plan.name } });
    if (exists) continue;
    await prisma.subscriptionPlan.create({
      data: {
        vendorId,
        branchId,
        listingId: listing.id,
        name: plan.name,
        description: plan.description,
        quantityPerDelivery: plan.quantityPerDelivery,
        slots: plan.slots,
        prices: {
          create: [
            { period: "WEEKLY", pricePerDelivery: priced(listing.price, plan.weekly.pricePercent), deliveryFee: plan.weekly.deliveryFee, deliveryFeeMode: plan.weekly.mode },
            { period: "MONTHLY", pricePerDelivery: priced(listing.price, plan.monthly.pricePercent), deliveryFee: plan.monthly.deliveryFee, deliveryFeeMode: plan.monthly.mode },
          ],
        },
      },
    });
  }
}

export async function seedVendors() {
  // Demo vendor logins use the documented test password (docs/TEST_ACCOUNTS.md).
  const passwordHash = await bcrypt.hash(TEST_ACCOUNT_PASSWORD, 10);

  for (const seed of VENDORS) {
    const vendor = await prisma.vendor.upsert({ where: { slug: seed.vendor.slug }, update: {}, create: seed.vendor });
    const branch = await prisma.branch.upsert({
      where: { slug: seed.branch.slug },
      update: {},
      create: { ...seed.branch, vendorId: vendor.id },
    });
    const listings = await upsertListings(branch.id, seed);
    if (seed.plans) await upsertPlans(vendor.id, branch.id, seed.plans);

    if (seed.owner) {
      await prisma.user.upsert({
        where: { email: seed.owner.email },
        update: {},
        create: { ...seed.owner, role: "VENDOR", vendorId: vendor.id, vendorRole: "OWNER", passwordHash },
      });
    }
    console.log(`✓ vendor ${vendor.shopName} (${vendor.status}, ${listings} listings)`);
  }

  // Existing riders work for the platform shop; each demo vendor gets one of its own.
  const platform = await prisma.vendor.findUniqueOrThrow({ where: { slug: "haat" } });
  await prisma.rider.updateMany({ where: { vendorId: null }, data: { vendorId: platform.id } });
  const sharma = await prisma.vendor.findUniqueOrThrow({ where: { slug: "sharma-dairy" } });
  await prisma.rider.upsert({
    where: { phone: "+919844444444" },
    update: {},
    create: { name: "Mohan (milk)", phone: "+919844444444", whatsapp: "+919844444444", vehicleType: "BICYCLE", vendorId: sharma.id },
  });
  await prisma.user.updateMany({ where: { role: "ADMIN", isSuperAdmin: false, email: (process.env.ADMIN_SEED_EMAIL ?? "admin@haat.local").toLowerCase() }, data: { isSuperAdmin: true } });
  console.log("✓ vendor riders, super admin");
}
