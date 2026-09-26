import { describe, expect, it } from "vitest";
import { bucketTasks, type TaskSummary } from "./summary";

const NOW = new Date(2026, 8, 26, 12, 0, 0); // Sep 26, 2026, noon

function task(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return { id: "1", title: "Task", dueAt: null, dueHasTime: false, ...overrides };
}

describe("bucketTasks", () => {
  it("puts a past-due task in overdue", () => {
    const t = task({ id: "a", dueAt: new Date(2026, 8, 25) });
    expect(bucketTasks([t], NOW)).toMatchObject({ overdue: [t], today: [], upcoming: [] });
  });

  it("puts anything due before tomorrow's start in today, including earlier today", () => {
    const t = task({ id: "b", dueAt: new Date(2026, 8, 26, 3, 0) });
    expect(bucketTasks([t], NOW)).toMatchObject({ overdue: [], today: [t], upcoming: [] });
  });

  it("puts a future-due task in upcoming", () => {
    const t = task({ id: "c", dueAt: new Date(2026, 8, 27) });
    expect(bucketTasks([t], NOW)).toMatchObject({ overdue: [], today: [], upcoming: [t] });
  });

  it("excludes tasks with no due date entirely", () => {
    const t = task({ id: "d", dueAt: null });
    expect(bucketTasks([t], NOW)).toEqual({ overdue: [], today: [], upcoming: [] });
  });

  it("sorts each bucket earliest-first", () => {
    const later = task({ id: "e", dueAt: new Date(2026, 8, 30) });
    const sooner = task({ id: "f", dueAt: new Date(2026, 8, 28) });
    const { upcoming } = bucketTasks([later, sooner], NOW);
    expect(upcoming.map((t) => t.id)).toEqual(["f", "e"]);
  });

  it("is a 3-way partition — every bucketed task lands in exactly one bucket", () => {
    const tasks = [
      task({ id: "overdue-1", dueAt: new Date(2026, 8, 20) }),
      task({ id: "today-1", dueAt: new Date(2026, 8, 26, 23, 59) }),
      task({ id: "upcoming-1", dueAt: new Date(2026, 9, 1) }),
    ];
    const buckets = bucketTasks(tasks, NOW);
    expect(buckets.overdue.map((t) => t.id)).toEqual(["overdue-1"]);
    expect(buckets.today.map((t) => t.id)).toEqual(["today-1"]);
    expect(buckets.upcoming.map((t) => t.id)).toEqual(["upcoming-1"]);
  });
});
