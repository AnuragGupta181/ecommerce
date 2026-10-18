export type DocumentKind = "invoice" | "statement" | "receipt";

/**
 * The backend signs links with its own PUBLIC_URL, which is often `localhost` in dev and
 * unreachable from a phone. The token is what matters, so point the link at the API base the
 * app already reaches.
 */
export function reachableDocumentUrl(signedUrl: string, apiUrl: string): string {
  const match = /[?&]t=([^&#]+)/.exec(signedUrl);
  if (!match) return signedUrl;
  return `${apiUrl.replace(/\/$/, "")}/documents/download?t=${match[1]}`;
}
