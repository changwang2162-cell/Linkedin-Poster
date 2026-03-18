import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, encryptTokens } from "@/services/oauth";
import { isOk } from "@/lib/result";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const baseUrl = new URL(request.url).origin;

  // Check for OAuth error from LinkedIn
  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/?auth_error=${encodeURIComponent("LinkedIn authorization was denied.")}`
    );
  }

  // Validate required params
  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/?auth_error=${encodeURIComponent("Missing authorization parameters.")}`
    );
  }

  // Validate CSRF state
  const storedState = request.cookies.get("oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      `${baseUrl}/?auth_error=${encodeURIComponent("Invalid state parameter. Please try again.")}`
    );
  }

  // Exchange code for tokens
  const result = await exchangeCodeForTokens(code, baseUrl);
  if (!isOk(result)) {
    return NextResponse.redirect(
      `${baseUrl}/?auth_error=${encodeURIComponent(result.error.message)}`
    );
  }

  const tokens = result.data;
  const secret = process.env.ENCRYPTION_SECRET!;
  const { encryptedAccess, encryptedRefresh } = encryptTokens(
    { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
    secret
  );

  // Upsert user and store tokens
  const user = await prisma.user.upsert({
    where: { email: `${tokens.linkedInId}@linkedin.oauth` },
    update: {},
    create: { email: `${tokens.linkedInId}@linkedin.oauth` },
  });

  await prisma.linkedInAuth.upsert({
    where: { userId: user.id },
    update: {
      linkedInId: tokens.linkedInId,
      accessToken: encryptedAccess,
      refreshToken: encryptedRefresh,
      displayName: tokens.displayName,
      expiresAt: tokens.expiresAt,
    },
    create: {
      userId: user.id,
      linkedInId: tokens.linkedInId,
      accessToken: encryptedAccess,
      refreshToken: encryptedRefresh,
      displayName: tokens.displayName,
      expiresAt: tokens.expiresAt,
    },
  });

  // Clear state cookie and redirect with user ID
  const response = NextResponse.redirect(`${baseUrl}/?auth_success=true`);
  response.cookies.delete("oauth_state");
  response.cookies.set("user_id", user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: "/",
  });

  return response;
}
