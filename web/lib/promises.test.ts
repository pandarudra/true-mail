import { describe, expect, it } from "vitest";
import { derivePromiseStatus } from "./promises";

const NOW = new Date(2026, 8, 26, 12, 0, 0); // Sep 26, 2026, noon
const hoursFrom = (hours: number) => new Date(NOW.getTime() + hours * 60 * 60 * 1000);

describe("derivePromiseStatus", () => {
  it("is ACTIVE with no due date", () => {
    expect(derivePromiseStatus({ status: "ACTIVE", dueAt: null }, NOW)).toBe("ACTIVE");
  });

  it("is ACTIVE when the due date is more than 2 days out", () => {
    expect(derivePromiseStatus({ status: "ACTIVE", dueAt: hoursFrom(72) }, NOW)).toBe("ACTIVE");
  });

  it("is DUE_SOON within the 2-day window", () => {
    expect(derivePromiseStatus({ status: "ACTIVE", dueAt: hoursFrom(36) }, NOW)).toBe("DUE_SOON");
  });

  it("is DUE_SOON exactly at the 2-day boundary", () => {
    expect(derivePromiseStatus({ status: "ACTIVE", dueAt: hoursFrom(48) }, NOW)).toBe("DUE_SOON");
  });

  it("is OVERDUE once the due date has passed", () => {
    expect(derivePromiseStatus({ status: "ACTIVE", dueAt: hoursFrom(-1) }, NOW)).toBe("OVERDUE");
  });

  it("FULFILLED and DISMISSED are returned as-is, never recomputed into DUE_SOON/OVERDUE", () => {
    expect(derivePromiseStatus({ status: "FULFILLED", dueAt: hoursFrom(-100) }, NOW)).toBe("FULFILLED");
    expect(derivePromiseStatus({ status: "DISMISSED", dueAt: hoursFrom(-100) }, NOW)).toBe("DISMISSED");
  });
});
