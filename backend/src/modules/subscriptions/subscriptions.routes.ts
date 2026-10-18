import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { idParam, ok, requireUser, requireVendorId } from "../../lib/http.js";
import { paginationQuery } from "../../lib/pagination.js";
import { authenticate, optionalAuth, vendorOnly } from "../../middleware/auth.js";
import { requestPoint } from "../geo/geo.js";
import { getRider } from "../riders/riders.service.js";
import { tradingForWrites } from "../vendors/vendor-guard.js";
import * as plans from "./plans.service.js";
import * as ops from "./subscription-ops.service.js";
import {
  assignSubscriptionRiderSchema,
  cancelSchema,
  deliveriesQuery,
  markDeliveredSchema,
  markMissedSchema,
  pauseSchema,
  paymentSchema,
  planInputSchema,
  plansQuery,
  planUpdateSchema,
  skipSchema,
  subscribeSchema,
  subscriptionQuoteSchema,
  vendorSubscriptionQuery,
} from "./subscriptions.schema.js";
import * as service from "./subscriptions.service.js";

const actorOf = (req: Request) => {
  const auth = requireUser(req);
  return { id: auth.userId, role: auth.role, vendorId: auth.vendorId };
};

/** Public: /plans — "daily essentials" near the shopper. */
export const plansRouter = Router();
plansRouter.use(optionalAuth);

plansRouter.get("/", async (req: Request, res: Response) => {
  const { items, meta } = await plans.listPublicPlans(requestPoint(req), plansQuery.parse(req.query));
  res.json(ok(items, meta));
});

plansRouter.get("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await plans.getPublicPlan(id, requestPoint(req))));
});

/** Customer: /subscriptions */
export const subscriptionsRouter = Router();
subscriptionsRouter.use(authenticate);

subscriptionsRouter.post("/quote", async (req: Request, res: Response) => {
  res.json(ok(await service.quote(requireUser(req).userId, subscriptionQuoteSchema.parse(req.body))));
});

subscriptionsRouter.post("/", async (req: Request, res: Response) => {
  res.status(201).json(ok(await service.subscribe(requireUser(req).userId, subscribeSchema.parse(req.body))));
});

subscriptionsRouter.get("/", async (req: Request, res: Response) => {
  const { items, meta } = await service.listMySubscriptions(requireUser(req).userId, paginationQuery.parse(req.query));
  res.json(ok(items, meta));
});

subscriptionsRouter.get("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.getMySubscription(requireUser(req).userId, id)));
});

subscriptionsRouter.post("/:id/skip", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { date, skip } = skipSchema.parse(req.body);
  res.json(ok(await service.setSkip(requireUser(req).userId, id, date, skip)));
});

subscriptionsRouter.post("/:id/pauses", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { fromDate, toDate } = pauseSchema.parse(req.body);
  res.json(ok(await service.pause(requireUser(req).userId, id, fromDate, toDate)));
});

subscriptionsRouter.delete("/:id/pauses/:pauseId", async (req: Request, res: Response) => {
  const { id, pauseId } = z.object({ id: z.string().min(1), pauseId: z.string().min(1) }).parse(req.params);
  res.json(ok(await service.removePause(requireUser(req).userId, id, pauseId)));
});

subscriptionsRouter.post("/:id/cancel", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { reason } = cancelSchema.parse(req.body);
  res.json(ok(await service.cancel(requireUser(req).userId, id, reason)));
});

subscriptionsRouter.post("/:id/renew", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.status(201).json(ok(await service.renew(requireUser(req).userId, id)));
});

/** Vendor portal: /vendor/plans, /vendor/subscriptions, /vendor/deliveries */
export const vendorPlansRouter = Router();
vendorPlansRouter.use(vendorOnly);
vendorPlansRouter.use(tradingForWrites);

vendorPlansRouter.get("/", async (req: Request, res: Response) => {
  res.json(ok(await plans.listVendorPlans(requireVendorId(req))));
});

vendorPlansRouter.post("/", async (req: Request, res: Response) => {
  res.status(201).json(ok(await plans.createPlan(requireVendorId(req), planInputSchema.parse(req.body), actorOf(req))));
});

vendorPlansRouter.patch("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await plans.updatePlan(requireVendorId(req), id, planUpdateSchema.parse(req.body), actorOf(req))));
});

vendorPlansRouter.delete("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await plans.deletePlan(requireVendorId(req), id, actorOf(req))));
});

export const vendorSubscriptionsRouter = Router();
vendorSubscriptionsRouter.use(vendorOnly);
vendorSubscriptionsRouter.use(tradingForWrites);

vendorSubscriptionsRouter.get("/", async (req: Request, res: Response) => {
  const { items, meta } = await ops.listVendorSubscriptions(requireVendorId(req), vendorSubscriptionQuery.parse(req.query));
  res.json(ok(items, meta));
});

vendorSubscriptionsRouter.get("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await ops.getVendorSubscription(requireVendorId(req), id)));
});

vendorSubscriptionsRouter.post("/:id/payments", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.status(201).json(ok(await ops.recordPayment(requireVendorId(req), id, paymentSchema.parse(req.body), actorOf(req))));
});

vendorSubscriptionsRouter.patch("/:id/rider", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { riderId } = assignSubscriptionRiderSchema.parse(req.body);
  res.json(ok(await ops.assignSubscriptionRider(requireVendorId(req), id, riderId, actorOf(req))));
});

export const vendorDeliveriesRouter = Router();
vendorDeliveriesRouter.use(vendorOnly);
vendorDeliveriesRouter.use(tradingForWrites);

vendorDeliveriesRouter.get("/", async (req: Request, res: Response) => {
  const { date, branchId } = deliveriesQuery.parse(req.query);
  res.json(ok(await ops.deliveriesForDate(requireVendorId(req), date, branchId)));
});

vendorDeliveriesRouter.post("/delivered", async (req: Request, res: Response) => {
  const { ids } = markDeliveredSchema.parse(req.body);
  const actor = actorOf(req);
  res.json(ok(await ops.markDelivered({ vendorId: requireVendorId(req) }, ids, { id: actor.id, label: "shop" })));
});

vendorDeliveriesRouter.post("/:id/missed", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { note } = markMissedSchema.parse(req.body);
  await ops.markMissed(requireVendorId(req), id, note, actorOf(req));
  res.status(204).end();
});

vendorDeliveriesRouter.post("/riders/:id/send-link", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const rider = await getRider(id, { vendorId: requireVendorId(req) });
  res.json(ok(await ops.sendRiderScheduleLink(rider.id)));
});

/** Rider (no login, private token): /rider-schedule/:token */
export const riderScheduleRouter = Router();
const tokenParam = z.object({ token: z.string().min(20).max(200) });

riderScheduleRouter.get("/:token", async (req: Request, res: Response) => {
  const { token } = tokenParam.parse(req.params);
  const { date } = deliveriesQuery.parse(req.query);
  res.json(ok(await ops.riderSchedule(token, date)));
});

riderScheduleRouter.post("/:token/deliveries/:id/delivered", async (req: Request, res: Response) => {
  const { token } = tokenParam.parse(req.params);
  const { id } = idParam.parse(req.params);
  res.json(ok(await ops.riderMarkDelivered(token, id)));
});
