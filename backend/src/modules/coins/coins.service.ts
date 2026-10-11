import type { CoinTransactionType } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { pageMeta, toSkipTake, type PaginationQuery } from "../../lib/pagination.js";
import { prisma, type Db } from "../../lib/prisma.js";

type CoinChange = {
  userId: string;
  /** Signed: positive credits, negative debits. */
  amount: number;
  type: CoinTransactionType;
  orderId?: string;
  note?: string;
};

/** Updates the balance atomically (never below zero) and writes a ledger row. */
export async function changeCoins(db: Db, change: CoinChange) {
  if (change.amount === 0) return;
  const guard = change.amount < 0 ? { coinBalance: { gte: -change.amount } } : {};
  const { count } = await db.user.updateMany({
    where: { id: change.userId, ...guard },
    data: { coinBalance: { increment: change.amount } },
  });
  if (count === 0) throw AppError.badRequest("Not enough coins");

  const { coinBalance } = await db.user.findUniqueOrThrow({ where: { id: change.userId }, select: { coinBalance: true } });
  await db.coinTransaction.create({
    data: {
      userId: change.userId,
      type: change.type,
      amount: change.amount,
      balanceAfter: coinBalance,
      orderId: change.orderId,
      note: change.note,
    },
  });
}

export async function getCoinSummary(userId: string, query: PaginationQuery) {
  const where = { userId };
  const [user, items, total, earned, pending] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { coinBalance: true } }),
    prisma.coinTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...toSkipTake(query),
      include: { order: { select: { orderNumber: true } } },
    }),
    prisma.coinTransaction.count({ where }),
    prisma.coinTransaction.aggregate({ where: { userId, amount: { gt: 0 } }, _sum: { amount: true } }),
    // Coins promised on orders that haven't been delivered yet.
    prisma.order.aggregate({
      where: { userId, status: { in: ["PLACED", "CONFIRMED", "PACKED", "RIDER_ASSIGNED", "OUT_FOR_DELIVERY"] } },
      _sum: { coinsToEarn: true },
    }),
  ]);
  return {
    balance: user.coinBalance,
    lifetimeEarned: earned._sum.amount ?? 0,
    pending: pending._sum.coinsToEarn ?? 0,
    history: items.map(({ order, ...txn }) => ({ ...txn, orderNumber: order?.orderNumber ?? null })),
    meta: pageMeta(query, total),
  };
}

export async function adminAdjustCoins(userId: string, amount: number, note: string) {
  await prisma.$transaction((tx) => changeCoins(tx, { userId, amount, type: "ADJUST", note }));
  return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, coinBalance: true } });
}
