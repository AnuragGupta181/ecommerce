import type { Request, Response } from "express";
import { ok, requireUser } from "../../lib/http.js";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from "./auth.schema.js";
import * as authService from "./auth.service.js";

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  res.status(201).json(ok(await authService.register(input, req.get("user-agent"))));
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  res.json(ok(await authService.login(input, req.get("user-agent"))));
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = refreshSchema.parse(req.body);
  res.json(ok(await authService.refresh(refreshToken, req.get("user-agent"))));
}

export async function logout(req: Request, res: Response) {
  const { refreshToken } = refreshSchema.parse(req.body);
  await authService.logout(refreshToken);
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  res.json(ok(await authService.me(requireUser(req).userId)));
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = forgotPasswordSchema.parse(req.body);
  await authService.forgotPassword(email);
  res.json(ok({ message: "If an account exists for this email, a reset code has been sent." }));
}

export async function resetPassword(req: Request, res: Response) {
  const { email, otp, password } = resetPasswordSchema.parse(req.body);
  await authService.resetPassword(email, otp, password);
  res.json(ok({ message: "Password updated. Please log in." }));
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  await authService.changePassword(requireUser(req).userId, currentPassword, newPassword);
  res.json(ok({ message: "Password changed" }));
}
