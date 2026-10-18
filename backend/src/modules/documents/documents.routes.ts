import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { ok, requireUser } from "../../lib/http.js";
import { authenticate } from "../../middleware/auth.js";
import { buildDocument, documentLink, downloadWithToken, type DocumentScope } from "./documents.service.js";

const kindParam = z.object({ kind: z.enum(["invoice", "statement", "receipt", "payout", "bill"]), id: z.string().min(1) });

/** The caller's rights: their own records, their shop's records, or everything for admins. */
function scopeOf(req: Request): DocumentScope {
  const auth = requireUser(req);
  if (auth.role === "ADMIN") return { admin: true };
  if (auth.role === "VENDOR") return { vendorId: auth.vendorId };
  return { userId: auth.userId };
}

function sendPdf(res: Response, file: { filename: string; buffer: Buffer }, inline: boolean) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${file.filename}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.end(file.buffer);
}

/** /documents — PDFs for customers, vendors and admins. */
export const documentsRouter = Router();

documentsRouter.get("/download", async (req: Request, res: Response) => {
  const { t } = z.object({ t: z.string().min(10).max(2000) }).parse(req.query);
  sendPdf(res, await downloadWithToken(t), true);
});

documentsRouter.get("/:kind/:id", authenticate, async (req: Request, res: Response) => {
  const { kind, id } = kindParam.parse(req.params);
  sendPdf(res, await buildDocument(kind, id, scopeOf(req)), false);
});

documentsRouter.post("/:kind/:id/link", authenticate, async (req: Request, res: Response) => {
  const { kind, id } = kindParam.parse(req.params);
  res.json(ok(await documentLink(kind, id, scopeOf(req))));
});
