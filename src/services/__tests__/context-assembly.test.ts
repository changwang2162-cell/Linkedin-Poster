import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { sortManifestByPriority, assembleContext, estimateTokens } from "@/services/analyzer";
import type { FileManifestEntry } from "@/lib/types";

const TEST_TMP = path.join(process.cwd(), "tmp-test-context");

describe("Context Assembly", () => {
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

  describe("sortManifestByPriority", () => {
    it("sorts high priority files first", () => {
      const manifest: FileManifestEntry[] = [
        { path: "src/index.ts", size: 100, language: "typescript", priority: "medium" },
        { path: "README.md", size: 200, language: null, priority: "high" },
        { path: "assets/logo.png", size: 50, language: null, priority: "low" },
        { path: "package.json", size: 150, language: null, priority: "high" },
      ];

      const sorted = sortManifestByPriority(manifest);

      expect(sorted[0].priority).toBe("high");
      expect(sorted[1].priority).toBe("high");
      expect(sorted[2].priority).toBe("medium");
      expect(sorted[3].priority).toBe("low");
    });

    it("preserves relative order within same priority", () => {
      const manifest: FileManifestEntry[] = [
        { path: "src/a.ts", size: 100, language: "typescript", priority: "medium" },
        { path: "src/b.ts", size: 200, language: "typescript", priority: "medium" },
      ];

      const sorted = sortManifestByPriority(manifest);
      expect(sorted[0].path).toBe("src/a.ts");
      expect(sorted[1].path).toBe("src/b.ts");
    });

    it("places README before other high-priority files", () => {
      const manifest: FileManifestEntry[] = [
        { path: "package.json", size: 100, language: null, priority: "high" },
        { path: "README.md", size: 200, language: null, priority: "high" },
        { path: "CHANGELOG.md", size: 300, language: null, priority: "high" },
      ];

      const sorted = sortManifestByPriority(manifest);
      expect(sorted[0].path).toBe("README.md");
    });
  });

  describe("estimateTokens", () => {
    it("estimates tokens roughly as chars / 4", () => {
      const text = "a".repeat(400);
      const estimate = estimateTokens(text);
      expect(estimate).toBe(100);
    });

    it("returns 0 for empty string", () => {
      expect(estimateTokens("")).toBe(0);
    });
  });

  describe("assembleContext", () => {
    function setupSessionFiles(sessionId: string, files: Record<string, string>) {
      const sessionDir = path.join(TEST_TMP, sessionId);
      for (const [filePath, content] of Object.entries(files)) {
        const fullPath = path.join(sessionDir, filePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content);
      }
    }

    it("assembles file contents with headers", () => {
      const sessionId = "test-session";
      setupSessionFiles(sessionId, {
        "README.md": "# My Project\nA great project.",
        "src/index.ts": 'console.log("hello");',
      });

      const manifest: FileManifestEntry[] = [
        { path: "README.md", size: 30, language: null, priority: "high" },
        { path: "src/index.ts", size: 21, language: "typescript", priority: "medium" },
      ];

      const result = assembleContext(sessionId, manifest, TEST_TMP);

      expect(result.content).toContain("README.md");
      expect(result.content).toContain("# My Project");
      expect(result.content).toContain("src/index.ts");
      expect(result.content).toContain('console.log("hello")');
      expect(result.filesIncluded).toBe(2);
    });

    it("respects token limit by excluding files that exceed budget", () => {
      const sessionId = "test-session-limit";
      const largeContent = "x".repeat(800_000); // ~200K tokens
      setupSessionFiles(sessionId, {
        "README.md": "# Small file",
        "huge.ts": largeContent,
      });

      const manifest: FileManifestEntry[] = [
        { path: "README.md", size: 12, language: null, priority: "high" },
        { path: "huge.ts", size: 800_000, language: "typescript", priority: "medium" },
      ];

      const result = assembleContext(sessionId, manifest, TEST_TMP, 1000);

      expect(result.filesIncluded).toBe(1);
      expect(result.content).toContain("README.md");
      expect(result.content).not.toContain("xxxx");
    });

    it("skips binary/unreadable files gracefully", () => {
      const sessionId = "test-session-binary";
      const sessionDir = path.join(TEST_TMP, sessionId);
      fs.mkdirSync(sessionDir, { recursive: true });
      fs.writeFileSync(path.join(sessionDir, "README.md"), "# Hello");
      // File listed in manifest but doesn't exist on disk
      const manifest: FileManifestEntry[] = [
        { path: "README.md", size: 7, language: null, priority: "high" },
        { path: "missing.ts", size: 100, language: "typescript", priority: "medium" },
      ];

      const result = assembleContext(sessionId, manifest, TEST_TMP);

      expect(result.filesIncluded).toBe(1);
      expect(result.content).toContain("# Hello");
    });

    it("includes only high and medium priority files, skips low", () => {
      const sessionId = "test-session-prio";
      setupSessionFiles(sessionId, {
        "README.md": "# Project",
        "src/app.ts": "export {}",
        "assets/logo.png": "binary-data",
      });

      const manifest: FileManifestEntry[] = [
        { path: "README.md", size: 9, language: null, priority: "high" },
        { path: "src/app.ts", size: 9, language: "typescript", priority: "medium" },
        { path: "assets/logo.png", size: 11, language: null, priority: "low" },
      ];

      const result = assembleContext(sessionId, manifest, TEST_TMP);

      expect(result.filesIncluded).toBe(2);
      expect(result.content).not.toContain("binary-data");
    });
  });
});
