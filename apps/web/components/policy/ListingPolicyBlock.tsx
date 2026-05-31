import {
  RotateCcw,
  CalendarClock,
  ScrollText,
  FileText,
  Lock,
} from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";

import { PolicyDialog, type PolicyDialogData } from "./PolicyDialog";

type SummaryCancellation = {
  name: string;
  summary: string | null;
  is_non_refundable: boolean;
  preset: string | null;
  rules: { days_before: number; refund_percent: number; label: string }[];
  body_html: string | null;
};
type SummaryContent = {
  name: string;
  summary: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  check_in_method?: "self" | "host" | "reception" | null;
  pets_allowed?: boolean | null;
  smoking_allowed?: boolean | null;
  parties_allowed?: boolean | null;
  children_welcome?: boolean | null;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  body_html: string | null;
};
type Summary = {
  cancellation?: SummaryCancellation;
  check_in_out?: SummaryContent;
  house_rules?: SummaryContent;
  booking_terms?: SummaryContent;
  privacy?: SummaryContent;
};

const ICON = {
  cancellation: RotateCcw,
  check_in_out: CalendarClock,
  house_rules: ScrollText,
  booking_terms: FileText,
  privacy: Lock,
} as const;

/**
 * Guest-facing policy summary with a "Read full policy" popup, driven by the
 * listing's effective policies. The RPC resolves each type to the explicit
 * listing-wide assignment, else the host's active default (see migration
 * 20260531000004), so real policies surface even without per-listing wiring.
 * Renders nothing when no policies resolve, so callers can keep their own
 * legacy fallback alongside it.
 */
export async function ListingPolicyBlock({
  listingId,
  className,
}: {
  listingId: string;
  className?: string;
}) {
  const supabase = createServerClient();
  const { data } = await supabase.rpc("get_listing_policy_summary", {
    p_listing_id: listingId,
  });
  const summary = (data ?? {}) as unknown as Summary;

  const items: PolicyDialogData[] = [];
  if (summary.cancellation) {
    items.push({
      type: "cancellation",
      name: summary.cancellation.name,
      summary: summary.cancellation.summary,
      isNonRefundable: summary.cancellation.is_non_refundable,
      rules: summary.cancellation.rules,
      bodyHtml: summary.cancellation.body_html,
    });
  }
  if (summary.check_in_out) {
    items.push({
      type: "check_in_out",
      name: summary.check_in_out.name,
      summary: summary.check_in_out.summary,
      checkInTime: summary.check_in_out.check_in_time,
      checkOutTime: summary.check_in_out.check_out_time,
      checkInMethod: summary.check_in_out.check_in_method,
      bodyHtml: summary.check_in_out.body_html,
    });
  }
  if (summary.house_rules) {
    items.push({
      type: "house_rules",
      name: summary.house_rules.name,
      summary: summary.house_rules.summary,
      petsAllowed: summary.house_rules.pets_allowed,
      smokingAllowed: summary.house_rules.smoking_allowed,
      partiesAllowed: summary.house_rules.parties_allowed,
      childrenWelcome: summary.house_rules.children_welcome,
      quietHoursStart: summary.house_rules.quiet_hours_start,
      quietHoursEnd: summary.house_rules.quiet_hours_end,
      bodyHtml: summary.house_rules.body_html,
    });
  }
  if (summary.booking_terms) {
    items.push({
      type: "booking_terms",
      name: summary.booking_terms.name,
      summary: summary.booking_terms.summary,
      bodyHtml: summary.booking_terms.body_html,
    });
  }
  if (summary.privacy) {
    items.push({
      type: "privacy",
      name: summary.privacy.name,
      summary: summary.privacy.summary,
      bodyHtml: summary.privacy.body_html,
    });
  }

  if (items.length === 0) return null;

  return (
    <div
      className={`rounded-card border border-brand-line bg-white p-4 shadow-card ${className ?? ""}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
        Policies
      </div>
      <ul className="mt-2 space-y-2.5">
        {items.map((item) => {
          const Icon = ICON[item.type];
          return (
            <li key={item.type} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-brand-ink">
                  {item.name}
                </div>
                {item.summary ? (
                  <div className="text-xs text-brand-mute">{item.summary}</div>
                ) : null}
              </div>
              <PolicyDialog data={item} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
