import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { processZipBuffer, detectLanguage, assignPriority } from "@/services/upload";
import { isOk, isErr } from "@/lib/result";

const TEST_TMP = path.join(process.cwd(), "tmp-test-uploads");

function createTestZip(files: Record<string, string>): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.from(content, "utf-8"));
  }
  return zip.toBuffer();
}

describe("Upload Service", () => {
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

  describe("detectLanguage", () => {
    it("detects TypeScript files", () => {
      expect(detectLanguage("src/index.ts")).toBe("typescript");
      expect(detectLanguage("components/App.tsx")).toBe("typescript");
    });

    it("detects JavaScript files", () => {
      expect(detectLanguage("index.js")).toBe("javascript");
      expect(detectLanguage("App.jsx")).toBe("javascript");
    });

    it("detects Python files", () => {
      expect(detectLanguage("main.py")).toBe("python");
    });

    it("detects Go files", () => {
      expect(detectLanguage("main.go")).toBe("go");
    });

    it("detects Rust files", () => {
      expect(detectLanguage("main.rs")).toBe("rust");
    });

    it("detects Java files", () => {
      expect(detectLanguage("Main.java")).toBe("java");
    });

    it("detects C/C++ files", () => {
      expect(detectLanguage("main.c")).toBe("c");
      expect(detectLanguage("main.cpp")).toBe("cpp");
      expect(detectLanguage("main.h")).toBe("c");
    });

    it("detects Ruby files", () => {
      expect(detectLanguage("app.rb")).toBe("ruby");
    });

    it("detects PHP files", () => {
      expect(detectLanguage("index.php")).toBe("php");
    });

    it("returns null for unknown extensions", () => {
      expect(detectLanguage("image.png")).toBeNull();
      expect(detectLanguage("data.bin")).toBeNull();
    });

    it("returns null for markdown", () => {
      expect(detectLanguage("README.md")).toBeNull();
    });

    it("returns null for JSON/YAML config", () => {
      expect(detectLanguage("package.json")).toBeNull();
      expect(detectLanguage("config.yaml")).toBeNull();
    });
  });

  describe("assignPriority", () => {
    it("assigns high priority to README files", () => {
      expect(assignPriority("README.md")).toBe("high");
      expect(assignPriority("readme.txt")).toBe("high");
      expect(assignPriority("README")).toBe("high");
    });

    it("assigns high priority to package manifests", () => {
      expect(assignPriority("package.json")).toBe("high");
      expect(assignPriority("Cargo.toml")).toBe("high");
      expect(assignPriority("go.mod")).toBe("high");
      expect(assignPriority("requirements.txt")).toBe("high");
      expect(assignPriority("pyproject.toml")).toBe("high");
      expect(assignPriority("pom.xml")).toBe("high");
      expect(assignPriority("Gemfile")).toBe("high");
    });

    it("assigns high priority to documentation files", () => {
      expect(assignPriority("docs/guide.md")).toBe("high");
      expect(assignPriority("CONTRIBUTING.md")).toBe("high");
      expect(assignPriority("CHANGELOG.md")).toBe("high");
    });

    it("assigns medium priority to source code files", () => {
      expect(assignPriority("src/index.ts")).toBe("medium");
      expect(assignPriority("main.py")).toBe("medium");
      expect(assignPriority("lib/utils.go")).toBe("medium");
    });

    it("assigns low priority to non-code files", () => {
      expect(assignPriority("assets/logo.png")).toBe("low");
      expect(assignPriority("data.bin")).toBe("low");
    });

    it("assigns medium priority to config files", () => {
      expect(assignPriority("tsconfig.json")).toBe("medium");
      expect(assignPriority(".eslintrc.js")).toBe("medium");
    });
  });

  describe("processZipBuffer", () => {
    it("extracts files and generates manifest", async () => {
      const zipBuffer = createTestZip({
        "project/README.md": "# My Project\nA cool project",
        "project/src/index.ts": "console.log('hello');",
        "project/package.json": '{"name": "test"}',
      });

      const result = await processZipBuffer(zipBuffer, TEST_TMP);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.data.fileCount).toBe(3);
      expect(result.data.manifest).toHaveLength(3);
      expect(result.data.sessionId).toBeTruthy();
      expect(result.data.totalSize).toBeGreaterThan(0);
    });

    it("assigns correct priorities in manifest", async () => {
      const zipBuffer = createTestZip({
        "README.md": "# Test",
        "src/app.ts": "export {}",
        "assets/logo.png": "fake-png",
      });

      const result = await processZipBuffer(zipBuffer, TEST_TMP);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const manifest = result.data.manifest;
      const readme = manifest.find((f) => f.path.includes("README"));
      const source = manifest.find((f) => f.path.includes("app.ts"));
      const asset = manifest.find((f) => f.path.includes("logo.png"));

      expect(readme?.priority).toBe("high");
      expect(source?.priority).toBe("medium");
      expect(asset?.priority).toBe("low");
    });

    it("detects languages in manifest entries", async () => {
      const zipBuffer = createTestZip({
        "main.py": "print('hello')",
        "index.ts": "console.log('hi')",
        "README.md": "# Docs",
      });

      const result = await processZipBuffer(zipBuffer, TEST_TMP);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const manifest = result.data.manifest;
      const py = manifest.find((f) => f.path.includes("main.py"));
      const ts = manifest.find((f) => f.path.includes("index.ts"));
      const md = manifest.find((f) => f.path.includes("README"));

      expect(py?.language).toBe("python");
      expect(ts?.language).toBe("typescript");
      expect(md?.language).toBeNull();
    });

    it("extracts files to disk", async () => {
      const zipBuffer = createTestZip({
        "hello.txt": "Hello World",
      });

      const result = await processZipBuffer(zipBuffer, TEST_TMP);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const sessionDir = path.join(TEST_TMP, result.data.sessionId);
      expect(fs.existsSync(sessionDir)).toBe(true);

      const files = fs.readdirSync(sessionDir, { recursive: true });
      expect(files.length).toBeGreaterThan(0);
    });

    it("strips common root folder from paths", async () => {
      const zipBuffer = createTestZip({
        "my-project/src/index.ts": "export {}",
        "my-project/README.md": "# Hello",
      });

      const result = await processZipBuffer(zipBuffer, TEST_TMP);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const paths = result.data.manifest.map((f) => f.path);
      // Should strip the common "my-project/" prefix
      expect(paths).toContain("src/index.ts");
      expect(paths).toContain("README.md");
    });
  });
});
