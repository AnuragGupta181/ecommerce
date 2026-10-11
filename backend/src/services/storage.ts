import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { randomToken } from "../lib/crypto.js";

export type StoredFile = { url: string; key: string };

export interface StorageDriver {
  save(buffer: Buffer, extension: string, folder: string): Promise<StoredFile>;
}

/** Writes to the local uploads directory served at /uploads. Swap for an S3/R2 driver in production. */
class LocalStorageDriver implements StorageDriver {
  async save(buffer: Buffer, extension: string, folder: string): Promise<StoredFile> {
    const now = new Date();
    const relativeDir = path.posix.join(folder, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, "0"));
    const fileName = `${randomToken(12)}.${extension}`;
    const absoluteDir = path.resolve(env.UPLOAD_DIR, relativeDir);
    await mkdir(absoluteDir, { recursive: true });
    await writeFile(path.join(absoluteDir, fileName), buffer);
    const key = path.posix.join(relativeDir, fileName);
    return { key, url: `${env.PUBLIC_URL.replace(/\/$/, "")}/uploads/${key}` };
  }
}

export const storage: StorageDriver = new LocalStorageDriver();
