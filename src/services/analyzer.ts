import fs from "fs";
import path from "path";
import { ok, err } from "@/lib/result";
import type { Result } from "@/lib/result";
import type {
  FileManifestEntry,
  ProjectAttributes,
  AnalysisResult,
  AnalysisError,
} from "@/lib/types";

const PRIORITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

// Default max tokens for context assembly (~150K tokens to leave room for prompt + response)
const DEFAULT_MAX_TOKENS = 150_000;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function sortManifestByPriority(
  manifest: FileManifestEntry[]
): FileManifestEntry[] {
  return [...manifest].sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Within high priority, put README first
    const aIsReadme = a.path.toLowerCase().includes("readme");
    const bIsReadme = b.path.toLowerCase().includes("readme");
    if (aIsReadme && !bIsReadme) return -1;
    if (!aIsReadme && bIsReadme) return 1;

    return 0;
  });
}

export interface AssembledContext {
  content: string;
  filesIncluded: number;
  tokenEstimate: number;
}

export function assembleContext(
  sessionId: string,
  manifest: FileManifestEntry[],
  baseTmpDir: string,
  maxTokens: number = DEFAULT_MAX_TOKENS
): AssembledContext {
  const sorted = sortManifestByPriority(manifest);
  const sessionDir = path.join(baseTmpDir, sessionId);

  const sections: string[] = [];
  let totalTokens = 0;
  let filesIncluded = 0;

  for (const entry of sorted) {
    // Skip low-priority files (binary, assets, etc.)
    if (entry.priority === "low") continue;

    const filePath = path.join(sessionDir, entry.path);

    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      // Skip files that can't be read
      continue;
    }

    const fileTokens = estimateTokens(content);

    // Check if adding this file would exceed the budget
    if (totalTokens + fileTokens > maxTokens) continue;

    sections.push(`--- File: ${entry.path} ---\n${content}`);
    totalTokens += fileTokens;
    filesIncluded++;
  }

  return {
    content: sections.join("\n\n"),
    filesIncluded,
    tokenEstimate: totalTokens,
  };
}

// ─── LLM Analysis ───

const ANALYSIS_SYSTEM_PROMPT = `You are a software project analyzer. Given the contents of a software project's files, extract key project attributes. Respond with ONLY a JSON object (no markdown, no explanation) with this exact structure:

{
  "name": "project name",
  "description": "one paragraph describing what the project does",
  "primaryLanguages": ["language1", "language2"],
  "frameworks": ["framework1", "framework2"],
  "keyFeatures": ["feature1", "feature2", "feature3"],
  "projectType": "web-app|cli-tool|library|api|mobile-app|desktop-app|data-pipeline|devtool|other"
}

Be specific and accurate. Only include languages, frameworks, and features that are clearly evidenced in the code.`;

export function buildAnalysisPrompt(
  context: AssembledContext,
  additionalContext?: string
): string {
  let prompt = `Analyze the following software project files and extract the project attributes as JSON.\n\n${context.content}`;

  if (additionalContext) {
    prompt += `\n\nAdditional context from the user:\n${additionalContext}`;
  }

  return prompt;
}

export function parseAnalysisResponse(
  response: string
): Result<ProjectAttributes, AnalysisError> {
  // Try to extract JSON from the response (may be wrapped in markdown code block)
  let jsonStr = response.trim();

  // Strip markdown code block if present
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return err({
      code: "LLM_ERROR",
      message: "Failed to parse analysis response as JSON.",
    });
  }

  // Validate required fields
  const required = [
    "name",
    "description",
    "primaryLanguages",
    "frameworks",
    "keyFeatures",
    "projectType",
  ];
  for (const field of required) {
    if (!(field in parsed)) {
      return err({
        code: "LLM_ERROR",
        message: `Missing required field: ${field}`,
      });
    }
  }

  return ok(parsed as unknown as ProjectAttributes);
}

export function assessConfidence(
  context: AssembledContext,
  hasReadme: boolean
): "high" | "medium" | "low" {
  if (hasReadme && context.filesIncluded >= 3 && context.tokenEstimate >= 500) {
    return "high";
  }
  if (context.filesIncluded >= 3 || (context.tokenEstimate >= 200 && context.filesIncluded >= 2)) {
    return "medium";
  }
  return "low";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnthropicLike = any;

export async function analyzeProject(
  sessionId: string,
  context: AssembledContext,
  hasReadme: boolean,
  additionalContext?: string,
  client?: AnthropicLike
): Promise<Result<AnalysisResult, AnalysisError>> {
  const prompt = buildAnalysisPrompt(context, additionalContext);
  const confidence = assessConfidence(context, hasReadme);

  let anthropic = client;
  if (!anthropic) {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    anthropic = new Anthropic();
  }

  let responseText: string;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((b: { type: string }) => b.type === "text");
    if (!textBlock) {
      return err({
        code: "LLM_ERROR",
        message: "No text response from analysis.",
      });
    }
    responseText = textBlock.text;
  } catch (e) {
    return err({
      code: "LLM_ERROR",
      message: `Analysis failed: ${e instanceof Error ? e.message : "Unknown error"}`,
    });
  }

  const parseResult = parseAnalysisResponse(responseText);
  if (!parseResult.success) {
    return parseResult;
  }

  const additionalContextNeeded = confidence === "low";

  return ok({
    sessionId,
    attributes: parseResult.data,
    confidence,
    additionalContextNeeded,
    contextPrompt: additionalContextNeeded
      ? "The project doesn't have enough information for a confident analysis. Please describe what this project does, its main technologies, and key features."
      : undefined,
  });
}
