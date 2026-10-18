import { Router, type Request, type Response } from "express";
import { idParam, ok, requireUser } from "../../lib/http.js";
import { superAdminOnly } from "../../middleware/auth.js";
import { adminInputSchema, createAdmin, listAdmins, removeAdmin, restoreAdmin } from "./admins.service.js";

const actorOf = (req: Request) => {
  const auth = requireUser(req);
  return { id: auth.userId, role: auth.role };
};

/** Super admin only: /admin/admins */
export const adminAdminsRouter = Router();
adminAdminsRouter.use(superAdminOnly);

adminAdminsRouter.get("/", async (_req: Request, res: Response) => {
  res.json(ok(await listAdmins()));
});

adminAdminsRouter.post("/", async (req: Request, res: Response) => {
  res.status(201).json(ok(await createAdmin(adminInputSchema.parse(req.body), actorOf(req))));
});

adminAdminsRouter.delete("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  await removeAdmin(id, actorOf(req));
  res.status(204).end();
});

adminAdminsRouter.post("/:id/restore", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  await restoreAdmin(id, actorOf(req));
  res.status(204).end();
});
