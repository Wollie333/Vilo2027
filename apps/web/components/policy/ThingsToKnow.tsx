import {
  BadgeCheck,
  Ban,
  Baby,
  Check,
  Cigarette,
  CigaretteOff,
  Clock,
  Home,
  LogIn,
  LogOut,
  Moon,
  PartyPopper,
  PawPrint,
  RotateCcw,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  getListingPolicySummary,
  type ListingPolicySummary,
  type PolicyContent,
} from "@/lib/policy/listing-summary";

import { PolicyDialog, type PolicyDialogData } from "./PolicyDialog";

type Content = PolicyContent;

// "HH:MM" from a "HH:MM:SS" time, or an em dash when absent.
const hhmm = (s: string | null | undefined) => (s ? s.slice(0, 5) : "—");

function refundColour(percent: number) {
  if (percent >= 100) return "text-brand-primary";
  if (percent <= 0) return "text-status-cancelled";
  return "text-status-pending";
}

/**
 * Guest-facing "Things to know" — the single source of truth for what a guest
 * agrees to, driven by the listing's effective policies (room → listing-wide →
 * host default). Three clean cards: House rules, Safety & property, and the real
 * Cancellation refund schedule. Booking terms + privacy are platform-wide and
 * linked at the foot; each policy keeps a "Read full policy" popup.
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
  summary?: ListingPolicySummary;
}) {
  const [summary, t] = await Promise.all([
    summaryProp
      ? Promise.resolve(summaryProp)
      : getListingPolicySummary(listingId),
    getTranslations("thingsToKnow"),
  ]);

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
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {/* ── House rules ── */}
        <Card icon={Home} title={t("hrTitle")}>
          <ul className="space-y-2.5 text-sm text-brand-ink/85">
            <Row icon={LogIn}>{t("checkInAfter", { time: hhmm(checkIn) })}</Row>
            <Row icon={LogOut}>{t("checkOutBy", { time: hhmm(checkOut) })}</Row>
            {maxGuests != null ? (
              <Row icon={Users}>{t("maxGuests", { count: maxGuests })}</Row>
            ) : null}
            {minNights != null ? (
              <Row icon={Clock}>{t("minNights", { count: minNights })}</Row>
            ) : null}
          </ul>

          {chips.length ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {chips.map((c) => {
                const Icon = c.icon;
                return (
                  <span
                    key={c.key}
                    className="inline-flex items-center gap-1 rounded-pill bg-brand-light px-2.5 py-1 text-[11px] text-brand-secondary"
                  >
                    <Icon className="h-3 w-3" /> {t(c.key)}
                  </span>
                );
              })}
            </div>
          ) : null}

          {houseRulesText ? (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-brand-dark">
              {houseRulesText}
            </p>
          ) : null}

          {hrDialog ? (
            <div className="mt-4">
              <PolicyDialog data={hrDialog} />
            </div>
          ) : null}
        </Card>

        {/* ── Safety & property ── */}
        <Card icon={ShieldCheck} title={t("safetyTitle")}>
          <ul className="space-y-2.5 text-sm text-brand-ink/85">
            <Row icon={ShieldCheck}>
              {t("holdsPayments", { brand: brandName })}
            </Row>
            <Row icon={BadgeCheck}>{t("hostVerified")}</Row>
            {hr?.parties_allowed != null ? (
              <Row icon={hr.parties_allowed ? PartyPopper : Ban}>
                {hr.parties_allowed ? t("partiesAllowed") : t("noParties")}
              </Row>
            ) : null}
            {hr?.quiet_hours_start && hr?.quiet_hours_end ? (
              <Row icon={Moon}>
                {t("quietHours", {
                  start: hhmm(hr.quiet_hours_start),
                  end: hhmm(hr.quiet_hours_end),
                })}
              </Row>
            ) : null}
          </ul>
        </Card>

        {/* ── Cancellation (real refund schedule) ── */}
        <Card icon={RotateCcw} title={t("cancelTitle")}>
          {cancelDialog ? (
            <>
              <div className="text-sm font-medium text-brand-ink">
                {cancel!.name}
              </div>
              {cancel!.is_non_refundable ? (
                <p className="mt-2 rounded border border-status-cancelled/20 bg-status-cancelled/5 px-3 py-2 text-sm font-medium text-brand-ink">
                  {t("nonRefundable")}
                </p>
              ) : topRules.length ? (
                <ul className="mt-3 space-y-1.5">
                  {topRules.map((r, i) => (
                    <li
                      key={i}
                      className="flex items-baseline justify-between gap-3 text-sm"
                    >
                      <span className="text-brand-mute">
                        {r.days_before <= 0
                          ? t("ruleLessThan24")
                          : t("ruleDaysBefore", { count: r.days_before })}
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
              <div className="mt-4">
                <PolicyDialog data={cancelDialog} />
              </div>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-brand-mute">
              {t("contactHost")}
            </p>
          )}

          {cioDialog ? (
            <div className="mt-4 border-t border-brand-line pt-3 text-xs text-brand-mute">
              <PolicyDialog
                data={cioDialog}
                trigger={
                  <button
                    type="button"
                    className="underline underline-offset-2 hover:text-brand-ink"
                  >
                    {t("checkInOutDetails")}
                  </button>
                }
              />
            </div>
          ) : null}
        </Card>
      </div>

      {/* ── Platform legal (Vilo-authored) ── */}
      <p className="text-xs leading-relaxed text-brand-mute">
        {t.rich("legal", {
          terms: (chunks) => (
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-brand-ink"
            >
              {chunks}
            </a>
          ),
          privacy: (chunks) => (
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-brand-ink"
            >
              {chunks}
            </a>
          ),
        })}
      </p>
    </div>
  );
}

// One card in the grid: icon-badge header + content. Keeps the three groups
// visually distinct and roomy instead of three bare columns of small text.
function Card({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-brand-accent text-brand-secondary">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <h4 className="font-display text-base font-semibold text-brand-ink">
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}

function Row({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2.5">
      <Icon className="h-4 w-4 shrink-0 text-brand-mute" />
      <span>{children}</span>
    </li>
  );
}

function houseRuleChips(hr: Content) {
  const chips: { icon: LucideIcon; key: string }[] = [];
  if (hr.pets_allowed != null)
    chips.push({
      icon: hr.pets_allowed ? PawPrint : X,
      key: hr.pets_allowed ? "chipPetsOk" : "chipNoPets",
    });
  if (hr.smoking_allowed != null)
    chips.push({
      icon: hr.smoking_allowed ? Cigarette : CigaretteOff,
      key: hr.smoking_allowed ? "chipSmokingOk" : "chipNoSmoking",
    });
  if (hr.children_welcome != null)
    chips.push({
      icon: hr.children_welcome ? Baby : X,
      key: hr.children_welcome ? "chipChildrenWelcome" : "chipNoChildren",
    });
  if (hr.parties_allowed != null)
    chips.push({
      icon: hr.parties_allowed ? Check : Ban,
      key: hr.parties_allowed ? "chipPartiesOk" : "chipNoParties",
    });
  return chips;
}
