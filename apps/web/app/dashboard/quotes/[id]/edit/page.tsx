import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import { QuoteForm } from "../../QuoteForm";
import { loadQuoteFormListings } from "../../_listings";

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

  const list = await loadQuoteFormListings(supabase, host.id);

  // Split saved add-ons: catalog lines (addon_id still in the listing's catalog)
  // rehydrate the picker; everything else is a custom line.
  const catalogIds = new Set(
    (list.find((l) => l.id === quote.listing_id)?.addons ?? []).map(
      (a) => a.id,
    ),
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
    <div className="mx-auto max-w-[1280px]">
      <header className="mb-6">
        <Link
          href={`/dashboard/quotes/${quote.id}`}
          className="text-sm font-medium text-brand-mute hover:text-brand-primary"
        >
          ← Back to quote
        </Link>
        <h1 className="mt-1 font-display text-[30px] font-bold tracking-tight text-brand-ink">
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
