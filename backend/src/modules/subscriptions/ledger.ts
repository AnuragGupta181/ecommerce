import type { Db } from "../../lib/prisma.js";
import { buildLedger, instalmentPlan, todayIST, type Ledger } from "../pricing/subscription.js";
import { fromDbDate, toDbDate } from "./subscription-dates.js";

/** Charged, paid and due for one subscription, from its delivery, payment and instalment rows. */
export async function loadLedger(db: Db, subscriptionId: string): Promise<Ledger> {
  const [subscription, deliveries, paid, instalments] = await Promise.all([
    db.subscription.findUniqueOrThrow({ where: { id: subscriptionId }, select: { deliveryFee: true, deliveryFeeMode: true, paymentPlan: true } }),
    db.subscriptionDelivery.groupBy({ by: ["status"], where: { subscriptionId }, _sum: { goodsAmount: true, deliveryFee: true } }),
    db.subscriptionPayment.aggregate({ where: { subscriptionId }, _sum: { amount: true } }),
    db.subscriptionInstalment.findMany({ where: { subscriptionId }, orderBy: { sequence: "asc" } }),
  ]);
  const sumOf = (status: string) => {
    const row = deliveries.find((group) => group.status === status);
    return (row?._sum.goodsAmount ?? 0) + (row?._sum.deliveryFee ?? 0);
  };
  return buildLedger({
    delivered: sumOf("DELIVERED"),
    scheduled: sumOf("SCHEDULED"),
    periodFee: subscription.deliveryFeeMode === "PER_PERIOD" ? subscription.deliveryFee : 0,
    paid: paid._sum.amount ?? 0,
    instalments: instalments.map((row) => ({ sequence: row.sequence, dueDate: fromDbDate(row.dueDate), amount: row.amount })),
    plan: subscription.paymentPlan,
    today: todayIST(),
  });
}

/** Keeps instalments equal to what will actually be delivered after skips, pauses or a cancel. */
export async function recomputeInstalments(db: Db, subscriptionId: string) {
  const subscription = await db.subscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    select: { startDate: true, endDate: true, paymentPlan: true, deliveryFee: true, deliveryFeeMode: true },
  });
  const rows = await db.subscriptionDelivery.aggregate({
    where: { subscriptionId, status: { in: ["SCHEDULED", "DELIVERED"] } },
    _sum: { goodsAmount: true, deliveryFee: true },
    _count: true,
  });
  const goodsAndFees = (rows._sum.goodsAmount ?? 0) + (rows._sum.deliveryFee ?? 0);
  const periodFee = subscription.deliveryFeeMode === "PER_PERIOD" && rows._count > 0 ? subscription.deliveryFee : 0;
  const plan = instalmentPlan(goodsAndFees + periodFee, subscription.paymentPlan, fromDbDate(subscription.startDate), fromDbDate(subscription.endDate));
  await db.subscriptionInstalment.deleteMany({ where: { subscriptionId } });
  if (plan.length) {
    await db.subscriptionInstalment.createMany({ data: plan.map((row) => ({ subscriptionId, sequence: row.sequence, dueDate: toDbDate(row.dueDate), amount: row.amount })) });
  }
}
