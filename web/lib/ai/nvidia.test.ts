import { afterEach, describe, expect, it, vi } from "vitest";
import { chatJSON, stripJsonFence } from "./nvidia";

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
