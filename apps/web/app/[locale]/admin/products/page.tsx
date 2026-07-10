import { Plus } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/admin";
import { formatZar } from "@/app/[locale]/dashboard/settings/subscription/plans";
import { createAdminClient } from "@/lib/supabase/admin";

import { PaystackModeBadge } from "./PaystackModeBadge";

export const dynamic = "force-dynamic";

const CYCLE_LABEL: Record<string, string> = {
  weekly: "wk",
  monthly: "mo",
  quarterly: "qtr",
  biannual: "6mo",
  annual: "yr",
};

const DURATION_LABEL: Record<string, string> = {
  once: "first payment",
  months: "for N months",
  forever: "recurring",
};

// A commission value as either a percent or a Rand amount.
function fmtCommission(type: string, value: number): string {
  return type === "percent" ? `${value}%` : formatZar(Number(value));
}

export default async function AdminProductsPage() {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const [
    { data: products },
    { data: pay },
    { data: paidOrders },
    { data: activeSubs },
  ] = await Promise.all([
    service
      .from("products")
      .select(
        "id, name, description, product_type, price, currency, billing_cycle, is_active, is_recommended, affiliate_type, affiliate_value, affiliate_duration, setup_fee, setup_fee_affiliate_type, setup_fee_affiliate_value, sort_order",
      )
      .order("sort_order", { ascending: true }),
    service
      .from("platform_payment_settings")
      .select("paystack_enabled, paystack_mode")
      .eq("id", true)
      .maybeSingle(),
    // Units sold = paid product orders (distinct buyer per product).
    service
      .from("product_orders")
      .select("product_id, payer_user_id")
      .eq("status", "paid"),
    // Active subscribers per subscription product.
    service
      .from("subscriptions")
      .select("product_id")
      .in("status", ["trialing", "active"]),
  ]);

  // Per-product tallies: distinct buyers (paid orders) + active subscribers.
  const soldByProduct = new Map<string, Set<string>>();
  for (const o of paidOrders ?? []) {
    if (!o.product_id) continue;
    const set = soldByProduct.get(o.product_id) ?? new Set<string>();
    // Distinct by buyer; anonymous (null) orders each count once.
    set.add(o.payer_user_id ?? `anon-${set.size}`);
    soldByProduct.set(o.product_id, set);
  }
  const activeByProduct = new Map<string, number>();
  for (const s of activeSubs ?? []) {
    if (!s.product_id) continue;
    activeByProduct.set(
      s.product_id,
      (activeByProduct.get(s.product_id) ?? 0) + 1,
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            Product manager
          </h1>
          <p className="mt-1 text-[13px] text-brand-mute">
            Everything Wielo sells — subscriptions and once-off products. Set
            price, duration, feature permissions and affiliate payout. Sales
            land in the Wielo ledger.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PaystackModeBadge
            enabled={pay?.paystack_enabled ?? false}
            mode={pay?.paystack_mode === "test" ? "test" : "live"}
          />
          <Link
            href="/admin/products/payments"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-brand-line bg-white px-4 text-[13px] font-semibold text-brand-ink hover:bg-brand-light"
          >
            Payment settings
          </Link>
          <Link
            href="/admin/products/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-primary px-4 text-[13px] font-semibold text-white hover:bg-brand-secondary"
          >
            <Plus className="h-4 w-4" /> New product
          </Link>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(products ?? []).map((p) => (
          <Link
            key={p.id}
            href={`/admin/products/${p.id}`}
            className={`flex flex-col rounded-card border bg-white p-5 shadow-card transition-shadow hover:shadow-md ${
              p.is_recommended
                ? "border-brand-primary ring-1 ring-brand-primary/30"
                : "border-brand-line"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-display text-base font-semibold text-brand-ink">
                {p.name}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-brand-mute">
                  {p.product_type === "membership"
                    ? "membership"
                    : p.product_type === "service"
                      ? "service"
                      : "once-off"}
                </span>
                {!p.is_active ? (
                  <span className="inline-flex items-center rounded-pill border border-status-cancelled/30 bg-status-cancelled/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-status-cancelled">
                    Hidden
                  </span>
                ) : null}
              </div>
            </div>
            {p.description ? (
              <p className="mt-2 line-clamp-2 text-[12.5px] text-brand-mute">
                {p.description}
              </p>
            ) : null}
            <div className="mt-3 font-display text-lg font-bold text-brand-ink">
              {formatZar(Number(p.price))}
              {p.product_type !== "product" ? (
                <span className="ml-1.5 text-[11px] font-medium text-brand-mute">
                  / {CYCLE_LABEL[p.billing_cycle ?? "monthly"] ?? "mo"}
                </span>
              ) : null}
            </div>

            {/* Sales tally: distinct buyers + active subscribers */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-brand-mute">
              <span>
                <span className="font-semibold text-brand-ink">
                  {soldByProduct.get(p.id)?.size ?? 0}
                </span>{" "}
                bought
              </span>
              {p.product_type !== "product" ? (
                <span>
                  <span className="font-semibold text-brand-ink">
                    {activeByProduct.get(p.id) ?? 0}
                  </span>{" "}
                  active
                </span>
              ) : null}
            </div>

            {/* Commission structure: recurring/referral + setup fee & its commission */}
            {p.affiliate_type !== "none" || Number(p.setup_fee) > 0 ? (
              <div className="mt-2 space-y-0.5 border-t border-brand-line pt-2 text-[11px] text-brand-mute">
                {p.affiliate_type !== "none" ? (
                  <div>
                    {p.product_type !== "product"
                      ? "Sub commission"
                      : "Commission"}
                    :{" "}
                    <span className="font-semibold text-brand-ink">
                      {fmtCommission(
                        p.affiliate_type,
                        Number(p.affiliate_value),
                      )}
                    </span>
                    {p.product_type !== "product"
                      ? ` · ${
                          DURATION_LABEL[p.affiliate_duration ?? "once"] ??
                          "first payment"
                        }`
                      : ""}
                  </div>
                ) : null}
                {Number(p.setup_fee) > 0 ? (
                  <div>
                    Setup fee:{" "}
                    <span className="font-semibold text-brand-ink">
                      {formatZar(Number(p.setup_fee))}
                    </span>
                    {p.setup_fee_affiliate_type &&
                    p.setup_fee_affiliate_type !== "none"
                      ? ` · commission ${fmtCommission(
                          p.setup_fee_affiliate_type,
                          Number(p.setup_fee_affiliate_value),
                        )}`
                      : ""}
                  </div>
                ) : null}
              </div>
            ) : null}
          </Link>
        ))}
        {(products ?? []).length === 0 ? (
          <div className="col-span-full rounded-card border border-dashed border-brand-line bg-white px-6 py-12 text-center text-sm text-brand-mute">
            No products yet. Create your first subscription or once-off product.
          </div>
        ) : null}
      </div>
    </div>
  );
}
