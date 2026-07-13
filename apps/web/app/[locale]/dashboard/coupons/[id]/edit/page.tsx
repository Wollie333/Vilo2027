import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { loadFormDraft } from "@/lib/drafts/store";
import { createServerClient } from "@/lib/supabase/server";

import { CouponEditor, type CouponEditValues } from "../../CouponEditor";
import { loadCouponFormData } from "../../_data";
import type { CouponScope } from "../../schemas";

export const metadata: Metadata = { title: "Edit coupon" };

export const dynamic = "force-dynamic";

const dateOnly = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const numStr = (n: number | null) => (n == null ? "" : String(n));

export default async function EditCouponPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/coupons/${params.id}/edit`);

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!host) redirect("/dashboard/coupons");

  const { data: c } = await supabase
    .from("coupons")
    .select(
      "id, code, description, discount_type, discount_value, scope, property_id, room_id, addon_id, min_nights, min_spend, starts_at, ends_at, max_redemptions, per_guest_limit, is_active",
    )
    .eq("id", params.id)
    .eq("host_id", host.id)
    .maybeSingle();
  if (!c) notFound();

  const { listings, addons } = await loadCouponFormData(supabase, host.id);

  const initial: CouponEditValues = {
    code: c.code,
    description: c.description ?? "",
    discountType: c.discount_type === "fixed" ? "fixed" : "percent",
    discountValue: String(Number(c.discount_value) || ""),
    scope: c.scope as CouponScope,
    listingId: c.property_id,
    roomId: c.room_id,
    addonId: c.addon_id,
    minNights: numStr(c.min_nights),
    minSpend: c.min_spend == null ? "" : String(Number(c.min_spend)),
    startsAt: dateOnly(c.starts_at),
    endsAt: dateOnly(c.ends_at),
    maxRedemptions: numStr(c.max_redemptions),
    perGuestLimit: numStr(c.per_guest_limit),
    isActive: c.is_active,
  };

  const serverDraft = await loadFormDraft(supabase, user.id, {
    entityType: "coupon",
    entityId: params.id,
    scopeId: null,
  });

  return (
    <CouponEditor
      mode="edit"
      couponId={params.id}
      initial={initial}
      listings={listings}
      addons={addons}
      userId={user.id}
      serverDraft={serverDraft}
    />
  );
}
