import { requirePermission } from "@/lib/admin";
import { fetchWieloLedger, wieloLedgerStats } from "@/lib/billing/wielo-ledger";
import { getAllPlans } from "@/lib/plans/getPlans";
import { getSubscriptionProducts } from "@/lib/products/getProducts";
import { createAdminClient } from "@/lib/supabase/admin";

import { AdminLedgerBoard, type WieloKpis } from "./AdminLedgerBoard";
import { ManualEntryForm } from "./ManualEntryForm";

export const dynamic = "force-dynamic";

const STATUSES = ["all", "completed", "pending", "failed"] as const;

export default async function AdminRevenuePage({
  searchParams,
}: {
  searchParams?: {
    user?: string;
    plan?: string;
    status?: string;
    env?: string;
    from?: string;
    to?: string;
  };
}) {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  // Env: default to the platform's active Paystack mode so test transactions
  // show in the ledger while you're testing; flips to live at launch. ?env wins.
  const { data: paySettings } = await service
    .from("platform_payment_settings")
    .select("paystack_mode")
    .eq("id", true)
    .maybeSingle();
  const envParam = (searchParams?.env ?? "").trim();
  const envFilter: "live" | "test" | "all" =
    envParam === "test" || envParam === "all" || envParam === "live"
      ? (envParam as "live" | "test" | "all")
      : paySettings?.paystack_mode === "test"
        ? "test"
        : "live";

  const planFilter = (searchParams?.plan ?? "").trim();
  const userEmail = (searchParams?.user ?? "").trim();
  const statusFilter = STATUSES.includes(
    (searchParams?.status ?? "") as (typeof STATUSES)[number],
  )
    ? (searchParams!.status as (typeof STATUSES)[number])
    : "all";
  // Date range (YYYY-MM-DD). `to` is made inclusive to end-of-day.
  const dateFrom = /^\d{4}-\d{2}-\d{2}$/.test(searchParams?.from ?? "")
    ? (searchParams!.from as string)
    : "";
  const dateTo = /^\d{4}-\d{2}-\d{2}$/.test(searchParams?.to ?? "")
    ? (searchParams!.to as string)
    : "";

  // Resolve a user email → id for the user filter.
  let userId: string | undefined;
  if (userEmail) {
    const { data: u } = await service
      .from("user_profiles")
      .select("id")
      .ilike("email", userEmail)
      .maybeSingle();
    userId = u?.id ?? "00000000-0000-0000-0000-000000000000";
  }

  const [rows, plans, products, { data: subs }] = await Promise.all([
    fetchWieloLedger(service, {
      limit: 1000,
      userId,
      plan: planFilter || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      environment: envFilter === "all" ? undefined : envFilter,
      since: dateFrom || undefined,
      until: dateTo ? `${dateTo}T23:59:59.999Z` : undefined,
    }),
    getAllPlans(),
    getSubscriptionProducts(),
    service
      .from("subscriptions")
      .select("plan, billing_cycle, status, product_id"),
  ]);

  const stats = wieloLedgerStats(rows);

  // MRR from active, paying subscriptions. Product-first: read the real price
  // from the linked PRODUCT; fall back to the legacy plan price for subscriptions
  // not yet linked to a product. Annual /12.
  const planPrice = new Map(plans.map((p) => [p.key, p]));
  const productPrice = new Map(products.map((p) => [p.id, p]));
  // Plan tier → product name, so a ledger row reads "Starter" not "pro".
  const planLabels: Record<string, string> = {};
  for (const p of products) {
    if (p.planKey && !(p.planKey in planLabels)) planLabels[p.planKey] = p.name;
  }
  let mrr = 0;
  let payingHosts = 0;
  for (const s of subs ?? []) {
    if (s.status !== "active") continue;
    let monthly: number | null = null;
    const prod = s.product_id ? productPrice.get(s.product_id) : undefined;
    if (prod && !prod.isFree) {
      monthly = prod.billingCycle === "annual" ? prod.price / 12 : prod.price;
    } else if (!s.product_id) {
      const pd = planPrice.get(s.plan as string);
      if (pd && !pd.isFree) {
        monthly = s.billing_cycle === "annual" ? pd.annual / 12 : pd.monthly;
      }
    }
    if (monthly == null) continue;
    mrr += monthly;
    payingHosts += 1;
  }

  const kpis: WieloKpis = {
    mrr,
    arr: mrr * 12,
    collected: stats.collected,
    refunded: stats.refunded,
    net: stats.net,
    payingHosts,
  };

  const currency = rows[0]?.currency ?? "ZAR";

  return (
    <div className="space-y-6">
      <AdminLedgerBoard
        entries={rows}
        kpis={kpis}
        currency={currency}
        planLabels={planLabels}
        plans={plans.map((p) => ({ key: p.key, name: p.name }))}
        env={envFilter}
        userEmail={userEmail}
        plan={planFilter}
        status={statusFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />

      {/* Post a manual entry — goodwill credit / write-off / off-platform charge
          / correction. Audited. Mints a Wielo document on completion. */}
      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h2 className="font-display text-base font-bold text-brand-ink">
          Post a manual entry
        </h2>
        <p className="mb-4 mt-1 text-[13px] text-brand-mute">
          Record a goodwill credit, write-off, off-platform charge or correction
          against a host&apos;s Wielo account. Audited, and mints a downloadable
          document.
        </p>
        <ManualEntryForm />
      </section>
    </div>
  );
}
