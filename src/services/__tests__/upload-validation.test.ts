import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { validateAndProcessUpload } from "@/services/upload";
import { isOk, isErr, unwrapErr } from "@/lib/result";

const TEST_TMP = path.join(process.cwd(), "tmp-test-validation");
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

function createTestZip(files: Record<string, string>): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.from(content, "utf-8"));
  }
  return zip.toBuffer();
}

describe("Upload Validation", () => {
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

  describe("size limits", () => {
    it("rejects files exceeding 50MB", async () => {
      // Create a buffer larger than 50MB
      const oversizedBuffer = Buffer.alloc(MAX_SIZE + 1);
      const result = await validateAndProcessUpload(oversizedBuffer, TEST_TMP);

      expect(isErr(result)).toBe(true);
      if (!isErr(result)) return;
      expect(result.error.code).toBe("FILE_TOO_LARGE");
      expect(result.error.maxSize).toBe(MAX_SIZE);
    });

    it("accepts files within size limit", async () => {
      const zipBuffer = createTestZip({
        "README.md": "# Project",
        "src/index.ts": "export {}",
      });
      const result = await validateAndProcessUpload(zipBuffer, TEST_TMP);
      expect(isOk(result)).toBe(true);
    });
  });

  describe("corrupted archives", () => {
    it("rejects non-ZIP data", async () => {
      const garbage = Buffer.from("this is not a zip file at all");
      const result = await validateAndProcessUpload(garbage, TEST_TMP);

      expect(isErr(result)).toBe(true);
      if (!isErr(result)) return;
      expect(result.error.code).toBe("CORRUPTED_ARCHIVE");
    });

    it("rejects truncated ZIP files", async () => {
      const zip = createTestZip({ "test.txt": "hello" });
      const truncated = zip.subarray(0, Math.floor(zip.length / 2));
      const result = await validateAndProcessUpload(truncated, TEST_TMP);

      expect(isErr(result)).toBe(true);
      if (!isErr(result)) return;
      expect(result.error.code).toBe("CORRUPTED_ARCHIVE");
    });
  });

  describe("project file validation", () => {
    it("rejects archives with no recognizable project files", async () => {
      const zipBuffer = createTestZip({
        "photo.jpg": "fake-jpg-data",
        "video.mp4": "fake-mp4-data",
        "document.pdf": "fake-pdf-data",
      });
      const result = await validateAndProcessUpload(zipBuffer, TEST_TMP);

      expect(isErr(result)).toBe(true);
      if (!isErr(result)) return;
      expect(result.error.code).toBe("NO_PROJECT_FILES");
    });

    it("accepts archives with source code files", async () => {
      const zipBuffer = createTestZip({
        "src/main.py": "print('hello')",
      });
      const result = await validateAndProcessUpload(zipBuffer, TEST_TMP);
      expect(isOk(result)).toBe(true);
    });

    it("accepts archives with README", async () => {
      const zipBuffer = createTestZip({
        "README.md": "# My Project",
      });
      const result = await validateAndProcessUpload(zipBuffer, TEST_TMP);
      expect(isOk(result)).toBe(true);
    });

    it("accepts archives with package manifest", async () => {
      const zipBuffer = createTestZip({
        "package.json": '{"name": "test"}',
      });
      const result = await validateAndProcessUpload(zipBuffer, TEST_TMP);
      expect(isOk(result)).toBe(true);
    });
  });

  describe("path traversal protection", () => {
    it("sanitizes paths with directory traversal", async () => {
      const zip = new AdmZip();
      zip.addFile("../../../etc/passwd", Buffer.from("malicious"));
      zip.addFile("normal/file.ts", Buffer.from("export {}"));
      const buffer = zip.toBuffer();

      const result = await validateAndProcessUpload(buffer, TEST_TMP);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      // Traversal entry should be filtered out
      const paths = result.data.manifest.map((f) => f.path);
      expect(paths.every((p) => !p.includes(".."))).toBe(true);
    });

    it("sanitizes absolute paths in archive", async () => {
      const zip = new AdmZip();
      zip.addFile("/etc/passwd", Buffer.from("malicious"));
      zip.addFile("src/app.ts", Buffer.from("export {}"));
      const buffer = zip.toBuffer();

      const result = await validateAndProcessUpload(buffer, TEST_TMP);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const paths = result.data.manifest.map((f) => f.path);
      expect(paths.every((p) => !p.startsWith("/"))).toBe(true);
    });
  });
});
