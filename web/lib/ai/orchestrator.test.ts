import { describe, expect, it, vi } from "vitest";
import { isChitChat, isLeakedToolCall, runToolLoop, toUtcIso, type ToolHandlerMap } from "./orchestrator";
import type { ChatTurn } from "./orchestrator-shared";
import type { ChatFn, ToolDef } from "./nvidia";

const NO_TOOLS: ToolDef[] = [];

function turn(role: "user" | "assistant", content: string): ChatTurn {
  return { role, content };
}

describe("runToolLoop", () => {
  it("returns the model's content directly when it makes no tool calls", async () => {
    const chatFn: ChatFn = vi.fn().mockResolvedValue({ content: "Hello there." });
    const result = await runToolLoop("user-1", [turn("user", "hi")], {
      chatFn,
      handlers: {},
      tools: NO_TOOLS,
      systemPrompt: "system",
    });
    expect(result).toEqual({ message: "Hello there.", citations: [], actions: [] });
    expect(chatFn).toHaveBeenCalledTimes(1);
  });

  it("falls back to the apology message instead of showing a leaked tool-call blob as the answer", async () => {
    const chatFn: ChatFn = vi
      .fn()
      .mockResolvedValue({ content: '{"name": "search_emails", "parameters": {"query": "respond"}}' });
    const result = await runToolLoop("user-1", [turn("user", "what emails need a reply?")], {
      chatFn,
      handlers: {},
      tools: NO_TOOLS,
      systemPrompt: "system",
    });
    expect(result.message).toMatch(/rabbit hole/);
    expect(result.message).not.toContain('"name"');
  });

  it("executes a tool call, feeds the result back, and returns the final answer", async () => {
    const chatFn: ChatFn = vi
      .fn()
      .mockResolvedValueOnce({ toolCalls: [{ id: "call_1", name: "get_weather", rawArguments: '{"city":"Paris"}' }] })
      .mockResolvedValueOnce({ content: "It's 14C and cloudy in Paris." });
    const handlers: ToolHandlerMap = {
      get_weather: vi.fn().mockResolvedValue({ tempC: 14, condition: "cloudy" }),
    };
    const result = await runToolLoop("user-1", [turn("user", "weather in paris?")], {
      chatFn,
      handlers,
      tools: NO_TOOLS,
      systemPrompt: "system",
    });
    expect(result.message).toBe("It's 14C and cloudy in Paris.");
    expect(handlers.get_weather).toHaveBeenCalledWith("user-1", { city: "Paris" });
    expect(chatFn).toHaveBeenCalledTimes(2);
  });

  it("turns a tool handler error into a tool-role message instead of throwing", async () => {
    const chatFn: ChatFn = vi
      .fn()
      .mockResolvedValueOnce({ toolCalls: [{ id: "call_1", name: "broken_tool", rawArguments: "{}" }] })
      .mockResolvedValueOnce({ content: "Sorry, that failed." });
    const handlers: ToolHandlerMap = {
      broken_tool: vi.fn().mockRejectedValue(new Error("boom")),
    };
    const result = await runToolLoop("user-1", [turn("user", "do it")], {
      chatFn,
      handlers,
      tools: NO_TOOLS,
      systemPrompt: "system",
    });
    expect(result.message).toBe("Sorry, that failed.");
    const secondCallArgs = (chatFn as ReturnType<typeof vi.fn>).mock.calls[1][0];
    const toolMessage = secondCallArgs.messages.at(-1);
    expect(toolMessage.role).toBe("tool");
    expect(JSON.parse(toolMessage.content)).toEqual({ error: "boom" });
  });

  it("turns a hallucinated (unregistered) tool name into a tool-role error, not a crash", async () => {
    const chatFn: ChatFn = vi
      .fn()
      .mockResolvedValueOnce({ toolCalls: [{ id: "call_1", name: "nonexistent_tool", rawArguments: "{}" }] })
      .mockResolvedValueOnce({ content: "I couldn't do that." });
    const result = await runToolLoop("user-1", [turn("user", "do the impossible")], {
      chatFn,
      handlers: {},
      tools: NO_TOOLS,
      systemPrompt: "system",
    });
    expect(result.message).toBe("I couldn't do that.");
    const secondCallArgs = (chatFn as ReturnType<typeof vi.fn>).mock.calls[1][0];
    const toolMessage = secondCallArgs.messages.at(-1);
    expect(toolMessage.role).toBe("tool");
    expect(JSON.parse(toolMessage.content).error).toMatch(/unknown tool/);
  });

  it("turns malformed JSON tool-call arguments into a tool-role error, not a crash", async () => {
    const chatFn: ChatFn = vi
      .fn()
      .mockResolvedValueOnce({ toolCalls: [{ id: "call_1", name: "some_tool", rawArguments: "not json" }] })
      .mockResolvedValueOnce({ content: "Let me try again." });
    const handlers: ToolHandlerMap = { some_tool: vi.fn() };
    const result = await runToolLoop("user-1", [turn("user", "do it")], {
      chatFn,
      handlers,
      tools: NO_TOOLS,
      systemPrompt: "system",
    });
    expect(result.message).toBe("Let me try again.");
    expect(handlers.some_tool).not.toHaveBeenCalled();
  });

  it("stops after the iteration cap and returns a fallback message", async () => {
    const chatFn: ChatFn = vi.fn().mockResolvedValue({ toolCalls: [{ id: "call_1", name: "loopy", rawArguments: "{}" }] });
    const handlers: ToolHandlerMap = { loopy: vi.fn().mockResolvedValue({ ok: true }) };
    const result = await runToolLoop("user-1", [turn("user", "loop forever")], {
      chatFn,
      handlers,
      tools: NO_TOOLS,
      systemPrompt: "system",
      maxIterations: 3,
    });
    expect(chatFn).toHaveBeenCalledTimes(3);
    expect(result.message).toMatch(/rabbit hole/);
    // The final call must have asked for a text-only response — a mock
    // that ignores tool_choice (like this one) is the true worst case,
    // which is exactly what this test is pinning.
    const lastCallArgs = (chatFn as ReturnType<typeof vi.fn>).mock.calls[2][0];
    expect(lastCallArgs.toolChoice).toBe("none");
  });

  it("forces a real final answer on the last iteration instead of exhausting the budget on tool calls", async () => {
    // Reproduces the live-observed failure: the model keeps calling tools
    // (never settling on an answer) right up to the cap. Forcing
    // tool_choice: "none" on the final call must make it answer with
    // whatever it has gathered, instead of falling through to the generic
    // apology message.
    const chatFn: ChatFn = vi
      .fn()
      .mockResolvedValueOnce({ toolCalls: [{ id: "call_1", name: "search_emails", rawArguments: "{}" }] })
      .mockResolvedValueOnce({ toolCalls: [{ id: "call_2", name: "search_emails", rawArguments: "{}" }] })
      .mockImplementationOnce(async (opts) => {
        // A well-behaved model honors tool_choice: "none" by answering.
        return opts.toolChoice === "none"
          ? { content: "Here's what I found so far." }
          : { toolCalls: [{ id: "call_3", name: "search_emails", rawArguments: "{}" }] };
      });
    const handlers: ToolHandlerMap = { search_emails: vi.fn().mockResolvedValue([]) };
    const result = await runToolLoop("user-1", [turn("user", "what emails need a reply?")], {
      chatFn,
      handlers,
      tools: NO_TOOLS,
      systemPrompt: "system",
      maxIterations: 3,
    });
    expect(result.message).toBe("Here's what I found so far.");
    expect(chatFn).toHaveBeenCalledTimes(3);
  });

  it("de-dupes citations by email id across both search_emails and get_email calls", async () => {
    const chatFn: ChatFn = vi
      .fn()
      .mockResolvedValueOnce({ toolCalls: [{ id: "call_1", name: "search_emails", rawArguments: '{"query":"a"}' }] })
      .mockResolvedValueOnce({ toolCalls: [{ id: "call_2", name: "get_email", rawArguments: '{"id":"email-1"}' }] })
      .mockResolvedValueOnce({ content: "Found it." });
    const handlers: ToolHandlerMap = {
      search_emails: vi.fn().mockResolvedValue([{ id: "email-1", from: "a@x.com", subject: "Subj", snippet: "short" }]),
      get_email: vi.fn().mockResolvedValue({ id: "email-1", from: "a@x.com", subject: "Subj", body: "the full body text" }),
    };
    const result = await runToolLoop("user-1", [turn("user", "find it")], {
      chatFn,
      handlers,
      tools: NO_TOOLS,
      systemPrompt: "system",
    });
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].emailId).toBe("email-1");
  });

  it("collects propose_task calls as suggested actions without executing a create", async () => {
    const chatFn: ChatFn = vi
      .fn()
      .mockResolvedValueOnce({
        toolCalls: [{ id: "call_1", name: "propose_task", rawArguments: '{"title":"Send proposal"}' }],
      })
      .mockResolvedValueOnce({ content: "Want me to create that?" });
    const createTask = vi.fn();
    const handlers: ToolHandlerMap = {
      propose_task: vi.fn().mockResolvedValue({ noted: true }),
      create_task: createTask,
    };
    const result = await runToolLoop("user-1", [turn("user", "did I promise anything?")], {
      chatFn,
      handlers,
      tools: NO_TOOLS,
      systemPrompt: "system",
    });
    expect(result.actions).toEqual([
      { type: "create_task", label: "Create task: Send proposal", params: { title: "Send proposal" } },
    ]);
    expect(createTask).not.toHaveBeenCalled();
  });

  it("does not crash when a tool call's arguments parse to a non-object (e.g. JSON `null`)", async () => {
    const chatFn: ChatFn = vi
      .fn()
      .mockResolvedValueOnce({ toolCalls: [{ id: "call_1", name: "propose_task", rawArguments: "null" }] })
      .mockResolvedValueOnce({ content: "Handled it." });
    const result = await runToolLoop("user-1", [turn("user", "do it")], {
      chatFn,
      handlers: { propose_task: vi.fn().mockResolvedValue({ noted: true }) },
      tools: NO_TOOLS,
      systemPrompt: "system",
    });
    expect(result.message).toBe("Handled it.");
  });

  it("does not produce a suggested action for a propose_* call whose arguments failed to parse", async () => {
    const chatFn: ChatFn = vi
      .fn()
      .mockResolvedValueOnce({ toolCalls: [{ id: "call_1", name: "propose_task", rawArguments: "not json" }] })
      .mockResolvedValueOnce({ content: "Sorry, couldn't do that." });
    const propose = vi.fn().mockResolvedValue({ noted: true });
    const result = await runToolLoop("user-1", [turn("user", "do it")], {
      chatFn,
      handlers: { propose_task: propose },
      tools: NO_TOOLS,
      systemPrompt: "system",
    });
    expect(result.actions).toEqual([]);
    expect(propose).not.toHaveBeenCalled();
  });
});

describe("toUtcIso", () => {
  it("converts a bare local date to midnight UTC in that offset", () => {
    // timezoneOffsetMinutes matches Date.getTimezoneOffset(): positive west
    // of UTC. -330 = UTC+5:30 (IST) — local midnight is the previous day
    // 18:30 UTC.
    expect(toUtcIso("2026-09-30", -330)).toBe("2026-09-29T18:30:00.000Z");
  });

  it("converts a local datetime to the matching UTC instant", () => {
    expect(toUtcIso("2026-09-30T09:00:00", -330)).toBe("2026-09-30T03:30:00.000Z");
  });

  it("returns null for an unparseable date instead of throwing", () => {
    expect(toUtcIso("not a date", 0)).toBeNull();
  });

  it("returns null for an empty or missing value", () => {
    expect(toUtcIso("", 0)).toBeNull();
    expect(toUtcIso(undefined, 0)).toBeNull();
    expect(toUtcIso(null, 0)).toBeNull();
  });
});

describe("isChitChat", () => {
  it("recognizes common greetings and small talk", () => {
    expect(isChitChat("hi")).toBe(true);
    expect(isChitChat("Hi!")).toBe(true);
    expect(isChitChat("hello")).toBe(true);
    expect(isChitChat("hey there")).toBe(true);
    expect(isChitChat("hello tomy")).toBe(true);
    expect(isChitChat("hi tomy!")).toBe(true);
    expect(isChitChat("hey tomy")).toBe(true);
    expect(isChitChat("good morning")).toBe(true);
    expect(isChitChat("how are you?")).toBe(true);
    expect(isChitChat("thanks!")).toBe(true);
    expect(isChitChat("thank you")).toBe(true);
    expect(isChitChat("ok")).toBe(true);
    expect(isChitChat("cool")).toBe(true);
  });

  it("does not misclassify real questions about the user's data, even short ones", () => {
    expect(isChitChat("tasks?")).toBe(false);
    expect(isChitChat("what emails do I have")).toBe(false);
    expect(isChitChat("any promises due today")).toBe(false);
    expect(isChitChat("create a task to do laundry")).toBe(false);
  });
});

describe("isLeakedToolCall", () => {
  // Live-reproduced: forced onto tool_choice:"none" with nothing left to
  // call, this model sometimes writes out the tool call it wanted to make
  // as JSON text instead of actually answering in words — e.g. exactly
  // {"name": "search_emails", "parameters": {"query": "respond", ...}}.
  // That must never reach the user as if it were a real answer.
  it("recognizes a tool-call-shaped JSON blob standing in for an answer", () => {
    expect(isLeakedToolCall('{"name": "search_emails", "parameters": {"query": "respond"}}')).toBe(true);
    expect(isLeakedToolCall('{"name":"complete_task","arguments":{"id":"123"}}')).toBe(true);
  });

  it("does not misclassify a real natural-language answer", () => {
    expect(isLeakedToolCall("Here's what I found so far.")).toBe(false);
    expect(isLeakedToolCall("You have 3 tasks due today.")).toBe(false);
    expect(isLeakedToolCall("")).toBe(false);
  });

  it("does not misclassify an answer that happens to mention JSON-like data in prose", () => {
    expect(isLeakedToolCall('The invoice total is {"amount": 245} according to the email.')).toBe(false);
  });
});
