"use client";

import { useTrackNavigationHistory } from "@/lib/use-smart-back";

// Mounted once at the app root — records internal navigation history so
// `useSmartBack` can send Back to the real previous page instead of a
// hardcoded route. Renders nothing.
export function NavigationHistoryTracker() {
  useTrackNavigationHistory();
  return null;
}
