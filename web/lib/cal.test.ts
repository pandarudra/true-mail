import { describe, expect, it } from "vitest";
import { buildCal, isSameDay } from "./cal";

describe("buildCal", () => {
  it("lays out every week as 7 cells with the days in the right slots", () => {
    const year = 2026;
    const weeks = buildCal(year, "Sep");

    for (const week of weeks) {
      expect(week).toHaveLength(7);
    }

    const days = weeks.flat().filter((d): d is Date => d !== null);
    expect(days).toHaveLength(30);
    expect(days[0].getDate()).toBe(1);
    expect(days.at(-1)?.getDate()).toBe(30);

    const firstDayIndex = weeks.flat().findIndex((d) => d !== null);
    expect(firstDayIndex).toBe(new Date(year, 8, 1).getDay());
  });

  it("pads a month that doesn't fill its last week with nulls", () => {
    const weeks = buildCal(2026, "Feb");
    const days = weeks.flat().filter((d): d is Date => d !== null);
    expect(days).toHaveLength(28);
    expect(weeks.at(-1)).toHaveLength(7);
  });
});

describe("isSameDay", () => {
  it("ignores time-of-day and only compares the calendar date", () => {
    expect(isSameDay(new Date(2026, 8, 24, 1, 0), new Date(2026, 8, 24, 23, 59))).toBe(true);
    expect(isSameDay(new Date(2026, 8, 24), new Date(2026, 8, 25))).toBe(false);
    expect(isSameDay(new Date(2026, 8, 24), new Date(2025, 8, 24))).toBe(false);
  });
});
