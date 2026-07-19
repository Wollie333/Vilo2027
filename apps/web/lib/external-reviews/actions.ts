"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";
import { requireHost } from "@/lib/host/current";
import { getGoogleAuthUrl } from "./google";
import { getFacebookAuthUrl } from "./facebook";
import type { ExternalReviewSource, OAuthState } from "./types";

// ─── Validation Schemas ─────────────────────────────────────────────────────

const uuidSchema = z.string().uuid("Invalid ID format");
const sourceSchema = z.enum(["google", "facebook", "trustpilot"]);
const booleanSchema = z.boolean();

// Schema for Trustpilot credentials validation (used in connectTrustpilotAction)
const trustpilotApiKeySchema = z
  .string()
  .min(10, "API key is too short")
  .max(200, "API key is too long");
const trustpilotApiSecretSchema = z
  .string()
  .min(10, "API secret is too short")
  .max(200, "API secret is too long");
const trustpilotBusinessUnitIdSchema = z
  .string()
  .min(5, "Business Unit ID is required")
  .max(100, "Business Unit ID is too long");

const getReviewsSchema = z.object({
  sourceFilter: sourceSchema.optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).max(10000).default(0),
});

const replyTextSchema = z
  .string()
  .min(10, "Reply must be at least 10 characters")
  .max(4000, "Reply must be less than 4000 characters")
  .transform((s) => s.trim());

const OAUTH_STATE_COOKIE_PREFIX = "_oauth_state";
const OAUTH_STATE_MAX_AGE = 600; // 10 minutes

/**
 * Generate a random nonce for CSRF protection.
 */
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Check if OAuth credentials are configured for a source.
 */
function isOAuthConfigured(source: ExternalReviewSource): {
  configured: boolean;
  error?: string;
} {
  switch (source) {
    case "google":
      if (
        !process.env.GOOGLE_REVIEWS_CLIENT_ID ||
        !process.env.GOOGLE_REVIEWS_SECRET
      ) {
        return {
          configured: false,
          error:
            "Google integration not configured. Add GOOGLE_REVIEWS_CLIENT_ID and GOOGLE_REVIEWS_SECRET to your environment.",
        };
      }
      break;
    case "facebook":
      if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
        return {
          configured: false,
          error:
            "Facebook integration not configured. Add FACEBOOK_APP_ID and FACEBOOK_APP_SECRET to your environment.",
        };
      }
      break;
    case "trustpilot":
      // Trustpilot uses API keys entered by the user, not env vars
      break;
  }

  if (!process.env.OAUTH_CIPHER_KEY) {
    return {
      configured: false,
      error:
        "OAuth encryption not configured. Add OAUTH_CIPHER_KEY to your environment.",
    };
  }

  return { configured: true };
}

/**
 * Initiate OAuth flow to connect an external review source.
 * @param source The external source to connect (google, facebook, trustpilot)
 * @param locale The current locale (e.g., 'en', 'af') for proper redirect after OAuth
 */
export async function connectExternalSourceAction(
  source: ExternalReviewSource,
  locale: string = "en",
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Validate locale (simple check - only allow known locales)
  const validLocale = /^[a-z]{2}(-[A-Z]{2})?$/.test(locale) ? locale : "en";

  // Check if OAuth is configured
  const configCheck = isOAuthConfigured(source);
  if (!configCheck.configured) {
    return { ok: false, error: configCheck.error! };
  }

  const hostResult = await requireHost();
  if (!hostResult.ok) {
    return { ok: false, error: hostResult.error };
  }

  const nonce = generateNonce();
  const state: OAuthState = {
    source,
    hostId: hostResult.hostId,
    returnUrl: `/${validLocale}/dashboard/reviews`,
    nonce,
  };

  // Store state in a cookie
  const cookieStore = cookies();
  const cookieName = `${source}${OAUTH_STATE_COOKIE_PREFIX}`;
  cookieStore.set(cookieName, JSON.stringify(state), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: OAUTH_STATE_MAX_AGE,
    path: "/",
  });

  // Get the base URL from headers or environment
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  let authUrl: string;
  try {
    switch (source) {
      case "google": {
        const redirectUri = `${baseUrl}/api/oauth/google-reviews/callback`;
        authUrl = getGoogleAuthUrl(nonce, redirectUri);
        break;
      }
      case "facebook": {
        const redirectUri = `${baseUrl}/api/oauth/facebook/callback`;
        authUrl = getFacebookAuthUrl(nonce, redirectUri);
        break;
      }
      case "trustpilot":
        // Trustpilot uses API keys, not OAuth
        return {
          ok: false,
          error: "Trustpilot uses API keys. Use the API key form instead.",
        };
      default:
        return { ok: false, error: `Unknown source: ${source}` };
    }
  } catch (e) {
    console.error("OAuth URL generation failed:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to start OAuth flow",
    };
  }

  // Redirect to the OAuth provider
  redirect(authUrl);
}

/**
 * Connect Trustpilot using API credentials (not OAuth).
 */
export async function connectTrustpilotAction(
  apiKey: string,
  apiSecret: string,
  businessUnitId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Validate inputs
  const apiKeyResult = trustpilotApiKeySchema.safeParse(apiKey);
  if (!apiKeyResult.success) {
    return {
      ok: false,
      error: apiKeyResult.error.issues[0]?.message ?? "Invalid API key",
    };
  }
  const apiSecretResult = trustpilotApiSecretSchema.safeParse(apiSecret);
  if (!apiSecretResult.success) {
    return {
      ok: false,
      error: apiSecretResult.error.issues[0]?.message ?? "Invalid API secret",
    };
  }
  const businessUnitResult =
    trustpilotBusinessUnitIdSchema.safeParse(businessUnitId);
  if (!businessUnitResult.success) {
    return {
      ok: false,
      error:
        businessUnitResult.error.issues[0]?.message ??
        "Invalid Business Unit ID",
    };
  }

  const hostResult = await requireHost();
  if (!hostResult.ok) {
    return { ok: false, error: hostResult.error };
  }

  const { encryptOAuthToken } = await import("@/lib/crypto/oauth");

  const supabase = createServerClient();
  const { error } = await supabase.from("external_review_sources").upsert(
    {
      host_id: hostResult.hostId,
      source: "trustpilot",
      external_account_id: businessUnitId,
      account_name: null, // Will be fetched on first sync
      api_key: encryptOAuthToken(apiKey),
      api_secret: encryptOAuthToken(apiSecret),
      is_active: true,
    },
    {
      onConflict: "host_id,source,external_account_id",
    },
  );

  if (error) {
    console.error("Failed to save Trustpilot connection:", error);
    return { ok: false, error: "Failed to save your Trustpilot connection." };
  }

  return { ok: true };
}

/**
 * Disconnect an external review source.
 */
export async function disconnectExternalSourceAction(
  sourceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Validate input
  const sourceIdResult = uuidSchema.safeParse(sourceId);
  if (!sourceIdResult.success) {
    return { ok: false, error: "Invalid source ID" };
  }

  const hostResult = await requireHost();
  if (!hostResult.ok) {
    return { ok: false, error: hostResult.error };
  }

  const supabase = createServerClient();

  // Soft delete the source (keeps historical reviews)
  const { error } = await supabase
    .from("external_review_sources")
    .update({
      is_active: false,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", sourceId)
    .eq("host_id", hostResult.hostId);

  if (error) {
    console.error("Failed to disconnect source:", error);
    return { ok: false, error: "Failed to disconnect the source." };
  }

  return { ok: true };
}

/**
 * Manually trigger a sync for an external review source.
 */
export async function refreshExternalSourceAction(
  sourceId: string,
): Promise<
  { ok: true; added: number; updated: number } | { ok: false; error: string }
> {
  // Validate input
  const sourceIdResult = uuidSchema.safeParse(sourceId);
  if (!sourceIdResult.success) {
    return { ok: false, error: "Invalid source ID" };
  }

  const hostResult = await requireHost();
  if (!hostResult.ok) {
    return { ok: false, error: hostResult.error };
  }

  // Ownership: the sync runs via the service-role Edge Function (RLS bypassed),
  // so verify this source belongs to the caller's host BEFORE triggering it —
  // otherwise a host could sync another tenant's connected source by its id.
  const ownershipClient = createServerClient();
  const { data: ownedSource } = await ownershipClient
    .from("external_review_sources")
    .select("id")
    .eq("id", sourceId)
    .eq("host_id", hostResult.hostId)
    .maybeSingle();
  if (!ownedSource) {
    return { ok: false, error: "Source not found" };
  }

  // Call the external-reviews-sync Edge Function
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return { ok: false, error: "Supabase credentials not configured" };
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/external-reviews-sync`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sync_type: "manual",
          source_id: sourceId,
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      return { ok: false, error: result.error || "Sync failed" };
    }

    return {
      ok: true,
      added: result.successCount ?? 0,
      updated: 0,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get all connected external review sources for the current host.
 */
export async function getExternalSourcesAction(): Promise<
  | {
      ok: true;
      sources: Array<{
        id: string;
        source: ExternalReviewSource;
        accountName: string | null;
        accountUrl: string | null;
        isActive: boolean;
        lastSyncedAt: string | null;
        lastSyncError: string | null;
      }>;
    }
  | { ok: false; error: string }
> {
  const hostResult = await requireHost();
  if (!hostResult.ok) {
    return { ok: false, error: hostResult.error };
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("external_review_sources")
    .select(
      "id, source, account_name, account_url, is_active, last_synced_at, last_sync_error",
    )
    .eq("host_id", hostResult.hostId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch external sources:", error);
    return { ok: false, error: "Failed to load your connected sources." };
  }

  return {
    ok: true,
    sources: (data || []).map((row) => ({
      id: row.id,
      source: row.source as ExternalReviewSource,
      accountName: row.account_name,
      accountUrl: row.account_url,
      isActive: row.is_active,
      lastSyncedAt: row.last_synced_at,
      lastSyncError: row.last_sync_error,
    })),
  };
}

/**
 * Update visibility of an external review.
 */
export async function toggleExternalReviewVisibilityAction(
  reviewId: string,
  isVisible: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Validate input
  const reviewIdResult = uuidSchema.safeParse(reviewId);
  if (!reviewIdResult.success) {
    return { ok: false, error: "Invalid review ID" };
  }
  const isVisibleResult = booleanSchema.safeParse(isVisible);
  if (!isVisibleResult.success) {
    return { ok: false, error: "Invalid visibility value" };
  }

  const hostResult = await requireHost();
  if (!hostResult.ok) {
    return { ok: false, error: hostResult.error };
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("external_reviews")
    .update({ is_visible: isVisibleResult.data })
    .eq("id", reviewIdResult.data)
    .eq("host_id", hostResult.hostId);

  if (error) {
    console.error("Failed to update review visibility:", error);
    return { ok: false, error: "Failed to update review visibility." };
  }

  return { ok: true };
}

/**
 * Toggle featured status of an external review.
 */
export async function toggleExternalReviewFeaturedAction(
  reviewId: string,
  isFeatured: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Validate input
  const reviewIdResult = uuidSchema.safeParse(reviewId);
  if (!reviewIdResult.success) {
    return { ok: false, error: "Invalid review ID" };
  }
  const isFeaturedResult = booleanSchema.safeParse(isFeatured);
  if (!isFeaturedResult.success) {
    return { ok: false, error: "Invalid featured value" };
  }

  const hostResult = await requireHost();
  if (!hostResult.ok) {
    return { ok: false, error: hostResult.error };
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("external_reviews")
    .update({ is_featured: isFeaturedResult.data })
    .eq("id", reviewIdResult.data)
    .eq("host_id", hostResult.hostId);

  if (error) {
    console.error("Failed to update review featured status:", error);
    return { ok: false, error: "Failed to update review featured status." };
  }

  return { ok: true };
}

/**
 * Map an external review to a Wielo property.
 */
export async function mapExternalReviewToPropertyAction(
  reviewId: string,
  propertyId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Validate input
  const reviewIdResult = uuidSchema.safeParse(reviewId);
  if (!reviewIdResult.success) {
    return { ok: false, error: "Invalid review ID" };
  }
  if (propertyId !== null) {
    const propertyIdResult = uuidSchema.safeParse(propertyId);
    if (!propertyIdResult.success) {
      return { ok: false, error: "Invalid property ID" };
    }
  }

  const hostResult = await requireHost();
  if (!hostResult.ok) {
    return { ok: false, error: hostResult.error };
  }

  const supabase = createServerClient();

  // If mapping to a property, verify it belongs to this host — never map a
  // review onto another tenant's property id.
  if (propertyId !== null) {
    const { data: ownProperty } = await supabase
      .from("properties")
      .select("id")
      .eq("id", propertyId)
      .eq("host_id", hostResult.hostId)
      .maybeSingle();
    if (!ownProperty) {
      return { ok: false, error: "Property not found" };
    }
  }

  const { error } = await supabase
    .from("external_reviews")
    .update({ property_id: propertyId })
    .eq("id", reviewId)
    .eq("host_id", hostResult.hostId);

  if (error) {
    console.error("Failed to map review to property:", error);
    return { ok: false, error: "Failed to map review to property." };
  }

  return { ok: true };
}

// ─── External Reviews Retrieval ─────────────────────────────────────────────

export type ExternalReviewDisplay = {
  id: string;
  source: ExternalReviewSource;
  sourceName: string;
  externalReviewId: string;
  reviewerName: string;
  reviewerAvatar: string | null;
  rating: number;
  body: string | null;
  reviewedAt: string;
  reviewUrl: string | null;
  hostReply: string | null;
  hostReplyAt: string | null;
  replySynced: boolean;
  replySyncError: string | null;
  isVisible: boolean;
  isFeatured: boolean;
  propertyId: string | null;
  propertyName: string | null;
};

/**
 * Get external reviews for the current host with filtering and pagination.
 */
export async function getExternalReviewsAction(options?: {
  sourceFilter?: ExternalReviewSource;
  limit?: number;
  offset?: number;
}): Promise<
  | {
      ok: true;
      reviews: ExternalReviewDisplay[];
      total: number;
      hasMore: boolean;
    }
  | { ok: false; error: string }
> {
  // Validate input
  const parsed = getReviewsSchema.safeParse(options ?? {});
  if (!parsed.success) {
    return { ok: false, error: "Invalid parameters" };
  }
  const { sourceFilter, limit, offset } = parsed.data;

  const hostResult = await requireHost();
  if (!hostResult.ok) {
    return { ok: false, error: hostResult.error };
  }

  const supabase = createServerClient();

  // Build query
  let query = supabase
    .from("external_reviews")
    .select(
      `
      id, external_review_id, reviewer_name, reviewer_avatar_url, rating, body,
      reviewed_at, review_url, host_reply, host_reply_at, reply_synced, reply_sync_error,
      is_visible, is_featured, property_id,
      source:external_review_sources!inner ( id, source, account_name ),
      property:properties ( name )
    `,
      { count: "exact" },
    )
    .eq("host_id", hostResult.hostId)
    .is("deleted_at", null)
    .order("reviewed_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Apply source filter if provided
  if (sourceFilter) {
    query = query.eq("source.source", sourceFilter);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Failed to fetch external reviews:", error);
    return { ok: false, error: "Failed to load reviews." };
  }

  type RawRow = {
    id: string;
    external_review_id: string;
    reviewer_name: string;
    reviewer_avatar_url: string | null;
    rating: number;
    body: string | null;
    reviewed_at: string;
    review_url: string | null;
    host_reply: string | null;
    host_reply_at: string | null;
    reply_synced: boolean;
    reply_sync_error: string | null;
    is_visible: boolean;
    is_featured: boolean;
    property_id: string | null;
    source: { id: string; source: string; account_name: string | null };
    property: { name: string } | null;
  };

  const reviews: ExternalReviewDisplay[] = (
    (data ?? []) as unknown as RawRow[]
  ).map((row) => ({
    id: row.id,
    source: row.source.source as ExternalReviewSource,
    sourceName: row.source.account_name ?? row.source.source,
    externalReviewId: row.external_review_id,
    reviewerName: row.reviewer_name,
    reviewerAvatar: row.reviewer_avatar_url,
    rating: row.rating,
    body: row.body,
    reviewedAt: row.reviewed_at,
    reviewUrl: row.review_url,
    hostReply: row.host_reply,
    hostReplyAt: row.host_reply_at,
    replySynced: row.reply_synced,
    replySyncError: row.reply_sync_error,
    isVisible: row.is_visible,
    isFeatured: row.is_featured,
    propertyId: row.property_id,
    propertyName: row.property?.name ?? null,
  }));

  const total = count ?? 0;

  return {
    ok: true,
    reviews,
    total,
    hasMore: offset + reviews.length < total,
  };
}

/**
 * Reply to an external review (posts to external platform).
 */
export async function replyToExternalReviewAction(
  reviewId: string,
  replyText: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Validate input
  const reviewIdResult = uuidSchema.safeParse(reviewId);
  if (!reviewIdResult.success) {
    return { ok: false, error: "Invalid review ID" };
  }
  const replyResult = replyTextSchema.safeParse(replyText);
  if (!replyResult.success) {
    return {
      ok: false,
      error: replyResult.error.issues[0]?.message ?? "Invalid reply",
    };
  }
  const trimmedReply = replyResult.data;

  const hostResult = await requireHost();
  if (!hostResult.ok) {
    return { ok: false, error: hostResult.error };
  }

  // Call the external-review-reply Edge Function
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return { ok: false, error: "Service not configured" };
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/external-review-reply`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          review_id: reviewId,
          reply_text: trimmedReply,
          host_id: hostResult.hostId,
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      return { ok: false, error: result.error || "Failed to post reply" };
    }

    return { ok: true };
  } catch (error) {
    console.error("Failed to post reply:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get host's properties for the property mapping dropdown.
 */
export async function getHostPropertiesAction(): Promise<
  | {
      ok: true;
      properties: Array<{ id: string; name: string }>;
    }
  | { ok: false; error: string }
> {
  const hostResult = await requireHost();
  if (!hostResult.ok) {
    return { ok: false, error: hostResult.error };
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("properties")
    .select("id, name")
    .eq("host_id", hostResult.hostId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to fetch properties:", error);
    return { ok: false, error: "Failed to load properties." };
  }

  return {
    ok: true,
    properties: data ?? [],
  };
}
