import { Router, type Request, type Response } from "express";
import { ok } from "../../lib/http.js";
import { optionalAuth } from "../../middleware/auth.js";
import { requestPoint } from "../geo/geo.js";
import { getHomeFeed } from "./home.service.js";

export const homeRouter = Router();

homeRouter.get("/", optionalAuth, async (req: Request, res: Response) => {
  res.json(ok(await getHomeFeed(req.auth?.userId, requestPoint(req))));
});
