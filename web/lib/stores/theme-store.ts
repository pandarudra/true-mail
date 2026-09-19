import { create } from "zustand";

type ThemeState = {
  isDark: boolean;
  // Called once on mount to pick up the class the blocking inline script in
  // layout.tsx already applied before paint — keeps the store's default
  // (false) safe for the server/first-client render, no hydration mismatch.
  syncFromDom: () => void;
  toggle: () => void;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: false,

  syncFromDom() {
    const isDark = document.documentElement.classList.contains("dark");
    if (isDark !== get().isDark) set({ isDark });
  },

  toggle() {
    const next = !get().isDark;
    set({ isDark: next });
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // storage unavailable (private browsing) — toggle still works for this session
    }
  },
}));
