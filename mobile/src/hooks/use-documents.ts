import { useMutation } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { API_URL, api } from "@/lib/api";
import { reachableDocumentUrl, type DocumentKind } from "@/lib/document-link";

/**
 * PDFs need the session token, which a browser does not have. The API hands out a 15-minute
 * signed link instead, and the system browser opens it (and offers to save or share the PDF).
 */
export function useOpenDocument() {
  return useMutation({
    mutationFn: async ({ kind, id }: { kind: DocumentKind; id: string }) => {
      const { url } = await api.post<{ url: string; expiresInSeconds: number }>(`/documents/${kind}/${id}/link`);
      await WebBrowser.openBrowserAsync(reachableDocumentUrl(url, API_URL));
    },
  });
}
