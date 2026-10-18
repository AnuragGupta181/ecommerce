import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { ok } from "../../lib/http.js";
import { paginationQuery } from "../../lib/pagination.js";
import { superAdminOnly } from "../../middleware/auth.js";
import { listAudit } from "./audit.service.js";

const auditQuery = paginationQuery.extend({
  vendorId: z.string().optional(),
  actorId: z.string().optional(),
  entity: z.string().max(40).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

/** Super admin: /admin/audit — who did what. */
export const adminAuditRouter = Router();
adminAuditRouter.use(superAdminOnly);

adminAuditRouter.get("/", async (req: Request, res: Response) => {
  const { items, meta } = await listAudit(auditQuery.parse(req.query));
  res.json(ok(items, meta));
});
