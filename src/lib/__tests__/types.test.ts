import { describe, it, expect } from "vitest";
import { ok, err, isOk, isErr } from "@/lib/result";
import type { Result } from "@/lib/result";
import type {
  FileManifestEntry,
  UploadResult,
  UploadError,
  AnalysisResult,
  AnalysisError,
  SummaryResult,
  SummaryError,
  PublishResult,
  PublishError,
  OAuthError,
} from "@/lib/types";

describe("Domain types with Result", () => {
  it("UploadResult works with Result type", () => {
    const success: Result<UploadResult, UploadError> = ok({
      sessionId: "sess-123",
      fileCount: 3,
      manifest: [
        { path: "README.md", size: 1024, language: null, priority: "high" },
      ],
      totalSize: 1024,
    });

    expect(isOk(success)).toBe(true);
    if (isOk(success)) {
      expect(success.data.sessionId).toBe("sess-123");
      expect(success.data.manifest).toHaveLength(1);
      expect(success.data.manifest[0].priority).toBe("high");
    }
  });

  it("UploadError works with Result type", () => {
    const failure: Result<UploadResult, UploadError> = err({
      code: "FILE_TOO_LARGE",
      message: "File exceeds 50MB limit",
      maxSize: 50 * 1024 * 1024,
    });

    expect(isErr(failure)).toBe(true);
    if (isErr(failure)) {
      expect(failure.error.code).toBe("FILE_TOO_LARGE");
      expect(failure.error.maxSize).toBe(50 * 1024 * 1024);
    }
  });

  it("AnalysisResult works with Result type", () => {
    const result: Result<AnalysisResult, AnalysisError> = ok({
      sessionId: "sess-123",
      attributes: {
        name: "My Project",
        description: "A cool project",
        primaryLanguages: ["TypeScript"],
        frameworks: ["Next.js"],
        keyFeatures: ["AI-powered"],
        projectType: "web-app",
      },
      confidence: "high",
      additionalContextNeeded: false,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.attributes.name).toBe("My Project");
      expect(result.data.confidence).toBe("high");
    }
  });

  it("SummaryResult works with Result type", () => {
    const result: Result<SummaryResult, SummaryError> = ok({
      sessionId: "sess-123",
      summary: "Check out my project!",
      characterCount: 21,
      hashtags: ["#opensource", "#typescript"],
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.hashtags).toContain("#typescript");
    }
  });

  it("PublishResult works with Result type", () => {
    const result: Result<PublishResult, PublishError> = ok({
      postUrn: "urn:li:share:123456",
      postUrl: "https://www.linkedin.com/feed/update/urn:li:share:123456",
    });

    expect(isOk(result)).toBe(true);
  });

  it("OAuthError has requiresReauth field", () => {
    const result: Result<string, OAuthError> = err({
      code: "TOKEN_EXPIRED",
      message: "Token has expired",
      requiresReauth: true,
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.requiresReauth).toBe(true);
    }
  });

  it("FileManifestEntry supports all priority levels", () => {
    const entries: FileManifestEntry[] = [
      { path: "README.md", size: 500, language: null, priority: "high" },
      { path: "src/index.ts", size: 200, language: "typescript", priority: "medium" },
      { path: "assets/logo.png", size: 10000, language: null, priority: "low" },
    ];

    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.priority)).toEqual(["high", "medium", "low"]);
  });
});
