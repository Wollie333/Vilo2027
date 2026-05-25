"use client";

import {
  Calendar,
  Clock,
  CreditCard,
  Lock,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { createBookingAction } from "./actions";

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

function formatDuration(minutes: number | null): string | null {
  if (minutes == null || minutes <= 0) return null;
  const m = Math.trunc(minutes);
  if (m < 60) return `${m} min`;
  const hours = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${hours}h ${rem}min`;
}

const CANCELLATION_BLURB: Record<"flexible" | "moderate" | "strict", string> = {
  flexible: "Full refund up to 24 hours before the session.",
  moderate: "Full refund up to 5 days before the session.",
  strict: "50% refund up to 7 days before. No refund after.",
};

export function ExperienceBookingForm({
  listingId,
  listingName,
  basePrice,
  privateGroupPrice,
  currency,
  cancellationPolicy,
  instantBooking,
  durationMinutes,
  meetingPoint,
  sessionDate,
  participants,
  minParticipants,
  maxParticipants,
}: {
  listingId: string;
  listingName: string;
  basePrice: number;
  privateGroupPrice: number | null;
  currency: string;
  cancellationPolicy: "flexible" | "moderate" | "strict";
  instantBooking: boolean;
  durationMinutes: number | null;
  meetingPoint: string | null;
  /** Format: YYYY-MM-DDTHH:MM (local). */
  sessionDate: string;
  participants: number;
  minParticipants: number;
  maxParticipants: number;
}) {
  const [policyAck, setPolicyAck] = useState(false);
  const [count, setCount] = useState(participants);
  const [isPending, start] = useTransition();

  const calc = useMemo(() => {
    const headcountTotal = basePrice * count;
    const useGroupRate =
      privateGroupPrice != null &&
      privateGroupPrice > 0 &&
      count === maxParticipants &&
      privateGroupPrice < headcountTotal;
    return {
      headcountTotal,
      total: useGroupRate ? privateGroupPrice : headcountTotal,
      useGroupRate,
    };
  }, [basePrice, count, privateGroupPrice, maxParticipants]);

  const reserveDisabled = !policyAck || isPending;
  const duration = formatDuration(durationMinutes);

  // Pretty session date label.
  const sessionLabel = (() => {
    const d = new Date(`${sessionDate}:00`);
    return d.toLocaleString("en-ZA", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  })();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!policyAck) {
      toast.error("Please accept the policies to continue.");
      return;
    }
    start(async () => {
      const result = await createBookingAction({
        listing_id: listingId,
        scope: "experience",
        session_date: sessionDate,
        guests: count,
        payment_method: "paystack",
        policy_acknowledged: true,
        selected_addons: [],
      });
      if (result && !result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      {/* Left: session details + policy */}
      <div className="space-y-6">
        <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Your session
          </div>
          <div className="mt-3 space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-brand-mute">
                  When
                </div>
                <div className="mt-0.5 font-medium text-brand-ink">
                  {sessionLabel}
                </div>
              </div>
            </div>
            {duration ? (
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-brand-mute">
                    Duration
                  </div>
                  <div className="mt-0.5 font-medium text-brand-ink">
                    {duration}
                  </div>
                </div>
              </div>
            ) : null}
            {meetingPoint ? (
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-brand-mute">
                    Meeting point (full address shared after booking)
                  </div>
                  <div className="mt-0.5 whitespace-pre-line text-sm text-brand-ink">
                    {meetingPoint}
                  </div>
                </div>
              </div>
            ) : null}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-brand-mute">
                Participants
              </label>
              <div className="mt-1 inline-flex items-center gap-2 rounded border border-brand-line bg-brand-light/40 px-3 py-2">
                <Users className="h-4 w-4 text-brand-primary" />
                <select
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value, 10))}
                  className="bg-transparent text-sm font-medium text-brand-ink outline-none"
                  disabled={isPending}
                >
                  {Array.from(
                    { length: maxParticipants - minParticipants + 1 },
                    (_, i) => i + minParticipants,
                  ).map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "person" : "people"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            <CreditCard className="h-3.5 w-3.5" /> Payment
          </div>
          <div className="mt-3 rounded border border-brand-line bg-brand-light/40 px-3 py-3 text-sm">
            <div className="font-medium text-brand-ink">Card via Paystack</div>
            <p className="mt-1 text-xs text-brand-mute">
              You&rsquo;ll be taken to Paystack&rsquo;s secure checkout to
              complete payment.
            </p>
          </div>
        </section>

        <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Cancellation policy
          </div>
          <p className="mt-2 text-sm text-brand-dark">
            <span className="font-medium capitalize">
              {cancellationPolicy}.
            </span>{" "}
            {CANCELLATION_BLURB[cancellationPolicy]}
          </p>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded border border-brand-line bg-brand-light/40 px-3 py-3">
            <Checkbox
              checked={policyAck}
              onCheckedChange={(v) => setPolicyAck(v === true)}
              disabled={isPending}
            />
            <span className="text-sm text-brand-dark">
              I&rsquo;ve read the cancellation policy and house rules.
            </span>
          </label>
        </section>
      </div>

      {/* Right: order summary */}
      <aside className="lg:pl-2">
        <div className="sticky top-20 rounded-card border border-brand-line bg-white p-5 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            {listingName}
          </div>
          {instantBooking ? (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-pill bg-brand-secondary px-2 py-0.5 text-[10px] font-bold text-white">
              <Zap className="h-3 w-3" /> Instant book
            </div>
          ) : null}

          <dl className="mt-4 space-y-2 text-sm">
            {calc.useGroupRate ? (
              <div className="flex items-center justify-between">
                <dt className="text-brand-mute">
                  Private group rate ({count}{" "}
                  {count === 1 ? "person" : "people"})
                </dt>
                <dd className="font-medium text-brand-dark">
                  {fmtR(calc.total, currency)}
                </dd>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <dt className="text-brand-mute">
                  {fmtR(basePrice, currency)} × {count}{" "}
                  {count === 1 ? "person" : "people"}
                </dt>
                <dd className="font-medium text-brand-dark">
                  {fmtR(calc.headcountTotal, currency)}
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-brand-line pt-2">
              <dt className="font-display font-semibold text-brand-ink">
                Total
              </dt>
              <dd className="font-display font-bold text-brand-ink">
                {fmtR(calc.total, currency)}
              </dd>
            </div>
          </dl>

          <Button
            type="submit"
            disabled={reserveDisabled}
            className="mt-5 w-full gap-1.5"
            size="lg"
          >
            <Lock className="h-4 w-4" />
            {isPending ? "Starting…" : "Reserve and pay"}
          </Button>
          <p className="mt-2 text-center text-[10px] text-brand-mute">
            You&rsquo;ll be redirected to Paystack to complete payment.
          </p>
        </div>
      </aside>
    </form>
  );
}
