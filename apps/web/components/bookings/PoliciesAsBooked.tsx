import {
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  ScrollText,
  ShieldCheck,
} from "lucide-react";

import type { PoliciesAsBooked as PoliciesAsBookedData } from "@/lib/bookings/policiesAsBooked";

// Read-only "Policies (as booked)" panel — renders the frozen policy_snapshots a
// booking was made under (cancellation schedule, check-in/out, house rules,
// booking T&C) plus the accepted Wielo terms/privacy versions. Pure component
// (no hooks) so it renders in both the host server page and the client
// BookingDetail tab, and the guest trip server page. Shared so both ends show
// the SAME immutable record.

function fmtAcceptedDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium" }).format(d);
}

export function PoliciesAsBooked({
  data,
  audience,
}: {
  data: PoliciesAsBookedData;
  audience: "host" | "guest";
}) {
  if (!data.hasAny) return null;

  const acceptedDate = fmtAcceptedDate(data.acknowledgedAt);
  const you = audience === "guest" ? "You" : "The guest";

  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-brand-line px-6 py-4">
        <div className="inline-flex items-center gap-2 font-display text-[15px] font-bold text-brand-ink">
          <ShieldCheck className="h-4 w-4 text-brand-primary" /> Policies (as
          booked)
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-light px-2.5 py-1 text-[11px] font-medium text-brand-mute">
          <Lock className="h-3 w-3" /> Frozen at booking
        </span>
      </div>

      <div className="divide-y divide-brand-line">
        {/* Cancellation schedule */}
        {data.cancellation ? (
          <div className="px-6 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13.5px] font-semibold text-brand-ink">
                {data.cancellation.name}
              </span>
              {data.cancellation.isNonRefundable ? (
                <span className="rounded-pill bg-status-cancelled/10 px-2 py-0.5 text-[10.5px] font-semibold text-status-cancelled">
                  Non-refundable
                </span>
              ) : null}
            </div>
            {data.cancellation.summary ? (
              <p className="mt-1 text-[12.5px] text-brand-mute">
                {data.cancellation.summary}
              </p>
            ) : null}
            {data.cancellation.isNonRefundable ? (
              <p className="mt-2 text-[12.5px] text-brand-mute">
                This booking is non-refundable — no refund applies on
                cancellation.
              </p>
            ) : data.cancellation.rules.length > 0 ? (
              <ul className="mt-2.5 space-y-1.5">
                {data.cancellation.rules.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 text-[13px]"
                  >
                    <span className="text-brand-mute">
                      {r.label ??
                        (r.daysBefore >= 1
                          ? `${r.daysBefore}+ day${
                              r.daysBefore === 1 ? "" : "s"
                            } before check-in`
                          : "Less than 24 hours before")}
                    </span>
                    <span className="num shrink-0 font-semibold text-brand-ink">
                      {r.refundPercent}% refund
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {/* Check-in / out */}
        {data.checkInOut ? (
          <div className="px-6 py-4">
            <div className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-brand-ink">
              <Clock className="h-4 w-4 text-brand-mute" />
              {data.checkInOut.name}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1.5 text-[13px]">
              {data.checkInOut.checkInTime ? (
                <span className="text-brand-mute">
                  Check-in from{" "}
                  <span className="font-semibold text-brand-ink">
                    {data.checkInOut.checkInTime}
                  </span>
                </span>
              ) : null}
              {data.checkInOut.checkOutTime ? (
                <span className="text-brand-mute">
                  Check-out by{" "}
                  <span className="font-semibold text-brand-ink">
                    {data.checkInOut.checkOutTime}
                  </span>
                </span>
              ) : null}
              {data.checkInOut.checkInMethod ? (
                <span className="text-brand-mute">
                  Method{" "}
                  <span className="font-semibold text-brand-ink">
                    {data.checkInOut.checkInMethod}
                  </span>
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* House rules */}
        {data.houseRules &&
        (data.houseRules.body || data.houseRules.summary) ? (
          <div className="px-6 py-4">
            <div className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-brand-ink">
              <ScrollText className="h-4 w-4 text-brand-mute" />
              {data.houseRules.name}
            </div>
            <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-brand-mute">
              {data.houseRules.body ?? data.houseRules.summary}
            </p>
          </div>
        ) : null}

        {/* Booking terms & conditions */}
        {data.bookingTerms &&
        (data.bookingTerms.body || data.bookingTerms.summary) ? (
          <div className="px-6 py-4">
            <div className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-brand-ink">
              <FileText className="h-4 w-4 text-brand-mute" />
              {data.bookingTerms.name}
            </div>
            <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-brand-mute">
              {data.bookingTerms.body ?? data.bookingTerms.summary}
            </p>
          </div>
        ) : null}

        {/* Acceptance record */}
        {data.acceptedTermsVersion != null ||
        data.acceptedPrivacyVersion != null ||
        acceptedDate ? (
          <div className="flex items-start gap-2 bg-brand-light/50 px-6 py-3.5 text-[12px] text-brand-mute">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-confirmed" />
            <span>
              {you} accepted these policies
              {data.acceptedTermsVersion != null
                ? `, plus Wielo Terms v${data.acceptedTermsVersion}`
                : ""}
              {data.acceptedPrivacyVersion != null
                ? ` and Privacy v${data.acceptedPrivacyVersion}`
                : ""}
              {acceptedDate ? ` on ${acceptedDate}` : ""}. The host cannot
              change them after booking.
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
