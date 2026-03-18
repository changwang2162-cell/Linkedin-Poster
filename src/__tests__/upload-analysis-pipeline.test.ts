import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import AdmZip from "adm-zip";
import { validateAndProcessUpload, cleanupSession } from "@/services/upload";
import {
  assembleContext,
  sortManifestByPriority,
  analyzeProject,
} from "@/services/analyzer";
import { generateSummary } from "@/services/summary";
import { isOk, isErr } from "@/lib/result";

function createTestZip(files: Record<string, string>): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.from(content, "utf-8"));
  }
  return zip.toBuffer();
}

describe("Upload-to-Analysis Integration Pipeline", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "integration-test-"));
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe("Full pipeline: upload → manifest → analysis", () => {
    it("processes a valid project ZIP through upload and generates a sorted manifest", async () => {
      const zipBuffer = createTestZip({
        "myproject/README.md": "# My Project\nA web app for managing tasks.",
        "myproject/package.json": '{"name": "my-project", "dependencies": {"react": "^19"}}',
        "myproject/src/index.ts": 'import React from "react";\nexport default function App() {}',
        "myproject/src/utils.ts": "export function add(a: number, b: number) { return a + b; }",
        "myproject/docs/guide.md": "## Getting Started\nInstall with npm install.",
      });

      const uploadResult = await validateAndProcessUpload(zipBuffer, tmpDir);
      expect(isOk(uploadResult)).toBe(true);
      if (!isOk(uploadResult)) return;

      const { manifest, fileCount, sessionId } = uploadResult.data;
      expect(fileCount).toBe(5);
      expect(sessionId).toBeTruthy();

      // Verify manifest has correct priorities
      const readme = manifest.find((f) => f.path.includes("README.md"));
      expect(readme?.priority).toBe("high");

      const packageJson = manifest.find((f) => f.path.includes("package.json"));
      expect(packageJson?.priority).toBe("high");

      const srcFile = manifest.find((f) => f.path.includes("index.ts"));
      expect(srcFile?.priority).toBe("medium");
      expect(srcFile?.language).toBe("typescript");

      // Sort by priority and verify README comes first
      const sorted = sortManifestByPriority(manifest);
      expect(sorted[0].path.toLowerCase()).toContain("readme");
    });

    it("assembles context from uploaded files respecting priority and token limits", async () => {
      const zipBuffer = createTestZip({
        "README.md": "# Project\nA test project for integration testing.",
        "src/main.ts": 'console.log("hello");',
        "src/app.ts": "export const app = true;",
        "package.json": '{"name": "proj"}',
      });

      const uploadResult = await validateAndProcessUpload(zipBuffer, tmpDir);
      expect(isOk(uploadResult)).toBe(true);
      if (!isOk(uploadResult)) return;

      const { manifest, sessionId } = uploadResult.data;

      // Assemble context from extracted files
      const context = assembleContext(sessionId, manifest, tmpDir, 50000);
      expect(context.filesIncluded).toBeGreaterThan(0);
      expect(context.content).toContain("Project");
      expect(context.tokenEstimate).toBeGreaterThan(0);
    });

    it("runs full pipeline: upload → context assembly → LLM analysis with mock", async () => {
      const zipBuffer = createTestZip({
        "README.md": "# TaskManager\nA task management web application built with React and Node.js.",
        "package.json": '{"name": "taskmanager", "dependencies": {"react": "^19", "express": "^4"}}',
        "src/index.tsx": 'import React from "react";\nexport default function App() { return <div>Hello</div>; }',
      });

      // Step 1: Upload
      const uploadResult = await validateAndProcessUpload(zipBuffer, tmpDir);
      expect(isOk(uploadResult)).toBe(true);
      if (!isOk(uploadResult)) return;

      // Step 2: Assemble context
      const { manifest, sessionId } = uploadResult.data;
      const context = assembleContext(sessionId, manifest, tmpDir);
      expect(context.filesIncluded).toBeGreaterThan(0);

      const hasReadme = manifest.some((f) => f.path.toLowerCase().includes("readme"));

      // Step 3: Analyze with mocked LLM
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{
          type: "text",
          text: JSON.stringify({
            name: "TaskManager",
            description: "A task management web application",
            primaryLanguages: ["TypeScript"],
            frameworks: ["React", "Express"],
            keyFeatures: ["Task CRUD", "Real-time updates"],
            projectType: "web-app",
          }),
        }],
      });

      const analysisResult = await analyzeProject(
        sessionId,
        context,
        hasReadme,
        undefined,
        { messages: { create: mockCreate } }
      );

      expect(isOk(analysisResult)).toBe(true);
      if (!isOk(analysisResult)) return;

      expect(analysisResult.data.attributes.name).toBe("TaskManager");
      expect(analysisResult.data.attributes.primaryLanguages).toContain("TypeScript");
      // Confidence depends on file count and token estimate
      expect(["high", "medium"]).toContain(analysisResult.data.confidence);
      expect(analysisResult.data.additionalContextNeeded).toBe(false);

      // Verify mock was called with assembled context
      expect(mockCreate).toHaveBeenCalledOnce();
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain("TaskManager");
    });

    it("pipeline continues to summary generation after analysis", async () => {
      const zipBuffer = createTestZip({
        "README.md": "# DataFlow\nA real-time data pipeline.",
        "src/main.py": "def process(): pass",
        "requirements.txt": "kafka-python\nfastapi",
      });

      // Upload
      const uploadResult = await validateAndProcessUpload(zipBuffer, tmpDir);
      expect(isOk(uploadResult)).toBe(true);
      if (!isOk(uploadResult)) return;

      const { manifest, sessionId } = uploadResult.data;
      const context = assembleContext(sessionId, manifest, tmpDir);
      const hasReadme = manifest.some((f) => f.path.toLowerCase().includes("readme"));

      // Analyze with mock
      const analysisAttributes = {
        name: "DataFlow",
        description: "A real-time data processing pipeline",
        primaryLanguages: ["Python"],
        frameworks: ["Kafka", "FastAPI"],
        keyFeatures: ["Real-time streaming", "Auto-scaling"],
        projectType: "data-pipeline",
      };

      const mockAnalysisCreate = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(analysisAttributes) }],
      });

      const analysisResult = await analyzeProject(
        sessionId, context, hasReadme, undefined,
        { messages: { create: mockAnalysisCreate } }
      );
      expect(isOk(analysisResult)).toBe(true);
      if (!isOk(analysisResult)) return;

      // Generate summary with mock
      const mockSummaryCreate = vi.fn().mockResolvedValue({
        content: [{
          type: "text",
          text: JSON.stringify({
            summary: "Excited to share DataFlow - a real-time data pipeline built with Python!",
            hashtags: ["#python", "#datapipeline"],
          }),
        }],
      });

      const summaryResult = await generateSummary(
        sessionId,
        analysisResult.data.attributes,
        { messages: { create: mockSummaryCreate } }
      );

      expect(isOk(summaryResult)).toBe(true);
      if (!isOk(summaryResult)) return;

      expect(summaryResult.data.summary).toContain("DataFlow");
      expect(summaryResult.data.hashtags).toContain("#python");
      expect(summaryResult.data.characterCount).toBeGreaterThan(0);
    });
  });

  describe("Error handling in the pipeline", () => {
    it("rejects oversized uploads", async () => {
      // Create a buffer > 50MB
      const oversizedBuffer = Buffer.alloc(51 * 1024 * 1024, "x");

      const result = await validateAndProcessUpload(oversizedBuffer, tmpDir);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("FILE_TOO_LARGE");
      }
    });

    it("rejects corrupted archives", async () => {
      const corruptedBuffer = Buffer.from("not a zip file at all");

      const result = await validateAndProcessUpload(corruptedBuffer, tmpDir);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("CORRUPTED_ARCHIVE");
      }
    });

    it("rejects archives with no recognizable project files", async () => {
      const zip = new AdmZip();
      zip.addFile("data/image.png", Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      zip.addFile("data/binary.dat", Buffer.from([0x00, 0x01, 0x02]));

      const result = await validateAndProcessUpload(zip.toBuffer(), tmpDir);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("NO_PROJECT_FILES");
      }
    });

    it("handles LLM analysis failure gracefully", async () => {
      const zipBuffer = createTestZip({
        "README.md": "# Test",
        "src/main.ts": "console.log('hi');",
      });

      const uploadResult = await validateAndProcessUpload(zipBuffer, tmpDir);
      expect(isOk(uploadResult)).toBe(true);
      if (!isOk(uploadResult)) return;

      const { manifest, sessionId } = uploadResult.data;
      const context = assembleContext(sessionId, manifest, tmpDir);

      const mockCreate = vi.fn().mockRejectedValue(new Error("API rate limit"));

      const result = await analyzeProject(
        sessionId, context, true, undefined,
        { messages: { create: mockCreate } }
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("LLM_ERROR");
      }
    });

    it("flags low-confidence analysis when project has minimal files", async () => {
      const zipBuffer = createTestZip({
        "main.py": "print('hello')",
      });

      const uploadResult = await validateAndProcessUpload(zipBuffer, tmpDir);
      expect(isOk(uploadResult)).toBe(true);
      if (!isOk(uploadResult)) return;

      const { manifest, sessionId } = uploadResult.data;
      const context = assembleContext(sessionId, manifest, tmpDir);
      const hasReadme = false;

      const mockCreate = vi.fn().mockResolvedValue({
        content: [{
          type: "text",
          text: JSON.stringify({
            name: "Unknown",
            description: "A Python script",
            primaryLanguages: ["Python"],
            frameworks: [],
            keyFeatures: [],
            projectType: "other",
          }),
        }],
      });

      const result = await analyzeProject(
        sessionId, context, hasReadme, undefined,
        { messages: { create: mockCreate } }
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.confidence).toBe("low");
        expect(result.data.additionalContextNeeded).toBe(true);
        expect(result.data.contextPrompt).toBeTruthy();
      }
    });
  });

  describe("Session cleanup", () => {
    it("removes session files after cleanup", async () => {
      const zipBuffer = createTestZip({
        "README.md": "# Test",
        "main.ts": "export const x = 1;",
      });

      const uploadResult = await validateAndProcessUpload(zipBuffer, tmpDir);
      expect(isOk(uploadResult)).toBe(true);
      if (!isOk(uploadResult)) return;

      const { sessionId } = uploadResult.data;
      const sessionDir = path.join(tmpDir, sessionId);

      expect(fs.existsSync(sessionDir)).toBe(true);

      await cleanupSession(sessionId, tmpDir);

      expect(fs.existsSync(sessionDir)).toBe(false);
    });
  });
});
