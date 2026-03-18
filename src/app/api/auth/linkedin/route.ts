import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { buildAuthorizationUrl } from "@/services/oauth";

export async function GET(request: NextRequest) {
  const state = crypto.randomUUID();
  const baseUrl = new URL(request.url).origin;

  // Store state in a cookie for CSRF validation in callback
  const authUrl = buildAuthorizationUrl(state, baseUrl);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
