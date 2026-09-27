import { describe, expect, it } from "vitest";
import { zonedTimeToUtc } from "./timezone";
import { computeNextOccurrence, defaultRecurrenceFields, describeRecurrence } from "./recurrence";

// Asia/Kolkata has no DST — keeps these fixtures' expected UTC values easy
// to reason about; lib/timezone.test.ts already covers the DST-transition
// case on its own.
const TZ = "Asia/Kolkata";

describe("computeNextOccurrence", () => {
  it("DAILY: returns later today if the reminder time hasn't passed yet", () => {
    const after = zonedTimeToUtc(2026, 9, 30, 18, 0, TZ); // Wed 6pm
    const next = computeNextOccurrence(
      { recurrenceType: "DAILY", recurrenceDaysOfWeek: [], recurrenceDayOfMonth: null, reminderTime: "21:00" },
      TZ,
      after
    );
    expect(next.getTime()).toBe(zonedTimeToUtc(2026, 9, 30, 21, 0, TZ).getTime());
  });

  it("DAILY: rolls to tomorrow once today's reminder time has passed", () => {
    const after = zonedTimeToUtc(2026, 9, 30, 22, 0, TZ); // Wed 10pm, after 9pm
    const next = computeNextOccurrence(
      { recurrenceType: "DAILY", recurrenceDaysOfWeek: [], recurrenceDayOfMonth: null, reminderTime: "21:00" },
      TZ,
      after
    );
    expect(next.getTime()).toBe(zonedTimeToUtc(2026, 10, 1, 21, 0, TZ).getTime());
  });

  it("WEEKDAYS: skips the weekend", () => {
    // Friday Oct 2, 2026, after 9pm -> next weekday occurrence is Monday Oct 5
    const after = zonedTimeToUtc(2026, 10, 2, 22, 0, TZ);
    const next = computeNextOccurrence(
      { recurrenceType: "WEEKDAYS", recurrenceDaysOfWeek: [], recurrenceDayOfMonth: null, reminderTime: "21:00" },
      TZ,
      after
    );
    expect(next.getTime()).toBe(zonedTimeToUtc(2026, 10, 5, 21, 0, TZ).getTime());
  });

  it("WEEKLY: fires on each configured day and wraps to the next week", () => {
    const recurrence = {
      recurrenceType: "WEEKLY" as const,
      recurrenceDaysOfWeek: [1, 5], // Mon, Fri
      recurrenceDayOfMonth: null,
      reminderTime: "10:00",
    };
    // Wed Sept 30 -> next is Friday Oct 2
    const fromWed = computeNextOccurrence(recurrence, TZ, zonedTimeToUtc(2026, 9, 30, 0, 0, TZ));
    expect(fromWed.getTime()).toBe(zonedTimeToUtc(2026, 10, 2, 10, 0, TZ).getTime());
    // Advancing past Friday's own occurrence -> next Monday Oct 5, not the same Friday again
    const fromFridayOccurrence = computeNextOccurrence(recurrence, TZ, fromWed);
    expect(fromFridayOccurrence.getTime()).toBe(zonedTimeToUtc(2026, 10, 5, 10, 0, TZ).getTime());
  });

  it("MONTHLY: fires on the configured day, rolling to next month once passed", () => {
    const recurrence = {
      recurrenceType: "MONTHLY" as const,
      recurrenceDaysOfWeek: [],
      recurrenceDayOfMonth: 15,
      reminderTime: "09:00",
    };
    const beforeThisMonth = computeNextOccurrence(recurrence, TZ, zonedTimeToUtc(2026, 9, 10, 0, 0, TZ));
    expect(beforeThisMonth.getTime()).toBe(zonedTimeToUtc(2026, 9, 15, 9, 0, TZ).getTime());
    const afterThisMonth = computeNextOccurrence(recurrence, TZ, beforeThisMonth);
    expect(afterThisMonth.getTime()).toBe(zonedTimeToUtc(2026, 10, 15, 9, 0, TZ).getTime());
  });

  it("MONTHLY: clamps to the shorter month instead of overflowing (day 31 in a 28-day February)", () => {
    const recurrence = {
      recurrenceType: "MONTHLY" as const,
      recurrenceDaysOfWeek: [],
      recurrenceDayOfMonth: 31,
      reminderTime: "09:00",
    };
    // 2027 is not a leap year — February has 28 days.
    const next = computeNextOccurrence(recurrence, TZ, zonedTimeToUtc(2027, 1, 31, 10, 0, TZ));
    expect(next.getTime()).toBe(zonedTimeToUtc(2027, 2, 28, 9, 0, TZ).getTime());
  });

  it("advancing from a long-missed occurrence still produces the correct next slot, never the same stale one twice", () => {
    // This is the exact scenario that broke the naive "compare to
    // lastReminderSentFor" design during planning: the cron always advances
    // from the stale nextOccurrenceAt (not from real "now"), which is what
    // keeps the reminder alive indefinitely instead of going dead after one
    // missed check-in.
    const recurrence = {
      recurrenceType: "DAILY" as const,
      recurrenceDaysOfWeek: [],
      recurrenceDayOfMonth: null,
      reminderTime: "09:00",
    };
    const first = computeNextOccurrence(recurrence, TZ, zonedTimeToUtc(2026, 9, 1, 0, 0, TZ));
    expect(first.getTime()).toBe(zonedTimeToUtc(2026, 9, 1, 9, 0, TZ).getTime());
    const second = computeNextOccurrence(recurrence, TZ, first);
    expect(second.getTime()).toBe(zonedTimeToUtc(2026, 9, 2, 9, 0, TZ).getTime());
    expect(second.getTime()).not.toBe(first.getTime());
  });
});

describe("defaultRecurrenceFields", () => {
  it("WEEKLY with no days picked defaults to today's weekday", () => {
    // Sept 30, 2026 is a Wednesday (index 3).
    const result = defaultRecurrenceFields("WEEKLY", [], null, TZ, zonedTimeToUtc(2026, 9, 30, 12, 0, TZ));
    expect(result.recurrenceDaysOfWeek).toEqual([3]);
  });

  it("MONTHLY with no day picked defaults to today's day-of-month", () => {
    const result = defaultRecurrenceFields("MONTHLY", [], null, TZ, zonedTimeToUtc(2026, 9, 30, 12, 0, TZ));
    expect(result.recurrenceDayOfMonth).toBe(30);
  });

  it("leaves an explicit choice untouched", () => {
    const result = defaultRecurrenceFields("WEEKLY", [1, 5], null, TZ, zonedTimeToUtc(2026, 9, 30, 12, 0, TZ));
    expect(result.recurrenceDaysOfWeek).toEqual([1, 5]);
  });
});

describe("describeRecurrence", () => {
  it("describes each recurrence type in plain English", () => {
    expect(
      describeRecurrence({ recurrenceType: "DAILY", recurrenceDaysOfWeek: [], recurrenceDayOfMonth: null, reminderTime: "21:00" })
    ).toBe("Every day at 9:00 PM");
    expect(
      describeRecurrence({ recurrenceType: "WEEKDAYS", recurrenceDaysOfWeek: [], recurrenceDayOfMonth: null, reminderTime: "09:00" })
    ).toBe("Every weekday at 9:00 AM");
    expect(
      describeRecurrence({ recurrenceType: "WEEKLY", recurrenceDaysOfWeek: [1, 5], recurrenceDayOfMonth: null, reminderTime: "10:00" })
    ).toBe("Every Monday and Friday at 10:00 AM");
    expect(
      describeRecurrence({ recurrenceType: "MONTHLY", recurrenceDaysOfWeek: [], recurrenceDayOfMonth: 15, reminderTime: "09:00" })
    ).toBe("Monthly on day 15 at 9:00 AM");
  });
});
