import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import type { PageDoc } from "@/lib/website/pageDoc.schema";

import type {
  GalleryData,
  ReviewsData,
  RoomCard,
  RoomsPreviewData,
  SiteData,
} from "./types";

/**
 * Real preview data for the wizard's theme preview: the AUTHENTICATED host's own
 * rooms, photos and reviews, keyed by the theme doc's leaf node ids — so the
 * preview shows THEIR listing in the chosen theme instead of stock. Best-effort
 * and isolated to the /theme-preview route: unauthenticated or empty → returns
 * {} and the caller falls back to sample data. Never throws.
 */
export async function realWizardPreviewData(doc: PageDoc): Promise<SiteData> {
  const out: SiteData = {};
  try {
    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return out;

    const { data: host } = await supabase
      .from("hosts")
      .select("id")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!host) return out;

    const { data: prop } = await supabase
      .from("properties")
      .select("id")
      .eq("host_id", host.id)
      .is("deleted_at", null)
      .order("is_published", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!prop) return out;

    const [{ data: rms }, { data: phs }, { data: rvs }] = await Promise.all([
      supabase
        .from("property_rooms")
        .select("id, name, base_price, currency, description, max_guests")
        .eq("property_id", prop.id)
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(6),
      supabase
        .from("property_photos")
        .select("url, caption, room_id, sort_order")
        .eq("property_id", prop.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("reviews")
        .select("rating, body, created_at, booking:bookings ( guest_name )")
        .eq("property_id", prop.id)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    // Photos: a cover per room + a flat gallery.
    const roomCover = new Map<string, string>();
    const gallery: { url: string; caption: string | null }[] = [];
    for (const ph of phs ?? []) {
      const url = (ph.url ?? "").trim();
      if (!url) continue;
      if (ph.room_id && !roomCover.has(ph.room_id))
        roomCover.set(ph.room_id, url);
      gallery.push({ url, caption: ph.caption ?? null });
    }

    const rooms: RoomCard[] = (rms ?? []).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      price: r.base_price ?? null,
      currency: r.currency ?? "ZAR",
      description:
        r.description ??
        (r.max_guests ? `Sleeps ${r.max_guests}` : null) ??
        null,
      imageUrl: roomCover.get(String(r.id)) ?? gallery[0]?.url ?? null,
      bookHref: "#",
      facts: r.max_guests ? [`Sleeps ${r.max_guests}`] : undefined,
    }));

    const roomsData: RoomsPreviewData = { rooms };
    const galleryData: GalleryData = { images: gallery.slice(0, 12) };

    const reviewRows = (rvs ?? []) as unknown as Array<{
      rating: number;
      body: string | null;
      created_at: string;
      booking: { guest_name: string | null } | null;
    }>;
    const count = reviewRows.length;
    const average =
      count > 0
        ? Math.round(
            (reviewRows.reduce((s, r) => s + r.rating, 0) / count) * 10,
          ) / 10
        : null;
    const reviewsData: ReviewsData = {
      average,
      count,
      items: reviewRows
        .filter((r) => r.body && r.body.trim())
        .map((r) => ({
          author: r.booking?.guest_name ?? "Guest",
          rating: r.rating,
          body: r.body as string,
          date: r.created_at.slice(0, 10),
        })),
    };

    // Key the real data by the doc's matching leaf node ids.
    const visit = (node: {
      id: string;
      type: string;
      props?: Record<string, unknown>;
      kids?: unknown[];
    }) => {
      if (Array.isArray(node.kids)) {
        for (const k of node.kids) visit(k as Parameters<typeof visit>[0]);
        return;
      }
      if (node.type === "rooms_preview" && rooms.length) {
        out[node.id] = { type: "rooms_preview", data: roomsData };
      } else if (node.type === "gallery" && galleryData.images.length) {
        out[node.id] = { type: "gallery", data: galleryData };
      } else if (node.type === "reviews" && reviewsData.items.length) {
        out[node.id] = { type: "reviews", data: reviewsData };
      } else if (node.type === "el_room_card" && rooms.length) {
        const wanted = node.props?.room_id;
        const room = rooms.find((r) => r.id === wanted) ?? rooms[0];
        if (room) out[node.id] = { type: "el_room_card", data: room };
      }
    };
    for (const s of doc.root.kids) {
      visit(s as unknown as Parameters<typeof visit>[0]);
    }
  } catch {
    // Best-effort preview — never break the render; fall back to sample.
    return out;
  }
  return out;
}
