import { describe, expect, it } from "vitest";
import { snapshotPercentages } from "./productivity-snapshot";

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
