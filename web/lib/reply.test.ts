import { describe, it, expect } from "vitest";
import { buildReplyPrefill } from "./reply";

const inbound = {
  direction: "in",
  from: "alice@example.com",
  to: ["me@mine.com"],
  cc: ["bob@example.com"],
  subject: "Lunch?",
  text: "Are you free at noon?",
  createdAt: "2026-09-01T12:00:00Z",
};

const outbound = {
  ...inbound,
  direction: "out",
  from: "me@mine.com",
  to: ["alice@example.com"],
  cc: ["bob@example.com"],
};

describe("buildReplyPrefill", () => {
  it("reply targets the sender of an inbound email", () => {
    const p = buildReplyPrefill(inbound, "reply", "me@mine.com");
    expect(p.to).toEqual(["alice@example.com"]);
    expect(p.cc).toEqual([]);
    expect(p.subject).toBe("Re: Lunch?");
  });

  it("reply all cc's the other recipients, excluding yourself", () => {
    const p = buildReplyPrefill(inbound, "replyAll", "me@mine.com");
    expect(p.to).toEqual(["alice@example.com"]);
    expect(p.cc).toEqual(["bob@example.com"]);
  });

  it("reply on an outbound email targets the original recipient", () => {
    const p = buildReplyPrefill(outbound, "reply", "me@mine.com");
    expect(p.to).toEqual(["alice@example.com"]);
  });

  it("does not double-prefix an already-replied subject", () => {
    const p = buildReplyPrefill({ ...inbound, subject: "Re: Lunch?" }, "reply", "me@mine.com");
    expect(p.subject).toBe("Re: Lunch?");
  });

  it("forward leaves recipients empty and prefixes the subject", () => {
    const p = buildReplyPrefill(inbound, "forward", "me@mine.com");
    expect(p.to).toEqual([]);
    expect(p.subject).toBe("Fwd: Lunch?");
    expect(p.text).toContain("From: alice@example.com");
  });
});
