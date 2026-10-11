import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export const notFoundHandler: RequestHandler = (req) => {
  throw new AppError("NOT_FOUND", `Route ${req.method} ${req.path} not found`);
};

function normalize(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof ZodError) {
    return new AppError(
      "VALIDATION_ERROR",
      error.issues[0]?.message ?? "Invalid input",
      error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = (error.meta?.target as string[] | string | undefined) ?? "field";
      return AppError.conflict(`A record with this ${String(target)} already exists`);
    }
    if (error.code === "P2025") return new AppError("NOT_FOUND", "Record not found");
    if (error.code === "P2003") return AppError.conflict("Record is referenced by other data");
  }

  if (error instanceof multer.MulterError) {
    return AppError.badRequest(error.message);
  }

  if (error instanceof SyntaxError && "body" in error) {
    return AppError.badRequest("Malformed JSON body");
  }

  return new AppError("INTERNAL_ERROR", "Something went wrong");
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const appError = normalize(error);
  if (appError.status >= 500) {
    logger.error({ err: error, path: req.path }, "Unhandled error");
  }
  res.status(appError.status).json({
    error: { code: appError.code, message: appError.message, details: appError.details },
  });
};
