import { Router, type Request, type Response } from "express";
import { idParam, ok, requireUser } from "../../lib/http.js";
import { adminOnly, authenticate } from "../../middleware/auth.js";
import * as adminService from "./orders.admin.service.js";
import {
  adminNoteSchema,
  adminOrderListQuery,
  assignRiderSchema,
  cancelOrderSchema,
  customerOrderListQuery,
  placeOrderSchema,
  quoteSchema,
  returnRequestSchema,
  updateStatusSchema,
} from "./orders.schema.js";
import * as service from "./orders.service.js";

export const ordersRouter = Router();
ordersRouter.use(authenticate);

ordersRouter.post("/quote", async (req: Request, res: Response) => {
  res.json(ok(await service.quote(requireUser(req).userId, quoteSchema.parse(req.body))));
});

ordersRouter.post("/", async (req: Request, res: Response) => {
  res.status(201).json(ok(await service.placeOrder(requireUser(req).userId, placeOrderSchema.parse(req.body))));
});

ordersRouter.get("/", async (req: Request, res: Response) => {
  const { items, meta } = await service.listOrders(requireUser(req).userId, customerOrderListQuery.parse(req.query));
  res.json(ok(items, meta));
});

ordersRouter.get("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.getOrder(requireUser(req).userId, id)));
});

ordersRouter.post("/:id/cancel", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { reason } = cancelOrderSchema.parse(req.body);
  await service.cancelOrder(requireUser(req).userId, id, reason);
  res.json(ok(await service.getOrder(requireUser(req).userId, id)));
});

ordersRouter.post("/:id/return", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { reason } = returnRequestSchema.parse(req.body);
  await service.requestReturn(requireUser(req).userId, id, reason);
  res.json(ok(await service.getOrder(requireUser(req).userId, id)));
});

export const adminOrdersRouter = Router();
adminOrdersRouter.use(adminOnly);

adminOrdersRouter.get("/", async (req: Request, res: Response) => {
  const { items, meta } = await adminService.listOrdersAdmin(adminOrderListQuery.parse(req.query));
  res.json(ok(items, meta));
});

adminOrdersRouter.get("/status-counts", async (_req: Request, res: Response) => {
  res.json(ok(await adminService.orderStatusCounts()));
});

adminOrdersRouter.get("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await adminService.getOrderAdmin(id)));
});

adminOrdersRouter.patch("/:id/status", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { status, note } = updateStatusSchema.parse(req.body);
  await adminService.updateOrderStatus(id, status, note, { id: requireUser(req).userId, role: "ADMIN" });
  res.json(ok(await adminService.getOrderAdmin(id)));
});

adminOrdersRouter.patch("/:id/assign-rider", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { riderId, note } = assignRiderSchema.parse(req.body);
  res.json(ok(await adminService.assignRider(id, riderId, note, { id: requireUser(req).userId, role: "ADMIN" })));
});

adminOrdersRouter.post("/:id/resend-notifications", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await adminService.resendRiderNotifications(id)));
});

adminOrdersRouter.patch("/:id/note", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { adminNote } = adminNoteSchema.parse(req.body);
  res.json(ok(await adminService.updateAdminNote(id, adminNote)));
});
