import type { Metadata } from "next";

import { Plus, Tag } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import { PromoCodesManager, type PromoRow } from "./PromoCodesManager";

export const metadata: Metadata = { title: "Promo codes" };

export const dynamic = "force-dynamic";

export default async function AdminPromoCodesPage() {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const [{ data: codes }, { data: products }, { data: redemptions }] =
    await Promise.all([
      service
        .from("platform_coupons")
        .select(
          "id, code, description, discount_type, discount_value, product_id, product_type, currency, min_spend, starts_at, ends_at, max_redemptions, per_user_limit, redeemed_count, is_active, created_at",
        )
        .order("created_at", { ascending: false }),
      service.from("products").select("id, name").order("sort_order"),
      // What each code has actually taken off — the number that says whether a
      // campaign is working, which redeemed_count alone can't tell you.
      service
        .from("platform_coupon_redemptions")
        .select("coupon_id, amount_discounted"),
    ]);

  const productName = new Map(
    (products ?? []).map((p) => [p.id, p.name as string]),
  );
  const discountedBy = new Map<string, number>();
  for (const r of redemptions ?? []) {
    const k = r.coupon_id as string;
    discountedBy.set(
      k,
      (discountedBy.get(k) ?? 0) + Number(r.amount_discounted),
    );
  }

  const rows: PromoRow[] = (codes ?? []).map((c) => ({
    id: c.id,
    code: c.code,
    description: c.description,
    discountType: c.discount_type,
    discountValue: Number(c.discount_value),
    productName: c.product_id ? (productName.get(c.product_id) ?? null) : null,
    productType: c.product_type,
    currency: c.currency,
    minSpend: c.min_spend == null ? null : Number(c.min_spend),
    startsAt: c.starts_at,
    endsAt: c.ends_at,
    maxRedemptions: c.max_redemptions,
    perUserLimit: c.per_user_limit,
    redeemedCount: c.redeemed_count,
    totalDiscounted: discountedBy.get(c.id) ?? 0,
    isActive: c.is_active,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            Promo codes
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-mute">
            Discounts on <strong>Wielo’s own products</strong> — memberships,
            credit packages, services and once-offs. A host types the code at
            checkout and pays less. (A host’s own booking coupons are separate
            and live in their dashboard.)
          </p>
        </div>
        <Link
          href="/admin/promo-codes/new"
          className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary"
        >
          <Plus className="h-4 w-4" /> New code
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <Tag className="h-6 w-6" />
          </div>
          <p className="mx-auto max-w-md text-sm text-brand-mute">
            No promo codes yet. Create one to run a campaign — a percentage or a
            fixed amount off any Wielo product, with expiry and redemption
            limits.
          </p>
          <Link
            href="/admin/promo-codes/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-secondary"
          >
            <Plus className="h-4 w-4" /> New code
          </Link>
        </div>
      ) : (
        <PromoCodesManager rows={rows} />
      )}
    </div>
  );
}
