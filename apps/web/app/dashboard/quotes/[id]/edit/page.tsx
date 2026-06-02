import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import { QuoteForm, type QuoteFormListing } from "../../QuoteForm";

export const metadata: Metadata = {
  title: "Edit quote · Vilo",
};

export const dynamic = "force-dynamic";

export default async function EditQuotePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/quotes/${params.id}/edit`);

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!host) notFound();

  // The quote being edited (RLS scopes to the owner). Only draft/sent edit.
  const { data: quote } = await supabase
    .from("quotes")
    .select(
      "id, listing_id, status, guest_name, guest_email, guest_phone, check_in, check_out, headcount, scope, base_amount, cleaning_fee, notes",
    )
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!quote) notFound();
  if (quote.status !== "draft" && quote.status !== "sent") {
    // Locked — bounce back to the read-only detail page.
    redirect(`/dashboard/quotes/${params.id}`);
  }

  const [{ data: qrooms }, { data: qaddons }] = await Promise.all([
    supabase
      .from("quote_rooms")
      .select("room_id, base_amount, cleaning_fee")
      .eq("quote_id", params.id),
    supabase
      .from("quote_addons")
      .select("addon_id, label, quantity, unit_price")
      .eq("quote_id", params.id)
      .order("sort_order"),
  ]);

  // Host's listings enriched with rooms + add-on catalog (same shape the New
  // Quote page builds).
  const { data: listings } = await supabase
    .from("listings")
    .select("id, name, booking_mode, base_price, cleaning_fee, currency")
    .eq("host_id", host.id)
    .eq("listing_type", "accommodation")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const listingIds = (listings ?? []).map((l) => l.id);
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

  // Split the quote's saved add-ons: catalog lines (addon_id still in this
  // listing's catalog) rehydrate the picker; everything else is a custom line.
  const catalogIds = new Set(
    (addonsByListing.get(quote.listing_id) ?? []).map((a) => a.id),
  );
  const catalogAddons: { addon_id: string; quantity: number }[] = [];
  const customAddons: {
    label: string;
    quantity: number;
    unit_price: number;
  }[] = [];
  for (const a of qaddons ?? []) {
    if (a.addon_id && catalogIds.has(a.addon_id)) {
      catalogAddons.push({
        addon_id: a.addon_id,
        quantity: Number(a.quantity),
      });
    } else {
      customAddons.push({
        label: a.label,
        quantity: Number(a.quantity),
        unit_price: Number(a.unit_price),
      });
    }
  }

  const initial = {
    id: quote.id,
    listingId: quote.listing_id,
    guestName: quote.guest_name ?? "",
    guestEmail: quote.guest_email ?? "",
    guestPhone: quote.guest_phone ?? "",
    checkIn: quote.check_in ?? "",
    checkOut: quote.check_out ?? "",
    headcount: quote.headcount ?? 2,
    scope: (quote.scope === "rooms" ? "rooms" : "whole_listing") as
      | "whole_listing"
      | "rooms",
    baseAmount: Number(quote.base_amount),
    cleaningFee: Number(quote.cleaning_fee),
    notes: quote.notes ?? "",
    rooms: (qrooms ?? []).map((r) => ({
      room_id: r.room_id,
      guests: 1,
      base_amount: Number(r.base_amount),
      cleaning_fee: Number(r.cleaning_fee),
    })),
    catalogAddons,
    customAddons,
  };

  return (
    <div className="space-y-6">
      <header>
        <Link
          href={`/dashboard/quotes/${quote.id}`}
          className="text-sm font-medium text-brand-mute hover:text-brand-primary"
        >
          ← Back to quote
        </Link>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
          Edit quote
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          {quote.status === "sent"
            ? "This quote has already been sent — saving keeps a copy of the previous version and re-issues an updated PDF."
            : "Make your changes and save the draft."}
        </p>
      </header>
      <QuoteForm listings={list} initial={initial} />
    </div>
  );
}
