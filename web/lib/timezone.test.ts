import { describe, expect, it } from "vitest";
import { zonedTimeToUtc, localDatePartsInZone } from "./timezone";

describe("zonedTimeToUtc", () => {
  it("converts a no-DST zone correctly (Asia/Kolkata, UTC+5:30 year-round)", () => {
    const result = zonedTimeToUtc(2026, 9, 27, 21, 0, "Asia/Kolkata");
    expect(result.toISOString()).toBe(new Date(Date.UTC(2026, 8, 27, 15, 30)).toISOString());
  });

  // 2026's US spring-forward is the 2nd Sunday of March = March 8. Confirmed
  // directly against Intl before writing this: NY is GMT-5 on Mar 7 and
  // GMT-4 on Mar 9. A naive "add a fixed offset" implementation gets this
  // wrong across the transition — this is exactly the bug class the spec
  // calls out ("correctly handle... daylight saving").
  it("uses EST (UTC-5) the day before the US spring-forward transition", () => {
    const result = zonedTimeToUtc(2026, 3, 7, 9, 0, "America/New_York");
    expect(result.toISOString()).toBe(new Date(Date.UTC(2026, 2, 7, 14, 0)).toISOString());
  });

  it("uses EDT (UTC-4) the day after the US spring-forward transition", () => {
    const result = zonedTimeToUtc(2026, 3, 9, 9, 0, "America/New_York");
    expect(result.toISOString()).toBe(new Date(Date.UTC(2026, 2, 9, 13, 0)).toISOString());
  });

  it("handles midnight without rolling to the wrong day", () => {
    const result = zonedTimeToUtc(2026, 1, 15, 0, 0, "America/New_York");
    // EST is UTC-5, so 00:00 local Jan 15 is 05:00 UTC the same day.
    expect(result.toISOString()).toBe(new Date(Date.UTC(2026, 0, 15, 5, 0)).toISOString());
  });
});

describe("localDatePartsInZone", () => {
  it("reports a later calendar day for a zone ahead of UTC near midnight UTC", () => {
    // 20:00 UTC + 5:30 (IST) = 01:30 the *next* local day.
    const utcInstant = new Date(Date.UTC(2026, 8, 27, 20, 0));
    const parts = localDatePartsInZone(utcInstant, "Asia/Kolkata");
    expect(parts).toMatchObject({ year: 2026, month: 9, day: 28 });
  });

  it("reports the correct weekday index (0=Sun..6=Sat)", () => {
    // Sept 27, 2026 is a Sunday.
    const parts = localDatePartsInZone(new Date(Date.UTC(2026, 8, 27, 12)), "UTC");
    expect(parts.weekday).toBe(0);
  });
});
