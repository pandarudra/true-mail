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
