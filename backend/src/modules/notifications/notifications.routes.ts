import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { idParam, ok, requireUser } from "../../lib/http.js";
import { paginationQuery } from "../../lib/pagination.js";
import { adminOnly, authenticate } from "../../middleware/auth.js";
import * as service from "./notifications.service.js";

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get("/", async (req: Request, res: Response) => {
  const { items, meta } = await service.listNotifications(requireUser(req).userId, paginationQuery.parse(req.query));
  res.json(ok(items, meta));
});

notificationsRouter.get("/unread-count", async (req: Request, res: Response) => {
  res.json(ok(await service.unreadCount(requireUser(req).userId)));
});

notificationsRouter.post("/read-all", async (req: Request, res: Response) => {
  await service.markAllRead(requireUser(req).userId);
  res.status(204).end();
});

notificationsRouter.post("/:id/read", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  await service.markRead(requireUser(req).userId, id);
  res.status(204).end();
});

const logQuery = paginationQuery.extend({
  status: z.enum(["SENT", "FAILED", "SKIPPED"]).optional(),
  channel: z.enum(["EMAIL", "WHATSAPP"]).optional(),
  orderId: z.string().optional(),
});

export const adminNotificationLogRouter = Router();
adminNotificationLogRouter.use(adminOnly);

adminNotificationLogRouter.get("/", async (req: Request, res: Response) => {
  const { items, meta } = await service.listDeliveryLogs(logQuery.parse(req.query));
  res.json(ok(items, meta));
});
