import { ok, err } from "@/lib/result";
import type { Result } from "@/lib/result";
import type { OAuthError } from "@/lib/types";
import { encrypt, decrypt } from "@/lib/encryption";

export interface LinkedInTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  linkedInId: string;
  displayName: string;
}

interface TokenAuthRecord {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
const SCOPES = "openid profile w_member_social";

// Refresh tokens 5 minutes before expiry
export const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export function buildAuthorizationUrl(state: string, baseUrl: string): string {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri = `${baseUrl}/api/auth/callback`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId!,
    redirect_uri: redirectUri,
    state,
    scope: SCOPES,
  });

  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  baseUrl: string
): Promise<Result<LinkedInTokens, OAuthError>> {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = `${baseUrl}/api/auth/callback`;

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(LINKEDIN_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId!,
        client_secret: clientSecret!,
      }),
    });
  } catch {
    return err({
      code: "AUTH_FAILED",
      message: "Failed to connect to LinkedIn. Please try again.",
      requiresReauth: true,
    });
  }

  if (!tokenResponse.ok) {
    return err({
      code: "AUTH_FAILED",
      message: "LinkedIn rejected the authorization code. Please try connecting again.",
      requiresReauth: true,
    });
  }

  const tokenData = await tokenResponse.json();

  // Fetch user profile
  let profileResponse: Response;
  try {
    profileResponse = await fetch(LINKEDIN_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
  } catch {
    return err({
      code: "AUTH_FAILED",
      message: "Failed to fetch LinkedIn profile. Please try again.",
      requiresReauth: true,
    });
  }

  let linkedInId: string;
  let displayName: string;

  if (profileResponse.ok) {
    const profile = await profileResponse.json();
    linkedInId = profile.sub;
    displayName = profile.name;
  } else {
    // Fallback: try to parse sub from id_token if available
    linkedInId = "unknown";
    displayName = "LinkedIn User";
  }

  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

  return ok({
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? "",
    expiresAt,
    linkedInId,
    displayName,
  });
}

export function encryptTokens(
  tokens: { accessToken: string; refreshToken: string },
  secret: string
): { encryptedAccess: string; encryptedRefresh: string } {
  return {
    encryptedAccess: encrypt(tokens.accessToken, secret),
    encryptedRefresh: encrypt(tokens.refreshToken, secret),
  };
}

export function decryptToken(encryptedToken: string, secret: string): string {
  return decrypt(encryptedToken, secret);
}

async function refreshAccessToken(
  encryptedRefreshToken: string,
  secret: string
): Promise<Result<{ accessToken: string; expiresAt: Date }, OAuthError>> {
  const refreshToken = decrypt(encryptedRefreshToken, secret);
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  let response: Response;
  try {
    response = await fetch(LINKEDIN_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId!,
        client_secret: clientSecret!,
      }),
    });
  } catch {
    return err({
      code: "REFRESH_FAILED",
      message: "Failed to connect to LinkedIn for token refresh.",
      requiresReauth: true,
    });
  }

  if (!response.ok) {
    return err({
      code: "REFRESH_FAILED",
      message: "LinkedIn token refresh failed. Please reconnect your account.",
      requiresReauth: true,
    });
  }

  const data = await response.json();
  return ok({
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  });
}

export async function getValidToken(
  auth: TokenAuthRecord,
  secret: string
): Promise<Result<string, OAuthError>> {
  const now = Date.now();
  const expiresAt = auth.expiresAt.getTime();

  // Token is still valid and not near expiry
  if (expiresAt - now > TOKEN_EXPIRY_BUFFER_MS) {
    return ok(decrypt(auth.accessToken, secret));
  }

  // Token expired or near expiry — attempt refresh
  const refreshResult = await refreshAccessToken(auth.refreshToken, secret);
  if (!refreshResult.success) {
    return err({
      code: "TOKEN_EXPIRED",
      message: "Your LinkedIn session has expired. Please reconnect.",
      requiresReauth: true,
    });
  }

  return ok(refreshResult.data.accessToken);
}

const LINKEDIN_REVOKE_URL = "https://www.linkedin.com/oauth/v2/revoke";

export async function revokeLinkedInToken(
  accessToken: string
): Promise<Result<void, OAuthError>> {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  try {
    await fetch(LINKEDIN_REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        token: accessToken,
      }),
    });
  } catch {
    // Best-effort revocation — we still delete locally
  }

  return ok(undefined);
}
