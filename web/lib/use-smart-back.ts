import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DEFAULT_FALLBACK_ROUTE, useNavHistoryStore } from "@/lib/stores/nav-history-store";

// A history entry we push (once, per fresh tab session) behind a directly-
// entered page so a physical/mouse/mobile Back press has something of ours
// to land on instead of leaving the app or doing nothing.
const GUARD_MARKER = "__truemailNavGuard";

/**
 * Mount once near the app root. Records every pathname the app renders into
 * the shared nav-history stack, and — only for a page opened with no prior
 * internal history — plants a guard history entry so the physical Back
 * button also respects the fallback instead of exiting the app.
 */
export function useTrackNavigationHistory() {
  const pathname = usePathname();
  const router = useRouter();
  const hydrate = useNavHistoryStore((s) => s.hydrate);
  const track = useNavHistoryStore((s) => s.track);

  useEffect(() => {
    hydrate();
    // ponytail: guard is installed once per real page load (checked via
    // history.state, which survives a refresh) — never on every render.
    if (window.history.state?.[GUARD_MARKER]) return;
    if (useNavHistoryStore.getState().stack.length > 1) return;
    const state = window.history.state;
    window.history.replaceState({ ...state, [GUARD_MARKER]: "fallback" }, "", window.location.href);
    window.history.pushState({ ...state, [GUARD_MARKER]: "current" }, "", window.location.href);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    track(pathname);
  }, [pathname, track]);

  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      if (event.state?.[GUARD_MARKER] === "fallback") {
        router.replace(DEFAULT_FALLBACK_ROUTE);
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [router]);
}

/**
 * Returns a function that navigates to the previous internal page, or to
 * `fallbackRoute` when there isn't one (direct entry, or already at the
 * bottom of the tracked stack).
 */
export function useSmartBack(fallbackRoute: string = DEFAULT_FALLBACK_ROUTE) {
  const router = useRouter();
  return () => {
    const previous = useNavHistoryStore.getState().pop();
    router.push(previous ?? fallbackRoute);
  };
}
