import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildPostPayload,
  parsePostResponse,
  publishToLinkedIn,
} from "@/services/publisher";
import { isOk, isErr } from "@/lib/result";

describe("Publisher Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("buildPostPayload", () => {
    it("constructs a valid LinkedIn Posts API payload", () => {
      const payload = buildPostPayload("urn:li:person:abc123", "Hello LinkedIn!");
      expect(payload).toEqual({
        author: "urn:li:person:abc123",
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: "Hello LinkedIn!" },
            shareMediaCategory: "NONE",
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      });
    });

    it("includes full summary text in the payload", () => {
      const longText = "A".repeat(2500);
      const payload = buildPostPayload("urn:li:person:xyz", longText);
      expect(
        payload.specificContent["com.linkedin.ugc.ShareContent"].shareCommentary.text
      ).toBe(longText);
    });
  });

  describe("parsePostResponse", () => {
    it("extracts post URN and constructs post URL from successful response", () => {
      const result = parsePostResponse({
        id: "urn:li:share:123456789",
      });
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.postUrn).toBe("urn:li:share:123456789");
        expect(result.data.postUrl).toContain("linkedin.com");
        expect(result.data.postUrl).toContain("123456789");
      }
    });

    it("returns error when response has no id", () => {
      const result = parsePostResponse({});
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("API_ERROR");
        expect(result.error.retryable).toBe(true);
      }
    });
  });

  describe("publishToLinkedIn", () => {
    it("publishes successfully and returns post URN and URL", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: "urn:li:share:987654" }),
      });

      const result = await publishToLinkedIn(
        "test-access-token",
        "urn:li:person:abc",
        "My awesome project post!",
        mockFetch
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.postUrn).toBe("urn:li:share:987654");
        expect(result.data.postUrl).toContain("987654");
      }

      // Verify the fetch was called correctly
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.linkedin.com/v2/ugcPosts");
      expect(options.method).toBe("POST");
      expect(options.headers["Authorization"]).toBe("Bearer test-access-token");
      expect(options.headers["X-Restli-Protocol-Version"]).toBe("2.0.0");
      expect(options.headers["Content-Type"]).toBe("application/json");
    });

    it("returns RATE_LIMITED error on 429 response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ message: "Rate limit exceeded" }),
        headers: new Map([["retry-after", "60"]]),
      });

      const result = await publishToLinkedIn(
        "token",
        "urn:li:person:abc",
        "Post text",
        mockFetch
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("RATE_LIMITED");
        expect(result.error.retryable).toBe(true);
      }
    });

    it("returns AUTH_REQUIRED error on 401 response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: "Unauthorized" }),
      });

      const result = await publishToLinkedIn(
        "bad-token",
        "urn:li:person:abc",
        "Post text",
        mockFetch
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("AUTH_REQUIRED");
        expect(result.error.retryable).toBe(false);
      }
    });

    it("returns API_ERROR on other error responses", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: "Internal Server Error" }),
      });

      const result = await publishToLinkedIn(
        "token",
        "urn:li:person:abc",
        "Post text",
        mockFetch
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("API_ERROR");
        expect(result.error.retryable).toBe(true);
      }
    });

    it("returns API_ERROR when fetch throws a network error", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await publishToLinkedIn(
        "token",
        "urn:li:person:abc",
        "Post text",
        mockFetch
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("API_ERROR");
        expect(result.error.retryable).toBe(true);
        expect(result.error.message).toContain("Network error");
      }
    });

    it("returns INVALID_CONTENT error on 422 response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ message: "Invalid content" }),
      });

      const result = await publishToLinkedIn(
        "token",
        "urn:li:person:abc",
        "Post text",
        mockFetch
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("INVALID_CONTENT");
        expect(result.error.retryable).toBe(false);
      }
    });
  });
});
