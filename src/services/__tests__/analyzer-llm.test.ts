import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildAnalysisPrompt,
  parseAnalysisResponse,
  assessConfidence,
  analyzeProject,
} from "@/services/analyzer";
import type { AssembledContext } from "@/services/analyzer";
import type { ProjectAttributes, AnalysisResult } from "@/lib/types";
import { isOk, isErr } from "@/lib/result";

describe("LLM Project Analyzer", () => {
  describe("buildAnalysisPrompt", () => {
    it("includes the assembled context", () => {
      const context: AssembledContext = {
        content: "--- File: README.md ---\n# My Project\nA cool tool.",
        filesIncluded: 1,
        tokenEstimate: 15,
      };

      const prompt = buildAnalysisPrompt(context);
      expect(prompt).toContain("# My Project");
      expect(prompt).toContain("README.md");
    });

    it("includes instruction to extract attributes as JSON", () => {
      const context: AssembledContext = {
        content: "some code",
        filesIncluded: 1,
        tokenEstimate: 5,
      };

      const prompt = buildAnalysisPrompt(context);
      expect(prompt).toContain("JSON");
      expect(prompt).toContain("project attributes");
      expect(prompt).toContain("some code");
    });

    it("includes additional context when provided", () => {
      const context: AssembledContext = {
        content: "some code",
        filesIncluded: 1,
        tokenEstimate: 5,
      };

      const prompt = buildAnalysisPrompt(context, "This is a CLI tool for data processing");
      expect(prompt).toContain("CLI tool for data processing");
    });
  });

  describe("parseAnalysisResponse", () => {
    it("parses valid JSON response with all fields", () => {
      const response = JSON.stringify({
        name: "MyProject",
        description: "A web framework",
        primaryLanguages: ["TypeScript", "JavaScript"],
        frameworks: ["Next.js", "React"],
        keyFeatures: ["Server-side rendering", "API routes"],
        projectType: "web-framework",
      });

      const result = parseAnalysisResponse(response);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.name).toBe("MyProject");
        expect(result.data.primaryLanguages).toContain("TypeScript");
        expect(result.data.frameworks).toContain("Next.js");
      }
    });

    it("parses JSON embedded in markdown code block", () => {
      const response = `Here's the analysis:
\`\`\`json
{
  "name": "TestApp",
  "description": "A test app",
  "primaryLanguages": ["Python"],
  "frameworks": ["Flask"],
  "keyFeatures": ["REST API"],
  "projectType": "web-api"
}
\`\`\``;

      const result = parseAnalysisResponse(response);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.name).toBe("TestApp");
      }
    });

    it("returns error for unparseable response", () => {
      const result = parseAnalysisResponse("This is not JSON at all");
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("LLM_ERROR");
      }
    });

    it("returns error for missing required fields", () => {
      const response = JSON.stringify({
        name: "TestApp",
        // missing other fields
      });

      const result = parseAnalysisResponse(response);
      expect(isErr(result)).toBe(true);
    });
  });

  describe("assessConfidence", () => {
    it("returns high when many files and README present", () => {
      const context: AssembledContext = {
        content: "lots of content...",
        filesIncluded: 10,
        tokenEstimate: 5000,
      };
      const hasReadme = true;

      expect(assessConfidence(context, hasReadme)).toBe("high");
    });

    it("returns medium with some files but no README", () => {
      const context: AssembledContext = {
        content: "some content",
        filesIncluded: 5,
        tokenEstimate: 2000,
      };
      const hasReadme = false;

      expect(assessConfidence(context, hasReadme)).toBe("medium");
    });

    it("returns low with very few files and little content", () => {
      const context: AssembledContext = {
        content: "x",
        filesIncluded: 1,
        tokenEstimate: 10,
      };
      const hasReadme = false;

      expect(assessConfidence(context, hasReadme)).toBe("low");
    });
  });

  describe("analyzeProject", () => {
    beforeEach(() => {
      vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    });

    it("returns analysis result on successful LLM call", async () => {
      const mockAttributes: ProjectAttributes = {
        name: "TestProject",
        description: "A testing framework",
        primaryLanguages: ["TypeScript"],
        frameworks: ["Vitest"],
        keyFeatures: ["Fast tests", "ESM support"],
        projectType: "testing-framework",
      };

      // Mock the Anthropic SDK
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(mockAttributes) }],
      });

      const context: AssembledContext = {
        content: "--- File: README.md ---\n# TestProject\nA testing framework.",
        filesIncluded: 5,
        tokenEstimate: 3000,
      };

      const result = await analyzeProject(
        "session-123",
        context,
        true, // hasReadme
        undefined,
        { messages: { create: mockCreate } }
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.sessionId).toBe("session-123");
        expect(result.data.attributes.name).toBe("TestProject");
        expect(result.data.confidence).toBe("high");
        expect(result.data.additionalContextNeeded).toBe(false);
      }
    });

    it("flags additional context needed when confidence is low", async () => {
      const mockAttributes: ProjectAttributes = {
        name: "Unknown",
        description: "Unclear purpose",
        primaryLanguages: ["JavaScript"],
        frameworks: [],
        keyFeatures: [],
        projectType: "unknown",
      };

      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(mockAttributes) }],
      });

      const context: AssembledContext = {
        content: "--- File: index.js ---\nconst x = 1;",
        filesIncluded: 1,
        tokenEstimate: 10,
      };

      const result = await analyzeProject(
        "session-456",
        context,
        false,
        undefined,
        { messages: { create: mockCreate } }
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.confidence).toBe("low");
        expect(result.data.additionalContextNeeded).toBe(true);
        expect(result.data.contextPrompt).toBeTruthy();
      }
    });

    it("returns error when LLM call fails", async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error("API error"));

      const context: AssembledContext = {
        content: "some content",
        filesIncluded: 1,
        tokenEstimate: 10,
      };

      const result = await analyzeProject(
        "session-789",
        context,
        false,
        undefined,
        { messages: { create: mockCreate } }
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("LLM_ERROR");
      }
    });
  });
});
