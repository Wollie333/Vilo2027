"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireHost as getMyHostId } from "@/lib/host/current";
import { createServerClient } from "@/lib/supabase/server";

const PLAN_VALUES = ["free", "basic", "pro", "business"] as const;
const CYCLE_VALUES = ["monthly", "annual"] as const;

const switchPlanSchema = z.object({
  plan: z.enum(PLAN_VALUES),
  cycle: z.enum(CYCLE_VALUES).nullable(),
});

type ActionResult = { ok: true } | { ok: false; error: string };

const TRIAL_DAYS = 14;

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
  plan: (typeof PLAN_VALUES)[number];
  cycle: "monthly" | "annual" | null;
}): Promise<ActionResult> {
  const parsed = switchPlanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid plan." };
  const { plan, cycle } = parsed.data;

  if (plan !== "free" && !cycle) {
    return { ok: false, error: "Paid plans need a billing cycle." };
  }

  const host = await getMyHostId();
  if (!host.ok) return host;

  const supabase = createServerClient();

  // Fetch existing sub (host_manage_own_sub policy gates this).
  const { data: existing } = await supabase
    .from("subscriptions")
    .select(
      "id, plan, status, trial_ends_at, current_period_end, billing_cycle",
    )
    .eq("host_id", host.hostId)
    .maybeSingle();

  const now = new Date();

  // Helper to compute the new period end based on cycle.
  function newPeriodEnd(start: Date): Date {
    return cycle === "annual" ? addMonths(start, 12) : addMonths(start, 1);
  }

  if (!existing) {
    // No sub on file — create one. Free starts active; paid starts trialing
    // for 14 days.
    const trialEnds = plan === "free" ? null : addDays(now, TRIAL_DAYS);
    const { error } = await supabase.from("subscriptions").insert({
      host_id: host.hostId,
      plan,
      billing_cycle: cycle,
      status: plan === "free" ? "active" : "trialing",
      trial_ends_at: trialEnds?.toISOString() ?? null,
      current_period_start: now.toISOString(),
      current_period_end:
        plan === "free" ? null : (trialEnds ?? newPeriodEnd(now)).toISOString(),
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings/subscription");
    return { ok: true };
  }

  // Updating an existing sub.
  const everTrialed = existing.trial_ends_at != null;
  const goingPaid = plan !== "free";
  const fromPaid = existing.plan !== "free";

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
  } else if (!fromPaid && !everTrialed) {
    // First-ever paid switch — start the trial.
    const tEnds = addDays(now, TRIAL_DAYS);
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

const cancelSchema = z.object({
  reason: z.string().max(500).optional().nullable(),
});

export async function cancelSubscriptionAction(input: {
  reason?: string | null;
}): Promise<ActionResult> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid reason." };

  const host = await getMyHostId();
  if (!host.ok) return host;

  const supabase = createServerClient();
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id, plan, status")
    .eq("host_id", host.hostId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "No active subscription." };
  if (existing.plan === "free") {
    return { ok: false, error: "You're already on the free plan." };
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({
      cancel_at_period_end: true,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: parsed.data.reason?.trim() || null,
    })
    .eq("id", existing.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings/subscription");
  return { ok: true };
}

export async function reactivateSubscriptionAction(): Promise<ActionResult> {
  const host = await getMyHostId();
  if (!host.ok) return host;

  const supabase = createServerClient();
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id, cancel_at_period_end")
    .eq("host_id", host.hostId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "No subscription on file." };
  if (!existing.cancel_at_period_end) {
    return { ok: false, error: "Subscription isn't scheduled to cancel." };
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({
      cancel_at_period_end: false,
      cancelled_at: null,
      cancellation_reason: null,
    })
    .eq("id", existing.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings/subscription");
  return { ok: true };
}
