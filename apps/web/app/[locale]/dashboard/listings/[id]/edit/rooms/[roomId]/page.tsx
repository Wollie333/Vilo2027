import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getMyHostId } from "@/lib/host/current";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import {
  RoomEditor,
  type RoomAvailability,
  type RoomEditorRoom,
  type RoomStats,
} from "./RoomEditor";

export const metadata: Metadata = {
  title: "Edit room",
};

export const dynamic = "force-dynamic";

export default async function EditRoomPage({
  params,
}: {
  params: { id: string; roomId: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/login?next=/dashboard/listings/${params.id}/edit/rooms/${params.roomId}`,
    );
  }

  const myHostId = await getMyHostId(supabase);
  if (!myHostId) notFound();

  // RLS host_manage_own_listings filters to listings the host owns.
  const { data: listing } = await supabase
    .from("properties")
    .select("id, name, slug, currency")
    .eq("id", params.id)
    .eq("host_id", myHostId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!listing) notFound();

  // RLS host_manage_own_rooms — same gate.
  const { data: room } = await supabase
    .from("property_rooms")
    .select(
      "id, listing_id, name, description, bedrooms, bathrooms, max_guests, min_guests, min_nights, base_price, weekend_price, cleaning_fee, currency, sort_order, is_active, room_size_sqm, bed_type, view_type, experiences, featured_photo_id, pricing_mode, price_per_person, base_occupancy, extra_guest_price, child_price, infant_price, pet_fee, infant_max_age, child_max_age, allow_children, allow_infants, allow_pets, has_ensuite_bathroom, inventory_count",
    )
    .eq("id", params.roomId)
    .eq("listing_id", params.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!room) notFound();

  // Per-room photos + per-room amenities + bed composition + access.
  const [
    { data: photoRows },
    { data: amenityRows },
    { data: bedRows },
    { data: accessRow },
  ] = await Promise.all([
    supabase
      .from("property_photos")
      .select("id, url, sort_order")
      .eq("listing_id", params.id)
      .eq("room_id", params.roomId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("property_amenities")
      .select("amenity_key")
      .eq("listing_id", params.id)
      .eq("room_id", params.roomId),
    supabase
      .from("room_beds")
      .select("bed_kind, quantity, sleeps, sort_order")
      .eq("room_id", params.roomId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("property_room_access")
      .select(
        "check_in_method, check_in_instructions, gate_code, door_code, wifi_network, wifi_password",
      )
      .eq("room_id", params.roomId)
      .maybeSingle(),
  ]);

  const roomShape: RoomEditorRoom = {
    id: room.id,
    name: room.name,
    description: room.description,
    bedrooms: room.bedrooms,
    bathrooms: room.bathrooms,
    max_guests: room.max_guests,
    min_guests: room.min_guests ?? 1,
    min_nights: room.min_nights ?? 1,
    base_price: Number(room.base_price),
    weekend_price:
      room.weekend_price != null ? Number(room.weekend_price) : null,
    cleaning_fee: Number(room.cleaning_fee ?? 0),
    is_active: room.is_active,
    room_size_sqm:
      room.room_size_sqm != null ? Number(room.room_size_sqm) : null,
    bed_type: room.bed_type ?? null,
    view_type: room.view_type ?? null,
    experiences: (room.experiences as string[] | null) ?? [],
    featured_photo_id: room.featured_photo_id ?? null,
    beds: (bedRows ?? []).map((b) => ({
      bed_kind: b.bed_kind,
      quantity: b.quantity,
      sleeps: b.sleeps,
    })),
    pricing_mode: (room.pricing_mode ??
      "per_room") as RoomEditorRoom["pricing_mode"],
    price_per_person:
      room.price_per_person != null ? Number(room.price_per_person) : null,
    base_occupancy: room.base_occupancy ?? null,
    extra_guest_price:
      room.extra_guest_price != null ? Number(room.extra_guest_price) : null,
    child_price: Number(room.child_price ?? 0),
    infant_price: Number(room.infant_price ?? 0),
    pet_fee: Number(room.pet_fee ?? 0),
    infant_max_age: room.infant_max_age ?? 2,
    child_max_age: room.child_max_age ?? 12,
    allow_children: room.allow_children ?? true,
    allow_infants: room.allow_infants ?? true,
    allow_pets: room.allow_pets ?? true,
  };
  // ── Real room stats + availability (service-role, scoped to this owned room) ──
  // The header stat band and the right-rail calendar are computed from actual
  // booking/blocked data — never placeholders.
  const admin = createAdminClient();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const winStart = new Date(now);
  // 30-night window: today-29 .. today inclusive = 30 days (matches the /30 denom).
  winStart.setDate(winStart.getDate() - 29);
  const winStartStr = winStart.toISOString().slice(0, 10);
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const monthEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  );
  const monthStartStr = monthStart.toISOString().slice(0, 10);
  const monthEndStr = monthEnd.toISOString().slice(0, 10);
  const daysInMonth = monthEnd.getUTCDate();
  // JS getUTCDay: 0=Sun..6=Sat → convert to Monday-based lead pad.
  const leadPad = (monthStart.getUTCDay() + 6) % 7;

  const [{ data: brRows }, { data: blockRows }] = await Promise.all([
    admin
      .from("booking_rooms")
      .select(
        "base_amount, booking_id, booking:bookings!inner ( check_in, check_out, status )",
      )
      .eq("room_id", params.roomId),
    admin
      .from("blocked_dates")
      .select("date, quote_id")
      .eq("room_id", params.roomId)
      .gte("date", monthStartStr)
      .lte("date", monthEndStr),
  ]);

  const ACTIVE = new Set([
    "pending",
    "pending_eft",
    "confirmed",
    "checked_in",
    "completed",
  ]);
  type BrRow = {
    base_amount: number | string | null;
    booking_id: string;
    booking:
      | { check_in: string; check_out: string; status: string }
      | { check_in: string; check_out: string; status: string }[]
      | null;
  };
  let bookingsCount = 0;
  let sumBase = 0;
  let sumNights = 0;
  let windowNights = 0;
  const bookedDays = new Set<string>();
  const bookingIds: string[] = [];
  for (const r of (brRows ?? []) as BrRow[]) {
    const b = Array.isArray(r.booking) ? r.booking[0] : r.booking;
    if (!b || !ACTIVE.has(b.status)) continue;
    bookingsCount += 1;
    if (r.booking_id) bookingIds.push(r.booking_id);
    const ci = new Date(`${b.check_in}T00:00:00Z`);
    const co = new Date(`${b.check_out}T00:00:00Z`);
    const nights = Math.max(
      1,
      Math.round((co.getTime() - ci.getTime()) / 86_400_000),
    );
    sumNights += nights;
    sumBase += Number(r.base_amount ?? 0);
    for (let d = new Date(ci); d < co; d = new Date(d.getTime() + 86_400_000)) {
      const ds = d.toISOString().slice(0, 10);
      if (ds >= winStartStr && ds <= todayStr) windowNights += 1;
      if (ds >= monthStartStr && ds <= monthEndStr) bookedDays.add(ds);
    }
  }
  const inventory = Math.max(1, Number(room.inventory_count ?? 1));
  const { data: revRows } =
    bookingIds.length > 0
      ? await admin
          .from("reviews")
          .select("rating")
          .eq("is_published", true)
          .in("booking_id", bookingIds)
      : { data: [] as { rating: number | null }[] };
  const ratings = (revRows ?? [])
    .map((r) => Number(r.rating))
    .filter((n) => Number.isFinite(n) && n > 0);
  const stats: RoomStats = {
    bookings: bookingsCount,
    occupancyPct: Math.min(
      100,
      Math.round((windowNights / (30 * inventory)) * 100),
    ),
    avgRate: sumNights > 0 ? Math.round(sumBase / sumNights) : 0,
    rating:
      ratings.length > 0
        ? Math.round(
            (ratings.reduce((s, n) => s + n, 0) / ratings.length) * 10,
          ) / 10
        : null,
    reviewCount: ratings.length,
  };

  const heldDays = new Set<string>();
  const blockedDays = new Set<string>();
  for (const b of (blockRows ?? []) as {
    date: string;
    quote_id: string | null;
  }[]) {
    if (b.quote_id) heldDays.add(b.date);
    else blockedDays.add(b.date);
  }
  const availability: RoomAvailability = {
    monthLabel: monthStart.toLocaleDateString("en-ZA", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    leadPad,
    days: Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const ds = `${monthStartStr.slice(0, 8)}${String(day).padStart(2, "0")}`;
      const status: RoomAvailability["days"][number]["status"] = bookedDays.has(
        ds,
      )
        ? "booked"
        : heldDays.has(ds)
          ? "held"
          : blockedDays.has(ds)
            ? "blocked"
            : "open";
      return { day, status };
    }),
  };

  const photos = (photoRows ?? []).map((p) => ({ id: p.id, url: p.url }));
  const amenityKeys = (amenityRows ?? []).map((a) => a.amenity_key);
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

  return (
    <RoomEditor
      listingId={listing.id}
      listingName={listing.name}
      listingSlug={listing.slug ?? null}
      currency={listing.currency}
      room={roomShape}
      hasEnsuite={room.has_ensuite_bathroom ?? false}
      stats={stats}
      availability={availability}
      initialPhotos={photos}
      initialAmenityKeys={amenityKeys}
      initialAccess={access}
    />
  );
}
