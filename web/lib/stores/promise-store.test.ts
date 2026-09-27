import { describe, expect, it } from "vitest";
import { filteredPromises, type PromiseRecord } from "./promise-store";

function promise(overrides: Partial<PromiseRecord> = {}): PromiseRecord {
  return {
    id: "1",
    direction: "INCOMING",
    personName: null,
    personEmail: null,
    commitment: "Send the thing",
    dueAt: null,
    status: "ACTIVE",
    derivedStatus: "ACTIVE",
    confidence: null,
    sourceEmail: null,
    relatedTask: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("filteredPromises", () => {
  const promises = [
    promise({ id: "incoming-active", direction: "INCOMING", derivedStatus: "ACTIVE" }),
    promise({ id: "outgoing-active", direction: "OUTGOING", derivedStatus: "ACTIVE" }),
    promise({ id: "incoming-due-soon", direction: "INCOMING", derivedStatus: "DUE_SOON" }),
    promise({ id: "outgoing-overdue", direction: "OUTGOING", derivedStatus: "OVERDUE" }),
    promise({ id: "fulfilled", direction: "INCOMING", status: "FULFILLED", derivedStatus: "FULFILLED" }),
    promise({ id: "dismissed", direction: "INCOMING", status: "DISMISSED", derivedStatus: "DISMISSED" }),
  ];

  it("'all' excludes fulfilled and dismissed", () => {
    const result = filteredPromises(promises, "all");
    expect(result.map((p) => p.id).sort()).toEqual(
      ["incoming-active", "outgoing-active", "incoming-due-soon", "outgoing-overdue"].sort()
    );
  });

  it("'waiting' is active-ish INCOMING only", () => {
    const result = filteredPromises(promises, "waiting");
    expect(result.map((p) => p.id).sort()).toEqual(["incoming-active", "incoming-due-soon"].sort());
  });

  it("'mine' is active-ish OUTGOING only", () => {
    const result = filteredPromises(promises, "mine");
    expect(result.map((p) => p.id).sort()).toEqual(["outgoing-active", "outgoing-overdue"].sort());
  });

  it("'due_soon' and 'overdue' match their derived status regardless of direction", () => {
    expect(filteredPromises(promises, "due_soon").map((p) => p.id)).toEqual(["incoming-due-soon"]);
    expect(filteredPromises(promises, "overdue").map((p) => p.id)).toEqual(["outgoing-overdue"]);
  });

  it("'fulfilled' only shows fulfilled, never dismissed", () => {
    expect(filteredPromises(promises, "fulfilled").map((p) => p.id)).toEqual(["fulfilled"]);
  });
});
