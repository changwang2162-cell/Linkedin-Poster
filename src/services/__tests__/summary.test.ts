import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildSummaryPrompt,
  buildRegenerationPrompt,
  parseSummaryResponse,
  generateSummary,
  regenerateSummary,
} from "@/services/summary";
import type { ProjectAttributes } from "@/lib/types";
import { isOk, isErr } from "@/lib/result";

const mockAttributes: ProjectAttributes = {
  name: "DataFlow",
  description: "A real-time data processing pipeline for IoT sensors",
  primaryLanguages: ["Python", "Rust"],
  frameworks: ["Apache Kafka", "FastAPI"],
  keyFeatures: ["Real-time streaming", "Auto-scaling", "Dashboard UI"],
  projectType: "data-pipeline",
};

describe("Summary Service", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  });

  describe("buildSummaryPrompt", () => {
    it("includes project name", () => {
      const prompt = buildSummaryPrompt(mockAttributes);
      expect(prompt).toContain("DataFlow");
    });

    it("includes technologies", () => {
      const prompt = buildSummaryPrompt(mockAttributes);
      expect(prompt).toContain("Python");
      expect(prompt).toContain("Rust");
      expect(prompt).toContain("Apache Kafka");
    });

    it("includes key features", () => {
      const prompt = buildSummaryPrompt(mockAttributes);
      expect(prompt).toContain("Real-time streaming");
    });

    it("mentions 3000 character limit", () => {
      const prompt = buildSummaryPrompt(mockAttributes);
      expect(prompt).toContain("3000");
    });

    it("asks for hashtags", () => {
      const prompt = buildSummaryPrompt(mockAttributes);
      expect(prompt.toLowerCase()).toContain("hashtag");
    });
  });

  describe("buildRegenerationPrompt", () => {
    it("includes the original summary", () => {
      const prompt = buildRegenerationPrompt(
        "Original post text here",
        mockAttributes,
        "Make it shorter"
      );
      expect(prompt).toContain("Original post text here");
    });

    it("includes user feedback", () => {
      const prompt = buildRegenerationPrompt(
        "Original text",
        mockAttributes,
        "Add more technical details"
      );
      expect(prompt).toContain("Add more technical details");
    });

    it("includes project context", () => {
      const prompt = buildRegenerationPrompt(
        "Original text",
        mockAttributes,
        "Make it better"
      );
      expect(prompt).toContain("DataFlow");
    });
  });

  describe("parseSummaryResponse", () => {
    it("parses response with summary and hashtags in JSON", () => {
      const response = JSON.stringify({
        summary: "Check out DataFlow! A great project.",
        hashtags: ["#python", "#datapipeline", "#opensource"],
      });

      const result = parseSummaryResponse(response);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.summary).toContain("DataFlow");
        expect(result.data.hashtags).toContain("#python");
        expect(result.data.characterCount).toBeGreaterThan(0);
      }
    });

    it("parses JSON from markdown code block", () => {
      const response = `\`\`\`json
{
  "summary": "A post about DataFlow.",
  "hashtags": ["#tech"]
}
\`\`\``;

      const result = parseSummaryResponse(response);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.summary).toBe("A post about DataFlow.");
      }
    });

    it("falls back to treating entire response as summary if not JSON", () => {
      const response = "Here is a great LinkedIn post about my project!\n\n#coding #tech";

      const result = parseSummaryResponse(response);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.summary).toContain("great LinkedIn post");
        expect(result.data.hashtags.length).toBeGreaterThanOrEqual(0);
      }
    });

    it("enforces 3000 character limit by truncating", () => {
      const longSummary = "x".repeat(3500);
      const response = JSON.stringify({
        summary: longSummary,
        hashtags: ["#test"],
      });

      const result = parseSummaryResponse(response);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.characterCount).toBeLessThanOrEqual(3000);
      }
    });
  });

  describe("generateSummary", () => {
    it("returns summary result on successful LLM call", async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{
          type: "text",
          text: JSON.stringify({
            summary: "Excited to share DataFlow! 🚀",
            hashtags: ["#python", "#datapipeline"],
          }),
        }],
      });

      const result = await generateSummary(
        "session-1",
        mockAttributes,
        { messages: { create: mockCreate } }
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.sessionId).toBe("session-1");
        expect(result.data.summary).toContain("DataFlow");
        expect(result.data.hashtags).toContain("#python");
        expect(result.data.characterCount).toBeGreaterThan(0);
      }
    });

    it("returns error when LLM call fails", async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error("API down"));

      const result = await generateSummary(
        "session-2",
        mockAttributes,
        { messages: { create: mockCreate } }
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("GENERATION_FAILED");
      }
    });
  });

  describe("regenerateSummary", () => {
    it("returns updated summary with feedback applied", async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{
          type: "text",
          text: JSON.stringify({
            summary: "Updated version of the post with feedback applied.",
            hashtags: ["#updated", "#tech"],
          }),
        }],
      });

      const result = await regenerateSummary(
        "session-3",
        "Original summary text",
        mockAttributes,
        "Make it more concise",
        { messages: { create: mockCreate } }
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.sessionId).toBe("session-3");
        expect(result.data.summary).toContain("Updated version");
      }
    });

    it("returns error when LLM call fails", async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error("Timeout"));

      const result = await regenerateSummary(
        "session-4",
        "Original text",
        mockAttributes,
        "Fix it",
        { messages: { create: mockCreate } }
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("GENERATION_FAILED");
      }
    });
  });
});
