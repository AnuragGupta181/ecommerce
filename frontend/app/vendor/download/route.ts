import type { NextRequest } from "next/server";
import { DOCUMENT_PATH, streamDownload } from "@/lib/server/download";
import { requireVendor } from "@/lib/server/session";

export async function GET(request: NextRequest) {
  await requireVendor();
  return streamDownload(request, [DOCUMENT_PATH, /^\/vendor\/reports\/export$/]);
}
