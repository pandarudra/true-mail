import { zonedTimeToUtc, localDatePartsInZone } from "@/lib/timezone";

export type RecurrenceType = "DAILY" | "WEEKDAYS" | "WEEKLY" | "MONTHLY";

export type RecurringTaskInput = {
  recurrenceType: RecurrenceType;
  recurrenceDaysOfWeek: number[]; // 0=Sun..6=Sat — WEEKLY only, expected non-empty (see defaultRecurrenceFields)
  recurrenceDayOfMonth: number | null; // MONTHLY only
  reminderTime: string; // "HH:mm"
};

type LocalDate = { year: number; month: number; day: number };

function addLocalDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function weekdayOf(date: LocalDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseReminderTime(reminderTime: string): { hour: number; minute: number } {
  const [hour, minute] = reminderTime.split(":").map(Number);
  return { hour: hour || 0, minute: minute || 0 };
}

// The next UTC instant this recurrence fires, strictly after `after`. Called
// both at creation time (after = now) and to advance past a fired/handled
// occurrence (after = that occurrence's own instant) — in the latter case
// the same local day never re-qualifies, since its instant isn't > after.
export function computeNextOccurrence(recurrence: RecurringTaskInput, timezone: string, after: Date): Date {
  const { hour, minute } = parseReminderTime(recurrence.reminderTime);
  let candidate: LocalDate = localDatePartsInZone(after, timezone);

  // Bounded search — a year of daily steps is already generous headroom for
  // any of these four recurrence shapes; this only guards against an
  // unforeseen infinite loop, not a real expected iteration count (daily
  // needs <=2 steps, weekly <=8, monthly <=32).
  for (let i = 0; i < 366; i++) {
    if (matchesRecurrence(candidate, recurrence)) {
      const instant = zonedTimeToUtc(candidate.year, candidate.month, candidate.day, hour, minute, timezone);
      if (instant.getTime() > after.getTime()) return instant;
    }
    candidate = addLocalDays(candidate, 1);
  }

  // Unreachable for the four supported types, but keeps the return type
  // total rather than possibly-undefined.
  throw new Error(`Could not compute a next occurrence for recurrence type ${recurrence.recurrenceType}`);
}

function matchesRecurrence(date: LocalDate, recurrence: RecurringTaskInput): boolean {
  switch (recurrence.recurrenceType) {
    case "DAILY":
      return true;
    case "WEEKDAYS": {
      const w = weekdayOf(date);
      return w !== 0 && w !== 6;
    }
    case "WEEKLY":
      return recurrence.recurrenceDaysOfWeek.includes(weekdayOf(date));
    case "MONTHLY": {
      const target = recurrence.recurrenceDayOfMonth ?? date.day;
      // Clamp to the month's real length (e.g. day 31 in a 30-day month)
      // instead of overflowing into the next month.
      return date.day === Math.min(target, daysInMonth(date.year, date.month));
    }
  }
}

// WEEKLY/MONTHLY need a concrete day to repeat on — if the user didn't pick
// one explicitly, it defaults to whatever day the task is first created on,
// resolved once here rather than re-derived on every future advance.
export function defaultRecurrenceFields(
  recurrenceType: RecurrenceType,
  recurrenceDaysOfWeek: number[],
  recurrenceDayOfMonth: number | null,
  timezone: string,
  now: Date
): { recurrenceDaysOfWeek: number[]; recurrenceDayOfMonth: number | null } {
  const today = localDatePartsInZone(now, timezone);
  if (recurrenceType === "WEEKLY" && recurrenceDaysOfWeek.length === 0) {
    return { recurrenceDaysOfWeek: [weekdayOf(today)], recurrenceDayOfMonth };
  }
  if (recurrenceType === "MONTHLY" && recurrenceDayOfMonth === null) {
    return { recurrenceDaysOfWeek, recurrenceDayOfMonth: today.day };
  }
  return { recurrenceDaysOfWeek, recurrenceDayOfMonth };
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Human-readable summary for UI/Telegram confirmations, e.g. "Every weekday
// at 9:00 PM" or "Every Monday and Friday at 10:00 AM".
export function describeRecurrence(recurrence: RecurringTaskInput): string {
  const { hour, minute } = parseReminderTime(recurrence.reminderTime);
  const time = new Date(Date.UTC(2000, 0, 1, hour, minute)).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });

  switch (recurrence.recurrenceType) {
    case "DAILY":
      return `Every day at ${time}`;
    case "WEEKDAYS":
      return `Every weekday at ${time}`;
    case "WEEKLY": {
      const days = recurrence.recurrenceDaysOfWeek.map((d) => WEEKDAY_NAMES[d]).join(" and ");
      return `Every ${days} at ${time}`;
    }
    case "MONTHLY":
      return `Monthly on day ${recurrence.recurrenceDayOfMonth} at ${time}`;
  }
}
