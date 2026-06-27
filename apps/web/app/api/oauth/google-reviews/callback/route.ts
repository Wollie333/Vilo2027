import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createServerClient } from "@/lib/supabase/server";
import { requireHost } from "@/lib/host/current";
import {
  exchangeGoogleCode,
  getGoogleLocations,
  encryptGoogleTokens,
} from "@/lib/external-reviews/google";
import type { OAuthState } from "@/lib/external-reviews/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Must match the cookie name set in connectExternalSourceAction: `${source}${OAUTH_STATE_COOKIE_PREFIX}`
const OAUTH_STATE_COOKIE = "google_oauth_state";

/**
 * Google OAuth callback for connecting Google Business Profile reviews.
 *
 * Flow:
 * 1. Verify state parameter matches stored state (CSRF protection)
 * 2. Exchange authorization code for tokens
 * 3. Fetch Google Business Profile locations
 * 4. Store encrypted tokens + first location in external_review_sources
 * 5. Redirect to reviews manager with success/error status
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Base redirect URL for errors
  const errorRedirect = (message: string) => {
    const redirectUrl = new URL("/en/dashboard/reviews", request.url);
    redirectUrl.searchParams.set("view", "external");
    redirectUrl.searchParams.set("error", message);
    return NextResponse.redirect(redirectUrl);
  };

  // Check for OAuth errors from Google
  if (error) {
    return errorRedirect(
      error === "access_denied"
        ? "You declined to connect your Google account."
        : `Google error: ${error}`,
    );
  }

  // Validate required parameters
  if (!code || !stateParam) {
    return errorRedirect("Missing authorization code or state.");
  }

  // Verify state matches (CSRF protection)
  const cookieStore = cookies();
  const storedStateRaw = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  if (!storedStateRaw) {
    return errorRedirect("OAuth session expired. Please try again.");
  }

  let storedState: OAuthState;
  try {
    storedState = JSON.parse(storedStateRaw);
  } catch {
    return errorRedirect("Invalid OAuth state.");
  }

  if (storedState.nonce !== stateParam) {
    return errorRedirect("OAuth state mismatch. Please try again.");
  }

  // Clear the state cookie
  cookieStore.delete(OAUTH_STATE_COOKIE);

  // Verify the user is still authenticated as a host
  const hostResult = await requireHost();
  if (!hostResult.ok) {
    return errorRedirect("You must be signed in as a host.");
  }

  // Verify the host ID matches
  if (hostResult.hostId !== storedState.hostId) {
    return errorRedirect("Host session mismatch.");
  }

  // Build the redirect URI (must match what was sent to Google)
  const redirectUri = `${url.origin}/api/oauth/google-reviews/callback`;

  // Exchange code for tokens
  const tokenResult = await exchangeGoogleCode(code, redirectUri);
  if ("error" in tokenResult) {
    return errorRedirect(tokenResult.error);
  }

  // Get Google Business Profile locations
  const locationsResult = await getGoogleLocations(tokenResult.accessToken);
  if ("error" in locationsResult) {
    return errorRedirect(locationsResult.error);
  }

  if (locationsResult.length === 0) {
    return errorRedirect(
      "No Google Business Profile locations found. Please create a business profile first.",
    );
  }

  // For MVP, use the first location. TODO: Add location picker UI
  const location = locationsResult[0];

  // Encrypt tokens for storage
  const { encryptedAccessToken, encryptedRefreshToken } = encryptGoogleTokens({
    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken,
  });

  // Store in database
  const supabase = createServerClient();
  const { error: insertError } = await supabase
    .from("external_review_sources")
    .upsert(
      {
        host_id: hostResult.hostId,
        source: "google",
        external_account_id: location.name,
        account_name: location.locationName,
        account_url: location.websiteUrl ?? null,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_expires_at: tokenResult.expiresAt.toISOString(),
        is_active: true,
        last_synced_at: null,
        last_sync_error: null,
      },
      {
        onConflict: "host_id,source,external_account_id",
      },
    );

  if (insertError) {
    console.error("Failed to save Google connection:", insertError);
    return errorRedirect("Failed to save your Google connection.");
  }

  // Success! Redirect to reviews manager
  const successUrl = new URL(
    storedState.returnUrl || "/en/dashboard/reviews",
    request.url,
  );
  successUrl.searchParams.set("view", "external");
  successUrl.searchParams.set("connected", "google");
  return NextResponse.redirect(successUrl);
}
