import type { Metadata } from "next";
import { XCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { notFound, redirect } from "next/navigation";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Payment failed",
};

export const dynamic = "force-dynamic";

export default async function BookingFailedPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, reference, status, listing:listings!inner ( name, slug )")
    .eq("id", params.id)
    .maybeSingle();

  if (!booking) notFound();

  const listing = booking.listing as unknown as {
    name: string;
    slug: string | null;
  };

  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />

      <main className="mx-auto max-w-xl px-5 py-10 lg:px-8 lg:py-16">
        <div className="rounded-card border border-brand-line bg-white p-8 shadow-card">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-status-cancelled">
            <XCircle className="h-7 w-7" />
          </div>

          <h1 className="mt-5 text-center font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
            Payment didn&rsquo;t go through.
          </h1>
          <p className="mt-2 text-center text-sm text-brand-mute">
            No worries — your card wasn&rsquo;t charged. You can try again with
            a different card, or contact the host directly.
          </p>

          <dl className="mt-6 space-y-3 rounded-card border border-brand-line bg-brand-light/60 p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-brand-mute">Booking reference</dt>
              <dd className="font-mono font-medium text-brand-ink">
                {booking.reference}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-brand-mute">Listing</dt>
              <dd className="font-medium text-brand-ink">{listing.name}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link
              href={listing.slug ? `/listing/${listing.slug}` : "/"}
              className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
            >
              Try again
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-4 py-2.5 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-accent"
            >
              Back to home
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
