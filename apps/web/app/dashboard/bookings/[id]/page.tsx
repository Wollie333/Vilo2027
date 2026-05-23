import type { Metadata } from "next";
import { ArrowLeft, MessageSquare, User } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import { StatusPill } from "../StatusPill";
import { BookingActions } from "./BookingActions";

export const metadata: Metadata = {
  title: "Booking · Vilo",
};

export const dynamic = "force-dynamic";

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

export default async function BookingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();

  // RLS host_manage_own_bookings — only the host can read.
  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id, reference, status, payment_status, check_in, check_out, nights, guests_count, base_amount, cleaning_fee, total_amount, currency, payment_method, special_requests, internal_notes, created_at, confirmed_at, cancelled_at, checked_in_at, checked_out_at, listing:listings!inner ( name, slug ), guest:user_profiles!inner ( full_name, email, phone )",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!booking) notFound();

  const listing = booking.listing as unknown as {
    name: string;
    slug: string | null;
  };
  const guest = booking.guest as unknown as {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/dashboard/bookings"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-mute hover:text-brand-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          All bookings
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
              {listing.name}
            </h1>
            <StatusPill status={booking.status} />
          </div>
          <div className="mt-1 font-mono text-xs text-brand-mute">
            {booking.reference}
          </div>
        </div>
        <BookingActions bookingId={booking.id} status={booking.status} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Trip
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <Row label="Check in" value={booking.check_in ?? "—"} />
              <Row label="Check out" value={booking.check_out ?? "—"} />
              <Row label="Nights" value={booking.nights ?? "—"} />
              <Row label="Guests" value={booking.guests_count} />
              <Row
                label="Payment method"
                value={booking.payment_method ?? "—"}
                mono
              />
              <Row label="Payment status" value={booking.payment_status} mono />
            </dl>
            {booking.special_requests ? (
              <div className="mt-5 rounded border border-brand-line bg-brand-light/60 p-3 text-sm text-brand-dark">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                  Guest&rsquo;s request
                </div>
                <p className="mt-1 whitespace-pre-line leading-relaxed">
                  {booking.special_requests}
                </p>
              </div>
            ) : null}
          </section>

          <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Timeline
            </div>
            <ul className="mt-3 space-y-2 text-sm text-brand-dark">
              <TimelineLine label="Booked" iso={booking.created_at} />
              <TimelineLine label="Confirmed" iso={booking.confirmed_at} />
              <TimelineLine label="Checked in" iso={booking.checked_in_at} />
              <TimelineLine label="Checked out" iso={booking.checked_out_at} />
              <TimelineLine label="Cancelled" iso={booking.cancelled_at} />
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Guest
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-accent text-brand-primary">
                <User className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium text-brand-ink">
                  {guest.full_name || "Anonymous"}
                </div>
                {guest.email ? (
                  <div className="truncate font-mono text-xs text-brand-mute">
                    {guest.email}
                  </div>
                ) : null}
              </div>
            </div>
            {guest.phone ? (
              <div className="mt-2 text-sm text-brand-dark">
                <span className="text-brand-mute">Phone:</span>{" "}
                <span className="font-mono">{guest.phone}</span>
              </div>
            ) : null}
            <button
              type="button"
              disabled
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded border border-brand-line bg-brand-light/40 px-3 py-2 text-sm font-medium text-brand-mute"
            >
              <MessageSquare className="h-4 w-4" />
              Message guest (Inbox slice)
            </button>
          </section>

          <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Amount
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-brand-mute">Base</dt>
                <dd className="font-medium text-brand-ink">
                  {fmtR(Number(booking.base_amount), booking.currency)}
                </dd>
              </div>
              {Number(booking.cleaning_fee) > 0 ? (
                <div className="flex items-center justify-between">
                  <dt className="text-brand-mute">Cleaning fee</dt>
                  <dd className="font-medium text-brand-ink">
                    {fmtR(Number(booking.cleaning_fee), booking.currency)}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between border-t border-brand-line pt-2">
                <dt className="font-display font-semibold text-brand-ink">
                  Total
                </dt>
                <dd className="font-display text-lg font-bold text-brand-ink">
                  {fmtR(Number(booking.total_amount), booking.currency)}
                </dd>
              </div>
            </dl>
          </section>

          {listing.slug ? (
            <Link
              href={`/listing/${listing.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-primary hover:underline"
            >
              View public listing →
            </Link>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </dt>
      <dd
        className={`mt-0.5 ${mono ? "font-mono text-xs" : ""} font-medium text-brand-ink`}
      >
        {value}
      </dd>
    </div>
  );
}

function TimelineLine({ label, iso }: { label: string; iso: string | null }) {
  if (!iso) {
    return (
      <li className="flex items-center justify-between text-brand-mute">
        <span>{label}</span>
        <span>—</span>
      </li>
    );
  }
  const d = new Date(iso);
  const formatted = new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
  return (
    <li className="flex items-center justify-between">
      <span className="font-medium text-brand-ink">{label}</span>
      <span className="font-mono text-xs text-brand-mute">{formatted}</span>
    </li>
  );
}
