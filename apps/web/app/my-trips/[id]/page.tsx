import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText, MapPin } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";
import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";

import { RequestRefundButton } from "./RequestRefundButton";

export const metadata: Metadata = {
  title: "Trip · Vilo",
};

export const dynamic = "force-dynamic";

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const STATUS_STYLES: Record<string, string> = {
  confirmed:
    "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30",
  completed:
    "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30",
  checked_in:
    "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30",
  pending: "bg-status-pending/10 text-status-pending border-status-pending/30",
  pending_eft:
    "bg-status-pending/10 text-status-pending border-status-pending/30",
  cancelled_by_guest:
    "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/30",
  cancelled_by_host:
    "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/30",
  expired: "bg-brand-light text-brand-mute border-brand-line",
};

export default async function MyTripDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/my-trips/${params.id}`);

  const { data: bookingRaw } = await supabase
    .from("bookings")
    .select(
      `
      id, reference, status, payment_status, payment_method, scope,
      check_in, check_out, nights,
      guests_count, base_amount, cleaning_fee,
      total_amount, currency, special_requests, created_at,
      confirmed_at, cancelled_at, checked_in_at, checked_out_at,
      has_open_refund,
      listing:listings ( name, slug, city, province ),
      host:hosts ( handle, display_name )
    `,
    )
    .eq("id", params.id)
    .eq("guest_id", user.id)
    .maybeSingle();

  if (!bookingRaw) notFound();
  const booking = bookingRaw as unknown as {
    id: string;
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
    total_amount: number;
    currency: string;
    special_requests: string | null;
    created_at: string;
    confirmed_at: string | null;
    cancelled_at: string | null;
    checked_in_at: string | null;
    checked_out_at: string | null;
    has_open_refund: boolean | null;
    listing: {
      name: string;
      slug: string | null;
      city: string | null;
      province: string | null;
    } | null;
    host: { handle: string; display_name: string } | null;
  };

  // Fetch refund summary for this booking
  const { data: refunds } = await supabase
    .from("refund_requests")
    .select(
      "id, status, requested_amount, approved_amount, currency, created_at",
    )
    .eq("booking_id", booking.id)
    .order("created_at", { ascending: false });

  const statusCls =
    STATUS_STYLES[booking.status] ??
    "bg-brand-light text-brand-mute border-brand-line";

  const canRequestRefund =
    !booking.has_open_refund &&
    (booking.payment_status === "captured" ||
      booking.payment_status === "completed") &&
    booking.status !== "expired";

  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />

      <main className="mx-auto max-w-4xl px-5 py-10 lg:px-8 lg:py-12">
        <Link
          href="/my-trips"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-mute hover:text-brand-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          All trips
        </Link>

        <header className="mt-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[11px] font-medium ${statusCls}`}
              >
                {booking.status.replace(/_/g, " ")}
              </span>
              <span className="font-mono text-[11px] text-brand-mute">
                {booking.reference}
              </span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-brand-ink sm:text-3xl">
              {booking.listing?.name ?? "Trip"}
            </h1>
            <div className="mt-1 text-sm text-brand-mute">
              {booking.host?.display_name
                ? `Hosted by ${booking.host.display_name}`
                : ""}
              {booking.listing?.city ? ` · ${booking.listing.city}` : ""}
              {booking.listing?.province ? `, ${booking.listing.province}` : ""}
            </div>
          </div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                Trip
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
                <Row label="Check in" value={fmtDate(booking.check_in)} />
                <Row label="Check out" value={fmtDate(booking.check_out)} />
                <Row
                  label="Length of stay"
                  value={
                    booking.nights
                      ? `${booking.nights} ${booking.nights === 1 ? "night" : "nights"}`
                      : "—"
                  }
                />
                <Row label="Guests" value={String(booking.guests_count)} />
              </dl>
              {booking.special_requests ? (
                <div className="mt-5 rounded border border-brand-line bg-brand-light/60 p-3 text-sm text-brand-dark">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                    Your request
                  </div>
                  <p className="mt-1 whitespace-pre-line leading-relaxed">
                    {booking.special_requests}
                  </p>
                </div>
              ) : null}
            </section>

            {refunds && refunds.length > 0 ? (
              <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                  Refund history
                </div>
                <ul className="mt-3 space-y-2 text-sm">
                  {refunds.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border border-brand-line bg-brand-light/40 px-3 py-2"
                    >
                      <div>
                        <span className="font-medium capitalize text-brand-ink">
                          {r.status}
                        </span>{" "}
                        ·{" "}
                        <span className="num">
                          {fmtR(
                            Number(r.approved_amount ?? r.requested_amount),
                            r.currency,
                          )}
                        </span>
                      </div>
                      <span className="text-[11px] text-brand-mute">
                        {new Date(r.created_at).toLocaleDateString("en-ZA")}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className="space-y-6">
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
                {Number(booking.cleaning_fee ?? 0) > 0 ? (
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
              {booking.payment_method ? (
                <div className="mt-3 text-[12px] text-brand-mute">
                  Paid via{" "}
                  <span className="font-mono uppercase text-brand-ink">
                    {booking.payment_method}
                  </span>
                </div>
              ) : null}
            </section>

            {canRequestRefund ? (
              <RequestRefundButton
                bookingId={booking.id}
                totalAmount={Number(booking.total_amount)}
                currency={booking.currency}
              />
            ) : booking.has_open_refund ? (
              <p className="rounded border border-brand-line bg-brand-light/40 px-3 py-2 text-[12.5px] text-brand-dark">
                A refund request for this booking is currently in progress.
              </p>
            ) : null}

            {booking.listing?.slug ? (
              <Link
                href={`/listing/${booking.listing.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-primary hover:underline"
              >
                <MapPin className="h-4 w-4" />
                View public listing
              </Link>
            ) : null}

            <Link
              href={`/booking/${booking.id}/success`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-mute hover:text-brand-primary"
            >
              <FileText className="h-4 w-4" />
              View confirmation
            </Link>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </dt>
      <dd className="mt-0.5 font-medium text-brand-ink">{value ?? "—"}</dd>
    </div>
  );
}
