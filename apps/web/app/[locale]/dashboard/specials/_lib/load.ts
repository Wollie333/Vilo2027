import "server-only";

import { effectiveVatRate } from "@/lib/pricing/vat";
import type { SeasonalRule } from "@/lib/pricing";
import { createServerClient } from "@/lib/supabase/server";

import type { PricingModel } from "@/app/[locale]/dashboard/addons/schemas";
import type { SpecialInput } from "../schemas";

// Shared option lists the editor needs (properties + rooms, add-ons, cancellation
// policies, and the per-business website id so the hero picker can upload into
// that site's asset folder). Owner-scoped — every read filters by host_id.
//
// Pricing fields (property + room rates, VAT, seasonal rules) are also loaded so
// the editor can compute the LIVE deal economics (guest price + savings) entirely
// client-side, mirroring the server-side savings badge (`_lib/savings.ts`). The
// server still re-computes authoritatively at save; the editor figure is advisory.

/** A room's priceable rates, so the editor can price a room-scoped deal live. */
export type EditorRoom = {
  id: string;
  name: string;
  maxGuests: number | null;
  basePrice: number | null;
  weekendPrice: number | null;
  cleaningFee: number;
  pricingMode: string;
  pricePerPerson: number | null;
  baseOccupancy: number | null;
  extraGuestPrice: number | null;
};
export type EditorProperty = {
  id: string;
  name: string;
  businessId: string;
  currency: string;
  propertyType: string;
  city: string | null;
  province: string | null;
  maxGuests: number | null;
  /** Effective VAT rate (0 unless VAT-registered) — grosses the live economics. */
  vatRate: number;
  /** Whole-property rates (used when the deal targets the whole listing). */
  basePrice: number | null;
  weekendPrice: number | null;
  cleaningFee: number;
  /** Active seasonal rules — priced into the "normal rate" savings shadow only. */
  seasonalRules: SeasonalRule[];
  rooms: EditorRoom[];
};
export type EditorAddon = {
  id: string;
  name: string;
  unitPrice: number;
  currency: string;
  pricingModel: PricingModel;
  minQuantity: number;
};
export type EditorPolicy = { id: string; name: string };
export type EditorCategory = {
  key: string;
  label: string;
  icon: string | null;
};

export type SpecialEditorData = {
  properties: EditorProperty[];
  addons: EditorAddon[];
  policies: EditorPolicy[];
  categories: EditorCategory[];
  /** business_id → host_websites.id (hero image uploads into that site's folder). */
  websiteByBusiness: Record<string, string>;
};

export async function loadSpecialEditorData(
  hostId: string,
): Promise<SpecialEditorData> {
  const supabase = createServerClient();
  const [
    { data: props },
    { data: addons },
    { data: policies },
    { data: sites },
    { data: categories },
  ] = await Promise.all([
    supabase
      .from("properties")
      .select(
        "id, name, business_id, currency, property_type, city, province, max_guests, vat_number, vat_rate, base_price, weekend_price, cleaning_fee, rooms:property_rooms ( id, name, is_active, deleted_at, sort_order, max_guests, base_price, weekend_price, cleaning_fee, pricing_mode, price_per_person, base_occupancy, extra_guest_price )",
      )
      .eq("host_id", hostId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("addons")
      .select(
        "id, name, unit_price, currency, is_active, pricing_model, min_quantity",
      )
      .eq("host_id", hostId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("policies")
      .select("id, name")
      .eq("host_id", hostId)
      .eq("type", "cancellation")
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("host_websites")
      .select("id, business_id")
      .eq("host_id", hostId),
    // Load active deal categories (admin-managed)
    supabase
      .from("special_categories")
      .select("key, label, icon")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
  ]);

  // Active seasonal rules for every one of the host's properties — priced only
  // into the "normal rate" savings shadow, never the deal's own price. One extra
  // read keyed by the property ids we just loaded.
  const propertyIds = (props ?? []).map((p) => p.id);
  const rulesByProperty = new Map<string, SeasonalRule[]>();
  if (propertyIds.length > 0) {
    const { data: seasonalRows } = await supabase
      .from("property_seasonal_pricing")
      .select(
        "property_id, room_id, start_date, end_date, adjustment_type, adjustment_value, label, priority, min_nights, is_active, created_at",
      )
      .in("property_id", propertyIds)
      .eq("is_active", true);
    for (const s of seasonalRows ?? []) {
      const arr = rulesByProperty.get(s.property_id) ?? [];
      arr.push({
        roomId: s.room_id,
        startDate: s.start_date,
        endDate: s.end_date,
        adjustmentType:
          s.adjustment_type === "percent" ? "percent" : "absolute",
        adjustmentValue: Number(s.adjustment_value),
        label: s.label,
        priority: s.priority ?? 0,
        minNights: s.min_nights ?? null,
        isActive: s.is_active,
        createdAt: s.created_at,
      });
      rulesByProperty.set(s.property_id, arr);
    }
  }

  type RoomRow = {
    id: string;
    name: string;
    is_active: boolean;
    deleted_at: string | null;
    sort_order: number;
    max_guests: number | null;
    base_price: number | string | null;
    weekend_price: number | string | null;
    cleaning_fee: number | string | null;
    pricing_mode: string | null;
    price_per_person: number | string | null;
    base_occupancy: number | null;
    extra_guest_price: number | string | null;
  };
  const numOrNull = (v: number | string | null | undefined): number | null =>
    v == null || v === "" ? null : Number(v);

  const properties: EditorProperty[] = (props ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    businessId: p.business_id,
    currency: p.currency,
    propertyType: p.property_type,
    city: p.city,
    province: p.province,
    maxGuests: p.max_guests,
    vatRate: effectiveVatRate(p),
    basePrice: numOrNull(p.base_price),
    weekendPrice: numOrNull(p.weekend_price),
    cleaningFee: Number(p.cleaning_fee ?? 0),
    seasonalRules: rulesByProperty.get(p.id) ?? [],
    rooms: (((p.rooms as RoomRow[] | null) ?? []) as RoomRow[])
      .filter((r) => r.deleted_at === null && r.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((r) => ({
        id: r.id,
        name: r.name,
        maxGuests: r.max_guests,
        basePrice: numOrNull(r.base_price),
        weekendPrice: numOrNull(r.weekend_price),
        cleaningFee: Number(r.cleaning_fee ?? 0),
        pricingMode: r.pricing_mode ?? "per_room",
        pricePerPerson: numOrNull(r.price_per_person),
        baseOccupancy: r.base_occupancy ?? null,
        extraGuestPrice: numOrNull(r.extra_guest_price),
      })),
  }));

  const editorAddons: EditorAddon[] = (addons ?? [])
    .filter((a) => a.is_active)
    .map((a) => ({
      id: a.id,
      name: a.name,
      unitPrice: Number(a.unit_price),
      currency: a.currency,
      pricingModel: (a.pricing_model ?? "per_stay") as PricingModel,
      minQuantity: a.min_quantity ?? 1,
    }));

  const websiteByBusiness: Record<string, string> = {};
  for (const s of sites ?? []) websiteByBusiness[s.business_id] = s.id;

  const editorCategories: EditorCategory[] = (categories ?? []).map((c) => ({
    key: c.key,
    label: c.label,
    icon: c.icon,
  }));

  return {
    properties,
    addons: editorAddons,
    policies: (policies ?? []).map((p) => ({ id: p.id, name: p.name })),
    categories: editorCategories,
    websiteByBusiness,
  };
}

// The editor's initial values for an existing special (edit route). Shaped to
// the wizard form's state, not the raw row.
export type SpecialFormValues = SpecialInput;

export async function loadSpecial(
  specialId: string,
  hostId: string,
): Promise<{ values: SpecialFormValues; title: string } | null> {
  const supabase = createServerClient();
  const { data: row } = await supabase
    .from("specials")
    .select("*")
    .eq("id", specialId)
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!row) return null;

  const { data: addonRows } = await supabase
    .from("special_addons")
    .select("addon_id, is_required, unit_price_override, quantity, sort_order")
    .eq("special_id", specialId)
    .order("sort_order", { ascending: true });

  const values: SpecialFormValues = {
    property_id: row.property_id,
    room_id: row.room_id,
    title: row.title,
    description: row.description,
    hero_image_path: row.hero_image_path,
    badge: row.badge,
    date_mode: row.date_mode as SpecialInput["date_mode"],
    fixed_check_in: row.fixed_check_in,
    fixed_check_out: row.fixed_check_out,
    window_start: row.window_start,
    window_end: row.window_end,
    min_nights: row.min_nights,
    max_nights: row.max_nights,
    is_evergreen: row.is_evergreen ?? false,
    price_mode: row.price_mode as SpecialInput["price_mode"],
    flat_total: row.flat_total == null ? null : Number(row.flat_total),
    per_night_price:
      row.per_night_price == null ? null : Number(row.per_night_price),
    max_guests: row.max_guests,
    quantity: row.quantity,
    go_live_at: row.go_live_at,
    book_by: row.book_by,
    categories: row.categories ?? [],
    custom_tags: row.custom_tags ?? [],
    is_featured: row.is_featured,
    cancellation_policy_id: row.cancellation_policy_id,
    show_in_directory: row.show_in_directory,
    show_on_website: row.show_on_website,
    // expired/paused/archived collapse to draft in the editor; the host re-activates
    // by saving as active. Lifecycle row-actions handle pause/archive directly.
    status: row.status === "active" ? "active" : "draft",
    addons: (addonRows ?? []).map((a) => ({
      addon_id: a.addon_id,
      is_required: a.is_required,
      unit_price_override:
        a.unit_price_override == null ? null : Number(a.unit_price_override),
      quantity: a.quantity ?? 1,
    })),
  };

  return { values, title: row.title };
}
