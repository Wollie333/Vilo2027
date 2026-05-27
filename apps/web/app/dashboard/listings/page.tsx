import type { Metadata } from "next";
import { ExternalLink, Home, Plus } from "lucide-react";
import Link from "next/link";

import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Listings · Vilo",
};

export const dynamic = "force-dynamic";

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

const TYPE_LABEL: Record<string, string> = {
  hotel: "Hotel",
  guesthouse: "Guesthouse",
  bb: "B&B",
  self_catering: "Self-catering",
  lodge: "Lodge",
  other: "Stay",
  tour: "Tour",
  activity: "Activity",
  workshop: "Workshop",
  transfer: "Transfer",
};

export default async function ListingsPage() {
  const supabase = createServerClient();

  // RLS host_manage_own_listings — only the host's rows.
  const { data: listings } = await supabase
    .from("listings")
    .select(
      "id, name, slug, listing_type, accommodation_type, experience_type, city, province, base_price, currency, is_published, photos:listing_photos ( url, sort_order )",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
            Listings
          </h1>
          <p className="mt-1 text-sm text-brand-mute">
            Every place you&rsquo;ve added — drafts, live, or paused.
          </p>
        </div>
        <Link
          href="/dashboard/listings/new"
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
        >
          <Plus className="h-4 w-4" />
          New listing
        </Link>
      </header>

      {!listings || listings.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <Home className="h-6 w-6" />
          </div>
          <h2 className="font-display text-lg font-bold text-brand-ink">
            No listings yet
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
            Add your first listing to start taking direct bookings.
          </p>
          <Link
            href="/dashboard/listings/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
          >
            <Plus className="h-4 w-4" />
            Add a listing
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => {
            const photos =
              (l.photos as Array<{
                url: string;
                sort_order: number;
              }> | null) ?? [];
            const hero = photos.sort((a, b) => a.sort_order - b.sort_order)[0];
            const typeKey =
              l.listing_type === "accommodation"
                ? l.accommodation_type
                : l.experience_type;
            const typeLabel = TYPE_LABEL[typeKey ?? "other"] ?? "Stay";
            const location = [l.city, l.province].filter(Boolean).join(", ");
            return (
              <div
                key={l.id}
                className="group flex flex-col overflow-hidden rounded-card border border-brand-line bg-white shadow-card transition-shadow hover:shadow-lift"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-brand-accent">
                  {hero ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={hero.url}
                      alt={l.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-brand-mute">
                      <Home className="h-10 w-10" />
                    </div>
                  )}
                  <span
                    className={`absolute left-3 top-3 rounded-pill px-2 py-0.5 text-[10px] font-semibold ${
                      l.is_published
                        ? "bg-green-100 text-green-800"
                        : "bg-brand-line text-brand-mute"
                    }`}
                  >
                    {l.is_published ? "Published" : "Draft"}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-display text-base font-semibold text-brand-ink">
                        {l.name}
                      </div>
                      <div className="mt-0.5 text-xs text-brand-mute">
                        {typeLabel}
                        {location ? ` · ${location}` : ""}
                      </div>
                    </div>
                    {l.base_price != null ? (
                      <div className="shrink-0 text-right">
                        <div className="num font-display text-sm font-bold text-brand-primary">
                          {fmtR(Number(l.base_price), l.currency)}
                        </div>
                        <div className="text-[10px] text-brand-mute">
                          /night
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-auto flex items-center gap-3 border-t border-brand-line pt-3 text-sm">
                    <Link
                      href={`/dashboard/listings/${l.id}/edit`}
                      className="font-medium text-brand-primary hover:underline"
                    >
                      Edit
                    </Link>
                    {l.is_published && l.slug ? (
                      <Link
                        href={`/listing/${l.slug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-brand-mute hover:text-brand-ink"
                      >
                        View
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
