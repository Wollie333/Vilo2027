import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { resolvePartyGuests } from "@/lib/bookings/party";
import { getBrandName } from "@/lib/brand";
import { decryptAccountNumber } from "@/lib/crypto/banking";
import { sendCapiPurchase } from "@/lib/integrations/meta-capi";
import { getHostPayPal } from "@/lib/payments/host-paypal";
import { getHostPaystack } from "@/lib/payments/host-paystack";
import {
  capturePayPalOrderForBooking,
  confirmHostCardPaymentByReference,
} from "@/lib/payments/pay-booking";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import {
  PRICING_LABEL,
  type PricingModel,
} from "../../../dashboard/addons/schemas";
import { bedSummary } from "../../../property/[slug]/roomDisplay";
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
  // reference = Paystack return; token = PayPal return (?token=<orderId>).
  // PayPal also sends PayerID on approval and `paypal=cancel` on cancel.
  searchParams?: {
    reference?: string;
    token?: string;
    PayerID?: string;
    paypal?: string;
  };
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
      "id, reference, status, payment_status, payment_method, scope, channel, capi_purchase_sent_at, guest_phone, check_in, check_out, nights, guests_count, base_amount, cleaning_fee, total_amount, currency, special_requests, additional_guests, eft_proof_url, listing:properties!inner ( id, host_id, business_id, name, slug, city, province, accommodation_type, address_line1, address_line2, postal_code, check_in_time, check_out_time, avg_rating, total_reviews )",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!booking) notFound();

  const admin = createAdminClient();

  // Confirm the payment via the one canonical helper (verifies with the HOST's
  // key, flips the pending row, recomputes the ledger, confirms the booking).
  // For direct-host card payments this — not a platform webhook — is the
  // authoritative confirmation.
  const reference = searchParams?.reference;
  const paypalToken = searchParams?.token;
  const hostId = (booking.listing as unknown as { host_id: string }).host_id;
  // The confirm/capture helpers deliberately THROW when a captured payment can't
  // be confirmed (e.g. the confirm-time availability guard on a concurrent
  // confirm). We must NOT let that 500 the guest's page — they've been charged.
  // Catch it, log, and fall through to re-render whatever state the booking is
  // in; the reconcile worker finalises it. Idempotent on refresh either way.
  if (booking.status === "pending" && reference && reference.length > 0) {
    try {
      await confirmHostCardPaymentByReference({
        reference,
        hostId,
        bookingId: booking.id,
      });
    } catch (err) {
      console.error("success: card confirm failed after capture", err);
    }
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
  } else if (
    booking.status === "pending" &&
    booking.payment_method === "paypal" &&
    paypalToken &&
    paypalToken.length > 0 &&
    // Only capture on an APPROVED return: PayPal adds PayerID on approval and
    // sends `paypal=cancel` (with the token) on cancel. Without this we'd fire a
    // capture attempt on every cancelled order.
    searchParams?.paypal !== "cancel" &&
    !!searchParams?.PayerID
  ) {
    // PayPal return — capture the approved order on the host's app + settle.
    try {
      await capturePayPalOrderForBooking({
        orderId: paypalToken,
        hostId,
        bookingId: booking.id,
      });
    } catch (err) {
      console.error("success: paypal capture failed after approval", err);
    }
    const { data: refreshed } = await supabase
      .from("bookings")
      .select("status, payment_status")
      .eq("id", booking.id)
      .single();
    if (refreshed) {
      booking.status = refreshed.status;
      booking.payment_status = refreshed.payment_status;
    }
  } else if (
    // Explicit PayPal cancellation — the payer tapped "Cancel and return" on
    // PayPal, which sends `paypal=cancel` (with the order token, no PayerID). We
    // never captured, so the booking is an unpaid hold. Release it immediately
    // so a cancelled payment never leaves a lingering "booking" (founder call —
    // otherwise it sits pending until the 30-min expire cron). Guarded hard: the
    // UPDATE can only ever touch a still-pending, not-completed row, so a paid or
    // already-confirmed booking is untouchable here.
    booking.status === "pending" &&
    booking.payment_method === "paypal" &&
    searchParams?.paypal === "cancel"
  ) {
    const { data: released } = await admin
      .from("bookings")
      .update({
        status: "expired",
        cancelled_by: "guest",
        cancellation_reason: "payment_cancelled",
      })
      .eq("id", booking.id)
      .eq("status", "pending")
      .neq("payment_status", "completed")
      .select("status");
    if (released && released.length > 0) {
      booking.status = released[0].status;
    }
  }

  const isConfirmed =
    booking.status === "confirmed" && booking.payment_status === "completed";
  // A released hold — an explicitly cancelled PayPal payment (above) or any
  // booking the expire cron / a cancellation swept away. The confirmation page
  // must own up to this: no itinerary, no "paid", just "not placed — book again".
  const isReleased =
    booking.status === "expired" ||
    booking.status === "declined" ||
    booking.status.startsWith("cancelled");
  // Manual-EFT bookings land here straight after reserving (no Paystack hop) —
  // they sit pending until the guest transfers + the host verifies.
  const isEftPending =
    !isConfirmed &&
    !isReleased &&
    (booking.payment_method === "eft" ||
      booking.payment_method === "manual_eft");
  // A card/PayPal attempt that did NOT complete (cancelled, failed, or the payer
  // bailed and refreshed). The booking is still a pending hold they can retry —
  // but it is emphatically NOT paid, so the page must not imply it went through.
  const isPaymentIncomplete =
    !isConfirmed &&
    !isReleased &&
    !isEftPending &&
    (booking.payment_method === "paystack" ||
      booking.payment_method === "paypal");

  const listing = booking.listing as unknown as {
    id: string;
    host_id: string;
    business_id: string | null;
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
  const [
    { data: hostRow },
    { data: profile },
    { data: roomLines },
    { data: addonLines },
    { data: coverRows },
  ] = await Promise.all([
    supabase
      .from("hosts")
      .select("display_name, avatar_url, is_verified, created_at, user_id")
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
        "room_id, base_amount, room:property_rooms ( id, name, max_guests, view_type, has_ensuite_bathroom, private_entrance, pets_allowed )",
      )
      .eq("booking_id", booking.id),
    supabase
      .from("booking_addons")
      .select("addon_id, label, quantity, unit_price, subtotal, pricing_model")
      .eq("booking_id", booking.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("property_photos")
      .select("room_id, url, sort_order")
      .eq("property_id", listing.id)
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

  // ── Payment rails the guest can still use (only meaningful while unpaid) ──
  // EFT banking resolves from the listing's business (Phase 3a), with the
  // host's default account as the fallback. Card is offered only when the host
  // has a connected Paystack account. Re-payment (incl. PayPal) happens on the
  // /booking/[id]/pay surface, which surfaces every rail the host offers.
  const BANK_COLS =
    "bank_name, account_holder, account_number, account_type, branch_code, swift_code";
  const [bankBiz, bankHost, hostPaystack, hostPayPal] = await Promise.all([
    listing.business_id
      ? admin
          .from("eft_banking_details")
          .select(BANK_COLS)
          .eq("business_id", listing.business_id)
          .eq("is_archived", false)
          .order("is_default", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from("eft_banking_details")
      .select(BANK_COLS)
      .eq("host_id", listing.host_id)
      .eq("is_default", true)
      .eq("is_archived", false)
      .limit(1)
      .maybeSingle(),
    getHostPaystack(listing.host_id),
    getHostPayPal(listing.host_id),
  ]);

  const bankRow = (bankBiz.data ?? bankHost.data) as {
    bank_name: string | null;
    account_holder: string | null;
    account_number: string | null;
    account_type: string | null;
    branch_code: string | null;
    swift_code: string | null;
  } | null;

  // account_number is encrypted at rest (v1.<nonce>.<ct>.<tag>) — decrypt it
  // server-side before it reaches the client. Without this the guest was shown
  // the ciphertext and couldn't actually pay by EFT (and it leaked the stored
  // form). decryptAccountNumber returns legacy plain values as-is; guard the
  // rare decrypt failure so this guest-facing page can't 500.
  let eftAccountNumber: string | null = null;
  if (bankRow?.account_number) {
    try {
      eftAccountNumber = decryptAccountNumber(bankRow.account_number);
    } catch (err) {
      console.error("success: could not decrypt EFT account number", err);
    }
  }

  const payment: ConfirmationData["payment"] = {
    // A released hold can't be paid — offering rails on an expired booking would
    // re-open a settled-cancelled flow. Only a live, unpaid booking is "due".
    due: !isConfirmed && !isReleased,
    payUrl: `/booking/${booking.id}/pay`,
    cardAvailable: !!hostPaystack,
    paypalAvailable: !!hostPayPal,
    eft: bankRow
      ? {
          bankName: bankRow.bank_name,
          accountHolder: bankRow.account_holder,
          accountNumber: eftAccountNumber,
          accountType: bankRow.account_type,
          branchCode: bankRow.branch_code,
          swiftCode: bankRow.swift_code,
        }
      : null,
  };

  const fullName = profile?.full_name?.trim() || "";
  const guestFirstName = fullName ? fullName.split(/\s+/)[0] : "there";

  const hostSince = hostRow?.created_at
    ? new Date(hostRow.created_at).toLocaleDateString("en-ZA", {
        month: "short",
        year: "numeric",
      })
    : null;

  // Host contact for the "Your host" card. Website + socials belong to the
  // BUSINESS (resolved via the booking's listing.business_id); phone + email are
  // the host's user_profiles contact — RLS-guarded to self, read with the admin
  // client — the same contact already printed on the guest's invoice.
  let hostContact = {
    website: null as string | null,
    phone: null as string | null,
    email: null as string | null,
    socials: null as Record<string, string> | null,
  };
  if (hostRow?.user_id) {
    const [{ data: hostProfile }, { data: biz }] = await Promise.all([
      admin
        .from("user_profiles")
        .select("email, phone")
        .eq("id", hostRow.user_id)
        .maybeSingle(),
      listing.business_id
        ? admin
            .from("businesses")
            .select("website_url, social_links")
            .eq("id", listing.business_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    hostContact = {
      website: biz?.website_url ?? null,
      phone: hostProfile?.phone ?? null,
      email: hostProfile?.email ?? null,
      socials: (biz?.social_links as Record<string, string> | null) ?? null,
    };
  }

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

  // Meta CAPI (server-side) Purchase — DIRECTORY (Wielo) bookings only, deduped
  // against the browser pixel via event_id = booking.reference. Fires exactly
  // once (stamped on success). Website bookings use the host's own pixel, never
  // Wielo's CAPI. Best-effort: never breaks the confirmation page.
  if (
    purchase &&
    booking.channel !== "website" &&
    !booking.capi_purchase_sent_at
  ) {
    try {
      const h = await headers();
      const c = await cookies();
      const fwd = h.get("x-forwarded-for") ?? "";
      const clientIp = fwd.split(",")[0]?.trim() || h.get("x-real-ip") || null;
      const host = h.get("x-forwarded-host") || h.get("host") || "";
      const scheme =
        host.startsWith("localhost") || host.startsWith("127.")
          ? "http"
          : "https";
      const sent = await sendCapiPurchase({
        eventId: purchase.transactionId,
        eventSourceUrl: host
          ? `${scheme}://${host}/booking/${booking.id}/success`
          : "",
        email: user.email,
        phone: booking.guest_phone ?? profile?.phone ?? null,
        clientIp,
        userAgent: h.get("user-agent"),
        fbp: c.get("_fbp")?.value ?? null,
        fbc: c.get("_fbc")?.value ?? null,
        value: purchase.value,
        currency: purchase.currency,
        contentIds: purchase.contentIds,
        contents: purchase.items.map((i) => ({
          id: i.item_id,
          quantity: i.quantity,
          item_price: i.price,
        })),
        numItems: purchase.numItems,
      });
      if (sent) {
        await admin
          .from("bookings")
          .update({ capi_purchase_sent_at: new Date().toISOString() })
          .eq("id", booking.id);
      }
    } catch {
      // best-effort — the browser pixel still fires; retry on next load
    }
  }

  // ── First-booking celebration (once ever, per guest) ──────────────────────
  // Fire ONLY when this is the guest's first CONFIRMED booking. We claim it
  // atomically: flip first_booking_celebrated_at NULL → now() and only the
  // request that won the flip shows the modal, so a refresh/revisit — or a
  // second tab — can never re-fire it. Guard with a confirmed-count check so a
  // guest with prior confirmed bookings (e.g. pre-column data) isn't celebrated.
  let celebrateFirstBooking = false;
  if (isConfirmed) {
    const { count: confirmedCount } = await admin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("guest_id", user.id)
      .eq("status", "confirmed");
    if ((confirmedCount ?? 0) <= 1) {
      const { data: claimed } = await admin
        .from("user_profiles")
        .update({ first_booking_celebrated_at: new Date().toISOString() })
        .eq("id", user.id)
        .is("first_booking_celebrated_at", null)
        .select("id");
      celebrateFirstBooking = !!(claimed && claimed.length > 0);
    }
  }

  // Party manifest, resolved against each member's own Wielo profile.
  const partyGuests = await resolvePartyGuests(
    admin,
    booking.additional_guests,
  );

  const data: ConfirmationData = {
    bookingId: booking.id,
    isConfirmed,
    isEftPending,
    isPaymentIncomplete,
    isReleased,
    rebookUrl: listing.slug ? `/property/${listing.slug}/book` : null,
    proofUploaded: !!booking.eft_proof_url,
    reference: booking.reference,
    guestFirstName,
    guest: {
      name: fullName || (user.email ?? "Guest"),
      email: user.email ?? "",
      phone: profile?.phone ?? null,
    },
    partyGuests,
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
          contact: hostContact,
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
    paymentMethod: booking.payment_method,
    specialRequests: booking.special_requests,
    payment,
    daysToGo: daysFromToday(booking.check_in),
    cancellationDeadlineLabel: null,
    calendarUrl,
    directionsUrl,
    purchase,
    celebrateFirstBooking,
  };

  return (
    <div className="bg-[#F4F6F4] text-brand-ink">
      <SiteHeader />
      <BookingConfirmation data={data} />
      <SiteFooter />
    </div>
  );
}
