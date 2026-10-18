import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { idParam, ok, requireUser, requireVendorId } from "../../lib/http.js";
import { paginationQuery } from "../../lib/pagination.js";
import { authenticate, vendorOnly } from "../../middleware/auth.js";
import * as service from "./chat.service.js";
import type { ChatSide } from "./chat.service.js";

const messageSchema = z.object({ body: z.string().trim().min(1).max(2000), orderId: z.string().min(1).optional() });
const afterQuery = z.object({ after: z.coerce.date().optional() });

/** Same endpoints for both sides of a conversation; only the side differs. */
function chatRoutes(sideOf: (req: Request) => ChatSide) {
  const router = Router();

  router.get("/", async (req: Request, res: Response) => {
    const { items, meta } = await service.listConversations(sideOf(req), paginationQuery.parse(req.query));
    res.json(ok(items, meta));
  });

  router.get("/unread", async (req: Request, res: Response) => {
    res.json(ok(await service.unreadTotal(sideOf(req))));
  });

  router.get("/:id/messages", async (req: Request, res: Response) => {
    const { id } = idParam.parse(req.params);
    const { after } = afterQuery.parse(req.query);
    res.json(ok(await service.listMessages(sideOf(req), id, after)));
  });

  router.post("/:id/messages", async (req: Request, res: Response) => {
    const { id } = idParam.parse(req.params);
    const { body, orderId } = messageSchema.parse(req.body);
    res.status(201).json(ok(await service.sendMessage(sideOf(req), id, body, orderId)));
  });

  router.post("/:id/read", async (req: Request, res: Response) => {
    const { id } = idParam.parse(req.params);
    await service.markRead(sideOf(req), id);
    res.status(204).end();
  });

  return router;
}

/** Customer: /chat */
export const chatRouter = Router();
chatRouter.use(authenticate);
chatRouter.post("/vendors/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.status(201).json(ok(await service.startChat(requireUser(req).userId, id)));
});
chatRouter.use(chatRoutes((req) => ({ kind: "CUSTOMER", userId: requireUser(req).userId })));

/** Vendor portal: /vendor/messages */
export const vendorChatRouter = Router();
vendorChatRouter.use(vendorOnly);
vendorChatRouter.use(chatRoutes((req) => ({ kind: "VENDOR", vendorId: requireVendorId(req), userId: requireUser(req).userId })));
