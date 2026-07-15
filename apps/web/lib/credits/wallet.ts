import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

// Wielo Credits engine — the platform metering layer. A per-host wallet keyed by
// purpose ('quote' now; 'ai' later), moved only through the atomic + idempotent
// `apply_wielo_credit` RPC. Entitlements stay boolean (check_feature_permission);
// credits meter the countable. See LOOKING_FOR_LIMITS_CREDITS_NOTIFICATIONS_PLAN §4.

export type CreditPurpose = "quote" | "ai" | (string & {});

// Credits a host spends to send one Looking-For quote. Founder: 1 per quote,
// refunded if the quote expires unaccepted (the refund is a DB trigger).
export const LOOKING_FOR_QUOTE_CREDIT_COST = 1;

export type CreditWallet = {
  purpose: string;
  balance: number;
};

export type CreditLedgerEntry = {
  id: string;
  purpose: string;
  delta: number;
  balanceAfter: number;
  kind: string;
  reason: string | null;
  refType: string | null;
  refId: string | null;
  createdAt: string;
};

type Client = SupabaseClient;

/** All wallet balances for a host (one row per purpose). */
export async function getCreditWallets(
  client: Client,
  hostId: string,
): Promise<CreditWallet[]> {
  const { data } = await client
    .from("wielo_credit_wallet")
    .select("purpose, balance")
    .eq("host_id", hostId);
  return (data ?? []).map((w) => ({
    purpose: w.purpose as string,
    balance: (w.balance as number) ?? 0,
  }));
}

/** Balance for one purpose (0 if the wallet doesn't exist yet). */
export async function getCreditBalance(
  client: Client,
  hostId: string,
  purpose: CreditPurpose = "quote",
): Promise<number> {
  const { data } = await client
    .from("wielo_credit_wallet")
    .select("balance")
    .eq("host_id", hostId)
    .eq("purpose", purpose)
    .maybeSingle();
  return (data?.balance as number | undefined) ?? 0;
}

/** Recent ledger movements for the summary modal. */
export async function getCreditLedger(
  client: Client,
  hostId: string,
  opts: { purpose?: CreditPurpose; limit?: number } = {},
): Promise<CreditLedgerEntry[]> {
  let q = client
    .from("wielo_credit_ledger")
    .select(
      "id, purpose, delta, balance_after, kind, reason, ref_type, ref_id, created_at",
    )
    .eq("host_id", hostId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 20);
  if (opts.purpose) q = q.eq("purpose", opts.purpose);
  const { data } = await q;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    purpose: r.purpose as string,
    delta: r.delta as number,
    balanceAfter: r.balance_after as number,
    kind: r.kind as string,
    reason: (r.reason as string | null) ?? null,
    refType: (r.ref_type as string | null) ?? null,
    refId: (r.ref_id as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

export type ApplyCreditInput = {
  hostId: string;
  purpose: CreditPurpose;
  /** +grant/+purchase/+refund, -debit */
  delta: number;
  kind: "grant" | "purchase" | "debit" | "refund" | "adjustment";
  reason?: string;
  refType?: string;
  refId?: string;
  createdBy?: string;
};

export type ApplyCreditResult =
  | { ok: true; balance: number }
  | { ok: false; error: "INSUFFICIENT_CREDITS" | "FAILED" };

/**
 * The single write-path for the wallet — delegates to the atomic + idempotent
 * `apply_wielo_credit` RPC. Runs with the service role (an admin client is used
 * if the caller doesn't pass one).
 */
export async function applyCredit(
  input: ApplyCreditInput,
  client?: Client,
): Promise<ApplyCreditResult> {
  const admin = client ?? createAdminClient();
  const { data, error } = await admin.rpc("apply_wielo_credit", {
    p_host_id: input.hostId,
    p_purpose: input.purpose,
    p_delta: input.delta,
    p_kind: input.kind,
    p_reason: input.reason ?? null,
    p_ref_type: input.refType ?? null,
    p_ref_id: input.refId ?? null,
    p_created_by: input.createdBy ?? null,
  });
  if (error) {
    if (error.message?.includes("INSUFFICIENT_CREDITS")) {
      return { ok: false, error: "INSUFFICIENT_CREDITS" };
    }
    console.error("[credits] applyCredit failed", error);
    return { ok: false, error: "FAILED" };
  }
  return { ok: true, balance: (data as number) ?? 0 };
}

/**
 * Grant the credits a paid credit-package order buys, to the buyer's host
 * wallet. Idempotent (ref_type='product_order', ref_id=orderId) so the webhook
 * and the return-settle can both call it. No-op unless the product is a
 * `wielo_credits` package and the buyer has a host. Best-effort: never throws
 * into the settle path.
 */
export async function grantCreditsForOrder(
  admin: Client,
  order: {
    id: string;
    product_id: string | null;
    payer_user_id: string | null;
  },
): Promise<void> {
  try {
    if (!order.product_id || !order.payer_user_id) return;
    const { data: product } = await admin
      .from("products")
      .select("product_type, credit_quantity, credit_purpose, name")
      .eq("id", order.product_id)
      .maybeSingle();
    if (!product || product.product_type !== "wielo_credits") return;
    const qty = Number(product.credit_quantity ?? 0);
    if (qty <= 0) return;

    const { data: host } = await admin
      .from("hosts")
      .select("id")
      .eq("user_id", order.payer_user_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!host?.id) return; // Only hosts hold credits (buyer isn't a host yet).

    await applyCredit(
      {
        hostId: host.id,
        purpose: (product.credit_purpose as string) || "quote",
        delta: qty,
        kind: "purchase",
        reason: `Purchased: ${product.name ?? "credit package"}`,
        refType: "product_order",
        refId: order.id,
      },
      admin,
    );
  } catch (err) {
    console.error("[credits] grantCreditsForOrder failed", err);
  }
}

/**
 * Spend the quote-credit cost for sending ONE Looking-For quote. Idempotent per
 * quote (ref_type='quote', ref_id=quoteId, kind='debit') so a re-send never
 * double-charges. Returns { ok:false, error:'INSUFFICIENT_CREDITS' } when the
 * host's wallet can't cover it — the caller blocks the send and prompts a top-up.
 * The matching refund on unaccepted expiry is a DB trigger.
 */
export async function spendQuoteCredit(
  admin: Client,
  hostId: string,
  quoteId: string,
  purpose: CreditPurpose = "quote",
): Promise<ApplyCreditResult> {
  return applyCredit(
    {
      hostId,
      purpose,
      delta: -LOOKING_FOR_QUOTE_CREDIT_COST,
      kind: "debit",
      reason: "Looking-For quote sent",
      refType: "quote",
      refId: quoteId,
    },
    admin,
  );
}

/**
 * Grant the recurring credit allotment a subscription product includes, for the
 * current billing period. Idempotent per (product, period start) so activation +
 * each renewal grants exactly once. No-op unless the product carries a
 * credit_quantity. Best-effort — never throws into the settle path.
 *
 * `overrideQty` (admin activation only): grant THIS many credits for the period
 * instead of the product default — lets an admin set a custom allotment when
 * activating a subscription for a user. Idempotent on the same (product, period).
 */
export async function grantSubscriptionCredits(
  admin: Client,
  input: {
    hostId: string;
    productId: string;
    periodStart: string;
    overrideQty?: number | null;
  },
): Promise<void> {
  try {
    const { data: product } = await admin
      .from("products")
      .select("credit_quantity, credit_purpose, name")
      .eq("id", input.productId)
      .maybeSingle();
    const qty =
      input.overrideQty != null
        ? Number(input.overrideQty)
        : Number(product?.credit_quantity ?? 0);
    if (qty <= 0) return;
    // One grant per billing period — the period start makes the ref unique per
    // cycle so renewals top up again.
    const periodKey = input.periodStart.slice(0, 10);
    await applyCredit(
      {
        hostId: input.hostId,
        purpose: (product?.credit_purpose as string) || "quote",
        delta: qty,
        kind: "grant",
        reason: `Plan credits · ${product?.name ?? "subscription"}`,
        refType: "subscription",
        refId: `${input.productId}:${periodKey}`,
      },
      admin,
    );
  } catch (err) {
    console.error("[credits] grantSubscriptionCredits failed", err);
  }
}
