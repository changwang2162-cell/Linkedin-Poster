import { describe, it, expect } from "vitest";
import { ok, err, isOk, isErr, unwrap, unwrapErr } from "@/lib/result";

describe("Result utility", () => {
  describe("ok()", () => {
    it("creates a success result", () => {
      const result = ok(42);
      expect(result).toEqual({ success: true, data: 42 });
    });

    it("works with complex objects", () => {
      const data = { sessionId: "abc", fileCount: 5 };
      const result = ok(data);
      expect(result.success).toBe(true);
      expect(result).toEqual({ success: true, data });
    });
  });

  describe("err()", () => {
    it("creates an error result", () => {
      const error = { code: "FILE_TOO_LARGE" as const, message: "Too big" };
      const result = err(error);
      expect(result).toEqual({ success: false, error });
    });
  });

  describe("isOk()", () => {
    it("returns true for success results", () => {
      expect(isOk(ok("hello"))).toBe(true);
    });

    it("returns false for error results", () => {
      expect(isOk(err({ code: "ERROR", message: "fail" }))).toBe(false);
    });

    it("narrows type correctly", () => {
      const result = ok(42) as ReturnType<typeof ok<number>> | ReturnType<typeof err<{ code: string }>>;
      if (isOk(result)) {
        expect(result.data).toBe(42);
      }
    });
  });

  describe("isErr()", () => {
    it("returns true for error results", () => {
      expect(isErr(err({ code: "ERROR" }))).toBe(true);
    });

    it("returns false for success results", () => {
      expect(isErr(ok(42))).toBe(false);
    });
  });

  describe("unwrap()", () => {
    it("returns data from success result", () => {
      expect(unwrap(ok(42))).toBe(42);
    });

    it("throws on error result", () => {
      expect(() => unwrap(err({ code: "ERROR", message: "fail" }))).toThrow(
        "Called unwrap on an error result"
      );
    });
  });

  describe("unwrapErr()", () => {
    it("returns error from error result", () => {
      const error = { code: "ERROR", message: "fail" };
      expect(unwrapErr(err(error))).toEqual(error);
    });

    it("throws on success result", () => {
      expect(() => unwrapErr(ok(42))).toThrow(
        "Called unwrapErr on a success result"
      );
    });
  });
});
