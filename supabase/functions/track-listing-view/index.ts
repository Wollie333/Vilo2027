import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TrackingRequest {
  property_id: string;
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

    // This is a PUBLIC beacon (anon visitors), so it can't require a user. But
    // it inserts with the service role, so validate every client-supplied field
    // before trusting it: a bad property_id must 400 (not FK-500), and unbounded
    // duration / arbitrary device|country must not skew or break the insert.
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!body.property_id || !UUID_RE.test(body.property_id)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "INVALID_LISTING_ID",
            message: "A valid property_id (uuid) is required",
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
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
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Device — only honour a client value that matches the column's CHECK enum;
    // otherwise fall back to UA detection (never trust an arbitrary string that
    // would either 500 on the CHECK or pollute the dimension).
    const ALLOWED_DEVICES = ["mobile", "tablet", "desktop"];
    const userAgent = req.headers.get("User-Agent") || "";
    const device =
      body.device && ALLOWED_DEVICES.includes(body.device)
        ? body.device
        : detectDevice(userAgent);

    // Country — ISO 3166-1 alpha-2 only; reject junk so the dimension stays clean.
    const rawCountry = body.country || req.headers.get("CF-IPCountry") || "ZA";
    const country = /^[A-Za-z]{2}$/.test(rawCountry)
      ? rawCountry.toUpperCase()
      : "ZA";

    // Duration — clamp to a sane non-negative range (≤ 24h) so a forged value
    // can't skew avg-time-on-page.
    const rawDuration = Number(body.duration_seconds);
    const durationSeconds = Number.isFinite(rawDuration)
      ? Math.min(Math.max(0, Math.floor(rawDuration)), 86_400)
      : 0;

    // Generate session ID if not provided / not a uuid.
    const sessionId =
      body.session_id && UUID_RE.test(body.session_id)
        ? body.session_id
        : crypto.randomUUID();

    // Insert listing view event. A non-existent property_id trips the FK and is
    // caught below as INSERT_FAILED (no garbage rows for fake listings).
    const { error } = await supabase.from("property_view_events").insert({
      property_id: body.property_id,
      session_id: sessionId,
      user_id: userId,
      duration_seconds: durationSeconds,
      device,
      referrer: body.referrer ? String(body.referrer).slice(0, 500) : null,
      country,
    });

    if (error) {
      // Deliberately NOT surfaced to the caller, and deliberately not
      // distinguishable from success.
      //
      // This used to return `error.message` verbatim, which handed an anonymous
      // caller the table name, the constraint name (`listing_view_events_..._fkey`,
      // still carrying the table's pre-rename name) and — because a real
      // property_id inserts while an unknown one raises a foreign-key violation —
      // a PROPERTY-EXISTENCE ORACLE. Same shape as the record_error_event oracle.
      //
      // A view is telemetry: the caller cannot act on the failure, so the only
      // thing a different response buys is that oracle. The failure is kept where
      // it is useful — the function logs.
      console.error("Failed to track listing view:", error);
    }

    // `tracked` means ACCEPTED, not persisted — see the insert branch above.
    // Nothing reads it (lib/analytics/trackListingView.ts returns void and only
    // checks `success`), and making it reflect the insert would rebuild the
    // oracle this endpoint just had removed.
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
      },
    );
  } catch (error) {
    // The real error goes to the function logs, never to the caller: this is a
    // PUBLIC endpoint reachable with the publishable key, and `error.message`
    // from Postgres names tables and constraints.
    console.error("track-listing-view error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Could not track the view." },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});

/**
 * Detect device type from User-Agent string
 */
function detectDevice(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  if (
    ua.includes("mobile") ||
    ua.includes("android") ||
    ua.includes("iphone")
  ) {
    return "mobile";
  }

  if (ua.includes("tablet") || ua.includes("ipad")) {
    return "tablet";
  }

  return "desktop";
}
