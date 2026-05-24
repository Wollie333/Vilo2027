import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { createServerClient } from "@/lib/supabase/server";

import { type PricingModel } from "../../../dashboard/addons/schemas";
import {
  BookingForm,
  type AvailableAddon,
  type BookedRoom,
} from "./BookingForm";

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
  const here = `/listing/${params.slug}/book?${qs.toString()}`;
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(here)}`);
  }

  // Public read of a published listing.
  const { data: listing } = await supabase
    .from("listings")
    .select(
      "id, slug, name, city, province, base_price, cleaning_fee, currency, max_guests, min_nights, cancellation_policy, instant_booking, booking_mode",
    )
    .eq("slug", params.slug)
    .maybeSingle();

  if (!listing) notFound();

  const checkIn = isIso(searchParams?.from) ? searchParams!.from! : "";
  const checkOut = isIso(searchParams?.to) ? searchParams!.to! : "";
  const guestsParsed = parseInt(searchParams?.guests ?? "", 10);
  const guests =
    Number.isFinite(guestsParsed) && guestsParsed > 0 ? guestsParsed : 2;

  const requestedRoomIds = parseRoomIds(searchParams?.room_ids);
  const scope: "whole_listing" | "rooms" =
    requestedRoomIds.length > 0 ? "rooms" : "whole_listing";

  // Mode/scope compatibility check.
  if (scope === "rooms" && listing.booking_mode === "whole_listing") {
    redirect(`/listing/${params.slug}`);
  }
  if (scope === "whole_listing" && listing.booking_mode === "rooms_only") {
    redirect(`/listing/${params.slug}`);
  }

  // Fetch rooms if scope=rooms.
  let bookedRooms: BookedRoom[] = [];
  let maxGuestsForForm = listing.max_guests ?? 50;
  if (scope === "rooms") {
    const { data: roomRows } = await supabase
      .from("listing_rooms")
      .select("id, name, base_price, cleaning_fee, max_guests")
      .eq("listing_id", listing.id)
      .is("deleted_at", null)
      .eq("is_active", true)
      .in("id", requestedRoomIds);

    if (!roomRows || roomRows.length !== requestedRoomIds.length) {
      redirect(`/listing/${params.slug}`);
    }
    bookedRooms = (roomRows ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      basePrice: Number(r.base_price),
      cleaningFee: Number(r.cleaning_fee ?? 0),
      maxGuests: r.max_guests,
    }));
    maxGuestsForForm = bookedRooms.reduce((acc, r) => acc + r.maxGuests, 0);
  }

  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  const datesOk = nights > 0 && nights >= (listing.min_nights ?? 1);

  // Fetch eligible addons (active + lead-time-satisfied + scope-matching).
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

    const selectedIds = bookedRooms.map((r) => r.id);
    const seen = new Map<string, AvailableAddon>();
    for (const raw of (addonJoinRows ?? []) as unknown as Row[]) {
      const a = Array.isArray(raw.addons) ? raw.addons[0] : raw.addons;
      if (!a) continue;
      if (!a.is_active) continue;
      if (a.lead_time_days > leadDays) continue;
      if (raw.room_id !== null) {
        if (scope !== "rooms") continue;
        if (!selectedIds.includes(raw.room_id)) continue;
      }
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
            basePrice={Number(listing.base_price ?? 0)}
            cleaningFee={Number(listing.cleaning_fee ?? 0)}
            currency={listing.currency}
            cancellationPolicy={listing.cancellation_policy}
            instantBooking={listing.instant_booking}
            checkIn={checkIn}
            checkOut={checkOut}
            nights={nights}
            guests={guests}
            maxGuests={maxGuestsForForm}
            guestEmail={user.email ?? ""}
            scope={scope}
            rooms={bookedRooms}
            availableAddons={availableAddons}
          />
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
