import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ALLOWANCE_FEATURE_BY_PURPOSE,
  LOOKING_FOR_LEAD_CREDIT_COST,
  WIELO_CREDIT_PURPOSE,
  applyCredit,
} from "@/lib/credits/wallet";
import { resolveFeatureLimit } from "@/lib/products/featureGate";

// ---------------------------------------------------------------------------
// Lead access — the ONE place that decides whether a host may see a Looking-For
// request's details, and the only path that spends a credit to open one.
//
// Model (founder, 2026-07-16): a request is never dropped — it always appears,
// but its details stay locked until the host spends a credit. Seeing costs 1
// credit, quoting costs another 1, and BOTH come off the same Wielo credit
// balance, which never expires. One balance, one top-up, priced per action.
//
// The unlock is permanent and idempotent, so a host pays once to see a given
// request no matter how often they revisit it.
//
// Keep every surface (board, respond page) dumb: they ask this module what's
// unlocked and call `unlockLead`. No credit logic in components.
// ---------------------------------------------------------------------------

export const LEAD_PURPOSE = WIELO_CREDIT_PURPOSE;
const LEAD_FEATURE = ALLOWANCE_FEATURE_BY_PURPOSE[LEAD_PURPOSE];

export type LeadAccess = {
  /**
   * Allowance is unmetered for this host (resolved limit is NULL). Leads are
   * free and always open — we must NOT fall back to the wallet, which would sit
   * at 0 and read as "blocked" for an unlimited host.
   */
  unlimited: boolean;
  /** Lead-credit balance. Meaningless when `unlimited`. */
  balance: number;
  /** Post ids this host has already unlocked (charged once, open forever). */
  unlockedIds: Set<string>;
};

/**
 * Everything a surface needs to render lock state, in one round trip per
 * concern. Pass the post ids on screen so the unlock lookup stays bounded
 * rather than fetching a host's entire unlock history.
 */
export async function loadLeadAccess(
  client: SupabaseClient,
  hostId: string,
  postIds: string[],
): Promise<LeadAccess> {
  const [{ limit }, unlockedIds] = await Promise.all([
    resolveFeatureLimit(client, hostId, LEAD_FEATURE),
    loadUnlockedPostIds(client, hostId, postIds),
  ]);

  if (limit === null) {
    return { unlimited: true, balance: 0, unlockedIds };
  }

  const { data } = await client
    .from("wielo_credit_wallet")
    .select("balance")
    .eq("host_id", hostId)
    .eq("purpose", LEAD_PURPOSE)
    .maybeSingle();

  return {
    unlimited: false,
    balance: (data?.balance as number | undefined) ?? 0,
    unlockedIds,
  };
}

/** Which of `postIds` this host has already unlocked. */
export async function loadUnlockedPostIds(
  client: SupabaseClient,
  hostId: string,
  postIds: string[],
): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const { data } = await client
    .from("looking_for_post_unlocks")
    .select("post_id")
    .eq("host_id", hostId)
    .in("post_id", postIds);
  return new Set((data ?? []).map((r) => r.post_id as string));
}

export async function isLeadUnlocked(
  client: SupabaseClient,
  hostId: string,
  postId: string,
): Promise<boolean> {
  const { data } = await client
    .from("looking_for_post_unlocks")
    .select("post_id")
    .eq("host_id", hostId)
    .eq("post_id", postId)
    .maybeSingle();
  return !!data;
}

export type UnlockResult =
  | { ok: true; alreadyUnlocked: boolean }
  | { ok: false; error: "INSUFFICIENT_CREDITS" | "FAILED" };

/**
 * Unlock one lead for a host. Spend first, then record — so a failed spend can
 * never leave a free unlock behind. The unlock row's UNIQUE(post_id, host_id) is
 * the idempotency key: re-unlocking is a no-op and never double-charges.
 *
 * Requires an admin client: the wallet RPC and the unlock insert are both
 * privileged (the RLS policy deliberately allows SELECT only, so no client can
 * insert its way to a free lead).
 */
export async function unlockLead(
  admin: SupabaseClient,
  hostId: string,
  postId: string,
): Promise<UnlockResult> {
  if (await isLeadUnlocked(admin, hostId, postId)) {
    return { ok: true, alreadyUnlocked: true };
  }

  const { limit } = await resolveFeatureLimit(admin, hostId, LEAD_FEATURE);

  // Unlimited allowance → open the lead without touching the wallet.
  if (limit !== null) {
    const spend = await applyCredit(
      {
        hostId,
        purpose: LEAD_PURPOSE,
        delta: -LOOKING_FOR_LEAD_CREDIT_COST,
        kind: "debit",
        reason: "Looking-For lead unlocked",
        refType: "looking_for_post",
        refId: postId,
      },
      admin,
    );
    if (!spend.ok) return { ok: false, error: spend.error };
  }

  const { error } = await admin
    .from("looking_for_post_unlocks")
    .insert({ host_id: hostId, post_id: postId });

  // A concurrent unlock won the race — the host is unlocked and the credit was
  // deduped by apply_wielo_credit's (host, ref_type, ref_id, kind) key, so this
  // is a success, not a failure.
  if (error && !error.message?.includes("duplicate key")) {
    return { ok: false, error: "FAILED" };
  }

  return { ok: true, alreadyUnlocked: false };
}
