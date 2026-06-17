import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import { type QuoteFormListing } from "./QuoteForm";

// Loads the host's listings enriched for the quote builder: cover photo, city,
// max guests, per-listing blocked nights (for the inline calendar), rooms (with
// bed type + cover photo) and the eligible add-on catalog. Shared by the New
// Quote and Edit Quote pages.
export async function loadQuoteFormListings(
  // The generated DB client type is heavy; the queries below are column-checked
  // at runtime and this loader is the single place they live.
  supabase: SupabaseClient,
  hostId: string,
  // When editing a quote, exclude that quote's OWN soft-hold from the blocked
  // nights so the calendar/availability guard doesn't flag its own dates.
  excludeQuoteId?: string | null,
): Promise<QuoteFormListing[]> {
  const { data: listings } = await supabase
    .from("properties")
    .select(
      "id, name, booking_mode, base_price, cleaning_fee, currency, city, max_guests, allow_children, allow_infants, allow_pets",
    )
    .eq("host_id", hostId)
    .eq("property_type", "accommodation")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const listingIds = (listings ?? []).map((l: { id: string }) => l.id);
  if (listingIds.length === 0) return [];

  const [
    { data: rooms },
    { data: addonLinks },
    { data: photos },
    { data: blocks },
  ] = await Promise.all([
    supabase
      .from("property_rooms")
      .select(
        "id, property_id, name, base_price, cleaning_fee, max_guests, base_occupancy, bed_type, allow_children, allow_infants, allow_pets, featured_photo:property_photos!listing_rooms_featured_photo_id_fkey ( url )",
      )
      .in("property_id", listingIds)
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("property_addons")
      .select(
        "property_id, unit_price_override, addons!inner ( id, name, pricing_model, unit_price, currency, min_quantity, max_quantity, is_active )",
      )
      .in("property_id", listingIds),
    supabase
      .from("property_photos")
      .select("property_id, url, sort_order, room_id")
      .in("property_id", listingIds)
      .is("room_id", null)
      .order("sort_order", { ascending: true }),
    // Whole-listing blocked nights only (room_id null) so a guesthouse with one
    // room booked isn't shown as fully unavailable.
    supabase
      .from("blocked_dates")
      .select("property_id, date, quote_id")
      .in("property_id", listingIds)
      .is("room_id", null),
  ]);

  const coverByListing = new Map<string, string>();
  for (const p of (photos ?? []) as { property_id: string; url: string }[]) {
    if (!coverByListing.has(p.property_id))
      coverByListing.set(p.property_id, p.url);
  }

  const blockedByListing = new Map<string, string[]>();
  for (const b of (blocks ?? []) as {
    property_id: string;
    date: string;
    quote_id: string | null;
  }[]) {
    // Skip the edited quote's own soft-hold — those nights are "free" to it.
    if (excludeQuoteId && b.quote_id === excludeQuoteId) continue;
    const list = blockedByListing.get(b.property_id) ?? [];
    list.push(b.date);
    blockedByListing.set(b.property_id, list);
  }

  type AddonJoin = {
    property_id: string;
    unit_price_override: number | null;
    addons: {
      id: string;
      name: string;
      pricing_model: string;
      unit_price: number;
      currency: string;
      min_quantity: number;
      max_quantity: number | null;
      is_active: boolean;
    } | null;
  };
  const addonsByListing = new Map<string, QuoteFormListing["addons"]>();
  for (const raw of (addonLinks ?? []) as unknown as AddonJoin[]) {
    const a = Array.isArray(raw.addons) ? raw.addons[0] : raw.addons;
    if (!a || !a.is_active) continue;
    const price =
      raw.unit_price_override == null
        ? Number(a.unit_price)
        : Number(raw.unit_price_override);
    const list = addonsByListing.get(raw.property_id) ?? [];
    const existing = list.find((x) => x.id === a.id);
    if (existing) {
      if (price < existing.unit_price) existing.unit_price = price;
    } else {
      list.push({
        id: a.id,
        name: a.name,
        pricing_model: a.pricing_model,
        unit_price: price,
        currency: a.currency,
        min_quantity: a.min_quantity ?? 1,
        max_quantity: a.max_quantity,
      });
    }
    addonsByListing.set(raw.property_id, list);
  }

  type RoomRow = {
    id: string;
    property_id: string;
    name: string;
    base_price: number | null;
    cleaning_fee: number | null;
    max_guests: number | null;
    base_occupancy: number | null;
    bed_type: string | null;
    allow_children: boolean | null;
    allow_infants: boolean | null;
    allow_pets: boolean | null;
    featured_photo: { url: string } | { url: string }[] | null;
  };
  const roomsByListing = new Map<string, QuoteFormListing["rooms"]>();
  for (const r of (rooms ?? []) as unknown as RoomRow[]) {
    const photo = Array.isArray(r.featured_photo)
      ? r.featured_photo[0]
      : r.featured_photo;
    const list = roomsByListing.get(r.property_id) ?? [];
    list.push({
      id: r.id,
      name: r.name,
      base_price: r.base_price == null ? null : Number(r.base_price),
      cleaning_fee: r.cleaning_fee == null ? null : Number(r.cleaning_fee),
      max_guests: r.max_guests,
      base_occupancy: r.base_occupancy,
      bed_type: r.bed_type,
      coverUrl: photo?.url ?? null,
      allowChildren: r.allow_children ?? true,
      allowInfants: r.allow_infants ?? true,
      allowPets: r.allow_pets ?? true,
    });
    roomsByListing.set(r.property_id, list);
  }

  type ListingRow = {
    id: string;
    name: string;
    booking_mode: string;
    base_price: number | null;
    cleaning_fee: number | null;
    currency: string | null;
    city: string | null;
    max_guests: number | null;
    allow_children: boolean | null;
    allow_infants: boolean | null;
    allow_pets: boolean | null;
  };
  return ((listings ?? []) as ListingRow[]).map((l) => ({
    id: l.id,
    name: l.name,
    booking_mode: l.booking_mode as QuoteFormListing["booking_mode"],
    base_price: l.base_price == null ? null : Number(l.base_price),
    cleaning_fee: l.cleaning_fee == null ? null : Number(l.cleaning_fee),
    currency: l.currency ?? "ZAR",
    city: l.city,
    max_guests: l.max_guests,
    allowChildren: l.allow_children ?? true,
    allowInfants: l.allow_infants ?? true,
    allowPets: l.allow_pets ?? true,
    coverUrl: coverByListing.get(l.id) ?? null,
    blocked: blockedByListing.get(l.id) ?? [],
    rooms: roomsByListing.get(l.id) ?? [],
    addons: addonsByListing.get(l.id) ?? [],
  }));
}
