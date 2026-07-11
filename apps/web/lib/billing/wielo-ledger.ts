import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

// The Wielo revenue ledger read model — every user→Wielo transaction. Mirrors the
// host booking ledger (lib/finance/transactions.ts) but scoped to money paid to
// Wielo (subscriptions, services, refunds, manual adjustments).

// charge/refund/credit/adjustment = money the USER owes/paid Wielo (revenue).
// commission/payout = money WIELO owes/pays an affiliate — now REAL
// platform_ledger rows on the affiliate's own user_id (emitted by DB triggers
// when commission clears / reverses / a payout is paid), each minting a
// document. Shown in their own Affiliate tab + on the affiliate's own
// Transactions page, and EXCLUDED from the revenue KPIs.
export type WieloTxnType =
  | "charge"
  | "refund"
  | "credit"
  | "adjustment"
  | "commission"
  | "payout";
export type WieloTxnStatus = "pending" | "completed" | "failed";
export type WieloEnvironment = "test" | "live";

// The revenue types (user→Wielo) vs the affiliate types (Wielo→affiliate).
const AFFILIATE_TYPES: WieloTxnType[] = ["commission", "payout"];
export function isAffiliateTxn(t: WieloTxnType): boolean {
  return AFFILIATE_TYPES.includes(t);
}

// The downloadable document behind a ledger row: a Wielo invoice (charges), a
// Wielo credit note / refund / adjustment, or an affiliate commission statement /
// remittance advice. Mirrors the host ledger's TxnDoc so the shared Document
// column renders identically.
export type WieloDoc = {
  kind:
    | "invoice"
    | "credit_note"
    | "refund"
    | "adjustment"
    | "commission"
    | "remittance";
  number: string;
  viewPath: string;
  pdfPath: string;
};

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
  productId: string | null;
  billingCycle: string | null;
  provider: string | null;
  providerReference: string | null;
  reason: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  hostId: string | null;
  hostHandle: string | null;
  /** The linked downloadable document (invoice / credit note), or null. */
  doc: WieloDoc | null;
  /** Running balance the user owes Wielo AFTER this entry (+owes / −credit),
   * computed per user oldest→newest. A paid charge nets to zero; an unpaid
   * (pending) charge, a goodwill credit or a signed adjustment move it. */
  balance: number;
};

export type WieloLedgerFilter = {
  userId?: string;
  hostId?: string;
  plan?: string;
  /** Filter to one product: matches the ledger row's product_id OR (for legacy
   * plan-keyed subscription charges) its plan. Pass the product's plan key too. */
  productId?: string;
  productPlanKey?: string;
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
  // Every row — revenue (user→Wielo) AND affiliate (commission/payout, Wielo→
  // affiliate) — is now a real platform_ledger row, so one query serves both.
  // Affiliate types are tagged (isAffiliateTxn) and stay out of the revenue KPIs.
  let q = admin
    .from("platform_ledger")
    .select(
      `id, created_at, type, status, amount, currency, environment, vat_amount, plan,
       product_id, billing_cycle, provider, provider_reference, reason, user_id, host_id,
       payer:user_profiles!user_id ( full_name, email ),
       host:hosts!host_id ( handle )`,
    )
    .order("created_at", { ascending: false })
    .limit(filter.limit ?? 200);

  if (filter.userId) q = q.eq("user_id", filter.userId);
  if (filter.hostId) q = q.eq("host_id", filter.hostId);
  if (filter.plan) q = q.eq("plan", filter.plan);
  // Product filter — match the row's product_id OR its legacy plan key.
  if (filter.productId) {
    const clauses = [`product_id.eq.${filter.productId}`];
    if (filter.productPlanKey) clauses.push(`plan.eq.${filter.productPlanKey}`);
    q = q.or(clauses.join(","));
  }
  if (filter.type) q = q.eq("type", filter.type);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.environment) q = q.eq("environment", filter.environment);
  if (filter.since) q = q.gte("created_at", filter.since);
  if (filter.until) q = q.lte("created_at", filter.until);

  const { data, error } = await q;
  if (error) throw new Error(`fetchWieloLedger: ${error.message}`);

  const rows: WieloTxn[] = (data ?? []).map((r) => {
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
      productId: r.product_id,
      billingCycle: r.billing_cycle,
      provider: r.provider,
      providerReference: r.provider_reference,
      reason: r.reason,
      userId: r.user_id,
      userName: payer?.full_name ?? null,
      userEmail: payer?.email ?? null,
      hostId: r.host_id,
      hostHandle: host?.handle ?? null,
      doc: null,
      balance: 0,
    };
  });

  await attachDocuments(admin, rows);
  computeBalances(rows);

  rows.sort((a, b) => b.date.localeCompare(a.date));
  return rows;
}

// ── Documents ────────────────────────────────────────────────────────────
// Every ledger row has exactly one downloadable document: a Wielo invoice for
// charges, a Wielo credit note (refund / credit / adjustment) for the rest.
// Both are minted by DB triggers keyed on ledger_id, so we join on that.
async function attachDocuments(admin: Db, rows: WieloTxn[]): Promise<void> {
  const ledgerIds = rows.map((r) => r.id);
  if (ledgerIds.length === 0) return;

  const [{ data: invoices }, { data: notes }] = await Promise.all([
    admin
      .from("wielo_invoices")
      .select("ledger_id, invoice_number, hosted_token")
      .in("ledger_id", ledgerIds),
    admin
      .from("wielo_credit_notes")
      .select("ledger_id, kind, credit_note_number, hosted_token")
      .in("ledger_id", ledgerIds),
  ]);

  const byLedger = new Map<string, WieloDoc>();
  for (const inv of invoices ?? []) {
    if (!inv.ledger_id || !inv.hosted_token) continue;
    byLedger.set(inv.ledger_id, {
      kind: "invoice",
      number: inv.invoice_number,
      viewPath: `/wielo-invoice/${inv.hosted_token}`,
      pdfPath: `/wielo-invoice/${inv.hosted_token}/pdf`,
    });
  }
  for (const cn of notes ?? []) {
    if (!cn.ledger_id || !cn.hosted_token) continue;
    byLedger.set(cn.ledger_id, {
      kind:
        cn.kind === "refund"
          ? "refund"
          : cn.kind === "adjustment"
            ? "adjustment"
            : cn.kind === "commission"
              ? "commission"
              : cn.kind === "payout"
                ? "remittance"
                : "credit_note",
      number: cn.credit_note_number,
      viewPath: `/wielo-credit-note/${cn.hosted_token}`,
      pdfPath: `/wielo-credit-note/${cn.hosted_token}/pdf`,
    });
  }
  for (const r of rows) r.doc = byLedger.get(r.id) ?? null;
}

// ── Running per-user balance (what the user owes Wielo) ────────────────────
// Mirrors the host ledger's per-guest balance, but from Wielo's side. A charge
// only counts while it's unpaid (pending) — a completed charge is billed AND
// settled in the same row, so it nets to zero. Goodwill credits and signed
// adjustments move the balance; a refund is a settled cash-out (no debt change).
function owedContribution(t: WieloTxn): number {
  if (t.status === "pending" && t.type === "charge") return t.amount; // owes
  if (t.status !== "completed") return 0;
  if (t.type === "credit") return t.amount; // signed negative → credit
  if (t.type === "adjustment") return t.amount; // signed correction
  return 0; // completed charge (paid) / refund (cash out)
}

function computeBalances(rows: WieloTxn[]): void {
  const asc = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const byUser: Record<string, number> = {};
  for (const e of asc) {
    const key = e.userId ?? "_";
    const run = (byUser[key] ?? 0) + owedContribution(e);
    byUser[key] = run;
    e.balance = Math.round(run * 100) / 100;
  }
}

export function wieloLedgerStats(rows: WieloTxn[]): WieloLedgerStats {
  let collected = 0;
  let refunded = 0;
  let credits = 0;
  let net = 0;
  let pending = 0;

  for (const r of rows) {
    // Affiliate rows are Wielo→user liabilities, not revenue — never in the KPIs.
    if (isAffiliateTxn(r.type)) continue;
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
