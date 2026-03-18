import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  encryptTokens,
  decryptToken,
  getValidToken,
  revokeLinkedInToken,
  TOKEN_EXPIRY_BUFFER_MS,
} from "@/services/oauth";
import { publishToLinkedIn } from "@/services/publisher";
import { isOk, isErr } from "@/lib/result";

describe("OAuth and Publish Integration Pipeline", () => {
  beforeEach(() => {
    vi.stubEnv("LINKEDIN_CLIENT_ID", "test-client-id");
    vi.stubEnv("LINKEDIN_CLIENT_SECRET", "test-client-secret");
    vi.stubEnv("ENCRYPTION_SECRET", "a".repeat(64)); // 32 bytes in hex
    vi.restoreAllMocks();
  });

  describe("OAuth authorization flow", () => {
    it("builds authorization URL with correct params", () => {
      const state = "csrf-token-123";
      const url = buildAuthorizationUrl(state, "http://localhost:3000");

      expect(url).toContain("linkedin.com/oauth/v2/authorization");
      expect(url).toContain("client_id=test-client-id");
      expect(url).toContain("state=csrf-token-123");
      expect(url).toContain("scope=openid+profile+w_member_social");
      expect(url).toContain("redirect_uri=");
      expect(url).toContain("response_type=code");
    });

    it("exchanges authorization code for tokens with mocked LinkedIn", async () => {
      const mockFetch = vi.fn()
        // Token exchange call
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "mock-access-token",
              refresh_token: "mock-refresh-token",
              expires_in: 3600,
            }),
        })
        // Profile fetch call
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              sub: "linkedin-user-123",
              name: "Test User",
            }),
        });

      vi.stubGlobal("fetch", mockFetch);

      const result = await exchangeCodeForTokens("auth-code-xyz", "http://localhost:3000");

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.data.accessToken).toBe("mock-access-token");
      expect(result.data.refreshToken).toBe("mock-refresh-token");
      expect(result.data.linkedInId).toBe("linkedin-user-123");
      expect(result.data.displayName).toBe("Test User");
      expect(result.data.expiresAt).toBeInstanceOf(Date);
      expect(result.data.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("handles token exchange failure", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));

      const result = await exchangeCodeForTokens("bad-code", "http://localhost:3000");

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("AUTH_FAILED");
        expect(result.error.requiresReauth).toBe(true);
      }
    });

    it("handles network failure during token exchange", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network down")));

      const result = await exchangeCodeForTokens("code", "http://localhost:3000");

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("AUTH_FAILED");
      }
    });
  });

  describe("Token storage and encryption", () => {
    it("encrypts and decrypts tokens correctly", () => {
      const secret = "a".repeat(64);
      const tokens = {
        accessToken: "real-access-token-12345",
        refreshToken: "real-refresh-token-67890",
      };

      const encrypted = encryptTokens(tokens, secret);
      expect(encrypted.encryptedAccess).not.toBe(tokens.accessToken);
      expect(encrypted.encryptedRefresh).not.toBe(tokens.refreshToken);

      const decryptedAccess = decryptToken(encrypted.encryptedAccess, secret);
      const decryptedRefresh = decryptToken(encrypted.encryptedRefresh, secret);
      expect(decryptedAccess).toBe("real-access-token-12345");
      expect(decryptedRefresh).toBe("real-refresh-token-67890");
    });

    it("encrypted tokens are different each time (unique IV)", () => {
      const secret = "a".repeat(64);
      const tokens = { accessToken: "same-token", refreshToken: "same-refresh" };

      const enc1 = encryptTokens(tokens, secret);
      const enc2 = encryptTokens(tokens, secret);

      expect(enc1.encryptedAccess).not.toBe(enc2.encryptedAccess);
    });
  });

  describe("Token refresh and expiry handling", () => {
    it("returns valid token when not near expiry", async () => {
      const secret = "a".repeat(64);
      const encrypted = encryptTokens(
        { accessToken: "valid-token", refreshToken: "refresh-token" },
        secret
      );

      const auth = {
        accessToken: encrypted.encryptedAccess,
        refreshToken: encrypted.encryptedRefresh,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      };

      const result = await getValidToken(auth, secret);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toBe("valid-token");
      }
    });

    it("attempts refresh when token is near expiry", async () => {
      const secret = "a".repeat(64);
      const encrypted = encryptTokens(
        { accessToken: "expiring-token", refreshToken: "refresh-token" },
        secret
      );

      const auth = {
        accessToken: encrypted.encryptedAccess,
        refreshToken: encrypted.encryptedRefresh,
        expiresAt: new Date(Date.now() + TOKEN_EXPIRY_BUFFER_MS - 1000), // within buffer
      };

      // Mock the refresh endpoint
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: "new-access-token",
          expires_in: 3600,
        }),
      }));

      const result = await getValidToken(auth, secret);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toBe("new-access-token");
      }
    });

    it("returns error when refresh fails on expired token", async () => {
      const secret = "a".repeat(64);
      const encrypted = encryptTokens(
        { accessToken: "expired-token", refreshToken: "bad-refresh" },
        secret
      );

      const auth = {
        accessToken: encrypted.encryptedAccess,
        refreshToken: encrypted.encryptedRefresh,
        expiresAt: new Date(Date.now() - 1000), // already expired
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));

      const result = await getValidToken(auth, secret);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("TOKEN_EXPIRED");
        expect(result.error.requiresReauth).toBe(true);
      }
    });
  });

  describe("Full OAuth → Publish pipeline", () => {
    it("exchanges code, stores tokens, and publishes successfully", async () => {
      const secret = "a".repeat(64);

      // Step 1: Simulate token exchange result
      const tokens = {
        accessToken: "publish-access-token",
        refreshToken: "publish-refresh-token",
      };
      const encrypted = encryptTokens(tokens, secret);

      // Step 2: Get valid token (not expired)
      const auth = {
        accessToken: encrypted.encryptedAccess,
        refreshToken: encrypted.encryptedRefresh,
        expiresAt: new Date(Date.now() + 3600 * 1000),
      };

      const tokenResult = await getValidToken(auth, secret);
      expect(isOk(tokenResult)).toBe(true);
      if (!isOk(tokenResult)) return;

      // Step 3: Publish with the token
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: "urn:li:share:999888777" }),
      });

      const publishResult = await publishToLinkedIn(
        tokenResult.data,
        "urn:li:person:test-user",
        "Check out my awesome project!",
        mockFetch
      );

      expect(isOk(publishResult)).toBe(true);
      if (!isOk(publishResult)) return;

      expect(publishResult.data.postUrn).toBe("urn:li:share:999888777");
      expect(publishResult.data.postUrl).toContain("999888777");

      // Verify the publish request
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("ugcPosts");
      expect(options.headers.Authorization).toBe("Bearer publish-access-token");
      const body = JSON.parse(options.body);
      expect(body.author).toBe("urn:li:person:test-user");
      expect(body.specificContent["com.linkedin.ugc.ShareContent"].shareCommentary.text).toBe(
        "Check out my awesome project!"
      );
    });
  });

  describe("Publish error handling", () => {
    it("handles rate limiting with retryable error", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ message: "Rate limit exceeded" }),
        headers: new Map([["retry-after", "60"]]),
      });

      const result = await publishToLinkedIn(
        "token",
        "urn:li:person:test",
        "Post content",
        mockFetch
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("RATE_LIMITED");
        expect(result.error.retryable).toBe(true);
      }
    });

    it("handles expired auth during publish", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: "Unauthorized" }),
      });

      const result = await publishToLinkedIn(
        "expired-token",
        "urn:li:person:test",
        "Post content",
        mockFetch
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("AUTH_REQUIRED");
        expect(result.error.retryable).toBe(false);
      }
    });

    it("handles LinkedIn API server error", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: "Internal error" }),
      });

      const result = await publishToLinkedIn(
        "token",
        "urn:li:person:test",
        "Post content",
        mockFetch
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("API_ERROR");
        expect(result.error.retryable).toBe(true);
      }
    });

    it("handles network failure during publish", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Connection reset"));

      const result = await publishToLinkedIn(
        "token",
        "urn:li:person:test",
        "Post content",
        mockFetch
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("API_ERROR");
        expect(result.error.message).toContain("Connection reset");
      }
    });
  });

  describe("Token revocation", () => {
    it("revokes token (best-effort, does not fail on error)", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

      const result = await revokeLinkedInToken("some-token");
      expect(isOk(result)).toBe(true);
    });

    it("calls LinkedIn revoke endpoint", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", mockFetch);

      await revokeLinkedInToken("access-token-to-revoke");

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("revoke");
      expect(options.body.toString()).toContain("access-token-to-revoke");
    });
  });
});
