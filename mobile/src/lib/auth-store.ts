import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import type { Session, User } from "./types";

const SESSION_KEY = "haat.session";

type AuthState = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** False until the persisted session has been read on launch. */
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (session: Session) => Promise<void>;
  setUser: (user: User) => void;
  clear: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(SESSION_KEY);
      if (raw) {
        const session = JSON.parse(raw) as Session;
        set({ user: session.user, accessToken: session.accessToken, refreshToken: session.refreshToken });
      }
    } finally {
      set({ hydrated: true });
    }
  },

  setSession: async (session) => {
    set({ user: session.user, accessToken: session.accessToken, refreshToken: session.refreshToken });
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  },

  setUser: (user) => set({ user }),

  clear: async () => {
    set({ user: null, accessToken: null, refreshToken: null });
    await SecureStore.deleteItemAsync(SESSION_KEY);
  },
}));
