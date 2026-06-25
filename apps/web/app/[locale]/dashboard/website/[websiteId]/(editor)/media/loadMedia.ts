import "server-only";

import { getMyHostId } from "@/lib/host/current";
import { createServerClient } from "@/lib/supabase/server";
import {
  parseRoomMediaOverrides,
  type RoomMediaOverrides,
} from "@/lib/website/roomMedia";

export type RoomGalleryPhoto = {
  id: string;
  url: string;
  caption: string | null;
};

export type RoomGalleryRoom = {
  roomId: string;
  name: string;
  /** The room's own photos (property_photos) — toggled show/hide per website. */
  photos: RoomGalleryPhoto[];
  overrides: RoomMediaOverrides;
};

/**
 * Owner-scoped: the site's visible rooms with their photos + current media
 * overrides — feeds the Media tab's "Room galleries" view. Returns null when the
 * website isn't owned by the signed-in host.
 */
export async function loadRoomGalleries(
  websiteId: string,
): Promise<RoomGalleryRoom[] | null> {
  const supabase = createServerClient();
  const hostId = await getMyHostId(supabase);
  if (!hostId) return null;

  const { data: site } = await supabase
    .from("host_websites")
    .select("id")
    .eq("id", websiteId)
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!site) return null;

  const { data: wr } = await supabase
    .from("website_rooms")
    .select("room_id, display_name, sort_order, media_overrides")
    .eq("website_id", websiteId)
    .eq("is_visible", true)
    .order("sort_order", { ascending: true });
  const rows = wr ?? [];
  if (rows.length === 0) return [];

  const roomIds = rows.map((r) => r.room_id);
  const [{ data: prRows }, { data: photos }] = await Promise.all([
    supabase
      .from("property_rooms")
      .select("id, name, is_active, deleted_at")
      .in("id", roomIds),
    supabase
      .from("property_photos")
      .select("id, room_id, url, caption, sort_order")
      .in("room_id", roomIds)
      .order("sort_order", { ascending: true }),
  ]);

  const nameById = new Map(
    (prRows ?? [])
      .filter((r) => r.is_active !== false && !r.deleted_at)
      .map((r) => [r.id, r.name]),
  );
  const photosByRoom = new Map<string, RoomGalleryPhoto[]>();
  for (const p of photos ?? []) {
    const rid = (p as { room_id: string | null }).room_id;
    if (!rid) continue;
    const arr = photosByRoom.get(rid) ?? [];
    arr.push({
      id: (p as { id: string }).id,
      url: (p as { url: string }).url,
      caption: (p as { caption: string | null }).caption ?? null,
    });
    photosByRoom.set(rid, arr);
  }

  return rows
    .filter((r) => nameById.has(r.room_id))
    .map((r) => ({
      roomId: r.room_id,
      name: r.display_name?.trim() || nameById.get(r.room_id) || "Room",
      photos: photosByRoom.get(r.room_id) ?? [],
      overrides: parseRoomMediaOverrides(r.media_overrides),
    }));
}
