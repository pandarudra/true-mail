"use client";

import { useEffect } from "react";

// Mounted once at the app root, same pattern as NavigationHistoryTracker.
// Auto-detects the browser's IANA zone and saves it once if the user has
// never set one — mirrors theme-store's "pick up what the browser already
// tells us" approach for dark mode. A no-op for logged-out visitors (the
// GET 401s and nothing else happens) and for anyone who already has a
// timezone saved (only ever PATCHes when it's unset).
export function TimezoneSync() {
  useEffect(() => {
    fetch("/api/settings/timezone")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || data.timezone) return;
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (!detected) return;
        fetch("/api/settings/timezone", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timezone: detected }),
        }).catch(() => {});
      })
      .catch(() => {});
  }, []);

  return null;
}
