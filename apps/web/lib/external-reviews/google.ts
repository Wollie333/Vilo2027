import "server-only";

import { encryptOAuthToken, decryptOAuthToken } from "@/lib/crypto/oauth";
import type { GoogleLocation, GoogleReview } from "./types";

// Google Business Profile API configuration
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_BUSINESS_API =
  "https://mybusinessaccountmanagement.googleapis.com/v1";
const GOOGLE_REVIEWS_API = "https://mybusiness.googleapis.com/v4";

// Scopes needed for reading and replying to reviews
const SCOPES = ["https://www.googleapis.com/auth/business.manage"].join(" ");

function getGoogleClientId(): string {
  const clientId = process.env.GOOGLE_REVIEWS_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_REVIEWS_CLIENT_ID is not configured");
  }
  return clientId;
}

function getGoogleClientSecret(): string {
  const secret = process.env.GOOGLE_REVIEWS_SECRET;
  if (!secret) {
    throw new Error("GOOGLE_REVIEWS_SECRET is not configured");
  }
  return secret;
}

/**
 * Generate the Google OAuth authorization URL.
 */
export function getGoogleAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent", // Force consent to get refresh token
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
): Promise<
  | {
      accessToken: string;
      refreshToken: string;
      expiresAt: Date;
    }
  | { error: string }
> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    return {
      error: data.error_description || data.error || "Token exchange failed",
    };
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
  };
}

/**
 * Refresh an expired access token.
 */
export async function refreshGoogleToken(
  encryptedRefreshToken: string,
): Promise<
  | {
      accessToken: string;
      expiresAt: Date;
    }
  | { error: string }
> {
  const refreshToken = decryptOAuthToken(encryptedRefreshToken);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    return {
      error: data.error_description || data.error || "Token refresh failed",
    };
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  return {
    accessToken: data.access_token,
    expiresAt,
  };
}

/**
 * Get list of Google Business Profile accounts and locations.
 */
export async function getGoogleLocations(
  accessToken: string,
): Promise<GoogleLocation[] | { error: string }> {
  // First, get the accounts
  const accountsResponse = await fetch(`${GOOGLE_BUSINESS_API}/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!accountsResponse.ok) {
    const error = await accountsResponse.json();
    return { error: error.error?.message || "Failed to fetch Google accounts" };
  }

  const accountsData = await accountsResponse.json();
  const accounts = accountsData.accounts || [];

  // For each account, get the locations
  const locations: GoogleLocation[] = [];

  for (const account of accounts) {
    const locationsResponse = await fetch(
      `${GOOGLE_BUSINESS_API}/${account.name}/locations`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (locationsResponse.ok) {
      const locationsData = await locationsResponse.json();
      for (const loc of locationsData.locations || []) {
        locations.push({
          name: loc.name,
          locationName: loc.title || loc.locationName || "Unnamed Location",
          primaryPhone: loc.primaryPhone,
          websiteUrl: loc.websiteUri,
        });
      }
    }
  }

  return locations;
}

/**
 * Fetch reviews for a Google Business Profile location.
 */
export async function fetchGoogleReviews(
  accessToken: string,
  locationName: string,
  pageToken?: string,
): Promise<
  | {
      reviews: GoogleReview[];
      nextPageToken?: string;
    }
  | { error: string }
> {
  const params = new URLSearchParams({ pageSize: "50" });
  if (pageToken) params.set("pageToken", pageToken);

  const response = await fetch(
    `${GOOGLE_REVIEWS_API}/${locationName}/reviews?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    const error = await response.json();
    return { error: error.error?.message || "Failed to fetch Google reviews" };
  }

  const data = await response.json();

  return {
    reviews: data.reviews || [],
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Post a reply to a Google review.
 */
export async function postGoogleReviewReply(
  accessToken: string,
  reviewName: string,
  replyText: string,
): Promise<{ ok: true } | { error: string }> {
  const response = await fetch(`${GOOGLE_REVIEWS_API}/${reviewName}/reply`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ comment: replyText }),
  });

  if (!response.ok) {
    const error = await response.json();
    return { error: error.error?.message || "Failed to post reply" };
  }

  return { ok: true };
}

/**
 * Convert Google star rating to numeric.
 */
export function googleStarRatingToNumber(
  rating: GoogleReview["starRating"],
): number {
  const map: Record<GoogleReview["starRating"], number> = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  };
  return map[rating];
}

/**
 * Encrypt tokens for storage.
 */
export function encryptGoogleTokens(tokens: {
  accessToken: string;
  refreshToken: string;
}): {
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
} {
  return {
    encryptedAccessToken: encryptOAuthToken(tokens.accessToken),
    encryptedRefreshToken: encryptOAuthToken(tokens.refreshToken),
  };
}
