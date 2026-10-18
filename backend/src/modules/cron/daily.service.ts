import { env } from "../../config/env.js";
import { formatINR } from "../../lib/money.js";
import { prisma } from "../../lib/prisma.js";
import { createInAppNotification, sendNotice } from "../../services/notify/index.js";
import { addDays, todayIST } from "../pricing/subscription.js";
import { loadLedger } from "../subscriptions/ledger.js";
import { toDbDate } from "../subscriptions/subscription-dates.js";

/**
 * The once-a-day job (Vercel Cron, 18:00 IST). Each part is independent and idempotent per day,
 * so a retry or a manual run never double-charges anything; at worst a reminder repeats.
 */
export async function runDaily(now = new Date()) {
  const today = todayIST(now);
  const tomorrow = addDays(today, 1);
  const [reminders, stockWarnings, instalmentReminders, completed] = await Promise.all([
    remindTomorrowsDeliveries(tomorrow),
    warnStockForTomorrow(tomorrow),
    remindInstalments(tomorrow),
    completeFinishedSubscriptions(today),
  ]);
  return { today, tomorrow, reminders, stockWarnings, instalmentReminders, completed };
}

async function remindTomorrowsDeliveries(tomorrow: string) {
  const rows = await prisma.subscriptionDelivery.findMany({
    where: { date: toDbDate(tomorrow), status: "SCHEDULED", subscription: { status: "ACTIVE" } },
    select: {
      quantity: true,
      subscription: { select: { slot: true, user: { select: { id: true, name: true, email: true } }, plan: { select: { name: true } }, vendor: { select: { shopName: true } } } },
    },
  });
  const byUser = new Map<string, { user: { id: string; name: string; email: string }; lines: string[] }>();
  for (const row of rows) {
    const entry = byUser.get(row.subscription.user.id) ?? { user: row.subscription.user, lines: [] };
    entry.lines.push(`• ${row.subscription.plan.name} from ${row.subscription.vendor.shopName}${row.subscription.slot ? `, ${row.subscription.slot}` : ""}`);
    byUser.set(row.subscription.user.id, entry);
  }
  for (const { user, lines } of byUser.values()) {
    await Promise.all([
      createInAppNotification(user.id, "SUBSCRIPTION", "Delivery tomorrow", lines.join("\n")),
      sendNotice({
        recipientType: "CUSTOMER",
        to: user.email,
        template: "subscription_reminder",
        subject: "Your deliveries tomorrow",
        heading: `Hi ${user.name}, this is coming tomorrow`,
        lines: [lines.join("\n"), "Not home? Skip the day in the app before 8 pm tonight."],
      }),
    ]);
  }
  return byUser.size;
}

/** Tomorrow's subscription need per listing vs. what the shop has, so the vendor restocks tonight. */
async function warnStockForTomorrow(tomorrow: string) {
  const needs = await prisma.subscriptionDelivery.findMany({
    where: { date: toDbDate(tomorrow), status: "SCHEDULED", subscription: { status: "ACTIVE" } },
    select: { quantity: true, subscription: { select: { vendorId: true, plan: { select: { listingId: true } } } } },
  });
  const needByListing = new Map<string, { vendorId: string; need: number }>();
  for (const row of needs) {
    const key = row.subscription.plan.listingId;
    const entry = needByListing.get(key) ?? { vendorId: row.subscription.vendorId, need: 0 };
    entry.need += row.quantity;
    needByListing.set(key, entry);
  }
  const listings = await prisma.branchVariantStock.findMany({
    where: { id: { in: [...needByListing.keys()] } },
    select: { id: true, stock: true, variant: { select: { label: true, product: { select: { name: true } } } }, branch: { select: { name: true } } },
  });
  const shortByVendor = new Map<string, string[]>();
  for (const listing of listings) {
    const entry = needByListing.get(listing.id)!;
    if (listing.stock >= entry.need) continue;
    const lines = shortByVendor.get(entry.vendorId) ?? [];
    lines.push(`• ${listing.variant.product.name}${listing.variant.label !== "Default" ? ` (${listing.variant.label})` : ""} at ${listing.branch.name}: need ${entry.need}, have ${listing.stock}`);
    shortByVendor.set(entry.vendorId, lines);
  }
  for (const [vendorId, lines] of shortByVendor) {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { email: true, shopName: true } });
    await sendNotice({
      recipientType: "VENDOR",
      to: vendor?.email,
      template: "subscription_stock_warning",
      subject: `Restock for tomorrow's subscriptions (${tomorrow})`,
      heading: `${vendor?.shopName ?? "Your shop"} needs more stock for tomorrow`,
      lines: [lines.join("\n"), `Update stock: ${env.PORTAL_URL}/vendor/stock`],
    });
  }
  return shortByVendor.size;
}

async function remindInstalments(tomorrow: string) {
  const due = await prisma.subscriptionInstalment.findMany({
    where: { dueDate: toDbDate(tomorrow), subscription: { status: "ACTIVE" } },
    select: { amount: true, subscription: { select: { id: true, number: true, user: { select: { name: true, email: true } }, vendor: { select: { shopName: true } } } } },
  });
  let sent = 0;
  for (const instalment of due) {
    const ledger = await loadLedger(prisma, instalment.subscription.id);
    const unpaid = ledger.instalments.find((row) => row.dueDate === tomorrow && row.status !== "PAID");
    if (!unpaid) continue;
    sent += 1;
    await sendNotice({
      recipientType: "CUSTOMER",
      to: instalment.subscription.user.email,
      template: "subscription_instalment_due",
      subject: `Payment due tomorrow for ${instalment.subscription.number}`,
      heading: `${formatINR(unpaid.amount)} is due tomorrow`,
      lines: [`For your subscription with ${instalment.subscription.vendor.shopName}.`, "Pay the shop or your delivery partner in cash or UPI."],
    });
  }
  return sent;
}

async function completeFinishedSubscriptions(today: string) {
  const { count } = await prisma.subscription.updateMany({ where: { status: "ACTIVE", endDate: { lt: toDbDate(today) } }, data: { status: "COMPLETED" } });
  return count;
}
