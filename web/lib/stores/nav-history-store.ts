import { create } from "zustand";

// Fallback used when there's no internal previous page to go back to
// (direct entry, or the stack only has the current page). Change this one
// constant to repoint every smart-back call site at once.
export const DEFAULT_FALLBACK_ROUTE = "/inbox";

const STORAGE_KEY = "truemail:nav-history";
const MAX_ENTRIES = 50;

function readStoredStack(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeStoredStack(stack: string[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stack));
  } catch {
    // storage unavailable (private browsing) — history tracking degrades to in-memory only
  }
}

type NavHistoryState = {
  stack: string[];
  // Called once on mount to pick up whatever this tab already recorded
  // before a refresh, mirroring theme-store's syncFromDom pattern.
  hydrate: () => void;
  // Records a path the app just navigated to. No-ops on immediate repeats
  // so effect re-runs (e.g. re-renders that don't change the path) don't
  // grow the stack.
  track: (path: string) => void;
  // Drops the current top of the stack and returns what's now on top (the
  // previous internal page), or null if there wasn't one.
  pop: () => string | null;
};

export const useNavHistoryStore = create<NavHistoryState>((set, get) => ({
  stack: [],

  hydrate() {
    set({ stack: readStoredStack() });
  },

  track(path) {
    const { stack } = get();
    if (stack[stack.length - 1] === path) return;
    const next = [...stack, path].slice(-MAX_ENTRIES);
    set({ stack: next });
    writeStoredStack(next);
  },

  pop() {
    const { stack } = get();
    if (stack.length <= 1) return null;
    const next = stack.slice(0, -1);
    set({ stack: next });
    writeStoredStack(next);
    return next[next.length - 1] ?? null;
  },
}));
