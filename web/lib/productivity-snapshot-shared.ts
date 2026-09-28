// Pure types + math shared between the server-only aggregation in
// lib/productivity-snapshot.ts (imports @/lib/db → pg → Node built-ins) and
// the client-rendered ProductivitySnapshot component. Kept in its own file
// with zero server imports so importing it from a client component doesn't
// drag Prisma/pg into the browser bundle.
export type SnapshotTone = "good" | "warning" | "critical" | "neutral";
export type SnapshotSegment = { label: string; value: number; tone: SnapshotTone };
export type Snapshot = { total: number; segments: SnapshotSegment[]; insight: string | null };

// Handles total<=0 without NaN/Infinity.
export function snapshotPercentages(values: number[], total: number): number[] {
  if (total <= 0) return values.map(() => 0);
  return values.map((v) => Math.round((v / total) * 100));
}

// One square in the Overview activity graph — a day's combined count of
// completed tasks + fulfilled promises. Same shape as kibo-ui's
// contribution-graph `Activity` type (date/count/level), so the graph
// component's data contract matches that reference implementation.
export type ActivityDay = { date: string; count: number; level: number };

// Fixed buckets rather than count/max*4 — with mostly-quiet days (a personal
// task/promise tracker, not a commit history), a relative scale would make a
// single 1-item day look like "level 4", which is misleading.
export function activityLevel(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

export type StreakInfo = { current: number; longest: number };

// `days` is chronological, ending today. A streak "breaks" on a quiet day —
// except today itself, which doesn't count against you until it's over, so
// an all-zero today doesn't zero out a streak that's still very much alive.
export function computeStreaks(days: ActivityDay[]): StreakInfo {
  let longest = 0;
  let run = 0;
  for (const d of days) {
    run = d.count > 0 ? run + 1 : 0;
    if (run > longest) longest = run;
  }

  let current = 0;
  let i = days.length - 1;
  if (i >= 0 && days[i].count === 0) i--;
  for (; i >= 0 && days[i].count > 0; i--) current++;

  return { current, longest };
}
