import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { regenerateSummary } from "@/services/summary";
import { isOk } from "@/lib/result";
import type { ProjectAttributes } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { sessionId, feedback } = await request.json();

    if (!sessionId || !feedback) {
      return NextResponse.json(
        { error: { code: "SESSION_NOT_FOUND", message: "Session ID and feedback are required." } },
        { status: 400 }
      );
    }

    const [analysis, summary] = await Promise.all([
      prisma.analysis.findUnique({ where: { sessionId } }),
      prisma.summary.findUnique({ where: { sessionId } }),
    ]);

    if (!analysis) {
      return NextResponse.json(
        { error: { code: "ANALYSIS_INCOMPLETE", message: "No analysis found for this session." } },
        { status: 404 }
      );
    }

    if (!summary) {
      return NextResponse.json(
        { error: { code: "SESSION_NOT_FOUND", message: "No summary found. Generate one first." } },
        { status: 404 }
      );
    }

    const attributes: ProjectAttributes = JSON.parse(analysis.attributes);
    const result = await regenerateSummary(
      sessionId,
      summary.content,
      attributes,
      feedback
    );

    if (!isOk(result)) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Update summary
    await prisma.summary.update({
      where: { sessionId },
      data: {
        content: result.data.summary,
        characterCount: result.data.characterCount,
        hashtags: JSON.stringify(result.data.hashtags),
      },
    });

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Summary regeneration error:", error);
    return NextResponse.json(
      { error: { code: "GENERATION_FAILED", message: "An unexpected error occurred." } },
      { status: 500 }
    );
  }
}
