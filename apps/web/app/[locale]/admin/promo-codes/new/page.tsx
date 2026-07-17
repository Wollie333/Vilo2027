import type { Metadata } from "next";

import { requirePermission } from "@/lib/admin";
import { loadFormDraft } from "@/lib/drafts/store";
import { createAdminClient } from "@/lib/supabase/admin";

import { PromoEditor, type PromoEditValues } from "../PromoEditor";
import { loadPromoProducts } from "../_data";

export const metadata: Metadata = { title: "New promo code" };

export const dynamic = "force-dynamic";

const BLANK: PromoEditValues = {
  code: "",
  description: "",
  discountType: "percent",
  discountValue: "10",
  target: "all",
  productId: null,
  productType: null,
  minSpend: "",
  startsAt: "",
  endsAt: "",
  maxRedemptions: "",
  perUserLimit: "",
  isActive: true,
};

export default async function NewPromoCodePage() {
  const admin = await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const [products, serverDraft] = await Promise.all([
    loadPromoProducts(service),
    loadFormDraft(service, admin.userId, {
      entityType: "platform_coupon",
      entityId: null,
      scopeId: null,
    }),
  ]);

  return (
    <PromoEditor
      mode="create"
      initial={BLANK}
      products={products}
      userId={admin.userId}
      serverDraft={serverDraft}
    />
  );
}
