import { create } from "zustand";

export type AppRole = "guest" | "host";

type AppState = {
  /** Which app surface the user is currently viewing (for accounts that are both). */
  activeRole: AppRole;
  setActiveRole: (role: AppRole) => void;
};

export const useAppStore = create<AppState>((set) => ({
  activeRole: "guest",
  setActiveRole: (activeRole) => set({ activeRole }),
}));
