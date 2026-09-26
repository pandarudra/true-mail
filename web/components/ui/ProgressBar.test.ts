import { describe, expect, it } from "vitest";
import { progressPercent } from "./ProgressBar";

describe("progressPercent", () => {
  it("computes a simple fraction", () => {
    expect(progressPercent(1, 4)).toBe(25);
  });

  it("clamps value above max to 100", () => {
    expect(progressPercent(9, 4)).toBe(100);
  });

  it("clamps a negative value to 0", () => {
    expect(progressPercent(-3, 4)).toBe(0);
  });

  it("returns 0 for a zero or negative max instead of NaN/Infinity", () => {
    expect(progressPercent(2, 0)).toBe(0);
    expect(progressPercent(2, -1)).toBe(0);
  });

  it("rounds to the nearest integer percent", () => {
    expect(progressPercent(1, 3)).toBe(33);
  });
});
