import type { Metadata } from "next";
import {
  ArrowRight,
  CalendarDays,
  FileText,
  MapPin,
  MessageSquare,
  RotateCcw,
  Star,
} from "lucide-react";
import { Link } from "@/i18n/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Portal",
};

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type Photo = { url: string | null; sort_order: number };

// Lowest sort_order photo → the listing's cover image.
function coverOf(
  listing:
    | { photos?: Photo[] | null }
    | { photos?: Photo[] | null }[]
    | null
    | undefined,
): string | null {
  const l = Array.isArray(listing) ? listing[0] : listing;
  const photos = [...(l?.photos ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  return photos.find((p) => p.url)?.url ?? null;
}

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function daysBetween(fromIso: string, toIso: string | null): number | null {
  if (!toIso) return null;
  const ms =
    new Date(`${toIso}T00:00:00`).getTime() -
    new Date(`${fromIso}T00:00:00`).getTime();
  return Math.round(ms / 86_400_000);
}

export default async function PortalOverviewPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Layout already gates auth; this is just for the typed user.id.
  if (!user) return null;

  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: profile },
    { data: nextTrip },
    { count: tripCount },
    { count: unreadCount },
    { data: reviewEligibleRows },
    { data: reviewedRows },
    { data: pastStays },
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("bookings")
      .select(
        "id, reference, status, payment_status, balance_due, check_in, check_out, session_date, listing:properties(name, city, province, photos:property_photos(url, sort_order))",
      )
      .eq("guest_id", user.id)
      .is("deleted_at", null)
      .in("status", ["confirmed", "checked_in", "pending", "pending_eft"])
      .gte("check_in", today)
      .order("check_in", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("guest_id", user.id)
      .is("deleted_at", null),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("guest_id", user.id)
      .gt("unread_guest", 0),
    // Review-eligible stays — MUST match /portal/reviews' "To write" rule:
    // completed + paid (settled/refunded) + not-yet-reviewed. We subtract the
    // already-written reviews below so the KPI and the Reviews page agree.
    supabase
      .from("bookings")
      .select("id")
      .eq("guest_id", user.id)
      .is("deleted_at", null)
      .eq("status", "completed")
      .in("payment_status", ["completed", "partially_refunded", "refunded"]),
    supabase.from("reviews").select("booking_id").eq("guest_id", user.id),
    // Recent completed stays → "Book again" quick links.
    supabase
      .from("bookings")
      .select(
        "id, guests_count, listing:properties(name, slug, city, province, photos:property_photos(url, sort_order))",
      )
      .eq("guest_id", user.id)
      .is("deleted_at", null)
      .in("status", ["completed", "checked_out"])
      .order("check_out", { ascending: false })
      .limit(3),
  ]);

  // "Reviews to write" = eligible stays minus ones already reviewed — the exact
  // same count the /portal/reviews page shows under "To write".
  const reviewedBookingIds = new Set(
    (reviewedRows ?? []).map((r) => r.booking_id),
  );
  const pendingReviewCount = (reviewEligibleRows ?? []).filter(
    (b) => !reviewedBookingIds.has(b.id),
  ).length;

  // Quotes awaiting the guest's reply — the most time-sensitive action. Matched
  // by guest_id OR email (host-created quotes are email-only until accepted) via
  // the admin client, mirroring the quotes list. Only live, unexpired "sent".
  const email = (user.email ?? "").trim().toLowerCase();
  const nowIso = new Date().toISOString();
  const { count: openQuoteCount } = await createAdminClient()
    .from("quotes")
    .select("id", { count: "exact", head: true })
    .or(`guest_id.eq.${user.id},guest_email.ilike.${email}`)
    .eq("status", "sent")
    .is("deleted_at", null)
    .or(`valid_until.is.null,valid_until.gt.${nowIso}`);

  const firstName = (profile?.full_name ?? "there").split(" ")[0];
  const greeting = greetingFor(new Date().getHours());
  const trip = nextTrip as {
    id: string;
    reference: string;
    status: string;
    payment_status: string | null;
    balance_due: number | null;
    check_in: string | null;
    check_out: string | null;
    session_date: string | null;
    listing:
      | {
          name: string;
          city: string | null;
          province: string | null;
          photos?: Photo[] | null;
        }
      | {
          name: string;
          city: string | null;
          province: string | null;
          photos?: Photo[] | null;
        }[]
      | null;
  } | null;
  const tripListing = Array.isArray(trip?.listing)
    ? trip?.listing[0]
    : trip?.listing;
  const tripCover = coverOf(trip?.listing);
  const tripDaysToGo = trip
    ? daysBetween(today, trip.session_date ?? trip.check_in)
    : null;
  const tripLocation = [tripListing?.city, tripListing?.province]
    .filter(Boolean)
    .join(", ");

  // Does the guest still owe money on this trip? (EFT awaiting their transfer,
  // or an unpaid pending booking, or a remaining balance.) Drives a correct
  // status pill + a pay prompt — never the misleading raw "pending eft".
  const tripOwes =
    trip != null &&
    trip.status !== "cancelled" &&
    trip.payment_status !== "refunded" &&
    trip.payment_status !== "partially_refunded" &&
    (trip.status === "pending_eft" ||
      (trip.status === "pending" &&
        trip.payment_status !== "completed" &&
        trip.payment_status !== "captured") ||
      Number(trip.balance_due ?? 0) > 0);
  const tripStatusLabel = !trip
    ? ""
    : tripOwes
      ? "Payment needed"
      : trip.status === "pending"
        ? "Awaiting host"
        : trip.status === "checked_in"
          ? "Checked in"
          : "Confirmed";

  // Dedupe recent completed stays by slug → "Book again" quick links.
  const rebookSeen = new Set<string>();
  const rebookStays = (
    (pastStays as
      | {
          id: string;
          guests_count: number;
          listing:
            | {
                name: string;
                slug: string | null;
                city: string | null;
                province: string | null;
                photos?: Photo[] | null;
              }
            | {
                name: string;
                slug: string | null;
                city: string | null;
                province: string | null;
                photos?: Photo[] | null;
              }[]
            | null;
        }[]
      | null) ?? []
  )
    .map((b) => {
      const l = Array.isArray(b.listing) ? b.listing[0] : b.listing;
      return l?.slug
        ? {
            name: l.name,
            slug: l.slug,
            guests: b.guests_count,
            cover: coverOf(b.listing),
            location: [l.city, l.province].filter(Boolean).join(", "),
          }
        : null;
    })
    .filter(
      (
        s,
      ): s is {
        name: string;
        slug: string;
        guests: number;
        cover: string | null;
        location: string;
      } => {
        if (!s || rebookSeen.has(s.slug)) return false;
        rebookSeen.add(s.slug);
        return true;
      },
    );

  return (
    <div>
      {/* Hero greeting — a warm gradient band instead of a flat header. */}
      <header className="relative mb-6 overflow-hidden rounded-card border border-brand-line bg-gradient-to-br from-brand-primary via-brand-secondary to-brand-secondary p-6 text-white shadow-card sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-16 right-16 h-40 w-40 rounded-full bg-white/10 blur-2xl"
        />
        <div className="relative">
          <p className="text-[12.5px] font-medium uppercase tracking-wider text-white/80">
            {greeting}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {firstName} 👋
          </h1>
          <p className="mt-2 max-w-md text-sm text-white/85">
            Your stays, conversations and reviews — all in one place.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/portal/browse"
              className="inline-flex items-center gap-1.5 rounded-pill bg-white px-4 py-2 text-[13px] font-semibold text-brand-primary transition hover:bg-white/90"
            >
              Find a stay <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/portal/trips"
              className="inline-flex items-center gap-1.5 rounded-pill border border-white/40 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-white/10"
            >
              My trips
            </Link>
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<FileText className="h-4 w-4" />}
          label="Quotes to review"
          value={String(openQuoteCount ?? 0)}
          href="/portal/quotes"
          tone="violet"
          highlight={(openQuoteCount ?? 0) > 0}
        />
        <StatCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="Total trips"
          value={String(tripCount ?? 0)}
          href="/portal/trips"
          tone="brand"
        />
        <StatCard
          icon={<MessageSquare className="h-4 w-4" />}
          label="Unread messages"
          value={String(unreadCount ?? 0)}
          href="/portal/inbox"
          tone="sky"
          highlight={(unreadCount ?? 0) > 0}
        />
        <StatCard
          icon={<Star className="h-4 w-4" />}
          label="Reviews to write"
          value={String(pendingReviewCount ?? 0)}
          href="/portal/reviews"
          tone="amber"
          highlight={pendingReviewCount > 0}
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold text-brand-ink">
          Up next
        </h2>
        {trip ? (
          <Link
            href={`/portal/trips/${trip.id}`}
            className="group block overflow-hidden rounded-card border border-brand-line bg-white shadow-card transition hover:border-brand-primary/40 hover:shadow-lift"
          >
            <div className="flex flex-col sm:flex-row">
              <div className="relative h-44 w-full shrink-0 overflow-hidden bg-brand-light sm:h-auto sm:w-64">
                {tripCover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tripCover}
                    alt={tripListing?.name ?? "Your stay"}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <CalendarDays className="h-8 w-8 text-brand-line" />
                  </div>
                )}
                {tripDaysToGo != null && tripDaysToGo >= 0 ? (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-pill bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                    <MapPin className="h-3 w-3" />
                    {tripDaysToGo === 0
                      ? "Today"
                      : `${tripDaysToGo} day${tripDaysToGo === 1 ? "" : "s"} to go`}
                  </span>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <div
                    className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                      tripOwes
                        ? "bg-amber-100 text-amber-800"
                        : trip.status === "pending"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-brand-accent text-brand-secondary"
                    }`}
                  >
                    {tripStatusLabel}
                  </div>
                  <div className="mt-2 font-display text-lg font-semibold text-brand-ink">
                    {tripListing?.name ?? "Your stay"}
                  </div>
                  {tripLocation ? (
                    <div className="mt-0.5 inline-flex items-center gap-1 text-[12.5px] text-brand-mute">
                      <MapPin className="h-3.5 w-3.5 text-brand-primary" />
                      {tripLocation}
                    </div>
                  ) : null}
                  <div className="mt-1.5 text-sm text-brand-mute">
                    {trip.session_date
                      ? `Session: ${fmtDate(trip.session_date)}`
                      : `${fmtDate(trip.check_in)} → ${fmtDate(trip.check_out)}`}
                  </div>
                  {tripOwes ? (
                    <div className="mt-1.5 text-[12.5px] font-medium text-amber-700">
                      Complete your payment to confirm →
                    </div>
                  ) : null}
                  <div className="mt-1 font-mono text-xs text-brand-mute">
                    {trip.reference}
                  </div>
                </div>
                <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-brand-mute transition group-hover:translate-x-0.5 group-hover:text-brand-primary" />
              </div>
            </div>
          </Link>
        ) : (
          <div className="rounded-card border border-dashed border-brand-line bg-white p-6 text-center">
            <p className="font-display text-base font-semibold text-brand-ink">
              No upcoming trips yet
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
              Browse the directory to find your next stay.
            </p>
            <Link
              href="/portal/browse"
              className="mt-4 inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary"
            >
              Browse stays
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </section>

      {rebookStays.length > 0 ? (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-brand-ink">
              Book again
            </h2>
            <Link
              href="/portal/browse"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-primary hover:text-brand-secondary"
            >
              Browse all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rebookStays.map((s) => (
              <Link
                key={s.slug}
                href={`/property/${s.slug}/book?guests=${s.guests}`}
                className="group overflow-hidden rounded-card border border-brand-line bg-white shadow-card transition hover:border-brand-primary/40 hover:shadow-lift"
              >
                <div className="relative h-32 w-full overflow-hidden bg-brand-light">
                  {s.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.cover}
                      alt={s.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <RotateCcw className="h-6 w-6 text-brand-line" />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="truncate font-display font-semibold text-brand-ink">
                      {s.name}
                    </div>
                    <div className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-brand-mute">
                      <RotateCcw className="h-3.5 w-3.5" /> Book this stay again
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-brand-mute transition group-hover:translate-x-0.5 group-hover:text-brand-primary" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

const STAT_TONE: Record<string, { chip: string }> = {
  brand: { chip: "bg-brand-accent text-brand-primary" },
  violet: { chip: "bg-violet-100 text-violet-600" },
  sky: { chip: "bg-sky-100 text-sky-600" },
  amber: { chip: "bg-amber-100 text-amber-600" },
};

function StatCard({
  icon,
  label,
  value,
  href,
  tone = "brand",
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
  tone?: "brand" | "violet" | "sky" | "amber";
  // Draws attention when there's something waiting (e.g. quotes to review).
  highlight?: boolean;
}) {
  const chip = (STAT_TONE[tone] ?? STAT_TONE.brand).chip;
  return (
    <Link
      href={href}
      className={`group rounded-card border p-5 transition hover:-translate-y-0.5 hover:shadow-lift ${
        highlight
          ? "border-brand-primary/40 bg-brand-accent/20 hover:border-brand-primary/60"
          : "border-brand-line bg-white hover:border-brand-primary/40"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${chip}`}
        >
          {icon}
        </span>
        {highlight ? (
          <span className="h-2 w-2 rounded-full bg-brand-primary" />
        ) : null}
      </div>
      <div className="mt-3 font-display text-3xl font-bold text-brand-ink">
        {value}
      </div>
      <div className="mt-0.5 text-[11.5px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </div>
    </Link>
  );
}
