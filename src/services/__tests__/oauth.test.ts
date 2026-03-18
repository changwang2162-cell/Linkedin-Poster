import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  getValidToken,
  encryptTokens,
  TOKEN_EXPIRY_BUFFER_MS,
} from "@/services/oauth";
import { isOk, isErr } from "@/lib/result";

const TEST_SECRET = "a".repeat(64);

describe("OAuth Service", () => {
  beforeEach(() => {
    vi.stubEnv("LINKEDIN_CLIENT_ID", "test-client-id");
    vi.stubEnv("LINKEDIN_CLIENT_SECRET", "test-client-secret");
    vi.stubEnv("ENCRYPTION_SECRET", TEST_SECRET);
  });

  describe("buildAuthorizationUrl", () => {
    it("builds a valid LinkedIn authorization URL", () => {
      const url = buildAuthorizationUrl("csrf-state-123", "http://localhost:3000");
      const parsed = new URL(url);

      expect(parsed.origin).toBe("https://www.linkedin.com");
      expect(parsed.pathname).toBe("/oauth/v2/authorization");
    });

    it("includes required scopes", () => {
      const url = buildAuthorizationUrl("state", "http://localhost:3000");
      const parsed = new URL(url);
      const scope = parsed.searchParams.get("scope");

      expect(scope).toContain("openid");
      expect(scope).toContain("profile");
      expect(scope).toContain("w_member_social");
    });

    it("includes the state parameter", () => {
      const url = buildAuthorizationUrl("my-csrf-state", "http://localhost:3000");
      const parsed = new URL(url);

      expect(parsed.searchParams.get("state")).toBe("my-csrf-state");
    });

    it("includes response_type=code", () => {
      const url = buildAuthorizationUrl("state", "http://localhost:3000");
      const parsed = new URL(url);

      expect(parsed.searchParams.get("response_type")).toBe("code");
    });

    it("includes client_id from env", () => {
      const url = buildAuthorizationUrl("state", "http://localhost:3000");
      const parsed = new URL(url);

      expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
    });

    it("includes redirect_uri pointing to callback", () => {
      const url = buildAuthorizationUrl("state", "http://localhost:3000");
      const parsed = new URL(url);

      expect(parsed.searchParams.get("redirect_uri")).toBe(
        "http://localhost:3000/api/auth/callback"
      );
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("returns error when fetch fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("Network error"))
      );

      const result = await exchangeCodeForTokens("bad-code", "http://localhost:3000");

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("AUTH_FAILED");
      }

      vi.unstubAllGlobals();
    });

    it("returns error when LinkedIn returns error response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          json: async () => ({ error: "invalid_grant" }),
        })
      );

      const result = await exchangeCodeForTokens("bad-code", "http://localhost:3000");

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("AUTH_FAILED");
        expect(result.error.requiresReauth).toBe(true);
      }

      vi.unstubAllGlobals();
    });

    it("returns tokens on successful exchange", async () => {
      const mockTokenResponse = {
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        expires_in: 3600,
        id_token: "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0LWxpbmtlZGluLWlkIiwibmFtZSI6IlRlc3QgVXNlciJ9.sig",
      };

      const mockProfileResponse = {
        sub: "test-linkedin-id",
        name: "Test User",
      };

      vi.stubGlobal(
        "fetch",
        vi.fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => mockTokenResponse,
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => mockProfileResponse,
          })
      );

      const result = await exchangeCodeForTokens("valid-code", "http://localhost:3000");

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.accessToken).toBe("test-access-token");
        expect(result.data.refreshToken).toBe("test-refresh-token");
        expect(result.data.linkedInId).toBe("test-linkedin-id");
        expect(result.data.displayName).toBe("Test User");
        expect(result.data.expiresAt).toBeInstanceOf(Date);
      }

      vi.unstubAllGlobals();
    });
  });

  describe("getValidToken", () => {
    function makeEncryptedAuth(expiresAt: Date) {
      const { encryptedAccess, encryptedRefresh } = encryptTokens(
        { accessToken: "real-access-token", refreshToken: "real-refresh-token" },
        TEST_SECRET
      );
      return {
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        expiresAt,
      };
    }

    it("returns the token when not expired", async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      const mockAuth = makeEncryptedAuth(futureDate);

      const result = await getValidToken(mockAuth, TEST_SECRET);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toBe("real-access-token");
      }
    });

    it("returns TOKEN_EXPIRED when token is expired and refresh fails", async () => {
      const pastDate = new Date(Date.now() - 1000);
      const mockAuth = makeEncryptedAuth(pastDate);

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          json: async () => ({ error: "invalid_grant" }),
        })
      );

      const result = await getValidToken(mockAuth, TEST_SECRET);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(["TOKEN_EXPIRED", "REFRESH_FAILED"]).toContain(result.error.code);
        expect(result.error.requiresReauth).toBe(true);
      }

      vi.unstubAllGlobals();
    });

    it("detects tokens nearing expiry within buffer", async () => {
      const nearExpiry = new Date(Date.now() + TOKEN_EXPIRY_BUFFER_MS - 1000);
      const mockAuth = makeEncryptedAuth(nearExpiry);

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          json: async () => ({ error: "invalid_grant" }),
        })
      );

      const result = await getValidToken(mockAuth, TEST_SECRET);

      expect(isErr(result)).toBe(true);

      vi.unstubAllGlobals();
    });

    it("returns refreshed token when near expiry and refresh succeeds", async () => {
      const nearExpiry = new Date(Date.now() + TOKEN_EXPIRY_BUFFER_MS - 1000);
      const mockAuth = makeEncryptedAuth(nearExpiry);

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            access_token: "new-access-token",
            expires_in: 3600,
          }),
        })
      );

      const result = await getValidToken(mockAuth, TEST_SECRET);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toBe("new-access-token");
      }

      vi.unstubAllGlobals();
    });
  });
});
