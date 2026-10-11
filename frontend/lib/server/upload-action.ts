"use server";

import { runAction } from "./action";
import { api } from "./api";
import { requireAdmin } from "./session";

/** Uploads a catalog image through the API; the file never touches the Next server's disk. */
export async function uploadImage(formData: FormData) {
  await requireAdmin();
  return runAction(() => api.upload<{ url: string; key: string }>("/admin/uploads", formData));
}
