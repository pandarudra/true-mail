import { afterEach, describe, expect, it, vi } from "vitest";
import { filteredTasks, reorderList, useTaskStore, type Task, type TaskList, type TaskView } from "./task-store";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "1",
    listId: "list-1",
    title: "Task",
    description: null,
    dueAt: null,
    dueHasTime: false,
    priority: "NORMAL",
    completed: false,
    completedAt: null,
    position: 0,
    sourceEmail: null,
    subtasks: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function viewState(tasks: Task[], activeView: TaskView, opts: { query?: string; taskLists?: TaskList[] } = {}) {
  return { tasks, activeView, query: opts.query ?? "", taskLists: opts.taskLists ?? [] };
}

// Built from local-midnight boundaries (matching filteredTasks' own logic)
// rather than fixed UTC strings, so these fixtures aren't timezone-flaky.
const NOW = new Date("2026-09-21T12:00:00Z");
const startOfToday = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
const hoursFrom = (base: Date, hours: number) => new Date(base.getTime() + hours * 60 * 60 * 1000).toISOString();
const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("filteredTasks", () => {
  it("today includes overdue and due-today tasks, excludes completed and no-due-date", () => {
    const tasks = [
      task({ id: "1", dueAt: hoursFrom(startOfToday, -24) }), // overdue (yesterday)
      task({ id: "2", dueAt: hoursFrom(startOfToday, 6) }), // due today
      task({ id: "3", dueAt: hoursFrom(startOfTomorrow, 6) }), // upcoming
      task({ id: "4", dueAt: hoursFrom(startOfToday, -24), completed: true }), // completed, excluded
      task({ id: "5", dueAt: null }), // no due date, excluded from Today
    ];
    const result = filteredTasks(viewState(tasks, { kind: "smart", smart: "today" }), NOW);
    expect(result.map((t) => t.id)).toEqual(["1", "2"]);
  });

  it("upcoming excludes today, overdue, and completed", () => {
    const tasks = [
      task({ id: "1", dueAt: hoursFrom(startOfToday, 6) }),
      task({ id: "2", dueAt: hoursFrom(startOfTomorrow, 6) }),
      task({ id: "3", dueAt: hoursFrom(startOfTomorrow, 30), completed: true }),
    ];
    const result = filteredTasks(viewState(tasks, { kind: "smart", smart: "upcoming" }), NOW);
    expect(result.map((t) => t.id)).toEqual(["2"]);
  });

  it("overdue is strictly before the start of today", () => {
    const tasks = [
      task({ id: "1", dueAt: hoursFrom(startOfToday, -0.5) }),
      task({ id: "2", dueAt: hoursFrom(startOfToday, 0) }),
    ];
    const result = filteredTasks(viewState(tasks, { kind: "smart", smart: "overdue" }), NOW);
    expect(result.map((t) => t.id)).toEqual(["1"]);
  });

  it("completed returns only completed tasks", () => {
    const tasks = [task({ id: "1", completed: true }), task({ id: "2", completed: false })];
    const result = filteredTasks(viewState(tasks, { kind: "smart", smart: "completed" }), NOW);
    expect(result.map((t) => t.id)).toEqual(["1"]);
  });

  it("list view returns only that list's tasks, sorted by position", () => {
    const tasks = [
      task({ id: "1", listId: "a", position: 1 }),
      task({ id: "2", listId: "b", position: 0 }),
      task({ id: "3", listId: "a", position: 0 }),
    ];
    const result = filteredTasks(viewState(tasks, { kind: "list", listId: "a" }), NOW);
    expect(result.map((t) => t.id)).toEqual(["3", "1"]);
  });

  it("a search query layers on top of the active view, matching title/description", () => {
    const tasks = [
      task({ id: "1", title: "Ship the release", completed: false }),
      task({ id: "2", title: "Write docs", description: "release notes", completed: false }),
      task({ id: "3", title: "Ship the release", completed: true }),
    ];
    const result = filteredTasks(viewState(tasks, { kind: "smart", smart: "all" }, { query: "release" }), NOW);
    expect(result.map((t) => t.id)).toEqual(["1", "2"]);
  });

  it("a search query supports list:/priority:/status: operators", () => {
    const taskLists: TaskList[] = [
      { id: "a", name: "Work", color: "#000", isDefault: false },
      { id: "b", name: "Personal", color: "#000", isDefault: false },
    ];
    const tasks = [
      task({ id: "1", listId: "a", priority: "URGENT", completed: false }),
      task({ id: "2", listId: "a", priority: "LOW", completed: false }),
      task({ id: "3", listId: "b", priority: "URGENT", completed: false }),
    ];
    const result = filteredTasks(
      viewState(tasks, { kind: "smart", smart: "all" }, { query: "list:work priority:urgent", taskLists }),
      NOW
    );
    expect(result.map((t) => t.id)).toEqual(["1"]);
  });

  // Regression: every smart/date view except "completed" excludes completed
  // tasks by default (that's the whole point of e.g. "Today"), which used to
  // mean `status:completed` in the advanced search could never return
  // anything unless you happened to already be on the Completed view — the
  // view's own filtering stripped completed tasks out before the query ever
  // got a look. An explicit status: operator must override the view default.
  describe("status: overrides the active view's own completed/active default", () => {
    const tasks = [
      task({ id: "done-today", dueAt: hoursFrom(startOfToday, 2), completed: true }),
      task({ id: "open-today", dueAt: hoursFrom(startOfToday, 2), completed: false }),
    ];

    it("status:completed surfaces completed tasks while on the 'today' smart view", () => {
      const result = filteredTasks(viewState(tasks, { kind: "smart", smart: "today" }, { query: "status:completed" }), NOW);
      expect(result.map((t) => t.id)).toEqual(["done-today"]);
    });

    it("status:completed surfaces completed tasks while on a date-picker view", () => {
      const result = filteredTasks(viewState(tasks, { kind: "date", date: isoDate(NOW) }, { query: "status:completed" }), NOW);
      expect(result.map((t) => t.id)).toEqual(["done-today"]);
    });

    it("status:completed surfaces completed tasks while on the 'all' smart view", () => {
      const result = filteredTasks(viewState(tasks, { kind: "smart", smart: "all" }, { query: "status:completed" }), NOW);
      expect(result.map((t) => t.id)).toEqual(["done-today"]);
    });

    it("status:active still excludes completed tasks on the 'completed' smart view", () => {
      const result = filteredTasks(viewState(tasks, { kind: "smart", smart: "completed" }, { query: "status:active" }), NOW);
      expect(result.map((t) => t.id)).toEqual(["open-today"]);
    });

    it("with no status: operator, each view keeps its own default (unchanged behavior)", () => {
      const today = filteredTasks(viewState(tasks, { kind: "smart", smart: "today" }, {}), NOW);
      expect(today.map((t) => t.id)).toEqual(["open-today"]);
      const completed = filteredTasks(viewState(tasks, { kind: "smart", smart: "completed" }, {}), NOW);
      expect(completed.map((t) => t.id)).toEqual(["done-today"]);
    });

    it("a list view has no completed/active default, so it already showed both (unaffected)", () => {
      const listTasks = [
        task({ id: "done", listId: "list-1", completed: true }),
        task({ id: "open", listId: "list-1", completed: false }),
      ];
      const result = filteredTasks(viewState(listTasks, { kind: "list", listId: "list-1" }, {}), NOW);
      expect(result.map((t) => t.id).sort()).toEqual(["done", "open"]);
    });
  });

  describe("date view (week-strip picker)", () => {
    it("includes only tasks due on that exact day, excluding yesterday, tomorrow, and completed", () => {
      const tasks = [
        task({ id: "yesterday", dueAt: hoursFrom(startOfToday, -6) }),
        task({ id: "today-morning", dueAt: hoursFrom(startOfToday, 2) }),
        task({ id: "today-evening", dueAt: hoursFrom(startOfToday, 20) }),
        task({ id: "tomorrow", dueAt: hoursFrom(startOfTomorrow, 2) }),
        task({ id: "today-completed", dueAt: hoursFrom(startOfToday, 4), completed: true }),
      ];
      const result = filteredTasks(viewState(tasks, { kind: "date", date: isoDate(NOW) }), NOW);
      expect(result.map((t) => t.id)).toEqual(["today-morning", "today-evening"]);
    });

    it("unlike the 'today' smart view, does not fold in earlier overdue tasks", () => {
      const tasks = [
        task({ id: "overdue", dueAt: hoursFrom(startOfToday, -48) }),
        task({ id: "today", dueAt: hoursFrom(startOfToday, 2) }),
      ];
      const result = filteredTasks(viewState(tasks, { kind: "date", date: isoDate(NOW) }), NOW);
      expect(result.map((t) => t.id)).toEqual(["today"]);
    });

    it("excludes tasks with no due date", () => {
      const tasks = [task({ id: "1", dueAt: null })];
      const result = filteredTasks(viewState(tasks, { kind: "date", date: isoDate(NOW) }), NOW);
      expect(result).toEqual([]);
    });
  });
});

describe("reorderList", () => {
  it("reorders within the same list", () => {
    const tasks = [
      task({ id: "1", listId: "a", position: 0 }),
      task({ id: "2", listId: "a", position: 1 }),
      task({ id: "3", listId: "a", position: 2 }),
    ];
    const result = reorderList(tasks, "3", "a", 0);
    expect(
      result.filter((t) => t.listId === "a").sort((a, b) => a.position - b.position).map((t) => t.id)
    ).toEqual(["3", "1", "2"]);
  });

  it("moves a task into a different list at the given index", () => {
    const tasks = [
      task({ id: "1", listId: "a", position: 0 }),
      task({ id: "2", listId: "b", position: 0 }),
      task({ id: "3", listId: "b", position: 1 }),
    ];
    const result = reorderList(tasks, "1", "b", 1);
    const listB = result.filter((t) => t.listId === "b").sort((a, b) => a.position - b.position);
    expect(listB.map((t) => t.id)).toEqual(["2", "1", "3"]);
    expect(result.find((t) => t.id === "1")?.listId).toBe("b");
  });
});

describe("toggleComplete", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useTaskStore.setState({
      tasks: [],
      taskLists: [],
      activeView: { kind: "smart", smart: "today" },
      initialized: false,
      loading: false,
    });
  });

  it("rolls back the optimistic update when the request fails", async () => {
    useTaskStore.setState({ tasks: [task({ id: "1", completed: false })] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "boom" }) }));
    await useTaskStore.getState().toggleComplete("1", true);
    expect(useTaskStore.getState().tasks[0].completed).toBe(false);
  });
});
