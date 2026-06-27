import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { decryptOAuthToken } from "../_shared/oauth-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-external-reviews-secret",
};

// @ts-expect-error Deno global
const env = Deno.env;

// Timing-safe comparison for shared secret
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// Check if request is authorized (cron secret or valid JWT)
function isAuthorized(req: Request): boolean {
  // Check for cron secret header
  const cronSecret = env.get("EXTERNAL_REVIEWS_WORKER_SECRET");
  const providedSecret = req.headers.get("x-external-reviews-secret") ?? "";
  if (cronSecret && timingSafeEqual(providedSecret, cronSecret)) {
    return true;
  }
  // JWT auth will be handled by Supabase client
  return true; // Allow through, Supabase will verify JWT
}

interface ExternalReviewSource {
  id: string;
  host_id: string;
  source: "google" | "facebook" | "trustpilot";
  external_account_id: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  api_key: string | null;
  api_secret: string | null;
  sync_cursor: string | null;
}

interface SyncResult {
  sourceId: string;
  success: boolean;
  added: number;
  updated: number;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!isAuthorized(req)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Invalid authorization" },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      },
    );
  }

  try {
    // Parse request body
    let body: { source_id?: string; sync_type?: "auto" | "manual" } = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is OK for cron (sync all)
    }

    const { source_id, sync_type = "auto" } = body;

    // Initialize Supabase client
    const supabaseUrl = env.get("SUPABASE_URL")!;
    const supabaseServiceKey = env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`external-reviews-sync: Starting ${sync_type} sync...`);

    // Fetch sources to sync
    let query = supabase
      .from("external_review_sources")
      .select("*")
      .eq("is_active", true)
      .is("deleted_at", null);

    if (source_id) {
      query = query.eq("id", source_id);
    }

    const { data: sources, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch sources: ${fetchError.message}`);
    }

    if (!sources || sources.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No sources to sync",
          results: [],
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    console.log(`Found ${sources.length} sources to sync`);

    // Process each source
    const results: SyncResult[] = [];
    for (const source of sources as ExternalReviewSource[]) {
      const result = await syncSource(supabase, source, sync_type);
      results.push(result);
    }

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;
    const totalAdded = results.reduce((sum, r) => sum + r.added, 0);
    const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${sources.length} sources`,
        successCount,
        failedCount,
        totalAdded,
        totalUpdated,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("external-reviews-sync error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});

async function syncSource(
  supabase: ReturnType<typeof createClient>,
  source: ExternalReviewSource,
  syncType: "auto" | "manual",
): Promise<SyncResult> {
  console.log(`Syncing source ${source.id} (${source.source})`);

  // Create sync log entry
  const { data: syncLog, error: logError } = await supabase
    .from("external_review_sync_log")
    .insert({
      source_id: source.id,
      sync_type: syncType,
      status: "started",
    })
    .select()
    .single();

  if (logError) {
    console.error("Failed to create sync log:", logError);
  }

  try {
    let result: { added: number; updated: number; newCursor?: string };

    switch (source.source) {
      case "google":
        result = await syncGoogleReviews(supabase, source);
        break;
      case "facebook":
        result = await syncFacebookReviews(supabase, source);
        break;
      case "trustpilot":
        result = await syncTrustpilotReviews(supabase, source);
        break;
      default:
        throw new Error(`Unknown source: ${source.source}`);
    }

    // Update source with new sync cursor and timestamp
    await supabase
      .from("external_review_sources")
      .update({
        last_synced_at: new Date().toISOString(),
        last_sync_error: null,
        sync_cursor: result.newCursor ?? source.sync_cursor,
      })
      .eq("id", source.id);

    // Update sync log
    if (syncLog) {
      await supabase
        .from("external_review_sync_log")
        .update({
          status: "completed",
          reviews_fetched: result.added + result.updated,
          reviews_added: result.added,
          reviews_updated: result.updated,
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncLog.id);
    }

    return {
      sourceId: source.id,
      success: true,
      added: result.added,
      updated: result.updated,
    };
  } catch (error) {
    console.error(`Failed to sync source ${source.id}:`, error);

    // Update source with error
    await supabase
      .from("external_review_sources")
      .update({
        last_sync_error: error.message,
      })
      .eq("id", source.id);

    // Update sync log
    if (syncLog) {
      await supabase
        .from("external_review_sync_log")
        .update({
          status: "failed",
          error_message: error.message,
          error_code: "SYNC_FAILED",
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncLog.id);
    }

    return {
      sourceId: source.id,
      success: false,
      added: 0,
      updated: 0,
      error: error.message,
    };
  }
}

// Google Reviews sync
async function syncGoogleReviews(
  supabase: ReturnType<typeof createClient>,
  source: ExternalReviewSource,
): Promise<{ added: number; updated: number; newCursor?: string }> {
  if (!source.access_token) {
    throw new Error("No access token available");
  }

  // Decrypt access token
  const accessToken = await decryptOAuthToken(source.access_token);

  // TODO: Check token expiration and refresh if needed

  // Fetch reviews from Google
  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/${source.external_account_id}/reviews?pageSize=50`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch Google reviews");
  }

  const data = await response.json();
  const reviews = data.reviews || [];

  let added = 0;
  let updated = 0;

  for (const review of reviews) {
    const rating = googleStarRatingToNumber(review.starRating);
    const existingReview = await supabase
      .from("external_reviews")
      .select("id")
      .eq("source_id", source.id)
      .eq("external_review_id", review.reviewId)
      .maybeSingle();

    const reviewData = {
      source_id: source.id,
      host_id: source.host_id,
      external_review_id: review.reviewId,
      external_reviewer_id: review.reviewer?.profilePhotoUrl || null,
      reviewer_name: review.reviewer?.displayName || "Anonymous",
      reviewer_avatar_url: review.reviewer?.profilePhotoUrl || null,
      rating,
      body: review.comment || null,
      review_url: null, // Google doesn't provide direct review URLs
      host_reply: review.reviewReply?.comment || null,
      host_reply_at: review.reviewReply?.updateTime || null,
      reviewed_at: review.createTime,
    };

    if (existingReview.data) {
      await supabase
        .from("external_reviews")
        .update(reviewData)
        .eq("id", existingReview.data.id);
      updated++;
    } else {
      await supabase.from("external_reviews").insert(reviewData);
      added++;
    }
  }

  return { added, updated };
}

// Facebook Reviews sync
async function syncFacebookReviews(
  supabase: ReturnType<typeof createClient>,
  source: ExternalReviewSource,
): Promise<{ added: number; updated: number; newCursor?: string }> {
  if (!source.access_token) {
    throw new Error("No access token available");
  }

  const accessToken = await decryptOAuthToken(source.access_token);

  // Fetch reviews from Facebook
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${source.external_account_id}/ratings?access_token=${accessToken}&fields=recommendation_type,review_text,created_time,reviewer&limit=50`,
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch Facebook reviews");
  }

  const data = await response.json();
  const reviews = data.data || [];

  let added = 0;
  let updated = 0;

  for (const review of reviews) {
    const rating = facebookRecommendationToRating(review.recommendation_type);
    const reviewId = `${source.external_account_id}_${review.reviewer?.id}_${review.created_time}`;

    const existingReview = await supabase
      .from("external_reviews")
      .select("id")
      .eq("source_id", source.id)
      .eq("external_review_id", reviewId)
      .maybeSingle();

    const reviewData = {
      source_id: source.id,
      host_id: source.host_id,
      external_review_id: reviewId,
      external_reviewer_id: review.reviewer?.id || null,
      reviewer_name: review.reviewer?.name || "Anonymous",
      reviewer_avatar_url: null, // Facebook doesn't provide avatar in ratings API
      rating,
      body: review.review_text || null,
      review_url: `https://facebook.com/${source.external_account_id}/reviews`,
      reviewed_at: review.created_time,
    };

    if (existingReview.data) {
      await supabase
        .from("external_reviews")
        .update(reviewData)
        .eq("id", existingReview.data.id);
      updated++;
    } else {
      await supabase.from("external_reviews").insert(reviewData);
      added++;
    }
  }

  return { added, updated, newCursor: data.paging?.cursors?.after };
}

// Trustpilot Reviews sync
async function syncTrustpilotReviews(
  supabase: ReturnType<typeof createClient>,
  source: ExternalReviewSource,
): Promise<{ added: number; updated: number; newCursor?: string }> {
  if (!source.api_key || !source.api_secret) {
    throw new Error("No API credentials available");
  }

  const apiKey = await decryptOAuthToken(source.api_key);
  const apiSecret = await decryptOAuthToken(source.api_secret);

  // Trustpilot uses OAuth 2.0 client credentials flow
  const tokenResponse = await fetch(
    "https://api.trustpilot.com/v1/oauth/oauth-business-users-for-applications/accesstoken",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${apiKey}:${apiSecret}`)}`,
      },
      body: "grant_type=client_credentials",
    },
  );

  if (!tokenResponse.ok) {
    throw new Error("Failed to authenticate with Trustpilot");
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  // Fetch reviews
  const response = await fetch(
    `https://api.trustpilot.com/v1/private/business-units/${source.external_account_id}/reviews?perPage=50`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to fetch Trustpilot reviews");
  }

  const data = await response.json();
  const reviews = data.reviews || [];

  let added = 0;
  let updated = 0;

  for (const review of reviews) {
    const existingReview = await supabase
      .from("external_reviews")
      .select("id")
      .eq("source_id", source.id)
      .eq("external_review_id", review.id)
      .maybeSingle();

    const reviewData = {
      source_id: source.id,
      host_id: source.host_id,
      external_review_id: review.id,
      external_reviewer_id: review.consumer?.id || null,
      reviewer_name: review.consumer?.displayName || "Anonymous",
      reviewer_avatar_url: null,
      rating: review.stars,
      body: review.text || null,
      review_url:
        review.links?.find((l: { rel: string }) => l.rel === "review")?.href ||
        null,
      host_reply: review.companyReply?.text || null,
      host_reply_at: review.companyReply?.createdAt || null,
      reviewed_at: review.createdAt,
    };

    if (existingReview.data) {
      await supabase
        .from("external_reviews")
        .update(reviewData)
        .eq("id", existingReview.data.id);
      updated++;
    } else {
      await supabase.from("external_reviews").insert(reviewData);
      added++;
    }
  }

  return { added, updated };
}

// Helper functions
function googleStarRatingToNumber(rating: string): number {
  const map: Record<string, number> = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  };
  return map[rating] || 5;
}

function facebookRecommendationToRating(type: string): number | null {
  switch (type) {
    case "positive":
      return 5;
    case "negative":
      return 1;
    default:
      return null;
  }
}
