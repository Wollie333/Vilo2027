"use client";

import {
  ArrowRight,
  BadgeCheck,
  BedDouble,
  Calendar,
  Compass,
  MapPin,
  MessageSquare,
  Receipt,
  Search,
  Star,
  Users,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useMemo, useState } from "react";

export type TripStatus = "confirmed" | "pending" | "completed" | "cancelled";
export type TripBucket = "upcoming" | "past" | "cancelled";

export type Trip = {
  id: string;
  reference: string;
  status: TripStatus;
  bucket: TripBucket;
  featured: boolean;
  name: string;
  typeLabel: string;
  city: string | null;
  region: string | null;
  room: string;
  checkIn: string | null;
  checkOut: string | null;
  nights: number;
  guests: number;
  total: number;
  currency: string;
  refunded: number | null;
  reviewed: boolean;
  rating: number | null;
  hostName: string | null;
  hostAvatar: string | null;
  image: string | null;
  slug: string | null;
  detailHref: string;
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */
function formatZAR(n: number): string {
  return (
    "R " +
    Number(n)
      .toLocaleString("en-ZA", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
      .replace(/,/g, " ")
  );
}

function fmtRange(a: Date, b: Date): string {
  const sameMonth =
    a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const d = (x: Date, withYear: boolean) =>
    x.toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
    });
  if (sameMonth) return `${a.getDate()}–${d(b, true)}`;
  return `${d(a, false)} – ${d(b, true)}`;
}

function daysUntil(d: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function mapsHref(trip: Trip): string {
  const q = [trip.name, trip.city, trip.region].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

const STATUS_META: Record<
  TripStatus,
  { label: string; dot: string; text: string; bg: string }
> = {
  confirmed: {
    label: "Confirmed",
    dot: "#10B981",
    text: "text-brand-secondary",
    bg: "bg-brand-accent",
  },
  pending: {
    label: "Awaiting host",
    dot: "#F59E0B",
    text: "text-amber-700",
    bg: "bg-amber-50",
  },
  completed: {
    label: "Completed",
    dot: "#6366F1",
    text: "text-indigo-700",
    bg: "bg-indigo-50",
  },
  cancelled: {
    label: "Cancelled",
    dot: "#EF4444",
    text: "text-red-700",
    bg: "bg-red-50",
  },
};

/* -------------------------------------------------------------------------- */
/*  Photo                                                                      */
/* -------------------------------------------------------------------------- */
function Photo({
  src,
  alt,
  className,
  dimmed = false,
}: {
  src: string | null;
  alt: string;
  className?: string;
  dimmed?: boolean;
}) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-brand-accent text-brand-secondary ${className ?? ""}`}
      >
        <MapPin className="h-6 w-6 opacity-50" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`object-cover ${dimmed ? "opacity-80 grayscale" : ""} ${className ?? ""}`}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Featured next trip                                                         */
/* -------------------------------------------------------------------------- */
function FeaturedTrip({ trip }: { trip: Trip }) {
  const checkIn = trip.checkIn ? new Date(trip.checkIn) : null;
  const checkOut = trip.checkOut ? new Date(trip.checkOut) : null;
  const dToGo = checkIn ? daysUntil(checkIn) : null;

  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="grid md:grid-cols-[1.1fr_1fr]">
        {/* Image */}
        <div className="relative min-h-[230px] overflow-hidden md:min-h-[280px]">
          <Photo
            src={trip.image}
            alt={trip.name}
            className="absolute inset-0 h-full w-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/0 md:bg-gradient-to-r" />
          <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-pill bg-white/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-secondary shadow-card backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-pill bg-brand-primary" /> Next
            trip
          </span>
          <div className="absolute bottom-4 left-4 right-4 md:hidden">
            <div className="text-[11px] font-medium uppercase tracking-wider text-white/80">
              {trip.typeLabel}
              {trip.city ? ` · ${trip.city}` : ""}
            </div>
            <div className="font-display text-xl font-bold text-white">
              {trip.name}
            </div>
          </div>
        </div>

        {/* Detail */}
        <div className="flex flex-col p-5 sm:p-6">
          <div className="hidden md:block">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-brand-mute">
              <MapPin className="h-3 w-3" /> {trip.typeLabel}
              {trip.city ? ` · ${trip.city}` : ""}
              {trip.region ? `, ${trip.region}` : ""}
            </div>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-brand-ink">
              {trip.name}
            </h2>
          </div>

          {/* Countdown */}
          <div className="mt-1 flex items-center gap-3 md:mt-4">
            <div className="vilo-ring-pulse flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-pill bg-brand-primary leading-none text-white shadow-glow">
              <span className="num font-display text-lg font-extrabold">
                {dToGo != null ? Math.max(0, dToGo) : "–"}
              </span>
              <span className="text-[9px] uppercase tracking-wider opacity-90">
                days
              </span>
            </div>
            <div>
              <div className="text-sm font-semibold text-brand-ink">
                {trip.status === "pending"
                  ? "Awaiting host confirmation"
                  : "Your stay is confirmed"}
              </div>
              <div className="mt-0.5 text-xs text-brand-mute">
                {checkIn
                  ? `Check-in ${checkIn.toLocaleDateString("en-ZA", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}`
                  : "Dates to be confirmed"}
              </div>
            </div>
          </div>

          {/* Facts */}
          <div className="mt-5 grid grid-cols-3 gap-3 border-y border-brand-line py-4">
            {(
              [
                [
                  "Dates",
                  checkIn && checkOut ? fmtRange(checkIn, checkOut) : "—",
                ],
                ["Nights", `${trip.nights} · ${trip.guests} guests`],
                ["Room", trip.room],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <div className="text-[10px] font-medium uppercase tracking-wider text-brand-mute">
                  {k}
                </div>
                <div className="mt-1 text-sm font-semibold leading-tight text-brand-ink">
                  {v}
                </div>
              </div>
            ))}
          </div>

          {/* Host + ref */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Photo
                src={trip.hostAvatar}
                alt={trip.hostName ?? "Host"}
                className="h-8 w-8 shrink-0 rounded-pill"
              />
              <div className="min-w-0">
                <div className="text-xs text-brand-mute">Hosted by</div>
                <div className="inline-flex items-center gap-1 truncate text-sm font-medium text-brand-ink">
                  {trip.hostName ?? "Your host"}
                  <BadgeCheck className="h-3.5 w-3.5 text-brand-primary" />
                </div>
              </div>
            </div>
            <div className="shrink-0 font-mono text-[11px] text-brand-mute">
              {trip.reference}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Link
              href={trip.detailHref}
              className="inline-flex items-center gap-2 rounded bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-secondary"
            >
              View booking <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/portal/inbox"
              className="inline-flex items-center gap-2 rounded border border-brand-line px-4 py-2.5 text-sm font-medium text-brand-ink hover:bg-brand-light"
            >
              <MessageSquare className="h-4 w-4 text-brand-primary" /> Message
              host
            </Link>
            <a
              href={mapsHref(trip)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded border border-brand-line px-4 py-2.5 text-sm font-medium text-brand-ink hover:bg-brand-light"
            >
              <MapPin className="h-4 w-4 text-brand-primary" /> Directions
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Trip card                                                                  */
/* -------------------------------------------------------------------------- */
function StatusBadge({ status }: { status: TripStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill ${m.bg} ${m.text} px-2.5 py-1 text-[11px] font-semibold`}
    >
      <span
        className="h-1.5 w-1.5 rounded-pill"
        style={{ background: m.dot }}
      />
      {m.label}
    </span>
  );
}

function TripActions({ trip }: { trip: Trip }) {
  // Deep-link to the listing's checkout with the same party size prefilled;
  // dates are left blank for the guest to pick. Falls back to in-portal browse.
  const rebookHref = trip.slug
    ? `/property/${trip.slug}/book?guests=${trip.guests}`
    : "/portal/browse";

  if (trip.status === "confirmed") {
    return (
      <>
        <Link
          href={trip.detailHref}
          className="flex-1 rounded bg-brand-primary px-3 py-2 text-center text-sm font-semibold text-white transition hover:bg-brand-secondary"
        >
          View booking
        </Link>
        <Link
          href="/portal/inbox"
          className="rounded border border-brand-line px-3 py-2 text-brand-ink hover:bg-brand-light"
          aria-label="Message host"
        >
          <MessageSquare className="h-4 w-4 text-brand-primary" />
        </Link>
      </>
    );
  }

  if (trip.status === "pending") {
    return (
      <>
        <Link
          href={trip.detailHref}
          className="flex-1 rounded border border-brand-line px-3 py-2 text-center text-sm font-medium text-brand-ink hover:bg-brand-light"
        >
          View request
        </Link>
        <Link
          href="/portal/inbox"
          className="rounded border border-brand-line px-3 py-2 text-brand-ink hover:bg-brand-light"
          aria-label="Message host"
        >
          <MessageSquare className="h-4 w-4 text-brand-primary" />
        </Link>
      </>
    );
  }

  if (trip.status === "completed") {
    return trip.reviewed ? (
      <>
        <Link
          href={rebookHref}
          className="flex-1 rounded border border-brand-line px-3 py-2 text-center text-sm font-medium text-brand-ink hover:bg-brand-light"
        >
          Book again
        </Link>
        <Link
          href={trip.detailHref}
          className="rounded border border-brand-line px-3 py-2 text-brand-ink hover:bg-brand-light"
          aria-label="View receipt"
        >
          <Receipt className="h-4 w-4 text-brand-primary" />
        </Link>
      </>
    ) : (
      <>
        <Link
          href={`/review/${trip.id}`}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded bg-brand-primary px-3 py-2 text-sm font-semibold text-white hover:bg-brand-secondary"
        >
          <Star className="h-4 w-4" /> Leave a review
        </Link>
        <Link
          href={trip.detailHref}
          className="rounded border border-brand-line px-3 py-2 text-brand-ink hover:bg-brand-light"
          aria-label="View receipt"
        >
          <Receipt className="h-4 w-4 text-brand-primary" />
        </Link>
      </>
    );
  }

  // cancelled
  return (
    <>
      <Link
        href={rebookHref}
        className="flex-1 rounded border border-brand-line px-3 py-2 text-center text-sm font-medium text-brand-ink hover:bg-brand-light"
      >
        Rebook this stay
      </Link>
      <Link
        href={trip.detailHref}
        className="rounded border border-brand-line px-3 py-2 text-brand-ink hover:bg-brand-light"
        aria-label="View receipt"
      >
        <Receipt className="h-4 w-4 text-brand-primary" />
      </Link>
    </>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const checkIn = trip.checkIn ? new Date(trip.checkIn) : null;
  const checkOut = trip.checkOut ? new Date(trip.checkOut) : null;
  return (
    <article className="flex flex-col overflow-hidden rounded-card border border-brand-line bg-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      <div className="relative h-40 overflow-hidden">
        <Photo
          src={trip.image}
          alt={trip.name}
          dimmed={trip.status === "cancelled"}
          className="absolute inset-0 h-full w-full"
        />
        <div className="absolute left-3 top-3">
          <StatusBadge status={trip.status} />
        </div>
        {trip.status === "completed" &&
          trip.reviewed &&
          trip.rating != null && (
            <div className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-pill bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-brand-ink shadow-card backdrop-blur">
              <Star className="h-3 w-3 fill-current text-amber-500" /> You rated{" "}
              {trip.rating.toFixed(1)}
            </div>
          )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-brand-mute">
          <MapPin className="h-3 w-3" />
          {[trip.city, trip.region].filter(Boolean).join(", ") ||
            "South Africa"}
        </div>
        <h3 className="mt-0.5 font-display text-lg font-bold leading-tight text-brand-ink">
          {trip.name}
        </h3>

        <div className="mt-3 flex items-center gap-3 text-sm text-brand-ink">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-brand-mute" />
            {checkIn && checkOut ? fmtRange(checkIn, checkOut) : "—"}
          </span>
          <span className="text-brand-line">·</span>
          <span className="text-brand-mute">
            {trip.nights} night{trip.nights > 1 ? "s" : ""}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-xs text-brand-mute">
          <span className="inline-flex items-center gap-1.5">
            <BedDouble className="h-3.5 w-3.5" />
            {trip.room}
          </span>
          <span className="text-brand-line">·</span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {trip.guests} guests
          </span>
        </div>

        {/* meta row */}
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-brand-line pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <Photo
              src={trip.hostAvatar}
              alt={trip.hostName ?? "Host"}
              className="h-6 w-6 shrink-0 rounded-pill"
            />
            <span className="truncate text-xs text-brand-mute">
              {trip.hostName ?? "Your host"}
            </span>
          </div>
          <div className="shrink-0 text-right">
            {trip.status === "cancelled" && trip.refunded != null ? (
              <div className="text-xs font-medium text-brand-primary">
                Refunded {formatZAR(trip.refunded)}
              </div>
            ) : (
              <div className="num text-sm font-semibold text-brand-ink">
                {formatZAR(trip.total)}
              </div>
            )}
            <div className="font-mono text-[10px] text-brand-mute">
              {trip.reference}
            </div>
          </div>
        </div>

        {/* actions */}
        <div className="mt-3 flex items-center gap-2">
          <TripActions trip={trip} />
        </div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tabs + grid                                                                */
/* -------------------------------------------------------------------------- */
const TABS: { key: TripBucket; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
];

export function TripsClient({
  trips,
  firstName,
}: {
  trips: Trip[];
  firstName: string;
}) {
  const [tab, setTab] = useState<TripBucket>("upcoming");

  const counts = useMemo(() => {
    const c: Record<TripBucket, number> = {
      upcoming: 0,
      past: 0,
      cancelled: 0,
    };
    trips.forEach((t) => {
      c[t.bucket]++;
    });
    return c;
  }, [trips]);

  const featured = trips.find((t) => t.featured);
  const list = trips.filter(
    (t) => t.bucket === tab && !(tab === "upcoming" && t.featured),
  );

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-brand-ink">
            My trips
          </h1>
          <p className="mt-1.5 text-sm text-brand-mute">
            Welcome back, {firstName} — here&apos;s everywhere you&apos;re
            headed.
          </p>
        </div>
        <Link
          href="/portal/browse"
          className="inline-flex items-center gap-2 rounded border border-brand-line bg-white px-4 py-2.5 text-sm font-medium text-brand-ink hover:bg-brand-light"
        >
          <Search className="h-4 w-4 text-brand-primary" /> Find a stay
        </Link>
      </div>

      {/* Featured */}
      {featured && tab === "upcoming" && (
        <div className="vilo-step-enter mt-6">
          <FeaturedTrip trip={featured} />
        </div>
      )}

      {/* Tabs */}
      <div className="vilo-hide-sb mt-8 flex items-center gap-1 overflow-x-auto border-b border-brand-line">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`relative whitespace-nowrap px-4 py-3 text-sm font-medium transition ${
                active
                  ? "text-brand-ink"
                  : "text-brand-mute hover:text-brand-ink"
              }`}
            >
              {t.label}
              <span
                className={`ml-1.5 text-xs font-semibold ${
                  active ? "text-brand-primary" : "text-brand-mute"
                }`}
              >
                {counts[t.key]}
              </span>
              {active && (
                <span className="absolute -bottom-px left-2 right-2 h-0.5 rounded-pill bg-brand-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {list.length > 0 ? (
        <div className="vilo-step-enter mt-6 grid gap-5 sm:grid-cols-2">
          {list.map((t) => (
            <TripCard key={t.id} trip={t} />
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-card border border-dashed border-brand-line bg-white/60 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-pill bg-brand-accent text-brand-primary">
            <Compass className="h-6 w-6" />
          </div>
          <div className="mt-4 font-display font-semibold text-brand-ink">
            {tab === "upcoming"
              ? "No upcoming trips"
              : tab === "past"
                ? "No past trips yet"
                : "Nothing cancelled"}
          </div>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-brand-mute">
            {tab === "upcoming"
              ? "When you book a stay it will show up here with all your details."
              : tab === "past"
                ? "Stays you complete will be saved here so you can rebook or review them."
                : "Any cancelled bookings and their refunds will appear here."}
          </p>
          {tab === "upcoming" && (
            <Link
              href="/portal/browse"
              className="mt-5 inline-flex items-center gap-2 rounded bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary"
            >
              Browse stays <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
