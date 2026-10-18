import type { Request, Response } from "express";
import { ok, publicCache } from "../../lib/http.js";
import { updateSettingsSchema } from "./settings.schema.js";
import * as settingsService from "./settings.service.js";

export async function getPublic(_req: Request, res: Response) {
  publicCache(res);
  res.json(ok(await settingsService.getPublicSettings()));
}

export async function getAdmin(_req: Request, res: Response) {
  res.json(ok(await settingsService.getSettings()));
}

export async function update(req: Request, res: Response) {
  const input = updateSettingsSchema.parse(req.body);
  res.json(ok(await settingsService.updateSettings(input)));
}
