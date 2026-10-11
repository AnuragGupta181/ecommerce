import { Router } from "express";
import { adminOnly } from "../../middleware/auth.js";
import * as controller from "./settings.controller.js";

export const settingsRouter = Router();
settingsRouter.get("/", controller.getPublic);

export const adminSettingsRouter = Router();
adminSettingsRouter.use(adminOnly);
adminSettingsRouter.get("/", controller.getAdmin);
adminSettingsRouter.patch("/", controller.update);
