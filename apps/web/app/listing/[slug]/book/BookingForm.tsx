"use client";

import {
  BedDouble,
  CreditCard,
  Lock,
  ShieldCheck,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { createBookingAction } from "./actions";

export type BookedRoom = {
  id: string;
  name: string;
  basePrice: number;
  cleaningFee: number;
  maxGuests: number;
};

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

const CANCELLATION_BLURB: Record<"flexible" | "moderate" | "strict", string> = {
  flexible: "Full refund up to 24 hours before check-in.",
  moderate: "Full refund up to 5 days before check-in.",
  strict: "50% refund up to 7 days before. No refund after.",
};

export function BookingForm({
  listingId,
  listingSlug,
  listingName,
  basePrice,
  cleaningFee,
  currency,
  cancellationPolicy,
  instantBooking,
  checkIn,
  checkOut,
  nights,
  guests,
  maxGuests,
  guestEmail,
  scope,
  rooms,
}: {
  listingId: string;
  listingSlug: string;
  listingName: string;
  basePrice: number;
  cleaningFee: number;
  currency: string;
  cancellationPolicy: "flexible" | "moderate" | "strict";
  instantBooking: boolean;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  maxGuests: number;
  guestEmail: string;
  scope: "whole_listing" | "rooms";
  rooms: BookedRoom[];
}) {
  const router = useRouter();
  const [policyAck, setPolicyAck] = useState(false);
  const [guestCount, setGuestCount] = useState(guests);
  const [isPending, start] = useTransition();
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>(() =>
    rooms.map((r) => r.id),
  );

  const activeRooms = useMemo(
    () => rooms.filter((r) => selectedRoomIds.includes(r.id)),
    [rooms, selectedRoomIds],
  );

  const subtotal =
    scope === "rooms"
      ? activeRooms.reduce((acc, r) => acc + r.basePrice * nights, 0)
      : basePrice * nights;
  const cleaningTotal =
    scope === "rooms"
      ? activeRooms.reduce((acc, r) => acc + r.cleaningFee, 0)
      : cleaningFee;
  const total = subtotal + cleaningTotal;
  const reserveDisabled =
    !policyAck || isPending || (scope === "rooms" && activeRooms.length === 0);

  function removeRoom(roomId: string) {
    const remaining = selectedRoomIds.filter((id) => id !== roomId);
    if (remaining.length === 0) {
      // Removing the last room → back to the listing to start over.
      router.push(`/listing/${listingSlug}`);
      return;
    }
    setSelectedRoomIds(remaining);
    // Reflect the change in the URL so a reload survives.
    const qs = new URLSearchParams();
    qs.set("from", checkIn);
    qs.set("to", checkOut);
    qs.set("guests", String(guestCount));
    qs.set("room_ids", remaining.join(","));
    router.replace(`/listing/${listingSlug}/book?${qs.toString()}`);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!policyAck) {
      toast.error("Please accept the policies to continue.");
      return;
    }
    start(async () => {
      const result = await createBookingAction({
        listing_id: listingId,
        scope,
        room_ids: scope === "rooms" ? activeRooms.map((r) => r.id) : undefined,
        check_in: checkIn,
        check_out: checkOut,
        guests: guestCount,
        payment_method: "paystack",
        policy_acknowledged: true,
      });
      // Success path is a server-side redirect to Paystack; we only get
      // here on failure.
      if (result && !result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      {/* Left: trip details + payment + policy */}
      <div className="space-y-6">
        <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Your trip
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-brand-mute">
                Check in
              </div>
              <div className="mt-0.5 font-medium text-brand-ink">{checkIn}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-brand-mute">
                Check out
              </div>
              <div className="mt-0.5 font-medium text-brand-ink">
                {checkOut}
              </div>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-brand-mute">
                Guests
              </label>
              <div className="mt-1 inline-flex items-center gap-2 rounded border border-brand-line bg-brand-light/40 px-3 py-2">
                <Users className="h-4 w-4 text-brand-primary" />
                <select
                  value={guestCount}
                  onChange={(e) => setGuestCount(parseInt(e.target.value, 10))}
                  className="bg-transparent text-sm font-medium text-brand-ink outline-none"
                  disabled={isPending}
                >
                  {Array.from(
                    { length: Math.max(1, maxGuests) },
                    (_, i) => i + 1,
                  ).map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "guest" : "guests"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {scope === "rooms" ? (
          <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Your rooms ({activeRooms.length})
            </div>
            <ul className="mt-3 space-y-2">
              {activeRooms.map((r) => (
                <li
                  key={r.id}
                  className="flex items-start justify-between gap-3 rounded border border-brand-line bg-brand-light/40 px-3 py-2.5"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-brand-primary">
                      <BedDouble className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-brand-ink">
                        {r.name}
                      </div>
                      <div className="text-[11px] text-brand-mute">
                        {fmtR(r.basePrice, currency)} × {nights}{" "}
                        {nights === 1 ? "night" : "nights"}
                        {r.cleaningFee > 0
                          ? ` · ${fmtR(r.cleaningFee, currency)} cleaning`
                          : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-brand-dark">
                      {fmtR(r.basePrice * nights + r.cleaningFee, currency)}
                    </span>
                    {activeRooms.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeRoom(r.id)}
                        className="rounded p-1 text-brand-mute hover:bg-white hover:text-status-cancelled"
                        aria-label={`Remove ${r.name}`}
                        disabled={isPending}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Payment
          </div>
          <div className="mt-3 flex items-start gap-3 rounded border-2 border-brand-primary bg-brand-accent/40 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-primary">
              <CreditCard className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-brand-ink">
                Paystack
              </div>
              <div className="mt-0.5 text-xs text-brand-mute">
                Card &amp; instant EFT — secure checkout opens after Reserve.
              </div>
            </div>
            <span className="rounded-pill bg-brand-primary px-2 py-0.5 text-[9px] font-bold text-white">
              SELECTED
            </span>
          </div>
          <div className="mt-3 rounded border border-dashed border-brand-line bg-brand-light/40 p-3 text-xs text-brand-mute">
            PayPal and manual EFT land later. For now every booking goes through
            Paystack.
          </div>
        </section>

        <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Cancellation policy
          </div>
          <div className="mt-2 flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
            <p className="text-sm text-brand-dark">
              <span className="font-medium capitalize">
                {cancellationPolicy}.
              </span>{" "}
              {CANCELLATION_BLURB[cancellationPolicy]}
            </p>
          </div>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded border border-brand-line bg-brand-light/40 p-3">
            <Checkbox
              checked={policyAck}
              onCheckedChange={(v) => setPolicyAck(v === true)}
              className="mt-0.5"
              disabled={isPending}
            />
            <span className="text-sm text-brand-ink">
              I&rsquo;ve read the cancellation policy and house rules.
            </span>
          </label>
        </section>
      </div>

      {/* Right: price summary + reserve */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <div className="font-display text-lg font-semibold text-brand-ink">
            Price summary
          </div>
          <div className="mt-1 text-xs text-brand-mute">{listingName}</div>

          {instantBooking ? (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-pill bg-brand-secondary px-2 py-0.5 text-[10px] font-bold text-white">
              <Zap className="h-3 w-3" /> Instant book
            </div>
          ) : null}

          <dl className="mt-5 space-y-2 text-sm">
            {scope === "rooms" ? (
              <div className="flex items-center justify-between">
                <dt className="text-brand-mute">
                  {activeRooms.length}{" "}
                  {activeRooms.length === 1 ? "room" : "rooms"} × {nights}{" "}
                  {nights === 1 ? "night" : "nights"}
                </dt>
                <dd className="font-medium text-brand-dark">
                  {fmtR(subtotal, currency)}
                </dd>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <dt className="text-brand-mute">
                  {fmtR(basePrice, currency)} × {nights}{" "}
                  {nights === 1 ? "night" : "nights"}
                </dt>
                <dd className="font-medium text-brand-dark">
                  {fmtR(subtotal, currency)}
                </dd>
              </div>
            )}
            {cleaningTotal > 0 ? (
              <div className="flex items-center justify-between">
                <dt className="text-brand-mute">
                  {scope === "rooms" ? "Cleaning fees" : "Cleaning fee"}
                </dt>
                <dd className="font-medium text-brand-dark">
                  {fmtR(cleaningTotal, currency)}
                </dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between border-t border-brand-line pt-3">
              <dt className="font-display font-semibold text-brand-ink">
                Total
              </dt>
              <dd className="font-display text-lg font-bold text-brand-ink">
                {fmtR(total, currency)}
              </dd>
            </div>
          </dl>

          <Button
            type="submit"
            size="lg"
            className="mt-5 w-full gap-1.5"
            disabled={reserveDisabled}
          >
            <Lock className="h-4 w-4" />
            {isPending ? "Redirecting to Paystack…" : "Reserve and pay"}
          </Button>

          <p className="mt-3 text-center text-[10px] text-brand-mute">
            Paid as <span className="font-mono">{guestEmail}</span>.
            You&rsquo;ll be redirected to Paystack to complete payment.
          </p>
        </div>
      </aside>
    </form>
  );
}
