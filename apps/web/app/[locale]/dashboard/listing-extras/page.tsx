import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import {
  ExtrasManager,
  type ExtrasListing,
  type PoiItem,
  type ThemeItem,
} from "./ExtrasManager";

export const metadata: Metadata = { title: "Listing page extras" };
export const dynamic = "force-dynamic";

export default async function ListingExtrasPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/listing-extras");

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!host) redirect("/dashboard");

  // Scope to the logged-in host. `listings` has a `public_read_published` RLS
  // policy, so relying on RLS alone would return every OTHER host's published
  // listing (and their extras below). The explicit host_id filter keeps the
  // portfolio private — never remove it. (Same fix as rooms/listings/seasonal.)
  const { data: listingsRaw } = await supabase
    .from("listings")
    .select("id, name, latitude, longitude")
    .eq("host_id", host.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const listings: ExtrasListing[] = (listingsRaw ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    hasLocation: l.latitude != null && l.longitude != null,
  }));

  const listingIds = listings.map((l) => l.id);
  const [{ data: poiRaw }, { data: themeRaw }] = await Promise.all([
    listingIds.length > 0
      ? supabase
          .from("listing_points_of_interest")
          .select("id, listing_id, category, name, travel_time")
          .in("listing_id", listingIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] as never[] }),
    listingIds.length > 0
      ? supabase
          .from("listing_review_themes")
          .select("id, listing_id, label, icon_key, mention_count")
          .in("listing_id", listingIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const pois: PoiItem[] = (poiRaw ?? []).map(
    (p: {
      id: string;
      listing_id: string;
      category: string;
      name: string;
      travel_time: string | null;
    }) => ({
      id: p.id,
      listingId: p.listing_id,
      category: p.category as PoiItem["category"],
      name: p.name,
      travelTime: p.travel_time,
    }),
  );

  const themes: ThemeItem[] = (themeRaw ?? []).map(
    (t: {
      id: string;
      listing_id: string;
      label: string;
      icon_key: string;
      mention_count: number | null;
    }) => ({
      id: t.id,
      listingId: t.listing_id,
      label: t.label,
      iconKey: t.icon_key,
      mentionCount: t.mention_count,
    }),
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
          Listing page extras
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Curate the neighbourhood guide and the &ldquo;Guests mention&rdquo;
          chips that appear on your public listing page.
        </p>
      </header>

      {listings.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <MapPin className="h-6 w-6" />
          </div>
          <h2 className="font-display text-lg font-bold text-brand-ink">
            Add a listing first
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
            These extras attach to a listing — create one to get started.
          </p>
          <Link
            href="/dashboard/listings/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-secondary"
          >
            New listing
          </Link>
        </div>
      ) : (
        <ExtrasManager
          listings={listings}
          initialPois={pois}
          initialThemes={themes}
        />
      )}
    </div>
  );
}
