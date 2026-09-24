import { describe, expect, it } from "vitest";
import { normalizeCategory } from "./calendarific";

describe("normalizeCategory", () => {
  it("buckets Calendarific's free-text type strings into our categories", () => {
    expect(normalizeCategory(["National holiday"])).toBe("NATIONAL");
    expect(normalizeCategory(["Local holiday"])).toBe("LOCAL");
    expect(normalizeCategory(["Bank holiday"])).toBe("BANK");
    expect(normalizeCategory(["Hinduism"])).toBe("RELIGIOUS");
    expect(normalizeCategory(["Christian"])).toBe("RELIGIOUS");
  });

  it("falls back to OBSERVANCE for anything unrecognized", () => {
    expect(normalizeCategory(["Optional holiday"])).toBe("OBSERVANCE");
    expect(normalizeCategory([])).toBe("OBSERVANCE");
  });
});
