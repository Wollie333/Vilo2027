import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { slugify } from "@/lib/help/slug";

import type {
  WizardPaymentMethod,
  WizardPolicy,
  WizardRoom,
} from "./wizardState";

// Account config surfaced in the wizard's confirm-and-activate step. Edits open
// the existing account editors (banking / policies) in a new tab so wizard
// progress (in-memory) is never lost.
const BANKING_HREF = "/dashboard/settings/banking";
const POLICIES_HREF = "/dashboard/policies";

/** The four policy types the confirm step covers, in display order. */
const CANONICAL_POLICY_TYPES = [
  "check_in_out",
  "cancellation",
  "house_rules",
  "booking_terms",
] as const;

type GatewayRow = {
  gateway: string;
  is_enabled: boolean | null;
  last_validated_at: string | null;
};

type PolicyRow = {
  id: string;
  type: string;
  name: string | null;
  summary: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
};

/**
 * The host's configured payment methods for a business, mapped to the wizard's
 * confirm-and-activate shape. A gateway is "active" only when enabled AND
 * validated; EFT is active when a (non-archived) bank account exists.
 */
export async function loadWizardPaymentMethods(
  supabase: SupabaseClient,
  hostId: string,
  businessId: string,
): Promise<WizardPaymentMethod[]> {
  const [{ data: gateways }, { data: eft }] = await Promise.all([
    supabase
      .from("host_payment_gateways")
      .select("gateway, is_enabled, last_validated_at")
      .eq("host_id", hostId)
      .eq("business_id", businessId),
    supabase
      .from("eft_banking_details")
      .select("id")
      .eq("host_id", hostId)
      .eq("business_id", businessId)
      .eq("is_archived", false)
      .limit(1),
  ]);

  const rows = (gateways ?? []) as GatewayRow[];
  const gatewayStatus = (key: "paystack" | "paypal") => {
    const row = rows.find((g) => g.gateway === key);
    return row && row.is_enabled && row.last_validated_at
      ? ("active" as const)
      : ("review" as const);
  };
  const eftActive = (eft ?? []).length > 0;

  return [
    {
      key: "paystack",
      status: gatewayStatus("paystack"),
      editHref: BANKING_HREF,
    },
    { key: "paypal", status: gatewayStatus("paypal"), editHref: BANKING_HREF },
    {
      key: "eft",
      status: eftActive ? "active" : "review",
      editHref: BANKING_HREF,
    },
  ];
}

/**
 * The host's policies mapped to the wizard's confirm-and-activate shape: one row
 * per configured policy, plus an amber "Add" row for any canonical type not yet
 * set up. `summary` uses the stored one-liner, falling back to check-in/out times.
 */
export async function loadWizardPolicies(
  supabase: SupabaseClient,
  hostId: string,
): Promise<WizardPolicy[]> {
  const { data } = await supabase
    .from("policies")
    .select("id, type, name, summary, check_in_time, check_out_time")
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .in("status", ["active", "draft"])
    .in("type", CANONICAL_POLICY_TYPES as unknown as string[])
    .order("type", { ascending: true })
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as PolicyRow[];

  const configured: WizardPolicy[] = rows.map((p) => ({
    key: p.id,
    type: p.type,
    name: p.name?.trim() || "",
    summary: p.summary?.trim() || fallbackSummary(p),
    configured: true,
    editHref: POLICIES_HREF,
  }));

  // Amber "Add" rows for canonical types the host hasn't set up yet.
  const present = new Set(rows.map((r) => r.type));
  const missing: WizardPolicy[] = CANONICAL_POLICY_TYPES.filter(
    (t) => !present.has(t),
  ).map((t) => ({
    key: `type:${t}`,
    type: t,
    name: "",
    summary: "",
    configured: false,
    editHref: POLICIES_HREF,
  }));

  return [...configured, ...missing];
}

/**
 * The business's active rooms, ordered, for the Pages-step nav preview (the
 * Rooms item auto-generates one submenu link per room). Slug derived from name.
 */
export async function loadWizardRooms(
  supabase: SupabaseClient,
  businessId: string,
): Promise<WizardRoom[]> {
  const { data: props } = await supabase
    .from("properties")
    .select("id")
    .eq("business_id", businessId)
    .is("deleted_at", null);
  const ids = (props ?? []).map((p) => (p as { id: string }).id);
  if (ids.length === 0) return [];

  const { data: rooms } = await supabase
    .from("property_rooms")
    .select("name, sort_order")
    .in("property_id", ids)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .limit(50);

  return (rooms ?? []).map((r) => {
    const name = (r as { name: string }).name;
    return { name, slug: slugify(name) };
  });
}

function fallbackSummary(p: PolicyRow): string {
  if (p.type === "check_in_out" && (p.check_in_time || p.check_out_time)) {
    const parts: string[] = [];
    if (p.check_in_time) parts.push(`Check-in ${p.check_in_time.slice(0, 5)}`);
    if (p.check_out_time)
      parts.push(`Check-out ${p.check_out_time.slice(0, 5)}`);
    return parts.join(" · ");
  }
  return "";
}
