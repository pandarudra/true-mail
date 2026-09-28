import { describe, expect, it } from "vitest";
import { snapshotPercentages } from "./productivity-snapshot";
import { activityLevel, computeStreaks, type ActivityDay } from "./productivity-snapshot-shared";

function days(counts: number[]): ActivityDay[] {
  return counts.map((count, i) => ({ date: `d${i}`, count, level: activityLevel(count) }));
}

describe("snapshotPercentages", () => {
  it("computes a simple split", () => {
    expect(snapshotPercentages([11, 9, 6], 26)).toEqual([42, 35, 23]);
  });

  it("returns all zeros for total = 0, never NaN or Infinity", () => {
    const result = snapshotPercentages([0, 0, 0], 0);
    expect(result).toEqual([0, 0, 0]);
    expect(result.every((n) => Number.isFinite(n))).toBe(true);
  });

  it("handles a single non-empty segment", () => {
    expect(snapshotPercentages([5, 0, 0], 5)).toEqual([100, 0, 0]);
  });

  it("rounds to whole percents", () => {
    expect(snapshotPercentages([1, 1, 1], 3)).toEqual([33, 33, 33]);
  });
});

describe("activityLevel", () => {
  it("buckets counts into the graph's 0-4 levels", () => {
    expect(activityLevel(0)).toBe(0);
    expect(activityLevel(1)).toBe(1);
    expect(activityLevel(2)).toBe(2);
    expect(activityLevel(3)).toBe(2);
    expect(activityLevel(4)).toBe(3);
    expect(activityLevel(5)).toBe(3);
    expect(activityLevel(6)).toBe(4);
    expect(activityLevel(50)).toBe(4);
  });
});

describe("computeStreaks", () => {
  it("returns zeros for no activity at all", () => {
    expect(computeStreaks(days([0, 0, 0]))).toEqual({ current: 0, longest: 0 });
  });

  it("counts today into an ongoing streak", () => {
    expect(computeStreaks(days([1, 1, 0, 1, 1, 1]))).toEqual({ current: 3, longest: 3 });
  });

  it("doesn't let a quiet today zero out yesterday's streak", () => {
    expect(computeStreaks(days([1, 1, 1, 0]))).toEqual({ current: 3, longest: 3 });
  });

  it("breaks the current streak on a quiet day before today", () => {
    expect(computeStreaks(days([1, 1, 1, 0, 1]))).toEqual({ current: 1, longest: 3 });
  });

  it("handles an empty range", () => {
    expect(computeStreaks([])).toEqual({ current: 0, longest: 0 });
  });
});
