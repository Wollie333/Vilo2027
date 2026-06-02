import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import { QuoteForm, type QuoteFormListing } from "../QuoteForm";

export const metadata: Metadata = {
  title: "New quote · Vilo",
};

export const dynamic = "force-dynamic";

export default async function NewQuotePage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/quotes/new");

  // Resolve the caller's host — the explicit host_id filter below is what keeps
  // the quote builder scoped to this host's own portfolio (listings are
  // public-readable, so RLS alone would leak other hosts' listings here).
  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Quotes are stay-shaped (dates, nights, per-night × nights pricing).
  const { data: listings } = host
    ? await supabase
        .from("listings")
        .select("id, name, booking_mode, base_price, cleaning_fee, currency")
        .eq("host_id", host.id)
        .eq("listing_type", "accommodation")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
    : { data: [] };

  const listingIds = (listings ?? []).map((l) => l.id);

  // The host's rooms + eligible add-on catalog, so the builder can pull in real
  // rooms and add-ons rather than free-typing everything.
  const [{ data: rooms }, { data: addonLinks }] = listingIds.length
    ? await Promise.all([
        supabase
          .from("listing_rooms")
          .select(
            "id, listing_id, name, base_price, cleaning_fee, max_guests, base_occupancy",
          )
          .in("listing_id", listingIds)
          .is("deleted_at", null)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("listing_addons")
          .select(
            "listing_id, unit_price_override, addons!inner ( id, name, pricing_model, unit_price, currency, min_quantity, max_quantity, is_active )",
          )
          .in("listing_id", listingIds),
      ])
    : [{ data: [] }, { data: [] }];

  type AddonJoin = {
    listing_id: string;
    unit_price_override: number | null;
    addons: {
      id: string;
      name: string;
      pricing_model: string;
      unit_price: number;
      currency: string;
      min_quantity: number;
      max_quantity: number | null;
      is_active: boolean;
    } | null;
  };

  // Build a per-listing add-on catalog (dedupe by addon id, keep cheapest link).
  const addonsByListing = new Map<string, QuoteFormListing["addons"]>();
  for (const raw of (addonLinks ?? []) as unknown as AddonJoin[]) {
    const a = Array.isArray(raw.addons) ? raw.addons[0] : raw.addons;
    if (!a || !a.is_active) continue;
    const price =
      raw.unit_price_override == null
        ? Number(a.unit_price)
        : Number(raw.unit_price_override);
    const list = addonsByListing.get(raw.listing_id) ?? [];
    const existing = list.find((x) => x.id === a.id);
    if (existing) {
      if (price < existing.unit_price) existing.unit_price = price;
    } else {
      list.push({
        id: a.id,
        name: a.name,
        pricing_model: a.pricing_model,
        unit_price: price,
        currency: a.currency,
        min_quantity: a.min_quantity ?? 1,
        max_quantity: a.max_quantity,
      });
    }
    addonsByListing.set(raw.listing_id, list);
  }

  const roomsByListing = new Map<string, QuoteFormListing["rooms"]>();
  for (const r of rooms ?? []) {
    const list = roomsByListing.get(r.listing_id) ?? [];
    list.push({
      id: r.id,
      name: r.name,
      base_price: r.base_price == null ? null : Number(r.base_price),
      cleaning_fee: r.cleaning_fee == null ? null : Number(r.cleaning_fee),
      max_guests: r.max_guests,
      base_occupancy: r.base_occupancy,
    });
    roomsByListing.set(r.listing_id, list);
  }

  const list: QuoteFormListing[] = (listings ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    booking_mode: l.booking_mode as QuoteFormListing["booking_mode"],
    base_price: l.base_price == null ? null : Number(l.base_price),
    cleaning_fee: l.cleaning_fee == null ? null : Number(l.cleaning_fee),
    currency: l.currency ?? "ZAR",
    rooms: roomsByListing.get(l.id) ?? [],
    addons: addonsByListing.get(l.id) ?? [],
  }));

  if (list.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          New quote
        </h1>
        <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
          <p className="text-sm text-brand-mute">
            You need at least one listing before you can draw a quote.
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
    <div className="space-y-6">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
          New quote
        </div>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
          Send a quote to a prospect
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Sending the quote soft-holds the dates on your calendar. The hold
          clears if the guest declines or the quote expires.
        </p>
      </header>
      <QuoteForm listings={list} />
    </div>
  );
}
