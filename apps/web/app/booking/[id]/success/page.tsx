import type { Metadata } from "next";
import { CheckCircle2, Clock, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { verifyTransaction } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Booking confirmed · Vilo",
};

// Always SSR so we re-read the latest booking + payment state. The webhook
// is the source of truth; this page also calls /verify as a fast-path so
// the guest doesn't sit on "Confirming…" if the webhook is a few seconds
// behind.
export const dynamic = "force-dynamic";

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

export default async function BookingSuccessPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { reference?: string };
}) {
  const supabase = createServerClient();
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
      "id, reference, status, payment_status, check_in, check_out, nights, session_date, guests_count, total_amount, currency, listing:listings!inner ( name, slug, city, province, listing_type )",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!booking) notFound();

  // Fast-path: if webhook hasn't landed yet, ask Paystack directly.
  const reference = searchParams?.reference;
  if (
    booking.payment_status === "pending" &&
    reference &&
    reference.length > 0
  ) {
    const verification = await verifyTransaction(reference);
    if (verification && verification.status === "success") {
      // Mirror what the webhook would do, with idempotency via the unique
      // provider_reference constraint.
      const admin = createAdminClient();
      await admin
        .from("payments")
        .update({
          status: "completed",
          captured_at: new Date().toISOString(),
        })
        .eq("provider_reference", reference)
        .eq("status", "pending");
      await admin
        .from("bookings")
        .update({
          status: "confirmed",
          payment_status: "completed",
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", booking.id)
        .eq("status", "pending");
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
  }

  const isConfirmed =
    booking.status === "confirmed" && booking.payment_status === "completed";

  const listing = booking.listing as unknown as {
    name: string;
    slug: string | null;
    city: string | null;
    province: string | null;
    listing_type: "accommodation" | "experience";
  };
  const isExperience = listing.listing_type === "experience";
  const sessionLabel = booking.session_date
    ? new Date(booking.session_date).toLocaleString("en-ZA", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />

      <main className="mx-auto max-w-xl px-5 py-10 lg:px-8 lg:py-16">
        <div className="rounded-card border border-brand-line bg-white p-8 shadow-card">
          <div
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
              isConfirmed
                ? "bg-brand-accent text-brand-primary"
                : "bg-brand-line text-brand-mute"
            }`}
          >
            {isConfirmed ? (
              <CheckCircle2 className="h-7 w-7" />
            ) : (
              <Clock className="h-7 w-7" />
            )}
          </div>

          <h1 className="mt-5 text-center font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
            {isConfirmed ? "You're booked." : "Confirming your payment…"}
          </h1>
          <p className="mt-2 text-center text-sm text-brand-mute">
            {isConfirmed
              ? "Your reservation is confirmed. The host has been notified."
              : "Paystack just took your payment — we&rsquo;re waiting for the final webhook to fire. Refresh the page in a few seconds if this hangs."}
          </p>

          <dl className="mt-6 space-y-3 rounded-card border border-brand-line bg-brand-light/60 p-4 text-sm">
            <Row label="Booking reference">
              <span className="font-mono font-medium text-brand-ink">
                {booking.reference}
              </span>
            </Row>
            <Row label="Listing">
              <span className="font-medium text-brand-ink">{listing.name}</span>
            </Row>
            {listing.city || listing.province ? (
              <Row label="Where">
                <span className="inline-flex items-center gap-1 text-brand-ink">
                  <MapPin className="h-3.5 w-3.5 text-brand-primary" />
                  {[listing.city, listing.province].filter(Boolean).join(", ")}
                </span>
              </Row>
            ) : null}
            {isExperience ? (
              <>
                <Row label="Session">
                  <span className="font-medium text-brand-ink">
                    {sessionLabel ?? "—"}
                  </span>
                </Row>
                <Row label="Participants">
                  <span className="font-medium text-brand-ink">
                    {booking.guests_count}
                  </span>
                </Row>
              </>
            ) : (
              <>
                <Row label="Check in">
                  <span className="font-medium text-brand-ink">
                    {booking.check_in ?? "—"}
                  </span>
                </Row>
                <Row label="Check out">
                  <span className="font-medium text-brand-ink">
                    {booking.check_out ?? "—"}
                  </span>
                </Row>
                <Row label="Nights">
                  <span className="font-medium text-brand-ink">
                    {booking.nights ?? "—"}
                  </span>
                </Row>
                <Row label="Guests">
                  <span className="font-medium text-brand-ink">
                    {booking.guests_count}
                  </span>
                </Row>
              </>
            )}
            <Row label="Total paid">
              <span className="font-display font-bold text-brand-ink">
                {fmtR(Number(booking.total_amount), booking.currency)}
              </span>
            </Row>
          </dl>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link
              href={listing.slug ? `/listing/${listing.slug}` : "/"}
              className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-4 py-2.5 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-accent"
            >
              Back to listing
            </Link>
            <Link
              href="/my-trips"
              className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
            >
              View my trips
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-brand-mute">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
