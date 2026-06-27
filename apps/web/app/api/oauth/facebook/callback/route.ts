import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createServerClient } from "@/lib/supabase/server";
import { requireHost } from "@/lib/host/current";
import {
  exchangeFacebookCode,
  getFacebookPages,
  encryptFacebookTokens,
} from "@/lib/external-reviews/facebook";
import type { OAuthState } from "@/lib/external-reviews/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Must match the cookie name set in connectExternalSourceAction: `${source}${OAUTH_STATE_COOKIE_PREFIX}`
const OAUTH_STATE_COOKIE = "facebook_oauth_state";

/**
 * Facebook OAuth callback for connecting Facebook Page reviews.
 *
 * Flow:
 * 1. Verify state parameter matches stored state (CSRF protection)
 * 2. Exchange authorization code for user access token
 * 3. Get long-lived page access tokens
 * 4. Store encrypted page token + first page in external_review_sources
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

  // Check for OAuth errors from Facebook
  if (error) {
    const errorDescription = url.searchParams.get("error_description");
    return errorRedirect(errorDescription || `Facebook error: ${error}`);
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

  // Build the redirect URI (must match what was sent to Facebook)
  const redirectUri = `${url.origin}/api/oauth/facebook/callback`;

  // Exchange code for user access token
  const tokenResult = await exchangeFacebookCode(code, redirectUri);
  if ("error" in tokenResult) {
    return errorRedirect(tokenResult.error);
  }

  // Get Facebook pages with long-lived tokens
  const pagesResult = await getFacebookPages(tokenResult.accessToken);
  if ("error" in pagesResult) {
    return errorRedirect(pagesResult.error);
  }

  if (pagesResult.length === 0) {
    return errorRedirect(
      "No Facebook Pages found. Please make sure you manage at least one Facebook Page.",
    );
  }

  // For MVP, use the first page. TODO: Add page picker UI
  const page = pagesResult[0];

  // Encrypt the page access token for storage
  const encryptedToken = encryptFacebookTokens(page.access_token);

  // Store in database
  const supabase = createServerClient();
  const { error: insertError } = await supabase
    .from("external_review_sources")
    .upsert(
      {
        host_id: hostResult.hostId,
        source: "facebook",
        external_account_id: page.id,
        account_name: page.name,
        account_url: `https://facebook.com/${page.id}`,
        access_token: encryptedToken,
        refresh_token: null, // Page tokens are long-lived, no refresh needed
        token_expires_at: null, // Page tokens don't expire
        is_active: true,
        last_synced_at: null,
        last_sync_error: null,
      },
      {
        onConflict: "host_id,source,external_account_id",
      },
    );

  if (insertError) {
    console.error("Failed to save Facebook connection:", insertError);
    return errorRedirect("Failed to save your Facebook connection.");
  }

  // Success! Redirect to reviews manager
  const successUrl = new URL(
    storedState.returnUrl || "/en/dashboard/reviews",
    request.url,
  );
  successUrl.searchParams.set("view", "external");
  successUrl.searchParams.set("connected", "facebook");
  return NextResponse.redirect(successUrl);
}
