import "server-only";

import { encryptOAuthToken, decryptOAuthToken } from "@/lib/crypto/oauth";
import type { FacebookPage, FacebookReview } from "./types";

// Facebook OAuth configuration.
//
// ONE constant for the version. It was previously written out four times across
// three files (two of them in Edge Functions), so a bump meant finding all four
// or silently running two versions at once.
//
// v18.0 was NOT dead — checked 2026-07-22 with a real app access token, it still
// answered normally, contrary to third-party claims that it expired in January.
// Moved to v22.0 for runway, not as a fix: Meta retires a version roughly two
// years after release, and v18.0 shipped in 2023. When it does expire the symptom
// is a 400 on every call, and the fix is this one line.
// https://developers.facebook.com/docs/graph-api/changelog/versions/
const FACEBOOK_GRAPH_VERSION = "v22.0";

const FACEBOOK_AUTH_URL = `https://www.facebook.com/${FACEBOOK_GRAPH_VERSION}/dialog/oauth`;
const FACEBOOK_TOKEN_URL = `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/oauth/access_token`;
const FACEBOOK_GRAPH_API = `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}`;

// Permissions needed for reading page reviews and posting replies
const PERMISSIONS = [
  "pages_read_engagement",
  "pages_show_list",
  "pages_manage_posts", // For replying to reviews
].join(",");

function getFacebookAppId(): string {
  const appId = process.env.FACEBOOK_APP_ID;
  if (!appId) {
    throw new Error("FACEBOOK_APP_ID is not configured");
  }
  return appId;
}

function getFacebookAppSecret(): string {
  const secret = process.env.FACEBOOK_APP_SECRET;
  if (!secret) {
    throw new Error("FACEBOOK_APP_SECRET is not configured");
  }
  return secret;
}

/**
 * Generate the Facebook OAuth authorization URL.
 */
export function getFacebookAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: getFacebookAppId(),
    redirect_uri: redirectUri,
    state,
    scope: PERMISSIONS,
    response_type: "code",
  });
  return `${FACEBOOK_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for a user access token.
 */
export async function exchangeFacebookCode(
  code: string,
  redirectUri: string,
): Promise<
  | {
      accessToken: string;
      expiresAt: Date;
    }
  | { error: string }
> {
  const params = new URLSearchParams({
    client_id: getFacebookAppId(),
    client_secret: getFacebookAppSecret(),
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch(`${FACEBOOK_TOKEN_URL}?${params.toString()}`);
  const data = await response.json();

  if (!response.ok || data.error) {
    return { error: data.error?.message || "Token exchange failed" };
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  return {
    accessToken: data.access_token,
    expiresAt,
  };
}

/**
 * Get long-lived page access tokens from a user access token.
 * Page tokens don't expire as long as the user maintains admin access.
 */
export async function getFacebookPages(
  userAccessToken: string,
): Promise<FacebookPage[] | { error: string }> {
  // First, get long-lived user token
  const longLivedParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: getFacebookAppId(),
    client_secret: getFacebookAppSecret(),
    fb_exchange_token: userAccessToken,
  });

  const longLivedResponse = await fetch(
    `${FACEBOOK_TOKEN_URL}?${longLivedParams.toString()}`,
  );
  const longLivedData = await longLivedResponse.json();

  if (!longLivedResponse.ok || longLivedData.error) {
    return {
      error: longLivedData.error?.message || "Failed to get long-lived token",
    };
  }

  const longLivedToken = longLivedData.access_token;

  // Get pages the user manages
  const pagesResponse = await fetch(
    `${FACEBOOK_GRAPH_API}/me/accounts?access_token=${longLivedToken}`,
  );
  const pagesData = await pagesResponse.json();

  if (!pagesResponse.ok || pagesData.error) {
    return { error: pagesData.error?.message || "Failed to fetch pages" };
  }

  return (pagesData.data || []).map(
    (page: { id: string; name: string; access_token: string }) => ({
      id: page.id,
      name: page.name,
      access_token: page.access_token, // Page token (long-lived, doesn't expire)
    }),
  );
}

/**
 * Fetch reviews/recommendations for a Facebook page.
 * Note: Facebook replaced ratings with "Recommends" yes/no in many regions.
 */
export async function fetchFacebookReviews(
  pageAccessToken: string,
  pageId: string,
  after?: string,
): Promise<
  | {
      reviews: FacebookReview[];
      paging?: { cursors: { after: string } };
    }
  | { error: string }
> {
  const params = new URLSearchParams({
    access_token: pageAccessToken,
    fields: "recommendation_type,review_text,created_time,reviewer",
    limit: "50",
  });
  if (after) params.set("after", after);

  const response = await fetch(
    `${FACEBOOK_GRAPH_API}/${pageId}/ratings?${params.toString()}`,
  );
  const data = await response.json();

  if (!response.ok || data.error) {
    return { error: data.error?.message || "Failed to fetch reviews" };
  }

  return {
    reviews: data.data || [],
    paging: data.paging,
  };
}

/**
 * Post a reply to a Facebook review/recommendation.
 * Note: Facebook doesn't support direct replies to recommendations.
 * This posts a comment on the recommendation if it's a post.
 */
export async function postFacebookReviewReply(
  pageAccessToken: string,
  reviewId: string,
  replyText: string,
): Promise<{ ok: true } | { error: string }> {
  const response = await fetch(`${FACEBOOK_GRAPH_API}/${reviewId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: pageAccessToken,
      message: replyText,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    return { error: error.error?.message || "Failed to post reply" };
  }

  return { ok: true };
}

/**
 * Convert Facebook recommendation to a numeric rating.
 * Facebook uses "positive" (recommend) or "negative" (don't recommend).
 */
export function facebookRecommendationToRating(
  recommendationType: FacebookReview["recommendation_type"],
): number | null {
  switch (recommendationType) {
    case "positive":
      return 5; // Recommend = 5 stars
    case "negative":
      return 1; // Don't recommend = 1 star
    default:
      return null; // No recommendation
  }
}

/**
 * Encrypt tokens for storage.
 */
export function encryptFacebookTokens(accessToken: string): string {
  return encryptOAuthToken(accessToken);
}

/**
 * Decrypt tokens from storage.
 */
export function decryptFacebookToken(encryptedToken: string): string {
  return decryptOAuthToken(encryptedToken);
}
