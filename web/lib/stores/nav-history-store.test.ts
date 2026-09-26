import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_FALLBACK_ROUTE, useNavHistoryStore } from "./nav-history-store";

// vitest runs these store tests in a plain node environment (no DOM) — stub
// just enough of sessionStorage for the store's read/write helpers.
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  clear() {
    this.data.clear();
  }
}
(globalThis as { sessionStorage?: unknown }).sessionStorage = new MemoryStorage();

function reset() {
  sessionStorage.clear();
  useNavHistoryStore.setState({ stack: [] });
}

describe("nav-history-store", () => {
  beforeEach(reset);

  it("goes back to the previous page for a multi-step chain", () => {
    const { track, pop } = useNavHistoryStore.getState();
    ["/dash", "/a", "/b", "/c"].forEach(track);

    expect(pop()).toBe("/b");
    expect(pop()).toBe("/a");
    expect(pop()).toBe("/dash");
  });

  it("falls back to null (caller uses fallbackRoute) once the stack bottoms out", () => {
    const { track, pop } = useNavHistoryStore.getState();
    track("/a");
    track("/b");

    expect(pop()).toBe("/a");
    expect(pop()).toBeNull();
    expect(pop()).toBeNull();
  });

  it("has no previous page on direct entry", () => {
    const { track, pop } = useNavHistoryStore.getState();
    track("/a");

    expect(pop()).toBeNull();
  });

  it("ignores repeated tracking of the same path (no loop growth)", () => {
    const { track } = useNavHistoryStore.getState();
    track("/a");
    track("/a");
    track("/a");

    expect(useNavHistoryStore.getState().stack).toEqual(["/a"]);
  });

  it("survives a refresh via sessionStorage", () => {
    useNavHistoryStore.getState().track("/a");
    useNavHistoryStore.getState().track("/b");

    // simulate a fresh module load after a page refresh
    useNavHistoryStore.setState({ stack: [] });
    useNavHistoryStore.getState().hydrate();

    expect(useNavHistoryStore.getState().pop()).toBe("/a");
  });

  it("has a configurable fallback route constant", () => {
    expect(DEFAULT_FALLBACK_ROUTE).toBe("/inbox");
  });
});
