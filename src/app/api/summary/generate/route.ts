import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSummary } from "@/services/summary";
import { isOk } from "@/lib/result";
import type { ProjectAttributes } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: { code: "SESSION_NOT_FOUND", message: "Session ID is required." } },
        { status: 400 }
      );
    }

    const analysis = await prisma.analysis.findUnique({
      where: { sessionId },
    });

    if (!analysis) {
      return NextResponse.json(
        { error: { code: "ANALYSIS_INCOMPLETE", message: "No analysis found for this session. Run analysis first." } },
        { status: 404 }
      );
    }

    const attributes: ProjectAttributes = JSON.parse(analysis.attributes);
    const result = await generateSummary(sessionId, attributes);

    if (!isOk(result)) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Persist summary
    await prisma.summary.upsert({
      where: { sessionId },
      update: {
        content: result.data.summary,
        characterCount: result.data.characterCount,
        hashtags: JSON.stringify(result.data.hashtags),
      },
      create: {
        sessionId,
        content: result.data.summary,
        characterCount: result.data.characterCount,
        hashtags: JSON.stringify(result.data.hashtags),
      },
    });

    await prisma.session.update({
      where: { id: sessionId },
      data: { status: "summarized" },
    });

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Summary generation error:", error);
    return NextResponse.json(
      { error: { code: "GENERATION_FAILED", message: "An unexpected error occurred." } },
      { status: 500 }
    );
  }
}
