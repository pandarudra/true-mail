import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "./crypto";

describe("crypto", () => {
  it("round-trips plaintext", () => {
    const secret = "re_1234567890abcdef";
    const ciphertext = encrypt(secret);
    expect(ciphertext).not.toBe(secret);
    expect(decrypt(ciphertext)).toBe(secret);
  });

  it("rejects tampered ciphertext", () => {
    const ciphertext = encrypt("re_1234567890abcdef");
    const [iv, authTag, data] = ciphertext.split(".");
    const tamperedBytes = Buffer.from(data, "base64");
    tamperedBytes[0] = tamperedBytes[0] ^ 0xff;
    const tampered = [iv, authTag, tamperedBytes.toString("base64")].join(".");
    expect(() => decrypt(tampered)).toThrow();
  });
});
