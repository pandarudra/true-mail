import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyIntent } from "./intent";

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

describe("classifyIntent", () => {
  const originalKey = process.env.NVIDIA_API_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.NVIDIA_API_KEY = originalKey;
  });

  it("maps a recognized intent through", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    mockFetchOnce('{"intent":"create_task"}');
    const result = await classifyIntent("remind me to call Rahul tomorrow");
    expect(result).toEqual({ intent: "create_task", text: "remind me to call Rahul tomorrow" });
  });

  it("falls back to unknown for an intent outside the fixed enum", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    mockFetchOnce('{"intent":"delete_all_data"}');
    const result = await classifyIntent("hi");
    expect(result.intent).toBe("unknown");
  });

  it("falls back to unknown on malformed model output instead of throwing", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    mockFetchOnce("not json at all");
    const result = await classifyIntent("hi");
    expect(result.intent).toBe("unknown");
  });

  it("falls back to unknown when the AI call fails outright", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    mockFetchOnce("irrelevant", false);
    const result = await classifyIntent("hi");
    expect(result.intent).toBe("unknown");
  });
});
