import { create } from "zustand";

type LoginPromptState = {
  visible: boolean;
  message: string;
  /** The action a guest tried; it runs once they sign in. */
  pending: (() => void) | null;
  prompt: (message: string, action: () => void) => void;
  dismiss: () => void;
  resume: () => void;
};

export const useLoginPrompt = create<LoginPromptState>((set, get) => ({
  visible: false,
  message: "",
  pending: null,
  prompt: (message, action) => set({ visible: true, message, pending: action }),
  dismiss: () => set({ visible: false, pending: null }),
  resume: () => {
    const action = get().pending;
    set({ visible: false, pending: null });
    action?.();
  },
}));
