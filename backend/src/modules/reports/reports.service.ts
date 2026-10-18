import ExcelJS from "exceljs";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { addDays, todayIST } from "../pricing/subscription.js";
import { commissionOn } from "../payouts/settlement.js";
import { loadLedger } from "../subscriptions/ledger.js";
import { fromDbDate, toDbDate } from "../subscriptions/subscription-dates.js";

export const reportQuery = z.object({
  preset: z.enum(["this_week", "this_month", "last_month", "custom"]).default("this_month"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type ReportRange = { from: Date; to: Date; label: string };

/** Ranges are whole IST days; `to` is inclusive. */
export function resolveRange(query: z.infer<typeof reportQuery>, now = new Date()): ReportRange {
  const today = todayIST(now);
  const istStart = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) - 330 * 60_000);
  const istEnd = (iso: string) => new Date(Date.parse(`${addDays(iso, 1)}T00:00:00Z`) - 330 * 60_000 - 1);
  if (query.preset === "custom") {
    if (!query.from || !query.to || query.from > query.to) throw AppError.badRequest("Pick a valid from and to date");
    return { from: query.from, to: query.to, label: `${query.from.toISOString().slice(0, 10)} to ${query.to.toISOString().slice(0, 10)}` };
  }
  if (query.preset === "this_week") {
    const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
    const start = addDays(today, -weekday);
    return { from: istStart(start), to: istEnd(today), label: `Week of ${start}` };
  }
  const [year, month] = today.split("-").map(Number) as [number, number];
  if (query.preset === "this_month") {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    return { from: istStart(start), to: istEnd(today), label: start.slice(0, 7) };
  }
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const start = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
  const end = addDays(`${year}-${String(month).padStart(2, "0")}-01`, -1);
  return { from: istStart(start), to: istEnd(end), label: start.slice(0, 7) };
}

const rupees = (paise: number | null | undefined) => (paise ?? 0) / 100;
const MONEY = '"₹"#,##0.00';

function sheet(workbook: ExcelJS.Workbook, name: string, columns: { header: string; key: string; width?: number; money?: boolean }[]) {
  const ws = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((column) => ({ header: column.header, key: column.key, width: column.width ?? 16, style: column.money ? { numFmt: MONEY } : {} }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC727" } };
  return ws;
}

/** Everything a shop sold in the range, with profit where it set cost prices. */
async function vendorData(vendorId: string, range: ReportRange) {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { shopName: true, commissionBps: true } });
  if (!vendor) throw AppError.notFound("Vendor");
  const delivered = { vendorId, status: "DELIVERED" as const, deliveredAt: { gte: range.from, lte: range.to } };
  const [orders, counterSales, drops, listings, subscriptions, payouts, statusCounts] = await Promise.all([
    prisma.order.findMany({ where: delivered, orderBy: { deliveredAt: "asc" }, include: { items: true, branch: { select: { name: true } } } }),
    prisma.counterSale.findMany({ where: { vendorId, createdAt: { gte: range.from, lte: range.to } }, include: { items: true } }),
    prisma.subscriptionDelivery.findMany({
      where: { status: "DELIVERED", deliveredAt: { gte: range.from, lte: range.to }, subscription: { vendorId } },
      include: { subscription: { select: { number: true, plan: { select: { name: true, listing: { select: { costPrice: true } } } } } } },
    }),
    prisma.branchVariantStock.findMany({
      where: { branch: { vendorId } },
      include: { branch: { select: { name: true } }, variant: { select: { sku: true, label: true, product: { select: { name: true } } } }, stockMovements: { where: { createdAt: { gte: range.from, lte: range.to } }, select: { type: true, quantity: true } } },
    }),
    prisma.subscription.findMany({ where: { vendorId, startDate: { lte: toDbDate(range.to.toISOString().slice(0, 10)) }, endDate: { gte: toDbDate(range.from.toISOString().slice(0, 10)) } }, include: { plan: { select: { name: true } }, user: { select: { name: true } } } }),
    prisma.payout.findMany({ where: { vendorId, createdAt: { gte: range.from, lte: range.to } } }),
    prisma.order.groupBy({ by: ["status"], where: { vendorId, createdAt: { gte: range.from, lte: range.to } }, _count: true }),
  ]);
  return { vendor, orders, counterSales, drops, listings, subscriptions, payouts, statusCounts };
}

export async function vendorWorkbook(vendorId: string, range: ReportRange) {
  const data = await vendorData(vendorId, range);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Haat";

  // Sales lines (online + counter) with profit.
  const salesRows: { date: Date; channel: string; ref: string; product: string; qty: number; price: number; cost: number | null; total: number }[] = [];
  for (const order of data.orders) for (const item of order.items) salesRows.push({ date: order.deliveredAt!, channel: "Online", ref: order.orderNumber, product: `${item.productName} ${item.variantLabel !== "Default" ? item.variantLabel : ""}`.trim(), qty: item.quantity, price: item.price, cost: item.costPrice, total: item.lineTotal });
  for (const sale of data.counterSales) for (const item of sale.items) salesRows.push({ date: sale.createdAt, channel: "Counter", ref: sale.number, product: `${item.productName} ${item.variantLabel !== "Default" ? item.variantLabel : ""}`.trim(), qty: item.quantity, price: item.price, cost: item.costPrice, total: item.lineTotal });
  for (const drop of data.drops) salesRows.push({ date: drop.deliveredAt!, channel: "Subscription", ref: drop.subscription.number, product: drop.subscription.plan.name, qty: drop.quantity, price: drop.quantity ? Math.round(drop.goodsAmount / drop.quantity) : drop.goodsAmount, cost: drop.subscription.plan.listing.costPrice, total: drop.goodsAmount });
  const profitOf = (row: (typeof salesRows)[number]) => (row.cost === null ? null : row.total - row.cost * row.qty);

  const revenue = salesRows.reduce((sum, row) => sum + row.total, 0);
  const profit = salesRows.reduce((sum, row) => sum + (profitOf(row) ?? 0), 0);
  const costMissing = salesRows.filter((row) => row.cost === null).length;
  const onlineGoods = data.orders.reduce((sum, order) => sum + order.itemsTotal, 0);
  const commission = data.orders.reduce((sum, order) => sum + order.commissionAmount, 0) + commissionOn(data.drops.reduce((sum, drop) => sum + drop.goodsAmount, 0), data.vendor.commissionBps);
  const deliveryFees = data.orders.reduce((sum, order) => sum + order.deliveryFee, 0) + data.drops.reduce((sum, drop) => sum + drop.deliveryFee, 0);

  const summary = sheet(workbook, "Summary", [{ header: "Metric", key: "metric", width: 36 }, { header: "Value", key: "value", width: 20 }]);
  const summaryRows: [string, number | string, boolean?][] = [
    ["Shop", data.vendor.shopName],
    ["Period", range.label],
    ["Online orders delivered", data.orders.length],
    ["Counter bills", data.counterSales.length],
    ["Subscription drops delivered", data.drops.length],
    ["Sales (goods)", rupees(revenue), true],
    ["Online goods", rupees(onlineGoods), true],
    ["Delivery fees earned", rupees(deliveryFees), true],
    ["Platform commission", rupees(commission), true],
    ["Gross profit (where cost is known)", rupees(profit), true],
    ["Sale lines without a cost price", costMissing],
    ["Average online order", rupees(data.orders.length ? Math.round(data.orders.reduce((sum, order) => sum + order.payable, 0) / data.orders.length) : 0), true],
    ...data.statusCounts.map((group): [string, number] => [`Orders placed: ${group.status.toLowerCase()}`, group._count]),
  ];
  for (const [metric, value, money] of summaryRows) {
    const row = summary.addRow({ metric, value });
    if (money) row.getCell(2).numFmt = MONEY;
  }

  const sales = sheet(workbook, "Sales", [
    { header: "Date", key: "date", width: 20 },
    { header: "Channel", key: "channel", width: 14 },
    { header: "Reference", key: "ref", width: 22 },
    { header: "Product", key: "product", width: 40 },
    { header: "Qty", key: "qty", width: 8 },
    { header: "Price", key: "price", money: true },
    { header: "Cost", key: "cost", money: true },
    { header: "Line total", key: "total", money: true },
    { header: "Profit", key: "profit", money: true },
  ]);
  for (const row of salesRows) sales.addRow({ ...row, price: rupees(row.price), cost: row.cost === null ? "cost missing" : rupees(row.cost), total: rupees(row.total), profit: profitOf(row) === null ? "" : rupees(profitOf(row)) });

  const best = new Map<string, { product: string; qty: number; revenue: number; profit: number }>();
  for (const row of salesRows) {
    const entry = best.get(row.product) ?? { product: row.product, qty: 0, revenue: 0, profit: 0 };
    entry.qty += row.qty;
    entry.revenue += row.total;
    entry.profit += profitOf(row) ?? 0;
    best.set(row.product, entry);
  }
  const bestSheet = sheet(workbook, "Best sellers", [{ header: "Product", key: "product", width: 40 }, { header: "Units", key: "qty", width: 10 }, { header: "Revenue", key: "revenue", money: true }, { header: "Profit", key: "profit", money: true }]);
  for (const row of [...best.values()].sort((a, b) => b.revenue - a.revenue)) bestSheet.addRow({ ...row, revenue: rupees(row.revenue), profit: rupees(row.profit) });

  const inventory = sheet(workbook, "Inventory", [
    { header: "Branch", key: "branch", width: 18 },
    { header: "SKU", key: "sku", width: 16 },
    { header: "Product", key: "product", width: 40 },
    { header: "Price", key: "price", money: true },
    { header: "Cost", key: "cost", money: true },
    { header: "Stock", key: "stock", width: 10 },
    { header: "Low at", key: "low", width: 10 },
    { header: "Status", key: "status", width: 10 },
    { header: "Stock value", key: "value", money: true },
    { header: "In (period)", key: "in", width: 12 },
    { header: "Out (period)", key: "out", width: 12 },
  ]);
  for (const listing of data.listings) {
    const moved = listing.stockMovements.reduce((acc, move) => (move.quantity > 0 ? { ...acc, in: acc.in + move.quantity } : { ...acc, out: acc.out - move.quantity }), { in: 0, out: 0 });
    inventory.addRow({
      branch: listing.branch.name,
      sku: listing.variant.sku,
      product: `${listing.variant.product.name} ${listing.variant.label !== "Default" ? listing.variant.label : ""}`.trim(),
      price: rupees(listing.price),
      cost: listing.costPrice === null ? "cost missing" : rupees(listing.costPrice),
      stock: listing.stock,
      low: listing.lowStockThreshold,
      status: listing.stock === 0 ? "out" : listing.stock <= listing.lowStockThreshold ? "low" : "ok",
      value: rupees(listing.stock * (listing.costPrice ?? listing.price)),
      ...moved,
    });
  }

  const subs = sheet(workbook, "Subscriptions", [
    { header: "Number", key: "number", width: 22 },
    { header: "Customer", key: "customer", width: 22 },
    { header: "Plan", key: "plan", width: 28 },
    { header: "Period", key: "period", width: 10 },
    { header: "From", key: "from", width: 12 },
    { header: "To", key: "to", width: 12 },
    { header: "Status", key: "status", width: 12 },
    { header: "Charged", key: "charged", money: true },
    { header: "Paid", key: "paid", money: true },
    { header: "Balance", key: "balance", money: true },
  ]);
  for (const subscription of data.subscriptions) {
    const ledger = await loadLedger(prisma, subscription.id);
    subs.addRow({
      number: subscription.number,
      customer: subscription.user.name,
      plan: subscription.plan.name,
      period: subscription.period.toLowerCase(),
      from: fromDbDate(subscription.startDate),
      to: fromDbDate(subscription.endDate),
      status: subscription.status.toLowerCase(),
      charged: rupees(ledger.charged),
      paid: rupees(ledger.paid),
      balance: rupees(ledger.balance),
    });
  }

  const payouts = sheet(workbook, "Settlements", [
    { header: "Number", key: "number", width: 22 },
    { header: "Created", key: "created", width: 20 },
    { header: "Status", key: "status", width: 10 },
    { header: "Gross", key: "gross", money: true },
    { header: "Commission", key: "commission", money: true },
    { header: "Net (+ platform pays you)", key: "net", money: true, width: 26 },
    { header: "Reference", key: "reference", width: 20 },
  ]);
  for (const payout of data.payouts) payouts.addRow({ number: payout.number, created: payout.createdAt, status: payout.status.toLowerCase(), gross: rupees(payout.grossAmount), commission: rupees(payout.commissionAmount), net: rupees(payout.netAmount), reference: payout.reference ?? "" });

  return { filename: `${data.vendor.shopName.replace(/[^a-z0-9]+/gi, "-")}-${range.label}.xlsx`, buffer: Buffer.from(await workbook.xlsx.writeBuffer()) };
}

/** Admin: every vendor side by side for the range. */
export async function platformWorkbook(range: ReportRange) {
  const vendors = await prisma.vendor.findMany({ orderBy: { shopName: "asc" }, select: { id: true, shopName: true, status: true, commissionBps: true } });
  const workbook = new ExcelJS.Workbook();
  const ws = sheet(workbook, "Vendors", [
    { header: "Shop", key: "shop", width: 28 },
    { header: "Status", key: "status", width: 12 },
    { header: "Commission %", key: "rate", width: 14 },
    { header: "Orders delivered", key: "orders", width: 16 },
    { header: "Online sales", key: "sales", money: true },
    { header: "Commission earned", key: "commission", money: true },
    { header: "Counter sales", key: "counter", money: true },
    { header: "Subscription drops", key: "drops", width: 18 },
    { header: "Active subscribers", key: "subscribers", width: 18 },
    { header: "Open tickets", key: "tickets", width: 14 },
    { header: "Low-stock items", key: "low", width: 16 },
    { header: "Cancelled orders", key: "cancelled", width: 16 },
  ]);
  let platformCommission = 0;
  for (const vendor of vendors) {
    const window = { gte: range.from, lte: range.to };
    const [delivered, counter, drops, subscribers, tickets, low, cancelled] = await Promise.all([
      prisma.order.aggregate({ where: { vendorId: vendor.id, status: "DELIVERED", deliveredAt: window }, _count: true, _sum: { itemsTotal: true, commissionAmount: true } }),
      prisma.counterSale.aggregate({ where: { vendorId: vendor.id, createdAt: window }, _sum: { total: true } }),
      prisma.subscriptionDelivery.count({ where: { status: "DELIVERED", deliveredAt: window, subscription: { vendorId: vendor.id } } }),
      prisma.subscription.count({ where: { vendorId: vendor.id, status: "ACTIVE" } }),
      prisma.ticket.count({ where: { vendorId: vendor.id, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      prisma.branchVariantStock.count({ where: { branch: { vendorId: vendor.id }, isAvailable: true, stock: { lte: prisma.branchVariantStock.fields.lowStockThreshold } } }),
      prisma.order.count({ where: { vendorId: vendor.id, status: "CANCELLED", cancelledAt: window } }),
    ]);
    platformCommission += delivered._sum.commissionAmount ?? 0;
    ws.addRow({
      shop: vendor.shopName,
      status: vendor.status.toLowerCase(),
      rate: vendor.commissionBps / 100,
      orders: delivered._count,
      sales: rupees(delivered._sum.itemsTotal),
      commission: rupees(delivered._sum.commissionAmount),
      counter: rupees(counter._sum.total),
      drops,
      subscribers,
      tickets,
      low,
      cancelled,
    });
  }
  const totals = sheet(workbook, "Platform", [{ header: "Metric", key: "metric", width: 32 }, { header: "Value", key: "value", width: 20 }]);
  totals.addRow({ metric: "Period", value: range.label });
  totals.addRow({ metric: "Vendors", value: vendors.length });
  totals.addRow({ metric: "Commission earned (online)", value: rupees(platformCommission) }).getCell(2).numFmt = MONEY;
  return { filename: `haat-platform-${range.label}.xlsx`, buffer: Buffer.from(await workbook.xlsx.writeBuffer()) };
}
