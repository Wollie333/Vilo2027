import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TrackingRequest {
  listing_id: string;
  session_id?: string;
  duration_seconds?: number;
  device?: string;
  referrer?: string;
  country?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body: TrackingRequest = await req.json();

    if (!body.listing_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "MISSING_LISTING_ID", message: "listing_id is required" },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user (if logged in)
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Extract device info from User-Agent
    const userAgent = req.headers.get("User-Agent") || "";
    const device = body.device || detectDevice(userAgent);

    // Get country from request headers (Cloudflare sets this)
    const country = body.country || req.headers.get("CF-IPCountry") || "ZA";

    // Generate session ID if not provided
    const sessionId = body.session_id || crypto.randomUUID();

    // Insert listing view event
    const { error } = await supabase.from("listing_view_events").insert({
      listing_id: body.listing_id,
      session_id: sessionId,
      user_id: userId,
      duration_seconds: body.duration_seconds || 0,
      device,
      referrer: body.referrer || null,
      country,
    });

    if (error) {
      console.error("Failed to track listing view:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "INSERT_FAILED", message: error.message },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          session_id: sessionId,
          tracked: true,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("track-listing-view error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "INTERNAL_ERROR", message: error.message },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

/**
 * Detect device type from User-Agent string
 */
function detectDevice(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    return "mobile";
  }

  if (ua.includes("tablet") || ua.includes("ipad")) {
    return "tablet";
  }

  return "desktop";
}
