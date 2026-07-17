import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/admin";
import { loadFormDraft } from "@/lib/drafts/store";
import { createAdminClient } from "@/lib/supabase/admin";

import { PromoEditor, type PromoEditValues } from "../../PromoEditor";
import { loadPromoProducts } from "../../_data";

export const metadata: Metadata = { title: "Edit promo code" };

export const dynamic = "force-dynamic";

// The editor keeps numbers as strings so a restored draft round-trips exactly.
function str(n: number | string | null): string {
  return n == null ? "" : String(n);
}

/** timestamptz → the yyyy-mm-dd the DatePicker speaks. */
function day(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export default async function EditPromoCodePage({
  params,
}: {
  params: { id: string };
}) {
  const admin = await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const { data: c } = await service
    .from("platform_coupons")
    .select(
      "id, code, description, discount_type, discount_value, product_id, product_type, min_spend, starts_at, ends_at, max_redemptions, per_user_limit, is_active",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!c) notFound();

  const [products, serverDraft] = await Promise.all([
    loadPromoProducts(service),
    loadFormDraft(service, admin.userId, {
      entityType: "platform_coupon",
      entityId: c.id,
      scopeId: null,
    }),
  ]);

  const initial: PromoEditValues = {
    code: c.code,
    description: c.description ?? "",
    discountType: c.discount_type === "fixed" ? "fixed" : "percent",
    discountValue: str(c.discount_value),
    target: c.product_id ? "product" : c.product_type ? "type" : "all",
    productId: c.product_id,
    productType: c.product_type,
    minSpend: str(c.min_spend),
    startsAt: day(c.starts_at),
    endsAt: day(c.ends_at),
    maxRedemptions: str(c.max_redemptions),
    perUserLimit: str(c.per_user_limit),
    isActive: c.is_active,
  };

  return (
    <PromoEditor
      mode="edit"
      id={c.id}
      initial={initial}
      products={products}
      userId={admin.userId}
      serverDraft={serverDraft}
    />
  );
}
