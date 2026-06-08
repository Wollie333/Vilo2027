import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { ListingPolicyBlock } from "@/components/policy/ListingPolicyBlock";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { type SeasonalRule } from "@/lib/pricing";

import { type PricingModel } from "../../../dashboard/addons/schemas";
import { bedSummary, type RoomPricingMode } from "../roomDisplay";
import {
  BookingForm,
  type AvailableAddon,
  type RoomOption,
} from "./BookingForm";

const ACC_TYPE_LABEL: Record<string, string> = {
  hotel: "Hotel",
  guesthouse: "Guesthouse",
  bb: "B&B",
  self_catering: "Self-catering",
  lodge: "Lodge",
  apartment: "Apartment",
  villa: "Villa",
  cottage: "Cottage",
  other: "Stay",
};

export const metadata: Metadata = {
  title: "Confirm and pay",
};

// Guest-facing data (add-ons, rooms, pricing, availability) must always be read
// fresh. Reading cookies makes this route dynamically *rendered*, but that alone
// does NOT disable Next's per-fetch Data Cache — Supabase `.select()` GETs would
// still be frozen, so newly created/activated add-ons intermittently fail to
// appear. force-dynamic sets fetchCache: 'force-no-store' for the whole segment.
// (Mirrors the sibling rooms/[roomId] and dashboard/addons/[id] pages.)
export const dynamic = "force-dynamic";

function isIso(d: string | undefined): d is string {
  return !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function parseRoomIds(raw: string | undefined): string[] {
  if (!raw) return [];
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => uuidRe.test(s));
}

/** Parse "roomId:guests,roomId:guests" → Map<roomId, guests>. */
function parseRoomGuests(raw: string | undefined): Map<string, number> {
  const map = new Map<string, number>();
  if (!raw) return map;
  for (const pair of raw.split(",")) {
    const [id, g] = pair.split(":");
    const n = parseInt(g ?? "", 10);
    if (id && Number.isFinite(n) && n > 0) map.set(id.trim(), n);
  }
  return map;
}

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: {
    from?: string;
    to?: string;
    guests?: string;
    room_ids?: string;
    room_guests?: string;
  };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Accommodation checkout allows anonymous visitors — they create a guest
  // account inline in the form (see BookingForm).

  // Public read of a published listing.
  const { data: listing } = await supabase
    .from("listings")
    .select(
      "id, host_id, slug, name, city, province, base_price, weekend_price, cleaning_fee, currency, max_guests, min_nights, cancellation_policy, instant_booking, booking_mode, listing_type, accommodation_type, avg_rating, total_reviews, whole_listing_discount_pct, weekly_discount_pct, monthly_discount_pct, child_price, infant_price, pet_fee, allow_children, allow_infants, allow_pets",
    )
    .eq("slug", params.slug)
    .maybeSingle();

  if (!listing) notFound();

  // Dates are now chosen INSIDE the booking flow (step 1). Honour any prefill
  // from ?from/?to but never gate the page on them — Reserve arrives bare.
  const checkIn = isIso(searchParams?.from) ? searchParams!.from! : "";
  const checkOut = isIso(searchParams?.to) ? searchParams!.to! : "";
  const guestsParsed = parseInt(searchParams?.guests ?? "", 10);
  const guests =
    Number.isFinite(guestsParsed) && guestsParsed > 0 ? guestsParsed : 2;

  const requestedRoomIds = parseRoomIds(searchParams?.room_ids);
  const requestedGuestsByRoom = parseRoomGuests(searchParams?.room_guests);

  // ── Load every active room so the guest can pick on this page ──
  const { data: roomRows } = await supabase
    .from("listing_rooms")
    .select(
      "id, name, base_price, weekend_price, cleaning_fee, max_guests, min_guests, min_nights, pricing_mode, price_per_person, base_occupancy, extra_guest_price, child_price, infant_price, pet_fee, allow_children, allow_infants, allow_pets, view_type, has_ensuite_bathroom, private_entrance, pets_allowed",
    )
    .eq("listing_id", listing.id)
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  const roomsRaw = roomRows ?? [];
  const roomIds = roomsRaw.map((r) => r.id);

  // Beds per room + listing cover photo + a hero photo per room.
  const bedsByRoom = new Map<
    string,
    { bed_kind: string; quantity: number }[]
  >();
  const photoByRoom = new Map<string, string>();
  let coverImageUrl: string | null = null;
  {
    const [{ data: bedRows }, { data: photoRows }] = await Promise.all([
      roomIds.length > 0
        ? supabase
            .from("room_beds")
            .select("room_id, bed_kind, quantity, sort_order")
            .in("room_id", roomIds)
            .order("sort_order", { ascending: true })
        : Promise.resolve({
            data: [] as {
              room_id: string;
              bed_kind: string;
              quantity: number;
            }[],
          }),
      supabase
        .from("listing_photos")
        .select("room_id, url, sort_order")
        .eq("listing_id", listing.id)
        .order("sort_order", { ascending: true }),
    ]);
    for (const b of bedRows ?? []) {
      const arr = bedsByRoom.get(b.room_id) ?? [];
      arr.push({ bed_kind: b.bed_kind, quantity: b.quantity });
      bedsByRoom.set(b.room_id, arr);
    }
    for (const p of photoRows ?? []) {
      if (p.room_id == null) {
        if (coverImageUrl == null) coverImageUrl = p.url;
      } else if (!photoByRoom.has(p.room_id)) {
        photoByRoom.set(p.room_id, p.url);
      }
    }
  }

  const allRooms: RoomOption[] = roomsRaw.map((r) => {
    const features: string[] = [];
    if (r.has_ensuite_bathroom) features.push("En-suite");
    if (r.private_entrance) features.push("Private entrance");
    if (r.pets_allowed) features.push("Pet friendly");
    if (r.view_type) features.push(`${r.view_type} view`);
    return {
      id: r.id,
      name: r.name,
      bedsLabel: bedSummary(bedsByRoom.get(r.id) ?? []),
      photoUrl: photoByRoom.get(r.id) ?? null,
      features,
      maxGuests: r.max_guests,
      minGuests: r.min_guests ?? 1,
      minNights: r.min_nights ?? 1,
      cleaningFee: Number(r.cleaning_fee ?? 0),
      pricingMode: (r.pricing_mode ?? "per_room") as RoomPricingMode,
      basePrice: Number(r.base_price),
      weekendPrice: r.weekend_price == null ? null : Number(r.weekend_price),
      pricePerPerson:
        r.price_per_person == null ? null : Number(r.price_per_person),
      baseOccupancy: r.base_occupancy ?? null,
      extraGuestPrice:
        r.extra_guest_price == null ? null : Number(r.extra_guest_price),
      childPrice: Number(r.child_price ?? 0),
      infantPrice: Number(r.infant_price ?? 0),
      petFee: Number(r.pet_fee ?? 0),
      allowChildren: r.allow_children ?? true,
      allowInfants: r.allow_infants ?? true,
      allowPets: r.allow_pets ?? true,
    };
  });

  // Active seasonal rules for this listing — the guest can change dates in the
  // form, so load them all (not just the requested range) and let the engine
  // resolve per night. Matches what createBookingAction charges with.
  const { data: seasonalRows } = await supabase
    .from("listing_seasonal_pricing")
    .select(
      "room_id, start_date, end_date, adjustment_type, adjustment_value, label, priority, min_nights, is_active, created_at",
    )
    .eq("listing_id", listing.id)
    .eq("is_active", true);
  const seasonalRules: SeasonalRule[] = (seasonalRows ?? []).map((s) => ({
    roomId: s.room_id,
    startDate: s.start_date,
    endDate: s.end_date,
    adjustmentType: s.adjustment_type === "percent" ? "percent" : "absolute",
    adjustmentValue: Number(s.adjustment_value),
    label: s.label,
    priority: s.priority ?? 0,
    minNights: s.min_nights ?? null,
    isActive: s.is_active,
    createdAt: s.created_at,
  }));

  // Initial room selection: honour ?room_ids, else default the first room for
  // rooms-only listings (flexible/whole default to the whole place).
  const validRequested = requestedRoomIds.filter((id) => roomIds.includes(id));
  let initialSelectedRoomIds = validRequested;
  if (
    initialSelectedRoomIds.length === 0 &&
    listing.booking_mode === "rooms_only" &&
    allRooms.length > 0
  ) {
    initialSelectedRoomIds = [allRooms[0].id];
  }
  const initialRoomGuests: Record<string, number> = {};
  for (const r of allRooms) {
    const wanted = requestedGuestsByRoom.get(r.id);
    initialRoomGuests[r.id] = Math.min(
      Math.max(1, wanted ?? r.maxGuests),
      r.maxGuests,
    );
  }

  // Host EFT availability — guests can't RLS-read banking, so check via admin.
  const admin = createAdminClient();
  const { data: eftRow } = await admin
    .from("eft_banking_details")
    .select("id")
    .eq("host_id", listing.host_id)
    .eq("is_default", true)
    .eq("is_archived", false)
    .limit(1)
    .maybeSingle();
  const hasEftBanking = !!eftRow;

  // Prefill contact for a signed-in guest.
  let guestName = "";
  let guestPhone = "";
  if (user) {
    const { data: prof } = await supabase
      .from("user_profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .maybeSingle();
    guestName = prof?.full_name ?? "";
    guestPhone = prof?.phone ?? "";
  }

  // Eligible add-ons (listing-wide + any room-scoped on this listing). Lead-time
  // eligibility is applied client-side against the live check-in date, so the
  // list stays correct as the guest changes their dates.
  // Add-ons are listing-wide (not date-dependent); load them always so the
  // Details step has them once the guest picks dates. Lead-time eligibility is
  // applied client-side against the live check-in.
  let availableAddons: AvailableAddon[] = [];
  {
    const { data: addonJoinRows } = await supabase
      .from("listing_addons")
      .select(
        "addon_id, room_id, unit_price_override, addons!inner ( id, name, description, image_path, pricing_model, unit_price, currency, min_quantity, max_quantity, allow_custom_quantity, stock_quantity, is_required, is_active, lead_time_days )",
      )
      .eq("listing_id", listing.id);

    type Row = {
      addon_id: string;
      room_id: string | null;
      unit_price_override: number | null;
      addons: {
        id: string;
        name: string;
        description: string | null;
        image_path: string | null;
        pricing_model: PricingModel;
        unit_price: number;
        currency: string;
        min_quantity: number;
        max_quantity: number | null;
        allow_custom_quantity: boolean;
        stock_quantity: number | null;
        is_required: boolean;
        is_active: boolean;
        lead_time_days: number;
      };
    };

    const seen = new Map<string, AvailableAddon>();
    for (const raw of (addonJoinRows ?? []) as unknown as Row[]) {
      const a = Array.isArray(raw.addons) ? raw.addons[0] : raw.addons;
      if (!a) continue;
      if (!a.is_active) continue;
      // Room-scoped add-ons only apply if their room belongs to this listing.
      if (raw.room_id !== null && !roomIds.includes(raw.room_id)) continue;
      const effective =
        raw.unit_price_override == null
          ? Number(a.unit_price)
          : Number(raw.unit_price_override);
      const existing = seen.get(a.id);
      if (!existing || effective < existing.unitPrice) {
        seen.set(a.id, {
          id: a.id,
          name: a.name,
          description: a.description,
          imageUrl: a.image_path
            ? supabase.storage.from("addon-images").getPublicUrl(a.image_path)
                .data.publicUrl
            : null,
          pricingModel: a.pricing_model,
          unitPrice: effective,
          currency: a.currency,
          minQuantity: a.min_quantity,
          maxQuantity: a.max_quantity,
          allowCustomQuantity: a.allow_custom_quantity,
          stockQuantity: a.stock_quantity,
          isRequired: a.is_required,
          leadTimeDays: a.lead_time_days,
        });
      }
    }
    availableAddons = Array.from(seen.values());
  }

  const listingTypeLabel =
    ACC_TYPE_LABEL[listing.accommodation_type ?? "other"] ?? "Stay";

  return (
    <div className="bg-white text-brand-ink">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-5 py-8 lg:px-8 lg:py-12">
        <BookingForm
          listingId={listing.id}
          listingSlug={params.slug}
          listingName={listing.name}
          listingTypeLabel={listingTypeLabel}
          listingCity={listing.city}
          listingProvince={listing.province}
          coverImageUrl={coverImageUrl}
          ratingValue={
            listing.avg_rating == null ? null : Number(listing.avg_rating)
          }
          reviewCount={listing.total_reviews ?? null}
          basePrice={Number(listing.base_price ?? 0)}
          weekendPrice={
            listing.weekend_price == null ? null : Number(listing.weekend_price)
          }
          cleaningFee={Number(listing.cleaning_fee ?? 0)}
          listingChildPrice={Number(listing.child_price ?? 0)}
          listingInfantPrice={Number(listing.infant_price ?? 0)}
          listingPetFee={Number(listing.pet_fee ?? 0)}
          listingAllowChildren={listing.allow_children ?? true}
          listingAllowInfants={listing.allow_infants ?? true}
          listingAllowPets={listing.allow_pets ?? true}
          currency={listing.currency}
          cancellationPolicy={listing.cancellation_policy}
          instantBooking={listing.instant_booking}
          bookingMode={listing.booking_mode}
          checkIn={checkIn}
          checkOut={checkOut}
          minNights={listing.min_nights ?? 1}
          wholeGuests={guests}
          maxGuestsWhole={listing.max_guests ?? 50}
          guestEmail={user?.email ?? ""}
          isAuthenticated={!!user}
          guestName={guestName}
          guestPhone={guestPhone}
          allRooms={allRooms}
          initialSelectedRoomIds={initialSelectedRoomIds}
          initialRoomGuests={initialRoomGuests}
          availableAddons={availableAddons}
          hasEftBanking={hasEftBanking}
          seasonalRules={seasonalRules}
          wholeListingDiscountPct={
            listing.whole_listing_discount_pct == null
              ? null
              : Number(listing.whole_listing_discount_pct)
          }
          weeklyDiscountPct={
            listing.weekly_discount_pct == null
              ? null
              : Number(listing.weekly_discount_pct)
          }
          monthlyDiscountPct={
            listing.monthly_discount_pct == null
              ? null
              : Number(listing.monthly_discount_pct)
          }
        />

        <ListingPolicyBlock listingId={listing.id} className="mt-6" />
      </main>

      <SiteFooter />
    </div>
  );
}
