import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { ListingPolicyBlock } from "@/components/policy/ListingPolicyBlock";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { type PricingModel } from "../../../dashboard/addons/schemas";
import { bedSummary, type RoomPricingMode } from "../roomDisplay";
import {
  BookingForm,
  type AvailableAddon,
  type RoomOption,
} from "./BookingForm";
import { ExperienceBookingForm } from "./ExperienceBookingForm";

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
  title: "Confirm and pay · Vilo",
};

function isIso(d: string | undefined): d is string {
  return !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function nightsBetween(from: string, to: string): number {
  const f = new Date(`${from}T00:00:00Z`).getTime();
  const t = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((t - f) / (1000 * 60 * 60 * 24));
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
    slot?: string;
    participants?: string;
  };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const qs = new URLSearchParams();
  if (searchParams?.from) qs.set("from", searchParams.from);
  if (searchParams?.to) qs.set("to", searchParams.to);
  if (searchParams?.guests) qs.set("guests", searchParams.guests);
  if (searchParams?.room_ids) qs.set("room_ids", searchParams.room_ids);
  if (searchParams?.room_guests)
    qs.set("room_guests", searchParams.room_guests);
  if (searchParams?.slot) qs.set("slot", searchParams.slot);
  if (searchParams?.participants)
    qs.set("participants", searchParams.participants);
  // Accommodation checkout allows anonymous visitors — they create a guest
  // account inline in the form (see BookingForm). Experiences still require a
  // signed-in user (that form isn't wired for inline signup yet).
  const here = `/listing/${params.slug}/book?${qs.toString()}`;

  // Public read of a published listing.
  const { data: listing } = await supabase
    .from("listings")
    .select(
      "id, host_id, slug, name, city, province, base_price, cleaning_fee, currency, max_guests, min_nights, cancellation_policy, instant_booking, booking_mode, listing_type, accommodation_type, avg_rating, total_reviews, duration_minutes, max_participants, min_participants, meeting_point, private_group_price",
    )
    .eq("slug", params.slug)
    .maybeSingle();

  if (!listing) notFound();

  // ── Experience path ────────────────────────────────────────────
  if (listing.listing_type === "experience") {
    if (!user) {
      redirect(`/login?next=${encodeURIComponent(here)}`);
    }
    const slotRaw = searchParams?.slot ?? "";
    const slotOk = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(slotRaw);
    const partRaw = parseInt(searchParams?.participants ?? "", 10);
    const minP = Math.max(1, listing.min_participants ?? 1);
    const maxP = listing.max_participants ?? 50;
    const participants =
      Number.isFinite(partRaw) && partRaw >= minP && partRaw <= maxP
        ? partRaw
        : minP;

    if (!slotOk || listing.base_price == null) {
      return (
        <div className="bg-brand-light text-brand-ink">
          <SiteHeader />
          <main className="mx-auto max-w-3xl px-5 py-8 lg:px-8 lg:py-12">
            <div className="rounded-card border border-brand-line bg-white p-6 shadow-card">
              <div className="font-display text-lg font-semibold text-brand-ink">
                Pick a session first
              </div>
              <p className="mt-2 text-sm text-brand-mute">
                We need a session date and time before we can take payment.
              </p>
              <a
                href={`/listing/${params.slug}`}
                className="mt-4 inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
              >
                Back to listing
              </a>
            </div>
          </main>
          <SiteFooter />
        </div>
      );
    }

    return (
      <div className="bg-brand-light text-brand-ink">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-5 py-8 lg:px-8 lg:py-12">
          <div className="mb-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
              Confirm and pay
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
              {listing.name}
            </h1>
            <div className="mt-1 text-sm text-brand-mute">
              {[listing.city, listing.province].filter(Boolean).join(", ")}
            </div>
          </div>

          <ExperienceBookingForm
            listingId={listing.id}
            listingName={listing.name}
            basePrice={Number(listing.base_price ?? 0)}
            privateGroupPrice={
              listing.private_group_price == null
                ? null
                : Number(listing.private_group_price)
            }
            currency={listing.currency}
            cancellationPolicy={listing.cancellation_policy}
            instantBooking={listing.instant_booking}
            durationMinutes={listing.duration_minutes ?? null}
            meetingPoint={listing.meeting_point ?? null}
            sessionDate={slotRaw}
            participants={participants}
            minParticipants={minP}
            maxParticipants={maxP}
          />

          <ListingPolicyBlock listingId={listing.id} className="mt-6" />
        </main>
        <SiteFooter />
      </div>
    );
  }
  // ── End experience path ───────────────────────────────────────

  const checkIn = isIso(searchParams?.from) ? searchParams!.from! : "";
  const checkOut = isIso(searchParams?.to) ? searchParams!.to! : "";
  const guestsParsed = parseInt(searchParams?.guests ?? "", 10);
  const guests =
    Number.isFinite(guestsParsed) && guestsParsed > 0 ? guestsParsed : 2;

  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  const datesOk = nights > 0 && nights >= (listing.min_nights ?? 1);

  const requestedRoomIds = parseRoomIds(searchParams?.room_ids);
  const requestedGuestsByRoom = parseRoomGuests(searchParams?.room_guests);

  // ── Load every active room so the guest can pick on this page ──
  const { data: roomRows } = await supabase
    .from("listing_rooms")
    .select(
      "id, name, base_price, cleaning_fee, max_guests, pricing_mode, price_per_person, base_occupancy, extra_guest_price, view_type, has_ensuite_bathroom, private_entrance, pets_allowed",
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
      cleaningFee: Number(r.cleaning_fee ?? 0),
      pricingMode: (r.pricing_mode ?? "per_room") as RoomPricingMode,
      basePrice: Number(r.base_price),
      pricePerPerson:
        r.price_per_person == null ? null : Number(r.price_per_person),
      baseOccupancy: r.base_occupancy ?? null,
      extraGuestPrice:
        r.extra_guest_price == null ? null : Number(r.extra_guest_price),
    };
  });

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

  // Eligible add-ons (listing-wide + any room-scoped on this listing).
  let availableAddons: AvailableAddon[] = [];
  if (datesOk) {
    const leadDays = Math.max(
      0,
      Math.round(
        (new Date(`${checkIn}T00:00:00Z`).getTime() -
          new Date(
            new Date().toISOString().slice(0, 10) + "T00:00:00Z",
          ).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );
    const { data: addonJoinRows } = await supabase
      .from("listing_addons")
      .select(
        "addon_id, room_id, unit_price_override, addons!inner ( id, name, description, image_path, pricing_model, unit_price, currency, min_quantity, max_quantity, is_required, is_active, lead_time_days )",
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
      if (a.lead_time_days > leadDays) continue;
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
          isRequired: a.is_required,
        });
      }
    }
    availableAddons = Array.from(seen.values());
  }

  const listingTypeLabel =
    ACC_TYPE_LABEL[listing.accommodation_type ?? "other"] ?? "Stay";

  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-5 py-8 lg:px-8 lg:py-12">
        {!datesOk ? (
          <div className="rounded-card border border-brand-line bg-white p-6 shadow-card">
            <div className="font-display text-lg font-semibold text-brand-ink">
              Pick your dates first
            </div>
            <p className="mt-2 text-sm text-brand-mute">
              We need check-in and check-out dates before we can take payment.
            </p>
            <a
              href={`/listing/${params.slug}`}
              className="mt-4 inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
            >
              Back to listing
            </a>
          </div>
        ) : (
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
            cleaningFee={Number(listing.cleaning_fee ?? 0)}
            currency={listing.currency}
            cancellationPolicy={listing.cancellation_policy}
            instantBooking={listing.instant_booking}
            bookingMode={listing.booking_mode}
            checkIn={checkIn}
            checkOut={checkOut}
            nights={nights}
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
          />
        )}

        {datesOk ? (
          <ListingPolicyBlock listingId={listing.id} className="mt-6" />
        ) : null}
      </main>

      <SiteFooter />
    </div>
  );
}
