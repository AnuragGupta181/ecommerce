import { rateLimit } from "express-rate-limit";
import { isTest } from "../config/env.js";

const rateLimited = { error: { code: "RATE_LIMITED", message: "Too many requests, try again later" } };

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => isTest,
  message: rateLimited,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => isTest,
  message: rateLimited,
});
