/**
 * Track listing page view for conversion funnel analytics
 *
 * Usage:
 * ```tsx
 * import { trackListingView } from "@/lib/analytics/trackListingView";
 *
 * useEffect(() => {
 *   const cleanup = trackListingView({
 *     listingId: "550e8400-e29b-41d4-a716-446655440000",
 *     onError: (error) => console.error("Tracking failed:", error),
 *   });
 *   return cleanup;
 * }, [listingId]);
 * ```
 */

interface TrackListingViewOptions {
  listingId: string;
  sessionId?: string;
  referrer?: string;
  onError?: (error: Error) => void;
}

interface TrackingResponse {
  success: boolean;
  data?: {
    session_id: string;
    tracked: boolean;
  };
  error?: {
    code: string;
    message: string;
  };
}

// Session storage key for persistent session ID
const SESSION_STORAGE_KEY = "vilo_analytics_session_id";

/**
 * Get or create analytics session ID (persists for browser session)
 */
function getSessionId(): string {
  if (typeof window === "undefined") return crypto.randomUUID();

  let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
  return sessionId;
}

/**
 * Track listing page view with duration tracking
 * Returns cleanup function to track duration on unmount
 */
export function trackListingView(options: TrackListingViewOptions): () => void {
  const { listingId, sessionId, referrer, onError } = options;

  const startTime = Date.now();
  const effectiveSessionId = sessionId || getSessionId();
  const effectiveReferrer = referrer || (typeof document !== "undefined" ? document.referrer : undefined);

  // Send initial tracking event (duration: 0)
  sendTrackingEvent({
    listing_id: listingId,
    session_id: effectiveSessionId,
    duration_seconds: 0,
    referrer: effectiveReferrer,
  }).catch((error) => {
    console.error("Failed to track listing view:", error);
    onError?.(error);
  });

  // Return cleanup function that tracks final duration
  return () => {
    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

    // Only send duration update if user stayed for at least 1 second
    if (durationSeconds >= 1) {
      sendTrackingEvent({
        listing_id: listingId,
        session_id: effectiveSessionId,
        duration_seconds: durationSeconds,
        referrer: effectiveReferrer,
      }).catch((error) => {
        console.error("Failed to track listing view duration:", error);
        onError?.(error);
      });
    }
  };
}

/**
 * Send tracking event to Edge Function
 */
async function sendTrackingEvent(data: {
  listing_id: string;
  session_id: string;
  duration_seconds: number;
  referrer?: string;
}): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase configuration missing");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/track-listing-view`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error: TrackingResponse = await response.json();
    throw new Error(error.error?.message || "Tracking request failed");
  }

  const result: TrackingResponse = await response.json();
  if (!result.success) {
    throw new Error(result.error?.message || "Tracking failed");
  }
}

/**
 * React hook for tracking listing views
 *
 * Usage:
 * ```tsx
 * function ListingPage({ listingId }: { listingId: string }) {
 *   useTrackListingView(listingId);
 *   return <div>...</div>;
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useTrackListingView(listingId: string | undefined): void {
  if (typeof window === "undefined") return;

  // Use useEffect in the consuming component
  // This is just a helper for documentation
  throw new Error(
    "useTrackListingView is not implemented. Use trackListingView() directly in useEffect."
  );
}
