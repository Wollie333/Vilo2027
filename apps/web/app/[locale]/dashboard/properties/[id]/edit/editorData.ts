import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import { hostHasFeature } from "@/lib/products/featureGate";
import {
  computeListingStrength,
  type ListingStrength,
} from "@/lib/search/listingStrength";
import type { CategoryPickerLeaf } from "@/lib/taxonomy/CategoryPicker";
import { getAmenityCatalog } from "@/lib/taxonomy/getAmenities";
import { getCategoriesForKind } from "@/lib/taxonomy/getCategories";
import type { AmenityGroupWithItems } from "@/lib/taxonomy/types";

import {
  type EditorAmenity,
  type EditorListing,
  type EditorPhoto,
  type EditorRoom,
  type EditorSeasonalRule,
} from "./Editor";
import { type PricingModel } from "../../../addons/schemas";
import { type PolicyType } from "../../../policies/schemas";
import type { AssignedAddon, AvailableAddon } from "./tabs/AddonsTab";
import type { AssignedPolicy, AvailablePolicy } from "./tabs/PoliciesTab";

// Either supabase client (RLS-bound server client or service-role admin client)
// is accepted — the host editor passes the RLS client (own-only), the admin
// editor passes the service-role client (any listing). Structurally identical.
type Db = ReturnType<typeof createAdminClient>;

export type ListingEditorData = {
  listing: EditorListing;
  amenities: EditorAmenity[];
  photos: EditorPhoto[];
  rooms: EditorRoom[];
  seasonalRules: EditorSeasonalRule[];
  availableAddons: AvailableAddon[];
  assignedAddons: AssignedAddon[];
  availablePolicies: AvailablePolicy[];
  assignedPolicies: AssignedPolicy[];
  categoryLeaves: CategoryPickerLeaf[];
  amenityGroups: AmenityGroupWithItems[];
  businesses: { id: string; name: string }[];
  /** Transparent, host-facing view of this listing's search ranking. */
  strength: ListingStrength;
  access: {
    check_in_method: string | null;
    check_in_instructions: string | null;
    gate_code: string | null;
    door_code: string | null;
    wifi_network: string | null;
    wifi_password: string | null;
    send_lead_minutes: number | null;
  } | null;
  localPicks: {
    category: "eat" | "drink" | "do" | "see" | "shop" | "other";
    title: string;
    blurb: string;
    distance_label: string;
  }[];
  // W12 — per-property publication channels. Directory = `listing.is_published`
  // (read from `listing` directly); website = membership on the owning
  // business's site (null when the business has no website yet).
  channels: {
    hasBusiness: boolean;
    // Booking-management channel — the property may use the internal booking
    // system. `entitled` is the product/plan permission (admin-controlled); when
    // false the card renders a locked "Coming soon" state. `enabled` is the
    // host's per-property switch. `externalWebsiteUrl` is shown when booking is
    // off so a directory-only listing can link out to the host's own site.
    booking: {
      entitled: boolean;
      enabled: boolean;
      externalWebsiteUrl: string | null;
    };
    // Wielo Directory channel — `entitled` is the `directory_listing` permission;
    // the per-property state is the already-loaded `listing.is_published`.
    directory: {
      entitled: boolean;
    };
    website: {
      // `entitled` is the `website_builder` permission — false ⇒ "Coming soon".
      entitled: boolean;
      websiteId: string;
      subdomain: string;
      status: "draft" | "published" | "unpublished";
      isVisible: boolean;
    } | null;
    // Website entitlement is also surfaced independently of `website` (which is
    // null until a site exists) so the card can show "Coming soon" correctly.
    websiteEntitled: boolean;
  };
};

// Single source of truth for the listing-editor payload. Shared by the host
// edit page (RLS client, own-only) and the admin user-record editor (service
// role, any listing). Returns null when the listing doesn't exist / isn't
// visible to the supplied client.
export async function loadListingEditorData(
  db: Db,
  listingId: string,
): Promise<ListingEditorData | null> {
  const { data: listing } = await db
    .from("properties")
    .select(
      [
        "id",
        "host_id",
        "business_id",
        "property_type",
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
        "whole_property_discount_pct",
        "weekly_discount_pct",
        "monthly_discount_pct",
        "currency",
        "vat_number",
        "vat_rate",
        "cancellation_policy",
        "house_rules",
        "instant_booking",
        "is_published",
        "booking_mode",
        "direct_booking_enabled",
        "external_website_url",
      ].join(", "),
    )
    .eq("id", listingId)
    .maybeSingle<EditorListing>();

  if (!listing) return null;

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
    { data: seasonalRows },
  ] = await Promise.all([
    db
      .from("property_amenities")
      .select("id, amenity_key, amenity_label, room_id")
      .eq("property_id", listingId),
    db
      .from("property_photos")
      .select("id, url, sort_order, room_id")
      .eq("property_id", listingId)
      .order("sort_order", { ascending: true }),
    db
      .from("property_rooms")
      .select(
        "id, name, description, bedrooms, bathrooms, max_guests, min_guests, min_nights, base_price, weekend_price, cleaning_fee, sort_order, is_active, room_size_sqm, bed_type, view_type, experiences, has_ensuite_bathroom, smoking_allowed, pets_allowed, wheelchair_accessible, private_entrance, floor_number, inventory_count, pricing_mode, price_per_person, base_occupancy, extra_guest_price, featured_photo_id, beds:room_beds ( bed_kind, quantity, sleeps, sort_order )",
      )
      .eq("property_id", listingId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
    db
      .from("addons")
      .select(
        "id, name, pricing_model, unit_price, currency, is_active, sort_order",
      )
      .eq("host_id", listing.host_id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    db
      .from("property_addons")
      .select("addon_id, room_id, unit_price_override")
      .eq("property_id", listingId),
    db
      .from("policies")
      .select("id, name, type")
      .eq("host_id", listing.host_id)
      .eq("status", "active")
      .is("deleted_at", null)
      .in("type", [
        "cancellation",
        "check_in_out",
        "house_rules",
        "booking_terms",
      ])
      .order("type", { ascending: true })
      .order("created_at", { ascending: true }),
    db
      .from("property_policies")
      .select("policy_id, policy_type, room_id")
      .eq("property_id", listingId),
    db
      .from("property_access")
      .select(
        "check_in_method, check_in_instructions, gate_code, door_code, wifi_network, wifi_password, send_lead_minutes",
      )
      .eq("property_id", listingId)
      .maybeSingle(),
    db
      .from("property_local_picks")
      .select("category, title, blurb, distance_label, sort_order")
      .eq("property_id", listingId)
      .order("sort_order", { ascending: true }),
    // Listing-wide seasonal rules (room-scoped rules are managed in the
    // dedicated seasonal-pricing page; the editor section is listing-wide).
    db
      .from("property_seasonal_pricing")
      .select(
        "id, label, start_date, end_date, adjustment_type, adjustment_value, currency, min_nights, priority, is_active",
      )
      .eq("property_id", listingId)
      .is("room_id", null)
      .order("start_date", { ascending: true }),
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
        send_lead_minutes: accessRow.send_lead_minutes ?? null,
      }
    : null;
  const localPicks = (localPickRows ?? []).map((r) => ({
    category: r.category as "eat" | "drink" | "do" | "see" | "shop" | "other",
    title: r.title,
    blurb: r.blurb ?? "",
    distance_label: r.distance_label ?? "",
  }));
  const seasonalRules: EditorSeasonalRule[] = (seasonalRows ?? []).map((r) => ({
    id: r.id,
    label: r.label,
    startDate: r.start_date,
    endDate: r.end_date,
    adjustmentType: r.adjustment_type === "percent" ? "percent" : "absolute",
    adjustmentValue: Number(r.adjustment_value),
    currency: r.currency ?? "ZAR",
    minNights: r.min_nights,
    priority: r.priority ?? 0,
    isActive: r.is_active ?? true,
  }));

  const [categoryLeavesAll, amenityGroups, { data: businessRows }] =
    await Promise.all([
      getCategoriesForKind(listing.property_type),
      getAmenityCatalog(),
      db
        .from("businesses")
        .select("id, trading_name, legal_name")
        .eq("host_id", listing.host_id)
        .eq("is_archived", false)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true }),
    ]);
  const businesses = (businessRows ?? []).map((b) => ({
    id: b.id,
    name: b.trading_name || b.legal_name || "Untitled business",
  }));

  // Per-property channel entitlements (admin-controlled, per product/plan). Each
  // gate is the on/off permission for a channel: booking management, the Wielo
  // directory, and the host website. Resolved via the canonical feature RPC so
  // the card can show a locked "Coming soon" state when a channel isn't included.
  const [bookingEntitled, directoryEntitled, websiteEntitled] =
    await Promise.all([
      hostHasFeature(listing.host_id, "direct_booking"),
      hostHasFeature(listing.host_id, "directory_listing"),
      hostHasFeature(listing.host_id, "website_builder"),
    ]);

  // W12 — resolve the Website channel for this property: does the owning
  // business have a site, and is this property visible on it? Directory is just
  // `listing.is_published` (already loaded). Both channels are independent.
  let channelWebsite: ListingEditorData["channels"]["website"] = null;
  if (listing.business_id) {
    const { data: site } = await db
      .from("host_websites")
      .select("id, subdomain, status")
      .eq("business_id", listing.business_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (site) {
      const { data: membership } = await db
        .from("website_properties")
        .select("is_visible")
        .eq("website_id", site.id)
        .eq("property_id", listingId)
        .maybeSingle();
      channelWebsite = {
        entitled: websiteEntitled,
        websiteId: site.id,
        subdomain: site.subdomain,
        status: site.status as "draft" | "published" | "unpublished",
        // No membership row yet ⇒ not on the site (sync/create seeds rows).
        isVisible: membership?.is_visible ?? false,
      };
    }
  }
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

  // The stored ranking row is the algorithm's own value — the panel shows it
  // verbatim so the host's number can never drift from where they actually rank.
  const { data: rankingRow } = await db
    .from("property_rankings")
    .select(
      "ranking_score, component_rating, component_reviews, component_profile, component_response_rate, last_calculated",
    )
    .eq("property_id", listingId)
    .maybeSingle();

  const strength = computeListingStrength({
    rankingScore: rankingRow?.ranking_score ?? null,
    componentRating: rankingRow?.component_rating ?? null,
    componentReviews: rankingRow?.component_reviews ?? null,
    componentProfile: rankingRow?.component_profile ?? null,
    componentResponse: rankingRow?.component_response_rate ?? null,
    lastCalculated: rankingRow?.last_calculated ?? null,
    name: listing.name,
    city: listing.city,
    hasDescription: Boolean(listing.description?.trim()),
    hasCheckInTime: Boolean(listing.check_in_time),
    photoCount: photos.length,
    amenityCount: amenities.length,
  });

  return {
    listing,
    amenities,
    photos,
    rooms,
    seasonalRules,
    availableAddons,
    assignedAddons,
    availablePolicies,
    assignedPolicies,
    categoryLeaves,
    amenityGroups,
    businesses,
    strength,
    access,
    localPicks,
    channels: {
      hasBusiness: Boolean(listing.business_id),
      booking: {
        entitled: bookingEntitled,
        enabled: listing.direct_booking_enabled,
        externalWebsiteUrl: listing.external_website_url,
      },
      directory: {
        entitled: directoryEntitled,
      },
      website: channelWebsite,
      websiteEntitled,
    },
  };
}
