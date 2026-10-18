/**
 * Test accounts with realistic data attached, for trying every flow by hand.
 * Written straight to the database (no service calls), so seeding never sends emails.
 * Idempotent: skipped when the demo customer already exists.
 *
 * Every demo login (including the test super admin) uses TEST_ACCOUNT_PASSWORD, documented in
 * docs/TEST_ACCOUNTS.md. Development databases only.
 */
import bcrypt from "bcryptjs";
import type { Prisma } from "../src/generated/prisma/client.js";
import { prisma } from "../src/lib/prisma.js";
import { addDays, buildSchedule, todayIST } from "../src/modules/pricing/subscription.js";

/** Shared, public test-only password. Never use these accounts on production data. */
export const TEST_ACCOUNT_PASSWORD = "Haat@Test123";

export const DEMO_ACCOUNTS = {
  testSuperAdmin: { name: "Test Super Admin", email: "superadmin.test@haat.local", phone: "+919700000000" },
  staffAdmin: { name: "Neha (Support Admin)", email: "admin.support@haat.local", phone: "+919700000001" },
  vendorStaff: { name: "Vikas (Sharma Dairy staff)", email: "vendor.sharma.staff@haat.local", phone: "+919700000002" },
  priya: { name: "Priya Nair", email: "customer.priya@haat.local", phone: "+919700000003" },
  rahul: { name: "Rahul Verma", email: "customer.rahul@haat.local", phone: "+919700000004" },
} as const;

const toDb = (iso: string) => new Date(`${iso}T00:00:00Z`);
let counter = 0;
const number = (series: string) => `${series}-DEMO-${String(++counter).padStart(4, "0")}`;

async function listingFor(branchSlug: string, productSlug: string) {
  return prisma.branchVariantStock.findFirstOrThrow({
    where: { branch: { slug: branchSlug }, variant: { product: { slug: productSlug } } },
    include: { variant: { include: { product: { include: { images: { take: 1 } } } } }, branch: { include: { vendor: true } } },
  });
}

type Listing = Awaited<ReturnType<typeof listingFor>>;

async function demoOrder(userId: string, address: Prisma.InputJsonObject, listing: Listing, quantity: number, status: "DELIVERED" | "PLACED" | "CONFIRMED", daysAgo: number, riderId?: string) {
  const itemsTotal = listing.price * quantity;
  const itemsMrp = listing.mrp * quantity;
  const deliveryFee = 2000;
  const commissionAmount = Math.round((itemsTotal * listing.branch.vendor.commissionBps) / 10_000);
  const createdAt = new Date(Date.now() - daysAgo * 86_400_000);
  const timeline = status === "DELIVERED" ? (["PLACED", "CONFIRMED", "PACKED", "RIDER_ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED"] as const) : status === "CONFIRMED" ? (["PLACED", "CONFIRMED"] as const) : (["PLACED"] as const);
  return prisma.order.create({
    data: {
      orderNumber: number("HTDEMO"),
      invoiceNumber: number("INV"),
      userId,
      branchId: listing.branchId,
      vendorId: listing.branch.vendorId,
      status,
      paymentMethod: "COD",
      paymentStatus: status === "DELIVERED" ? "PAID" : "PENDING",
      shippingAddress: address,
      itemsMrp,
      itemsTotal,
      deliveryFee,
      payable: itemsTotal + deliveryFee,
      coinsToEarn: Math.floor(itemsTotal / 10_000) * 2,
      coinsEarned: status === "DELIVERED" ? Math.floor(itemsTotal / 10_000) * 2 : 0,
      distanceKm: 1.2,
      commissionBps: listing.branch.vendor.commissionBps,
      commissionAmount,
      vendorEarning: itemsTotal - commissionAmount + deliveryFee,
      riderId: status === "DELIVERED" ? riderId : undefined,
      riderAssignedAt: status === "DELIVERED" ? createdAt : undefined,
      deliveredAt: status === "DELIVERED" ? new Date(createdAt.getTime() + 2 * 3_600_000) : undefined,
      createdAt,
      items: {
        create: {
          productId: listing.variant.productId,
          variantId: listing.variantId,
          productName: listing.variant.product.name,
          variantLabel: listing.variant.label,
          sku: listing.variant.sku,
          imageUrl: listing.variant.product.images[0]?.url,
          mrp: listing.mrp,
          price: listing.price,
          costPrice: listing.costPrice,
          quantity,
          lineTotal: itemsTotal,
        },
      },
      history: { create: timeline.map((step, index) => ({ status: step, actorRole: index === 0 ? "CUSTOMER" : "VENDOR", createdAt: new Date(createdAt.getTime() + index * 600_000) })) },
    },
  });
}

async function demoSubscription(userId: string, address: Prisma.InputJsonObject, branchSlug: string, planName: string, period: "WEEKLY" | "MONTHLY", startDate: string, weekdays: number, riderId?: string) {
  const plan = await prisma.subscriptionPlan.findFirstOrThrow({ where: { name: planName, branch: { slug: branchSlug } }, include: { prices: true } });
  const price = plan.prices.find((row) => row.period === period)!;
  const schedule = buildSchedule(startDate, period, weekdays);
  const today = todayIST();
  const feePerDrop = price.deliveryFeeMode === "PER_DELIVERY" ? price.deliveryFee : 0;
  const subscription = await prisma.subscription.create({
    data: {
      number: number("SUB"),
      userId,
      planId: plan.id,
      vendorId: plan.vendorId,
      branchId: plan.branchId,
      shippingAddress: address,
      period,
      startDate: toDb(schedule.startDate),
      endDate: toDb(schedule.endDate),
      weekdays,
      slot: plan.slots[0],
      quantity: 1,
      pricePerDelivery: price.pricePerDelivery,
      deliveryFee: price.deliveryFee,
      deliveryFeeMode: price.deliveryFeeMode,
      paymentPlan: "END_OF_PERIOD",
      riderId,
      deliveries: {
        create: schedule.dates.map((date) => ({
          date: toDb(date),
          // Past drops were delivered, except one the rider missed, so the ledger has real numbers.
          status: date < today ? (date === addDays(today, -3) ? "MISSED" : "DELIVERED") : "SCHEDULED",
          note: date === addDays(today, -3) ? "Customer not home" : null,
          deliveredAt: date < today && date !== addDays(today, -3) ? new Date(`${date}T01:30:00Z`) : null,
          quantity: plan.quantityPerDelivery,
          goodsAmount: price.pricePerDelivery,
          deliveryFee: feePerDrop,
        })),
      },
      instalments: { create: { sequence: 1, dueDate: toDb(schedule.endDate), amount: schedule.dates.length * (price.pricePerDelivery + feePerDrop) + (price.deliveryFeeMode === "PER_PERIOD" ? price.deliveryFee : 0) } },
    },
  });
  return subscription;
}

/** Keeps every demo login on the documented password, even if an earlier seed used another. */
async function syncDemoPasswords(passwordHash: string) {
  const emails = [...Object.values(DEMO_ACCOUNTS).map((account) => account.email), "vendor.sharma@haat.local", "vendor.green@haat.local", "vendor.corner@haat.local"];
  await prisma.user.updateMany({ where: { email: { in: emails } }, data: { passwordHash, isBlocked: false } });
}

export async function seedDemo() {
  const passwordHash = await bcrypt.hash(TEST_ACCOUNT_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: DEMO_ACCOUNTS.testSuperAdmin.email },
    update: {},
    create: { ...DEMO_ACCOUNTS.testSuperAdmin, role: "ADMIN", isSuperAdmin: true, passwordHash },
  });
  if (await prisma.user.findUnique({ where: { email: DEMO_ACCOUNTS.priya.email } })) {
    await syncDemoPasswords(passwordHash);
    return console.log("• demo accounts exist (passwords synced)");
  }

  const sharma = await prisma.vendor.findUniqueOrThrow({ where: { slug: "sharma-dairy" } });
  await prisma.user.create({ data: { ...DEMO_ACCOUNTS.staffAdmin, role: "ADMIN", passwordHash } });
  await prisma.user.create({ data: { ...DEMO_ACCOUNTS.vendorStaff, role: "VENDOR", vendorId: sharma.id, vendorRole: "STAFF", passwordHash } });
  const priya = await prisma.user.create({ data: { ...DEMO_ACCOUNTS.priya, passwordHash, coinBalance: 40 } });
  const rahul = await prisma.user.create({ data: { ...DEMO_ACCOUNTS.rahul, passwordHash } });

  // Priya lives in Hebbal next to Sharma Dairy; Rahul in Banashankari next to Green Basket.
  const priyaHome = { name: "Priya Nair", phone: "9700000003", line1: "Flat 402, Lake View Apartments", line2: "Hebbal Kempapura", landmark: "Near Esteem Mall", city: "Bengaluru", state: "Karnataka", pincode: "560024", lat: 13.0368, lng: 77.5951 };
  const rahulHome = { name: "Rahul Verma", phone: "9700000004", line1: "21, 3rd Cross", line2: "Banashankari 2nd Stage", landmark: null, city: "Bengaluru", state: "Karnataka", pincode: "560070", lat: 12.9339, lng: 77.5571 };
  await prisma.address.create({ data: { ...priyaHome, userId: priya.id, isDefault: true, type: "HOME" } });
  await prisma.address.create({ data: { ...rahulHome, userId: rahul.id, isDefault: true, type: "HOME" } });

  const mohan = await prisma.rider.findUniqueOrThrow({ where: { phone: "+919844444444" } });
  const milk = await listingFor("north", "milk");
  const curd = await listingFor("north", "curd");
  const tomato = await listingFor("south", "tomato");

  const delivered = await demoOrder(priya.id, priyaHome, curd, 2, "DELIVERED", 6, mohan.id);
  await demoOrder(priya.id, priyaHome, milk, 3, "CONFIRMED", 0);
  const rahulOrder = await demoOrder(rahul.id, rahulHome, tomato, 2, "PLACED", 0);

  const monthStart = addDays(todayIST(), -10);
  const milkSub = await demoSubscription(priya.id, priyaHome, "north", "Morning milk", "MONTHLY", monthStart, 127, mohan.id);
  await prisma.subscriptionPayment.create({ data: { receiptNumber: number("RCPT"), subscriptionId: milkSub.id, amount: 20_000, method: "UPI", note: "Part payment" } });
  await demoSubscription(rahul.id, rahulHome, "south", "Weekly vegetables: tomato", "WEEKLY", addDays(todayIST(), 2), 1 | 4 | 16);

  // Support: a shop-level complaint (minor) and an app bug (major).
  await prisma.ticket.create({
    data: {
      number: number("TKT"),
      userId: priya.id,
      category: "ORDER_ISSUE",
      level: "MINOR",
      subject: "One curd packet was leaking",
      orderId: delivered.id,
      vendorId: sharma.id,
      status: "IN_PROGRESS",
      messages: {
        create: [
          { authorId: priya.id, authorRole: "CUSTOMER", body: "One of the two curd packets was leaking when it arrived." },
          { authorRole: "VENDOR", body: "Sorry about that! We will send a fresh packet with tomorrow's milk." },
        ],
      },
    },
  });
  await prisma.ticket.create({
    data: {
      number: number("TKT"),
      userId: rahul.id,
      category: "APP_BUG",
      level: "MAJOR",
      subject: "Voice search does not start",
      messages: { create: { authorId: rahul.id, authorRole: "CUSTOMER", body: "Tapping the mic does nothing on my phone." } },
    },
  });

  // Chat threads with order system messages, as placing an order would create.
  const thread = await prisma.conversation.create({ data: { userId: priya.id, vendorId: sharma.id, lastMessage: "Can you deliver before 7 tomorrow?", vendorUnread: 1 } });
  await prisma.chatMessage.createMany({
    data: [
      { conversationId: thread.id, senderRole: "SYSTEM", body: `New order ${delivered.orderNumber} placed by Priya Nair.`, orderId: delivered.id },
      { conversationId: thread.id, senderId: priya.id, senderRole: "CUSTOMER", body: "Can you deliver before 7 tomorrow?" },
    ],
  });
  await prisma.conversation.create({
    data: {
      userId: rahul.id,
      vendorId: tomato.branch.vendorId,
      lastMessage: `New order ${rahulOrder.orderNumber} placed by Rahul Verma.`,
      vendorUnread: 1,
      messages: { create: { senderRole: "SYSTEM", body: `New order ${rahulOrder.orderNumber} placed by Rahul Verma.`, orderId: rahulOrder.id } },
    },
  });

  // An in-shop bill and something waiting in Rahul's cart.
  await prisma.counterSale.create({
    data: { number: number("BILL"), vendorId: sharma.id, branchId: milk.branchId, customerName: "Walk-in", total: milk.price * 2, method: "CASH", items: { create: { listingId: milk.id, productName: milk.variant.product.name, variantLabel: milk.variant.label, price: milk.price, costPrice: milk.costPrice, quantity: 2, lineTotal: milk.price * 2 } } },
  });
  await prisma.cartItem.create({ data: { userId: rahul.id, variantId: tomato.variantId, branchId: tomato.branchId, quantity: 1 } });
  await syncDemoPasswords(passwordHash);

  console.log("✓ demo accounts and data (see docs/TEST_ACCOUNTS.md)");
}
