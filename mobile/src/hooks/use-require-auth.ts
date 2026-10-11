import { router } from "expo-router";
import { useCallback } from "react";
import { useAuthStore } from "@/lib/auth-store";

/**
 * Guests can browse everything; protected actions (cart, wishlist, checkout) go through `guard`.
 * A guest is sent to the login screen instead of running the action.
 */
export function useRequireAuth() {
  const isLoggedIn = useAuthStore((state) => state.user !== null);

  const guard = useCallback(
    (action: () => void) => {
      if (isLoggedIn) action();
      else router.push("/login");
    },
    [isLoggedIn],
  );

  return { isLoggedIn, guard };
}
