import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import type { QuoteFormListing } from "../../quotes/QuoteForm";

import { ManualBookingForm } from "./ManualBookingForm";

export const metadata: Metadata = {
  title: "New booking · Vilo",
};

export const dynamic = "force-dynamic";

export default async function NewBookingPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/bookings/new");

  // Manual booking entry is shaped for stays (check-in / check-out / nights).
  // Experience bookings are session-based and only created via the guest
  // booking flow at /listing/[slug]/book for now.
  const { data: listings } = await supabase
    .from("listings")
    .select("id, name, booking_mode, base_price, cleaning_fee, currency")
    .eq("listing_type", "accommodation")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const list: QuoteFormListing[] = (listings ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    booking_mode: l.booking_mode as QuoteFormListing["booking_mode"],
    base_price: l.base_price,
    cleaning_fee: l.cleaning_fee,
    currency: l.currency ?? "ZAR",
  }));

  if (list.length === 0) {
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
    <div className="space-y-6">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
          Manual booking
        </div>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
          Record a walk-in or phone booking
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          The booking lands confirmed and an invoice is attached automatically
          once the payment state lets it.
        </p>
      </header>
      <ManualBookingForm listings={list} />
    </div>
  );
}
