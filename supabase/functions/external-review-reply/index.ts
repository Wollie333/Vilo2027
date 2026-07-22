import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { decryptOAuthToken } from "../_shared/oauth-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// @ts-expect-error Deno global
const env = Deno.env;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body = await req.json();
    const { review_id, reply } = body;

    if (!review_id || !reply) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Missing review_id or reply",
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // Initialize Supabase client with user JWT
    const supabaseUrl = env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Missing authorization header",
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        },
      );
    }

    // Use anon key with user's JWT for RLS
    const supabaseAnonKey = env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Fetch the review with its source (RLS will enforce ownership)
    const { data: review, error: fetchError } = await supabase
      .from("external_reviews")
      .select(
        `
        id,
        external_review_id,
        source_id,
        host_id,
        external_review_sources!inner (
          id,
          source,
          external_account_id,
          access_token,
          api_key,
          api_secret
        )
      `,
      )
      .eq("id", review_id)
      .single();

    if (fetchError || !review) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Review not found or access denied",
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        },
      );
    }

    const source = review.external_review_sources as {
      id: string;
      source: string;
      external_account_id: string;
      access_token: string | null;
      api_key: string | null;
      api_secret: string | null;
    };

    // Post reply to the external platform
    let replyResult: { ok: true } | { error: string };

    switch (source.source) {
      case "google":
        replyResult = await postGoogleReply(
          source.access_token!,
          review.external_review_id,
          source.external_account_id,
          reply,
        );
        break;
      case "facebook":
        replyResult = await postFacebookReply(
          source.access_token!,
          review.external_review_id,
          reply,
        );
        break;
      case "trustpilot":
        replyResult = await postTrustpilotReply(
          source.api_key!,
          source.api_secret!,
          source.external_account_id,
          review.external_review_id,
          reply,
        );
        break;
      default:
        replyResult = { error: `Unknown source: ${source.source}` };
    }

    if ("error" in replyResult) {
      // Update the review with the error
      await supabase
        .from("external_reviews")
        .update({
          host_reply: reply,
          host_reply_at: new Date().toISOString(),
          reply_synced: false,
          reply_sync_error: replyResult.error,
        })
        .eq("id", review_id);

      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "REPLY_FAILED", message: replyResult.error },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      );
    }

    // Success! Update the review
    await supabase
      .from("external_reviews")
      .update({
        host_reply: reply,
        host_reply_at: new Date().toISOString(),
        reply_synced: true,
        reply_sync_error: null,
      })
      .eq("id", review_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Reply posted successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    // Details stay in the function logs — `error.message` here can carry the
    // provider's raw API response as well as Postgres table/constraint names.
    console.error("external-review-reply error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Could not post the reply." },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});

async function postGoogleReply(
  encryptedToken: string,
  reviewId: string,
  locationName: string,
  replyText: string,
): Promise<{ ok: true } | { error: string }> {
  const accessToken = await decryptOAuthToken(encryptedToken);

  // The review name format is: accounts/{accountId}/locations/{locationId}/reviews/{reviewId}
  const reviewName = `${locationName}/reviews/${reviewId}`;

  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/${reviewName}/reply`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment: replyText }),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    return { error: error.error?.message || "Failed to post Google reply" };
  }

  return { ok: true };
}

async function postFacebookReply(
  encryptedToken: string,
  reviewId: string,
  replyText: string,
): Promise<{ ok: true } | { error: string }> {
  const accessToken = await decryptOAuthToken(encryptedToken);

  // For Facebook, we comment on the recommendation.
  // Keep this version in step with FACEBOOK_GRAPH_VERSION in
  // apps/web/lib/external-reviews/facebook.ts — Edge Functions cannot import it.
  const response = await fetch(
    `https://graph.facebook.com/v22.0/${reviewId}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: accessToken,
        message: replyText,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    return { error: error.error?.message || "Failed to post Facebook reply" };
  }

  return { ok: true };
}

async function postTrustpilotReply(
  encryptedApiKey: string,
  encryptedApiSecret: string,
  businessUnitId: string,
  reviewId: string,
  replyText: string,
): Promise<{ ok: true } | { error: string }> {
  const apiKey = await decryptOAuthToken(encryptedApiKey);
  const apiSecret = await decryptOAuthToken(encryptedApiSecret);

  // Get access token via client credentials
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
    return { error: "Failed to authenticate with Trustpilot" };
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  // Post reply
  const response = await fetch(
    `https://api.trustpilot.com/v1/private/reviews/${reviewId}/reply`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: replyText }),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    return { error: error.message || "Failed to post Trustpilot reply" };
  }

  return { ok: true };
}
