"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import {
  isPlatformBillingConfigured,
  startSubscriptionCheckout,
} from "@/lib/billing/platform-billing";
import { startProductCheckoutDirect } from "@/lib/billing/product-checkout";
import { requireHost as getMyHostId } from "@/lib/host/current";
import { hostPostToWieloThread } from "@/lib/inbox/platform-thread";
import { notifyAdmins } from "@/lib/admin/notify";
import { getPlan } from "@/lib/plans/getPlans";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

const CYCLE_VALUES = ["monthly", "annual"] as const;

// A host may now hold 1 membership + N services. Every self-serve plan control
// (switch / pause / cancel) acts on the MEMBERSHIP row — resolve its id first so
// we never `.maybeSingle()` across several subscriptions. Falls back to the sole
// (or first) sub for legacy single-sub accounts.
async function membershipSubId(
  supabase: ReturnType<typeof createServerClient>,
  hostId: string,
): Promise<string | null> {
  const { data: rows } = await supabase
    .from("subscriptions")
    .select("id, product_id")
    .eq("host_id", hostId);
  if (!rows || rows.length === 0) return null;
  const pids = rows.map((r) => r.product_id).filter((x): x is string => !!x);
  if (pids.length) {
    const { data: mems } = await supabase
      .from("products")
      .select("id")
      .in("id", pids)
      .eq("product_type", "membership");
    const memIds = new Set((mems ?? []).map((m) => m.id));
    const found = rows.find((r) => r.product_id && memIds.has(r.product_id));
    if (found) return found.id;
  }
  return rows[0].id;
}

// Plan key is validated against the DB catalog (custom plans allowed), not a
// fixed enum — so the admin can add/rename plans without code changes.
const switchPlanSchema = z.object({
  plan: z.string().min(1).max(60),
  cycle: z.enum(CYCLE_VALUES).nullable(),
});

type ActionResult = { ok: true } | { ok: false; error: string };

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/**
 * Switch the current host's subscription to a different plan.
 *
 * Pre-MVP: this records the state change only — no Paystack/PayPal call is
 * made. When real billing connects this is the place to initialise the
 * provider subscription and only flip status to 'trialing'/'active' on the
 * webhook callback. Until then the audit trail is enough to exercise the
 * gates.
 */
export async function switchPlanAction(input: {
  plan: string;
  cycle: "monthly" | "annual" | null;
}): Promise<ActionResult> {
  const parsed = switchPlanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid plan." };
  const { plan, cycle } = parsed.data;

  // Validate the plan against the live DB catalog.
  const planDef = await getPlan(plan);
  if (!planDef || !planDef.isActive) {
    return { ok: false, error: "That plan isn't available." };
  }
  const isFree = planDef.isFree;
  const trialDays = planDef.trialDays;

  if (!isFree && !cycle) {
    return { ok: false, error: "Paid plans need a billing cycle." };
  }

  const host = await getMyHostId();
  if (!host.ok) return host;

  const supabase = createServerClient();

  // Fetch the host's MEMBERSHIP sub (host_manage_own_sub policy gates this).
  const subId = await membershipSubId(supabase, host.hostId);
  const { data: existing } = subId
    ? await supabase
        .from("subscriptions")
        .select(
          "id, plan, status, trial_ends_at, current_period_end, billing_cycle",
        )
        .eq("id", subId)
        .maybeSingle()
    : { data: null };

  const now = new Date();

  // Helper to compute the new period end based on cycle.
  function newPeriodEnd(start: Date): Date {
    return cycle === "annual" ? addMonths(start, 12) : addMonths(start, 1);
  }

  if (!existing) {
    // No sub on file — create one. Free starts active; paid starts trialing
    // for the plan's trial length.
    const trialEnds = isFree || trialDays <= 0 ? null : addDays(now, trialDays);
    const { error } = await supabase.from("subscriptions").insert({
      host_id: host.hostId,
      plan,
      billing_cycle: cycle,
      status: isFree ? "active" : trialEnds ? "trialing" : "active",
      trial_ends_at: trialEnds?.toISOString() ?? null,
      current_period_start: now.toISOString(),
      current_period_end: isFree
        ? null
        : (trialEnds ?? newPeriodEnd(now)).toISOString(),
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings/subscription");
    return { ok: true };
  }

  // Updating an existing sub.
  const everTrialed = existing.trial_ends_at != null;
  const goingPaid = !isFree;
  const fromPaid = !(await getPlan(existing.plan))?.isFree;

  let status: string;
  let trialEnds: string | null = existing.trial_ends_at;
  let periodStart: string | null = existing.current_period_end
    ? new Date().toISOString()
    : null;
  let periodEnd: string | null = existing.current_period_end;

  if (!goingPaid) {
    // Downgrade to free — cancel any trial/active state, keep current
    // period_end so the host doesn't lose access mid-cycle (cancel-at-period
    // -end semantics). For pre-MVP we simply flip to free immediately.
    status = "active";
    trialEnds = null;
    periodStart = null;
    periodEnd = null;
  } else if (!fromPaid && !everTrialed && trialDays > 0) {
    // First-ever paid switch — start the trial.
    const tEnds = addDays(now, trialDays);
    status = "trialing";
    trialEnds = tEnds.toISOString();
    periodStart = now.toISOString();
    periodEnd = tEnds.toISOString();
  } else {
    // Plan swap within paid tiers (or post-trial upgrade) — go active and
    // start a new period at the chosen cycle.
    status = "active";
    periodStart = now.toISOString();
    periodEnd = newPeriodEnd(now).toISOString();
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({
      plan,
      billing_cycle: cycle,
      status,
      trial_ends_at: trialEnds,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: false,
      cancelled_at: null,
      cancellation_reason: null,
    })
    .eq("id", existing.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings/subscription");
  return { ok: true };
}

type CheckoutResult =
  | { ok: true; redirectUrl?: string }
  | { ok: false; error: string };

/**
 * Entry point the plan picker calls for a PAID plan. Decides server-side
 * whether a charge is due:
 *  - First paid upgrade with a trial (never trialed) → start the trial, no charge.
 *  - Billing not configured (no platform Paystack key) → state-only switch
 *    (pre-MVP behaviour, lets the founder smoke-test gates).
 *  - Otherwise → start a Paystack checkout on Wielo's platform key; the webhook
 *    activates the subscription + completes the ledger row on payment.
 */
export async function startPlanCheckoutAction(input: {
  plan: string;
  cycle: "monthly" | "annual";
}): Promise<CheckoutResult> {
  const planDef = await getPlan(input.plan);
  if (!planDef || !planDef.isActive) {
    return { ok: false, error: "That plan isn't available." };
  }
  if (planDef.isFree) {
    // Free plans never charge — fall back to the normal switch.
    return switchPlanAction({ plan: input.plan, cycle: null });
  }

  const host = await getMyHostId();
  if (!host.ok) return host;

  const supabase = createServerClient();
  const subId = await membershipSubId(supabase, host.hostId);
  const { data: existing } = subId
    ? await supabase
        .from("subscriptions")
        .select("plan, trial_ends_at")
        .eq("id", subId)
        .maybeSingle()
    : { data: null };

  const everTrialed = existing?.trial_ends_at != null;
  const fromPaid = existing ? !(await getPlan(existing.plan))?.isFree : false;
  const trialEligible = !fromPaid && !everTrialed && planDef.trialDays > 0;

  // Trial start (no charge) or billing not wired yet → state-only switch.
  if (trialEligible || !(await isPlatformBillingConfigured())) {
    return switchPlanAction({ plan: input.plan, cycle: input.cycle });
  }

  // A charge is due now → Paystack checkout (platform key).
  const res = await startSubscriptionCheckout({
    hostId: host.hostId,
    planKey: input.plan,
    cycle: input.cycle,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, redirectUrl: res.authorizationUrl };
}

/**
 * Product-driven switch used by the settings tab (the catalog now shows the
 * admin PRODUCTS, not plan tiers). The PRODUCT price decides whether a charge is
 * due; the product's plan_key decides the feature tier. So a FREE product that
 * grants a paid tier (e.g. a beta product → full access) switches with no charge.
 *
 *  - Paid product + billing configured → product checkout (charges the product
 *    price); the return/webhook activates via activateMappedPlan.
 *  - Free product, or billing not wired yet (pre-MVP) → state-only activation:
 *    set product_id + the mapped plan directly so gates re-evaluate now.
 */
const switchProductSchema = z.object({ productId: z.string().uuid() });

export async function switchToProductAction(input: {
  productId: string;
}): Promise<CheckoutResult> {
  const parsed = switchProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid product." };

  const host = await getMyHostId();
  if (!host.ok) return host;

  // Product is a public catalog row — read with the admin client so an inactive
  // product a host is already on still resolves.
  const admin = createAdminClient();
  const { data: product } = await admin
    .from("products")
    .select("id, slug, type, price, billing_cycle, plan_key, is_active")
    .eq("id", parsed.data.productId)
    .maybeSingle();
  if (!product || product.type !== "subscription" || !product.is_active) {
    return { ok: false, error: "That product isn't available." };
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Please sign in." };

  const subId = await membershipSubId(supabase, host.hostId);
  const { data: existing } = subId
    ? await supabase
        .from("subscriptions")
        .select("id, plan, product_id")
        .eq("id", subId)
        .maybeSingle()
    : { data: null };

  if (existing?.product_id === product.id) {
    return { ok: false, error: "You're already on this plan." };
  }

  // Upgrade-only for self-serve hosts: switching to a CHEAPER product is a
  // downgrade, which is admin-only (it triggers the credit-note/refund decision).
  // A host may only move UP; downgrades + cancellations go through Wielo support.
  let currentPrice = 0;
  if (existing?.product_id) {
    const { data: cur } = await admin
      .from("products")
      .select("price")
      .eq("id", existing.product_id)
      .maybeSingle();
    currentPrice = Number(cur?.price ?? 0);
  }
  if (Number(product.price) < currentPrice) {
    return {
      ok: false,
      error:
        "Downgrades are handled by our team — message Wielo support to move to a lower plan.",
    };
  }

  // Resolve the feature tier the product grants (plan_key, else slug if it's a
  // real plan key). Fall back to the current plan so the FK stays valid.
  let plan = existing?.plan ?? "free";
  const desiredKey = product.plan_key ?? product.slug;
  if (desiredKey && (await getPlan(desiredKey))) plan = desiredKey;

  const cycle = product.billing_cycle === "annual" ? "annual" : "monthly";
  const paid = Number(product.price) > 0;

  // A paid product with live billing → real checkout (charges the product price).
  if (paid && (await isPlatformBillingConfigured()) && product.slug) {
    const origin = headers().get("origin");
    const r = await startProductCheckoutDirect(
      product.slug,
      user.email,
      origin,
      false,
    );
    if (!r.ok) return { ok: false, error: r.error };
    if (r.url) return { ok: true, redirectUrl: r.url };
    // No URL back (shouldn't happen) — fall through to a state-only switch.
  }

  // Free product, or billing not wired → activate immediately (no charge). A
  // free grant has no billing period (never expires); a state-only paid switch
  // opens a period at the chosen cycle.
  const now = new Date();
  const patch = {
    product_id: product.id,
    plan,
    billing_cycle: cycle,
    status: "active" as const,
    trial_ends_at: null,
    current_period_start: now.toISOString(),
    current_period_end: paid
      ? newPeriodEndFrom(now, cycle).toISOString()
      : null,
    cancel_at_period_end: false,
    cancelled_at: null,
    cancellation_reason: null,
  };
  const { error } = existing
    ? await supabase.from("subscriptions").update(patch).eq("id", existing.id)
    : await supabase
        .from("subscriptions")
        .insert({ host_id: host.hostId, ...patch });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/subscription");
  return { ok: true };
}

function newPeriodEndFrom(start: Date, cycle: "monthly" | "annual"): Date {
  return cycle === "annual" ? addMonths(start, 12) : addMonths(start, 1);
}

// Host self-serve PAUSE: put the membership on hold (status → paused). Reversible
// via reactivate. Only from a live state. Posts a card into the host's Wielo
// Support thread so admin sees it.
export async function pauseSubscriptionAction(): Promise<ActionResult> {
  const host = await getMyHostId();
  if (!host.ok) return host;

  const supabase = createServerClient();
  const subId = await membershipSubId(supabase, host.hostId);
  if (!subId) return { ok: false, error: "No subscription on file." };
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id, status")
    .eq("id", subId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "No subscription on file." };
  if (!["trialing", "active", "past_due"].includes(existing.status)) {
    return { ok: false, error: "Only an active membership can be paused." };
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "paused" })
    .eq("id", existing.id);
  if (error) return { ok: false, error: error.message };

  // Notify Wielo (a card in the host's support thread) — admin-client post so it
  // isn't gated by the host's inbox RLS.
  try {
    const admin = createAdminClient();
    await hostPostToWieloThread(admin, {
      host: { id: host.hostId, userId: host.userId },
      body: "I've paused my membership. It's on hold for now.",
      systemEvent: "subscription_paused",
    });
    await notifyAdmins(admin, {
      category: "support",
      kind: "subscription_paused",
      title: "Membership paused",
      body: "A host put their membership on hold.",
      userId: host.userId,
      hostId: host.hostId,
      href: `/admin/users/${host.userId}?tab=products`,
    });
  } catch {
    // Non-fatal: the pause succeeded even if the notification post fails.
  }

  revalidatePath("/dashboard/settings/subscription");
  return { ok: true };
}

// Host self-serve CANCELLATION REQUEST: does NOT hard-cancel. The membership goes
// to `paused` and Wielo is NOTIFIED (a card in the host's support thread) so a
// human manages the real cancellation (credit-note/refund + timing) manually.
export async function requestCancellationAction(): Promise<ActionResult> {
  const host = await getMyHostId();
  if (!host.ok) return host;

  const supabase = createServerClient();
  const subId = await membershipSubId(supabase, host.hostId);
  if (!subId) return { ok: false, error: "No subscription on file." };

  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "paused" })
    .eq("id", subId);
  if (error) return { ok: false, error: error.message };

  try {
    const admin = createAdminClient();
    await hostPostToWieloThread(admin, {
      host: { id: host.hostId, userId: host.userId },
      body: "I'd like to cancel my membership. Please help me close it off.",
      systemEvent: "cancellation_requested",
    });
    await notifyAdmins(admin, {
      category: "support",
      kind: "cancellation_request",
      title: "Cancellation requested",
      body: "A host asked to cancel their membership (now paused).",
      userId: host.userId,
      hostId: host.hostId,
      href: `/admin/users/${host.userId}?tab=products`,
    });
  } catch {
    // Non-fatal: the request (paused) stands even if the notification post fails.
  }

  revalidatePath("/dashboard/settings/subscription");
  return { ok: true };
}

// Resume a paused membership OR revert a scheduled cancel — back to active.
export async function reactivateSubscriptionAction(): Promise<ActionResult> {
  const host = await getMyHostId();
  if (!host.ok) return host;

  const supabase = createServerClient();
  const subId = await membershipSubId(supabase, host.hostId);
  if (!subId) return { ok: false, error: "No subscription on file." };
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id, status, cancel_at_period_end")
    .eq("id", subId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "No subscription on file." };
  if (existing.status !== "paused" && !existing.cancel_at_period_end) {
    return {
      ok: false,
      error: "Subscription isn't paused or scheduled to cancel.",
    };
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "active",
      cancel_at_period_end: false,
      cancelled_at: null,
      cancellation_reason: null,
    })
    .eq("id", existing.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings/subscription");
  return { ok: true };
}
