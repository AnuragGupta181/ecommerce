import { Router, type Request, type Response } from "express";
import { idParam, ok, requireUser, requireVendorId } from "../../lib/http.js";
import { adminOnly, authenticate, vendorOnly } from "../../middleware/auth.js";
import { createTicketSchema, replySchema, ticketLevelSchema, ticketListQuery, ticketStatusSchema } from "./tickets.schema.js";
import * as service from "./tickets.service.js";
import type { TicketSide } from "./tickets.service.js";

/** The same thread endpoints for all three sides; who you are decides what you can see. */
function threadRoutes(sideOf: (req: Request) => TicketSide) {
  const router = Router();

  router.get("/", async (req: Request, res: Response) => {
    const { items, meta } = await service.listTickets(sideOf(req), ticketListQuery.parse(req.query));
    res.json(ok(items, meta));
  });

  router.get("/counts", async (req: Request, res: Response) => {
    res.json(ok(await service.myTicketCounts(sideOf(req))));
  });

  router.get("/:id", async (req: Request, res: Response) => {
    const { id } = idParam.parse(req.params);
    res.json(ok(await service.getTicket(sideOf(req), id)));
  });

  router.post("/:id/messages", async (req: Request, res: Response) => {
    const { id } = idParam.parse(req.params);
    const { body } = replySchema.parse(req.body);
    res.status(201).json(ok(await service.reply(sideOf(req), id, body)));
  });

  router.patch("/:id/status", async (req: Request, res: Response) => {
    const { id } = idParam.parse(req.params);
    const { status, note } = ticketStatusSchema.parse(req.body);
    res.json(ok(await service.setStatus(sideOf(req), id, status, note)));
  });

  return router;
}

/** Customer: /tickets */
export const ticketsRouter = Router();
ticketsRouter.use(authenticate);
ticketsRouter.post("/", async (req: Request, res: Response) => {
  res.status(201).json(ok(await service.createTicket(requireUser(req).userId, createTicketSchema.parse(req.body))));
});
ticketsRouter.use(threadRoutes((req) => ({ kind: "CUSTOMER", userId: requireUser(req).userId })));

/** Vendor portal: /vendor/tickets (minor tickets about the shop's own orders and subscriptions) */
export const vendorTicketsRouter = Router();
vendorTicketsRouter.use(vendorOnly);
vendorTicketsRouter.use(threadRoutes((req) => ({ kind: "VENDOR", vendorId: requireVendorId(req), userId: requireUser(req).userId })));

/** Admin: /admin/tickets (everything) */
export const adminTicketsRouter = Router();
adminTicketsRouter.use(adminOnly);
adminTicketsRouter.patch("/:id/level", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { level } = ticketLevelSchema.parse(req.body);
  res.json(ok(await service.setLevel(requireUser(req).userId, id, level)));
});
adminTicketsRouter.use(threadRoutes((req) => ({ kind: "ADMIN", userId: requireUser(req).userId })));
