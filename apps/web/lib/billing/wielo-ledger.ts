import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

// The Wielo revenue ledger read model — every user→Wielo transaction. Mirrors the
// host booking ledger (lib/finance/transactions.ts) but scoped to money paid to
// Wielo (subscriptions, services, refunds, manual adjustments).

// charge/refund/credit/adjustment = money the USER owes/paid Wielo (revenue).
// commission_owed/commission_paid = money WIELO owes an affiliate (a liability +
// its payout) — surfaced on the SAME ledger via an adapter over the affiliate
// tables (affiliate_commissions / affiliate_payouts stay the source of truth),
// shown in their own Affiliate tab and EXCLUDED from the revenue KPIs.
export type WieloTxnType =
  | "charge"
  | "refund"
  | "credit"
  | "adjustment"
  | "commission_owed"
  | "commission_paid";
export type WieloTxnStatus = "pending" | "completed" | "failed";
export type WieloEnvironment = "test" | "live";

// The revenue types (user→Wielo) vs the affiliate types (Wielo→affiliate).
const AFFILIATE_TYPES: WieloTxnType[] = ["commission_owed", "commission_paid"];
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
  // Revenue rows (platform_ledger) and affiliate rows (affiliate tables) are
  // fetched independently and merged. A type filter for a commission type skips
  // the revenue query entirely, and vice-versa.
  const wantRevenue = !filter.type || !isAffiliateTxn(filter.type);
  const wantAffiliate = !filter.type || isAffiliateTxn(filter.type);

  let rows: WieloTxn[] = [];

  if (wantRevenue) {
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
      if (filter.productPlanKey)
        clauses.push(`plan.eq.${filter.productPlanKey}`);
      q = q.or(clauses.join(","));
    }
    if (filter.type) q = q.eq("type", filter.type);
    if (filter.status) q = q.eq("status", filter.status);
    if (filter.environment) q = q.eq("environment", filter.environment);
    if (filter.since) q = q.gte("created_at", filter.since);
    if (filter.until) q = q.lte("created_at", filter.until);

    const { data, error } = await q;
    if (error) throw new Error(`fetchWieloLedger: ${error.message}`);

    rows = (data ?? []).map((r) => {
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
  }

  if (wantAffiliate) {
    const affiliate = await fetchAffiliateRows(admin, filter);
    rows = rows.concat(affiliate);
  }

  rows.sort((a, b) => b.date.localeCompare(a.date));
  return rows;
}

// ── Affiliate adapter (Wielo→affiliate money on the SAME ledger) ───────────
// Reads the affiliate tables and adapts each into a WieloTxn WITHOUT posting to
// platform_ledger (the affiliate tables stay SSOT). Commissions become
// `commission_owed` liabilities; payouts become `commission_paid` cash-out.
// Each carries a running per-affiliate "Wielo owes this affiliate" balance.
async function fetchAffiliateRows(
  admin: Db,
  filter: WieloLedgerFilter,
): Promise<WieloTxn[]> {
  // Affiliate money is real (live) money — it carries no test/live environment,
  // so a test-only scope excludes it.
  if (filter.environment === "test") return [];

  const [{ data: comms }, { data: payouts }] = await Promise.all([
    admin
      .from("affiliate_commissions")
      .select(
        "id, affiliate_id, commission_amount, currency, status, entry_type, created_at, product_id, referred_host_id",
      )
      .neq("status", "voided"),
    admin
      .from("affiliate_payouts")
      .select(
        "id, affiliate_id, net_amount, currency, status, method, provider, provider_reference, created_at, processed_at",
      ),
  ]);

  // Resolve affiliate_id → the affiliate's user (name/email/handle) in one pass.
  const affiliateIds = new Set<string>();
  for (const c of comms ?? [])
    if (c.affiliate_id) affiliateIds.add(c.affiliate_id);
  for (const p of payouts ?? [])
    if (p.affiliate_id) affiliateIds.add(p.affiliate_id);
  const accountById = new Map<
    string,
    {
      userId: string | null;
      name: string | null;
      email: string | null;
      slug: string | null;
    }
  >();
  if (affiliateIds.size > 0) {
    const { data: accounts } = await admin
      .from("affiliate_accounts")
      .select(
        "id, slug, user_id, user:user_profiles!user_id ( full_name, email )",
      )
      .in("id", [...affiliateIds]);
    for (const a of accounts ?? []) {
      const u = Array.isArray(a.user) ? a.user[0] : a.user;
      accountById.set(a.id, {
        userId: a.user_id ?? null,
        name: u?.full_name ?? null,
        email: u?.email ?? null,
        slug: a.slug ?? null,
      });
    }
  }

  // Optional product-name lookup for a friendlier "For" reason.
  const productIds = new Set<string>();
  for (const c of comms ?? []) if (c.product_id) productIds.add(c.product_id);
  const productName = new Map<string, string>();
  if (productIds.size > 0) {
    const { data: products } = await admin
      .from("products")
      .select("id, name")
      .in("id", [...productIds]);
    for (const p of products ?? []) productName.set(p.id, p.name);
  }

  const rows: WieloTxn[] = [];

  for (const c of comms ?? []) {
    const acct = c.affiliate_id ? accountById.get(c.affiliate_id) : undefined;
    // A commission is a liability from accrual; 'paid' means it has settled.
    const status: WieloTxnStatus =
      c.status === "paid" ? "completed" : "pending";
    rows.push({
      id: `comm_${c.id}`,
      date: c.created_at,
      type: "commission_owed",
      status,
      amount: Number(c.commission_amount), // + = Wielo owes the affiliate
      currency: c.currency ?? "ZAR",
      environment: "live",
      vatAmount: null,
      plan: null,
      productId: null,
      billingCycle: null,
      provider: "affiliate",
      providerReference: c.referred_host_id ?? null,
      reason: c.product_id
        ? `Commission · ${productName.get(c.product_id) ?? "product"}`
        : "Affiliate commission",
      userId: acct?.userId ?? null,
      userName: acct?.name ?? null,
      userEmail: acct?.email ?? null,
      hostId: null,
      hostHandle: acct?.slug ?? null,
      doc: {
        kind: "commission",
        number: `COM-${c.id.slice(0, 8).toUpperCase()}`,
        viewPath: `/wielo-commission/${c.id}`,
        pdfPath: `/wielo-commission/${c.id}/pdf`,
      },
      balance: 0,
    });
  }

  for (const p of payouts ?? []) {
    const acct = p.affiliate_id ? accountById.get(p.affiliate_id) : undefined;
    const status: WieloTxnStatus =
      p.status === "paid" || p.status === "completed"
        ? "completed"
        : p.status === "failed"
          ? "failed"
          : "pending";
    rows.push({
      id: `payout_${p.id}`,
      date: p.processed_at ?? p.created_at,
      type: "commission_paid",
      status,
      amount: -Math.abs(Number(p.net_amount)), // − = money out to the affiliate
      currency: p.currency ?? "ZAR",
      environment: "live",
      vatAmount: null,
      plan: null,
      productId: null,
      billingCycle: null,
      provider: p.provider ?? p.method ?? "affiliate",
      providerReference: p.provider_reference ?? null,
      reason: `Payout${p.method ? ` · ${p.method}` : ""}`,
      userId: acct?.userId ?? null,
      userName: acct?.name ?? null,
      userEmail: acct?.email ?? null,
      hostId: null,
      hostHandle: acct?.slug ?? null,
      doc: {
        kind: "remittance",
        number: `RMT-${p.id.slice(0, 8).toUpperCase()}`,
        viewPath: `/wielo-commission/payout_${p.id}`,
        pdfPath: `/wielo-commission/payout_${p.id}/pdf`,
      },
      balance: 0,
    });
  }

  // Apply the shared filters that make sense for affiliate rows.
  let filtered = rows;
  if (filter.userId)
    filtered = filtered.filter((r) => r.userId === filter.userId);
  if (filter.status)
    filtered = filtered.filter((r) => r.status === filter.status);
  if (filter.since)
    filtered = filtered.filter((r) => r.date >= (filter.since as string));
  if (filter.until)
    filtered = filtered.filter((r) => r.date <= (filter.until as string));

  computeAffiliateBalances(filtered);
  return filtered;
}

// Running "Wielo owes this affiliate R X" balance, per affiliate, oldest→newest:
// a commission owed adds to the liability, a payout reduces it.
function computeAffiliateBalances(rows: WieloTxn[]): void {
  const asc = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const byUser: Record<string, number> = {};
  for (const e of asc) {
    const key = e.userId ?? "_";
    // amount is already signed (+owed / −paid); the running sum is the balance.
    const run = (byUser[key] ?? 0) + e.amount;
    byUser[key] = run;
    e.balance = Math.round(run * 100) / 100;
  }
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
