import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Ticket } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";

import {
  CouponsManager,
  type CouponAddon,
  type CouponListing,
  type CouponRow,
} from "./CouponsManager";

export const metadata: Metadata = {
  title: "Coupons",
};

export const dynamic = "force-dynamic";

export default async function CouponsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/coupons");

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!host) {
    return (
      <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
          <Ticket className="h-6 w-6" />
        </div>
        <h1 className="font-display text-lg font-bold text-brand-ink">
          Create your host profile first
        </h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
          Finish host onboarding before creating coupons.
        </p>
      </div>
    );
  }

  // Scope everything to the logged-in host. listings has a public read policy,
  // so the explicit host_id filter is what keeps the portfolio private.
  const [{ data: couponsRaw }, { data: listingsRaw }, { data: addonsRaw }] =
    await Promise.all([
      supabase
        .from("coupons")
        .select(
          "id, code, description, discount_type, discount_value, scope, property_id, room_id, addon_id, currency, min_nights, min_spend, starts_at, ends_at, max_redemptions, per_guest_limit, redeemed_count, is_active",
        )
        .eq("host_id", host.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("properties")
        .select(
          "id, name, currency, rooms:property_rooms ( id, name, is_active, deleted_at, sort_order )",
        )
        .eq("host_id", host.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("addons")
        .select("id, name, is_active")
        .eq("host_id", host.id)
        .order("sort_order", { ascending: true }),
    ]);

  const addons: CouponAddon[] = (addonsRaw ?? [])
    .filter((a) => a.is_active)
    .map((a) => ({ id: a.id, name: a.name }));

  const listings: CouponListing[] = (listingsRaw ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    currency: l.currency,
    rooms: (
      (l.rooms as Array<{
        id: string;
        name: string;
        is_active: boolean;
        deleted_at: string | null;
        sort_order: number;
      }> | null) ?? []
    )
      .filter((r) => r.deleted_at === null && r.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((r) => ({ id: r.id, name: r.name })),
  }));

  const coupons: CouponRow[] = (couponsRaw ?? []).map((c) => ({
    id: c.id,
    code: c.code,
    description: c.description,
    discountType: c.discount_type === "fixed" ? "fixed" : "percent",
    discountValue: Number(c.discount_value),
    scope: c.scope as CouponRow["scope"],
    listingId: c.property_id,
    roomId: c.room_id,
    addonId: c.addon_id,
    currency: c.currency,
    minNights: c.min_nights,
    minSpend: c.min_spend == null ? null : Number(c.min_spend),
    startsAt: c.starts_at,
    endsAt: c.ends_at,
    maxRedemptions: c.max_redemptions,
    perGuestLimit: c.per_guest_limit,
    redeemedCount: c.redeemed_count,
    isActive: c.is_active,
  }));

  return (
    <CouponsManager
      listings={listings}
      addons={addons}
      initialCoupons={coupons}
    />
  );
}
