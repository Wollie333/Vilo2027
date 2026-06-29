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

export default async function AdminProductsPage() {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const [{ data: products }, { data: pay }] = await Promise.all([
    service
      .from("products")
      .select(
        "id, name, description, type, price, currency, billing_cycle, is_active, is_recommended, affiliate_type, affiliate_value, sort_order",
      )
      .order("sort_order", { ascending: true }),
    service
      .from("platform_payment_settings")
      .select("paystack_enabled, paystack_mode")
      .eq("id", true)
      .maybeSingle(),
  ]);

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
                  {p.type === "subscription" ? "subscription" : "once-off"}
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
              {p.type === "subscription" ? (
                <span className="ml-1.5 text-[11px] font-medium text-brand-mute">
                  / {CYCLE_LABEL[p.billing_cycle ?? "monthly"] ?? "mo"}
                </span>
              ) : null}
            </div>
            {p.affiliate_type !== "none" ? (
              <div className="mt-1 text-[11px] text-brand-mute">
                Affiliate:{" "}
                {p.affiliate_type === "percent"
                  ? `${p.affiliate_value}%`
                  : formatZar(Number(p.affiliate_value))}
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
