import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  Car,
  CheckCircle2,
  ChevronRight,
  Coffee,
  Compass,
  DoorOpen,
  Flame,
  Images,
  KeyRound,
  Languages,
  LifeBuoy,
  Lock,
  type LucideIcon,
  MapPin,
  MessageSquare,
  Mountain,
  Navigation,
  Quote as QuoteIcon,
  Snowflake,
  Sparkles,
  Tv,
  Utensils,
  Waves,
  Wifi,
} from "lucide-react";

import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { CancelTripButton } from "./CancelTripButton";
import { RequestRefundButton } from "./RequestRefundButton";

export const metadata: Metadata = {
  title: "Your trip",
};

export const dynamic = "force-dynamic";

// ─── helpers ─────────────────────────────────────────────────────
function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function fmtDay(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function fmtLong(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function fmtTime(t: string | null): string | null {
  if (!t) return null;
  // stored as HH:MM[:SS]
  return t.slice(0, 5);
}

// Small amenity-key → icon map (defaults to a tick). Keeps the section honest:
// only amenities the host actually set on the listing are shown.
const AMENITY_ICONS: Record<string, LucideIcon> = {
  wifi: Wifi,
  kitchen: Utensils,
  parking: Car,
  pool: Waves,
  hot_tub: Waves,
  aircon: Snowflake,
  heating: Flame,
  fireplace: Flame,
  tv: Tv,
  braai: Flame,
  pet_friendly: Compass,
  workspace: Coffee,
  self_checkin: KeyRound,
  host_onsite: BadgeCheck,
};

const PICK_META: Record<string, { label: string; icon: LucideIcon }> = {
  eat: { label: "Eat", icon: Utensils },
  drink: { label: "Drink", icon: Coffee },
  do: { label: "Do", icon: Compass },
  see: { label: "See", icon: Mountain },
  shop: { label: "Shop", icon: Sparkles },
  other: { label: "Tip", icon: Sparkles },
};

const STATUS_META: Record<
  string,
  { label: string; cls: string; icon: LucideIcon }
> = {
  confirmed: {
    label: "Confirmed",
    cls: "bg-status-confirmed/12 text-status-confirmed ring-status-confirmed/25",
    icon: CheckCircle2,
  },
  checked_in: {
    label: "Checked in",
    cls: "bg-status-confirmed/12 text-status-confirmed ring-status-confirmed/25",
    icon: CheckCircle2,
  },
  completed: {
    label: "Completed",
    cls: "bg-status-completed/12 text-status-completed ring-status-completed/25",
    icon: CheckCircle2,
  },
  checked_out: {
    label: "Completed",
    cls: "bg-status-completed/12 text-status-completed ring-status-completed/25",
    icon: CheckCircle2,
  },
  pending: {
    label: "Pending",
    cls: "bg-status-pending/12 text-status-pending ring-status-pending/25",
    icon: CheckCircle2,
  },
  pending_eft: {
    label: "Pending EFT",
    cls: "bg-status-pending/12 text-status-pending ring-status-pending/25",
    icon: CheckCircle2,
  },
  cancelled_by_guest: {
    label: "Cancelled",
    cls: "bg-status-cancelled/12 text-status-cancelled ring-status-cancelled/25",
    icon: CheckCircle2,
  },
  cancelled_by_host: {
    label: "Cancelled by host",
    cls: "bg-status-cancelled/12 text-status-cancelled ring-status-cancelled/25",
    icon: CheckCircle2,
  },
  expired: {
    label: "Expired",
    cls: "bg-brand-light text-brand-mute ring-brand-line",
    icon: CheckCircle2,
  },
};

type ListingEmbed = {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  province: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  check_in_time: string | null;
  check_out_time: string | null;
  house_rules: string | null;
  max_guests: number | null;
  accommodation_type: string | null;
  listing_type: string | null;
  photos: { url: string | null; sort_order: number }[] | null;
  amenities: { amenity_key: string; amenity_label: string | null }[] | null;
  local_picks:
    | {
        category: string;
        title: string;
        blurb: string | null;
        image_path: string | null;
        distance_label: string | null;
        sort_order: number;
      }[]
    | null;
};

type HostEmbed = {
  handle: string;
  display_name: string;
  avatar_url: string | null;
  is_superhost: boolean | null;
  avg_rating: number | null;
  response_rate: number | null;
  languages_spoken: string[] | null;
  created_at: string;
};

export default async function PortalTripDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/portal/trips/${params.id}`);

  const { data: bookingRaw } = await supabase
    .from("bookings")
    .select(
      `
      id, host_id, reference, status, payment_status, payment_method, scope,
      check_in, check_out, nights, guests_count,
      base_amount, cleaning_fee, discount_amount, total_amount, currency,
      special_requests, host_message, created_at, confirmed_at,
      has_open_refund,
      listing:listings (
        id, name, slug, city, province, address_line1, address_line2,
        postal_code, latitude, longitude, check_in_time, check_out_time,
        house_rules, max_guests, accommodation_type, listing_type,
        photos:listing_photos ( url, sort_order ),
        amenities:listing_amenities ( amenity_key, amenity_label ),
        local_picks:listing_local_picks ( category, title, blurb, image_path, distance_label, sort_order )
      ),
      host:hosts ( handle, display_name, avatar_url, is_superhost, avg_rating, response_rate, languages_spoken, created_at ),
      booking_rooms ( room:listing_rooms ( name ) )
    `,
    )
    .eq("id", params.id)
    .eq("guest_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!bookingRaw) notFound();

  const booking = bookingRaw as unknown as {
    id: string;
    host_id: string;
    reference: string;
    status: string;
    payment_status: string | null;
    payment_method: string | null;
    scope: string;
    check_in: string | null;
    check_out: string | null;
    nights: number | null;
    guests_count: number;
    base_amount: number;
    cleaning_fee: number | null;
    discount_amount: number | null;
    total_amount: number;
    currency: string;
    special_requests: string | null;
    host_message: string | null;
    created_at: string;
    confirmed_at: string | null;
    has_open_refund: boolean | null;
    listing: ListingEmbed | ListingEmbed[] | null;
    host: HostEmbed | HostEmbed[] | null;
    booking_rooms:
      | { room: { name: string } | { name: string }[] | null }[]
      | null;
  };

  const listing = one(booking.listing);
  const host = one(booking.host);
  const currency = booking.currency;

  // Sensitive access details: fetched with the service role (the booking is
  // verified as this guest's above) so secrets never depend on public RLS.
  let access: {
    check_in_method: string | null;
    check_in_instructions: string | null;
    door_code: string | null;
    wifi_network: string | null;
    wifi_password: string | null;
  } | null = null;
  let hostReviewCount = 0;
  if (listing?.id) {
    const admin = createAdminClient();
    const [{ data: accessRow }, { count }] = await Promise.all([
      admin
        .from("listing_access")
        .select(
          "check_in_method, check_in_instructions, door_code, wifi_network, wifi_password",
        )
        .eq("listing_id", listing.id)
        .maybeSingle(),
      admin
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("host_id", booking.host_id),
    ]);
    access = accessRow ?? null;
    hostReviewCount = count ?? 0;
  }

  // Refund history (guest reads own via RLS).
  const { data: refunds } = await supabase
    .from("refund_requests")
    .select(
      "id, status, requested_amount, approved_amount, currency, created_at",
    )
    .eq("booking_id", booking.id)
    .order("created_at", { ascending: false });

  // ── derived ──
  const statusMeta = STATUS_META[booking.status] ?? {
    label: booking.status.replace(/_/g, " "),
    cls: "bg-brand-light text-brand-mute ring-brand-line",
    icon: CheckCircle2,
  };
  const StatusIcon = statusMeta.icon;

  const dayMs = 86_400_000;
  const now = Date.now();
  const checkInMs = booking.check_in
    ? new Date(`${booking.check_in}T00:00:00`).getTime()
    : null;
  const checkOutMs = booking.check_out
    ? new Date(`${booking.check_out}T00:00:00`).getTime()
    : null;
  const daysToGo =
    checkInMs != null ? Math.ceil((checkInMs - now) / dayMs) : null;
  const isLive = ["confirmed", "checked_in"].includes(booking.status);
  const isCancelled = booking.status.startsWith("cancelled");

  // Access secrets unlock from 24h before check-in (a physical-key courtesy)
  // and only for a live/completed booking.
  const accessUnlocked =
    checkInMs != null &&
    now >= checkInMs - dayMs &&
    ["confirmed", "checked_in", "completed", "checked_out"].includes(
      booking.status,
    );

  // Stay timeline progress (booked → arrive → checkout) for the dark rail.
  const bookedMs = new Date(booking.created_at).getTime();
  let progressPct = 0;
  if (checkInMs != null && checkOutMs != null && checkInMs > bookedMs) {
    if (now >= checkOutMs) progressPct = 100;
    else if (now <= bookedMs) progressPct = 0;
    else if (now >= checkInMs)
      progressPct =
        80 + Math.min(20, ((now - checkInMs) / (checkOutMs - checkInMs)) * 20);
    else
      progressPct = Math.min(
        80,
        ((now - bookedMs) / (checkInMs - bookedMs)) * 80,
      );
  }

  const photos = (listing?.photos ?? [])
    .filter((p) => p.url)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => p.url as string);
  const galleryCount = photos.length;
  const bento = photos.slice(0, 5);

  const amenities = listing?.amenities ?? [];
  const picks = (listing?.local_picks ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);

  const roomNames = (booking.booking_rooms ?? [])
    .map((br) => one(br.room)?.name)
    .filter((n): n is string => Boolean(n));
  const typeLabel =
    listing?.accommodation_type ?? listing?.listing_type ?? "Stay";
  const stayLabel =
    booking.scope === "whole"
      ? `Whole ${typeLabel.toLowerCase()}`
      : roomNames.length > 0
        ? roomNames.join(", ")
        : "Private room";

  const addressLines = [
    listing?.address_line1,
    [listing?.city, listing?.province, listing?.postal_code]
      .filter(Boolean)
      .join(", "),
  ].filter(Boolean) as string[];
  const mapsHref =
    listing?.latitude != null && listing?.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${listing.latitude},${listing.longitude}`
      : addressLines.length > 0
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            [listing?.name, ...addressLines].filter(Boolean).join(", "),
          )}`
        : null;

  const hostFirstName = host?.display_name?.split(" ")[0] ?? "your host";
  const memberSince = host ? new Date(host.created_at).getFullYear() : null;

  const canCancel = [
    "pending",
    "pending_eft",
    "pending_eft_review",
    "confirmed",
  ].includes(booking.status);
  const canRequestRefund =
    !booking.has_open_refund &&
    (booking.payment_status === "captured" ||
      booking.payment_status === "completed") &&
    booking.status !== "expired";

  const discount = Number(booking.discount_amount ?? 0);

  return (
    <div className="mx-auto max-w-[1120px]">
      {/* ===== IN-CONTENT HEADER ===== */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/portal/trips"
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-brand-ink hover:bg-brand-light/60"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> My trips
        </Link>
        <div className="hidden items-center gap-2 text-[12.5px] md:flex">
          <ChevronRight className="h-3 w-3 text-brand-line" />
          <span className="font-semibold text-brand-ink">
            {listing?.name ?? "Trip"}
          </span>
        </div>
        <Link
          href="/help"
          className="ml-auto inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-brand-ink hover:bg-brand-light/60"
        >
          <LifeBuoy className="h-3.5 w-3.5" /> Get help
        </Link>
      </div>

      {/* ===== TITLE BLOCK ===== */}
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11.5px] font-semibold ring-1 ${statusMeta.cls}`}
            >
              <StatusIcon className="h-3.5 w-3.5" /> {statusMeta.label}
            </span>
            {daysToGo != null && daysToGo >= 0 && isLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-white px-2.5 py-1 text-[11.5px] font-semibold text-brand-secondary ring-1 ring-brand-line">
                <MapPin className="h-3.5 w-3.5 text-brand-primary" />
                {daysToGo === 0 ? "Arriving today" : `${daysToGo} days to go`}
              </span>
            ) : null}
          </div>
          <h1 className="mt-3 font-display text-[30px] font-extrabold leading-tight tracking-tight text-brand-ink lg:text-[36px]">
            {listing?.name ?? "Your trip"}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-brand-mute">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-brand-primary" /> {stayLabel}
              {listing?.city ? ` · ${listing.city}` : ""}
              {listing?.province ? `, ${listing.province}` : ""}
            </span>
            <span className="h-1 w-1 rounded-full bg-brand-line" />
            <span className="num font-mono text-[12px]">
              {booking.reference}
            </span>
          </div>
        </div>
        {host ? (
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="h-10 w-10 overflow-hidden rounded-pill shadow-card ring-2 ring-white">
              {host.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={host.avatar_url}
                  alt={host.display_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-brand-gradient text-sm font-bold text-white">
                  {host.display_name.slice(0, 1)}
                </span>
              )}
            </span>
            <div className="leading-tight">
              <div className="text-[11px] text-brand-mute">Hosted by</div>
              <div className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-brand-ink">
                {hostFirstName}
                {host.is_superhost ? (
                  <BadgeCheck className="h-3.5 w-3.5 text-brand-primary" />
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* ===== GALLERY BENTO ===== */}
      {bento.length > 0 ? (
        <div
          className="mt-5 grid grid-cols-4 grid-rows-2 gap-2.5 overflow-hidden rounded-card"
          style={{ height: 380 }}
        >
          {bento.map((url, i) => (
            <div
              key={i}
              className={`relative overflow-hidden bg-brand-accent ${
                i === 0 ? "col-span-2 row-span-2" : ""
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              {i === bento.length - 1 && galleryCount > 5 ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/35 text-[12.5px] font-semibold text-white backdrop-blur-[1px]">
                  <span className="inline-flex items-center gap-1.5">
                    <Images className="h-4 w-4" /> All {galleryCount} photos
                  </span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* ===== ACTION BAR ===== */}
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <Link
          href="/portal/inbox"
          className="inline-flex items-center gap-2 rounded-[10px] bg-brand-primary px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-secondary"
        >
          <MessageSquare className="h-4 w-4" /> Message {hostFirstName}
        </Link>
        {mapsHref ? (
          <a
            href={mapsHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-[10px] border border-brand-line bg-white px-4 py-2.5 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
          >
            <Navigation className="h-4 w-4 text-brand-primary" /> Get directions
          </a>
        ) : null}
        {listing?.slug ? (
          <Link
            href={`/listing/${listing.slug}`}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-[10px] border border-brand-line bg-white px-4 py-2.5 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
          >
            <MapPin className="h-4 w-4 text-brand-primary" /> View listing
          </Link>
        ) : null}
      </div>

      {/* ===== TWO-COLUMN GRID ===== */}
      <div className="mt-7 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        {/* LEFT */}
        <div className="min-w-0 space-y-6">
          {/* AT A GLANCE */}
          <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            <div className="grid grid-cols-2 divide-x divide-y divide-brand-line sm:grid-cols-4 sm:divide-y-0">
              <Glance
                label="Check-in"
                value={fmtDay(booking.check_in)}
                sub={
                  fmtTime(listing?.check_in_time ?? null)
                    ? `After ${fmtTime(listing?.check_in_time ?? null)}`
                    : null
                }
              />
              <Glance
                label="Check-out"
                value={fmtDay(booking.check_out)}
                sub={
                  fmtTime(listing?.check_out_time ?? null)
                    ? `Before ${fmtTime(listing?.check_out_time ?? null)}`
                    : null
                }
              />
              <Glance
                label="Guests"
                value={`${booking.guests_count} guest${booking.guests_count === 1 ? "" : "s"}`}
                sub={
                  booking.nights
                    ? `${booking.nights} night${booking.nights === 1 ? "" : "s"}`
                    : null
                }
              />
              <Glance
                label="Total"
                value={formatMoney(Number(booking.total_amount), currency)}
                sub={
                  booking.payment_status === "completed" ||
                  booking.payment_status === "captured"
                    ? "Paid in full"
                    : "Due"
                }
                accent={
                  booking.payment_status === "completed" ||
                  booking.payment_status === "captured"
                }
              />
            </div>
          </section>

          {/* NOTE FROM HOST */}
          {booking.host_message ? (
            <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="relative p-6">
                <div className="absolute right-5 top-5 text-brand-accent">
                  <QuoteIcon className="h-10 w-10" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="h-12 w-12 shrink-0 overflow-hidden rounded-pill ring-2 ring-brand-accent">
                    {host?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={host.avatar_url}
                        alt={host.display_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-brand-gradient text-base font-bold text-white">
                        {host?.display_name.slice(0, 1) ?? "H"}
                      </span>
                    )}
                  </span>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-mute">
                      A note from your host
                    </div>
                    <div className="font-display text-[16px] font-bold text-brand-ink">
                      {host?.display_name ?? "Your host"}
                    </div>
                  </div>
                </div>
                <p className="mt-4 max-w-[58ch] whitespace-pre-line text-[14px] leading-relaxed text-brand-ink/90">
                  {booking.host_message}
                </p>
                <div className="mt-3 font-display text-[15px] font-semibold text-brand-secondary">
                  — {hostFirstName}
                </div>
              </div>
            </section>
          ) : null}

          {/* GETTING THERE & CHECKING IN */}
          {addressLines.length > 0 ||
          access?.check_in_method ||
          access?.wifi_network ||
          access?.door_code ? (
            <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="border-b border-brand-line px-6 py-4">
                <div className="font-display text-[15px] font-bold text-brand-ink">
                  Getting there &amp; checking in
                </div>
                {!accessUnlocked &&
                (access?.door_code || access?.wifi_password) ? (
                  <div className="mt-0.5 text-[12px] text-brand-mute">
                    Your access details unlock 24 hours before arrival
                  </div>
                ) : null}
              </div>

              {addressLines.length > 0 ? (
                <div className="p-6">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-mute">
                    Address
                  </div>
                  {addressLines.map((line, i) => (
                    <div
                      key={i}
                      className={
                        i === 0
                          ? "mt-1.5 text-[14px] font-semibold text-brand-ink"
                          : "text-[13px] text-brand-mute"
                      }
                    >
                      {line}
                    </div>
                  ))}
                  {mapsHref ? (
                    <a
                      href={mapsHref}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-primary hover:underline"
                    >
                      <Navigation className="h-3.5 w-3.5" /> Open in Maps
                    </a>
                  ) : null}
                </div>
              ) : null}

              <div className="divide-y divide-brand-line border-t border-brand-line">
                {access?.check_in_method ? (
                  <AccessRow
                    icon={<DoorOpen className="h-4 w-4 text-brand-mute" />}
                    label="Check-in method"
                    value={
                      <span className="text-[13px] font-semibold text-brand-ink">
                        {access.check_in_method}
                      </span>
                    }
                  />
                ) : null}
                {access?.door_code ? (
                  <AccessRow
                    icon={<KeyRound className="h-4 w-4 text-brand-mute" />}
                    label="Door code"
                    value={
                      accessUnlocked ? (
                        <span className="num font-mono text-[12.5px] font-semibold text-brand-ink">
                          {access.door_code}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-light px-2.5 py-1 text-[11.5px] font-medium text-brand-mute">
                          <Lock className="h-3.5 w-3.5" /> Unlocks{" "}
                          {checkInMs
                            ? fmtDay(
                                new Date(checkInMs - dayMs)
                                  .toISOString()
                                  .slice(0, 10),
                              )
                            : "near check-in"}
                        </span>
                      )
                    }
                  />
                ) : null}
                {access?.wifi_network ? (
                  <AccessRow
                    icon={<Wifi className="h-4 w-4 text-brand-mute" />}
                    label="Wi-Fi network"
                    value={
                      <span className="num font-mono text-[12.5px] font-semibold text-brand-ink">
                        {access.wifi_network}
                      </span>
                    }
                  />
                ) : null}
                {access?.wifi_password ? (
                  <AccessRow
                    icon={<Lock className="h-4 w-4 text-brand-mute" />}
                    label="Wi-Fi password"
                    value={
                      accessUnlocked ? (
                        <span className="num font-mono text-[12.5px] font-semibold text-brand-ink">
                          {access.wifi_password}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-light px-2.5 py-1 text-[11.5px] font-medium text-brand-mute">
                          <Lock className="h-3.5 w-3.5" /> Unlocks near check-in
                        </span>
                      )
                    }
                  />
                ) : null}
                {access?.check_in_instructions ? (
                  <div className="px-6 py-3.5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-mute">
                      Arrival instructions
                    </div>
                    <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-brand-ink">
                      {access.check_in_instructions}
                    </p>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* WHAT THIS PLACE OFFERS */}
          {amenities.length > 0 ? (
            <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="border-b border-brand-line px-6 py-4">
                <div className="font-display text-[15px] font-bold text-brand-ink">
                  What this place offers
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-6 sm:grid-cols-3">
                {amenities.map((a, i) => {
                  const Icon = AMENITY_ICONS[a.amenity_key] ?? CheckCircle2;
                  return (
                    <div
                      key={i}
                      className="inline-flex items-center gap-2.5 text-[13px] text-brand-ink"
                    >
                      <Icon className="h-4 w-4 text-brand-primary" />
                      {a.amenity_label ??
                        a.amenity_key
                          .replace(/_/g, " ")
                          .replace(/^\w/, (c) => c.toUpperCase())}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* LOCAL PICKS */}
          {picks.length > 0 ? (
            <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="flex items-center justify-between border-b border-brand-line px-6 py-4">
                <div>
                  <div className="font-display text-[15px] font-bold text-brand-ink">
                    {hostFirstName}&rsquo;s local picks
                  </div>
                  <div className="mt-0.5 text-[12px] text-brand-mute">
                    Favourites from your host
                  </div>
                </div>
                <Compass className="h-5 w-5 text-brand-primary" />
              </div>
              <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3">
                {picks.map((p, i) => {
                  const meta = PICK_META[p.category] ?? PICK_META.other;
                  const PickIcon = meta.icon;
                  return (
                    <div
                      key={i}
                      className="overflow-hidden rounded-[12px] border border-brand-line"
                    >
                      <div className="relative flex h-28 items-center justify-center overflow-hidden bg-[repeating-linear-gradient(135deg,#D1FAE5_0_12px,#BBF3D4_12px_24px)]">
                        {p.image_path ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.image_path}
                            alt={p.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <PickIcon className="h-7 w-7 text-brand-secondary/70" />
                        )}
                      </div>
                      <div className="p-3.5">
                        <div className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-brand-primary">
                          <PickIcon className="h-3 w-3" /> {meta.label}
                          {p.distance_label ? (
                            <span className="text-brand-mute">
                              · {p.distance_label}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-[13.5px] font-bold text-brand-ink">
                          {p.title}
                        </div>
                        {p.blurb ? (
                          <p className="mt-1 text-[12px] leading-relaxed text-brand-mute">
                            {p.blurb}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* KNOW BEFORE YOU GO */}
          {listing?.house_rules ? (
            <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="border-b border-brand-line px-6 py-4">
                <div className="font-display text-[15px] font-bold text-brand-ink">
                  Know before you go
                </div>
              </div>
              <div className="p-6">
                <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-brand-ink/90">
                  {listing.house_rules}
                </p>
              </div>
            </section>
          ) : null}

          {/* YOUR REQUEST */}
          {booking.special_requests ? (
            <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="border-b border-brand-line px-6 py-4">
                <div className="font-display text-[15px] font-bold text-brand-ink">
                  Your request
                </div>
              </div>
              <div className="p-6">
                <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-brand-ink/90">
                  {booking.special_requests}
                </p>
              </div>
            </section>
          ) : null}

          {/* RECEIPT */}
          <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-brand-line px-6 py-4">
              <div className="font-display text-[15px] font-bold text-brand-ink">
                Your receipt
              </div>
              {booking.payment_status === "completed" ||
              booking.payment_status === "captured" ? (
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-status-confirmed/10 px-2.5 py-1 text-[11.5px] font-semibold text-status-confirmed">
                  <CheckCircle2 className="h-3 w-3" /> Paid in full
                </span>
              ) : null}
            </div>
            <div className="p-6">
              <ul className="space-y-3 text-[13.5px]">
                <li className="flex items-center justify-between">
                  <span className="text-brand-mute">
                    {booking.nights
                      ? `${formatMoney(Number(booking.base_amount) / booking.nights, currency)} × ${booking.nights} night${booking.nights === 1 ? "" : "s"}`
                      : "Accommodation"}
                  </span>
                  <span className="num font-medium text-brand-ink">
                    {formatMoney(Number(booking.base_amount), currency)}
                  </span>
                </li>
                {Number(booking.cleaning_fee ?? 0) > 0 ? (
                  <li className="flex items-center justify-between">
                    <span className="text-brand-mute">Cleaning fee</span>
                    <span className="num font-medium text-brand-ink">
                      {formatMoney(Number(booking.cleaning_fee), currency)}
                    </span>
                  </li>
                ) : null}
                {discount > 0 ? (
                  <li className="flex items-center justify-between text-brand-primary">
                    <span>Discount</span>
                    <span className="num">
                      – {formatMoney(discount, currency)}
                    </span>
                  </li>
                ) : null}
                <li className="flex items-center justify-between text-brand-primary">
                  <span>Vilo booking fee</span>
                  <span className="num">{formatMoney(0, currency)}</span>
                </li>
                <li className="flex items-center justify-between border-t border-brand-line pt-3">
                  <span className="font-semibold text-brand-ink">Total</span>
                  <span className="num font-display text-[18px] font-bold text-brand-ink">
                    {formatMoney(Number(booking.total_amount), currency)}
                  </span>
                </li>
              </ul>
              {booking.payment_method ? (
                <div className="mt-4 rounded-[12px] bg-brand-light px-4 py-3 text-[12.5px] text-brand-mute">
                  Paid via{" "}
                  <span className="font-mono uppercase text-brand-ink">
                    {booking.payment_method}
                  </span>
                </div>
              ) : null}
            </div>
          </section>

          {/* REFUND HISTORY */}
          {refunds && refunds.length > 0 ? (
            <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="border-b border-brand-line px-6 py-4">
                <div className="font-display text-[15px] font-bold text-brand-ink">
                  Refund history
                </div>
              </div>
              <ul className="divide-y divide-brand-line">
                {refunds.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between px-6 py-3 text-[13px]"
                  >
                    <span className="font-medium capitalize text-brand-ink">
                      {r.status}
                    </span>
                    <span className="num text-brand-mute">
                      {formatMoney(
                        Number(r.approved_amount ?? r.requested_amount),
                        r.currency,
                      )}{" "}
                      · {new Date(r.created_at).toLocaleDateString("en-ZA")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {/* RIGHT RAIL */}
        <div className="space-y-6">
          <div className="space-y-6 xl:sticky xl:top-[88px]">
            {/* COUNTDOWN / STATUS */}
            {!isCancelled ? (
              <section className="overflow-hidden rounded-card bg-brand-gradient-dark text-white shadow-lg">
                <div className="flex items-center gap-3 px-5 pt-5">
                  <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-pill bg-brand-primary leading-none text-white">
                    <span className="num font-display text-[18px] font-extrabold">
                      {daysToGo != null && daysToGo > 0 ? daysToGo : "—"}
                    </span>
                    <span className="text-[8.5px] uppercase tracking-wider opacity-90">
                      days
                    </span>
                  </div>
                  <div>
                    <div className="text-[13.5px] font-semibold">
                      {isLive ? "Your stay is confirmed" : statusMeta.label}
                    </div>
                    <div className="text-[12px] text-brand-accent/75">
                      Check-in {fmtLong(booking.check_in)}
                    </div>
                  </div>
                </div>
                <div className="mt-4 px-5">
                  <div className="flex items-center justify-between text-[10.5px] text-white/45">
                    <span>Booked</span>
                    <span>Arrive</span>
                    <span>Check-out</span>
                  </div>
                  <div className="relative mt-2 h-1.5 rounded-pill bg-white/15">
                    <div
                      className="absolute left-0 top-0 h-full rounded-pill bg-brand-primary"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 divide-x divide-white/10 border-t border-white/10">
                  <div className="px-5 py-3.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/45">
                      Dates
                    </div>
                    <div className="num mt-1 text-[13px] font-semibold">
                      {fmtDay(booking.check_in)} – {fmtDay(booking.check_out)}
                    </div>
                  </div>
                  <div className="px-5 py-3.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/45">
                      Total
                    </div>
                    <div className="num mt-1 text-[13px] font-semibold">
                      {formatMoney(Number(booking.total_amount), currency)}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {/* HOST CARD */}
            {host ? (
              <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
                <div className="border-b border-brand-line px-5 py-3.5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-mute">
                    Your host
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-3.5">
                    <div className="relative shrink-0">
                      <span className="block h-16 w-16 overflow-hidden rounded-pill ring-2 ring-brand-accent">
                        {host.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={host.avatar_url}
                            alt={host.display_name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center bg-brand-gradient text-lg font-bold text-white">
                            {host.display_name.slice(0, 1)}
                          </span>
                        )}
                      </span>
                      {host.is_superhost ? (
                        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-brand-primary text-white">
                          <BadgeCheck className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="font-display text-[16px] font-bold text-brand-ink">
                        {host.display_name}
                      </div>
                      <div className="inline-flex items-center gap-1.5 text-[12px] font-medium text-brand-secondary">
                        <Award className="h-3.5 w-3.5 text-brand-primary" />
                        {host.is_superhost ? "Superhost" : "Host"}
                        {memberSince ? ` · since ${memberSince}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <Stat
                      value={
                        host.avg_rating != null
                          ? host.avg_rating.toFixed(1)
                          : "—"
                      }
                      label="rating"
                    />
                    <Stat
                      value={
                        host.response_rate != null
                          ? `${Math.round(host.response_rate)}%`
                          : "—"
                      }
                      label="responds"
                    />
                    <Stat value={String(hostReviewCount)} label="reviews" />
                  </div>
                  {host.languages_spoken && host.languages_spoken.length > 0 ? (
                    <div className="mt-3 flex items-center gap-1.5 text-[12px] text-brand-mute">
                      <Languages className="h-3.5 w-3.5" /> Speaks{" "}
                      {host.languages_spoken.join(" & ")}
                    </div>
                  ) : null}
                  <Link
                    href="/portal/inbox"
                    className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-brand-primary px-3 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-brand-secondary"
                  >
                    <MessageSquare className="h-4 w-4" /> Message{" "}
                    {hostFirstName}
                  </Link>
                </div>
              </section>
            ) : null}

            {/* MANAGE BOOKING */}
            <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="border-b border-brand-line px-5 py-3.5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-mute">
                  Manage booking
                </div>
              </div>
              <div className="divide-y divide-brand-line">
                <Link
                  href="/portal/inbox"
                  className="flex w-full items-center gap-3 px-5 py-3 text-left text-[13px] text-brand-ink transition hover:bg-brand-light/60"
                >
                  <MessageSquare className="h-4 w-4 text-brand-mute" />
                  <span className="flex-1">Change dates or guests</span>
                  <ChevronRight className="h-4 w-4 text-brand-mute" />
                </Link>
                <Link
                  href="/help"
                  className="flex w-full items-center gap-3 px-5 py-3 text-left text-[13px] text-brand-ink transition hover:bg-brand-light/60"
                >
                  <LifeBuoy className="h-4 w-4 text-brand-mute" />
                  <span className="flex-1">Get help</span>
                  <ChevronRight className="h-4 w-4 text-brand-mute" />
                </Link>
              </div>
              {canRequestRefund || canCancel ? (
                <div className="space-y-2 border-t border-brand-line p-4">
                  {canRequestRefund ? (
                    <RequestRefundButton
                      bookingId={booking.id}
                      totalAmount={Number(booking.total_amount)}
                      currency={currency}
                    />
                  ) : booking.has_open_refund ? (
                    <p className="rounded-[10px] bg-brand-light px-3 py-2 text-[12px] text-brand-mute">
                      A refund request is currently in progress.
                    </p>
                  ) : null}
                  {canCancel ? (
                    <CancelTripButton
                      bookingId={booking.id}
                      currency={currency}
                    />
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── presentational sub-components ───────────────────────────────
function Glance({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string | null;
  accent?: boolean;
}) {
  return (
    <div className="p-5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-mute">
        {label}
      </div>
      <div className="num mt-1.5 font-display text-[17px] font-bold leading-none text-brand-ink">
        {value}
      </div>
      {sub ? (
        <div
          className={`num mt-1.5 inline-flex items-center gap-1 text-[12px] ${
            accent ? "font-medium text-status-confirmed" : "text-brand-mute"
          }`}
        >
          {accent ? <CheckCircle2 className="h-3 w-3" /> : null}
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function AccessRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-6 py-3.5">
      <span className="inline-flex items-center gap-2.5 text-[13px] text-brand-ink">
        {icon} {label}
      </span>
      {value}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[10px] bg-brand-light px-2 py-2.5">
      <div className="num font-display text-[15px] font-bold text-brand-ink">
        {value}
      </div>
      <div className="text-[10px] text-brand-mute">{label}</div>
    </div>
  );
}
