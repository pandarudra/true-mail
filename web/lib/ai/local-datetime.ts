// Shared by every AI route that asks the model for a "YYYY-MM-DDTHH:mm:ss"
// local datetime (no timezone suffix) and needs to turn that into a real UTC
// ISO string plus whether a clock time was actually stated.

// The model was asked to also return a "hasTime" boolean directly, but it
// unreliably said true even when it had defaulted an implied date to
// midnight (no time was actually stated) — deriving it from the timestamp's
// own shape instead is simpler and doesn't depend on the model getting a
// second field right. Trade-off: a task/event genuinely due at literal
// midnight reads as date-only, which is the rarer case.
export function hasExplicitTime(naiveLocalDateTime: string): boolean {
  return !/T00:00:00(\.000)?$/.test(naiveLocalDateTime);
}

// The model reliably reasons about wall-clock local time ("tomorrow at
// 6pm") but not about converting that into a UTC offset — asking it to do
// both in one step silently drops the conversion. So it only ever returns a
// naive local datetime (no Z), and the UTC conversion is exact arithmetic
// here instead of something an LLM has to get right.
export function localNaiveToUtcIso(naiveLocalDateTime: string, timezoneOffsetMinutes: number): string {
  const utcMs = Date.parse(`${naiveLocalDateTime}Z`) + timezoneOffsetMinutes * 60000;
  return new Date(utcMs).toISOString();
}
