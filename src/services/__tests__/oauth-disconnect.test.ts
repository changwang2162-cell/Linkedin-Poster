import { describe, it, expect, vi } from "vitest";
import { revokeLinkedInToken } from "@/services/oauth";
import { isOk, isErr } from "@/lib/result";

describe("OAuth Disconnect", () => {
  describe("revokeLinkedInToken", () => {
    it("returns success when LinkedIn revocation succeeds", async () => {
      vi.stubEnv("LINKEDIN_CLIENT_ID", "test-client-id");
      vi.stubEnv("LINKEDIN_CLIENT_SECRET", "test-client-secret");

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true })
      );

      const result = await revokeLinkedInToken("some-access-token");
      expect(isOk(result)).toBe(true);

      vi.unstubAllGlobals();
    });

    it("returns success even when LinkedIn revocation fails (best effort)", async () => {
      vi.stubEnv("LINKEDIN_CLIENT_ID", "test-client-id");
      vi.stubEnv("LINKEDIN_CLIENT_SECRET", "test-client-secret");

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 400 })
      );

      // Revocation is best-effort; we still delete locally
      const result = await revokeLinkedInToken("some-access-token");
      expect(isOk(result)).toBe(true);

      vi.unstubAllGlobals();
    });

    it("returns success when network error occurs (best effort)", async () => {
      vi.stubEnv("LINKEDIN_CLIENT_ID", "test-client-id");
      vi.stubEnv("LINKEDIN_CLIENT_SECRET", "test-client-secret");

      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("Network error"))
      );

      const result = await revokeLinkedInToken("some-access-token");
      expect(isOk(result)).toBe(true);

      vi.unstubAllGlobals();
    });
  });
});
