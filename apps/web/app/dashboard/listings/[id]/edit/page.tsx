import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";
import { getAmenityCatalog } from "@/lib/taxonomy/getAmenities";
import { getCategoriesForKind } from "@/lib/taxonomy/getCategories";

import {
  Editor,
  type EditorAmenity,
  type EditorListing,
  type EditorPhoto,
  type EditorRoom,
} from "./Editor";
import { type PricingModel } from "../../../addons/schemas";
import { type PolicyType } from "../../../policies/schemas";
import type { AssignedAddon, AvailableAddon } from "./tabs/AddonsTab";
import type { AssignedPolicy, AvailablePolicy } from "./tabs/PoliciesTab";

export const metadata: Metadata = {
  title: "Edit listing",
};

export default async function EditListingPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { tab?: string; add?: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/dashboard/listings/${params.id}/edit`);
  }

  // RLS (host_manage_own_listings) makes this implicitly own-only.
  const { data: listing } = await supabase
    .from("listings")
    .select(
      [
        "id",
        "host_id",
        "listing_type",
        "accommodation_type",
        "category_id",
        "name",
        "slug",
        "description",
        "address_line1",
        "address_line2",
        "city",
        "province",
        "postal_code",
        "latitude",
        "longitude",
        "bedrooms",
        "bathrooms",
        "max_guests",
        "min_nights",
        "max_nights",
        "check_in_time",
        "check_out_time",
        "base_price",
        "weekend_price",
        "cleaning_fee",
        "whole_listing_discount_pct",
        "weekly_discount_pct",
        "monthly_discount_pct",
        "currency",
        "cancellation_policy",
        "house_rules",
        "instant_booking",
        "is_published",
        "booking_mode",
      ].join(", "),
    )
    .eq("id", params.id)
    .maybeSingle<EditorListing>();

  if (!listing) {
    notFound();
  }

  const [
    { data: amenityRows },
    { data: photoRows },
    { data: roomRows },
    { data: addonRows },
    { data: listingAddonRows },
    { data: policyRows },
    { data: listingPolicyRows },
    { data: accessRow },
    { data: localPickRows },
  ] = await Promise.all([
    supabase
      .from("listing_amenities")
      .select("id, amenity_key, amenity_label, room_id")
      .eq("listing_id", params.id),
    supabase
      .from("listing_photos")
      .select("id, url, sort_order, room_id")
      .eq("listing_id", params.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("listing_rooms")
      .select(
        "id, name, description, bedrooms, bathrooms, max_guests, min_guests, min_nights, base_price, weekend_price, cleaning_fee, sort_order, is_active, room_size_sqm, bed_type, view_type, experiences, has_ensuite_bathroom, smoking_allowed, pets_allowed, wheelchair_accessible, private_entrance, floor_number, inventory_count, pricing_mode, price_per_person, base_occupancy, extra_guest_price, featured_photo_id, beds:room_beds ( bed_kind, quantity, sleeps, sort_order )",
      )
      .eq("listing_id", params.id)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("addons")
      .select(
        "id, name, pricing_model, unit_price, currency, is_active, sort_order",
      )
      .eq("host_id", listing.host_id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("listing_addons")
      .select("addon_id, room_id, unit_price_override")
      .eq("listing_id", params.id),
    supabase
      .from("policies")
      .select("id, name, type")
      .eq("host_id", listing.host_id)
      .eq("status", "active")
      .is("deleted_at", null)
      .in("type", ["cancellation", "check_in_out", "house_rules"])
      .order("type", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("listing_policies")
      .select("policy_id, policy_type, room_id")
      .eq("listing_id", params.id),
    supabase
      .from("listing_access")
      .select(
        "check_in_method, check_in_instructions, gate_code, door_code, wifi_network, wifi_password",
      )
      .eq("listing_id", params.id)
      .maybeSingle(),
    supabase
      .from("listing_local_picks")
      .select("category, title, blurb, distance_label, sort_order")
      .eq("listing_id", params.id)
      .order("sort_order", { ascending: true }),
  ]);

  const amenities: EditorAmenity[] = (amenityRows ?? []).map((r) => ({
    id: r.id,
    key: r.amenity_key,
    label: r.amenity_label ?? null,
    roomId: r.room_id ?? null,
  }));
  const photos: EditorPhoto[] = (photoRows ?? []).map((r) => ({
    id: r.id,
    url: r.url,
    roomId: r.room_id ?? null,
  }));
  const rooms: EditorRoom[] = (roomRows ?? []).map((r) => {
    const rawBeds =
      (r.beds as Array<{
        bed_kind: string;
        quantity: number;
        sleeps: number;
        sort_order: number;
      }> | null) ?? [];
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      bedrooms: r.bedrooms,
      bathrooms: r.bathrooms,
      max_guests: r.max_guests,
      min_guests: r.min_guests ?? 1,
      min_nights: r.min_nights ?? 1,
      base_price: Number(r.base_price),
      weekend_price: r.weekend_price == null ? null : Number(r.weekend_price),
      cleaning_fee: Number(r.cleaning_fee ?? 0),
      sort_order: r.sort_order,
      is_active: r.is_active,
      room_size_sqm: r.room_size_sqm == null ? null : Number(r.room_size_sqm),
      bed_type: r.bed_type ?? null,
      view_type: r.view_type ?? null,
      experiences: (r.experiences as string[] | null) ?? [],
      has_ensuite_bathroom: r.has_ensuite_bathroom ?? false,
      smoking_allowed: r.smoking_allowed ?? false,
      pets_allowed: r.pets_allowed ?? false,
      wheelchair_accessible: r.wheelchair_accessible ?? false,
      private_entrance: r.private_entrance ?? false,
      floor_number: r.floor_number ?? null,
      inventory_count: r.inventory_count ?? 1,
      pricing_mode: (r.pricing_mode ??
        "per_room") as EditorRoom["pricing_mode"],
      price_per_person:
        r.price_per_person == null ? null : Number(r.price_per_person),
      base_occupancy: r.base_occupancy ?? null,
      extra_guest_price:
        r.extra_guest_price == null ? null : Number(r.extra_guest_price),
      featured_photo_id: r.featured_photo_id ?? null,
      beds: rawBeds
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((b) => ({
          bed_kind: b.bed_kind,
          quantity: b.quantity,
          sleeps: b.sleeps,
        })),
    };
  });

  const availableAddons: AvailableAddon[] = (addonRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    pricingModel: r.pricing_model as PricingModel,
    unitPrice: Number(r.unit_price),
    currency: r.currency,
    isActive: r.is_active,
  }));
  const assignedAddons: AssignedAddon[] = (listingAddonRows ?? []).map((r) => ({
    addonId: r.addon_id,
    roomId: r.room_id ?? null,
    unitPriceOverride:
      r.unit_price_override == null ? null : Number(r.unit_price_override),
  }));

  const availablePolicies: AvailablePolicy[] = (policyRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type as PolicyType,
  }));
  const assignedPolicies: AssignedPolicy[] = (listingPolicyRows ?? []).map(
    (r) => ({
      policyId: r.policy_id,
      policyType: r.policy_type as PolicyType,
      roomId: r.room_id ?? null,
    }),
  );

  const access = accessRow
    ? {
        check_in_method: accessRow.check_in_method ?? null,
        check_in_instructions: accessRow.check_in_instructions ?? null,
        gate_code: accessRow.gate_code ?? null,
        door_code: accessRow.door_code ?? null,
        wifi_network: accessRow.wifi_network ?? null,
        wifi_password: accessRow.wifi_password ?? null,
      }
    : null;
  const localPicks = (localPickRows ?? []).map((r) => ({
    category: r.category as "eat" | "drink" | "do" | "see" | "shop" | "other",
    title: r.title,
    blurb: r.blurb ?? "",
    distance_label: r.distance_label ?? "",
  }));

  const [categoryLeavesAll, amenityGroups] = await Promise.all([
    getCategoriesForKind(listing.listing_type),
    getAmenityCatalog(),
  ]);
  // Picker only renders leaves (skip the Accommodation root).
  const categoryLeaves = categoryLeavesAll
    .filter((c) => c.parent_id !== null)
    .map((c) => ({
      id: c.id,
      label: c.label,
      description: c.description,
      slug: c.slug,
      kind: c.kind,
    }));

  return (
    <Editor
      listing={listing}
      amenities={amenities}
      photos={photos}
      rooms={rooms}
      availableAddons={availableAddons}
      assignedAddons={assignedAddons}
      availablePolicies={availablePolicies}
      assignedPolicies={assignedPolicies}
      categoryLeaves={categoryLeaves}
      amenityGroups={amenityGroups}
      access={access}
      localPicks={localPicks}
      initialTab={searchParams?.tab}
      autoCreateRoom={searchParams?.add === "1"}
    />
  );
}
