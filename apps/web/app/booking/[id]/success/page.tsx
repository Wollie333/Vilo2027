import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { getBrandName } from "@/lib/brand";
import { confirmHostCardPaymentByReference } from "@/lib/payments/pay-booking";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import {
  PRICING_LABEL,
  type PricingModel,
} from "../../../dashboard/addons/schemas";
import { bedSummary } from "../../../listing/[slug]/roomDisplay";
import {
  BookingConfirmation,
  type ConfirmationData,
} from "./BookingConfirmation";

export const metadata: Metadata = {
  title: "Booking confirmed",
};

// Always SSR so we re-read the latest booking + payment state. The webhook
// is the source of truth; this page also calls /verify as a fast-path so
// the guest doesn't sit on "Confirming…" if the webhook is a few seconds
// behind.
export const dynamic = "force-dynamic";

const ACC_TYPE_LABEL: Record<string, string> = {
  hotel: "Hotel",
  guesthouse: "Guesthouse",
  bb: "B&B",
  self_catering: "Self-catering",
  lodge: "Lodge",
  apartment: "Apartment",
  villa: "Villa",
  cottage: "Cottage",
  other: "Stay",
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  paystack: "Card (Paystack)",
  paypal: "PayPal",
  eft: "EFT",
  manual_eft: "EFT",
};

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function compactDate(iso: string | null): string | null {
  if (!iso) return null;
  return iso.replace(/-/g, "");
}

function daysFromToday(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(`${iso}T00:00:00`).getTime();
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  return Math.max(0, Math.round((target - today) / 86_400_000));
}

export default async function BookingSuccessPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { reference?: string };
}) {
  const supabase = createServerClient();
  const brandName = await getBrandName();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // RLS guest_read_own_bookings — guest can only see their own.
  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id, reference, status, payment_status, payment_method, scope, check_in, check_out, nights, guests_count, base_amount, cleaning_fee, total_amount, currency, special_requests, listing:listings!inner ( id, host_id, name, slug, city, province, accommodation_type, address_line1, address_line2, postal_code, check_in_time, check_out_time, avg_rating, total_reviews )",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!booking) notFound();

  // Confirm the payment via the one canonical helper (verifies with the HOST's
  // key, flips the pending row, recomputes the ledger, confirms the booking).
  // For direct-host card payments this — not a platform webhook — is the
  // authoritative confirmation.
  const reference = searchParams?.reference;
  if (booking.status === "pending" && reference && reference.length > 0) {
    const hostId = (booking.listing as unknown as { host_id: string }).host_id;
    await confirmHostCardPaymentByReference({
      reference,
      hostId,
      bookingId: booking.id,
    });
    // Re-fetch the latest row.
    const { data: refreshed } = await supabase
      .from("bookings")
      .select("status, payment_status")
      .eq("id", booking.id)
      .single();
    if (refreshed) {
      booking.status = refreshed.status;
      booking.payment_status = refreshed.payment_status;
    }
  }

  const isConfirmed =
    booking.status === "confirmed" && booking.payment_status === "completed";
  // Manual-EFT bookings land here straight after reserving (no Paystack hop) —
  // they sit pending until the guest transfers + the host verifies.
  const isEftPending =
    !isConfirmed &&
    (booking.payment_method === "eft" ||
      booking.payment_method === "manual_eft");

  const listing = booking.listing as unknown as {
    id: string;
    host_id: string;
    name: string;
    slug: string | null;
    city: string | null;
    province: string | null;
    accommodation_type: string | null;
    address_line1: string | null;
    address_line2: string | null;
    postal_code: string | null;
    check_in_time: string | null;
    check_out_time: string | null;
    avg_rating: number | null;
    total_reviews: number | null;
  };

  // ── Parallel fetch: host, guest profile, room lines, add-on lines, cover ──
  const admin = createAdminClient();
  const [
    { data: hostRow },
    { data: profile },
    { data: roomLines },
    { data: addonLines },
    { data: coverRows },
  ] = await Promise.all([
    supabase
      .from("hosts")
      .select("display_name, avatar_url, is_verified, created_at")
      .eq("id", listing.host_id)
      .maybeSingle(),
    supabase
      .from("user_profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("booking_rooms")
      .select(
        "room_id, base_amount, room:listing_rooms ( id, name, max_guests, view_type, has_ensuite_bathroom, private_entrance, pets_allowed )",
      )
      .eq("booking_id", booking.id),
    supabase
      .from("booking_addons")
      .select("addon_id, label, quantity, unit_price, subtotal, pricing_model")
      .eq("booking_id", booking.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("listing_photos")
      .select("room_id, url, sort_order")
      .eq("listing_id", listing.id)
      .order("sort_order", { ascending: true }),
  ]);

  // Cover image (listing-wide photo) + per-room photo + per-room beds.
  let coverImageUrl: string | null = null;
  const photoByRoom = new Map<string, string>();
  for (const p of coverRows ?? []) {
    if (p.room_id == null) {
      if (coverImageUrl == null) coverImageUrl = p.url;
    } else if (!photoByRoom.has(p.room_id)) {
      photoByRoom.set(p.room_id, p.url);
    }
  }

  const roomIds = (roomLines ?? [])
    .map((r) => r.room_id)
    .filter((id): id is string => !!id);
  const bedsByRoom = new Map<
    string,
    { bed_kind: string; quantity: number }[]
  >();
  if (roomIds.length > 0) {
    const { data: bedRows } = await admin
      .from("room_beds")
      .select("room_id, bed_kind, quantity, sort_order")
      .in("room_id", roomIds)
      .order("sort_order", { ascending: true });
    for (const b of bedRows ?? []) {
      const arr = bedsByRoom.get(b.room_id) ?? [];
      arr.push({ bed_kind: b.bed_kind, quantity: b.quantity });
      bedsByRoom.set(b.room_id, arr);
    }
  }

  const nights = booking.nights ?? null;
  const rooms: ConfirmationData["rooms"] = (roomLines ?? []).map((line) => {
    const room = (Array.isArray(line.room) ? line.room[0] : line.room) as {
      id: string;
      name: string;
      max_guests: number;
      view_type: string | null;
      has_ensuite_bathroom: boolean;
      private_entrance: boolean;
      pets_allowed: boolean;
    } | null;
    const features: string[] = [];
    if (room?.has_ensuite_bathroom) features.push("En-suite");
    if (room?.private_entrance) features.push("Private entrance");
    if (room?.pets_allowed) features.push("Pet friendly");
    if (room?.view_type) features.push(`${room.view_type} view`);
    const total = Number(line.base_amount ?? 0);
    return {
      id: line.room_id ?? room?.id ?? Math.random().toString(36).slice(2),
      name: room?.name ?? "Room",
      bedsLabel: bedSummary(bedsByRoom.get(line.room_id ?? "") ?? []),
      sleeps: room?.max_guests ?? 0,
      photoUrl: photoByRoom.get(line.room_id ?? "") ?? null,
      features,
      total,
      perNight: nights && nights > 0 ? Math.round(total / nights) : null,
    };
  });

  const addOns: ConfirmationData["addOns"] = (addonLines ?? []).map((a) => ({
    id: a.addon_id ?? a.label,
    name: a.label,
    unitLabel: PRICING_LABEL[a.pricing_model as PricingModel] ?? "per item",
    unitPrice: Number(a.unit_price ?? 0),
    qty: a.quantity ?? 1,
    total: Number(a.subtotal ?? 0),
  }));

  const cleaningFee = Number(booking.cleaning_fee ?? 0);
  const baseAmount = Number(booking.base_amount ?? 0);
  const totalAmount = Number(booking.total_amount ?? 0);
  const accommodationTotal = rooms.length === 0 ? baseAmount : null;

  // Address (only meaningful for accommodation).
  const address =
    [listing.address_line1, listing.address_line2, listing.city]
      .filter(Boolean)
      .join(", ") || null;

  // Directions + add-to-calendar links (dynamic, no API key needed).
  const directionsQuery =
    isConfirmed && address
      ? address
      : [listing.name, listing.city].filter(Boolean).join(" ");
  const directionsUrl = directionsQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(directionsQuery)}`
    : null;

  let calendarUrl: string | null = null;
  if (isConfirmed) {
    const calTitle = encodeURIComponent(`${brandName} · ${listing.name}`);
    const calDetails = encodeURIComponent(`Booking ref: ${booking.reference}`);
    const calLoc = encodeURIComponent(
      address ?? [listing.city, listing.province].filter(Boolean).join(", "),
    );
    if (booking.check_in && booking.check_out) {
      // All-day event range (Google treats the end date as exclusive).
      calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calTitle}&details=${calDetails}&location=${calLoc}&dates=${compactDate(booking.check_in)}/${compactDate(booking.check_out)}`;
    }
  }

  const fullName = profile?.full_name?.trim() || "";
  const guestFirstName = fullName ? fullName.split(/\s+/)[0] : "there";

  const hostSince = hostRow?.created_at
    ? new Date(hostRow.created_at).toLocaleDateString("en-ZA", {
        month: "short",
        year: "numeric",
      })
    : null;

  // The analytics purchase event is staged ONLY when the booking is paid.
  // No pixel is loaded yet — this just pushes dynamic values onto dataLayer so
  // a future GTM / Meta Pixel maps it to a Purchase. (See BookingConfirmation.)
  const purchase: ConfirmationData["purchase"] = isConfirmed
    ? {
        transactionId: booking.reference,
        value: totalAmount,
        currency: booking.currency,
        contentName: listing.name,
        contentIds: [listing.id],
        numItems:
          rooms.length +
          addOns.reduce((s, a) => s + a.qty, 0) +
          (rooms.length === 0 ? 1 : 0),
        items: [
          ...(rooms.length > 0
            ? rooms.map((r) => ({
                item_id: r.id,
                item_name: r.name,
                price: r.total,
                quantity: 1,
              }))
            : [
                {
                  item_id: listing.id,
                  item_name: listing.name,
                  price: baseAmount,
                  quantity: 1,
                },
              ]),
          ...addOns.map((a) => ({
            item_id: a.id,
            item_name: a.name,
            price: a.unitPrice,
            quantity: a.qty,
          })),
        ],
      }
    : null;

  const data: ConfirmationData = {
    bookingId: booking.id,
    isConfirmed,
    isEftPending,
    reference: booking.reference,
    guestFirstName,
    guest: {
      name: fullName || (user.email ?? "Guest"),
      email: user.email ?? "",
      phone: profile?.phone ?? null,
    },
    listing: {
      name: listing.name,
      slug: listing.slug,
      typeLabel:
        ACC_TYPE_LABEL[listing.accommodation_type ?? "other"] ?? "Stay",
      city: listing.city,
      province: listing.province,
      address: isConfirmed ? address : null,
      checkInTime: listing.check_in_time,
      checkOutTime: listing.check_out_time,
      rating: listing.avg_rating == null ? null : Number(listing.avg_rating),
      reviews: listing.total_reviews ?? 0,
      coverImageUrl,
    },
    host: hostRow
      ? {
          name: hostRow.display_name,
          avatarUrl: hostRow.avatar_url,
          verified: !!hostRow.is_verified,
          since: hostSince,
        }
      : null,
    stay: {
      checkInLabel: fmtDate(booking.check_in),
      checkOutLabel: fmtDate(booking.check_out),
      nights,
      guests: booking.guests_count,
      adults: booking.guests_count,
      children: 0,
    },
    rooms,
    addOns,
    accommodationTotal,
    cleaningFee,
    totalAmount,
    currency: booking.currency,
    paymentMethodLabel: booking.payment_method
      ? (PAYMENT_METHOD_LABEL[booking.payment_method] ??
        booking.payment_method.toUpperCase())
      : null,
    specialRequests: booking.special_requests,
    daysToGo: daysFromToday(booking.check_in),
    cancellationDeadlineLabel: null,
    calendarUrl,
    directionsUrl,
    purchase,
  };

  return (
    <div className="bg-[#F4F6F4] text-brand-ink">
      <SiteHeader />
      <BookingConfirmation data={data} />
      <SiteFooter />
    </div>
  );
}
