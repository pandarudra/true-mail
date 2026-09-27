import { prisma } from "@/lib/db";
import { derivePromiseStatus } from "@/lib/promises";
import type { Snapshot } from "@/lib/productivity-snapshot-shared";

export type { SnapshotTone, SnapshotSegment, Snapshot } from "@/lib/productivity-snapshot-shared";
export { snapshotPercentages } from "@/lib/productivity-snapshot-shared";

// This app's Task model has no "in progress" status (just `completed` +
// `subtasks`) — a real, non-fabricated proxy: a task counts as in progress
// once some but not all of its subtasks are done, and as to-do otherwise.
// Counts, not full rows: `count()` for the cheap aggregates, and a
// select-only-what's-needed query for the one thing that needs per-row
// classification (spec §51 — avoid pulling full records into memory).
export async function getTaskSnapshot(userId: string): Promise<Snapshot> {
  const [total, completed, incomplete] = await Promise.all([
    prisma.task.count({ where: { userId } }),
    prisma.task.count({ where: { userId, completed: true } }),
    prisma.task.findMany({
      where: { userId, completed: false },
      select: { subtasks: { select: { completed: true } } },
    }),
  ]);

  let inProgress = 0;
  let todo = 0;
  for (const t of incomplete) {
    const done = t.subtasks.filter((s) => s.completed).length;
    if (t.subtasks.length > 0 && done > 0 && done < t.subtasks.length) inProgress++;
    else todo++;
  }

  const remaining = total - completed;
  const insight =
    total === 0
      ? null
      : remaining === 0
        ? "Everything's done — nice."
        : `${remaining} task${remaining === 1 ? "" : "s"} left, ${inProgress} already in progress.`;

  return {
    total,
    segments: [
      { label: "Completed", value: completed, tone: "good" },
      { label: "In Progress", value: inProgress, tone: "warning" },
      { label: "To Do", value: todo, tone: "neutral" },
    ],
    insight,
  };
}

export async function getPromiseSnapshot(userId: string): Promise<Snapshot> {
  const active = await prisma.promise.findMany({
    where: { userId, status: "ACTIVE" },
    select: { status: true, dueAt: true },
  });

  const now = new Date();
  let onTrack = 0;
  let dueSoon = 0;
  let overdue = 0;
  for (const p of active) {
    const derived = derivePromiseStatus(p, now);
    if (derived === "OVERDUE") overdue++;
    else if (derived === "DUE_SOON") dueSoon++;
    else onTrack++;
  }

  const insight =
    active.length === 0
      ? null
      : overdue > 0
        ? `${overdue} promise${overdue === 1 ? "" : "s"} overdue.`
        : dueSoon > 0
          ? `${dueSoon} promise${dueSoon === 1 ? "" : "s"} due soon.`
          : "All promises on track.";

  return {
    total: active.length,
    segments: [
      { label: "On Track", value: onTrack, tone: "good" },
      { label: "Due Soon", value: dueSoon, tone: "warning" },
      { label: "Overdue", value: overdue, tone: "critical" },
    ],
    insight,
  };
}

export async function getTodaySnapshot(userId: string): Promise<Snapshot> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const tasks = await prisma.task.findMany({
    where: { userId, dueAt: { lt: startOfTomorrow } },
    select: { completed: true, dueAt: true },
  });

  let completed = 0;
  let remaining = 0;
  let overdue = 0;
  for (const t of tasks) {
    if (t.completed) {
      completed++;
    } else if (t.dueAt && t.dueAt < startOfToday) {
      overdue++;
    } else {
      remaining++;
    }
  }

  const insight =
    tasks.length === 0
      ? null
      : overdue > 0
        ? `${overdue} overdue item${overdue === 1 ? "" : "s"} need attention.`
        : remaining === 0
          ? "Today's work is done."
          : `${remaining} item${remaining === 1 ? "" : "s"} left today.`;

  return {
    total: tasks.length,
    segments: [
      { label: "Completed", value: completed, tone: "good" },
      { label: "Remaining", value: remaining, tone: "warning" },
      { label: "Overdue", value: overdue, tone: "critical" },
    ],
    insight,
  };
}
