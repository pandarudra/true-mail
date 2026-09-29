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

  it("throws on a non-2xx response", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "server error", json: async () => ({}) })
    );
    await expect(chatWithTools({ messages: [], tools: [], maxTokens: 100 })).rejects.toThrow(/NVIDIA API error/);
  });
});
