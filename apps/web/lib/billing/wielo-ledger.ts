import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

// The Wielo revenue ledger read model — every user→Wielo transaction. Mirrors the
// host booking ledger (lib/finance/transactions.ts) but scoped to money paid to
// Wielo (subscriptions, services, refunds, manual adjustments).

export type WieloTxnType = "charge" | "refund" | "credit" | "adjustment";
export type WieloTxnStatus = "pending" | "completed" | "failed";
export type WieloEnvironment = "test" | "live";

export type WieloTxn = {
  id: string;
  date: string;
  type: WieloTxnType;
  status: WieloTxnStatus;
  amount: number; // signed
  currency: string;
  environment: WieloEnvironment;
  vatAmount: number | null;
  plan: string | null;
  billingCycle: string | null;
  provider: string | null;
  providerReference: string | null;
  reason: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  hostId: string | null;
  hostHandle: string | null;
};

export type WieloLedgerFilter = {
  userId?: string;
  hostId?: string;
  plan?: string;
  type?: WieloTxnType;
  status?: WieloTxnStatus;
  environment?: WieloEnvironment; // omit = both
  since?: string; // ISO
  until?: string; // ISO
  limit?: number;
};

export type WieloLedgerStats = {
  collected: number; // completed charges in
  refunded: number; // completed refunds out (positive magnitude)
  credits: number; // completed credits out (positive magnitude)
  net: number; // sum of all completed signed amounts
  pending: number; // sum of pending signed amounts
  count: number;
};

type Db = ReturnType<typeof createAdminClient>;

export async function fetchWieloLedger(
  admin: Db,
  filter: WieloLedgerFilter = {},
): Promise<WieloTxn[]> {
  let q = admin
    .from("platform_ledger")
    .select(
      `id, created_at, type, status, amount, currency, environment, vat_amount, plan,
       billing_cycle, provider, provider_reference, reason, user_id, host_id,
       payer:user_profiles!user_id ( full_name, email ),
       host:hosts!host_id ( handle )`,
    )
    .order("created_at", { ascending: false })
    .limit(filter.limit ?? 200);

  if (filter.userId) q = q.eq("user_id", filter.userId);
  if (filter.hostId) q = q.eq("host_id", filter.hostId);
  if (filter.plan) q = q.eq("plan", filter.plan);
  if (filter.type) q = q.eq("type", filter.type);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.environment) q = q.eq("environment", filter.environment);
  if (filter.since) q = q.gte("created_at", filter.since);
  if (filter.until) q = q.lte("created_at", filter.until);

  const { data, error } = await q;
  if (error) throw new Error(`fetchWieloLedger: ${error.message}`);

  return (data ?? []).map((r) => {
    const payer = Array.isArray(r.payer) ? r.payer[0] : r.payer;
    const host = Array.isArray(r.host) ? r.host[0] : r.host;
    return {
      id: r.id,
      date: r.created_at,
      type: r.type as WieloTxnType,
      status: r.status as WieloTxnStatus,
      amount: Number(r.amount),
      currency: r.currency,
      environment: (r.environment === "test"
        ? "test"
        : "live") as WieloEnvironment,
      vatAmount: r.vat_amount != null ? Number(r.vat_amount) : null,
      plan: r.plan,
      billingCycle: r.billing_cycle,
      provider: r.provider,
      providerReference: r.provider_reference,
      reason: r.reason,
      userId: r.user_id,
      userName: payer?.full_name ?? null,
      userEmail: payer?.email ?? null,
      hostId: r.host_id,
      hostHandle: host?.handle ?? null,
    };
  });
}

export function wieloLedgerStats(rows: WieloTxn[]): WieloLedgerStats {
  let collected = 0;
  let refunded = 0;
  let credits = 0;
  let net = 0;
  let pending = 0;

  for (const r of rows) {
    if (r.status === "pending") {
      pending += r.amount;
      continue;
    }
    if (r.status !== "completed") continue;
    net += r.amount;
    if (r.type === "charge") collected += r.amount;
    else if (r.type === "refund") refunded += Math.abs(r.amount);
    else if (r.type === "credit") credits += Math.abs(r.amount);
  }

  return { collected, refunded, credits, net, pending, count: rows.length };
}
