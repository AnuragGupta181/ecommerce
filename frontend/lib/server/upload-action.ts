"use server";

import { runAction } from "./action";
import { api } from "./api";
import { requireAdmin, requireVendor } from "./session";

/** Uploads a catalog image through the API; the file never touches the Next server's disk. */
export async function uploadImage(formData: FormData) {
  await requireAdmin();
  return runAction(() => api.upload<{ url: string; key: string }>("/admin/uploads", formData));
}

/** Shop photos, logos and ID proofs go to the shop's own upload endpoint. */
export async function uploadVendorImage(formData: FormData) {
  await requireVendor();
  return runAction(() => api.upload<{ url: string; key: string }>("/vendor/uploads", formData));
}
