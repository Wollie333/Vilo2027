import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CalendarRange, Crown, Plus } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";

import {
  SeasonalPricingManager,
  type ListingGroup,
  type SeasonalRule,
} from "./SeasonalPricingManager";

export const metadata: Metadata = {
  title: "Seasonal pricing · Vilo",
};

export const dynamic = "force-dynamic";

export default async function SeasonalPricingPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/seasonal-pricing");

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!host) {
    return (
      <div>
        <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <CalendarRange className="h-6 w-6" />
          </div>
          <h1 className="font-display text-lg font-bold text-brand-ink">
            Create your host profile first
          </h1>
          <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
            Finish host onboarding before creating seasonal pricing rules.
          </p>
        </div>
      </div>
    );
  }

  // Scope to the logged-in host. `listings` has a `public_read_published`
  // RLS policy (so guests can browse the directory), which means relying on
  // RLS alone here would also return every OTHER host's published listing.
  // The explicit `host_id` filter is what keeps the portfolio private — never
  // remove it. (Same fix as the rooms/listings pages.)
  const [{ data: featureRaw }, { data: listingsRaw }] = await Promise.all([
    supabase.rpc("check_feature_permission", {
      p_host_id: host.id,
      p_feature_key: "seasonal_pricing",
    }),
    supabase
      .from("listings")
      .select(
        "id, name, slug, booking_mode, base_price, weekend_price, cleaning_fee, currency, min_nights, rooms:listing_rooms ( id, name, base_price, weekend_price, cleaning_fee, currency, sort_order, is_active, deleted_at )",
      )
      .eq("host_id", host.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  // Seasonal rules carry no host_id and have a `public_read_seasonal_pricing`
  // policy, so they leak too — scope them to this host's listing ids.
  const hostListingIds = (listingsRaw ?? []).map((l) => l.id);
  const { data: rulesRaw } = hostListingIds.length
    ? await supabase
        .from("listing_seasonal_pricing")
        .select(
          "id, listing_id, room_id, label, start_date, end_date, price, currency, min_nights, priority, is_active",
        )
        .in("listing_id", hostListingIds)
        .order("priority", { ascending: false })
        .order("start_date", { ascending: true })
    : { data: null };

  const feature = featureRaw as { is_enabled: boolean } | null;
  const enabled = feature?.is_enabled ?? false;

  if (!enabled) {
    return (
      <div className="space-y-6">
        <Header />
        <UpgradeCard />
      </div>
    );
  }

  const listings: ListingGroup[] = (listingsRaw ?? []).map((l) => {
    const rawRooms =
      (l.rooms as Array<{
        id: string;
        name: string;
        base_price: number | string;
        weekend_price: number | string | null;
        cleaning_fee: number | string | null;
        currency: string;
        sort_order: number;
        is_active: boolean;
        deleted_at: string | null;
      }> | null) ?? [];

    const rooms = rawRooms
      .filter((r) => r.deleted_at === null)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((r) => ({
        id: r.id,
        name: r.name,
        basePrice: Number(r.base_price),
        weekendPrice: r.weekend_price == null ? null : Number(r.weekend_price),
        cleaningFee: r.cleaning_fee == null ? null : Number(r.cleaning_fee),
        currency: r.currency,
        isActive: r.is_active,
      }));

    return {
      id: l.id,
      name: l.name,
      slug: l.slug,
      bookingMode: l.booking_mode as
        | "whole_listing"
        | "rooms_only"
        | "flexible",
      basePrice: l.base_price == null ? null : Number(l.base_price),
      weekendPrice: l.weekend_price == null ? null : Number(l.weekend_price),
      cleaningFee: l.cleaning_fee == null ? null : Number(l.cleaning_fee),
      currency: l.currency,
      minNights: l.min_nights ?? 1,
      rooms,
    };
  });

  const rules: SeasonalRule[] = (rulesRaw ?? []).map((r) => ({
    id: r.id,
    listingId: r.listing_id,
    roomId: r.room_id,
    label: r.label,
    startDate: r.start_date,
    endDate: r.end_date,
    price: Number(r.price),
    currency: r.currency,
    minNights: r.min_nights,
    priority: r.priority,
    isActive: r.is_active,
  }));

  if (listings.length === 0) {
    return (
      <div className="space-y-6">
        <Header />
        <EmptyStateNoListings />
      </div>
    );
  }

  return <SeasonalPricingManager listings={listings} initialRules={rules} />;
}

function Header() {
  return (
    <header>
      <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
        Seasonal pricing
      </h1>
      <p className="mt-1 text-sm text-brand-mute">
        Set different nightly rates for high or low seasons — December holidays,
        Easter, school terms, slow winter weeks. Rules can apply to a whole
        listing or just one room. Room rules beat listing rules on the same
        dates.
      </p>
    </header>
  );
}

function EmptyStateNoListings() {
  return (
    <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
        <CalendarRange className="h-6 w-6" />
      </div>
      <h2 className="font-display text-lg font-bold text-brand-ink">
        Add a listing first
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
        Seasonal pricing rules attach to a listing — create one to start
        layering rates.
      </p>
      <Link
        href="/dashboard/listings/new"
        className="mt-4 inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
      >
        <Plus className="h-4 w-4" />
        New listing
      </Link>
    </div>
  );
}

function UpgradeCard() {
  return (
    <div className="rounded-card border border-brand-line bg-white p-8 shadow-card">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <Crown className="h-6 w-6" />
          </div>
          <div>
            <div className="font-display text-lg font-bold text-brand-ink">
              Seasonal pricing isn&rsquo;t available on your plan
            </div>
            <p className="mt-1 max-w-md text-sm text-brand-mute">
              Charge more in high season and offer discounts in low season — all
              without manually editing your base price.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/settings/subscription"
          className="inline-flex shrink-0 items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-secondary"
        >
          See plans
        </Link>
      </div>
    </div>
  );
}
