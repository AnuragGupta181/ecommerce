import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ApiError } from "./api";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

function toFieldErrors(details: unknown): Record<string, string> | undefined {
  if (!Array.isArray(details)) return undefined;
  const errors: Record<string, string> = {};
  for (const issue of details) {
    if (issue && typeof issue.path === "string" && typeof issue.message === "string") errors[issue.path] ??= issue.message;
  }
  return Object.keys(errors).length ? errors : undefined;
}

/** Turns backend failures into a result a form can render; redirect() and notFound() still propagate. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false, message: error.message, fieldErrors: toFieldErrors(error.details) };
    }
    console.error(error);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}
