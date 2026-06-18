import "server-only";

import { createServerClient } from "@/lib/supabase/server";

import type { SpecialInput } from "../schemas";

// Shared option lists the editor needs (properties + rooms, add-ons, cancellation
// policies, and the per-business website id so the hero picker can upload into
// that site's asset folder). Owner-scoped — every read filters by host_id.

export type EditorRoom = { id: string; name: string };
export type EditorProperty = {
  id: string;
  name: string;
  businessId: string;
  currency: string;
  propertyType: string;
  city: string | null;
  province: string | null;
  maxGuests: number | null;
  rooms: EditorRoom[];
};
export type EditorAddon = {
  id: string;
  name: string;
  unitPrice: number;
  currency: string;
};
export type EditorPolicy = { id: string; name: string };

export type SpecialEditorData = {
  properties: EditorProperty[];
  addons: EditorAddon[];
  policies: EditorPolicy[];
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
  ] = await Promise.all([
    supabase
      .from("properties")
      .select(
        "id, name, business_id, currency, property_type, city, province, max_guests, rooms:property_rooms ( id, name, is_active, deleted_at, sort_order )",
      )
      .eq("host_id", hostId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("addons")
      .select("id, name, unit_price, currency, is_active")
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
  ]);

  const properties: EditorProperty[] = (props ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    businessId: p.business_id,
    currency: p.currency,
    propertyType: p.property_type,
    city: p.city,
    province: p.province,
    maxGuests: p.max_guests,
    rooms: (
      (p.rooms as Array<{
        id: string;
        name: string;
        is_active: boolean;
        deleted_at: string | null;
        sort_order: number;
      }> | null) ?? []
    )
      .filter((r) => r.deleted_at === null && r.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((r) => ({ id: r.id, name: r.name })),
  }));

  const editorAddons: EditorAddon[] = (addons ?? [])
    .filter((a) => a.is_active)
    .map((a) => ({
      id: a.id,
      name: a.name,
      unitPrice: Number(a.unit_price),
      currency: a.currency,
    }));

  const websiteByBusiness: Record<string, string> = {};
  for (const s of sites ?? []) websiteByBusiness[s.business_id] = s.id;

  return {
    properties,
    addons: editorAddons,
    policies: (policies ?? []).map((p) => ({ id: p.id, name: p.name })),
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
    .select("addon_id, is_required, unit_price_override, sort_order")
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
    })),
  };

  return { values, title: row.title };
}
