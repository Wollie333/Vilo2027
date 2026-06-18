import { createServerClient } from "@/lib/supabase/server";

// Shared shape + fetch for a listing's effective policies (get_listing_policy
// _summary resolves room → listing-wide → host default). Used by the public
// listing page (refund note + ThingsToKnow) so both read one source.

export type PolicyCancellation = {
  name: string;
  summary: string | null;
  is_non_refundable: boolean;
  preset: string | null;
  rules: { days_before: number; refund_percent: number; label: string }[];
  body_html: string | null;
};
export type PolicyContent = {
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
export type ListingPolicySummary = {
  cancellation?: PolicyCancellation;
  check_in_out?: PolicyContent;
  house_rules?: PolicyContent;
  // The host's own property Terms & Conditions (resolver: room → listing-wide →
  // host default). Surfaced at checkout alongside Vilo's platform terms.
  booking_terms?: PolicyContent;
};

export async function getListingPolicySummary(
  listingId: string,
  roomId?: string | null,
): Promise<ListingPolicySummary> {
  const supabase = createServerClient();
  const { data } = await supabase.rpc("get_listing_policy_summary", {
    p_listing_id: listingId,
    ...(roomId ? { p_room_id: roomId } : {}),
  });
  return (data ?? {}) as unknown as ListingPolicySummary;
}

/**
 * A short, human cancellation note derived from the real refund rules (replaces
 * the old hardcoded flexible/moderate/strict blurb). Returns null when no
 * cancellation policy resolves.
 */
export function cancellationNote(
  summary: ListingPolicySummary,
): { title: string; note: string } | null {
  const c = summary.cancellation;
  if (!c) return null;
  if (c.is_non_refundable) {
    return { title: c.name, note: "Non-refundable — no refund at any time." };
  }
  const rules = [...c.rules].sort((a, b) => b.days_before - a.days_before);
  const fullRefund = rules.find((r) => r.refund_percent >= 100);
  if (fullRefund) {
    const d = fullRefund.days_before;
    const when =
      d <= 0 ? "up to 24 hours" : `up to ${d} day${d === 1 ? "" : "s"}`;
    return { title: c.name, note: `Full refund ${when} before check-in.` };
  }
  const top = rules[0];
  if (top) {
    const d = top.days_before;
    const when =
      d <= 0 ? "within 24 hours" : `up to ${d} day${d === 1 ? "" : "s"} before`;
    return {
      title: c.name,
      note: `${top.refund_percent}% refund ${when}. ${c.summary ?? ""}`.trim(),
    };
  }
  return {
    title: c.name,
    note: c.summary ?? "See the full cancellation policy.",
  };
}
