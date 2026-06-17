import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import {
  AddonEditor,
  type AddonAvailability,
  type AddonEditModel,
} from "../AddonEditor";
import { type AddonCategory, type PricingModel } from "../schemas";

export const metadata: Metadata = {
  title: "Edit add-on",
};

export const dynamic = "force-dynamic";

export default async function AddonEditorPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/addons/${params.id}`);

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!host) redirect("/dashboard/addons");

  const { data: featureRaw } = await supabase.rpc("check_feature_permission", {
    p_host_id: host.id,
    p_feature_key: "addons",
  });
  const enabled =
    (featureRaw as { is_enabled: boolean } | null)?.is_enabled ?? false;
  if (!enabled) redirect("/dashboard/addons");

  const { data: r } = await supabase
    .from("addons")
    .select(
      "id, name, description, image_path, pricing_model, unit_price, currency, min_quantity, max_quantity, allow_custom_quantity, stock_quantity, is_required, is_active, lead_time_days, category, vat_included, daily_capacity",
    )
    .eq("id", params.id)
    .eq("host_id", host.id)
    .maybeSingle();
  if (!r) notFound();

  const model: AddonEditModel = {
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    imageUrl: r.image_path
      ? supabase.storage.from("addon-images").getPublicUrl(r.image_path).data
          .publicUrl
      : null,
    pricingModel: r.pricing_model as PricingModel,
    unitPrice: Number(r.unit_price),
    currency: r.currency,
    minQuantity: r.min_quantity,
    maxQuantity: r.max_quantity,
    allowCustomQuantity: r.allow_custom_quantity,
    stockQuantity: r.stock_quantity,
    isRequired: r.is_required,
    isActive: r.is_active,
    leadTimeDays: r.lead_time_days,
    category: (r.category as AddonCategory | null) ?? null,
    vatIncluded: r.vat_included,
    dailyCapacity: r.daily_capacity,
  };

  // ----- Availability: published listings, their active rooms, and the
  // current assignment rows for this add-on. -----
  const { data: listingRows } = await supabase
    .from("properties")
    .select("id, name")
    .eq("host_id", host.id)
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("created_at");

  const listingIds = (listingRows ?? []).map((l) => l.id);

  const { data: roomRows } = listingIds.length
    ? await supabase
        .from("property_rooms")
        .select("id, name, property_id")
        .in("property_id", listingIds)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("sort_order")
    : { data: [] as { id: string; name: string; property_id: string }[] };

  const { data: assignmentRows } = await supabase
    .from("property_addons")
    .select("property_id, room_id")
    .eq("addon_id", params.id);

  const availability: AddonAvailability = {
    listings: (listingRows ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      rooms: (roomRows ?? [])
        .filter((room) => room.property_id === l.id)
        .map((room) => ({ id: room.id, name: room.name })),
    })),
    assignments: (assignmentRows ?? []).map((a) => ({
      listingId: a.property_id,
      roomId: a.room_id,
    })),
  };

  return <AddonEditor addon={model} availability={availability} />;
}
