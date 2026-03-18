import { ok, err } from "@/lib/result";
import type { Result } from "@/lib/result";
import type { PublishResult, PublishError } from "@/lib/types";

const LINKEDIN_UGC_URL = "https://api.linkedin.com/v2/ugcPosts";

type FetchFn = typeof fetch;

export function buildPostPayload(authorUrn: string, summaryText: string) {
  return {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: summaryText },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };
}

export function parsePostResponse(
  responseBody: Record<string, unknown>
): Result<PublishResult, PublishError> {
  const postUrn = responseBody.id as string | undefined;
  if (!postUrn) {
    return err({
      code: "API_ERROR",
      message: "LinkedIn API did not return a post ID.",
      retryable: true,
    });
  }

  // Extract the numeric ID from the URN for the post URL
  const idMatch = postUrn.match(/(\d+)$/);
  const postId = idMatch ? idMatch[1] : postUrn;
  const postUrl = `https://www.linkedin.com/feed/update/${postUrn}/`;

  return ok({ postUrn, postUrl });
}

export async function publishToLinkedIn(
  accessToken: string,
  authorUrn: string,
  summaryText: string,
  fetchFn: FetchFn = fetch
): Promise<Result<PublishResult, PublishError>> {
  const payload = buildPostPayload(authorUrn, summaryText);

  let response: Response;
  try {
    response = await fetchFn(LINKEDIN_UGC_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return err({
      code: "API_ERROR",
      message: `Failed to connect to LinkedIn: ${e instanceof Error ? e.message : "Unknown error"}`,
      retryable: true,
    });
  }

  if (!response.ok) {
    let errorMessage = "LinkedIn API error";
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.message || errorMessage;
    } catch {
      // ignore JSON parse errors
    }

    if (response.status === 401) {
      return err({
        code: "AUTH_REQUIRED",
        message: "LinkedIn authentication expired. Please reconnect your account.",
        retryable: false,
      });
    }

    if (response.status === 422) {
      return err({
        code: "INVALID_CONTENT",
        message: `LinkedIn rejected the post content: ${errorMessage}`,
        retryable: false,
      });
    }

    if (response.status === 429) {
      return err({
        code: "RATE_LIMITED",
        message: "LinkedIn rate limit exceeded. Please try again later.",
        retryable: true,
      });
    }

    return err({
      code: "API_ERROR",
      message: `LinkedIn publishing failed: ${errorMessage}`,
      retryable: true,
    });
  }

  const body = await response.json();
  return parsePostResponse(body);
}
