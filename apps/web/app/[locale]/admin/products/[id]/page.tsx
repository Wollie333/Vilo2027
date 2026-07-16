import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import { CANONICAL_PRODUCT_FEATURES } from "@/lib/products/features";

import { ProductEditor, type EditorProduct } from "../ProductEditor";

export const dynamic = "force-dynamic";

export default async function AdminProductEditorPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermission("subscriptions.edit");
  const isNew = params.id === "new";
  const service = createAdminClient();

  // Feature catalog = the canonical, real-usage feature list (with scope), in a
  // deliberate order. Any legacy plan_features description is used as a hint.
  const { data: featRows } = await service
    .from("plan_features")
    .select("feature_key, description");
  const descByKey = new Map<string, string>();
  for (const r of featRows ?? []) {
    if (!descByKey.has(r.feature_key)) {
      descByKey.set(r.feature_key, r.description ?? "");
    }
  }
  const featureCatalog = CANONICAL_PRODUCT_FEATURES.map((f) => ({
    key: f.key,
    label: f.label,
    scope: f.scope,
    description: descByKey.get(f.key) ?? "",
  }));

  let product: EditorProduct;
  const productFeatures: Record<
    string,
    { isEnabled: boolean; limitValue: number | null }
  > = {};

  if (isNew) {
    product = {
      id: null,
      name: "",
      description: "",
      productType: "membership",
      creditQuantity: null,
      creditPurpose: "quote",
      price: 0,
      currency: "ZAR",
      billingCycle: "monthly",
      isActive: true,
      isRecommended: false,
      sortOrder: 0,
      affiliateType: "none",
      affiliateValue: 0,
      affiliateDuration: "once",
      affiliateDurationMonths: null,
      setupFee: 0,
      setupFeeLabel: "",
      setupFeeAffiliateType: "none",
      setupFeeAffiliateValue: 0,
      bullets: [],
      // EFT is on by default (the fallback rail); admin can deactivate it per
      // product. Card (Paystack) is on too; PayPal is opt-in (needs setup).
      paymentMethods: ["paystack", "eft"],
      trialDays: 0,
      isVisible: true,
      slug: null,
      maxQuantity: null,
    };
  } else {
    const { data } = await service
      .from("products")
      .select(
        "id, name, description, product_type, credit_quantity, credit_purpose, price, currency, billing_cycle, is_active, is_recommended, sort_order, affiliate_type, affiliate_value, affiliate_duration, affiliate_duration_months, setup_fee, setup_fee_label, setup_fee_affiliate_type, setup_fee_affiliate_value, bullets, payment_methods, trial_days, is_visible, slug, max_quantity",
      )
      .eq("id", params.id)
      .maybeSingle();
    if (!data) notFound();
    product = {
      id: data.id,
      name: data.name,
      description: data.description ?? "",
      productType:
        (data.product_type as EditorProduct["productType"]) ?? "membership",
      creditQuantity: data.credit_quantity ?? null,
      creditPurpose: (data.credit_purpose as string | null) ?? "quote",
      price: Number(data.price ?? 0),
      currency: data.currency ?? "ZAR",
      billingCycle:
        (data.billing_cycle as EditorProduct["billingCycle"]) ?? "monthly",
      isActive: data.is_active ?? true,
      isRecommended: data.is_recommended ?? false,
      sortOrder: data.sort_order ?? 0,
      affiliateType:
        (data.affiliate_type as EditorProduct["affiliateType"]) ?? "none",
      affiliateValue: Number(data.affiliate_value ?? 0),
      affiliateDuration:
        (data.affiliate_duration as EditorProduct["affiliateDuration"]) ??
        "once",
      affiliateDurationMonths: data.affiliate_duration_months ?? null,
      setupFee: Number(data.setup_fee ?? 0),
      setupFeeLabel: data.setup_fee_label ?? "",
      setupFeeAffiliateType:
        (data.setup_fee_affiliate_type as EditorProduct["setupFeeAffiliateType"]) ??
        "none",
      setupFeeAffiliateValue: Number(data.setup_fee_affiliate_value ?? 0),
      bullets: Array.isArray(data.bullets)
        ? (data.bullets as unknown[]).filter(
            (b): b is string => typeof b === "string",
          )
        : [],
      paymentMethods: (Array.isArray(data.payment_methods)
        ? data.payment_methods
        : ["paystack"]
      ).filter(
        (m): m is "paystack" | "paypal" | "eft" =>
          m === "paystack" || m === "paypal" || m === "eft",
      ),
      trialDays: data.trial_days ?? 0,
      isVisible: data.is_visible ?? true,
      slug: data.slug ?? null,
      maxQuantity: data.max_quantity != null ? Number(data.max_quantity) : null,
    };

    const { data: pf } = await service
      .from("product_features")
      .select("feature_key, is_enabled, limit_value")
      .eq("product_id", params.id);
    for (const row of pf ?? []) {
      productFeatures[row.feature_key] = {
        isEnabled: row.is_enabled,
        limitValue: row.limit_value,
      };
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-mute hover:text-brand-primary"
      >
        <ArrowLeft className="h-4 w-4" /> All products
      </Link>
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          {isNew ? "New product" : `Edit ${product.name}`}
        </h1>
      </header>
      <ProductEditor
        product={product}
        isNew={isNew}
        featureCatalog={featureCatalog}
        productFeatures={productFeatures}
      />
    </div>
  );
}
