import { Router, type Request, type Response } from "express";
import { idParam, ok, requireUser } from "../../lib/http.js";
import { authenticate } from "../../middleware/auth.js";
import { addressInputSchema, addressUpdateSchema } from "./addresses.schema.js";
import * as service from "./addresses.service.js";

export const addressesRouter = Router();
addressesRouter.use(authenticate);

addressesRouter.get("/", async (req: Request, res: Response) => {
  res.json(ok(await service.listAddresses(requireUser(req).userId)));
});

addressesRouter.post("/", async (req: Request, res: Response) => {
  const input = addressInputSchema.parse(req.body);
  res.status(201).json(ok(await service.createAddress(requireUser(req).userId, input)));
});

addressesRouter.patch("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const input = addressUpdateSchema.parse(req.body);
  res.json(ok(await service.updateAddress(requireUser(req).userId, id, input)));
});

addressesRouter.post("/:id/default", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.updateAddress(requireUser(req).userId, id, { isDefault: true })));
});

addressesRouter.delete("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  await service.deleteAddress(requireUser(req).userId, id);
  res.status(204).end();
});
