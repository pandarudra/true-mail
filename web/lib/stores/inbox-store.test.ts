import { describe, expect, it } from "vitest";
import { shallow } from "zustand/shallow";
import { filteredEmails, type Email, type InboxState } from "./inbox-store";

function email(overrides: Partial<Email> = {}): Email {
  return {
    id: "1",
    direction: "in",
    status: "received",
    from: "a@example.com",
    to: ["me@example.com"],
    subject: "Hello",
    text: "world",
    html: null,
    createdAt: new Date().toISOString(),
    read: false,
    starred: false,
    important: false,
    archived: false,
    spam: false,
    trashedAt: null,
    labels: [],
    attachments: [],
    ...overrides,
  };
}

function state(overrides: Partial<Pick<InboxState, "emails" | "query">>): InboxState {
  return { emails: [], query: "", ...overrides } as unknown as InboxState;
}

describe("filteredEmails", () => {
  it("returns the same array reference when there's no search query", () => {
    const emails = [email()];
    const s = state({ emails, query: "" });
    expect(filteredEmails(s)).toBe(emails);
  });

  // useFilteredEmails() wraps this selector in zustand's useShallow, which
  // relies on this exact property to avoid React's "getSnapshot should be
  // cached" infinite-loop guard: repeated calls on the same underlying
  // state must be shallow-equal, even though `.filter()` always allocates
  // a new array. If this regresses (e.g. filtering starts mapping emails
  // to new objects), useShallow can no longer save the hook from looping.
  it("returns shallow-equal results across repeated calls with a search query", () => {
    const emails = [email({ id: "1", subject: "Deploy Friday" }), email({ id: "2", subject: "Invoice" })];
    const s = state({ emails, query: "deploy" });
    const first = filteredEmails(s);
    const second = filteredEmails(s);
    expect(first).not.toBe(second);
    expect(shallow(first, second)).toBe(true);
  });

  it("filters by from, subject, or text", () => {
    const emails = [
      email({ id: "1", from: "john@example.com", subject: "unrelated", text: "nothing" }),
      email({ id: "2", from: "x@example.com", subject: "Deploy plan", text: "nothing" }),
      email({ id: "3", from: "x@example.com", subject: "unrelated", text: "mentions deploy here" }),
      email({ id: "4", from: "x@example.com", subject: "unrelated", text: "nothing" }),
    ];
    const result = filteredEmails(state({ emails, query: "deploy" }));
    expect(result.map((e) => e.id)).toEqual(["2", "3"]);
  });
});
