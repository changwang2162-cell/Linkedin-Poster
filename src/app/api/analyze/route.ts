import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/prisma";
import { assembleContext, analyzeProject } from "@/services/analyzer";
import { isOk } from "@/lib/result";
import type { FileManifestEntry } from "@/lib/types";

const UPLOAD_TMP_DIR = path.join(process.cwd(), "tmp-uploads");

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, additionalContext } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: { code: "SESSION_NOT_FOUND", message: "Session ID is required." } },
        { status: 400 }
      );
    }

    // Look up session in DB
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || !session.manifest) {
      return NextResponse.json(
        { error: { code: "SESSION_NOT_FOUND", message: "Session not found or has no files." } },
        { status: 404 }
      );
    }

    const manifest: FileManifestEntry[] = JSON.parse(session.manifest);
    const hasReadme = manifest.some((f) =>
      f.path.toLowerCase().includes("readme")
    );

    // Assemble context from files
    const context = assembleContext(sessionId, manifest, UPLOAD_TMP_DIR);

    if (context.filesIncluded === 0) {
      return NextResponse.json(
        { error: { code: "INSUFFICIENT_CONTEXT", message: "No readable files found in the project." } },
        { status: 422 }
      );
    }

    // Update session status
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: "analyzing" },
    });

    // Run LLM analysis
    const result = await analyzeProject(
      sessionId,
      context,
      hasReadme,
      additionalContext
    );

    if (!isOk(result)) {
      await prisma.session.update({
        where: { id: sessionId },
        data: { status: "failed" },
      });
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Persist analysis
    await prisma.analysis.upsert({
      where: { sessionId },
      update: {
        attributes: JSON.stringify(result.data.attributes),
        confidence: result.data.confidence,
      },
      create: {
        sessionId,
        attributes: JSON.stringify(result.data.attributes),
        confidence: result.data.confidence,
      },
    });

    await prisma.session.update({
      where: { id: sessionId },
      data: { status: "analyzed" },
    });

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: { code: "LLM_ERROR", message: "An unexpected error occurred during analysis." } },
      { status: 500 }
    );
  }
}
