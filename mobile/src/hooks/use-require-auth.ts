import { useCallback } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { useLoginPrompt } from "@/lib/login-prompt";

/**
 * Guests can browse everything; protected actions (cart, wishlist, checkout) go through `guard`.
 * A guest sees the login sheet instead, and the action resumes after they sign in.
 */
export function useRequireAuth() {
  const isLoggedIn = useAuthStore((state) => state.user !== null);
  const prompt = useLoginPrompt((state) => state.prompt);

  const guard = useCallback(
    (action: () => void, message = "Login to continue") => {
      if (useAuthStore.getState().user) action();
      else prompt(message, action);
    },
    [prompt],
  );

  return { isLoggedIn, guard };
}
