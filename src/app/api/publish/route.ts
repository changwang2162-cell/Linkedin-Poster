import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishToLinkedIn } from "@/services/publisher";
import { getValidToken, decryptToken } from "@/services/oauth";
import { isOk } from "@/lib/result";

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: { code: "API_ERROR", message: "Session ID is required.", retryable: false } },
        { status: 400 }
      );
    }

    // Get session and verify it has a summary
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { summary: true },
    });

    if (!session) {
      return NextResponse.json(
        { error: { code: "API_ERROR", message: "Session not found.", retryable: false } },
        { status: 404 }
      );
    }

    if (!session.summary) {
      return NextResponse.json(
        { error: { code: "INVALID_CONTENT", message: "No summary found. Generate a summary first.", retryable: false } },
        { status: 400 }
      );
    }

    if (!session.userId) {
      return NextResponse.json(
        { error: { code: "AUTH_REQUIRED", message: "No user associated with this session.", retryable: false } },
        { status: 401 }
      );
    }

    // Get LinkedIn auth for the user
    const auth = await prisma.linkedInAuth.findUnique({
      where: { userId: session.userId },
    });

    if (!auth) {
      return NextResponse.json(
        { error: { code: "AUTH_REQUIRED", message: "LinkedIn account not connected. Please connect first.", retryable: false } },
        { status: 401 }
      );
    }

    const secret = process.env.ENCRYPTION_SECRET!;

    // Get a valid access token (handles refresh if needed)
    const tokenResult = await getValidToken(auth, secret);
    if (!isOk(tokenResult)) {
      return NextResponse.json(
        { error: { code: "AUTH_REQUIRED", message: tokenResult.error.message, retryable: false } },
        { status: 401 }
      );
    }

    const accessToken = tokenResult.data;
    const authorUrn = `urn:li:person:${auth.linkedInId}`;

    // Publish to LinkedIn
    const publishResult = await publishToLinkedIn(accessToken, authorUrn, session.summary.content);

    if (!isOk(publishResult)) {
      const statusMap: Record<string, number> = {
        AUTH_REQUIRED: 401,
        RATE_LIMITED: 429,
        INVALID_CONTENT: 422,
        API_ERROR: 500,
      };
      const status = statusMap[publishResult.error.code] || 500;
      return NextResponse.json({ error: publishResult.error }, { status });
    }

    // Persist publication record
    await prisma.publication.upsert({
      where: { sessionId },
      update: {
        postUrn: publishResult.data.postUrn,
        postUrl: publishResult.data.postUrl,
      },
      create: {
        sessionId,
        postUrn: publishResult.data.postUrn,
        postUrl: publishResult.data.postUrl,
      },
    });

    // Update session status
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: "published" },
    });

    return NextResponse.json(publishResult.data);
  } catch (error) {
    console.error("Publish error:", error);
    return NextResponse.json(
      { error: { code: "API_ERROR", message: "An unexpected error occurred.", retryable: true } },
      { status: 500 }
    );
  }
}
