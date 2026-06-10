import {
  BadgeCheck,
  Ban,
  Baby,
  Check,
  Cigarette,
  CigaretteOff,
  Clock,
  LogIn,
  LogOut,
  Moon,
  PartyPopper,
  PawPrint,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import {
  getListingPolicySummary,
  type ListingPolicySummary,
  type PolicyContent,
} from "@/lib/policy/listing-summary";

import { PolicyDialog, type PolicyDialogData } from "./PolicyDialog";

type Content = PolicyContent;

const t = (s: string | null | undefined) => (s ? s.slice(0, 5) : "—");

function ruleWhen(daysBefore: number) {
  if (daysBefore <= 0) return "Less than 24 hours before";
  return `${daysBefore}+ day${daysBefore === 1 ? "" : "s"} before check-in`;
}
function refundColour(percent: number) {
  if (percent >= 100) return "text-brand-primary";
  if (percent <= 0) return "text-status-cancelled";
  return "text-status-pending";
}

/**
 * Guest-facing "Things to know" — the single source of truth for what a guest
 * agrees to. Everything here is driven by the listing's effective policies
 * (resolve: room → listing-wide → host default), NOT legacy listing columns:
 *   • Cancellation: the real refund schedule, inline.
 *   • Check-in / out: the check_in_out policy (falls back to listing times only
 *     when no policy resolves).
 *   • House rules: the house_rules policy flags as chips.
 * Booking terms + privacy are platform-wide (Vilo-authored) and linked at the
 * foot. Each policy keeps a "Read full policy" popup for the complete text.
 */
export async function ThingsToKnow({
  listingId,
  brandName,
  checkInTimeFallback,
  checkOutTimeFallback,
  maxGuests,
  minNights,
  houseRulesText,
  summary: summaryProp,
}: {
  listingId: string;
  brandName: string;
  checkInTimeFallback: string | null;
  checkOutTimeFallback: string | null;
  maxGuests: number | null;
  minNights: number | null;
  houseRulesText: string | null;
  // Optional pre-fetched summary so the caller can derive a refund note from
  // the same data without a second RPC round-trip.
  summary?: ListingPolicySummary;
}) {
  const summary = summaryProp ?? (await getListingPolicySummary(listingId));

  const cancel = summary.cancellation;
  const cio = summary.check_in_out;
  const hr = summary.house_rules;

  const checkIn = cio?.check_in_time ?? checkInTimeFallback;
  const checkOut = cio?.check_out_time ?? checkOutTimeFallback;

  const topRules = cancel
    ? [...cancel.rules]
        .sort((a, b) => b.days_before - a.days_before)
        .slice(0, 4)
    : [];

  const cancelDialog: PolicyDialogData | null = cancel
    ? {
        type: "cancellation",
        name: cancel.name,
        summary: cancel.summary,
        isNonRefundable: cancel.is_non_refundable,
        rules: cancel.rules,
        bodyHtml: cancel.body_html,
      }
    : null;
  const cioDialog: PolicyDialogData | null = cio
    ? {
        type: "check_in_out",
        name: cio.name,
        summary: cio.summary,
        checkInTime: cio.check_in_time,
        checkOutTime: cio.check_out_time,
        checkInMethod: cio.check_in_method,
        bodyHtml: cio.body_html,
      }
    : null;
  const hrDialog: PolicyDialogData | null = hr
    ? {
        type: "house_rules",
        name: hr.name,
        summary: hr.summary,
        petsAllowed: hr.pets_allowed,
        smokingAllowed: hr.smoking_allowed,
        partiesAllowed: hr.parties_allowed,
        childrenWelcome: hr.children_welcome,
        quietHoursStart: hr.quiet_hours_start,
        quietHoursEnd: hr.quiet_hours_end,
        bodyHtml: hr.body_html,
      }
    : null;

  const chips = hr ? houseRuleChips(hr) : [];

  return (
    <div className="mt-6 grid gap-6 md:grid-cols-3">
      {/* ── House rules ── */}
      <div>
        <div className="font-display font-semibold text-brand-ink">
          House rules
        </div>
        <ul className="mt-3 space-y-2 text-sm text-brand-ink/85">
          <li className="flex items-center gap-2">
            <LogIn className="h-4 w-4 text-brand-mute" /> Check-in after{" "}
            {t(checkIn)}
          </li>
          <li className="flex items-center gap-2">
            <LogOut className="h-4 w-4 text-brand-mute" /> Check-out by{" "}
            {t(checkOut)}
          </li>
          {maxGuests != null ? (
            <li className="flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-mute" /> {maxGuests} guests
              maximum
            </li>
          ) : null}
          {minNights != null ? (
            <li className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-brand-mute" /> {minNights} night
              {minNights === 1 ? "" : "s"} minimum
            </li>
          ) : null}
        </ul>

        {chips.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {chips.map((c) => {
              const Icon = c.icon;
              return (
                <span
                  key={c.label}
                  className="inline-flex items-center gap-1 rounded-pill bg-brand-light px-2 py-1 text-[11px] text-brand-secondary"
                >
                  <Icon className="h-3 w-3" /> {c.label}
                </span>
              );
            })}
          </div>
        ) : null}

        {houseRulesText ? (
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-brand-dark">
            {houseRulesText}
          </p>
        ) : null}

        {hrDialog ? (
          <div className="mt-3">
            <PolicyDialog data={hrDialog} />
          </div>
        ) : null}
      </div>

      {/* ── Safety & property ── */}
      <div>
        <div className="font-display font-semibold text-brand-ink">
          Safety &amp; property
        </div>
        <ul className="mt-3 space-y-2 text-sm text-brand-ink/85">
          <li className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-mute" /> {brandName}{" "}
            holds payments until check-in
          </li>
          <li className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-brand-mute" /> Host identity
            verified
          </li>
          {hr?.parties_allowed != null ? (
            <li className="flex items-center gap-2">
              {hr.parties_allowed ? (
                <PartyPopper className="h-4 w-4 text-brand-mute" />
              ) : (
                <Ban className="h-4 w-4 text-brand-mute" />
              )}
              {hr.parties_allowed
                ? "Parties or events allowed"
                : "No parties or events"}
            </li>
          ) : null}
          {hr?.quiet_hours_start && hr?.quiet_hours_end ? (
            <li className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-brand-mute" /> Quiet hours{" "}
              {t(hr.quiet_hours_start)}–{t(hr.quiet_hours_end)}
            </li>
          ) : null}
        </ul>
      </div>

      {/* ── Cancellation (real refund schedule) ── */}
      <div>
        <div className="font-display font-semibold text-brand-ink">
          Cancellation
        </div>
        {cancelDialog ? (
          <>
            <div className="mt-2 text-sm font-medium text-brand-ink">
              {cancel!.name}
            </div>
            {cancel!.is_non_refundable ? (
              <p className="mt-2 rounded border border-status-cancelled/20 bg-status-cancelled/5 px-3 py-2 text-sm font-medium text-brand-ink">
                Non-refundable — no refund at any time.
              </p>
            ) : topRules.length ? (
              <ul className="mt-2 space-y-1.5">
                {topRules.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="text-brand-mute">
                      {ruleWhen(r.days_before)}
                    </span>
                    <span
                      className={`font-semibold tabular-nums ${refundColour(r.refund_percent)}`}
                    >
                      {r.refund_percent}%
                    </span>
                  </li>
                ))}
              </ul>
            ) : cancel!.summary ? (
              <p className="mt-2 text-sm leading-relaxed text-brand-dark">
                {cancel!.summary}
              </p>
            ) : null}
            <div className="mt-3">
              <PolicyDialog data={cancelDialog} />
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-brand-mute">
            Contact the host for cancellation terms.
          </p>
        )}

        {cioDialog ? (
          <div className="mt-4 text-xs text-brand-mute">
            <PolicyDialog
              data={cioDialog}
              trigger={
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-brand-ink"
                >
                  Check-in &amp; out details
                </button>
              }
            />
          </div>
        ) : null}
      </div>

      {/* ── Platform legal (Vilo-authored) ── */}
      <div className="mt-1 border-t border-brand-line pt-4 text-xs text-brand-mute md:col-span-3">
        By booking you agree to the{" "}
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-brand-ink"
        >
          booking terms
        </a>{" "}
        and{" "}
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-brand-ink"
        >
          privacy notice
        </a>
        .
      </div>
    </div>
  );
}

function houseRuleChips(hr: Content) {
  const chips: { icon: typeof PawPrint; label: string }[] = [];
  if (hr.pets_allowed != null)
    chips.push({
      icon: hr.pets_allowed ? PawPrint : X,
      label: hr.pets_allowed ? "Pets OK" : "No pets",
    });
  if (hr.smoking_allowed != null)
    chips.push({
      icon: hr.smoking_allowed ? Cigarette : CigaretteOff,
      label: hr.smoking_allowed ? "Smoking OK" : "No smoking",
    });
  if (hr.children_welcome != null)
    chips.push({
      icon: hr.children_welcome ? Baby : X,
      label: hr.children_welcome ? "Children welcome" : "No children",
    });
  if (hr.parties_allowed != null)
    chips.push({
      icon: hr.parties_allowed ? Check : Ban,
      label: hr.parties_allowed ? "Parties OK" : "No parties",
    });
  return chips;
}
