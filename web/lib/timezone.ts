// Converts a local wall-clock date/time in an IANA zone to the correct UTC
// instant — DST-safe, since it reads the zone's real offset at that instant
// from Intl rather than a hardcoded number. Standard technique: guess UTC
// equal to the wall-clock numbers, ask Intl what that instant looks like in
// the target zone, then correct by the difference.
export function zonedTimeToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = aheadOfUtcMs(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset);
}

function aheadOfUtcMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // Intl's 24-hour "hour" can report 24 for midnight — normalize to 0.
  const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return asIfUtc - instant.getTime();
}

// Same convention as the browser's Date#getTimezoneOffset (minutes to ADD to
// local wall-clock to get UTC; negative for zones ahead of UTC). Lets a
// server-side caller with a stored IANA zone (Telegram, no browser present)
// reuse the same "naive local string + offset" AI-parsing path the web
// quick-add already uses instead of a separate code path.
export function offsetMinutesForZone(instant: Date, timeZone: string): number {
  return -aheadOfUtcMs(instant, timeZone) / 60000;
}

export type ZonedDateParts = { year: number; month: number; day: number; weekday: number };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// The calendar date (and day-of-week) `date` falls on *as seen from*
// `timeZone` — needed to compute "the next Monday" correctly for a user
// whose zone differs from the server's.
export function localDatePartsInZone(date: Date, timeZone: string): ZonedDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdayName = get("weekday");
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: Math.max(WEEKDAYS.indexOf(weekdayName), 0),
  };
}
