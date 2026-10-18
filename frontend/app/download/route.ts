import type { NextRequest } from "next/server";
import { DOCUMENT_PATH, streamDownload } from "@/lib/server/download";
import { requireAdmin } from "@/lib/server/session";

export async function GET(request: NextRequest) {
  await requireAdmin();
  return streamDownload(request, [DOCUMENT_PATH, /^\/admin\/reports\/platform$/, /^\/admin\/reports\/vendors\/[A-Za-z0-9_-]+$/]);
}
