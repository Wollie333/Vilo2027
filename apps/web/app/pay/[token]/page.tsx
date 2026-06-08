import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Hash,
  Users,
  XCircle,
} from "lucide-react";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { getBrandName } from "@/lib/brand";
import { getHostParty } from "@/lib/finance/doc-party";
import { formatMoney, round2 } from "@/lib/format";
import { getHostPaystack } from "@/lib/payments/host-paystack";
import { sumCompletedPaid } from "@/lib/payments/ledger";
import { confirmHostCardPaymentByReference } from "@/lib/payments/pay-booking";
import { createAdminClient } from "@/lib/supabase/admin";

import { PayNowPanel } from "./PayNowPanel";

export const metadata: Metadata = {
  title: "Pay for your booking",
  robots: { index: false, follow: false },
};

// Always SSR: re-read the latest booking + payment state, and verify on return
// from Paystack. Public page — auth is possession of the secret pay_token.
export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso));
}

type ListingSnap = {
  name: string;
  host_id: string;
  city: string | null;
  province: string | null;
};

export default async function PayPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams?: { reference?: string };
}) {
  const admin = createAdminClient();
  const brandName = await getBrandName();

  const { data: booking } = await admin
    .from("bookings")
    .select(
      "id, reference, scope, status, payment_status, check_in, check_out, nights, guests_count, total_amount, currency, guest_name, listing:listings!inner ( name, host_id, city, province )",
    )
    .eq("pay_token", params.token)
    .maybeSingle();
  if (!booking) notFound();

  const listing = booking.listing as unknown as ListingSnap;

  // Returned from Paystack → confirm with the host key + the ledger (idempotent).
  const reference = searchParams?.reference;
  if (booking.payment_status !== "completed" && reference) {
    await confirmHostCardPaymentByReference({
      reference,
      hostId: listing.host_id,
      bookingId: booking.id,
    });
    const { data: refreshed } = await admin
      .from("bookings")
      .select("status, payment_status")
      .eq("id", booking.id)
      .single();
    if (refreshed) {
      booking.status = refreshed.status;
      booking.payment_status = refreshed.payment_status;
    }
  }

  const currency = booking.currency;
  const total = Number(booking.total_amount);
  const paid = await sumCompletedPaid(admin, booking.id);
  const outstanding = Math.max(0, round2(total - paid));

  const isPaid = booking.payment_status === "completed" || outstanding <= 0;
  const cancelledLike = [
    "cancelled_by_guest",
    "cancelled_by_host",
    "declined",
    "expired",
  ].includes(booking.status);
  const payable = !isPaid && !cancelledLike;

  // Card rail (host's own Paystack) + EFT banking — load only when payable.
  const hostPaystack = payable ? await getHostPaystack(listing.host_id) : null;
  const hasCard = !!hostPaystack;
  const party = payable
    ? await getHostParty(admin, listing.host_id, booking.reference)
    : null;
  const banking = party?.banking ?? null;

  const locationLine = [listing.city, listing.province]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="min-h-screen bg-white text-brand-ink">
      <SiteHeader />

      <main className="mx-auto max-w-xl px-5 py-10 lg:py-14">
        <header className="text-center">
          <div className="text-[11px] font-medium uppercase tracking-wider text-brand-mute">
            {brandName} · Secure payment
          </div>
          <h1 className="mt-1 font-display text-2xl font-semibold text-brand-ink">
            {isPaid
              ? "This booking is paid"
              : cancelledLike
                ? "This booking is no longer payable"
                : `Pay for your stay at ${listing.name}`}
          </h1>
          {locationLine ? (
            <p className="mt-1 text-sm text-brand-mute">{locationLine}</p>
          ) : null}
        </header>

        {/* Booking summary */}
        <section className="mt-7 rounded-card border border-brand-line bg-white">
          <div className="border-b border-brand-line px-5 py-4">
            <div className="font-display font-semibold text-brand-ink">
              {listing.name}
            </div>
            <div className="mt-0.5 text-xs text-brand-mute">
              Booking for {booking.guest_name ?? "guest"}
            </div>
          </div>
          <dl className="divide-y divide-brand-line text-sm">
            <div className="flex items-center justify-between px-5 py-3">
              <dt className="inline-flex items-center gap-2 text-brand-mute">
                <CalendarDays className="h-4 w-4" /> Dates
              </dt>
              <dd className="text-right font-medium text-brand-ink">
                {fmtDate(booking.check_in)} → {fmtDate(booking.check_out)}
                {booking.nights ? (
                  <span className="ml-1 text-brand-mute">
                    · {booking.nights}{" "}
                    {booking.nights === 1 ? "night" : "nights"}
                  </span>
                ) : null}
              </dd>
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <dt className="inline-flex items-center gap-2 text-brand-mute">
                <Users className="h-4 w-4" /> Guests
              </dt>
              <dd className="font-medium text-brand-ink">
                {booking.guests_count}
              </dd>
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <dt className="inline-flex items-center gap-2 text-brand-mute">
                <Hash className="h-4 w-4" /> Reference
              </dt>
              <dd className="font-mono text-xs font-medium text-brand-ink">
                {booking.reference}
              </dd>
            </div>
          </dl>
        </section>

        {/* Amount + action */}
        {isPaid ? (
          <section className="mt-6 rounded-card border border-status-confirmed/30 bg-status-confirmed/5 px-5 py-6 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-status-confirmed" />
            <div className="mt-2 font-display text-lg font-semibold text-brand-ink">
              Payment received
            </div>
            <div className="mt-1 text-sm text-brand-mute">
              {formatMoney(total, currency)} paid in full. A confirmation has
              been sent to the guest.
            </div>
          </section>
        ) : cancelledLike ? (
          <section className="mt-6 rounded-card border border-brand-line bg-brand-light/40 px-5 py-6 text-center">
            <XCircle className="mx-auto h-9 w-9 text-brand-mute" />
            <div className="mt-2 text-sm text-brand-mute">
              This booking has been cancelled or has expired, so it can no
              longer be paid. Please contact your host if you think this is a
              mistake.
            </div>
          </section>
        ) : (
          <section className="mt-6 space-y-5">
            <div className="rounded-card border border-brand-line bg-brand-light/40 px-5 py-4">
              <div className="flex items-end justify-between">
                <div className="text-sm text-brand-mute">Amount due</div>
                <div className="font-display text-2xl font-semibold text-brand-ink">
                  {formatMoney(outstanding, currency)}
                </div>
              </div>
            </div>

            {hasCard ? (
              <PayNowPanel
                token={params.token}
                amountLabel={formatMoney(outstanding, currency)}
              />
            ) : null}

            {banking ? (
              <div className="rounded-card border border-brand-line bg-white">
                <div className="flex items-center gap-2 border-b border-brand-line px-5 py-3 font-display font-semibold text-brand-ink">
                  <Building2 className="h-4 w-4 text-brand-mute" />
                  {hasCard ? "Or pay by EFT" : "Pay by EFT bank transfer"}
                </div>
                <dl className="divide-y divide-brand-line text-sm">
                  {[
                    ["Bank", banking.bankName],
                    ["Account holder", banking.accountHolder],
                    ["Account number", banking.accountNumber],
                    ["Branch code", banking.branchCode],
                    ["Use as reference", booking.reference],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between px-5 py-2.5"
                    >
                      <dt className="text-brand-mute">{label}</dt>
                      <dd className="text-right font-medium text-brand-ink">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="px-5 py-3 text-xs text-brand-mute">
                  Use the reference above so your host can match the payment.
                  Your booking is confirmed once the transfer is verified.
                </p>
              </div>
            ) : null}

            {!hasCard && !banking ? (
              <div className="rounded-card border border-brand-line bg-brand-light/40 px-5 py-6 text-center text-sm text-brand-mute">
                Online payment isn’t set up for this booking yet. Please contact
                your host to arrange payment.
              </div>
            ) : null}
          </section>
        )}

        <p className="mt-8 text-center text-xs text-brand-mute">
          Booked directly with {listing.name} on {brandName}. {brandName} never
          adds a booking fee.
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
