import { Router, type Request, type Response } from "express";
import multer from "multer";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { adminOnly, authenticate } from "../../middleware/auth.js";
import { storage } from "../../services/storage.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_MB * 1024 * 1024, files: 1 },
});

/** Detects the real image type from magic bytes; the client-sent MIME type is not trusted. */
function detectImageExtension(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

async function saveImage(req: Request, folder: string) {
  if (!req.file) throw AppError.badRequest("Attach an image in the 'file' field");
  const extension = detectImageExtension(req.file.buffer);
  if (!extension) throw AppError.badRequest("Only JPEG, PNG or WebP images are allowed");
  return storage.save(req.file.buffer, extension, folder);
}

export const adminUploadsRouter = Router();
adminUploadsRouter.use(adminOnly);

adminUploadsRouter.post("/", upload.single("file"), async (req: Request, res: Response) => {
  res.status(201).json(ok(await saveImage(req, "catalog")));
});

export const uploadsRouter = Router();

uploadsRouter.post("/avatar", authenticate, upload.single("file"), async (req: Request, res: Response) => {
  res.status(201).json(ok(await saveImage(req, "avatars")));
});
