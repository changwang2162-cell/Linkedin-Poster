import { ok, err } from "@/lib/result";
import type { Result } from "@/lib/result";
import type { ProjectAttributes, SummaryResult, SummaryError } from "@/lib/types";

const LINKEDIN_CHAR_LIMIT = 3000;

const SUMMARY_SYSTEM_PROMPT = `You are a professional LinkedIn content writer. Generate engaging, professional LinkedIn posts about software projects.

Respond with ONLY a JSON object (no markdown, no explanation) with this structure:
{
  "summary": "the LinkedIn post text (max 3000 characters)",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"]
}

Guidelines:
- Write in first person as the developer sharing their project
- Be professional but enthusiastic
- Include what the project does, key technologies, and why it matters
- Keep the tone appropriate for a LinkedIn audience
- Include 3-5 relevant hashtags
- The summary must be under 3000 characters`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnthropicLike = any;

export function buildSummaryPrompt(attributes: ProjectAttributes): string {
  return `Generate a LinkedIn post for my software project with these details:

Project Name: ${attributes.name}
Description: ${attributes.description}
Primary Languages: ${attributes.primaryLanguages.join(", ")}
Frameworks/Libraries: ${attributes.frameworks.join(", ")}
Key Features: ${attributes.keyFeatures.join(", ")}
Project Type: ${attributes.projectType}

Create an engaging LinkedIn post (max 3000 characters) with relevant hashtags. The post should highlight what the project does, the technologies used, and why it matters.`;
}

export function buildRegenerationPrompt(
  originalSummary: string,
  attributes: ProjectAttributes,
  feedback: string
): string {
  return `I have an existing LinkedIn post about my project "${attributes.name}" that I'd like to revise.

Original post:
${originalSummary}

Project context:
- Description: ${attributes.description}
- Languages: ${attributes.primaryLanguages.join(", ")}
- Frameworks: ${attributes.frameworks.join(", ")}
- Key Features: ${attributes.keyFeatures.join(", ")}

User feedback for revision:
${feedback}

Please regenerate the post incorporating this feedback. Keep it under 3000 characters with relevant hashtags.`;
}

export function parseSummaryResponse(
  response: string
): Result<{ summary: string; hashtags: string[]; characterCount: number }, SummaryError> {
  let jsonStr = response.trim();

  // Strip markdown code block if present
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  let summary: string;
  let hashtags: string[] = [];

  try {
    const parsed = JSON.parse(jsonStr);
    summary = parsed.summary || "";
    hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];
  } catch {
    // Fallback: treat entire response as summary, extract hashtags
    summary = response.trim();
    const hashtagMatches = summary.match(/#\w+/g);
    hashtags = hashtagMatches || [];
  }

  // Enforce character limit
  if (summary.length > LINKEDIN_CHAR_LIMIT) {
    summary = summary.slice(0, LINKEDIN_CHAR_LIMIT);
  }

  return ok({
    summary,
    hashtags,
    characterCount: summary.length,
  });
}

async function callLLM(
  prompt: string,
  client?: AnthropicLike
): Promise<Result<string, SummaryError>> {
  let anthropic = client;
  if (!anthropic) {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    anthropic = new Anthropic();
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((b: { type: string }) => b.type === "text");
    if (!textBlock) {
      return err({
        code: "GENERATION_FAILED",
        message: "No text response from summary generation.",
      });
    }
    return ok(textBlock.text);
  } catch (e) {
    return err({
      code: "GENERATION_FAILED",
      message: `Summary generation failed: ${e instanceof Error ? e.message : "Unknown error"}`,
    });
  }
}

export async function generateSummary(
  sessionId: string,
  attributes: ProjectAttributes,
  client?: AnthropicLike
): Promise<Result<SummaryResult, SummaryError>> {
  const prompt = buildSummaryPrompt(attributes);
  const llmResult = await callLLM(prompt, client);

  if (!llmResult.success) return llmResult;

  const parseResult = parseSummaryResponse(llmResult.data);
  if (!parseResult.success) return parseResult;

  return ok({
    sessionId,
    summary: parseResult.data.summary,
    characterCount: parseResult.data.characterCount,
    hashtags: parseResult.data.hashtags,
  });
}

export async function regenerateSummary(
  sessionId: string,
  originalSummary: string,
  attributes: ProjectAttributes,
  feedback: string,
  client?: AnthropicLike
): Promise<Result<SummaryResult, SummaryError>> {
  const prompt = buildRegenerationPrompt(originalSummary, attributes, feedback);
  const llmResult = await callLLM(prompt, client);

  if (!llmResult.success) return llmResult;

  const parseResult = parseSummaryResponse(llmResult.data);
  if (!parseResult.success) return parseResult;

  return ok({
    sessionId,
    summary: parseResult.data.summary,
    characterCount: parseResult.data.characterCount,
    hashtags: parseResult.data.hashtags,
  });
}
