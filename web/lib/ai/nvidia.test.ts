import { afterEach, describe, expect, it, vi } from "vitest";
import { chatJSON, chatWithTools, stripJsonFence } from "./nvidia";

function mockFetchOnce(content: string, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 500,
      text: async () => "error body",
      json: async () => ({ choices: [{ message: { content } }] }),
    })
  );
}

describe("stripJsonFence", () => {
  it("strips a ```json fence", () => {
    expect(stripJsonFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("strips a plain ``` fence", () => {
    expect(stripJsonFence('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("passes through unfenced content unchanged", () => {
    expect(stripJsonFence('{"a":1}')).toBe('{"a":1}');
  });
});

describe("chatJSON", () => {
  const originalEnv = process.env.NVIDIA_API_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.NVIDIA_API_KEY = originalEnv;
  });

  it("parses fenced JSON from the model", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    mockFetchOnce('```json\n{"summary":"ok"}\n```');
    const result = await chatJSON<{ summary: string }>({ system: "s", user: "u", maxTokens: 10 });
    expect(result).toEqual({ summary: "ok" });
  });

  it("throws a descriptive error on invalid JSON", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    mockFetchOnce("not json at all");
    await expect(chatJSON({ system: "s", user: "u", maxTokens: 10 })).rejects.toThrow(/invalid JSON/);
  });

  it("throws on a non-2xx response", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    mockFetchOnce("irrelevant", false);
    await expect(chatJSON({ system: "s", user: "u", maxTokens: 10 })).rejects.toThrow(/NVIDIA API error/);
  });
});

describe("chatWithTools", () => {
  const originalEnv = process.env.NVIDIA_API_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.NVIDIA_API_KEY = originalEnv;
  });

  it("returns toolCalls when the model requests a tool", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({
          choices: [
            {
              message: {
                content: null,
                tool_calls: [{ id: "call_1", function: { name: "search_emails", arguments: '{"query":"invoice"}' } }],
              },
            },
          ],
        }),
      })
    );
    const result = await chatWithTools({ messages: [{ role: "user", content: "hi" }], tools: [], maxTokens: 100 });
    expect(result).toEqual({ toolCalls: [{ id: "call_1", name: "search_emails", rawArguments: '{"query":"invoice"}' }] });
  });

  it("returns content when the model answers directly", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({ choices: [{ message: { content: "Here is your answer." } }] }),
      })
    );
    const result = await chatWithTools({ messages: [{ role: "user", content: "hi" }], tools: [], maxTokens: 100 });
    expect(result).toEqual({ content: "Here is your answer." });
  });

  it("omits tools entirely when toolChoice: \"none\" is passed, forcing a text-only response", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({ choices: [{ message: { content: "Forced final answer.", tool_calls: [] } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await chatWithTools({
      messages: [{ role: "user", content: "hi" }],
      tools: [{ name: "some_tool", description: "d", parameters: {} }],
      maxTokens: 100,
      toolChoice: "none",
    });
    expect(result).toEqual({ content: "Forced final answer." });
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentBody.tools).toBeUndefined();
    expect(sentBody.tool_choice).toBeUndefined();
  });

  it("defaults tool_choice to auto when toolChoice is omitted", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await chatWithTools({ messages: [{ role: "user", content: "hi" }], tools: [], maxTokens: 100 });
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentBody.tool_choice).toBe("auto");
  });

  it("throws on a non-2xx response", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "server error", json: async () => ({}) })
    );
    await expect(chatWithTools({ messages: [], tools: [], maxTokens: 100 })).rejects.toThrow(/NVIDIA API error/);
  });
});

// Live-reproduced: NVIDIA's endpoint occasionally returns a transient 5xx
// ("Inference connection error") on an otherwise-correct request — not a
// bug here, but leaving it unhandled surfaces "AI is temporarily
// unavailable" to the user for what a single retry would usually recover
// from.
describe("retries once on a transient 5xx before giving up", () => {
  const originalEnv = process.env.NVIDIA_API_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.NVIDIA_API_KEY = originalEnv;
  });

  it("chatJSON succeeds after one retry following a 500", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "boom", json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({ choices: [{ message: { content: '{"a":1}' } }] }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const result = await chatJSON<{ a: number }>({ system: "s", user: "u", maxTokens: 10 });
    expect(result).toEqual({ a: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("chatWithTools succeeds after one retry following a 502", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 502, text: async () => "bad gateway", json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({ choices: [{ message: { content: "ok now" } }] }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const result = await chatWithTools({ messages: [{ role: "user", content: "hi" }], tools: [], maxTokens: 10 });
    expect(result).toEqual({ content: "ok now" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after a second consecutive 5xx — only one retry", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 500, text: async () => "still broken", json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(chatJSON({ system: "s", user: "u", maxTokens: 10 })).rejects.toThrow(/NVIDIA API error/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry on a 4xx client error", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 400, text: async () => "bad request", json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(chatJSON({ system: "s", user: "u", maxTokens: 10 })).rejects.toThrow(/NVIDIA API error/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
