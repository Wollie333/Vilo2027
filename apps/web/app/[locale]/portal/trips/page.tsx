import type { Metadata } from "next";

import { createServerClient } from "@/lib/supabase/server";

import { TripsClient, type Trip, type TripStatus } from "./TripsClient";

export const metadata: Metadata = {
  title: "My trips",
};

export const dynamic = "force-dynamic";

type Photo = { url: string | null; sort_order: number };
type RoomEmbed = { room: { name: string } | { name: string }[] | null };

type Row = {
  id: string;
  reference: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  nights: number | null;
  guests_count: number;
  total_amount: number;
  refund_total: number | null;
  currency: string;
  scope: string;
  listing:
    | {
        name: string;
        slug: string | null;
        city: string | null;
        province: string | null;
        accommodation_type: string | null;
        listing_type: string;
        photos: Photo[] | null;
      }
    | {
        name: string;
        slug: string | null;
        city: string | null;
        province: string | null;
        accommodation_type: string | null;
        listing_type: string;
        photos: Photo[] | null;
      }[]
    | null;
  host:
    | { display_name: string; avatar_url: string | null }
    | { display_name: string; avatar_url: string | null }[]
    | null;
  booking_rooms: RoomEmbed[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

const CANCELLED_STATUSES = new Set([
  "cancelled_by_guest",
  "cancelled_by_host",
  "declined",
  "expired",
]);
const PENDING_STATUSES = new Set(["pending", "pending_eft"]);
const LIVE_STATUSES = new Set(["confirmed", "checked_in"]);

function normaliseStatus(status: string): TripStatus {
  if (CANCELLED_STATUSES.has(status)) return "cancelled";
  if (PENDING_STATUSES.has(status)) return "pending";
  if (status === "completed" || status === "checked_out") return "completed";
  return "confirmed";
}

export default async function PortalTripsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: rows }, { data: reviewRows }, { data: profile }] =
    await Promise.all([
      supabase
        .from("bookings")
        .select(
          `
          id, reference, status,
          check_in, check_out, nights,
          guests_count, total_amount, refund_total, currency, scope,
          listing:properties ( name, slug, city, province, accommodation_type, listing_type, photos:property_photos ( url, sort_order ) ),
          host:hosts ( display_name, avatar_url ),
          booking_rooms ( room:property_rooms ( name ) )
        `,
        )
        .eq("guest_id", user.id)
        .is("deleted_at", null)
        .order("check_in", { ascending: true })
        .limit(100),
      supabase
        .from("reviews")
        .select("booking_id, rating")
        .eq("guest_id", user.id),
      supabase
        .from("user_profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

  const reviewByBooking = new Map<string, number>();
  (reviewRows as { booking_id: string; rating: number }[] | null)?.forEach(
    (r) => reviewByBooking.set(r.booking_id, r.rating),
  );

  const todayIso = new Date().toISOString().slice(0, 10);

  const list = (rows as Row[] | null) ?? [];

  const trips: Trip[] = list.map((b) => {
    const listing = one(b.listing);
    const host = one(b.host);
    const status = normaliseStatus(b.status);

    // Bucket: cancelled set → cancelled; live/pending with a future
    // check-out → upcoming; everything else (completed, past stays) → past.
    let bucket: Trip["bucket"];
    if (status === "cancelled") {
      bucket = "cancelled";
    } else if (
      (LIVE_STATUSES.has(b.status) || PENDING_STATUSES.has(b.status)) &&
      (b.check_out ?? "") >= todayIso
    ) {
      bucket = "upcoming";
    } else {
      bucket = "past";
    }

    const hero =
      (listing?.photos ?? [])
        .slice()
        .sort((a, b2) => a.sort_order - b2.sort_order)[0]?.url ?? null;

    const typeLabel =
      listing?.accommodation_type ?? listing?.listing_type ?? "Stay";

    // Room label: whole bookings show the place type; room bookings list
    // the booked room name(s).
    const roomNames = (b.booking_rooms ?? [])
      .map((br) => one(br.room)?.name)
      .filter((n): n is string => Boolean(n));
    const room =
      b.scope === "whole"
        ? `Whole ${typeLabel.toLowerCase()}`
        : roomNames.length > 0
          ? roomNames.join(", ")
          : "Private room";

    const rating = reviewByBooking.has(b.id)
      ? (reviewByBooking.get(b.id) ?? null)
      : null;

    return {
      id: b.id,
      reference: b.reference,
      status,
      bucket,
      featured: false,
      name: listing?.name ?? "Stay",
      typeLabel: typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1),
      city: listing?.city ?? null,
      region: listing?.province ?? null,
      room,
      checkIn: b.check_in,
      checkOut: b.check_out,
      nights: b.nights ?? 1,
      guests: b.guests_count,
      total: Number(b.total_amount),
      currency: b.currency,
      refunded: b.refund_total != null ? Number(b.refund_total) : null,
      reviewed: rating != null,
      rating,
      hostName: host?.display_name ?? null,
      hostAvatar: host?.avatar_url ?? null,
      image: hero,
      slug: listing?.slug ?? null,
      detailHref: `/portal/trips/${b.id}`,
    };
  });

  // Feature the soonest upcoming stay (rows already sorted by check_in asc).
  const featured = trips.find((t) => t.bucket === "upcoming");
  if (featured) featured.featured = true;

  const firstName = (profile?.full_name ?? "there").split(" ")[0] || "there";

  return <TripsClient trips={trips} firstName={firstName} />;
}
