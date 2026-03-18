import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { cleanupSession, getSessionDir } from "@/services/upload";

const TEST_TMP = path.join(process.cwd(), "tmp-test-cleanup");

describe("Session Cleanup", () => {
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

  describe("getSessionDir", () => {
    it("returns the correct path for a session", () => {
      const dir = getSessionDir("abc-123", TEST_TMP);
      expect(dir).toBe(path.join(TEST_TMP, "abc-123"));
    });
  });

  describe("cleanupSession", () => {
    it("removes an existing session directory", async () => {
      const sessionId = "test-session-1";
      const sessionDir = path.join(TEST_TMP, sessionId);
      fs.mkdirSync(sessionDir, { recursive: true });
      fs.writeFileSync(path.join(sessionDir, "file.txt"), "hello");

      expect(fs.existsSync(sessionDir)).toBe(true);

      await cleanupSession(sessionId, TEST_TMP);

      expect(fs.existsSync(sessionDir)).toBe(false);
    });

    it("removes nested directories within session", async () => {
      const sessionId = "test-session-2";
      const sessionDir = path.join(TEST_TMP, sessionId);
      const nestedDir = path.join(sessionDir, "src", "components");
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(path.join(nestedDir, "App.tsx"), "export {}");

      await cleanupSession(sessionId, TEST_TMP);

      expect(fs.existsSync(sessionDir)).toBe(false);
    });

    it("does not throw when session directory does not exist", async () => {
      await expect(
        cleanupSession("nonexistent-session", TEST_TMP)
      ).resolves.not.toThrow();
    });

    it("does not affect other sessions", async () => {
      const session1 = "session-keep";
      const session2 = "session-delete";
      fs.mkdirSync(path.join(TEST_TMP, session1), { recursive: true });
      fs.writeFileSync(path.join(TEST_TMP, session1, "file.txt"), "keep me");
      fs.mkdirSync(path.join(TEST_TMP, session2), { recursive: true });
      fs.writeFileSync(path.join(TEST_TMP, session2, "file.txt"), "delete me");

      await cleanupSession(session2, TEST_TMP);

      expect(fs.existsSync(path.join(TEST_TMP, session1))).toBe(true);
      expect(fs.existsSync(path.join(TEST_TMP, session2))).toBe(false);
    });
  });
});
