import { describe, expect, it } from "vitest";
import { buildSearchQuery, matchesSearchQuery, parseSearchQuery } from "./search-query";

function email(overrides: Partial<Parameters<typeof matchesSearchQuery>[0]> = {}) {
  return {
    from: "John Doe <john@example.com>",
    to: ["me@example.com"],
    subject: "Deploy plan",
    text: "Let's ship Friday",
    createdAt: "2026-09-10T12:00:00.000Z",
    attachments: [] as unknown[],
    ...overrides,
  };
}

describe("parseSearchQuery", () => {
  it("extracts operators and leaves bare words as include terms", () => {
    const parsed = parseSearchQuery('from:john subject:"deploy plan" has:attachment urgent -newsletter');
    expect(parsed.from).toBe("john");
    expect(parsed.subject).toBe("deploy plan");
    expect(parsed.hasAttachment).toBe(true);
    expect(parsed.include).toEqual(["urgent"]);
    expect(parsed.exclude).toEqual(["newsletter"]);
  });

  it("treats plain text with no operators as include words", () => {
    expect(parseSearchQuery("deploy friday")).toMatchObject({ include: ["deploy", "friday"], exclude: [] });
  });
});

describe("matchesSearchQuery", () => {
  it("matches plain single-word queries against from/subject/text, same as before", () => {
    expect(matchesSearchQuery(email(), "deploy")).toBe(true);
    expect(matchesSearchQuery(email(), "invoice")).toBe(false);
  });

  it("filters by from:", () => {
    expect(matchesSearchQuery(email(), "from:john")).toBe(true);
    expect(matchesSearchQuery(email(), "from:sarah")).toBe(false);
  });

  it("filters by to:", () => {
    expect(matchesSearchQuery(email(), "to:me@example.com")).toBe(true);
    expect(matchesSearchQuery(email(), "to:someoneelse")).toBe(false);
  });

  it("filters by has:attachment", () => {
    expect(matchesSearchQuery(email(), "has:attachment")).toBe(false);
    expect(matchesSearchQuery(email({ attachments: [{}] }), "has:attachment")).toBe(true);
  });

  it("filters by after:/before: date range", () => {
    expect(matchesSearchQuery(email(), "after:2026-09-01")).toBe(true);
    expect(matchesSearchQuery(email(), "after:2026-09-15")).toBe(false);
    expect(matchesSearchQuery(email(), "before:2026-09-10")).toBe(true);
    expect(matchesSearchQuery(email(), "before:2026-09-09")).toBe(false);
  });

  it("excludes emails containing a -word", () => {
    expect(matchesSearchQuery(email(), "-friday")).toBe(false);
    expect(matchesSearchQuery(email(), "-nonexistent")).toBe(true);
  });

  it("combines multiple criteria with AND semantics", () => {
    expect(matchesSearchQuery(email(), "from:john subject:deploy")).toBe(true);
    expect(matchesSearchQuery(email(), "from:john subject:invoice")).toBe(false);
  });
});

describe("buildSearchQuery", () => {
  it("builds an operator string from form fields, quoting multi-word values", () => {
    const query = buildSearchQuery({
      from: "john doe",
      to: "",
      subject: "deploy",
      include: "friday",
      exclude: "spam newsletter",
      hasAttachment: true,
      after: "2026-09-01",
      before: "",
    });
    expect(query).toBe('from:"john doe" subject:deploy after:2026-09-01 has:attachment friday -spam -newsletter');
  });

  it("omits empty fields", () => {
    expect(buildSearchQuery({ from: "", to: "", subject: "", include: "", exclude: "", hasAttachment: false, after: "", before: "" })).toBe("");
  });
});
