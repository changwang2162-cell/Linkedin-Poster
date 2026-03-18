import { describe, it, expect, beforeEach } from "vitest";
import { encrypt, decrypt } from "@/lib/encryption";

const TEST_SECRET = "a".repeat(64); // 32-byte hex key

describe("Encryption", () => {
  describe("encrypt", () => {
    it("returns a non-empty string", () => {
      const result = encrypt("hello world", TEST_SECRET);
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
    });

    it("produces different ciphertext for same plaintext (random IV)", () => {
      const a = encrypt("same text", TEST_SECRET);
      const b = encrypt("same text", TEST_SECRET);
      expect(a).not.toBe(b);
    });

    it("encrypts empty string", () => {
      const result = encrypt("", TEST_SECRET);
      expect(result).toBeTruthy();
    });
  });

  describe("decrypt", () => {
    it("decrypts back to original plaintext", () => {
      const plaintext = "my secret token value";
      const encrypted = encrypt(plaintext, TEST_SECRET);
      const decrypted = decrypt(encrypted, TEST_SECRET);
      expect(decrypted).toBe(plaintext);
    });

    it("decrypts empty string correctly", () => {
      const encrypted = encrypt("", TEST_SECRET);
      const decrypted = decrypt(encrypted, TEST_SECRET);
      expect(decrypted).toBe("");
    });

    it("decrypts unicode text", () => {
      const plaintext = "token with émojis 🔑 and ünïcödé";
      const encrypted = encrypt(plaintext, TEST_SECRET);
      const decrypted = decrypt(encrypted, TEST_SECRET);
      expect(decrypted).toBe(plaintext);
    });

    it("fails with wrong key", () => {
      const encrypted = encrypt("secret", TEST_SECRET);
      const wrongKey = "b".repeat(64);
      expect(() => decrypt(encrypted, wrongKey)).toThrow();
    });

    it("fails with tampered ciphertext", () => {
      const encrypted = encrypt("secret", TEST_SECRET);
      const tampered = encrypted.slice(0, -4) + "XXXX";
      expect(() => decrypt(tampered, TEST_SECRET)).toThrow();
    });
  });
});
