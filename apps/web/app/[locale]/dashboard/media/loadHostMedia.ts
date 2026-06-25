import "server-only";

import { getMyHostId } from "@/lib/host/current";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { websiteAssetUrl } from "@/lib/website/assets";
import type { MediaItem } from "@/app/[locale]/dashboard/website/actions";

/** A website media asset tagged with which of the host's websites it lives in. */
export type HostMediaItem = MediaItem & {
  websiteId: string;
  siteLabel: string;
};

export type HostWebsiteRef = { id: string; label: string };

export type HostListingMedia = {
  id: string;
  name: string;
  rooms: { id: string; name: string }[];
  photos: {
    id: string;
    url: string;
    caption: string | null;
    roomId: string | null;
  }[];
};

export type HostMediaData = {
  websites: HostWebsiteRef[];
  /** Where uploads from the host-level library land (the first/primary site). */
  primaryWebsiteId: string | null;
  websiteMedia: HostMediaItem[];
  listings: HostListingMedia[];
};

/**
 * Host-wide media: every website asset across ALL the host's websites + every
 * listing/room photo. Owner-scoped by host_id. Returns null when the signed-in
 * user isn't a host.
 */
export async function loadHostMedia(): Promise<HostMediaData | null> {
  const supabase = createServerClient();
  const hostId = await getMyHostId(supabase);
  if (!hostId) return null;

  const admin = createAdminClient();

  // ── Website media, aggregated across the host's websites ──
  const { data: sites } = await supabase
    .from("host_websites")
    .select("id, subdomain")
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  const websiteRows = (sites ?? []) as { id: string; subdomain: string }[];

  const websiteMedia: HostMediaItem[] = [];
  for (const site of websiteRows) {
    const [{ data: objects }, { data: metaRows }] = await Promise.all([
      admin.storage
        .from("website-assets")
        .list(site.id, {
          limit: 1000,
          sortBy: { column: "created_at", order: "desc" },
        }),
      supabase
        .from("website_media")
        .select("path, alt")
        .eq("website_id", site.id),
    ]);
    const altByPath = new Map<string, string | null>(
      (metaRows ?? []).map((r) => [r.path, r.alt]),
    );
    for (const o of objects ?? []) {
      if (o.id == null || o.name.endsWith("/")) continue;
      const path = `${site.id}/${o.name}`;
      websiteMedia.push({
        path,
        url: websiteAssetUrl(path) ?? "",
        name: o.name,
        size: (o.metadata as { size?: number } | null)?.size ?? null,
        createdAt: o.created_at ?? null,
        alt: altByPath.get(path) ?? null,
        websiteId: site.id,
        siteLabel: site.subdomain,
      });
    }
  }

  // ── Listing + room photos (the directory's real photos) ──
  const { data: props } = await supabase
    .from("properties")
    .select(
      "id, name, rooms:property_rooms ( id, name, deleted_at ), photos:property_photos ( id, url, caption, room_id, sort_order )",
    )
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const listings: HostListingMedia[] = (props ?? []).map((p) => {
    const rooms = (
      (p.rooms ?? []) as {
        id: string;
        name: string;
        deleted_at: string | null;
      }[]
    )
      .filter((r) => !r.deleted_at)
      .map((r) => ({ id: r.id, name: r.name }));
    const photos = (
      (p.photos ?? []) as {
        id: string;
        url: string;
        caption: string | null;
        room_id: string | null;
        sort_order: number;
      }[]
    )
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((ph) => ({
        id: ph.id,
        url: ph.url,
        caption: ph.caption ?? null,
        roomId: ph.room_id ?? null,
      }));
    return {
      id: (p as { id: string }).id,
      name: (p as { name: string }).name,
      rooms,
      photos,
    };
  });

  return {
    websites: websiteRows.map((s) => ({ id: s.id, label: s.subdomain })),
    primaryWebsiteId: websiteRows[0]?.id ?? null,
    websiteMedia,
    listings,
  };
}
