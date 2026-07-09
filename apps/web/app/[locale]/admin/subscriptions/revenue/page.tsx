import { requirePermission } from "@/lib/admin";
import { fetchWieloLedger, wieloLedgerStats } from "@/lib/billing/wielo-ledger";
import { getAllPlans } from "@/lib/plans/getPlans";
import {
  getSellableProducts,
  getSubscriptionProducts,
} from "@/lib/products/getProducts";
import { createAdminClient } from "@/lib/supabase/admin";

import { SubsTabs } from "../_SubsTabs";
import { AdminLedgerBoard, type WieloKpis } from "./AdminLedgerBoard";

export const dynamic = "force-dynamic";

const STATUSES = ["all", "completed", "pending", "failed"] as const;

export default async function AdminRevenuePage({
  searchParams,
}: {
  searchParams?: {
    user?: string;
    product?: string;
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

  const productParam = (searchParams?.product ?? "").trim();
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

  // The full sellable catalog drives the product filter dropdown. Resolve the
  // selected product first so we can match its product_id AND its legacy plan key.
  const sellableProducts = await getSellableProducts();
  const selectedProduct = productParam
    ? sellableProducts.find((p) => p.id === productParam)
    : undefined;

  const [rows, plans, products, { data: subs }] = await Promise.all([
    fetchWieloLedger(service, {
      limit: 1000,
      userId,
      productId: selectedProduct?.id,
      productPlanKey: selectedProduct?.planKey ?? undefined,
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
  // Display maps so a ledger row reads "Starter" not "pro" / a bare id:
  //  - planLabels: legacy plan key → product name (plan-keyed subscription rows).
  //  - productLabels: product_id → product name (product-keyed rows, incl one-off).
  // The product FILTER lists EVERY sellable product (subscriptions + one-off),
  // value = product_id, so the founder can filter by any product they added.
  const planLabels: Record<string, string> = {};
  const productLabels: Record<string, string> = {};
  for (const p of sellableProducts) {
    if (p.planKey) planLabels[p.planKey] = p.name;
    productLabels[p.id] = p.name;
  }
  const productFilters = sellableProducts.map((p) => ({
    key: p.id,
    name: p.name,
    productType: p.productType,
  }));
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
      <header className="flex flex-wrap items-center gap-2.5">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            Wielo revenue ledger
          </h1>
          <p className="mt-1 text-[13px] text-brand-mute">
            Every transaction between a user and Wielo — subscriptions,
            products, refunds, credits and adjustments. Booking money goes to
            hosts and isn&apos;t shown here.
          </p>
        </div>
        {envFilter === "test" ? (
          <span className="inline-flex items-center rounded-pill border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
            Test
          </span>
        ) : envFilter === "all" ? (
          <span className="inline-flex items-center rounded-pill border border-brand-line bg-brand-light px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Test + Live
          </span>
        ) : null}
      </header>

      <SubsTabs />

      <AdminLedgerBoard
        entries={rows}
        kpis={kpis}
        currency={currency}
        planLabels={planLabels}
        productLabels={productLabels}
        products={productFilters}
        payableProducts={sellableProducts.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          currency: p.currency,
          productType: p.productType,
        }))}
        env={envFilter}
        userEmail={userEmail}
        product={productParam}
        status={statusFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />
    </div>
  );
}
