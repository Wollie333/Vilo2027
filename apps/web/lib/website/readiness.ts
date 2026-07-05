/**
 * Website go-live readiness — the single source of truth for the "hard-required
 * set" that gates a site going live (Builder × Theme plan, Phase 6). Explore,
 * preview and design are always open; these requirements only block Publish /
 * accepting bookings, never creation. The founder-locked set:
 *
 *   1. name      — the business/property has a trading name
 *   2. room      — ≥1 active, bookable room with a base price in ZAR
 *   3. payment    — ≥1 payment method enabled (Paystack / PayPal / manual EFT)
 *   4. subdomain  — the site has a subdomain
 *   5. policy     — a cancellation / house-rules policy is set
 *
 * `evaluateReadiness` is a pure predicate over an already-loaded snapshot so it
 * is trivially unit-testable; `checkWebsiteReadiness` is the thin loader that
 * gathers the snapshot from the DB and calls it. Both the go-live gate
 * (`publishWebsiteAction`), the editor Publish button, the dashboard readiness
 * card and the setup wizard consume the SAME report — one contract, no drift.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ReadinessKey = "name" | "room" | "payment" | "subdomain" | "policy";

export type ReadinessItem = {
  key: ReadinessKey;
  /** English fallback label (UIs translate by `key`; this covers toasts/logs). */
  label: string;
  /** Dashboard route that lets the host satisfy this requirement. */
  fixHref: string;
};

/** Already-loaded facts the predicate reasons over — no DB access here. */
export type ReadinessInput = {
  /** Business trading name (or site name) — trimmed non-empty satisfies. */
  name: string | null | undefined;
  /** ≥1 active room with a base price > 0 stored in ZAR. */
  hasBookableRoom: boolean;
  /** ≥1 payment method enabled for the site (card / PayPal / EFT). */
  hasPaymentMethod: boolean;
  /** Site subdomain — trimmed non-empty satisfies. */
  subdomain: string | null | undefined;
  /** A cancellation / house-rules policy is configured. */
  hasPolicy: boolean;
};

export type ReadinessReport = {
  ready: boolean;
  /** Requirements NOT yet met, in the order they're presented to the host. */
  missing: ReadinessItem[];
};

/** Route each requirement links to so the host can fix it in one click. */
const FIX_HREF: Record<ReadinessKey, string> = {
  name: "/dashboard/settings/businesses",
  room: "/dashboard/rooms",
  payment: "/dashboard/settings/banking",
  subdomain: "/dashboard/website",
  policy: "/dashboard/policies",
};

/** English fallback labels — UIs should translate by `key` where possible. */
const LABEL: Record<ReadinessKey, string> = {
  name: "Add your business name",
  room: "Add a bookable room with a price",
  payment: "Enable a payment method",
  subdomain: "Choose a subdomain",
  policy: "Set a cancellation policy",
};

function item(key: ReadinessKey, subdomain?: string | null): ReadinessItem {
  // The subdomain fix points at the site itself once it exists.
  const fixHref =
    key === "subdomain" && subdomain ? `/dashboard/website` : FIX_HREF[key];
  return { key, label: LABEL[key], fixHref };
}

const notBlank = (s: string | null | undefined) => !!s && s.trim().length > 0;

/**
 * Pure readiness check over a loaded snapshot. Requirement order is stable so
 * the checklist always reads the same top-to-bottom.
 */
export function evaluateReadiness(input: ReadinessInput): ReadinessReport {
  const missing: ReadinessItem[] = [];
  if (!notBlank(input.name)) missing.push(item("name"));
  if (!input.hasBookableRoom) missing.push(item("room"));
  if (!input.hasPaymentMethod) missing.push(item("payment"));
  if (!notBlank(input.subdomain))
    missing.push(item("subdomain", input.subdomain));
  if (!input.hasPolicy) missing.push(item("policy"));
  return { ready: missing.length === 0, missing };
}

/** Website `settings.payments` shape — per-method toggles (undefined = allowed). */
type PaymentToggles = { paystack?: boolean; eft?: boolean };

/** Business has a usable trading/legal name. */
async function loadHasName(
  supabase: SupabaseClient,
  hostId: string,
  businessId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("businesses")
    .select("trading_name, legal_name")
    .eq("id", businessId)
    .eq("host_id", hostId)
    .maybeSingle();
  const name = data?.trading_name?.trim() || data?.legal_name?.trim();
  return name || null;
}

/** ≥1 active room with a base price > 0 in ZAR, on one of the business's properties. */
async function loadHasBookableRoom(
  supabase: SupabaseClient,
  businessId: string,
): Promise<boolean> {
  const { data: props } = await supabase
    .from("properties")
    .select("id")
    .eq("business_id", businessId)
    .is("deleted_at", null);
  const propertyIds = (props ?? []).map((p) => p.id as string);
  if (propertyIds.length === 0) return false;
  const { data: room } = await supabase
    .from("property_rooms")
    .select("id")
    .in("property_id", propertyIds)
    .is("deleted_at", null)
    .eq("is_active", true)
    .gt("base_price", 0)
    .eq("currency", "ZAR")
    .limit(1)
    .maybeSingle();
  return !!room;
}

/**
 * ≥1 payment method the host can actually take money with, respecting the site's
 * per-method toggles. EFT is host-level (`eft_banking_details`); card (Paystack)
 * and PayPal are per-business gateways that only charge when enabled AND their
 * active-mode secret is present (mirrors `lib/payments/host-paystack.ts`).
 */
async function loadHasPaymentMethod(
  supabase: SupabaseClient,
  hostId: string,
  businessId: string,
  pay: PaymentToggles,
): Promise<boolean> {
  // Manual EFT — enabled unless explicitly toggled off, needs banking details.
  if (pay.eft !== false) {
    const { data: eft } = await supabase
      .from("eft_banking_details")
      .select("id")
      .eq("host_id", hostId)
      .eq("is_archived", false)
      .limit(1)
      .maybeSingle();
    if (eft) return true;
  }
  // Card / PayPal — a connected, enabled gateway with an active-mode secret.
  const { data: gateways } = await supabase
    .from("host_payment_gateways")
    .select("gateway, mode, test_secret_cipher, live_secret_cipher")
    .eq("business_id", businessId)
    .eq("is_enabled", true);
  for (const g of gateways ?? []) {
    // Paystack respects the site's card toggle; PayPal has no per-site toggle.
    if (g.gateway === "paystack" && pay.paystack === false) continue;
    const cipher =
      g.mode === "live" ? g.live_secret_cipher : g.test_secret_cipher;
    if (cipher) return true;
  }
  return false;
}

/**
 * A cancellation policy (Domain 11 — Policy Manager) is authored, active, and
 * assigned to one of the business's properties. The founder-locked rule treats
 * policies as HARD — the defaulted `listings.cancellation_policy` enum does NOT
 * count; the host must have set one up in the Policy Manager.
 */
async function loadHasPolicy(
  supabase: SupabaseClient,
  hostId: string,
  businessId: string,
): Promise<boolean> {
  const { data: policies } = await supabase
    .from("policies")
    .select("id, is_default")
    .eq("host_id", hostId)
    .eq("status", "active")
    .is("deleted_at", null)
    .eq("type", "cancellation");
  const active = (policies ?? []) as {
    id: string;
    is_default: boolean | null;
  }[];
  if (active.length === 0) return false;
  // A DEFAULT cancellation policy applies to every property without needing an
  // explicit property_policies assignment — so it satisfies readiness on its own.
  // (This is what the Policy Manager sets up "property-wide"; requiring an explicit
  // assignment wrongly prompted hosts to "set up a policy" they already had.)
  if (active.some((p) => p.is_default)) return true;
  const policyIds = active.map((p) => p.id);

  const { data: props } = await supabase
    .from("properties")
    .select("id")
    .eq("business_id", businessId)
    .is("deleted_at", null);
  const propertyIds = (props ?? []).map((p) => p.id as string);
  if (propertyIds.length === 0) return false;

  const { data: assigned } = await supabase
    .from("property_policies")
    .select("id")
    .in("policy_id", policyIds)
    .in("property_id", propertyIds)
    .limit(1)
    .maybeSingle();
  return !!assigned;
}

/**
 * Load the readiness snapshot for a website and evaluate it. Ownership is keyed
 * by `host_id` on the website row — a site the host doesn't own (or a deleted
 * one) resolves to "nothing met", so callers still gate on ownership separately.
 * The five checks run in parallel (they're independent reads).
 */
export async function checkWebsiteReadiness(
  supabase: SupabaseClient,
  hostId: string,
  websiteId: string,
): Promise<ReadinessReport> {
  const { data: site } = await supabase
    .from("host_websites")
    .select("business_id, subdomain, settings")
    .eq("id", websiteId)
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!site) {
    return evaluateReadiness({
      name: null,
      hasBookableRoom: false,
      hasPaymentMethod: false,
      subdomain: null,
      hasPolicy: false,
    });
  }
  const businessId = site.business_id as string;
  const subdomain = site.subdomain as string | null;
  const pay =
    (site.settings as { payments?: PaymentToggles } | null)?.payments ?? {};

  const [name, hasBookableRoom, hasPaymentMethod, hasPolicy] =
    await Promise.all([
      loadHasName(supabase, hostId, businessId),
      loadHasBookableRoom(supabase, businessId),
      loadHasPaymentMethod(supabase, hostId, businessId, pay),
      loadHasPolicy(supabase, hostId, businessId),
    ]);

  return evaluateReadiness({
    name,
    hasBookableRoom,
    hasPaymentMethod,
    subdomain,
    hasPolicy,
  });
}
