import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revokeLinkedInToken, decryptToken } from "@/services/oauth";

export async function POST(request: NextRequest) {
  const userId = request.cookies.get("user_id")?.value;

  if (!userId) {
    return NextResponse.json(
      { error: { code: "AUTH_REQUIRED", message: "Not authenticated." } },
      { status: 401 }
    );
  }

  const auth = await prisma.linkedInAuth.findUnique({
    where: { userId },
  });

  if (auth) {
    const secret = process.env.ENCRYPTION_SECRET!;
    const accessToken = decryptToken(auth.accessToken, secret);

    // Best-effort revocation with LinkedIn
    await revokeLinkedInToken(accessToken);

    // Delete from database
    await prisma.linkedInAuth.delete({ where: { userId } });
  }

  // Clear user cookie
  const response = NextResponse.json({ success: true });
  response.cookies.delete("user_id");

  return response;
}
