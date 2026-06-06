import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import {
  GuestRecord,
  type BookingItem,
  type GuestRecordData,
  type PaymentItem,
} from "./GuestRecord";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Guest",
};

type RawListing = {
  name: string;
  listing_photos: { url: string; sort_order: number }[] | null;
};
type RawBooking = {
  id: string;
  reference: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  nights: number | null;
  guests_count: number;
  total_amount: number;
  currency: string;
  channel: string | null;
  created_at: string;
  special_requests: string | null;
  listing: RawListing | null;
};

export default async function GuestRecordPage({
  params,
}: {
  params: { gkey: string };
}) {
  const gkey = decodeURIComponent(params.gkey);
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/guests/${gkey}`);

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!host) notFound();

  const { data: recordData } = await supabase.rpc("fetch_guest_record", {
    p_host_id: host.id,
    p_gkey: gkey,
  });
  const record = recordData as (GuestRecordData & { error?: string }) | null;
  if (!record || record.error) notFound();

  const guestId = record.guest_id;
  const email = record.email?.toLowerCase() ?? null;

  // Merge-rule booking query: registered id OR same-email manual bookings.
  let bookingQuery = supabase
    .from("bookings")
    .select(
      "id, reference, status, check_in, check_out, nights, guests_count, total_amount, currency, channel, created_at, special_requests, listing:listings ( name, listing_photos ( url, sort_order ) )",
    )
    .eq("host_id", host.id)
    .is("deleted_at", null)
    .order("check_in", { ascending: false, nullsFirst: false });

  if (guestId && email) {
    bookingQuery = bookingQuery.or(
      `guest_id.eq.${guestId},and(guest_id.is.null,guest_email.ilike.${email})`,
    );
  } else if (guestId) {
    bookingQuery = bookingQuery.eq("guest_id", guestId);
  } else if (email) {
    bookingQuery = bookingQuery
      .is("guest_id", null)
      .ilike("guest_email", email);
  } else {
    bookingQuery = bookingQuery.eq(
      "id",
      "00000000-0000-0000-0000-000000000000",
    );
  }

  const { data: rawBookings } = await bookingQuery;
  const bookingsRaw = (rawBookings ?? []) as unknown as RawBooking[];

  const bookings: BookingItem[] = bookingsRaw.map((b) => {
    const photos = b.listing?.listing_photos ?? [];
    const thumb =
      photos.length > 0
        ? [...photos].sort((a, c) => a.sort_order - c.sort_order)[0].url
        : null;
    return {
      id: b.id,
      reference: b.reference,
      status: b.status,
      checkIn: b.check_in,
      checkOut: b.check_out,
      nights: b.nights,
      guestsCount: b.guests_count,
      totalAmount: Number(b.total_amount),
      currency: b.currency,
      channel: b.channel,
      createdAt: b.created_at,
      specialRequests: b.special_requests,
      listingName: b.listing?.name ?? "Listing",
      listingThumb: thumb,
    };
  });

  // Payments for those bookings.
  const bookingIds = bookings.map((b) => b.id);
  let payments: PaymentItem[] = [];
  if (bookingIds.length > 0) {
    const { data: rawPayments } = await supabase
      .from("payments")
      .select(
        "id, amount, currency, method, status, captured_at, created_at, booking_id",
      )
      .in("booking_id", bookingIds)
      .order("created_at", { ascending: false });
    const refByBooking = new Map(bookings.map((b) => [b.id, b.reference]));
    payments = (rawPayments ?? []).map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      currency: p.currency,
      method: p.method,
      status: p.status,
      capturedAt: p.captured_at,
      createdAt: p.created_at,
      reference: refByBooking.get(p.booking_id) ?? "",
    }));
  }

  // Pinned note for the Overview card (full Notes tab lands in Phase 6).
  const { data: pinnedNote } = await supabase
    .from("guest_notes")
    .select("body, created_at")
    .eq("host_id", host.id)
    .eq("gkey", gkey)
    .eq("is_pinned", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Prev / next within the directory (recent order) for the sub-header nav.
  const { data: dir } = await supabase.rpc("fetch_host_guests", {
    p_host_id: host.id,
    p_sort: "recent",
    p_limit: 500,
    p_offset: 0,
  });
  const gkeys = (
    ((dir as { guests?: { gkey: string }[] } | null)?.guests ?? []) as {
      gkey: string;
    }[]
  ).map((g) => g.gkey);
  const idx = gkeys.indexOf(gkey);
  const prevGkey = idx > 0 ? gkeys[idx - 1] : null;
  const nextGkey = idx >= 0 && idx < gkeys.length - 1 ? gkeys[idx + 1] : null;

  return (
    <GuestRecord
      record={record}
      bookings={bookings}
      payments={payments}
      pinnedNote={pinnedNote ?? null}
      prevGkey={prevGkey}
      nextGkey={nextGkey}
    />
  );
}
