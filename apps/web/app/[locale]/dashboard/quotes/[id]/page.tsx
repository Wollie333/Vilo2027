import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";

import {
  BedDouble,
  CalendarCheck,
  CheckCheck,
  Check,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Eye,
  Hourglass,
  Inbox,
  MessageSquare,
  Pencil,
  Send,
  Sparkles,
  Tag,
  User,
  Zap,
} from "lucide-react";

import { getBrandName } from "@/lib/brand";
import { formatMoney } from "@/lib/format";
import { getMyHostId } from "@/lib/host/current";
import { createServerClient } from "@/lib/supabase/server";

import { QuoteActions } from "./QuoteActions";
import { QuoteShare } from "./QuoteShare";
import { QuoteInternalNotes, type QuoteNote } from "./QuoteInternalNotes";
import { QUOTE_STATUS_LABEL, type QuoteStatus } from "../schemas";

export const metadata: Metadata = {
  title: "Quote",
};

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<QuoteStatus, string> = {
  draft: "bg-brand-line/60 text-brand-mute ring-brand-line",
  sent: "bg-status-pending/12 text-status-pending ring-status-pending/25",
  accepted:
    "bg-status-confirmed/12 text-status-confirmed ring-status-confirmed/25",
  declined:
    "bg-status-cancelled/12 text-status-cancelled ring-status-cancelled/25",
  expired: "bg-brand-light text-brand-mute ring-brand-line",
  converted: "bg-brand-accent text-brand-secondary ring-brand-primary/25",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
}

function fmtDayName(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function nightsBetween(ci: string | null, co: string | null): number | null {
  if (!ci || !co) return null;
  const f = new Date(`${ci}T00:00:00Z`).getTime();
  const t = new Date(`${co}T00:00:00Z`).getTime();
  const n = Math.round((t - f) / 86_400_000);
  return n > 0 ? n : null;
}

function initialsOf(name: string | null): string {
  if (!name) return "H";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "H";
}

export default async function QuoteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const brandName = await getBrandName();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/quotes/${params.id}`);

  const myHostId = await getMyHostId(supabase);
  if (!myHostId) notFound();

  const { data: quote } = await supabase
    .from("quotes")
    .select(
      `
      id, quote_number, status,
      guest_name, guest_email, guest_phone,
      check_in, check_out, headcount, scope,
      base_amount, cleaning_fee, addons_total, total_amount, currency,
      discount_type, discount_value, discount_amount, discount_reason,
      deposit_amount,
      notes, accept_token, valid_until,
      sent_at, accepted_at, declined_at, converted_at, converted_booking_id,
      created_at,
      listing:properties ( id, name, slug, city, province, property_photos ( url, sort_order ) )
    `,
    )
    .eq("id", params.id)
    .eq("host_id", myHostId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!quote) notFound();

  const [
    { data: addons },
    { data: roomLines },
    { data: versions },
    viewEventsRes,
    { data: noteRows },
  ] = await Promise.all([
    supabase
      .from("quote_addons")
      .select(
        "addon_id, label, quantity, unit_price, subtotal, addon:addons ( description, image_path )",
      )
      .eq("quote_id", params.id)
      .order("sort_order"),
    supabase
      .from("quote_rooms")
      .select(
        "room_id, base_amount, cleaning_fee, room:property_rooms ( name, description, bed_type, room_size_sqm, max_guests, featured_photo:property_photos!listing_rooms_featured_photo_id_fkey ( url ) )",
      )
      .eq("quote_id", params.id),
    supabase
      .from("quote_versions")
      .select("id, version_no, total_amount, currency, created_at")
      .eq("quote_id", params.id)
      .order("version_no", { ascending: false }),
    supabase
      .from("quote_view_events")
      .select("id, device, opened_at", { count: "exact" })
      .eq("quote_id", params.id)
      .order("opened_at", { ascending: false })
      .limit(20),
    supabase
      .from("quote_notes")
      .select("id, body, created_at, author:user_profiles ( full_name )")
      .eq("quote_id", params.id)
      .order("created_at", { ascending: true }),
  ]);

  const firstOf = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

  const richRooms = (roomLines ?? []).map((r) => {
    const room = firstOf(
      r.room as unknown as {
        name: string;
        description: string | null;
        bed_type: string | null;
        room_size_sqm: number | null;
        max_guests: number | null;
        featured_photo: { url: string } | { url: string }[] | null;
      } | null,
    );
    const photo = firstOf(room?.featured_photo ?? null);
    return {
      name: room?.name ?? "Room",
      description: room?.description ?? null,
      bedType: room?.bed_type ?? null,
      sizeSqm: room?.room_size_sqm ?? null,
      maxGuests: room?.max_guests ?? null,
      imageUrl: photo?.url ?? null,
    };
  });

  // Per-room price lines (rooms scope) so the breakdown mirrors the sent quote
  // exactly — one line per booked room, plus their combined cleaning fee.
  const roomBreakdown = (roomLines ?? []).map((r) => {
    const room = firstOf(r.room as unknown as { name: string } | null);
    return {
      name: room?.name ?? "Room",
      base: Number(r.base_amount ?? 0),
      cleaning: Number(r.cleaning_fee ?? 0),
    };
  });
  const roomsScope = quote.scope === "rooms" && roomBreakdown.length > 0;
  const roomCleaning = roomBreakdown.reduce((s, r) => s + r.cleaning, 0);
  const discountAmount = Number(quote.discount_amount ?? 0);

  const status = quote.status as QuoteStatus;
  const tone = STATUS_TONE[status];

  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const acceptUrl = `${proto}://${host}/q/${quote.id}/${quote.accept_token}`;

  const listing = firstOf(
    quote.listing as unknown as {
      id: string;
      name: string;
      slug: string | null;
      city: string | null;
      province: string | null;
      property_photos: { url: string | null; sort_order: number }[] | null;
    } | null,
  );
  const listingName = listing?.name;
  const coverPhoto =
    richRooms.find((r) => r.imageUrl)?.imageUrl ??
    (listing?.property_photos ?? [])
      .filter((p) => p.url)
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)[0]?.url ??
    null;

  // Open tracking is derived from quote_view_events (the source of truth).
  const viewEvents = viewEventsRes.data ?? [];
  const views = viewEventsRes.count ?? 0;

  const nights = nightsBetween(quote.check_in, quote.check_out);
  const lastViewed = viewEvents.length > 0 ? viewEvents[0] : null;

  // Expiry
  const now = Date.now();
  const validMs = quote.valid_until
    ? new Date(quote.valid_until).getTime()
    : null;
  const expired = validMs != null && validMs < now;
  const daysLeft =
    validMs != null ? Math.ceil((validMs - now) / 86_400_000) : null;

  // Payout: Wielo takes 0% commission — the host keeps the full quote total.
  // (Gateway processing fees, if any, are deducted by the host's own provider.)
  const payout = Number(quote.total_amount);

  // Status stepper — how far the quote has progressed.
  const reached = {
    created: true,
    sent: Boolean(quote.sent_at) || status !== "draft",
    viewed: views > 0,
    accepted: Boolean(quote.accepted_at) || Boolean(quote.converted_at),
    booked: Boolean(quote.converted_at),
  };
  const steps = [
    { key: "created", label: "Created", icon: Check, date: quote.created_at },
    { key: "sent", label: "Sent", icon: Send, date: quote.sent_at },
    { key: "viewed", label: "Viewed", icon: Eye, date: lastViewed?.opened_at },
    {
      key: "accepted",
      label: "Accepted",
      icon: CheckCheck,
      date: quote.accepted_at,
    },
    {
      key: "booked",
      label: "Booked",
      icon: CalendarCheck,
      date: quote.converted_at,
    },
  ] as const;
  const reachedFlags = steps.map((s) => reached[s.key as keyof typeof reached]);
  const reachedIndex = reachedFlags.lastIndexOf(true);

  // Activity timeline (newest first) from real timestamps + view events.
  type Activity = {
    title: string;
    sub: string | null;
    ts: string;
    tone: string;
  };
  const activity: Activity[] = [];
  activity.push({
    title: "Quote created",
    sub: "Drafted in your dashboard",
    ts: quote.created_at,
    tone: "bg-brand-mute",
  });
  if (quote.sent_at)
    activity.push({
      title: "Quote sent",
      sub: `Delivered to ${quote.guest_email}`,
      ts: quote.sent_at,
      tone: "bg-brand-primary",
    });
  (viewEvents ?? []).forEach((v, i) => {
    activity.push({
      title: `${quote.guest_name} opened the quote`,
      sub: `${views - i}${ordinal(views - i)} view${v.device ? ` · ${v.device}` : ""}`,
      ts: v.opened_at,
      tone: "bg-status-pending",
    });
  });
  if (quote.accepted_at)
    activity.push({
      title: "Quote accepted",
      sub: null,
      ts: quote.accepted_at,
      tone: "bg-status-confirmed",
    });
  if (quote.declined_at)
    activity.push({
      title: "Quote declined",
      sub: null,
      ts: quote.declined_at,
      tone: "bg-status-cancelled",
    });
  if (quote.converted_at)
    activity.push({
      title: "Converted to booking",
      sub: null,
      ts: quote.converted_at,
      tone: "bg-brand-primary",
    });
  activity.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  const notes: QuoteNote[] = (noteRows ?? []).map((n) => {
    const author = firstOf(
      n.author as unknown as { full_name: string | null } | null,
    );
    return {
      id: n.id,
      body: n.body,
      created_at: n.created_at,
      authorName: author?.full_name ?? "You",
      authorInitials: initialsOf(author?.full_name ?? null),
    };
  });

  const sentLabel = quote.sent_at
    ? new Date(quote.sent_at).toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-6">
      {/* ===== BREADCRUMB / BACK ===== */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/quotes"
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-brand-ink hover:bg-brand-light/60"
        >
          <ChevronRight className="h-3.5 w-3.5 rotate-180" /> All quotes
        </Link>
        <div className="hidden items-center gap-2 text-[12.5px] md:flex">
          <ChevronRight className="h-3 w-3 text-brand-line" />
          <span className="num font-semibold text-brand-ink">
            {quote.quote_number}
          </span>
        </div>
      </div>

      {/* ===== HEADER CARD ===== */}
      <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between lg:p-7">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-mute">
              {QUOTE_STATUS_LABEL[status]}
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2">
              <h1 className="num font-display text-[38px] font-extrabold leading-none tracking-tight text-brand-ink lg:text-[44px]">
                {formatMoney(quote.total_amount, quote.currency)}
              </h1>
              <span
                className={`mb-1 inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11.5px] font-semibold ring-1 ${tone}`}
              >
                {status === "sent" ? (
                  <span className="pulse-soft h-1.5 w-1.5 rounded-full bg-status-pending" />
                ) : null}
                {QUOTE_STATUS_LABEL[status]}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-brand-mute">
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> {quote.guest_name}
              </span>
              <span className="h-1 w-1 rounded-full bg-brand-line" />
              <span className="inline-flex items-center gap-1.5">
                <BedDouble className="h-3.5 w-3.5" /> {listingName ?? "—"}
              </span>
              {sentLabel ? (
                <>
                  <span className="h-1 w-1 rounded-full bg-brand-line" />
                  <span>Sent {sentLabel}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {status === "draft" || status === "sent" ? (
              <Link
                href={`/dashboard/quotes/${quote.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3.5 py-2.5 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light/60"
              >
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            ) : null}
            <Link
              href={`/quote/${quote.id}/pdf`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3.5 py-2.5 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light/60"
            >
              <Download className="h-4 w-4" /> PDF
            </Link>
            {quote.converted_booking_id ? (
              <Link
                href={`/dashboard/bookings/${quote.converted_booking_id}`}
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-3.5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-secondary"
              >
                View booking <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        </div>

        {/* key facts strip */}
        <div className="grid grid-cols-2 divide-x divide-brand-line border-t border-brand-line sm:grid-cols-4">
          <Fact label="Reference" value={quote.quote_number} mono />
          <Fact
            label="Opened"
            value={
              views === 0 ? "Not yet" : `${views} time${views === 1 ? "" : "s"}`
            }
          />
          <Fact
            label="Expires"
            value={
              quote.valid_until
                ? `${fmtDate(quote.valid_until)}${
                    daysLeft != null && daysLeft >= 0
                      ? ` · ${daysLeft}d`
                      : expired
                        ? " · expired"
                        : ""
                  }`
                : "No expiry"
            }
            tone={expired ? "text-status-cancelled" : undefined}
          />
          <Fact
            label="Your payout"
            value={formatMoney(payout, quote.currency)}
          />
        </div>
      </section>

      {/* ===== TWO-COLUMN GRID ===== */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_350px]">
        {/* LEFT */}
        <div className="min-w-0 space-y-6">
          {/* STATUS STEPPER */}
          <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-brand-line px-6 py-4">
              <div>
                <div className="font-display text-[15px] font-bold text-brand-ink">
                  Quote status
                </div>
                <div className="mt-0.5 text-[12px] text-brand-mute">
                  {statusSubtitle(status, views)}
                </div>
              </div>
              {quote.valid_until && !expired && daysLeft != null ? (
                <span className="bg-status-pending/12 inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11.5px] font-semibold text-status-pending ring-1 ring-status-pending/20">
                  <Clock className="h-3.5 w-3.5" /> Expires in {daysLeft}d
                </span>
              ) : null}
            </div>
            <div className="px-6 pb-2 pt-7">
              <div className="flex items-start">
                {steps.map((s, i) => {
                  const done = reachedFlags[i];
                  const isCurrent =
                    i === reachedIndex && status !== "converted";
                  const StepIcon = s.icon;
                  return (
                    <FragmentStep
                      key={s.key}
                      first={i === 0}
                      connectorSolid={i <= reachedIndex && i > 0}
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full ${
                          done
                            ? `bg-brand-primary text-white ${isCurrent ? "pulse-soft ring-4 ring-brand-primary/20" : ""}`
                            : "border-2 border-brand-line bg-white text-brand-mute"
                        }`}
                      >
                        <StepIcon className="h-4 w-4" />
                      </span>
                      <div
                        className={`mt-2 text-[11.5px] ${done ? "font-semibold text-brand-ink" : "font-medium text-brand-mute"}`}
                      >
                        {s.label}
                      </div>
                      <div className="num text-[10px] text-brand-mute">
                        {s.date ? fmtDate(s.date) : "—"}
                      </div>
                      {s.date ? (
                        <div className="num text-[9px] leading-tight text-brand-mute/70">
                          {fmtTime(s.date)}
                        </div>
                      ) : null}
                    </FragmentStep>
                  );
                })}
              </div>
            </div>
            {views > 0 && !reached.accepted ? (
              <div className="m-6 mt-4 flex items-center gap-3 rounded-[12px] bg-brand-accent/40 px-4 py-3">
                <Sparkles className="h-4 w-4 shrink-0 text-brand-primary" />
                <div className="flex-1 text-[12.5px] text-brand-secondary">
                  {quote.guest_name} opened your quote{" "}
                  {views === 1 ? "once" : `${views} times`}
                  {lastViewed
                    ? ` — last seen ${fmtDateTime(lastViewed.opened_at)}`
                    : ""}
                  . A friendly nudge often closes it.
                </div>
              </div>
            ) : null}
          </section>

          {/* THE STAY */}
          <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            <div className="border-b border-brand-line px-6 py-4">
              <div className="font-display text-[15px] font-bold text-brand-ink">
                The stay you&rsquo;re quoting
              </div>
            </div>
            <div className="p-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="h-20 w-28 shrink-0 overflow-hidden rounded-[12px] bg-brand-accent">
                  {coverPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverPhoto}
                      alt={listingName ?? "Listing"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-brand-secondary/60">
                      <BedDouble className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {listing?.slug ? (
                    <Link
                      href={`/property/${listing.slug}`}
                      target="_blank"
                      className="font-display text-[16px] font-bold text-brand-ink hover:text-brand-primary"
                    >
                      {listingName}
                      {richRooms[0] ? ` · ${richRooms[0].name}` : ""}
                    </Link>
                  ) : (
                    <div className="font-display text-[16px] font-bold text-brand-ink">
                      {listingName ?? "Listing"}
                      {richRooms[0] ? ` · ${richRooms[0].name}` : ""}
                    </div>
                  )}
                  <div className="mt-0.5 text-[12.5px] text-brand-mute">
                    {[listing?.city, listing?.province]
                      .filter(Boolean)
                      .join(", ") || "—"}
                    {richRooms[0]?.bedType ? ` · ${richRooms[0].bedType}` : ""}
                  </div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 divide-x divide-brand-line rounded-[12px] border border-brand-line sm:grid-cols-4">
                <StayFact label="Check-in" value={fmtDayName(quote.check_in)} />
                <StayFact
                  label="Check-out"
                  value={fmtDayName(quote.check_out)}
                />
                <StayFact
                  label="Nights"
                  value={nights != null ? String(nights) : "—"}
                />
                <StayFact label="Guests" value={String(quote.headcount)} />
              </div>
            </div>
          </section>

          {/* PRICE BREAKDOWN */}
          <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            <div className="border-b border-brand-line px-6 py-4">
              <div className="font-display text-[15px] font-bold text-brand-ink">
                What {quote.guest_name?.split(" ")[0] ?? "the guest"} sees
              </div>
              <div className="mt-0.5 text-[12px] text-brand-mute">
                The exact breakdown on the quote
              </div>
            </div>
            <div className="p-6">
              <ul className="space-y-3 text-[13.5px]">
                {roomsScope ? (
                  <>
                    {roomBreakdown.map((r, i) => (
                      <li
                        key={`room-${i}`}
                        className="flex items-center justify-between"
                      >
                        <span className="text-brand-mute">
                          {r.name}
                          {nights ? (
                            <span className="text-brand-mute/70">
                              {" "}
                              · {nights} night{nights === 1 ? "" : "s"}
                            </span>
                          ) : null}
                        </span>
                        <span className="num font-medium text-brand-ink">
                          {formatMoney(r.base, quote.currency)}
                        </span>
                      </li>
                    ))}
                    {roomCleaning > 0 ? (
                      <li className="flex items-center justify-between">
                        <span className="text-brand-mute">Cleaning fee</span>
                        <span className="num font-medium text-brand-ink">
                          {formatMoney(roomCleaning, quote.currency)}
                        </span>
                      </li>
                    ) : null}
                  </>
                ) : (
                  <>
                    <li className="flex items-center justify-between">
                      <span className="text-brand-mute">
                        {nights
                          ? `${formatMoney(Number(quote.base_amount) / nights, quote.currency)} × ${nights} night${nights === 1 ? "" : "s"}`
                          : "Accommodation"}
                      </span>
                      <span className="num font-medium text-brand-ink">
                        {formatMoney(quote.base_amount, quote.currency)}
                      </span>
                    </li>
                    {quote.cleaning_fee > 0 ? (
                      <li className="flex items-center justify-between">
                        <span className="text-brand-mute">Cleaning fee</span>
                        <span className="num font-medium text-brand-ink">
                          {formatMoney(quote.cleaning_fee, quote.currency)}
                        </span>
                      </li>
                    ) : null}
                  </>
                )}
                {(addons ?? []).map((a, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-brand-mute">
                      <Tag className="h-3.5 w-3.5" /> {a.label}
                      {a.quantity > 1 ? (
                        <span className="text-brand-mute/70">
                          × {a.quantity}
                        </span>
                      ) : null}
                    </span>
                    <span className="num font-medium text-brand-ink">
                      {formatMoney(a.subtotal, quote.currency)}
                    </span>
                  </li>
                ))}
                {discountAmount > 0 ? (
                  <li className="flex items-center justify-between text-brand-primary">
                    <span className="inline-flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" />
                      {quote.discount_reason?.trim() || "Discount"}
                      {quote.discount_type === "percent" &&
                      Number(quote.discount_value) > 0
                        ? ` · ${Number(quote.discount_value)}%`
                        : ""}
                    </span>
                    <span className="num font-medium">
                      −{formatMoney(discountAmount, quote.currency)}
                    </span>
                  </li>
                ) : null}
                <li className="flex items-center justify-between border-t border-brand-line pt-3">
                  <span className="font-semibold text-brand-ink">
                    Total guest pays
                  </span>
                  <span className="num font-display text-[18px] font-bold text-brand-ink">
                    {formatMoney(quote.total_amount, quote.currency)}
                  </span>
                </li>
                <li className="flex items-center justify-between rounded-[10px] bg-brand-accent/40 px-3 py-2.5">
                  <span className="font-semibold text-brand-secondary">
                    Your payout · {brandName} takes 0%
                  </span>
                  <span className="num font-display text-[16px] font-bold text-brand-secondary">
                    {formatMoney(payout, quote.currency)}
                  </span>
                </li>
              </ul>
              <div className="mt-4 flex items-center gap-2 rounded-[10px] bg-brand-light px-3 py-2.5 text-[11.5px] text-brand-mute">
                <Zap className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
                When {quote.guest_name?.split(" ")[0] ?? "the guest"} accepts
                and pays, this becomes a confirmed booking automatically — no
                extra step.
              </div>
            </div>
          </section>

          {/* MESSAGE TO GUEST */}
          {quote.notes ? (
            <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="border-b border-brand-line px-6 py-4">
                <div className="font-display text-[15px] font-bold text-brand-ink">
                  Your message to{" "}
                  {quote.guest_name?.split(" ")[0] ?? "the guest"}
                </div>
              </div>
              <div className="p-6">
                <div className="rounded-[12px] border border-brand-line bg-brand-light/50 p-4 text-[13.5px] leading-relaxed text-brand-ink">
                  {quote.notes}
                </div>
              </div>
            </section>
          ) : null}

          {/* ACTIVITY */}
          <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            <div className="border-b border-brand-line px-6 py-4">
              <div className="font-display text-[15px] font-bold text-brand-ink">
                Activity
              </div>
            </div>
            <div className="p-6">
              <ol className="relative space-y-5 border-l-2 border-brand-line pl-5">
                {activity.map((a, i) => (
                  <li key={i}>
                    <span
                      className={`absolute -left-[7px] mt-0.5 h-3 w-3 rounded-full border-2 border-white ${a.tone}`}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[13px] font-semibold text-brand-ink">
                        {a.title}
                      </div>
                      <div className="num shrink-0 text-[11px] text-brand-mute">
                        {fmtDateTime(a.ts)}
                      </div>
                    </div>
                    {a.sub ? (
                      <div className="text-[12px] text-brand-mute">{a.sub}</div>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* VERSION HISTORY */}
          {versions && versions.length > 0 ? (
            <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="border-b border-brand-line px-6 py-4">
                <div className="font-display text-[15px] font-bold text-brand-ink">
                  Version history
                </div>
                <div className="mt-0.5 text-[12px] text-brand-mute">
                  Each edit after sending keeps the previous version and its
                  PDF.
                </div>
              </div>
              <ul className="divide-y divide-brand-line">
                {versions.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between px-6 py-3 text-sm"
                  >
                    <div>
                      <span className="font-medium text-brand-ink">
                        Version {v.version_no}
                      </span>
                      <span className="num ml-2 text-xs text-brand-mute">
                        {fmtDateTime(v.created_at)} ·{" "}
                        {formatMoney(Number(v.total_amount), v.currency)}
                      </span>
                    </div>
                    <Link
                      href={`/quote/${quote.id}/pdf?v=${v.version_no}`}
                      target="_blank"
                      className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-2.5 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light"
                    >
                      <Download className="h-3.5 w-3.5" /> PDF
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {/* RIGHT RAIL */}
        <div className="space-y-6">
          <div className="space-y-6 xl:sticky xl:top-[88px]">
            {/* CONVERSION — dark brand moment */}
            <section className="overflow-hidden rounded-card bg-brand-gradient-dark text-white shadow-lg">
              <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3.5">
                <Hourglass className="h-4 w-4 text-status-pending" />
                <span className="text-[12px] font-semibold text-white/90">
                  {status === "converted"
                    ? "Converted to booking"
                    : status === "accepted"
                      ? "Accepted — ready to convert"
                      : status === "declined"
                        ? "Quote declined"
                        : expired
                          ? "Quote expired"
                          : "Awaiting acceptance"}
                </span>
                {daysLeft != null && daysLeft >= 0 && !expired ? (
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-brand-accent/70">
                    <Clock className="h-3 w-3" /> {daysLeft}d left
                  </span>
                ) : null}
              </div>
              <div className="px-5 py-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/50">
                  Quote value
                </div>
                <div className="num mt-1 font-display text-[30px] font-extrabold leading-none">
                  {formatMoney(quote.total_amount, quote.currency)}
                </div>
                <div className="mt-2 text-[12.5px] text-brand-accent/75">
                  Your payout{" "}
                  <span className="num font-semibold text-white">
                    {formatMoney(payout, quote.currency)}
                  </span>
                  {quote.valid_until
                    ? ` · expires ${fmtDate(quote.valid_until)}`
                    : ""}
                </div>
                {quote.sent_at && quote.valid_until ? (
                  <>
                    <div className="relative mt-4 h-1.5 rounded-pill bg-white/15">
                      <div
                        className="absolute left-0 top-0 h-full rounded-pill bg-status-pending"
                        style={{
                          width: `${expiryProgress(quote.sent_at, quote.valid_until, now)}%`,
                        }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[10.5px] text-white/45">
                      <span>Sent {fmtDate(quote.sent_at)}</span>
                      <span>Expires {fmtDate(quote.valid_until)}</span>
                    </div>
                  </>
                ) : null}
              </div>
            </section>

            {/* GUEST */}
            <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="border-b border-brand-line px-5 py-3.5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-mute">
                  Guest
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-brand-gradient text-sm font-bold text-white">
                  {initialsOf(quote.guest_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-brand-ink">
                    {quote.guest_name}
                  </div>
                  <div className="truncate text-[11.5px] text-brand-mute">
                    {quote.guest_email}
                  </div>
                  {quote.guest_phone ? (
                    <div className="truncate text-[11.5px] text-brand-mute">
                      {quote.guest_phone}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                <Link
                  href="/dashboard/inbox"
                  className="inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-brand-primary px-3 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-brand-secondary"
                >
                  <MessageSquare className="h-4 w-4" /> Message
                </Link>
                <Link
                  href="/dashboard/inbox"
                  className="inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-brand-line px-3 py-2.5 text-[12.5px] font-medium text-brand-ink transition hover:bg-brand-light"
                >
                  <Inbox className="h-4 w-4 text-brand-primary" /> Inbox
                </Link>
              </div>
            </section>

            {/* ACTIONS (state changes) */}
            <QuoteActions
              quoteId={quote.id}
              status={status}
              total={Number(quote.total_amount)}
              deposit={Number(quote.deposit_amount ?? 0)}
              currency={quote.currency}
            />

            {/* SHARE */}
            <QuoteShare
              quoteId={quote.id}
              acceptUrl={acceptUrl}
              guestName={quote.guest_name}
              guestEmail={quote.guest_email}
              guestPhone={quote.guest_phone}
              quoteNumber={quote.quote_number}
              listingName={listingName ?? "your stay"}
              total={quote.total_amount}
              currency={quote.currency}
            />

            {/* INTERNAL NOTES */}
            <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-mute">
                  Internal notes
                </div>
                <span className="inline-flex items-center rounded-pill bg-brand-light px-2 py-0.5 text-[10.5px] font-semibold text-brand-mute">
                  Host-only
                </span>
              </div>
              <QuoteInternalNotes quoteId={quote.id} notes={notes} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── helpers / presentational ────────────────────────────────────
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}

function statusSubtitle(status: QuoteStatus, views: number): string {
  switch (status) {
    case "draft":
      return "Not sent yet — send it to your guest when ready";
    case "sent":
      return views > 0
        ? "Seen by the guest — waiting on them to accept"
        : "Delivered — waiting on the guest to open it";
    case "accepted":
      return "Accepted — convert it to a confirmed booking";
    case "declined":
      return "The guest declined this quote";
    case "expired":
      return "This quote has expired";
    case "converted":
      return "Converted to a confirmed booking";
    default:
      return "";
  }
}

function expiryProgress(
  sentAt: string,
  validUntil: string,
  now: number,
): number {
  const s = new Date(sentAt).getTime();
  const e = new Date(validUntil).getTime();
  if (e <= s) return 100;
  return Math.max(0, Math.min(100, ((now - s) / (e - s)) * 100));
}

function Fact({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: string;
}) {
  return (
    <div className="px-6 py-3.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-mute">
        {label}
      </div>
      <div
        className={`num mt-1 text-[13px] font-bold ${mono ? "font-mono text-[12.5px]" : ""} ${tone ?? "text-brand-ink"}`}
      >
        {value}
      </div>
    </div>
  );
}

function StayFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-mute">
        {label}
      </div>
      <div className="num mt-1 font-display text-[14px] font-bold text-brand-ink">
        {value}
      </div>
    </div>
  );
}

function FragmentStep({
  children,
  first,
  connectorSolid,
}: {
  children: React.ReactNode;
  first: boolean;
  connectorSolid: boolean;
}) {
  return (
    <>
      {!first ? (
        <div
          className={`mt-[17px] h-[2px] flex-1 rounded-full ${
            connectorSolid
              ? "bg-brand-primary"
              : "border-t-2 border-dashed border-brand-line bg-transparent"
          }`}
        />
      ) : null}
      <div className="flex w-16 shrink-0 flex-col items-center text-center">
        {children}
      </div>
    </>
  );
}
