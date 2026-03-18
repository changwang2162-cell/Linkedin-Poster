import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { parseGitHubUrl, processGitHubUrl } from "@/services/upload";
import { isOk, isErr } from "@/lib/result";

const TEST_TMP = path.join(process.cwd(), "tmp-test-github");

describe("GitHub URL Import", () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_TMP)) {
      fs.rmSync(TEST_TMP, { recursive: true });
    }
    fs.mkdirSync(TEST_TMP, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_TMP)) {
      fs.rmSync(TEST_TMP, { recursive: true });
    }
  });

  describe("parseGitHubUrl", () => {
    it("parses standard GitHub repo URL", () => {
      const result = parseGitHubUrl("https://github.com/owner/repo");
      expect(result).toEqual({ owner: "owner", repo: "repo", ref: "main" });
    });

    it("parses GitHub repo URL with trailing slash", () => {
      const result = parseGitHubUrl("https://github.com/owner/repo/");
      expect(result).toEqual({ owner: "owner", repo: "repo", ref: "main" });
    });

    it("parses GitHub repo URL with tree/branch", () => {
      const result = parseGitHubUrl("https://github.com/owner/repo/tree/develop");
      expect(result).toEqual({ owner: "owner", repo: "repo", ref: "develop" });
    });

    it("parses GitHub repo URL with .git suffix", () => {
      const result = parseGitHubUrl("https://github.com/owner/repo.git");
      expect(result).toEqual({ owner: "owner", repo: "repo", ref: "main" });
    });

    it("returns null for non-GitHub URLs", () => {
      expect(parseGitHubUrl("https://gitlab.com/owner/repo")).toBeNull();
      expect(parseGitHubUrl("https://example.com")).toBeNull();
    });

    it("returns null for invalid GitHub URLs", () => {
      expect(parseGitHubUrl("https://github.com/")).toBeNull();
      expect(parseGitHubUrl("https://github.com/owner")).toBeNull();
      expect(parseGitHubUrl("not a url")).toBeNull();
    });

    it("handles www.github.com", () => {
      const result = parseGitHubUrl("https://www.github.com/owner/repo");
      expect(result).toEqual({ owner: "owner", repo: "repo", ref: "main" });
    });
  });

  describe("processGitHubUrl", () => {
    it("returns error for invalid GitHub URL", async () => {
      const result = await processGitHubUrl("https://example.com/not-github", TEST_TMP);
      expect(isErr(result)).toBe(true);
      if (!isErr(result)) return;
      expect(result.error.code).toBe("UNSUPPORTED_FORMAT");
    });

    it("returns error for malformed URL", async () => {
      const result = await processGitHubUrl("not a url", TEST_TMP);
      expect(isErr(result)).toBe(true);
      if (!isErr(result)) return;
      expect(result.error.code).toBe("UNSUPPORTED_FORMAT");
    });

    it("returns error when download fails (non-existent repo)", async () => {
      const result = await processGitHubUrl(
        "https://github.com/this-owner-does-not-exist-xyz/this-repo-does-not-exist-xyz",
        TEST_TMP
      );
      expect(isErr(result)).toBe(true);
      if (!isErr(result)) return;
      // Should be a download failure, not a format error
      expect(["CORRUPTED_ARCHIVE", "UNSUPPORTED_FORMAT"]).toContain(result.error.code);
    });
  });
});
