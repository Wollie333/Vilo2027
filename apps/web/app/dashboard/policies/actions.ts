"use server";

import { revalidatePath } from "next/cache";

import { sanitiseListingHtml } from "@/lib/sanitiseHtml";
import { requireHost as getHost } from "@/lib/host/current";
import { createServerClient } from "@/lib/supabase/server";

import {
  checkInOutInputSchema,
  houseRulesInputSchema,
  isLockedPreset,
  legalDocInputSchema,
  refundPolicyInputSchema,
  type PolicyInput,
  type PolicyType,
} from "./schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

// Pre-MVP policy (AGENT_RULES.md §3.4): every feature is open to the free
// plan while there's no subscription management UI. plan_features seeds
// 'policies' = true for all plans; this short-circuits so the founder can
// smoke-test. To re-enable per-plan gating later, restore:
//   const { data } = await supabase.rpc("check_feature_permission", {
//     p_host_id: hostId, p_feature_key: "policies" });
//   return (data as { is_enabled: boolean } | null)?.is_enabled ?? false;
async function assertPoliciesEnabled(hostId: string): Promise<boolean> {
  return !!hostId;
}

type PolicyRow = {
  id: string;
  host_id: string;
  type: PolicyType;
  preset: string | null;
};

async function fetchOwnedPolicy(
  policyId: string,
  hostId: string,
): Promise<PolicyRow | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("policies")
    .select("id, host_id, type, preset")
    .eq("id", policyId)
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as PolicyRow | null) ?? null;
}

async function assertListingOwnership(
  listingId: string,
  hostId: string,
): Promise<boolean> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .eq("host_id", hostId)
    .maybeSingle();
  return !!data;
}

/** Materialise the locked refund presets for this host (idempotent). */
async function ensurePresets(hostId: string): Promise<void> {
  const supabase = createServerClient();
  await supabase.rpc("ensure_host_policy_presets", { p_host_id: hostId });
}

/**
 * Guarantee the host has an active default per type (idempotent — only fills a
 * type that has no default yet). Run after a policy is created or activated so a
 * host's first active policy of a type becomes the default and is therefore
 * immediately valid on every listing lacking an explicit assignment.
 */
async function ensureDefaults(hostId: string): Promise<void> {
  const supabase = createServerClient();
  await supabase.rpc("ensure_host_default_policies", { p_host_id: hostId });
}

function validate(
  input: PolicyInput,
): { ok: true } | { ok: false; error: string } {
  const schema =
    input.type === "cancellation"
      ? refundPolicyInputSchema
      : input.type === "check_in_out"
        ? checkInOutInputSchema
        : input.type === "house_rules"
          ? houseRulesInputSchema
          : legalDocInputSchema;
  const parsed = schema.safeParse(input.data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Some fields look wrong.",
    };
  }
  return { ok: true };
}

/** Insert the rules + content children for a policy. Returns false on error. */
async function writeChildren(
  policyId: string,
  input: PolicyInput,
): Promise<boolean> {
  const supabase = createServerClient();

  if (input.type === "cancellation") {
    const rules = input.data.rules.map((r, i) => ({
      policy_id: policyId,
      days_before: r.days_before,
      refund_percent: r.refund_percent,
      label: r.label,
      sort_order: i,
    }));
    if (rules.length > 0) {
      const { error } = await supabase
        .from("policy_cancellation_rules")
        .insert(rules);
      if (error) return false;
    }
  }

  const rawHtml =
    input.type === "house_rules" ||
    input.type === "booking_terms" ||
    input.type === "privacy"
      ? input.data.body_html
      : (input.data.body_html ?? null);

  if (rawHtml && rawHtml.trim().length > 0) {
    // Sanitise at write so the shared client PolicyDialog renders trusted HTML.
    const bodyHtml = sanitiseListingHtml(rawHtml);
    const { error } = await supabase
      .from("policy_content")
      .upsert(
        { policy_id: policyId, body_html: bodyHtml, locale: "en" },
        { onConflict: "policy_id,locale" },
      );
    if (error) return false;
  } else {
    // Cleared body on edit — drop any existing content row.
    await supabase.from("policy_content").delete().eq("policy_id", policyId);
  }
  return true;
}

export async function createPolicyAction(
  input: PolicyInput,
): Promise<ActionResult<{ id: string }>> {
  const host = await getHost();
  if (!host.ok) return host;
  if (!(await assertPoliciesEnabled(host.hostId))) {
    return { ok: false, error: "Policies aren't available on your plan." };
  }
  await ensurePresets(host.hostId);

  const valid = validate(input);
  if (!valid.ok) return valid;

  const supabase = createServerClient();
  const base = {
    host_id: host.hostId,
    name: input.data.name,
    type: input.type,
    status: "active" as const,
    preset: "custom" as const,
    summary: input.data.summary ?? null,
  };

  const insert =
    input.type === "cancellation"
      ? { ...base, is_non_refundable: input.data.is_non_refundable }
      : input.type === "check_in_out"
        ? {
            ...base,
            check_in_time: input.data.check_in_time,
            check_out_time: input.data.check_out_time,
            check_in_method: input.data.check_in_method ?? null,
          }
        : input.type === "house_rules"
          ? {
              ...base,
              pets_allowed: input.data.pets_allowed ?? null,
              smoking_allowed: input.data.smoking_allowed ?? null,
              parties_allowed: input.data.parties_allowed ?? null,
              children_welcome: input.data.children_welcome ?? null,
              quiet_hours_start: input.data.quiet_hours_start ?? null,
              quiet_hours_end: input.data.quiet_hours_end ?? null,
            }
          : base;

  const { data: row, error } = await supabase
    .from("policies")
    .insert(insert)
    .select("id")
    .single();
  if (error || !row) {
    return { ok: false, error: "Could not create policy. Try again." };
  }

  if (!(await writeChildren(row.id, input))) {
    await supabase.from("policies").delete().eq("id", row.id);
    return { ok: false, error: "Could not save policy details." };
  }

  // A host's first active policy of a type becomes the default (no-op if one
  // already exists), so it's immediately valid on unassigned listings.
  await ensureDefaults(host.hostId);

  revalidatePath("/dashboard/policies");
  return { ok: true, data: { id: row.id } };
}

export async function updatePolicyAction(
  policyId: string,
  input: PolicyInput,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;

  const policy = await fetchOwnedPolicy(policyId, host.hostId);
  if (!policy) return { ok: false, error: "Not your policy." };
  if (isLockedPreset(policy.preset)) {
    return {
      ok: false,
      error: "Preset policies can't be edited. Duplicate it to customise.",
    };
  }
  if (policy.type !== input.type) {
    return { ok: false, error: "Policy type mismatch." };
  }

  const valid = validate(input);
  if (!valid.ok) return valid;

  const supabase = createServerClient();
  const core = {
    name: input.data.name,
    summary: input.data.summary ?? null,
    ...(input.type === "cancellation"
      ? { is_non_refundable: input.data.is_non_refundable }
      : {}),
    ...(input.type === "check_in_out"
      ? {
          check_in_time: input.data.check_in_time,
          check_out_time: input.data.check_out_time,
          check_in_method: input.data.check_in_method ?? null,
        }
      : {}),
    ...(input.type === "house_rules"
      ? {
          pets_allowed: input.data.pets_allowed ?? null,
          smoking_allowed: input.data.smoking_allowed ?? null,
          parties_allowed: input.data.parties_allowed ?? null,
          children_welcome: input.data.children_welcome ?? null,
          quiet_hours_start: input.data.quiet_hours_start ?? null,
          quiet_hours_end: input.data.quiet_hours_end ?? null,
        }
      : {}),
  };

  const { error: coreErr } = await supabase
    .from("policies")
    .update(core)
    .eq("id", policyId);
  if (coreErr) return { ok: false, error: "Could not save policy." };

  // Cancellation rules: replace wholesale.
  if (input.type === "cancellation") {
    await supabase
      .from("policy_cancellation_rules")
      .delete()
      .eq("policy_id", policyId);
  }

  if (!(await writeChildren(policyId, input))) {
    return { ok: false, error: "Could not save policy details." };
  }

  revalidatePath("/dashboard/policies");
  return { ok: true };
}

export async function deletePolicyAction(
  policyId: string,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;

  const policy = await fetchOwnedPolicy(policyId, host.hostId);
  if (!policy) return { ok: false, error: "Not your policy." };
  if (isLockedPreset(policy.preset)) {
    return { ok: false, error: "Preset policies can't be deleted." };
  }

  const supabase = createServerClient();

  // listing_policies.policy_id and policy_snapshots.policy_id are ON DELETE
  // RESTRICT, so a referenced policy is archived rather than hard-deleted.
  const [{ count: assignedCount }, { count: snapshotCount }] =
    await Promise.all([
      supabase
        .from("listing_policies")
        .select("id", { count: "exact", head: true })
        .eq("policy_id", policyId),
      supabase
        .from("policy_snapshots")
        .select("id", { count: "exact", head: true })
        .eq("policy_id", policyId),
    ]);

  if ((assignedCount ?? 0) > 0 || (snapshotCount ?? 0) > 0) {
    const { error } = await supabase
      .from("policies")
      .update({ status: "archived", deleted_at: new Date().toISOString() })
      .eq("id", policyId);
    if (error) return { ok: false, error: "Could not archive policy." };
    revalidatePath("/dashboard/policies");
    return { ok: true };
  }

  const { error } = await supabase.from("policies").delete().eq("id", policyId);
  if (error) return { ok: false, error: "Could not delete policy." };

  revalidatePath("/dashboard/policies");
  return { ok: true };
}

// ── Retirement (archive + reassign) ──────────────────────────────
// Active booking statuses that still matter for a "policy in use" warning. A
// booking's refund always reads its own immutable snapshot, so archiving never
// affects existing bookings — but the host should know how many are live.
const ACTIVE_BOOKING_STATUSES = [
  "pending",
  "pending_eft",
  "confirmed",
  "checked_in",
];

export type PolicyRetirementInfo = {
  policyName: string;
  isDefault: boolean;
  isPreset: boolean;
  assignments: {
    listingId: string;
    listingName: string;
    roomScoped: boolean;
  }[];
  activeBookings: number;
  replacements: { id: string; name: string; isDefault: boolean }[];
};

/** Impact summary for retiring a policy: where it's used + what can replace it. */
export async function getPolicyRetirementInfoAction(
  policyId: string,
): Promise<ActionResult<PolicyRetirementInfo>> {
  const host = await getHost();
  if (!host.ok) return host;

  const policy = await fetchOwnedPolicy(policyId, host.hostId);
  if (!policy) return { ok: false, error: "Not your policy." };

  const supabase = createServerClient();

  const { data: full } = await supabase
    .from("policies")
    .select("name, is_default")
    .eq("id", policyId)
    .single();

  // Listing assignments (listing-wide + per-room) with listing names.
  const { data: lpRows } = await supabase
    .from("listing_policies")
    .select("listing_id, room_id, listings!inner(name)")
    .eq("policy_id", policyId);

  const assignments = (
    (lpRows ?? []) as unknown as {
      listing_id: string;
      room_id: string | null;
      listings: { name: string } | { name: string }[];
    }[]
  ).map((r) => ({
    listingId: r.listing_id,
    listingName: Array.isArray(r.listings)
      ? (r.listings[0]?.name ?? "Listing")
      : (r.listings?.name ?? "Listing"),
    roomScoped: r.room_id !== null,
  }));

  // Active bookings that snapshotted this policy.
  let activeBookings = 0;
  const { data: snapRows } = await supabase
    .from("policy_snapshots")
    .select("booking_id")
    .eq("policy_id", policyId);
  const bookingIds = (snapRows ?? []).map((s) => s.booking_id);
  if (bookingIds.length > 0) {
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .in("id", bookingIds)
      .in("status", ACTIVE_BOOKING_STATUSES);
    activeBookings = count ?? 0;
  }

  // Replacement candidates: other active policies of the same type.
  const { data: repRows } = await supabase
    .from("policies")
    .select("id, name, is_default")
    .eq("host_id", host.hostId)
    .eq("type", policy.type)
    .eq("status", "active")
    .is("deleted_at", null)
    .neq("id", policyId)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  return {
    ok: true,
    data: {
      policyName: full?.name ?? "This policy",
      isDefault: full?.is_default ?? false,
      isPreset: isLockedPreset(policy.preset),
      assignments,
      activeBookings,
      replacements: (repRows ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        isDefault: r.is_default,
      })),
    },
  };
}

/**
 * Retire a policy gracefully: reassign its listings to a replacement (or, when
 * none is given, drop the assignment so listings fall back to the host default),
 * keep the default covered, then ARCHIVE it (never hard-delete — existing
 * bookings keep their immutable snapshots, so refunds are unaffected).
 */
export async function retirePolicyAction(
  policyId: string,
  replacementId: string | null,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;

  const policy = await fetchOwnedPolicy(policyId, host.hostId);
  if (!policy) return { ok: false, error: "Not your policy." };
  if (isLockedPreset(policy.preset)) {
    return { ok: false, error: "Preset policies can't be removed." };
  }

  const supabase = createServerClient();

  let replacement: PolicyRow | null = null;
  if (replacementId) {
    if (replacementId === policyId) {
      return { ok: false, error: "Pick a different replacement policy." };
    }
    replacement = await fetchOwnedPolicy(replacementId, host.hostId);
    if (!replacement || replacement.type !== policy.type) {
      return { ok: false, error: "That replacement isn't valid." };
    }
  }

  // 1. Reassign or clear the listing assignments.
  if (replacement) {
    const { error } = await supabase
      .from("listing_policies")
      .update({ policy_id: replacement.id })
      .eq("policy_id", policyId);
    if (error) return { ok: false, error: "Could not reassign listings." };
  } else {
    await supabase.from("listing_policies").delete().eq("policy_id", policyId);
  }

  // 2. Clear the default flag on the retiring policy; promote the replacement
  //    if it should take over as default.
  const wasDefault = await supabase
    .from("policies")
    .select("is_default")
    .eq("id", policyId)
    .single();

  // 3. Archive (keeps snapshots' FK intact; refunds read the snapshot).
  const { error: archiveErr } = await supabase
    .from("policies")
    .update({
      status: "archived",
      is_default: false,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", policyId);
  if (archiveErr) return { ok: false, error: "Could not archive policy." };

  // 4. Keep a default for this type. If the retired one was the default and we
  //    have a replacement, make it the default; otherwise let the DB pick one.
  if (wasDefault.data?.is_default && replacement) {
    await supabase
      .from("policies")
      .update({ is_default: false })
      .eq("host_id", host.hostId)
      .eq("type", policy.type)
      .eq("is_default", true);
    await supabase
      .from("policies")
      .update({ is_default: true, status: "active" })
      .eq("id", replacement.id);
  }
  await supabase.rpc("ensure_host_default_policies", {
    p_host_id: host.hostId,
  });

  revalidatePath("/dashboard/policies");
  return { ok: true };
}

export async function duplicatePolicyAction(
  policyId: string,
): Promise<ActionResult<{ id: string }>> {
  const host = await getHost();
  if (!host.ok) return host;

  const policy = await fetchOwnedPolicy(policyId, host.hostId);
  if (!policy) return { ok: false, error: "Not your policy." };

  const supabase = createServerClient();
  const { data: full } = await supabase
    .from("policies")
    .select(
      "name, type, summary, is_non_refundable, check_in_time, check_out_time",
    )
    .eq("id", policyId)
    .single();
  if (!full) return { ok: false, error: "Could not load policy." };

  const { data: newRow, error } = await supabase
    .from("policies")
    .insert({
      host_id: host.hostId,
      name: `${full.name} (copy)`,
      type: full.type,
      status: "active",
      preset: "custom",
      parent_policy_id: policyId,
      summary: full.summary,
      is_non_refundable: full.is_non_refundable,
      check_in_time: full.check_in_time,
      check_out_time: full.check_out_time,
    })
    .select("id")
    .single();
  if (error || !newRow) {
    return { ok: false, error: "Could not duplicate policy." };
  }

  // Copy rules + content.
  const [{ data: rules }, { data: content }] = await Promise.all([
    supabase
      .from("policy_cancellation_rules")
      .select("days_before, refund_percent, label, sort_order")
      .eq("policy_id", policyId),
    supabase
      .from("policy_content")
      .select("body_html, body_plain, locale")
      .eq("policy_id", policyId),
  ]);

  if (rules && rules.length > 0) {
    await supabase
      .from("policy_cancellation_rules")
      .insert(rules.map((r) => ({ ...r, policy_id: newRow.id })));
  }
  if (content && content.length > 0) {
    await supabase
      .from("policy_content")
      .insert(content.map((c) => ({ ...c, policy_id: newRow.id })));
  }

  revalidatePath("/dashboard/policies");
  return { ok: true, data: { id: newRow.id } };
}

/** Flip a policy between active and draft (the card toggle). */
export async function togglePolicyStatusAction(
  policyId: string,
  active: boolean,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;

  const policy = await fetchOwnedPolicy(policyId, host.hostId);
  if (!policy) return { ok: false, error: "Not your policy." };

  const supabase = createServerClient();
  const next = active ? "active" : "draft";
  const update: { status: string; is_default?: boolean } = { status: next };
  // A drafted policy can't remain the default.
  if (!active) update.is_default = false;

  const { error } = await supabase
    .from("policies")
    .update(update)
    .eq("id", policyId);
  if (error) return { ok: false, error: "Could not update policy." };

  // Activating may be the first active policy of its type — backfill a default.
  if (active) await ensureDefaults(host.hostId);

  revalidatePath("/dashboard/policies");
  return { ok: true };
}

/**
 * Mark a policy as the host's default for its type. Clears the flag from every
 * other policy of the same type first (the partial unique index allows one),
 * and ensures the new default is active.
 */
export async function setDefaultPolicyAction(
  policyId: string,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;

  const policy = await fetchOwnedPolicy(policyId, host.hostId);
  if (!policy) return { ok: false, error: "Not your policy." };

  const supabase = createServerClient();

  // Clear the existing default of this type, then set the new one. Two writes
  // because the partial unique index forbids two defaults coexisting.
  await supabase
    .from("policies")
    .update({ is_default: false })
    .eq("host_id", host.hostId)
    .eq("type", policy.type)
    .eq("is_default", true);

  const { error } = await supabase
    .from("policies")
    .update({ is_default: true, status: "active" })
    .eq("id", policyId);
  if (error) return { ok: false, error: "Could not set default." };

  revalidatePath("/dashboard/policies");
  return { ok: true };
}

/**
 * Onboarding helper: assign the host's matching cancellation preset
 * (flexible/moderate/strict) to a listing, listing-wide. Best-effort — the
 * onboarding wizard still writes the legacy enum as the primary output.
 */
export async function assignCancellationPresetAction(
  listingId: string,
  preset: "flexible" | "moderate" | "strict",
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;
  await ensurePresets(host.hostId);

  const supabase = createServerClient();
  const { data: policy } = await supabase
    .from("policies")
    .select("id")
    .eq("host_id", host.hostId)
    .eq("type", "cancellation")
    .eq("preset", preset)
    .is("deleted_at", null)
    .maybeSingle();
  if (!policy) return { ok: false, error: "Preset not found." };

  return setListingPolicyAction(listingId, "cancellation", null, policy.id);
}

/**
 * Assign (or clear) a policy for a listing scope.
 *   roomId === null  → the listing-wide default
 *   roomId === <id>  → an override for that room only
 *   policyId === null → clear the assignment for that scope
 * Listing-wide and per-room rows coexist; a room override wins for its room.
 */
export async function setListingPolicyAction(
  listingId: string,
  policyType: PolicyType,
  roomId: string | null,
  policyId: string | null,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;
  if (!(await assertListingOwnership(listingId, host.hostId))) {
    return { ok: false, error: "Not your listing." };
  }

  const supabase = createServerClient();

  // Clear the matching scope.
  const clearScope = async () => {
    let q = supabase
      .from("listing_policies")
      .delete()
      .eq("listing_id", listingId)
      .eq("policy_type", policyType);
    q = roomId === null ? q.is("room_id", null) : q.eq("room_id", roomId);
    return q;
  };

  if (policyId === null) {
    const { error } = await clearScope();
    if (error) return { ok: false, error: "Could not remove policy." };
    revalidatePath(`/dashboard/listings/${listingId}/edit`);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/setup");
    return { ok: true };
  }

  const policy = await fetchOwnedPolicy(policyId, host.hostId);
  if (!policy) return { ok: false, error: "Not your policy." };
  if (policy.type !== policyType) {
    return { ok: false, error: "Policy type mismatch." };
  }

  // Replace the scope row (delete then insert — NULL-safe across both indexes).
  await clearScope();
  const { error } = await supabase.from("listing_policies").insert({
    listing_id: listingId,
    policy_id: policyId,
    policy_type: policyType,
    room_id: roomId,
    assigned_by: host.userId,
  });
  if (error) return { ok: false, error: "Could not assign policy." };

  // Keep the legacy enum correct when a preset is assigned listing-wide so
  // older readers (directory filters) stay in sync. The sync trigger handles
  // the label/non-refundable/check-in-out/house-rules denorm columns.
  if (policyType === "cancellation" && roomId === null && policy.preset) {
    if (["flexible", "moderate", "strict"].includes(policy.preset)) {
      await supabase
        .from("listings")
        .update({ cancellation_policy: policy.preset })
        .eq("id", listingId);
    }
  }

  revalidatePath(`/dashboard/listings/${listingId}/edit`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  return { ok: true };
}
