import type { Metadata } from "next";
import { headers } from "next/headers";
import { Link } from "@/i18n/navigation";
import { RotateCw } from "lucide-react";

import { getBrandName } from "@/lib/brand";
import { signListingToken } from "@/lib/ical";
import { createServerClient } from "@/lib/supabase/server";

import { ExportUrlList, type ExportUrl } from "./ExportUrlList";
import { FeedManager, type Feed } from "./FeedManager";

export const metadata: Metadata = {
  title: "Calendar sync",
};

export const dynamic = "force-dynamic";

export default async function CalendarSyncPage() {
  const supabase = createServerClient();
  const brandName = await getBrandName();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <p className="text-sm text-brand-mute">
        Sign in to manage calendar sync.{" "}
        <Link
          href="/login"
          className="text-brand-primary underline-offset-2 hover:underline"
        >
          Log in →
        </Link>
      </p>
    );
  }

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!host) {
    return (
      <div>
        <Empty body="Finish onboarding before connecting external calendars." />
      </div>
    );
  }

  const { data: listings } = await supabase
    .from("properties")
    .select("id, name")
    .eq("host_id", host.id)
    .is("deleted_at", null)
    .order("name");

  const { data: feedsRaw } = await supabase
    .from("ical_feeds")
    .select(
      "id, property_id, source_label, url, status, last_sync_at, last_error, imported_count, room_id",
    )
    .order("created_at", { ascending: false });

  const feedsByListing = new Map<string, Feed[]>();
  for (const f of (feedsRaw as Array<Feed & { property_id: string }> | null) ??
    []) {
    const arr = feedsByListing.get(f.property_id) ?? [];
    arr.push(f);
    feedsByListing.set(f.property_id, arr);
  }

  const listingList = listings ?? [];

  // Build each listing's signed iCal export URL so the host can actually copy it
  // (the token is derived from ICAL_TOKEN_SECRET — signListingToken throws if it's
  // unset, in which case we show none rather than crash the page).
  const hdrs = headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const hostHeader = hdrs.get("host");
  const origin = hostHeader
    ? `${proto}://${hostHeader}`
    : (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  let exportUrls: ExportUrl[] = [];
  try {
    exportUrls = listingList.map((l) => ({
      listingId: l.id,
      listingName: l.name,
      url: `${origin}/ical/${l.id}/${signListingToken(l.id)}`,
    }));
  } catch {
    exportUrls = [];
  }

  // Rooms per listing — a feed can optionally block just one room (per-room OTA
  // calendars). Whole-listing feeds (no room) stay the default.
  const { data: roomsRaw } = await supabase
    .from("property_rooms")
    .select("id, name, property_id")
    .in(
      "property_id",
      listingList.map((l) => l.id),
    )
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("sort_order");

  const roomsByListing = new Map<string, Array<{ id: string; name: string }>>();
  for (const r of (roomsRaw as Array<{
    id: string;
    name: string;
    property_id: string;
  }> | null) ?? []) {
    const arr = roomsByListing.get(r.property_id) ?? [];
    arr.push({ id: r.id, name: r.name });
    roomsByListing.set(r.property_id, arr);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
          Calendar sync
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Two-way iCal between {brandName} and Airbnb / Booking.com / SafariNow
          / NightsBridge (incl. LekkeSlaap) / Afristay / Google / Apple. Both
          directions live.
        </p>
      </header>

      {/* Export panel — already shipped */}
      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <RotateCw className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="font-display text-base font-semibold text-brand-ink">
              Export — push your {brandName} bookings out
            </div>
            <p className="mt-1 text-[13px] text-brand-mute">
              Every listing has a per-listing iCal URL. Paste it into the
              calendar tool you want to keep in sync.
            </p>
            <ExportUrlList items={exportUrls} />
          </div>
        </div>
      </section>

      {/* Import — per-listing feeds */}
      <section>
        <div className="mb-3">
          <h2 className="font-display text-base font-bold text-brand-ink">
            Import — pull external blocks in
          </h2>
          <p className="mt-1 text-[13px] text-brand-mute">
            Add a calendar URL per listing — Airbnb, Booking.com, SafariNow,
            NightsBridge (which also covers LekkeSlaap), Afristay and more. Hit{" "}
            <strong>Sync</strong> to pull immediately, or wait for the scheduled
            re-sync.
          </p>
        </div>

        {listingList.length === 0 ? (
          <Empty body="Publish your first listing before adding external calendars." />
        ) : (
          <div className="space-y-6">
            {listingList.map((listing) => (
              <article
                key={listing.id}
                className="rounded-card border border-brand-line bg-white p-5 shadow-card"
              >
                <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-display text-base font-semibold text-brand-ink">
                      {listing.name}
                    </div>
                    <Link
                      href={`/dashboard/properties/${listing.id}/edit`}
                      className="text-[11px] font-medium text-brand-primary hover:underline"
                    >
                      Edit listing →
                    </Link>
                  </div>
                </header>

                <FeedManager
                  listingId={listing.id}
                  feeds={feedsByListing.get(listing.id) ?? []}
                  rooms={roomsByListing.get(listing.id) ?? []}
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Empty({ body }: { body: string }) {
  return (
    <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center">
      <p className="text-sm text-brand-mute">{body}</p>
    </div>
  );
}
