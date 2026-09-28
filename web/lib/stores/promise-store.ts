import { create } from "zustand";
import { readError } from "@/lib/api-error";
import type { RecurrenceInput } from "@/lib/stores/task-store";

export type PromiseDirection = "INCOMING" | "OUTGOING";
export type PromiseStoredStatus = "ACTIVE" | "FULFILLED" | "DISMISSED";
export type DerivedPromiseStatus = "ACTIVE" | "DUE_SOON" | "OVERDUE" | "FULFILLED" | "DISMISSED";

export type PromiseRecord = {
  id: string;
  direction: PromiseDirection;
  personName: string | null;
  personEmail: string | null;
  commitment: string;
  dueAt: string | null;
  status: PromiseStoredStatus;
  derivedStatus: DerivedPromiseStatus;
  confidence: number | null;
  sourceEmail: { id: string; from: string; subject: string } | null;
  relatedTask: { id: string; title: string; completed: boolean; dueAt: string | null } | null;
  createdAt: string;
};

export type PromiseFilter = "all" | "waiting" | "mine" | "due_soon" | "overdue" | "fulfilled";

type PromiseState = {
  initialized: boolean;
  promises: PromiseRecord[];
  loading: boolean;
  activeFilter: PromiseFilter;

  init: () => void;
  fetchPromises: () => Promise<void>;
  setFilter: (filter: PromiseFilter) => void;
  fulfill: (id: string) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  createTaskFromPromise: (id: string, recurrence?: RecurrenceInput | null) => Promise<{ error?: string }>;
};

export const usePromiseStore = create<PromiseState>((set, get) => ({
  initialized: false,
  promises: [],
  loading: true,
  activeFilter: "all",

  init() {
    if (get().initialized) return;
    set({ initialized: true });
    void get().fetchPromises();
  },

  async fetchPromises() {
    set({ loading: true });
    const res = await fetch("/api/promises");
    if (!res.ok) {
      set({ loading: false });
      return;
    }
    const { promises } = await res.json();
    set({ promises, loading: false });
  },

  setFilter(filter) {
    set({ activeFilter: filter });
  },

  async fulfill(id) {
    const res = await fetch(`/api/promises/${id}/fulfill`, { method: "POST" });
    if (!res.ok) return;
    await get().fetchPromises();
  },

  async dismiss(id) {
    const res = await fetch(`/api/promises/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DISMISSED" }),
    });
    if (!res.ok) return;
    await get().fetchPromises();
  },

  async createTaskFromPromise(id, recurrence) {
    const res = await fetch(`/api/promises/${id}/create-task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recurrence: recurrence ?? null }),
    });
    if (!res.ok) return { error: await readError(res) };
    await get().fetchPromises();
    return {};
  },
}));

const ACTIVE_ISH = new Set<DerivedPromiseStatus>(["ACTIVE", "DUE_SOON", "OVERDUE"]);

// Pure — unit-tested directly, mirrors task-store's filteredTasks pattern.
export function filteredPromises(promises: PromiseRecord[], filter: PromiseFilter): PromiseRecord[] {
  switch (filter) {
    case "all":
      return promises.filter((p) => ACTIVE_ISH.has(p.derivedStatus));
    case "waiting":
      return promises.filter((p) => p.direction === "INCOMING" && ACTIVE_ISH.has(p.derivedStatus));
    case "mine":
      return promises.filter((p) => p.direction === "OUTGOING" && ACTIVE_ISH.has(p.derivedStatus));
    case "due_soon":
      return promises.filter((p) => p.derivedStatus === "DUE_SOON");
    case "overdue":
      return promises.filter((p) => p.derivedStatus === "OVERDUE");
    case "fulfilled":
      return promises.filter((p) => p.derivedStatus === "FULFILLED");
  }
}

export function usePromiseCounts() {
  return usePromiseStore((s) => ({
    active: s.promises.filter((p) => ACTIVE_ISH.has(p.derivedStatus)).length,
    overdue: s.promises.filter((p) => p.derivedStatus === "OVERDUE").length,
  }));
}
