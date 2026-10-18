import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { put } from "@vercel/blob";
import { env } from "../config/env.js";
import { randomToken } from "../lib/crypto.js";

export type StoredFile = { url: string; key: string };

export interface StorageDriver {
  save(buffer: Buffer, extension: string, folder: string): Promise<StoredFile>;
}

const CONTENT_TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };

/** folder/2026/10/<random>.ext — unguessable, and grouped by month for housekeeping. */
function objectKey(extension: string, folder: string) {
  const now = new Date();
  return path.posix.join(folder, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, "0"), `${randomToken(12)}.${extension}`);
}

/** Development: the local uploads directory, served at /uploads. */
class LocalStorageDriver implements StorageDriver {
  async save(buffer: Buffer, extension: string, folder: string): Promise<StoredFile> {
    const key = objectKey(extension, folder);
    const absolute = path.resolve(env.UPLOAD_DIR, key);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, buffer);
    return { key, url: `${env.PUBLIC_URL.replace(/\/$/, "")}/uploads/${key}` };
  }
}

/** Cloudinary signed upload (works from any host). Configured by CLOUDINARY_URL. */
class CloudinaryDriver implements StorageDriver {
  private config() {
    const raw = env.CLOUDINARY_URL;
    const match = raw ? /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(raw) : null;
    if (!match || match[1]!.includes("<") || match[2]!.includes("<")) {
      throw new Error("CLOUDINARY_URL is missing or still has placeholder credentials (cloudinary://<api_key>:<api_secret>@<cloud_name>)");
    }
    return { apiKey: match[1]!, apiSecret: match[2]!, cloudName: match[3]! };
  }

  async save(buffer: Buffer, extension: string, folder: string): Promise<StoredFile> {
    const { apiKey, apiSecret, cloudName } = this.config();
    const publicId = objectKey(extension, folder).replace(/\.[^.]+$/, "");
    const timestamp = String(Math.floor(Date.now() / 1000));
    // Signature: SHA-1 of the alphabetically sorted signed params followed by the secret.
    const signature = createHash("sha1").update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`).digest("hex");
    const form = new FormData();
    form.append("file", `data:${CONTENT_TYPES[extension] ?? "application/octet-stream"};base64,${buffer.toString("base64")}`);
    form.append("public_id", publicId);
    form.append("timestamp", timestamp);
    form.append("api_key", apiKey);
    form.append("signature", signature);
    const resource = extension === "pdf" ? "raw" : "image";
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resource}/upload`, { method: "POST", body: form, signal: AbortSignal.timeout(20_000) });
    const json = (await res.json().catch(() => null)) as { secure_url?: string; public_id?: string; error?: { message?: string } } | null;
    if (!res.ok || !json?.secure_url) throw new Error(`Cloudinary upload failed: ${json?.error?.message ?? res.status}`);
    return { key: json.public_id ?? publicId, url: json.secure_url };
  }
}

/** Vercel (serverless, read-only disk): Vercel Blob. */
class VercelBlobDriver implements StorageDriver {
  async save(buffer: Buffer, extension: string, folder: string): Promise<StoredFile> {
    const key = objectKey(extension, folder);
    const blob = await put(key, buffer, { access: "public", contentType: CONTENT_TYPES[extension], token: env.BLOB_READ_WRITE_TOKEN });
    return { key: blob.pathname, url: blob.url };
  }
}

/** Render / AWS: any S3-compatible bucket (AWS S3, Cloudflare R2, Backblaze B2 …). */
class S3StorageDriver implements StorageDriver {
  private readonly client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: Boolean(env.S3_ENDPOINT),
    credentials: env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY } : undefined,
  });

  async save(buffer: Buffer, extension: string, folder: string): Promise<StoredFile> {
    if (!env.S3_BUCKET || !env.S3_PUBLIC_URL) throw new Error("S3_BUCKET and S3_PUBLIC_URL are required for the s3 storage driver");
    const key = objectKey(extension, folder);
    await this.client.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: buffer, ContentType: CONTENT_TYPES[extension], CacheControl: "public, max-age=31536000, immutable" }));
    return { key, url: `${env.S3_PUBLIC_URL.replace(/\/$/, "")}/${key}` };
  }
}

function createDriver(): StorageDriver {
  switch (env.STORAGE_DRIVER) {
    case "cloudinary":
      return new CloudinaryDriver();
    case "vercel-blob":
      return new VercelBlobDriver();
    case "s3":
      return new S3StorageDriver();
    case "local":
      return new LocalStorageDriver();
  }
}

export const storage: StorageDriver = createDriver();
