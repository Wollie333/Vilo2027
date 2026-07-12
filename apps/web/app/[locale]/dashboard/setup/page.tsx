import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { decryptAccountNumber } from "@/lib/crypto/banking";
import { createServerClient } from "@/lib/supabase/server";
import { getAmenityCatalog } from "@/lib/taxonomy/getAmenities";
import { getCategoriesForKind } from "@/lib/taxonomy/getCategories";

import type { PolicyCard } from "../policies/PolicyManager";
import { isLockedPreset, type PolicyType } from "../policies/schemas";
import type {
  ListingGroup,
  SeasonalRule as SeasonalRuleView,
} from "../seasonal-pricing/SeasonalPricingManager";
import { SetupWizard } from "./SetupWizard";

// eft_banking_details stores account_number encrypted at rest. The shared
// BankAccountList only needs the last 4 for display, so decrypt server-side
// and ship the last4 down (matches /dashboard/settings/banking).
function last4FromCipher(stored: string | null): string {
  if (!stored) return "????";
  try {
    const plain = decryptAccountNumber(stored).replace(/\D/g, "");
    return plain.length >= 4 ? plain.slice(-4) : plain.padStart(4, "•");
  } catch {
    return "????";
  }
}

export const metadata: Metadata = {
  title: "Finish setting up",
};

export const dynamic = "force-dynamic";

export default async function SetupPage({
  searchParams,
}: {
  searchParams?: { step?: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // We need the host row + draft listing + banking + business + photos +
  // rooms. The wizard is single-listing-scoped to the host's primary
  // listing (the one seeded during onboarding). If no host yet → bounce
  // to onboarding.
  const { data: host } = await supabase
    .from("hosts")
    .select(
      "id, handle, display_name, bio, avatar_url, languages_spoken, highlights, website_url",
    )
    .eq("user_id", user.id)
    .maybeSingle();
  if (!host) redirect("/signup/host");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, email, phone, avatar_url, email_verified_at")
    .eq("id", user.id)
    .maybeSingle();

  // Primary listing — oldest one, the one seeded during onboarding. If a
  // host somehow has zero listings, we send them through /listings/new.
  const { data: listing } = await supabase
    .from("properties")
    .select(
      "id, name, slug, property_type, category_id, accommodation_type, description, base_price, weekend_price, cleaning_fee, currency, min_nights, max_guests, bedrooms, bathrooms, check_in_time, check_out_time, cancellation_policy, house_rules, is_published, booking_mode, address_line1, address_line2, city, province, postal_code, latitude, longitude",
    )
    .eq("host_id", host.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!listing) redirect("/dashboard/properties/new");

  // Banking + business — both nullable; the wizard handles "no row yet".
  // No deleted_at on this table — soft delete is via is_archived.
  const { data: bankAccounts } = await supabase
    .from("eft_banking_details")
    .select(
      "id, label, bank_name, account_holder, account_number, account_type, branch_code, swift_code, reference_format, is_default, created_at",
    )
    .eq("host_id", host.id)
    .eq("is_archived", false)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  // Business details come from the host's DEFAULT business (seeded at signup);
  // alias the businesses columns to the billing_* shape the form expects.
  const { data: businessDetails } = await supabase
    .from("businesses")
    .select(
      "legal_name, trading_name, vat_number, company_registration_number, billing_address_line1:address_line1, billing_address_line2:address_line2, billing_city:city, billing_postcode:postal_code, billing_country:country",
    )
    .eq("host_id", host.id)
    .eq("is_default", true)
    .eq("is_archived", false)
    .maybeSingle();

  const { data: photos } = await supabase
    .from("property_photos")
    .select("id, url, sort_order")
    .eq("property_id", listing.id)
    .order("sort_order", { ascending: true });

  const { data: rooms } = await supabase
    .from("property_rooms")
    .select(
      "id, name, description, bedrooms, bathrooms, max_guests, base_price, weekend_price, cleaning_fee, bed_type, view_type, is_active, featured_photo_id, pricing_mode, price_per_person, base_occupancy, extra_guest_price",
    )
    .eq("property_id", listing.id)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  // Per-room photos (for the card thumbnail + count).
  const { data: roomPhotos } = await supabase
    .from("property_photos")
    .select("id, url, room_id, sort_order")
    .eq("property_id", listing.id)
    .not("room_id", "is", null)
    .order("sort_order", { ascending: true });

  // Seasonal pricing rules for this listing — drives the (optional) Seasonal
  // step. Same table + shape the standalone /dashboard/seasonal-pricing page
  // reads, so rules created in the wizard show up there too and flow through
  // the booking price engine (lib/pricing/engine.ts → priceStay).
  const { data: seasonalRows } = await supabase
    .from("property_seasonal_pricing")
    .select(
      "id, property_id, room_id, label, start_date, end_date, adjustment_type, adjustment_value, price, currency, min_nights, priority, is_active",
    )
    .eq("property_id", listing.id)
    .order("priority", { ascending: false })
    .order("start_date", { ascending: true });

  // Amenities — catalog (groups) + the listing's current selection.
  const [amenityGroups, { data: amenityRows }] = await Promise.all([
    getAmenityCatalog(),
    supabase
      .from("property_amenities")
      .select("id, amenity_key, room_id")
      .eq("property_id", listing.id),
  ]);

  // Accommodation category leaves (skip the root) — drives the picker.
  const categoryLeavesAll = await getCategoriesForKind("accommodation");
  const categoryLeaves = categoryLeavesAll
    .filter((c) => c.parent_id !== null)
    .map((c) => ({
      id: c.id,
      label: c.label,
      description: c.description,
      slug: c.slug,
      kind: c.kind,
    }));

  // Policies — the same `policies` table /dashboard/policies reads, so anything
  // created here shows up there too. Guarantee the host has an editable default
  // of ALL FOUR types (incl. booking terms) AND that each is assigned to this
  // listing, so every policy picker opens on an active-by-default choice the
  // host can keep or replace (founder §A #4). This RPC is idempotent and also
  // seeds the presets + booking terms internally.
  await supabase.rpc("ensure_listing_policy_assignments", {
    p_listing_id: listing.id,
  });

  const { data: policyRows } = await supabase
    .from("policies")
    .select(
      "id, type, name, summary, preset, is_non_refundable, check_in_time, check_out_time",
    )
    .eq("host_id", host.id)
    .is("deleted_at", null)
    .in("status", ["active", "draft"])
    .order("type", { ascending: true })
    .order("created_at", { ascending: true });

  const policyIds = (policyRows ?? []).map((p) => p.id as string);

  const [{ data: policyRules }, { data: policyContent }, { data: assigned }] =
    policyIds.length > 0
      ? await Promise.all([
          supabase
            .from("policy_cancellation_rules")
            .select("policy_id, days_before, refund_percent, label")
            .in("policy_id", policyIds)
            .order("days_before", { ascending: false }),
          supabase
            .from("policy_content")
            .select("policy_id, body_html")
            .in("policy_id", policyIds)
            .eq("locale", "en"),
          supabase
            .from("property_policies")
            .select("policy_type, policy_id")
            .eq("property_id", listing.id)
            .is("room_id", null),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

  const rulesByPolicy = new Map<
    string,
    { days_before: number; refund_percent: number; label: string }[]
  >();
  (policyRules ?? []).forEach((r) => {
    const arr = rulesByPolicy.get(r.policy_id as string) ?? [];
    arr.push({
      days_before: r.days_before as number,
      refund_percent: r.refund_percent as number,
      label: r.label as string,
    });
    rulesByPolicy.set(r.policy_id as string, arr);
  });

  const bodyByPolicy = new Map<string, string>();
  (policyContent ?? []).forEach((c) => {
    if (c.body_html)
      bodyByPolicy.set(c.policy_id as string, c.body_html as string);
  });

  const policies: PolicyCard[] = (policyRows ?? []).map((p) => ({
    id: p.id as string,
    type: p.type as PolicyType,
    name: p.name as string,
    summary: (p.summary as string | null) ?? null,
    preset: (p.preset as string | null) ?? null,
    locked: isLockedPreset(p.preset as string | null),
    isNonRefundable: Boolean(p.is_non_refundable),
    checkInTime: (p.check_in_time as string | null) ?? null,
    checkOutTime: (p.check_out_time as string | null) ?? null,
    rules: rulesByPolicy.get(p.id as string) ?? [],
    bodyHtml: bodyByPolicy.get(p.id as string) ?? null,
  }));

  const policyAssignments: Partial<Record<PolicyType, string | null>> = {
    cancellation: null,
    check_in_out: null,
    house_rules: null,
    booking_terms: null,
  };
  (assigned ?? []).forEach((a) => {
    const t = a.policy_type as PolicyType;
    if (t in policyAssignments) policyAssignments[t] = a.policy_id as string;
  });

  // ── Seasonal step data (ListingGroup + rules), same shape the manager uses ──
  const listingCurrency = listing.currency ?? "ZAR";
  const seasonalListing: ListingGroup = {
    id: listing.id,
    name: listing.name,
    slug: (listing.slug as string | null) ?? null,
    bookingMode:
      (listing.booking_mode as "whole_listing" | "rooms_only" | "flexible") ??
      "whole_listing",
    basePrice: listing.base_price == null ? null : Number(listing.base_price),
    weekendPrice:
      listing.weekend_price == null ? null : Number(listing.weekend_price),
    cleaningFee:
      listing.cleaning_fee == null ? null : Number(listing.cleaning_fee),
    currency: listingCurrency,
    minNights: listing.min_nights ?? 1,
    rooms: (rooms ?? [])
      .filter((r) => r.is_active)
      .map((r) => ({
        id: r.id as string,
        name: (r.name as string) ?? "Room",
        basePrice: r.base_price == null ? 0 : Number(r.base_price),
        weekendPrice: r.weekend_price == null ? null : Number(r.weekend_price),
        cleaningFee: r.cleaning_fee == null ? null : Number(r.cleaning_fee),
        currency: listingCurrency,
        isActive: Boolean(r.is_active),
      })),
  };

  const roomBasePrice = new Map<string, number>();
  for (const r of seasonalListing.rooms) roomBasePrice.set(r.id, r.basePrice);

  const seasonalRules: SeasonalRuleView[] = (seasonalRows ?? []).map((r) => {
    const adjustmentType: "absolute" | "percent" =
      r.adjustment_type === "percent" ? "percent" : "absolute";
    const adjustmentValue = Number(r.adjustment_value ?? r.price ?? 0);
    const refBase =
      (r.room_id
        ? roomBasePrice.get(r.room_id as string)
        : (seasonalListing.basePrice ?? 0)) ?? 0;
    const price =
      adjustmentType === "absolute"
        ? adjustmentValue
        : Math.max(0, refBase * (1 + adjustmentValue / 100));
    return {
      id: r.id as string,
      listingId: r.property_id as string,
      roomId: (r.room_id as string | null) ?? null,
      label: r.label as string,
      startDate: r.start_date as string,
      endDate: r.end_date as string,
      adjustmentType,
      adjustmentValue,
      price,
      currency: (r.currency as string) ?? listingCurrency,
      minNights: (r.min_nights as number | null) ?? null,
      priority: (r.priority as number) ?? 0,
      isActive: Boolean(r.is_active),
    };
  });

  return (
    <SetupWizard
      requestedStep={searchParams?.step ?? null}
      host={{
        id: host.id,
        handle: host.handle,
        display_name: host.display_name,
        bio: host.bio ?? "",
        avatar_url: host.avatar_url ?? "",
        languages_spoken: host.languages_spoken ?? [],
        highlights: host.highlights ?? [],
        website_url: host.website_url ?? "",
        // Paystack subaccount isn't wired up yet (no column on hosts).
        // EFT banking is the live payout path — treat that as "connected".
        paystack_connected: false,
      }}
      profile={{
        full_name: profile?.full_name ?? host.display_name,
        email: profile?.email || user.email || "",
        phone: profile?.phone ?? "",
      }}
      emailVerified={Boolean(profile?.email_verified_at)}
      listing={{
        id: listing.id,
        name: listing.name,
        property_type: "accommodation",
        category_id: listing.category_id ?? null,
        accommodation_type: listing.accommodation_type ?? null,
        description: listing.description ?? "",
        base_price:
          listing.base_price == null ? null : Number(listing.base_price),
        weekend_price:
          listing.weekend_price == null ? null : Number(listing.weekend_price),
        cleaning_fee:
          listing.cleaning_fee == null ? null : Number(listing.cleaning_fee),
        currency: listing.currency ?? "ZAR",
        max_guests: listing.max_guests ?? null,
        bedrooms: listing.bedrooms ?? null,
        bathrooms: listing.bathrooms ?? null,
        check_in_time: listing.check_in_time ?? "",
        check_out_time: listing.check_out_time ?? "",
        cancellation_policy:
          (listing.cancellation_policy as
            | "flexible"
            | "moderate"
            | "strict"
            | null) ?? null,
        house_rules: listing.house_rules ?? "",
        is_published: Boolean(listing.is_published),
        slug: (listing.slug as string | null) ?? null,
        booking_mode:
          (listing.booking_mode as
            | "whole_listing"
            | "rooms_only"
            | "flexible") ?? "whole_listing",
        address_line1: (listing.address_line1 as string | null) ?? null,
        address_line2: (listing.address_line2 as string | null) ?? null,
        city: (listing.city as string | null) ?? null,
        province: (listing.province as string | null) ?? null,
        postal_code: (listing.postal_code as string | null) ?? null,
        latitude: listing.latitude == null ? null : Number(listing.latitude),
        longitude: listing.longitude == null ? null : Number(listing.longitude),
      }}
      bankAccounts={(bankAccounts ?? []).map((b) => ({
        id: b.id as string,
        label: b.label as string,
        bank_name: b.bank_name as string,
        account_holder: b.account_holder as string,
        account_number_last4: last4FromCipher(
          b.account_number as string | null,
        ),
        account_type: b.account_type as
          | "cheque"
          | "savings"
          | "transmission"
          | "business",
        branch_code: b.branch_code as string,
        swift_code: (b.swift_code as string | null) ?? null,
        reference_format: (b.reference_format as string) ?? "{booking_ref}",
        is_default: Boolean(b.is_default),
      }))}
      businessDefaults={{
        legal_name: (businessDetails?.legal_name as string) ?? "",
        trading_name: (businessDetails?.trading_name as string) ?? "",
        vat_number: (businessDetails?.vat_number as string) ?? "",
        company_registration_number:
          (businessDetails?.company_registration_number as string) ?? "",
        billing_address_line1:
          (businessDetails?.billing_address_line1 as string) ?? "",
        billing_address_line2:
          (businessDetails?.billing_address_line2 as string) ?? "",
        billing_city: (businessDetails?.billing_city as string) ?? "",
        billing_postcode: (businessDetails?.billing_postcode as string) ?? "",
        billing_country: (businessDetails?.billing_country as string) ?? "ZA",
      }}
      businessNameSet={Boolean(
        ((businessDetails?.trading_name as string | null) ?? "").trim() ||
        ((businessDetails?.legal_name as string | null) ?? "").trim(),
      )}
      photos={(photos ?? []).map((p) => ({
        id: p.id as string,
        url: p.url as string,
      }))}
      rooms={(rooms ?? []).map((r) => {
        const mine = (roomPhotos ?? []).filter((p) => p.room_id === r.id);
        const featured =
          mine.find((p) => p.id === r.featured_photo_id)?.url ??
          mine[0]?.url ??
          null;
        return {
          id: r.id as string,
          name: (r.name as string) ?? "Room",
          description: (r.description as string | null) ?? null,
          bedrooms: (r.bedrooms as number | null) ?? null,
          bathrooms: (r.bathrooms as number | null) ?? null,
          max_guests: (r.max_guests as number | null) ?? null,
          base_price: r.base_price == null ? null : Number(r.base_price),
          weekend_price:
            r.weekend_price == null ? null : Number(r.weekend_price),
          cleaning_fee: r.cleaning_fee == null ? null : Number(r.cleaning_fee),
          bed_type: (r.bed_type as string | null) ?? null,
          view_type: (r.view_type as string | null) ?? null,
          is_active: Boolean(r.is_active),
          pricing_mode:
            (r.pricing_mode as
              | "per_room"
              | "per_person"
              | "per_room_plus_extra"
              | null) ?? "per_room",
          price_per_person:
            r.price_per_person == null ? null : Number(r.price_per_person),
          base_occupancy:
            r.base_occupancy == null ? null : Number(r.base_occupancy),
          extra_guest_price:
            r.extra_guest_price == null ? null : Number(r.extra_guest_price),
          featured_image: featured,
          photo_count: mine.length,
        };
      })}
      categoryLeaves={categoryLeaves}
      amenityGroups={amenityGroups}
      amenities={(amenityRows ?? []).map((a) => ({
        id: a.id as string,
        key: a.amenity_key as string,
        roomId: (a.room_id as string | null) ?? null,
      }))}
      policies={policies}
      policyAssignments={policyAssignments}
      seasonalListing={seasonalListing}
      seasonalRules={seasonalRules}
    />
  );
}
