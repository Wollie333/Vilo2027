import "server-only";

import { buildReviewPath } from "@/lib/review-token";
import type { createServerClient } from "@/lib/supabase/server";

type ServerClient = ReturnType<typeof createServerClient>;

// A completed, paid stay that has NOT been reviewed yet — the only bookings a
// host may send a review request for. Already-reviewed stays are excluded, so
// there's never a way to nag a guest who already reviewed.
export type RequestableReview = {
  bookingId: string;
  reference: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  listingName: string;
  checkIn: string | null;
  checkOut: string | null;
  nights: number | null;
  /** When a review request was last sent (auto or manual); null if never. */
  lastRequestedAt: string | null;
  /** Tokenised relative review path (prepend window.location.origin to share). */
  reviewPath: string;
};

const PAID_STATUSES = ["completed", "partially_refunded", "refunded"];

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/**
 * Bookings a host can request a review for: completed + paid + has a registered
 * guest (reviews require an account) + no review yet. Optionally scoped to one
 * guest. Host-scoped via the passed (RLS) client + an explicit host_id filter.
 */
export async function fetchRequestableReviews(
  supabase: ServerClient,
  opts: { hostId: string; guestId?: string | null },
): Promise<RequestableReview[]> {
  let q = supabase
    .from("bookings")
    .select(
      `id, reference, guest_name, guest_email, guest_phone, guest_id,
       check_in, check_out, nights,
       listing:listings ( name ),
       reviews ( id ),
       review_request_queue ( sent_at )`,
    )
    .eq("host_id", opts.hostId)
    .eq("status", "completed")
    .in("payment_status", PAID_STATUSES)
    .not("guest_id", "is", null)
    .order("check_out", { ascending: false })
    .limit(200);
  if (opts.guestId) q = q.eq("guest_id", opts.guestId);

  const { data } = await q;

  return (data ?? [])
    .filter((b) => {
      const revs = Array.isArray(b.reviews)
        ? b.reviews
        : b.reviews
          ? [b.reviews]
          : [];
      return revs.length === 0; // only un-reviewed stays
    })
    .map((b) => {
      const listing = one(b.listing) as { name: string } | null;
      const rq = one(b.review_request_queue) as {
        sent_at: string | null;
      } | null;
      return {
        bookingId: b.id,
        reference: b.reference,
        guestName: b.guest_name ?? "Guest",
        guestEmail: b.guest_email,
        guestPhone: b.guest_phone,
        listingName: listing?.name ?? "Listing",
        checkIn: b.check_in,
        checkOut: b.check_out,
        nights: b.nights,
        lastRequestedAt: rq?.sent_at ?? null,
        reviewPath: buildReviewPath(b.id),
      };
    });
}
