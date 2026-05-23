import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { createServerClient } from "@/lib/supabase/server";

import { BookingForm } from "./BookingForm";

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

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { from?: string; to?: string; guests?: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const here = `/listing/${params.slug}/book${
    searchParams
      ? `?from=${searchParams.from ?? ""}&to=${searchParams.to ?? ""}&guests=${searchParams.guests ?? ""}`
      : ""
  }`;
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(here)}`);
  }

  // Public read of a published listing.
  const { data: listing } = await supabase
    .from("listings")
    .select(
      "id, slug, name, city, province, base_price, cleaning_fee, currency, max_guests, min_nights, cancellation_policy, instant_booking",
    )
    .eq("slug", params.slug)
    .maybeSingle();

  if (!listing) notFound();

  const checkIn = isIso(searchParams?.from) ? searchParams!.from! : "";
  const checkOut = isIso(searchParams?.to) ? searchParams!.to! : "";
  const guestsParsed = parseInt(searchParams?.guests ?? "", 10);
  const guests =
    Number.isFinite(guestsParsed) && guestsParsed > 0 ? guestsParsed : 2;

  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  const datesOk = nights > 0 && nights >= (listing.min_nights ?? 1);

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
            maxGuests={listing.max_guests ?? 50}
            guestEmail={user.email ?? ""}
          />
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
