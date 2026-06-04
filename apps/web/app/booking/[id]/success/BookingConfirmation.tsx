"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BedDouble,
  CalendarClock,
  CalendarPlus,
  Check,
  Clock,
  Copy,
  CreditCard,
  KeyRound,
  MapPin,
  Mail,
  MessageSquare,
  Moon,
  Printer,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useBrandName } from "@/components/brand/BrandProvider";
import { formatMoney } from "@/lib/format";

/* -------------------------------------------------------------------------- */
/*  Shared data shape (built server-side in page.tsx)                          */
/* -------------------------------------------------------------------------- */
export type ConfirmationData = {
  bookingId: string;
  isConfirmed: boolean;
  /** Booking placed via manual EFT and still awaiting the guest's transfer. */
  isEftPending: boolean;
  reference: string;
  guestFirstName: string;
  guest: { name: string; email: string; phone: string | null };
  listing: {
    name: string;
    slug: string | null;
    typeLabel: string;
    city: string | null;
    province: string | null;
    address: string | null;
    checkInTime: string | null;
    checkOutTime: string | null;
    rating: number | null;
    reviews: number;
    coverImageUrl: string | null;
  };
  host: {
    name: string;
    avatarUrl: string | null;
    verified: boolean;
    since: string | null;
  } | null;
  stay: {
    checkInLabel: string | null;
    checkOutLabel: string | null;
    nights: number | null;
    guests: number;
    adults: number;
    children: number;
  };
  rooms: Array<{
    id: string;
    name: string;
    bedsLabel: string;
    sleeps: number;
    photoUrl: string | null;
    features: string[];
    total: number;
    perNight: number | null;
  }>;
  addOns: Array<{
    id: string;
    name: string;
    unitLabel: string;
    unitPrice: number;
    qty: number;
    total: number;
  }>;
  accommodationTotal: number | null; // whole-listing single line (rooms-scope uses rooms[])
  cleaningFee: number;
  totalAmount: number;
  currency: string;
  paymentMethodLabel: string | null;
  specialRequests: string | null;
  daysToGo: number | null;
  cancellationDeadlineLabel: string | null;
  calendarUrl: string | null;
  directionsUrl: string | null;
  /** Present ONLY when the booking is paid — drives the analytics purchase event. */
  purchase: {
    transactionId: string;
    value: number;
    currency: string;
    contentName: string;
    contentIds: string[];
    numItems: number;
    items: Array<{
      item_id: string;
      item_name: string;
      price: number;
      quantity: number;
    }>;
  } | null;
};

/* -------------------------------------------------------------------------- */
/*  Money                                                                      */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  Analytics dataLayer — fires a single `purchase` event once the booking is  */
/*  paid. No pixel is loaded yet; this just stages the event + dynamic values  */
/*  so a future GTM container / Meta Pixel maps it straight to a Purchase.     */
/* -------------------------------------------------------------------------- */
declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

function usePurchaseDataLayer(purchase: ConfirmationData["purchase"]) {
  useEffect(() => {
    if (!purchase) return; // only when status is paid
    const guardKey = `vilo_purchase_pushed_${purchase.transactionId}`;
    try {
      if (window.sessionStorage.getItem(guardKey)) return; // de-dupe on refresh
      window.sessionStorage.setItem(guardKey, "1");
    } catch {
      /* sessionStorage may be unavailable (private mode) — push anyway */
    }
    window.dataLayer = window.dataLayer || [];
    // Clear any prior ecommerce object so GTM doesn't merge stale items.
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push({
      event: "purchase",
      // GA4 / GTM ecommerce shape
      ecommerce: {
        transaction_id: purchase.transactionId,
        value: purchase.value,
        currency: purchase.currency,
        items: purchase.items,
      },
      // Meta Pixel mirror — a GTM "Purchase" tag reads these straight through.
      meta_purchase: {
        currency: purchase.currency,
        value: purchase.value,
        content_type: "product",
        content_name: purchase.contentName,
        content_ids: purchase.contentIds,
        num_items: purchase.numItems,
        order_id: purchase.transactionId,
      },
    });
  }, [purchase]);
}

/* -------------------------------------------------------------------------- */
/*  Confetti (only on the confirmed state)                                     */
/* -------------------------------------------------------------------------- */
function Confetti() {
  const pieces = useMemo(() => {
    const colors = [
      "#10B981",
      "#064E3B",
      "#D1FAE5",
      "#34D399",
      "#A7F3D0",
      "#F4A836",
    ];
    return Array.from({ length: 80 }).map((_, i) => ({
      left: Math.random() * 100,
      dx: `${Math.random() * 260 - 130}px`,
      d: `${(3.2 + Math.random() * 2.6).toFixed(2)}s`,
      delay: `${(Math.random() * 1.3).toFixed(2)}s`,
      bg: colors[i % colors.length],
      rot: Math.random() * 180,
    }));
  }, []);
  return (
    <div className="vc-noprint pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="vc-confetti"
          style={
            {
              left: `${p.left}%`,
              background: p.bg,
              transform: `rotate(${p.rot}deg)`,
              "--dx": p.dx,
              "--d": p.d,
              "--delay": p.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Atoms                                                                      */
/* -------------------------------------------------------------------------- */
function SectionCard({
  title,
  sub,
  right,
  children,
  className = "",
}: {
  title?: string;
  sub?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-card border border-brand-line bg-white shadow-card ${className}`}
    >
      {(title || right) && (
        <div className="flex items-center justify-between gap-3 border-b border-brand-line px-5 py-4">
          <div className="min-w-0">
            {title && (
              <div className="font-display font-semibold text-brand-ink">
                {title}
              </div>
            )}
            {sub && <div className="mt-0.5 text-xs text-brand-mute">{sub}</div>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    try {
      void navigator.clipboard.writeText(value);
    } catch {
      /* clipboard may be blocked */
    }
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy"
      className="ml-0.5 text-brand-primary transition-colors hover:text-brand-secondary"
    >
      {done ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero                                                                       */
/* -------------------------------------------------------------------------- */
function Hero({ data }: { data: ConfirmationData }) {
  const { isConfirmed } = data;
  return (
    <div className="vc-veil relative overflow-hidden border-b border-brand-line">
      {isConfirmed && <Confetti />}
      <div className="relative mx-auto max-w-[1120px] px-4 pb-9 pt-10 text-center lg:px-6">
        <div
          className={`vc-pop relative mx-auto flex h-20 w-20 items-center justify-center rounded-pill text-white ${
            isConfirmed
              ? "vc-ring bg-brand-primary shadow-glow"
              : "bg-brand-mute"
          }`}
        >
          {isConfirmed ? (
            <svg
              viewBox="0 0 24 24"
              className="vc-check h-10 w-10"
              fill="none"
              stroke="white"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12l5 5L20 7" />
            </svg>
          ) : (
            <Clock className="h-9 w-9" />
          )}
        </div>

        <div className="vc-rise" style={{ animationDelay: ".1s" }}>
          <div className="mt-5 inline-flex items-center gap-1.5 rounded-pill border border-brand-primary/25 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-secondary backdrop-blur">
            {isConfirmed ? (
              <>
                <Zap className="h-3 w-3" /> Confirmed
              </>
            ) : data.isEftPending ? (
              <>
                <Clock className="h-3 w-3" /> Reserved · pay by EFT
              </>
            ) : (
              <>
                <Clock className="h-3 w-3" /> Confirming payment
              </>
            )}
          </div>

          <h1 className="mt-4 font-display text-3xl font-extrabold leading-[1.08] tracking-tight text-brand-ink md:text-[40px]">
            {isConfirmed ? (
              <>
                {data.listing.city
                  ? `You're going to ${data.listing.city},`
                  : "You're booked,"}
                <br className="hidden sm:block" /> {data.guestFirstName} 🎉
              </>
            ) : data.isEftPending ? (
              <>You&rsquo;re nearly there, {data.guestFirstName}</>
            ) : (
              <>Hang tight, {data.guestFirstName}…</>
            )}
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-mute md:text-base">
            {isConfirmed ? (
              <>
                Your stay at{" "}
                <span className="font-medium text-brand-ink">
                  {data.listing.name}
                </span>{" "}
                is locked in. We&rsquo;ve emailed a receipt to{" "}
                <span className="font-medium text-brand-ink">
                  {data.guest.email}
                </span>
                {data.host ? (
                  <> and notified your host, {data.host.name.split(" ")[0]}.</>
                ) : (
                  "."
                )}
              </>
            ) : data.isEftPending ? (
              <>
                Your dates at{" "}
                <span className="font-medium text-brand-ink">
                  {data.listing.name}
                </span>{" "}
                are held. Complete your EFT transfer to confirm — tap{" "}
                <span className="font-medium text-brand-ink">
                  View my booking
                </span>{" "}
                for the host&rsquo;s banking details and your reference.
              </>
            ) : (
              <>
                Your payment just went through — we&rsquo;re waiting on the
                final confirmation. Refresh in a few seconds if this hangs.
              </>
            )}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-pill border border-brand-line bg-white py-1.5 pl-3.5 pr-2 font-mono text-sm text-brand-secondary shadow-card">
              <span className="font-sans text-[11px] uppercase tracking-wider text-brand-mute">
                Ref
              </span>
              {data.reference}
              <CopyButton value={data.reference} />
            </div>
            {isConfirmed && data.daysToGo != null ? (
              <div className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3 py-1.5 text-xs text-brand-mute">
                <CalendarClock className="h-3.5 w-3.5 text-brand-primary" />
                <span className="font-semibold text-brand-ink">
                  {data.daysToGo === 0
                    ? "Today"
                    : `${data.daysToGo} day${data.daysToGo === 1 ? "" : "s"}`}
                </span>{" "}
                to check-in
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Quick actions                                                              */
/* -------------------------------------------------------------------------- */
function QuickActions({ data }: { data: ConfirmationData }) {
  const actions: Array<{
    key: string;
    icon: typeof CalendarPlus;
    label: string;
    href?: string;
    onClick?: () => void;
  }> = [];
  if (data.calendarUrl)
    actions.push({
      key: "cal",
      icon: CalendarPlus,
      label: "Add to calendar",
      href: data.calendarUrl,
    });
  if (data.directionsUrl)
    actions.push({
      key: "dir",
      icon: MapPin,
      label: "Get directions",
      href: data.directionsUrl,
    });
  actions.push({
    key: "print",
    icon: Printer,
    label: "Print",
    onClick: () => window.print(),
  });
  actions.push({
    key: "trips",
    icon: CalendarClock,
    label: "My trips",
    href: "/my-trips",
  });

  return (
    <div className="vc-noprint grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {actions.map((a) => {
        const inner = (
          <>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-accent text-brand-primary transition-colors group-hover:bg-brand-primary group-hover:text-white">
              <a.icon className="h-4 w-4" />
            </span>
            <span className="text-left text-sm font-medium leading-tight text-brand-ink">
              {a.label}
            </span>
          </>
        );
        const cls =
          "group flex items-center gap-2.5 rounded-card border border-brand-line bg-white px-3 py-3 transition hover:border-brand-primary/50 hover:shadow-card";
        return a.href ? (
          <a
            key={a.key}
            href={a.href}
            target={a.href.startsWith("http") ? "_blank" : undefined}
            rel={a.href.startsWith("http") ? "noreferrer" : undefined}
            className={cls}
          >
            {inner}
          </a>
        ) : (
          <button key={a.key} type="button" onClick={a.onClick} className={cls}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Stay card                                                                  */
/* -------------------------------------------------------------------------- */
function StayCard({ data }: { data: ConfirmationData }) {
  const { listing, stay } = data;
  return (
    <SectionCard className="overflow-hidden">
      <div className="vc-ph relative aspect-[16/7] overflow-hidden">
        {listing.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.coverImageUrl}
            alt={listing.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-black/0" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-white/85">
            <MapPin className="h-3 w-3" />
            {[
              listing.typeLabel,
              [listing.city, listing.province].filter(Boolean).join(", "),
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <div className="mt-0.5 font-display text-2xl font-bold text-white drop-shadow-sm">
            {listing.name}
          </div>
        </div>
        {listing.rating != null ? (
          <div className="absolute right-3.5 top-3.5 inline-flex items-center gap-1 rounded-pill bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-brand-secondary shadow-card backdrop-blur">
            <Star className="h-3 w-3 fill-current text-amber-500" />{" "}
            {listing.rating.toFixed(2)}
            {listing.reviews > 0 ? ` · ${listing.reviews} reviews` : ""}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
        <div className="p-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-brand-mute">
            Check-in
          </div>
          <div className="mt-1 font-display text-lg font-bold text-brand-ink">
            {stay.checkInLabel ?? "—"}
          </div>
          {listing.checkInTime ? (
            <div className="mt-0.5 text-xs text-brand-mute">
              From {listing.checkInTime.slice(0, 5)}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-center justify-center border-x border-brand-line bg-brand-light/40 px-3">
          <Moon className="h-4 w-4 text-brand-primary" />
          <div className="mt-1 font-display text-sm font-bold text-brand-ink">
            {stay.nights ?? "—"}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-brand-mute">
            night{stay.nights === 1 ? "" : "s"}
          </div>
        </div>
        <div className="p-5 text-right">
          <div className="text-[11px] font-medium uppercase tracking-wider text-brand-mute">
            Check-out
          </div>
          <div className="mt-1 font-display text-lg font-bold text-brand-ink">
            {stay.checkOutLabel ?? "—"}
          </div>
          {listing.checkOutTime ? (
            <div className="mt-0.5 text-xs text-brand-mute">
              Until {listing.checkOutTime.slice(0, 5)}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-line bg-brand-light/30 px-5 py-3.5">
        <div className="inline-flex items-center gap-2 text-sm text-brand-ink">
          <Users className="h-4 w-4 text-brand-mute" />
          <span className="font-medium">
            {stay.guests} {stay.guests === 1 ? "guest" : "guests"}
          </span>
          {stay.adults > 0 ? (
            <span className="text-brand-mute">
              · {stay.adults} adult{stay.adults === 1 ? "" : "s"}
              {stay.children > 0
                ? `, ${stay.children} child${stay.children === 1 ? "" : "ren"}`
                : ""}
            </span>
          ) : null}
        </div>
        {data.paymentMethodLabel ? (
          <div className="inline-flex items-center gap-2 text-sm text-brand-mute">
            <CreditCard className="h-4 w-4" />
            Paid with{" "}
            <span className="font-medium text-brand-ink">
              {data.paymentMethodLabel}
            </span>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

/* -------------------------------------------------------------------------- */
/*  Rooms                                                                      */
/* -------------------------------------------------------------------------- */
function RoomsCard({ data }: { data: ConfirmationData }) {
  if (data.rooms.length === 0) return null;
  const sleeps = data.rooms.reduce((s, r) => s + r.sleeps, 0);
  return (
    <SectionCard
      title="Rooms booked"
      sub={`${data.rooms.length} ${data.rooms.length === 1 ? "room" : "rooms"}${
        sleeps > 0 ? ` · sleeps up to ${sleeps}` : ""
      }`}
    >
      <div className="space-y-2.5 p-4 sm:p-5">
        {data.rooms.map((room) => (
          <div
            key={room.id}
            className="flex items-stretch gap-3 rounded-card border border-brand-line bg-white p-3 sm:gap-4 sm:p-4"
          >
            <div className="vc-ph relative min-h-[88px] w-28 shrink-0 self-stretch overflow-hidden rounded-md sm:w-36">
              {room.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={room.photoUrl}
                  alt={room.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display font-semibold text-brand-ink">
                {room.name}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-brand-mute">
                {room.bedsLabel ? (
                  <>
                    <BedDouble className="h-3.5 w-3.5" />
                    {room.bedsLabel}
                    <span className="text-brand-line">·</span>
                  </>
                ) : null}
                <Users className="h-3.5 w-3.5" />
                Sleeps {room.sleeps}
              </div>
              {room.features.length > 0 ? (
                <div className="mt-2 hidden flex-wrap gap-1.5 sm:flex">
                  {room.features.map((f) => (
                    <span
                      key={f}
                      className="rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10px] font-medium text-brand-mute"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 flex items-baseline justify-between">
                {room.perNight != null && data.stay.nights ? (
                  <div className="font-mono text-xs text-brand-mute">
                    {formatMoney(room.perNight, data.currency)} ×{" "}
                    {data.stay.nights}n
                  </div>
                ) : (
                  <span />
                )}
                <div className="text-sm font-semibold text-brand-ink">
                  {formatMoney(room.total, data.currency)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

/* -------------------------------------------------------------------------- */
/*  Add-ons                                                                    */
/* -------------------------------------------------------------------------- */
function AddOnsCard({ data }: { data: ConfirmationData }) {
  if (data.addOns.length === 0) return null;
  return (
    <SectionCard
      title="Add-ons"
      sub={`${data.addOns.length} ${
        data.addOns.length === 1 ? "extra" : "extras"
      } arranged with your host`}
    >
      <div className="space-y-2 p-4 sm:p-5">
        {data.addOns.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-3 rounded border border-brand-line bg-brand-light/30 px-3.5 py-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-accent text-brand-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-brand-ink">{a.name}</div>
              <div className="font-mono text-[11px] text-brand-mute">
                {formatMoney(a.unitPrice, data.currency)} · {a.unitLabel}
                {a.qty > 1 ? ` × ${a.qty}` : ""}
              </div>
            </div>
            <div className="shrink-0 text-sm font-semibold text-brand-ink">
              {formatMoney(a.total, data.currency)}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

/* -------------------------------------------------------------------------- */
/*  Guest details + note                                                       */
/* -------------------------------------------------------------------------- */
function GuestCard({ data }: { data: ConfirmationData }) {
  const rows: Array<[string, string]> = [["Lead guest", data.guest.name]];
  if (data.guest.email) rows.push(["Email", data.guest.email]);
  if (data.guest.phone) rows.push(["Phone", data.guest.phone]);
  return (
    <SectionCard title="Your details">
      <div className="grid gap-4 p-5 sm:grid-cols-3">
        {rows.map(([k, v]) => (
          <div key={k}>
            <div className="text-[11px] font-medium uppercase tracking-wider text-brand-mute">
              {k}
            </div>
            <div className="mt-1 break-words text-sm font-medium text-brand-ink">
              {v}
            </div>
          </div>
        ))}
      </div>
      {data.specialRequests ? (
        <div className="px-5 pb-5">
          <div className="rounded border border-brand-line bg-brand-light/40 p-3.5">
            <div className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-brand-mute">
              <MessageSquare className="h-3.5 w-3.5 text-brand-primary" /> Your
              note to the host
            </div>
            <p className="text-sm italic leading-relaxed text-brand-ink">
              &ldquo;{data.specialRequests}&rdquo;
            </p>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

/* -------------------------------------------------------------------------- */
/*  What happens next                                                          */
/* -------------------------------------------------------------------------- */
function TimelineCard({ data }: { data: ConfirmationData }) {
  const hostFirst = data.host?.name.split(" ")[0] ?? "your host";
  const steps = [
    {
      icon: Mail,
      title: "Confirmation emailed",
      sub: "Receipt and booking reference sent to your inbox.",
      done: data.isConfirmed,
    },
    {
      icon: MessageSquare,
      title: "Say hi to your host",
      sub: `${hostFirst} can answer questions about arrival or local tips.`,
      done: false,
    },
    {
      icon: KeyRound,
      title: "Check-in details · 24h before",
      sub: "Address, access and parking info arrive the day before you travel.",
      done: false,
    },
    {
      icon: Sun,
      title: data.listing.city
        ? `Enjoy ${data.listing.city}`
        : "Enjoy your trip",
      sub: "Make the most of your stay — your host has the local know-how.",
      done: false,
    },
  ];
  return (
    <SectionCard title="What happens next">
      <div className="p-5">
        <ol className="relative space-y-5">
          <span className="absolute bottom-2 left-[15px] top-2 w-px bg-brand-line" />
          {steps.map((step) => (
            <li key={step.title} className="relative flex gap-4">
              <span
                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border ${
                  step.done
                    ? "border-brand-primary bg-brand-primary text-white"
                    : "border-brand-line bg-white text-brand-primary"
                }`}
              >
                {step.done ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <step.icon className="h-4 w-4" />
                )}
              </span>
              <div className="pt-0.5">
                <div className="text-sm font-semibold text-brand-ink">
                  {step.title}
                </div>
                <div className="mt-0.5 max-w-md text-xs leading-relaxed text-brand-mute">
                  {step.sub}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </SectionCard>
  );
}

/* -------------------------------------------------------------------------- */
/*  Payment summary                                                            */
/* -------------------------------------------------------------------------- */
function PriceCard({ data }: { data: ConfirmationData }) {
  const brandName = useBrandName();
  return (
    <SectionCard>
      <div className="flex items-center justify-between border-b border-brand-line px-5 py-4">
        <div className="font-display font-semibold text-brand-ink">
          Payment summary
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-[11px] font-semibold ${
            data.isConfirmed
              ? "bg-brand-accent text-brand-secondary"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {data.isConfirmed ? (
            <>
              <Check className="h-3 w-3" /> Paid
            </>
          ) : (
            <>
              <Clock className="h-3 w-3" /> Pending
            </>
          )}
        </span>
      </div>
      <div className="space-y-2 p-5 text-sm">
        {data.rooms.length > 0 ? (
          data.rooms.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between text-brand-ink"
            >
              <span className="truncate pr-3">
                {r.name}
                {data.stay.nights ? (
                  <span className="font-mono text-xs text-brand-mute">
                    {" "}
                    × {data.stay.nights}n
                  </span>
                ) : null}
              </span>
              <span>{formatMoney(r.total, data.currency)}</span>
            </div>
          ))
        ) : data.accommodationTotal != null ? (
          <div className="flex items-center justify-between text-brand-ink">
            <span className="truncate pr-3">
              Accommodation
              {data.stay.nights ? (
                <span className="font-mono text-xs text-brand-mute">
                  {" "}
                  × {data.stay.nights}n
                </span>
              ) : null}
            </span>
            <span>{formatMoney(data.accommodationTotal, data.currency)}</span>
          </div>
        ) : null}

        {data.addOns.length > 0 ? (
          <div className="border-t border-brand-line/70 pt-2">
            {data.addOns.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between py-0.5 text-[13px] text-brand-ink"
              >
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
                  <span className="truncate">{a.name}</span>
                  {a.qty > 1 ? (
                    <span className="shrink-0 font-mono text-[11px] text-brand-mute">
                      × {a.qty}
                    </span>
                  ) : null}
                </span>
                <span>{formatMoney(a.total, data.currency)}</span>
              </div>
            ))}
          </div>
        ) : null}

        {data.cleaningFee > 0 ? (
          <div className="flex items-center justify-between border-t border-brand-line/70 pt-2 text-brand-ink">
            <span>Cleaning fee</span>
            <span>{formatMoney(data.cleaningFee, data.currency)}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between text-brand-mute">
          <span>{brandName} service fee</span>
          <span className="font-medium text-brand-primary">FREE</span>
        </div>
      </div>
      <div className="px-5 pb-5">
        <div className="flex items-baseline justify-between border-t border-brand-line pt-4">
          <span className="font-display font-semibold text-brand-ink">
            Total {data.isConfirmed ? "paid" : "due"} · {data.currency}
          </span>
          <span className="font-display text-2xl font-bold text-brand-ink">
            {formatMoney(data.totalAmount, data.currency)}
          </span>
        </div>
        {data.cancellationDeadlineLabel ? (
          <div className="mt-4 flex items-start gap-2.5 rounded border border-brand-line bg-brand-light/60 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
            <div className="text-[11px] leading-relaxed text-brand-mute">
              Free cancellation until{" "}
              <span className="font-medium text-brand-ink">
                {data.cancellationDeadlineLabel}
              </span>
              . After that, your cancellation policy applies.
            </div>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

/* -------------------------------------------------------------------------- */
/*  Host                                                                       */
/* -------------------------------------------------------------------------- */
function HostCard({ data }: { data: ConfirmationData }) {
  if (!data.host) return null;
  const host = data.host;
  return (
    <SectionCard>
      <div className="p-5">
        <div className="flex items-center gap-3">
          <div className="vc-ph relative h-12 w-12 shrink-0 overflow-hidden rounded-pill">
            {host.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={host.avatarUrl}
                alt={host.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center bg-brand-accent font-display font-semibold text-brand-secondary">
                {host.name.charAt(0)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-wider text-brand-mute">
              Your host
            </div>
            <div className="inline-flex items-center gap-1.5 font-semibold text-brand-ink">
              {host.name}
              {host.verified ? (
                <BadgeCheck className="h-4 w-4 text-brand-primary" />
              ) : null}
            </div>
            {host.since ? (
              <div className="text-xs text-brand-mute">
                Hosting since {host.since}
              </div>
            ) : null}
          </div>
        </div>
        <Link
          href={`/portal/trips/${data.bookingId}`}
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded border border-brand-primary bg-brand-primary px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
        >
          <MessageSquare className="h-4 w-4" /> Message host
        </Link>
      </div>
    </SectionCard>
  );
}

/* -------------------------------------------------------------------------- */
/*  Check-in essentials                                                        */
/* -------------------------------------------------------------------------- */
function EssentialsCard({ data }: { data: ConfirmationData }) {
  const { listing } = data;
  const addressRow = data.isConfirmed ? listing.address : null;
  const hasArrival = listing.checkInTime || listing.checkOutTime;
  if (!addressRow && !hasArrival) return null;
  return (
    <SectionCard title="Check-in essentials">
      <div className="divide-y divide-brand-line">
        {addressRow ? (
          <div className="flex items-start justify-between gap-3 px-5 py-3.5">
            <div className="flex min-w-0 items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wider text-brand-mute">
                  Address
                </div>
                <div className="mt-0.5 whitespace-pre-line text-sm text-brand-ink">
                  {addressRow}
                </div>
              </div>
            </div>
            {data.directionsUrl ? (
              <a
                href={data.directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="vc-noprint inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
              >
                Map <ArrowUpRight className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        ) : null}
        {hasArrival ? (
          <div className="flex items-start gap-3 px-5 py-3.5">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-brand-mute">
                Arrival window
              </div>
              <div className="mt-0.5 text-sm text-brand-ink">
                {listing.checkInTime
                  ? `Check-in from ${listing.checkInTime.slice(0, 5)}`
                  : ""}
                {listing.checkInTime && listing.checkOutTime ? " · " : ""}
                {listing.checkOutTime
                  ? `check-out by ${listing.checkOutTime.slice(0, 5)}`
                  : ""}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

/* -------------------------------------------------------------------------- */
/*  Root                                                                       */
/* -------------------------------------------------------------------------- */
export function BookingConfirmation({ data }: { data: ConfirmationData }) {
  usePurchaseDataLayer(data.purchase);

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
.vc-veil{background:radial-gradient(60% 120% at 50% -10%, rgba(16,185,129,0.16) 0%, rgba(16,185,129,0) 60%),radial-gradient(40% 90% at 85% 0%, rgba(212,250,229,0.7) 0%, rgba(212,250,229,0) 55%);}
.vc-ph{background:repeating-linear-gradient(135deg,#D1FAE5 0 12px,#BBF3D4 12px 24px);}
@keyframes vc-confetti-fall{0%{transform:translate3d(0,-20vh,0) rotate(0deg);opacity:0;}10%{opacity:1;}100%{transform:translate3d(var(--dx),110vh,0) rotate(720deg);opacity:1;}}
.vc-confetti{position:absolute;top:0;width:8px;height:14px;border-radius:2px;will-change:transform,opacity;animation:vc-confetti-fall var(--d) cubic-bezier(.2,.7,.2,1) forwards;animation-delay:var(--delay);}
@keyframes vc-draw{from{stroke-dashoffset:80;}to{stroke-dashoffset:0;}}
.vc-check path{stroke-dasharray:80;stroke-dashoffset:80;animation:vc-draw .55s .25s cubic-bezier(.2,.7,.2,1) forwards;}
@keyframes vc-pop{0%{transform:scale(.6);opacity:0;}60%{transform:scale(1.08);}100%{transform:scale(1);opacity:1;}}
.vc-pop{animation:vc-pop .5s cubic-bezier(.2,.7,.2,1) both;}
@keyframes vc-rise{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
.vc-rise{animation:vc-rise .55s cubic-bezier(.2,.7,.2,1) both;}
@keyframes vc-ring{0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.30);}70%{box-shadow:0 0 0 14px rgba(16,185,129,0);}}
.vc-ring{animation:vc-ring 2.6s ease-out infinite;}
@media print{.vc-noprint{display:none!important;}}
@media (prefers-reduced-motion: reduce){.vc-confetti,.vc-check path,.vc-pop,.vc-rise,.vc-ring{animation:none!important;}.vc-check path{stroke-dashoffset:0;}}
`,
        }}
      />

      <Hero data={data} />

      <main className="mx-auto max-w-[1120px] px-3 py-7 lg:px-6 lg:py-9">
        <div className="vc-rise" style={{ animationDelay: ".18s" }}>
          <QuickActions data={data} />
        </div>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[1fr_360px] lg:gap-7">
          <div className="vc-rise space-y-5" style={{ animationDelay: ".24s" }}>
            <StayCard data={data} />
            <RoomsCard data={data} />
            <AddOnsCard data={data} />
            <GuestCard data={data} />
            <TimelineCard data={data} />
          </div>

          <div
            className="vc-rise space-y-5 lg:sticky lg:top-[76px]"
            style={{ animationDelay: ".3s" }}
          >
            <PriceCard data={data} />
            <HostCard data={data} />
            <EssentialsCard data={data} />
          </div>
        </div>

        <div className="vc-noprint mt-7 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={data.listing.slug ? `/listing/${data.listing.slug}` : "/"}
            className="inline-flex items-center gap-1.5 text-sm text-brand-mute hover:text-brand-ink"
          >
            <ArrowLeft className="h-4 w-4" /> Back to listing
          </Link>
          <Link
            href={`/portal/trips/${data.bookingId}`}
            className="inline-flex items-center gap-2 rounded bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-secondary"
          >
            View my booking <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}
