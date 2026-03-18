import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const userId = request.cookies.get("user_id")?.value;

  if (!userId) {
    return NextResponse.json({ connected: false });
  }

  const auth = await prisma.linkedInAuth.findUnique({
    where: { userId },
  });

  if (!auth) {
    return NextResponse.json({ connected: false });
  }

  const isExpired = auth.expiresAt < new Date();

  return NextResponse.json({
    connected: !isExpired,
    displayName: auth.displayName,
    expiresAt: auth.expiresAt.toISOString(),
  });
}
