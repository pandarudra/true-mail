import { afterEach, describe, expect, it, vi } from "vitest";
import { parseTaskFromText } from "./parse-task";

function mockModelResponse(content: object) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }),
    })
  );
}

describe("parseTaskFromText", () => {
  const originalEnv = process.env.NVIDIA_API_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.NVIDIA_API_KEY = originalEnv;
  });

  it("returns a plain one-off task unaffected by recurrence fields", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    mockModelResponse({
      title: "Send the proposal",
      dueAt: "2026-01-02T10:00:00",
      recurrenceType: null,
      recurrenceDaysOfWeek: null,
      reminderTime: null,
    });
    const parsed = await parseTaskFromText("send the proposal tomorrow at 10am", 0);
    expect(parsed.title).toBe("Send the proposal");
    expect(parsed.dueAt).toBe("2026-01-02T10:00:00.000Z");
    expect(parsed.dueHasTime).toBe(true);
    expect(parsed.recurrence).toBeNull();
  });

  it("detects a daily recurrence with a stated time", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    mockModelResponse({
      title: "Study DSA",
      dueAt: null,
      recurrenceType: "DAILY",
      recurrenceDaysOfWeek: [],
      reminderTime: "21:00",
    });
    const parsed = await parseTaskFromText("study DSA every day at 9pm", 0);
    expect(parsed.dueAt).toBeNull();
    expect(parsed.recurrence).toEqual({
      recurrenceType: "DAILY",
      recurrenceDaysOfWeek: [],
      reminderTime: "21:00",
    });
  });

  it("leaves reminderTime null when no time was stated, rather than guessing", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    mockModelResponse({
      title: "Study DSA",
      dueAt: null,
      recurrenceType: "DAILY",
      recurrenceDaysOfWeek: [],
      reminderTime: null,
    });
    const parsed = await parseTaskFromText("study DSA every day", 0);
    expect(parsed.recurrence?.reminderTime).toBeNull();
  });

  it("ignores a bogus recurrenceType from the model", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    mockModelResponse({
      title: "Do the thing",
      dueAt: null,
      recurrenceType: "HOURLY",
      recurrenceDaysOfWeek: null,
      reminderTime: null,
    });
    const parsed = await parseTaskFromText("do the thing", 0);
    expect(parsed.recurrence).toBeNull();
  });

  it("drops a stray dueAt when recurrence is detected, so callers never see conflicting signals", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    mockModelResponse({
      title: "Workout",
      dueAt: "2026-01-02T04:00:00",
      recurrenceType: "DAILY",
      recurrenceDaysOfWeek: [],
      reminderTime: "04:00",
    });
    const parsed = await parseTaskFromText("workout daily at 4am", 0);
    expect(parsed.dueAt).toBeNull();
    expect(parsed.recurrence?.reminderTime).toBe("04:00");
  });
});
