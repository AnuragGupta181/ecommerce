import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ApiError, fetchFile } from "./api";

/**
 * Streams a backend PDF or workbook to the browser. Only allow-listed paths pass,
 * so the route can never be used to reach arbitrary backend endpoints with the session token.
 */
export async function streamDownload(request: NextRequest, allowed: RegExp[]): Promise<NextResponse> {
  const params = new URL(request.url).searchParams;
  const path = params.get("path") ?? "";
  if (!allowed.some((pattern) => pattern.test(path))) return NextResponse.json({ error: "Not allowed" }, { status: 400 });

  const query: Record<string, string> = {};
  for (const [key, value] of params) if (key !== "path") query[key] = value;

  try {
    const res = await fetchFile(path, query);
    const headers = new Headers();
    for (const name of ["content-type", "content-disposition", "content-length"]) {
      const value = res.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new NextResponse(res.body, { status: 200, headers });
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Could not download the file";
    return new NextResponse(message, { status: error instanceof ApiError ? error.status : 500, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
}

export const DOCUMENT_PATH = /^\/documents\/(invoice|statement|receipt|payout|bill)\/[A-Za-z0-9_-]+$/;

