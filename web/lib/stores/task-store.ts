import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { readError } from "@/lib/api-error";
import { matchesTaskSearchQuery } from "@/lib/task-search-query";

export type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type TaskList = { id: string; name: string; color: string; isDefault: boolean };
export type Subtask = { id: string; title: string; completed: boolean; position: number };
export type Task = {
  id: string;
  listId: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  dueHasTime: boolean;
  priority: Priority;
  completed: boolean;
  completedAt: string | null;
  position: number;
  sourceEmail: { id: string; from: string; subject: string } | null;
  subtasks: Subtask[];
  createdAt: string;
};
export type SmartView = "today" | "upcoming" | "overdue" | "completed" | "all";
export type TaskView = { kind: "smart"; smart: SmartView } | { kind: "list"; listId: string };

export type TaskState = {
  initialized: boolean;
  taskLists: TaskList[];
  tasks: Task[];
  activeView: TaskView;
  loading: boolean;
  query: string;

  init: () => void;
  setQuery: (value: string) => void;
  fetchTaskLists: () => Promise<void>;
  fetchTasks: () => Promise<void>;
  selectSmartView: (view: SmartView) => void;
  selectList: (listId: string) => void;
  createList: (name: string, color: string) => Promise<{ error?: string }>;
  renameList: (id: string, name: string, color: string) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  createTask: (input: {
    title: string;
    listId?: string;
    description?: string;
    dueAt?: string | null;
    dueHasTime?: boolean;
    priority?: Priority;
    sourceEmailId?: string;
  }) => Promise<void>;
  updateTask: (
    id: string,
    input: Partial<{
      title: string;
      description: string | null;
      dueAt: string | null;
      dueHasTime: boolean;
      priority: Priority;
      listId: string;
    }>
  ) => Promise<void>;
  toggleComplete: (id: string, completed: boolean) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  reorderTask: (id: string, listId: string, position: number) => Promise<void>;
  createSubtask: (taskId: string, title: string) => Promise<void>;
  toggleSubtask: (taskId: string, subtaskId: string, completed: boolean) => Promise<void>;
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<void>;
};

export const useTaskStore = create<TaskState>((set, get) => ({
  initialized: false,
  taskLists: [],
  tasks: [],
  activeView: { kind: "smart", smart: "today" },
  loading: true,
  query: "",

  init() {
    if (get().initialized) return;
    set({ initialized: true });
    void get().fetchTaskLists();
    void get().fetchTasks();
  },

  setQuery(value) {
    set({ query: value });
  },

  async fetchTaskLists() {
    const res = await fetch("/api/task-lists");
    if (!res.ok) return;
    const { taskLists } = await res.json();
    set({ taskLists });
  },

  async fetchTasks() {
    set({ loading: true });
    const res = await fetch("/api/tasks");
    if (!res.ok) {
      set({ loading: false });
      return;
    }
    const { tasks } = await res.json();
    set({ tasks, loading: false });
  },

  selectSmartView(smart) {
    set({ activeView: { kind: "smart", smart } });
  },

  selectList(listId) {
    set({ activeView: { kind: "list", listId } });
  },

  async createList(name, color) {
    const res = await fetch("/api/task-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    if (!res.ok) return { error: await readError(res) };
    await get().fetchTaskLists();
    return {};
  },

  async renameList(id, name, color) {
    await fetch(`/api/task-lists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    await get().fetchTaskLists();
  },

  async deleteList(id) {
    await fetch(`/api/task-lists/${id}`, { method: "DELETE" });
    const view = get().activeView;
    if (view.kind === "list" && view.listId === id) {
      set({ activeView: { kind: "smart", smart: "all" } });
    }
    await get().fetchTaskLists();
    await get().fetchTasks();
  },

  async createTask(input) {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return;
    const { task } = await res.json();
    set((state) => ({ tasks: [...state.tasks, task] }));
  },

  async updateTask(id, input) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return;
    const { task } = await res.json();
    set((state) => ({ tasks: state.tasks.map((t) => (t.id === id ? task : t)) }));
  },

  async toggleComplete(id, completed) {
    const prev = get().tasks;
    set({
      tasks: prev.map((t) =>
        t.id === id ? { ...t, completed, completedAt: completed ? new Date().toISOString() : null } : t
      ),
    });
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    if (!res.ok) {
      set({ tasks: prev });
      return;
    }
    const { task } = await res.json();
    set((state) => ({ tasks: state.tasks.map((t) => (t.id === id ? task : t)) }));
  },

  async deleteTask(id) {
    const prev = get().tasks;
    set({ tasks: prev.filter((t) => t.id !== id) });
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) set({ tasks: prev });
  },

  async reorderTask(id, listId, position) {
    const prev = get().tasks;
    set({ tasks: reorderList(prev, id, listId, position) });
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId, position }),
    });
    if (!res.ok) {
      set({ tasks: prev });
      return;
    }
    await get().fetchTasks();
  },

  async createSubtask(taskId, title) {
    const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) return;
    const { task } = await res.json();
    set((state) => ({ tasks: state.tasks.map((t) => (t.id === taskId ? task : t)) }));
  },

  async toggleSubtask(taskId, subtaskId, completed) {
    const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    if (!res.ok) return;
    const { task } = await res.json();
    set((state) => ({ tasks: state.tasks.map((t) => (t.id === taskId ? task : t)) }));
  },

  async deleteSubtask(taskId, subtaskId) {
    const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { method: "DELETE" });
    if (!res.ok) return;
    const { task } = await res.json();
    set((state) => ({ tasks: state.tasks.map((t) => (t.id === taskId ? task : t)) }));
  },
}));

// Pure — reorders `tasks` so `movingId` sits at `targetPosition` within
// `targetListId`, renumbering that list's positions to 0..n. Used by
// `reorderTask` for the optimistic update, and unit-tested directly.
export function reorderList(
  tasks: Task[],
  movingId: string,
  targetListId: string,
  targetPosition: number
): Task[] {
  const moving = tasks.find((t) => t.id === movingId);
  if (!moving) return tasks;
  const withoutMoving = tasks.filter((t) => t.id !== movingId);
  const destSiblings = withoutMoving
    .filter((t) => t.listId === targetListId)
    .sort((a, b) => a.position - b.position);
  const index = Math.max(0, Math.min(targetPosition, destSiblings.length));
  destSiblings.splice(index, 0, { ...moving, listId: targetListId });
  const renumbered = destSiblings.map((t, i) => ({ ...t, position: i }));
  const others = withoutMoving.filter((t) => t.listId !== targetListId);
  return [...others, ...renumbered];
}

function byDueDate(a: Task, b: Task): number {
  if (a.dueAt === null) return b.dueAt === null ? 0 : 1;
  if (b.dueAt === null) return -1;
  return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
}

function viewFilteredTasks(state: Pick<TaskState, "tasks" | "activeView">, now: Date): Task[] {
  const view = state.activeView;
  if (view.kind === "list") {
    return state.tasks.filter((t) => t.listId === view.listId).sort((a, b) => a.position - b.position);
  }
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  switch (view.smart) {
    case "today":
      return state.tasks
        .filter((t) => !t.completed && t.dueAt !== null && new Date(t.dueAt) < startOfTomorrow)
        .sort(byDueDate);
    case "upcoming":
      return state.tasks
        .filter((t) => !t.completed && t.dueAt !== null && new Date(t.dueAt) >= startOfTomorrow)
        .sort(byDueDate);
    case "overdue":
      return state.tasks
        .filter((t) => !t.completed && t.dueAt !== null && new Date(t.dueAt) < startOfToday)
        .sort(byDueDate);
    case "completed":
      return state.tasks.filter((t) => t.completed).sort(byDueDate);
    case "all":
      return state.tasks.filter((t) => !t.completed).sort(byDueDate);
  }
}

// Pure selector — unit-tested directly with a fixed `now` for determinism.
// Search (via the TopBar search box / AdvancedTaskSearchModal) layers on
// top of the active view, the same way inbox-store's query layers on top
// of the active folder.
export function filteredTasks(
  state: Pick<TaskState, "tasks" | "activeView" | "query" | "taskLists">,
  now: Date = new Date()
): Task[] {
  const viewFiltered = viewFilteredTasks(state, now);
  const q = state.query.trim();
  if (!q) return viewFiltered;
  return viewFiltered.filter((t) => matchesTaskSearchQuery(t, q, state.taskLists));
}

export function useFilteredTasks(): Task[] {
  return useTaskStore(useShallow((s) => filteredTasks(s)));
}
