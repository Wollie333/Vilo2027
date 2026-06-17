import "server-only";

import { getMyHostId } from "@/lib/host/current";
import { createServerClient } from "@/lib/supabase/server";

export type RoomEditorRow = {
  roomId: string;
  /** Live values from the property room (what the override falls back to). */
  baseName: string;
  basePrice: number | null;
  baseCurrency: string;
  baseDesc: string | null;
  isActive: boolean;
  /** Override row state (defaults applied when no website_rooms row exists yet). */
  inSite: boolean;
  isVisible: boolean;
  displayName: string;
  displayPrice: string; // "" = inherit the base price
  displayCurrency: string; // "" = inherit the base currency
  displayDesc: string;
  sortOrder: number;
};

export type RoomsEditorProperty = {
  id: string;
  name: string;
  rooms: RoomEditorRow[];
};

export type RoomsEditorData = {
  websiteId: string;
  subdomain: string;
  properties: RoomsEditorProperty[];
};

/**
 * Owner-scoped load of the website's rooms for the Rooms tab (W9). Lists every
 * non-deleted room across the business's properties, joined to its
 * `website_rooms` override (visibility + cosmetic display overrides). Rooms with
 * no override row yet are surfaced as hidden so the host can opt them in (or hit
 * "Sync" to pull all rooms in at once). Returns null when the website isn't owned
 * by the signed-in host.
 */
export async function loadRoomsEditor(
  websiteId: string,
): Promise<RoomsEditorData | null> {
  const supabase = createServerClient();
  const hostId = await getMyHostId(supabase);
  if (!hostId) return null;

  const { data: site } = await supabase
    .from("host_websites")
    .select("id, subdomain, business_id")
    .eq("id", websiteId)
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!site) return null;

  const { data: propertyRows } = await supabase
    .from("properties")
    .select("id, name")
    .eq("business_id", site.business_id)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  const properties = propertyRows ?? [];
  const propertyIds = properties.map((p) => p.id);

  if (propertyIds.length === 0) {
    return { websiteId, subdomain: site.subdomain, properties: [] };
  }

  const [{ data: roomRows }, { data: overrideRows }] = await Promise.all([
    supabase
      .from("property_rooms")
      .select(
        "id, property_id, name, base_price, currency, description, is_active, sort_order",
      )
      .in("property_id", propertyIds)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("website_rooms")
      .select(
        "room_id, is_visible, display_name, display_price, display_currency, display_desc, sort_order",
      )
      .eq("website_id", site.id),
  ]);

  const overrideByRoom = new Map(
    (overrideRows ?? []).map((o) => [o.room_id, o]),
  );

  const roomsByProperty = new Map<string, RoomEditorRow[]>();
  for (const room of roomRows ?? []) {
    const ov = overrideByRoom.get(room.id);
    const row: RoomEditorRow = {
      roomId: room.id,
      baseName: room.name,
      basePrice: room.base_price == null ? null : Number(room.base_price),
      baseCurrency: room.currency || "ZAR",
      baseDesc: room.description,
      isActive: room.is_active,
      inSite: !!ov,
      isVisible: ov ? ov.is_visible : false,
      displayName: ov?.display_name ?? "",
      displayPrice:
        ov?.display_price == null ? "" : String(Number(ov.display_price)),
      displayCurrency: ov?.display_currency ?? "",
      displayDesc: ov?.display_desc ?? "",
      sortOrder: ov?.sort_order ?? room.sort_order ?? 0,
    };
    const list = roomsByProperty.get(room.property_id) ?? [];
    list.push(row);
    roomsByProperty.set(room.property_id, list);
  }

  const grouped: RoomsEditorProperty[] = properties
    .map((p) => ({
      id: p.id,
      name: p.name,
      rooms: (roomsByProperty.get(p.id) ?? []).sort(
        (a, b) => a.sortOrder - b.sortOrder,
      ),
    }))
    .filter((p) => p.rooms.length > 0);

  return { websiteId, subdomain: site.subdomain, properties: grouped };
}
