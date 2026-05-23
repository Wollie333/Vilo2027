import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import { Editor, type EditorListing, type EditorPhoto } from "./Editor";

export const metadata: Metadata = {
  title: "Edit listing · Vilo",
};

export default async function EditListingPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/dashboard/listings/${params.id}/edit`);
  }

  // RLS (host_manage_own_listings) makes this implicitly own-only.
  const { data: listing } = await supabase
    .from("listings")
    .select(
      [
        "id",
        "host_id",
        "listing_type",
        "accommodation_type",
        "experience_type",
        "name",
        "slug",
        "description",
        "address_line1",
        "address_line2",
        "city",
        "province",
        "postal_code",
        "latitude",
        "longitude",
        "bedrooms",
        "bathrooms",
        "max_guests",
        "min_nights",
        "max_nights",
        "check_in_time",
        "check_out_time",
        "base_price",
        "weekend_price",
        "cleaning_fee",
        "currency",
        "cancellation_policy",
        "house_rules",
        "instant_booking",
        "is_published",
      ].join(", "),
    )
    .eq("id", params.id)
    .maybeSingle<EditorListing>();

  if (!listing) {
    notFound();
  }

  const [{ data: amenityRows }, { data: photoRows }] = await Promise.all([
    supabase
      .from("listing_amenities")
      .select("amenity_key")
      .eq("listing_id", params.id),
    supabase
      .from("listing_photos")
      .select("id, url, sort_order")
      .eq("listing_id", params.id)
      .order("sort_order", { ascending: true }),
  ]);

  const amenities = (amenityRows ?? []).map((r) => r.amenity_key);
  const photos: EditorPhoto[] = (photoRows ?? []).map((r) => ({
    id: r.id,
    url: r.url,
  }));

  return (
    <main className="min-h-screen bg-brand-light text-brand-ink">
      <div className="border-b border-brand-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 lg:px-8">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-brand-mute hover:text-brand-primary"
          >
            ← Dashboard
          </Link>
          <div className="text-xs text-brand-mute">
            Listing ID{" "}
            <span className="font-mono text-brand-ink">
              {listing.id.slice(0, 8)}
            </span>
          </div>
        </div>
      </div>

      <Editor listing={listing} amenities={amenities} photos={photos} />
    </main>
  );
}
