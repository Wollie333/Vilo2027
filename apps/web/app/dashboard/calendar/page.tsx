import type { Metadata } from "next";
import { Calendar as CalendarIcon } from "lucide-react";
import Link from "next/link";

import { createServerClient } from "@/lib/supabase/server";

import {
  type CalBlock,
  type CalBooking,
  type CalListing,
  blockKind,
  blockSource,
  LISTING_TONES,
  mapOrigin,
  mapStatus,
  nightsBetween,
  type SeasonalRange,
  todayKey,
} from "./calendar-data";
import { CalendarWorkspace } from "./CalendarWorkspace";

export const metadata: Metadata = {
  title: "Calendar",
};

export const dynamic = "force-dynamic";

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type RawPhoto = { url: string; sort_order: number };
type RawListing = {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  base_price: number | string | null;
  cleaning_fee: number | string | null;
  booking_mode: string;
  listing_photos: RawPhoto[] | null;
  listing_rooms: { id: string }[] | null;
};
type RawBooking = {
  id: string;
  listing_id: string;
  status: string;
  origin: string | null;
  guest_name: string | null;
  check_in: string | null;
  check_out: string | null;
  guests_count: number | null;
  total_amount: number | string | null;
  guest: { full_name: string | null; avatar_url: string | null } | null;
};

export default async function CalendarPage() {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: host } = user
    ? await supabase
        .from("hosts")
        .select("id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle()
    : { data: null };

  // Window: previous month → +4 months, so navigating a few months stays
  // client-side without a refetch.
  const now = new Date();
  const winStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const winEnd = new Date(now.getFullYear(), now.getMonth() + 5, 0);

  let listings: CalListing[] = [];
  let bookings: CalBooking[] = [];
  let blocks: CalBlock[] = [];
  let seasonal: SeasonalRange[] = [];

  if (host) {
    // Listings (host-scoped — listings has a public_read_published RLS policy).
    const { data: lr } = await supabase
      .from("listings")
      .select(
        "id, name, city, province, base_price, cleaning_fee, booking_mode, listing_photos ( url, sort_order ), listing_rooms ( id )",
      )
      .eq("host_id", host.id)
      .eq("listing_type", "accommodation")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    listings = ((lr as RawListing[] | null) ?? []).map((l, i) => {
      const photo =
        (l.listing_photos ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null;
      return {
        id: l.id,
        name: l.name,
        location: [l.city, l.province].filter(Boolean).join(", "),
        rooms:
          l.booking_mode === "whole_listing"
            ? 1
            : Math.max(1, (l.listing_rooms ?? []).length),
        basePrice: Number(l.base_price ?? 0),
        cleaningFee: Number(l.cleaning_fee ?? 0),
        photo,
        tone: LISTING_TONES[i % LISTING_TONES.length],
      };
    });

    const listingIds = listings.map((l) => l.id);

    if (listingIds.length) {
      const [{ data: bk }, { data: bl }, { data: sp }] = await Promise.all([
        supabase
          .from("bookings")
          .select(
            "id, listing_id, status, origin, guest_name, check_in, check_out, guests_count, total_amount, guest:user_profiles!bookings_guest_id_fkey ( full_name, avatar_url )",
          )
          .eq("host_id", host.id)
          .not("check_in", "is", null)
          .lte("check_in", iso(winEnd))
          .gte("check_out", iso(winStart)),
        supabase
          .from("blocked_dates")
          .select("listing_id, date, reason, booking_id, room_id")
          .in("listing_id", listingIds)
          .gte("date", iso(winStart))
          .lte("date", iso(winEnd)),
        supabase
          .from("listing_seasonal_pricing")
          .select("listing_id, start_date, end_date, price, is_active")
          .in("listing_id", listingIds),
      ]);

      bookings = ((bk as RawBooking[] | null) ?? [])
        .filter((b) => b.check_in && b.check_out)
        .map((b) => {
          const ci = b.check_in as string;
          const co = b.check_out as string;
          const nights = Math.max(1, nightsBetween(ci, co));
          const total = Number(b.total_amount ?? 0);
          return {
            id: b.id,
            listingId: b.listing_id,
            guest: b.guest?.full_name || b.guest_name || "Guest",
            avatar: b.guest?.avatar_url ?? null,
            ci,
            co,
            status: mapStatus(b.status),
            origin: mapOrigin(b.origin),
            guests: b.guests_count ?? 1,
            rate: nights > 0 ? Math.round(total / nights) : total,
            total,
            ciTime: null,
            coTime: null,
          } satisfies CalBooking;
        });

      blocks = (bl ?? []).map((b) => ({
        listingId: b.listing_id as string,
        date: b.date as string,
        roomId: (b.room_id as string | null) ?? null,
        kind: blockKind(
          b.reason as string | null,
          b.booking_id as string | null,
        ),
        source: blockSource(b.reason as string | null),
      }));

      seasonal = (sp ?? [])
        .filter((r) => (r as { is_active?: boolean }).is_active !== false)
        .map((r) => ({
          listingId: r.listing_id as string,
          start: r.start_date as string,
          end: r.end_date as string,
          price: Number(r.price),
        }));
    }
  }

  if (!host || listings.length === 0) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
            Calendar
          </h1>
        </header>
        <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <CalendarIcon className="h-6 w-6" />
          </div>
          <h2 className="font-display text-lg font-bold text-brand-ink">
            No listings yet
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
            Add an accommodation listing to start tracking availability.
          </p>
          <Link
            href="/dashboard/listings/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
          >
            New listing
          </Link>
        </div>
      </div>
    );
  }

  return (
    <CalendarWorkspace
      listings={listings}
      bookings={bookings}
      blocks={blocks}
      seasonal={seasonal}
      today={todayKey()}
      refYear={now.getFullYear()}
      refMonth={now.getMonth()}
    />
  );
}
