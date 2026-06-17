import "server-only";

import type { createServerClient } from "@/lib/supabase/server";

type ServerClient = ReturnType<typeof createServerClient>;

// One row per completed stay in the review lifecycle: request sent? reviewed?
// needs a response? Powers the Reviews → Activity table.
export type ReviewActivityRow = {
  bookingId: string;
  reference: string;
  guestName: string;
  listingName: string;
  stayMonth: string | null;
  checkedOutAt: string | null;
  /** review_request_queue.sent_at — when the request actually went out. */
  requestSentAt: string | null;
  /** review_request_queue.send_at when still pending (scheduled, not yet sent). */
  requestScheduledAt: string | null;
  rating: number | null;
  reviewedAt: string | null;
  hasResponse: boolean;
  /** Derived state for the badge + sorting. */
  state: "needs_response" | "responded" | "requested" | "scheduled" | "idle";
};

const PAID_STATUSES = ["completed", "partially_refunded", "refunded"];

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function monthLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-ZA", { month: "short", year: "numeric" });
}

/**
 * Review lifecycle for every completed, paid stay of the host: who was sent a
 * request (and when), who reviewed (and the rating), and who still needs a
 * public response. Host-scoped via the RLS client + explicit host_id.
 */
export async function fetchReviewActivity(
  supabase: ServerClient,
  hostId: string,
): Promise<ReviewActivityRow[]> {
  const { data } = await supabase
    .from("bookings")
    .select(
      `id, reference, guest_name, check_in, check_out, checked_out_at,
       listing:properties ( name ),
       reviews ( rating, created_at, host_response ),
       review_request_queue ( sent_at, send_at )`,
    )
    .eq("host_id", hostId)
    .eq("status", "completed")
    .in("payment_status", PAID_STATUSES)
    .order("checked_out_at", { ascending: false, nullsFirst: false })
    .limit(300);

  const rows: ReviewActivityRow[] = (data ?? []).map((b) => {
    const listing = one(b.listing) as { name: string } | null;
    const review = one(b.reviews) as {
      rating: number;
      created_at: string;
      host_response: string | null;
    } | null;
    const queue = one(b.review_request_queue) as {
      sent_at: string | null;
      send_at: string | null;
    } | null;

    const rating = review?.rating ?? null;
    const hasResponse = Boolean(review?.host_response);
    const requestSentAt = queue?.sent_at ?? null;
    const requestScheduledAt =
      !requestSentAt && queue?.send_at ? queue.send_at : null;

    let state: ReviewActivityRow["state"];
    if (rating != null) state = hasResponse ? "responded" : "needs_response";
    else if (requestSentAt) state = "requested";
    else if (requestScheduledAt) state = "scheduled";
    else state = "idle";

    return {
      bookingId: b.id,
      reference: b.reference,
      guestName: b.guest_name ?? "Guest",
      listingName: listing?.name ?? "Listing",
      stayMonth: monthLabel(b.check_out ?? b.check_in),
      checkedOutAt: b.checked_out_at,
      requestSentAt,
      requestScheduledAt,
      rating,
      reviewedAt: review?.created_at ?? null,
      hasResponse,
      state,
    };
  });

  // Surface what needs the host's attention first.
  const order: Record<ReviewActivityRow["state"], number> = {
    needs_response: 0,
    requested: 1,
    scheduled: 2,
    idle: 3,
    responded: 4,
  };
  return rows.sort((a, b) => order[a.state] - order[b.state]);
}
