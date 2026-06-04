import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import {
  ManualBookingForm,
  type BookingAddon,
  type BookingBlocked,
  type BookingListing,
  type BookingRoom,
  type PastGuest,
} from "./ManualBookingForm";

export const metadata: Metadata = {
  title: "New booking",
};

export const dynamic = "force-dynamic";

export default async function NewBookingPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/bookings/new");

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Manual booking entry is shaped for stays (check-in / check-out / nights).
  const { data: listingRows } = host
    ? await supabase
        .from("listings")
        .select(
          "id, name, booking_mode, base_price, cleaning_fee, currency, city, max_guests",
        )
        .eq("host_id", host.id)
        .eq("listing_type", "accommodation")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
    : { data: null };

  const listingIds = (listingRows ?? []).map((l) => l.id);

  // Fetch the supporting catalogs for every listing up front, then group
  // client-side — far fewer round-trips than per-listing fetching.
  const today = new Date().toISOString().slice(0, 10);
  const [
    { data: photoRows },
    { data: roomRows },
    { data: addonRows },
    { data: blockedRows },
    { data: guestRows },
  ] = listingIds.length
    ? await Promise.all([
        supabase
          .from("listing_photos")
          .select("id, listing_id, room_id, url, sort_order")
          .in("listing_id", listingIds)
          .order("sort_order", { ascending: true }),
        supabase
          .from("listing_rooms")
          .select(
            "id, listing_id, name, base_price, cleaning_fee, max_guests, bed_type, view_type, has_ensuite_bathroom, featured_photo_id, sort_order, pricing_mode, price_per_person",
          )
          .in("listing_id", listingIds)
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("sort_order", { ascending: true }),
        supabase
          .from("listing_addons")
          .select(
            "id, listing_id, addon_id, unit_price_override, addons!inner ( name, description, unit_price, currency, pricing_model, min_quantity, max_quantity, is_required, is_active )",
          )
          .in("listing_id", listingIds),
        supabase
          .from("blocked_dates")
          .select("listing_id, room_id, date")
          .in("listing_id", listingIds)
          .gte("date", today),
        supabase
          .from("bookings")
          .select("guest_name, guest_email, guest_phone, check_in, created_at")
          .eq("host_id", host!.id)
          .not("guest_email", "is", null)
          .order("created_at", { ascending: false })
          .limit(200),
      ])
    : [
        { data: null },
        { data: null },
        { data: null },
        { data: null },
        { data: null },
      ];

  // Listing cover photo = first listing-wide photo (room_id null). Room photo =
  // its featured photo if set, else first photo tagged to that room.
  const listingCover = new Map<string, string>();
  const roomPhoto = new Map<string, string>();
  const photoById = new Map<string, string>();
  for (const p of photoRows ?? []) {
    photoById.set(p.id, p.url);
    if (p.room_id) {
      if (!roomPhoto.has(p.room_id)) roomPhoto.set(p.room_id, p.url);
    } else if (!listingCover.has(p.listing_id)) {
      listingCover.set(p.listing_id, p.url);
    }
  }

  const listings: BookingListing[] = (listingRows ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    booking_mode: l.booking_mode as BookingListing["booking_mode"],
    base_price: l.base_price,
    cleaning_fee: l.cleaning_fee,
    currency: l.currency ?? "ZAR",
    photo_url: listingCover.get(l.id) ?? null,
    location: l.city ?? null,
    max_guests: l.max_guests,
  }));

  const rooms: BookingRoom[] = (roomRows ?? []).map((r) => ({
    id: r.id,
    listing_id: r.listing_id,
    name: r.name,
    base_price: r.base_price,
    cleaning_fee: r.cleaning_fee,
    max_guests: r.max_guests,
    bed_type: r.bed_type,
    view_type: r.view_type,
    has_ensuite: r.has_ensuite_bathroom,
    photo_url:
      (r.featured_photo_id ? photoById.get(r.featured_photo_id) : null) ??
      roomPhoto.get(r.id) ??
      null,
    pricing_mode: (r.pricing_mode ?? "per_room") as BookingRoom["pricing_mode"],
    price_per_person:
      r.price_per_person == null ? null : Number(r.price_per_person),
  }));

  const addons: BookingAddon[] = (addonRows ?? [])
    .map((row) => {
      const a = row.addons as unknown as {
        name: string;
        description: string | null;
        unit_price: number;
        currency: string;
        pricing_model: string;
        min_quantity: number;
        max_quantity: number | null;
        is_required: boolean;
        is_active: boolean;
      };
      return { row, a };
    })
    .filter(({ a }) => a.is_active)
    .map(({ row, a }) => ({
      id: row.addon_id,
      listing_id: row.listing_id,
      name: a.name,
      description: a.description,
      unit_price: row.unit_price_override ?? a.unit_price,
      currency: a.currency,
      pricing_model: a.pricing_model,
      min_quantity: a.min_quantity,
      max_quantity: a.max_quantity,
      is_required: a.is_required,
    }));

  const blocked: BookingBlocked[] = (blockedRows ?? []).map((b) => ({
    listing_id: b.listing_id,
    room_id: b.room_id,
    date: b.date,
  }));

  // Dedupe past guests by email; keep the most recent contact details and a
  // stay count so the form can surface returning guests.
  const guestMap = new Map<string, PastGuest>();
  for (const g of guestRows ?? []) {
    const email = (g.guest_email ?? "").trim().toLowerCase();
    if (!email) continue;
    const existing = guestMap.get(email);
    const stayDate = g.check_in ?? g.created_at ?? null;
    if (existing) {
      existing.stays += 1;
      if (stayDate && (!existing.lastStay || stayDate > existing.lastStay)) {
        existing.lastStay = stayDate;
      }
    } else {
      guestMap.set(email, {
        name: g.guest_name ?? "",
        email: g.guest_email ?? "",
        phone: g.guest_phone,
        stays: 1,
        lastStay: stayDate,
      });
    }
  }
  const pastGuests = Array.from(guestMap.values()).sort((a, b) =>
    (b.lastStay ?? "").localeCompare(a.lastStay ?? ""),
  );

  if (listings.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          New booking
        </h1>
        <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
          <p className="text-sm text-brand-mute">
            You need at least one listing to record a booking.
          </p>
          <Link
            href="/dashboard/listings/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-secondary"
          >
            New listing
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ManualBookingForm
      listings={listings}
      rooms={rooms}
      addons={addons}
      blocked={blocked}
      pastGuests={pastGuests}
    />
  );
}
