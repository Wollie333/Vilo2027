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
 * Bookings a host can request a review for: completed + paid + no review yet.
 * Account-less (manual) guests qualify too — the per-stay token link works
 * without an account. Optionally scoped to one guest (by account id and/or
 * email, since a manual guest is keyed by email). Host-scoped via the passed
 * (RLS) client + an explicit host_id filter.
 */
export async function fetchRequestableReviews(
  supabase: ServerClient,
  opts: { hostId: string; guestId?: string | null; guestEmail?: string | null },
): Promise<RequestableReview[]> {
  let q = supabase
    .from("bookings")
    .select(
      `id, reference, guest_name, guest_email, guest_phone, guest_id,
       check_in, check_out, nights,
       listing:properties ( name ),
       reviews ( id ),
       review_request_queue ( sent_at )`,
    )
    .eq("host_id", opts.hostId)
    .eq("status", "completed")
    .in("payment_status", PAID_STATUSES)
    .order("check_out", { ascending: false })
    .limit(200);

  // Scope to one guest when asked — match the account id OR the email (a manual
  // guest has no account, only an email).
  const ors: string[] = [];
  if (opts.guestId) ors.push(`guest_id.eq.${opts.guestId}`);
  if (opts.guestEmail) ors.push(`guest_email.eq.${opts.guestEmail}`);
  if (ors.length === 1) {
    q = opts.guestId
      ? q.eq("guest_id", opts.guestId)
      : q.eq("guest_email", opts.guestEmail as string);
  } else if (ors.length > 1) {
    q = q.or(ors.join(","));
  }

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
