import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { authLimiter } from "../../middleware/rate-limit.js";
import * as controller from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/register", authLimiter, controller.register);
authRouter.post("/login", authLimiter, controller.login);
authRouter.post("/refresh", controller.refresh);
authRouter.post("/logout", controller.logout);
authRouter.get("/me", authenticate, controller.me);
authRouter.post("/password/forgot", authLimiter, controller.forgotPassword);
authRouter.post("/password/reset", authLimiter, controller.resetPassword);
authRouter.post("/password/change", authenticate, controller.changePassword);
